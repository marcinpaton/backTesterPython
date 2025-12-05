import yfinance as yf
import pandas as pd
import os
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DATA_FILE = os.path.join(DATA_DIR, "stock_prices.csv")

# Global cache variable
_cached_data = None
_cached_data_mtime = 0

def download_data(tickers: list[str], start_date: str, end_date: str):
    """
    Downloads historical data for the given tickers and saves it to a CSV file.
    """
    global _cached_data
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    print(f"Downloading data for {tickers} from {start_date} to {end_date}...")
    
    # Download data
    data = yf.download(tickers, start=start_date, end=end_date, group_by='ticker', progress=False)
    
    data.to_csv(DATA_FILE)
    print(f"Data saved to {DATA_FILE}")
    
    # Invalidate cache
    _cached_data = None
    
    return {"message": "Data downloaded successfully", "path": DATA_FILE}

def load_data():
    """
    Loads the locally saved data with caching.
    """
    global _cached_data, _cached_data_mtime
    
    if not os.path.exists(DATA_FILE):
        return None
    
    # Check file modification time
    current_mtime = os.path.getmtime(DATA_FILE)
    
    if _cached_data is not None and current_mtime == _cached_data_mtime:
        # print("Loading data from cache...")
        return _cached_data
    
    print("Loading data from disk...")
    # Load with MultiIndex header if multiple tickers were saved
    df = pd.read_csv(DATA_FILE, header=[0, 1], index_col=0, parse_dates=True)
    
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
    
    _cached_data = df
    _cached_data_mtime = current_mtime
    
    return df
