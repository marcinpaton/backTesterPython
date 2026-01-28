from __future__ import annotations
import yfinance as yf
import pandas as pd
import os
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DATA_FILE = os.path.join(DATA_DIR, "stock_prices.csv")
# TRANSACTIONS_DATA_FILE removed - now using database

# Global cache variable
# Cache is keyed by identifier: {key: (df, timestamp)}
_data_cache = {}

def download_data(tickers: list[str], start_date: str, end_date: str, filename: str = DATA_FILE, use_database: bool = False):
    """
    Downloads historical data for the given tickers.
    
    Args:
        tickers: List of ticker symbols
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        filename: CSV filename (used only if use_database=False)
        use_database: If True, saves to Supabase database instead of CSV
    """
    global _data_cache
    
    print(f"Downloading data from {start_date} to {end_date}...")
    
    # Download data
    data = yf.download(tickers, start=start_date, end=end_date, group_by='ticker', progress=False)
    
    # Sort columns to ensure deterministic order
    data = data.sort_index(axis=1)
    
    # Round to 6 decimal places
    data = data.round(6)
    
    if use_database:
        # Save to Supabase database
        from app.db_stock_prices import save_prices
        success = save_prices(data, tickers)
        
        # Invalidate cache
        cache_key = f"db_portfolio_{','.join(sorted(tickers))}"
        if cache_key in _data_cache:
            del _data_cache[cache_key]
        
        if success:
            print(f"Data saved to Supabase database")
            return {"message": "Data downloaded and saved to database", "tickers": len(tickers)}
        else:
            return {"error": "Failed to save data to database"}
    else:
        # Save to CSV file (backward compatibility)
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
    Downloads currency exchange rates for PLN/USD, PLN/EUR, PLN/GBP logic.
    Downloads both directions to be safe: USDPLN=X, EURPLN=X, GBPPLN=X (Foreign to PLN)
    and PLNUSD=X, PLNEUR=X, PLNGBP=X (PLN to Foreign).
    Start Date: 2001-01-01
    End Date: Today
    """
    tickers = ['USDPLN=X', 'EURPLN=X', 'GBPPLN=X', 'PLNUSD=X', 'PLNEUR=X', 'PLNGBP=X']
    start_date = "2001-01-01"
    end_date = datetime.now().strftime('%Y-%m-%d')
    
    print(f"Downloading currency rates for {tickers} from {start_date} to today...")
    
    try:
        # Download data (default group_by is 'column', so we have (Price, Ticker) structure usually)
        # We want to extract just the 'Close' prices
        data = yf.download(tickers, start=start_date, end=end_date, progress=False)
        
        # Check if 'Close' is in columns (standard yfinance structure for multiple tickers)
        if 'Close' in data.columns:
            data = data['Close']
        elif isinstance(data.columns, pd.MultiIndex):
            # If confusing structure, try to find Close level? 
            # With default yf.download and multiple tickers, data['Close'] returns a DF with tickers as columns
            pass
            
        # If single ticker (unlikely given list), it might be flat with 'Close' column
        # But we list multiple, so it should be fine.
        
        # Sort columns
        data = data.sort_index(axis=1)
        
        # Round
        data = data.round(6)
        
        data.to_csv(CURRENCY_DATA_FILE)
        print(f"Currency data (Close only) saved to {CURRENCY_DATA_FILE}")
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


def load_data(filename: str = DATA_FILE, from_database: bool = False, tickers: list[str] = None):
    """
    Loads stock price data with caching.
    
    Args:
        filename: CSV filename (used only if from_database=False)
        from_database: If True, loads from Supabase database instead of CSV
        tickers: List of tickers to load (required if from_database=True)
    
    Returns:
        pandas DataFrame with price data
    """
    global _data_cache
    
    if from_database:
        # Load from Supabase database
        if not tickers:
            print("Error: tickers required when loading from database")
            return None
        
        from app.db_stock_prices import get_prices
        import time
        
        # Create cache key
        cache_key = f"db_portfolio_{','.join(sorted(tickers))}"
        
        # Check cache (valid for 60 seconds)
        if cache_key in _data_cache:
            cached_df, cached_time = _data_cache[cache_key]
            if time.time() - cached_time < 60:
                # print(f"Loading data from cache (database)...")
                return cached_df
        
        print(f"Loading data from database for {len(tickers)} tickers...")
        df = get_prices(tickers)
        
        if df is not None and not df.empty:
            # Process data same as CSV
            if not isinstance(df.index, pd.DatetimeIndex):
                df.index = pd.to_datetime(df.index)
            
            df.sort_index(inplace=True)
            
            # Create complete range of business days
            full_idx = pd.date_range(start=df.index.min(), end=df.index.max(), freq='B')
            df = df.reindex(full_idx)
            df.ffill(inplace=True)
            
            # Cache with timestamp
            _data_cache[cache_key] = (df, time.time())
        
        return df
    else:
        # Load from CSV file (backward compatibility)
        if not os.path.exists(filename):
            return None
        
        # Check file modification time
        current_mtime = os.path.getmtime(filename)
        
        if filename in _data_cache:
            cached_df, cached_mtime = _data_cache[filename]
            if current_mtime == cached_mtime:
                # print(f"Loading data from cache ({filename})...")
                return cached_df
        
        print(f"Loading data from disk ({filename})...")
        # Load with MultiIndex header if multiple tickers were saved
        try:
             df = pd.read_csv(filename, header=[0, 1], index_col=0, parse_dates=True)
        except:
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
