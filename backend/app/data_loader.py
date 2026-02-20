from __future__ import annotations
import yfinance as yf
import pandas as pd
import os
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DATA_FILE = os.path.join(DATA_DIR, "stock_prices.csv")
PORTFOLIO_DATA_FILE = os.path.join(DATA_DIR, "portfolio_stock_prices.csv")
# TRANSACTIONS_DATA_FILE removed - now using database

# Global cache variable
# Cache is keyed by identifier: {key: (df, timestamp)}
_data_cache = {}

def _raw_download(tickers: list[str], start_date: str, end_date: str) -> pd.DataFrame:
    """
    Downloads historical Close prices from Yahoo Finance and returns a DataFrame.
    Does NOT save to disk.
    """
    if not tickers:
        return pd.DataFrame()

    data = yf.download(tickers, start=start_date, end=end_date, group_by='ticker', progress=False)

    if data.empty:
        return pd.DataFrame()

    # Keep only Close prices
    if isinstance(data.columns, pd.MultiIndex):
        try:
            data = data.xs('Close', level=1, axis=1)
        except KeyError:
            if 'Close' in data.columns:
                data = data['Close']
    else:
        if 'Close' in data.columns:
            data = data[['Close']]

    # Ensure DatetimeIndex
    if not isinstance(data.index, pd.DatetimeIndex):
        data.index = pd.to_datetime(data.index)

    # If only one ticker was requested, yfinance returns a Series or single-column
    # DataFrame named 'Close' – rename to the ticker symbol
    if isinstance(data, pd.Series):
        data = data.to_frame(name=tickers[0])
    elif len(tickers) == 1 and data.shape[1] == 1 and list(data.columns) == ['Close']:
        data.columns = [tickers[0]]

    data = data.round(6)
    return data


def _get_csv_metadata(filename: str):
    """
    Reads only the header row and the index column of a CSV to cheaply determine:
    - existing ticker columns
    - min / max date in the file
    Returns (set_of_tickers, min_date_str, max_date_str) or (set(), None, None) if no file.
    """
    if not os.path.exists(filename):
        return set(), None, None

    try:
        # Read header to get columns
        with open(filename, 'r') as f:
            header_line = f.readline().strip()

        columns = [c.strip().strip('"').upper() for c in header_line.split(',')]
        # First column is 'Date' – skip it
        tickers_in_file = set(c for c in columns[1:] if c)

        # Read only the first column (dates) to get the date range.
        date_col = pd.read_csv(filename, usecols=[0], parse_dates=[0])
        if date_col.empty:
            return tickers_in_file, None, None

        dates = pd.to_datetime(date_col.iloc[:, 0], errors='coerce').dropna()
        if dates.empty:
            return tickers_in_file, None, None

        min_date = dates.min().strftime('%Y-%m-%d')
        max_date = dates.max().strftime('%Y-%m-%d')
        return tickers_in_file, min_date, max_date

    except Exception as e:
        print(f"Warning: could not read CSV metadata from {filename}: {e}")
        return set(), None, None


def smart_download_data(tickers: list[str], start_date: str, end_date: str, filename: str = DATA_FILE):
    """
    Intelligently downloads only the data that is missing from the CSV file.
    
    Logic:
    1. Inspect existing CSV: which tickers exist, what date range is covered.
    2. Determine missing tickers and date gaps (prefix / suffix).
    3. Download only what is needed from Yahoo Finance.
    4. Merge new data with existing data and save.

    Args:
        tickers: List of ticker symbols requested
        start_date: Desired start date (YYYY-MM-DD)
        end_date:   Desired end date   (YYYY-MM-DD)
        filename:   Target CSV filename
    """
    global _data_cache

    # Helper to add one day for yfinance (exclusive end date)
    def _add_one_day(date_str):
        try:
            dt = datetime.strptime(date_str, '%Y-%m-%d')
            from datetime import timedelta
            return (dt + timedelta(days=1)).strftime('%Y-%m-%d')
        except:
            return date_str

    # Normalize requested tickers
    requested = set(t.strip().upper() for t in tickers if t.strip())

    # --- Step 1: Inspect existing CSV ---
    file_tickers, file_start, file_end = _get_csv_metadata(filename)
    
    # Normalize file tickers
    file_tickers = set(t.strip().upper() for t in file_tickers)

    print(f"[SmartDownload] Existing file: {len(file_tickers)} tickers: {sorted(list(file_tickers))}")
    print(f"[SmartDownload] Date range in file: {file_start} -> {file_end}")
    print(f"[SmartDownload] Requested:     {len(requested)} tickers: {sorted(list(requested))}")
    print(f"[SmartDownload] Requested range: {start_date} -> {end_date}")

    # --- Step 2: Compute what is missing ---
    new_tickers = sorted(list(requested - file_tickers))
    print(f"[SmartDownload] Calculated NEW tickers to fetch: {new_tickers}")

    # Date gaps only make sense when the file already exists with some data
    prefix_start = prefix_end = None
    suffix_start = suffix_end = None

    if file_start is not None and file_end is not None:
        if start_date < file_start:
            prefix_start = start_date
            prefix_end = file_start
        if end_date > file_end:
            suffix_start = file_end
            suffix_end = _add_one_day(end_date) # Add one day to include end_date in yf call
    else:
        # No existing data at all – treat as a full fresh download
        prefix_start = start_date
        prefix_end = _add_one_day(end_date)

    need_prefix = prefix_start is not None and (prefix_end is None or prefix_start < prefix_end)
    need_suffix = suffix_start is not None and (suffix_end is None or suffix_start < suffix_end)
    need_new    = len(new_tickers) > 0

    # --- Step 3: Check if nothing needs to be done ---
    if not need_prefix and not need_suffix and not need_new:
        print("[SmartDownload] All requested tickers and dates are already present. Nothing to download.")
        return {"message": "Data is already up to date", "path": filename}

    chunks = []   # Row-wise chunks (date gaps, same columns as existing)

    # Load existing data if the file exists
    existing_df = pd.DataFrame()
    if os.path.exists(filename):
        try:
            existing_df = pd.read_csv(filename, index_col=0, parse_dates=True)
            if not isinstance(existing_df.index, pd.DatetimeIndex):
                existing_df.index = pd.to_datetime(existing_df.index)
            # Ensure index is timezone-naive for consistent merging
            if existing_df.index.tz is not None:
                existing_df.index = existing_df.index.tz_localize(None)
            existing_df.sort_index(inplace=True)
        except Exception as e:
            print(f"Warning: could not load existing CSV {filename}: {e}")

    # Start from the existing data as the base
    merged = existing_df.copy() if not existing_df.empty else pd.DataFrame()

    # --- Step 4: Download missing pieces ---

    # 4a. Prefix gap – same tickers, earlier dates -> row-wise append
    existing_tickers_list = sorted(list(file_tickers & requested))
    if need_prefix:
        print(f"[SmartDownload] Fetching PREFIX gap {prefix_start} -> {prefix_end} "
              f"for {len(existing_tickers_list)} existing tickers")
        chunk = _raw_download(existing_tickers_list, prefix_start, prefix_end)
        if not chunk.empty:
            if chunk.index.tz is not None:
                chunk.index = chunk.index.tz_localize(None)
            chunks.append(chunk)
            print(f"[SmartDownload] Prefix chunk downloaded. Shape: {chunk.shape}")

    # 4b. Suffix gap – same tickers, later dates -> row-wise append
    if need_suffix:
        print(f"[SmartDownload] Fetching SUFFIX gap {suffix_start} -> {suffix_end} "
              f"for {len(existing_tickers_list)} existing tickers")
        chunk = _raw_download(existing_tickers_list, suffix_start, suffix_end)
        if not chunk.empty:
            if chunk.index.tz is not None:
                chunk.index = chunk.index.tz_localize(None)
            chunks.append(chunk)
            print(f"[SmartDownload] Suffix chunk downloaded. Shape: {chunk.shape}")

    # 4c. New tickers – new columns over full range -> column-wise join
    new_ticker_df = pd.DataFrame()
    if need_new:
        print(f"[SmartDownload] Fetching {len(new_tickers)} NEW tickers "
              f"for full range {start_date} -> {end_date}: {new_tickers}")
        new_ticker_df = _raw_download(new_tickers, start_date, _add_one_day(end_date))
        if not new_ticker_df.empty:
            print(f"[SmartDownload] NEW TICKET chunk downloaded. Shape: {new_ticker_df.shape}, Columns: {list(new_ticker_df.columns)}")
            if new_ticker_df.index.tz is not None:
                new_ticker_df.index = new_ticker_df.index.tz_localize(None)
        else:
            print(f"[SmartDownload] WARNING: No data returned for new tickers: {new_tickers}")

    # --- Step 5: Merge all pieces ---

    # 5a. Row-wise merge (date gaps with existing)
    if chunks:
        # Stack: existing rows + gap rows
        row_chunks = ([merged] if not merged.empty else []) + chunks
        merged = pd.concat(row_chunks, axis=0)
        # Remove duplicate dates (keep last – freshest data wins)
        merged = merged[~merged.index.duplicated(keep='last')]
        merged.sort_index(inplace=True)
        print(f"[SmartDownload] Row-wise merge complete. Final row count: {len(merged)}")

    # 5b. Column-wise join
    if merged.empty and not new_ticker_df.empty:
        # Edge case: no file at all, only new tickers downloaded
        merged = new_ticker_df
        print(f"[SmartDownload] Fresh download merge complete. Tickers: {list(merged.columns)}")
    elif not new_ticker_df.empty:
        # Column-wise join: add new ticker columns to the merged frame
        print(f"[SmartDownload] Merging {len(new_ticker_df.columns)} new columns into base DataFrame with {len(merged)} rows")
        
        # We use combine_first to preserve what's in 'merged' and add from 'new_ticker_df'
        # To be absolutely sure new tickers are added even if they have different index,
        # combine_first is appropriate.
        merged = merged.combine_first(new_ticker_df)
        merged.sort_index(inplace=True)
        print(f"[SmartDownload] Column-wise merge complete. Final ticker count: {len(merged.columns)}")
        print(f"[SmartDownload] Current columns: {sorted(list(merged.columns))}")

    if merged.empty:
        print("[SmartDownload] No data was downloaded or found.")
        return {"message": "No data downloaded", "path": filename}

    merged.sort_index(axis=1, inplace=True)
    merged = merged.round(6)

    # Save to CSV
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    merged.to_csv(filename)
    print(f"[SmartDownload] Data saved to {filename}. "
          f"Shape: {merged.shape}, columns: {len(merged.columns)}, "
          f"dates: {merged.index.min().date()} -> {merged.index.max().date()}")

    # Invalidate cache
    if filename in _data_cache:
        del _data_cache[filename]

    return {"message": "Data downloaded successfully", "path": filename}


# Keep backward-compatible alias
def download_data(tickers: list[str], start_date: str, end_date: str, filename: str = DATA_FILE):
    """Alias for smart_download_data (kept for backward compatibility)."""
    return smart_download_data(tickers, start_date, end_date, filename)

CURRENCY_DATA_FILE = os.path.join(DATA_DIR, "currency_prices.csv")
PORTFOLIO_CURRENCY_DATA_FILE = os.path.join(DATA_DIR, "portfolio_currency_prices.csv")

def download_currency_rates(filename: str = CURRENCY_DATA_FILE, start_date: str = "2025-10-01"):
    """
    Downloads currency exchange rates for PLN/USD, PLN/EUR, PLN/GBP logic and saves to CSV.
    """
    tickers = ['USDPLN=X', 'EURPLN=X', 'GBPPLN=X', 'PLNUSD=X', 'PLNEUR=X', 'PLNGBP=X']
    # start_date is now an argument
    end_date = datetime.now().strftime('%Y-%m-%d')
    
    print(f"Downloading currency rates for {tickers} from {start_date} to today...")
    
    try:
        data = yf.download(tickers, start=start_date, end=end_date, progress=False)
        
        if 'Close' in data.columns:
            data = data['Close']
        
        data = data.sort_index(axis=1)
        data = data.round(6)
        
        data.to_csv(filename)
        print(f"Currency data (Close only) saved to {filename}")
        
        # Invalidate cache
        if filename in _data_cache:
            del _data_cache[filename]
            
        return True
    except Exception as e:
        print(f"Error downloading currency rates: {e}")
        return False

def get_intraday_prices(tickers: list[str]):
    """
    Fetches the most recent intraday prices for given tickers.
    Uses 1-day period with 1-minute interval to get near real-time prices (~15 min delay).
    
    Returns:
        dict: {ticker: {'price': float, 'timestamp': str}, ...}
    """
    print(f"Fetching intraday prices for {len(tickers)} tickers...")
    
    result = {}
    
    try:
        # Download 1 day of data with 1-minute intervals
        # This gives us the most recent available price with ~15 min delay
        data = yf.download(
            tickers, 
            period='1d',  # Last 1 day
            interval='1m',  # 1-minute intervals
            progress=False
        )
        
        if data.empty:
            print("Warning: No intraday data returned")
            return result
        
        # Handle single ticker vs multiple tickers
        if len(tickers) == 1:
            # Single ticker - data is a simple DataFrame
            if 'Close' in data.columns and not data['Close'].empty:
                last_price = data['Close'].iloc[-1]
                last_timestamp = data.index[-1]
                result[tickers[0]] = {
                    'price': float(last_price),
                    'timestamp': last_timestamp.strftime('%Y-%m-%d %H:%M:%S')
                }
        else:
            # Multiple tickers - data has MultiIndex columns
            if 'Close' in data.columns:
                close_data = data['Close']
                for ticker in tickers:
                    if ticker in close_data.columns:
                        ticker_data = close_data[ticker].dropna()
                        if not ticker_data.empty:
                            last_price = ticker_data.iloc[-1]
                            last_timestamp = ticker_data.index[-1]
                            result[ticker] = {
                                'price': float(last_price),
                                'timestamp': last_timestamp.strftime('%Y-%m-%d %H:%M:%S')
                            }
        
        print(f"Successfully fetched intraday prices for {len(result)} tickers")
        return result
        
    except Exception as e:
        print(f"Error fetching intraday prices: {e}")
        import traceback
        traceback.print_exc()
        return result


def load_currency_data(start_date: Optional[str] = None, currencies: Optional[list[str]] = None, filename: str = CURRENCY_DATA_FILE):
    """
    Loads currency exchange rates from CSV with caching.
    """
    return load_data(filename)


def load_data(filename: str = DATA_FILE, tickers: list[str] = None, start_date: Optional[str] = None, columns: Optional[list[str]] = None):
    """
    Loads stock price data from CSV with caching.
    
    Args:
        filename: CSV filename
        tickers: List of tickers to load (optional filtering)
    
    Returns:
        pandas DataFrame with price data
    """
    global _data_cache
    
    if not os.path.exists(filename):
        print(f"File not found: {filename}")
        return None

    # Load from CSV file
    # Check file modification time
    current_mtime = os.path.getmtime(filename)
    
    if filename in _data_cache:
        cached_df, cached_mtime = _data_cache[filename]
        if current_mtime == cached_mtime:
            # print(f"Loading data from cache ({filename})...")
            return cached_df
    
    print(f"Loading data from disk ({filename})...")
    
    # Detect if MultiIndex header is present
    # We read the first two lines to check
    try:
        with open(filename, 'r') as f:
            line1 = f.readline().strip().split(',')
            line2 = f.readline().strip().split(',')
        
        # If the second line has many empty values or looks like header (no numbers in date column)
        # yfinance MultiIndex CSV usually has ticker names in row 0 and attributes in row 1
        # The first column is 'Date' (or empty)
        is_multi = False
        if len(line2) > 1:
            # Check if the first element of line2 is a date
            try:
                pd.to_datetime(line2[0])
                is_multi = False # Second line is data
            except:
                is_multi = True # Second line is likely a header
    except:
        is_multi = False

    try:
        if is_multi:
            df = pd.read_csv(filename, header=[0, 1], index_col=0, parse_dates=True)
        else:
            df = pd.read_csv(filename, index_col=0, parse_dates=True)
    except Exception as e:
        print(f"Error reading {filename}: {e}")
        df = pd.read_csv(filename, index_col=0, parse_dates=True)
    
    # Ensure we have a valid DatetimeIndex
    if not isinstance(df.index, pd.DatetimeIndex):
        df.index = pd.to_datetime(df.index)

    # Sort index just in case
    df.sort_index(inplace=True)

    if not df.empty:
        # Create a complete range of business days (Mon-Fri) from start to end
        full_idx = pd.date_range(start=df.index.min(), end=df.index.max(), freq='B')
        
        # Reindex the DataFrame to include all business days
        # This will introduce NaNs for missing days (e.g. holidays)
        df = df.reindex(full_idx)
        
        # Forward fill missing prices (use previous day's price)
        df.ffill(inplace=True)
    
    _data_cache[filename] = (df, current_mtime)
    
    return df
