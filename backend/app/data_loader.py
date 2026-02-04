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

def download_data(tickers: list[str], start_date: str, end_date: str, filename: str = DATA_FILE):
    """
    Downloads historical data for the given tickers and saves to CSV.
    
    Args:
        tickers: List of ticker symbols
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        filename: CSV filename
    """
    global _data_cache
    
    print(f"Downloading data from {start_date} to {end_date}...")
    
    # Download data
    data = yf.download(tickers, start=start_date, end=end_date, group_by='ticker', progress=False)
    
    # Sort columns to ensure deterministic order
    data = data.sort_index(axis=1)
    
    # Round to 6 decimal places
    data = data.round(6)
    
    # Save to CSV file
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    
    data.to_csv(filename)
    print(f"Data saved to {filename}")
    
    # Invalidate cache
    if filename in _data_cache:
        del _data_cache[filename]
    
    return {"message": "Data downloaded successfully", "path": filename}

CURRENCY_DATA_FILE = os.path.join(DATA_DIR, "currency_prices.csv")

def download_currency_rates():
    """
    Downloads currency exchange rates for PLN/USD, PLN/EUR, PLN/GBP logic and saves to CSV.
    """
    tickers = ['USDPLN=X', 'EURPLN=X', 'GBPPLN=X', 'PLNUSD=X', 'PLNEUR=X', 'PLNGBP=X']
    start_date = "2025-10-01"
    end_date = datetime.now().strftime('%Y-%m-%d')
    
    print(f"Downloading currency rates for {tickers} from {start_date} to today...")
    
    try:
        data = yf.download(tickers, start=start_date, end=end_date, progress=False)
        
        if 'Close' in data.columns:
            data = data['Close']
        
        data = data.sort_index(axis=1)
        data = data.round(6)
        
        data.to_csv(CURRENCY_DATA_FILE)
        print(f"Currency data (Close only) saved to {CURRENCY_DATA_FILE}")
        
        # Invalidate cache
        if CURRENCY_DATA_FILE in _data_cache:
            del _data_cache[CURRENCY_DATA_FILE]
            
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


def load_currency_data(start_date: Optional[str] = None, currencies: Optional[list[str]] = None):
    """
    Loads currency exchange rates from CSV with caching.
    """
    return load_data(CURRENCY_DATA_FILE)


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
