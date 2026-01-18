from __future__ import annotations
import yfinance as yf
import pandas as pd
import os
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DATA_FILE = os.path.join(DATA_DIR, "stock_prices.csv")
TRANSACTIONS_DATA_FILE = os.path.join(DATA_DIR, "transactions_stock_prices.csv")

# Global cache variable
# Cache is keyed by filename: {filename: (df, mtime)}
_data_cache = {}

def download_data(tickers: list[str], start_date: str, end_date: str, filename: str = DATA_FILE):
    """
    Downloads historical data for the given tickers and saves it to a CSV file.
    """
    global _data_cache
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    print(f"Downloading data from {start_date} to {end_date} into {filename}...")
    
    # Download data
    data = yf.download(tickers, start=start_date, end=end_date, group_by='ticker', progress=False)
    
    # Sort columns to ensure deterministic order
    data = data.sort_index(axis=1)
    
    # Round to 6 decimal places to ensure consistent file output
    data = data.round(6)
    
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

def load_data(filename: str = DATA_FILE):
    """
    Loads the locally saved data with caching.
    """
    global _data_cache
    
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
