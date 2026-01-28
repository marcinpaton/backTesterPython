"""
Database operations for stock prices table.
Handles conversion between pandas DataFrame (wide format) and database (long format).
"""
from typing import List, Optional, Dict, Any
import pandas as pd
from datetime import datetime, date
from app.supabase_client import supabase

STOCK_PRICES_TABLE = "stock_prices"


def save_prices(df: pd.DataFrame, tickers: List[str]) -> bool:
    """
    Saves stock price data to Supabase.
    
    Converts from pandas DataFrame (wide format with MultiIndex columns)
    to database format (long format - one row per ticker per date).
    
    Args:
        df: pandas DataFrame with MultiIndex columns (ticker, price_type)
            Index: dates
            Columns: MultiIndex with (ticker, 'Open'/'High'/'Low'/'Close'/'Volume')
        tickers: List of ticker symbols to save
        
    Returns:
        True if successful, False otherwise
    """
    try:
        if df is None or df.empty:
            print("No data to save")
            return True
        
        # Convert DataFrame to long format
        records = []
        
        for date_idx in df.index:
            # Convert date to string format
            if isinstance(date_idx, pd.Timestamp):
                date_str = date_idx.strftime('%Y-%m-%d')
            else:
                date_str = str(date_idx)
            
            for ticker in tickers:
                try:
                    # Extract OHLCV data for this ticker
                    if isinstance(df.columns, pd.MultiIndex):
                        # MultiIndex format: (ticker, price_type)
                        open_val = df.get((ticker, 'Open'), pd.Series()).loc[date_idx] if (ticker, 'Open') in df.columns else None
                        high_val = df.get((ticker, 'High'), pd.Series()).loc[date_idx] if (ticker, 'High') in df.columns else None
                        low_val = df.get((ticker, 'Low'), pd.Series()).loc[date_idx] if (ticker, 'Low') in df.columns else None
                        close_val = df.get((ticker, 'Close'), pd.Series()).loc[date_idx] if (ticker, 'Close') in df.columns else None
                        volume_val = df.get((ticker, 'Volume'), pd.Series()).loc[date_idx] if (ticker, 'Volume') in df.columns else None
                    else:
                        # Single ticker format
                        open_val = df.get('Open', pd.Series()).loc[date_idx] if 'Open' in df.columns else None
                        high_val = df.get('High', pd.Series()).loc[date_idx] if 'High' in df.columns else None
                        low_val = df.get('Low', pd.Series()).loc[date_idx] if 'Low' in df.columns else None
                        close_val = df.get('Close', pd.Series()).loc[date_idx] if 'Close' in df.columns else None
                        volume_val = df.get('Volume', pd.Series()).loc[date_idx] if 'Volume' in df.columns else None
                    
                    # Skip if close price is missing or NaN
                    if pd.isna(close_val):
                        continue
                    
                    record = {
                        'ticker': ticker,
                        'date': date_str,
                        'open': float(open_val) if not pd.isna(open_val) else None,
                        'high': float(high_val) if not pd.isna(high_val) else None,
                        'low': float(low_val) if not pd.isna(low_val) else None,
                        'close': float(close_val),
                        'volume': int(volume_val) if not pd.isna(volume_val) else None
                    }
                    records.append(record)
                    
                except Exception as e:
                    print(f"Error processing {ticker} on {date_str}: {e}")
                    continue
        
        if not records:
            print("No valid records to save")
            return True
        
        # Save to database in batches
        batch_size = 1000
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            try:
                # Upsert (insert or update on conflict)
                # Specify on_conflict to handle the unique constraint on (ticker, date)
                supabase.table(STOCK_PRICES_TABLE).upsert(batch, on_conflict="ticker,date").execute()
            except Exception as e:
                print(f"Error saving batch {i//batch_size + 1}: {e}")
                return False
        
        print(f"✅ Saved {len(records)} price records for {len(tickers)} tickers")
        return True
        
    except Exception as e:
        print(f"Error saving prices: {e}")
        import traceback
        traceback.print_exc()
        return False


def get_prices(tickers: List[str], start_date: Optional[str] = None, end_date: Optional[str] = None) -> Optional[pd.DataFrame]:
    """
    Retrieves stock price data from Supabase and converts to pandas DataFrame.
    
    Args:
        tickers: List of ticker symbols
        start_date: Optional start date (YYYY-MM-DD)
        end_date: Optional end date (YYYY-MM-DD)
        
    Returns:
        pandas DataFrame with MultiIndex columns (ticker, price_type)
        Index: dates
        Columns: MultiIndex with (ticker, 'Open'/'High'/'Low'/'Close'/'Volume')
        Returns None if no data found
    """
    try:
        if not tickers:
            return None
        
        # Build query with pagination to fetch all rows
        all_data = []
        page_size = 1000
        offset = 0
        
        while True:
            query = supabase.table(STOCK_PRICES_TABLE).select("*").in_("ticker", tickers)
            
            if start_date:
                query = query.gte("date", start_date)
            if end_date:
                query = query.lte("date", end_date)
            
            # Add deterministic ordering and range for pagination
            response = query.order("ticker").order("date").range(offset, offset + page_size - 1).execute()
            
            if not response.data:
                break
                
            all_data.extend(response.data)
            
            if len(response.data) < page_size:
                break
                
            offset += page_size
        
        if not all_data:
            print(f"No price data found for tickers: {tickers}")
            return None
        
        # Convert to DataFrame
        df_long = pd.DataFrame(all_data)
        
        # Convert date to datetime and normalize to date only
        df_long['date'] = pd.to_datetime(df_long['date']).dt.normalize()
        
        # Drop duplicates just in case (e.g. if pagination overlapped or data issue)
        df_long = df_long.drop_duplicates(subset=['ticker', 'date'], keep='first')
        
        # Convert date to datetime
        df_long['date'] = pd.to_datetime(df_long['date'])
        
        # Pivot to wide format
        # This creates a MultiIndex with (price_type, ticker)
        df_pivot = df_long.pivot(index='date', columns='ticker', values=['open', 'high', 'low', 'close', 'volume'])
        
        # Swap levels to get (ticker, price_type) and sort
        df_pivot = df_pivot.swaplevel(0, 1, axis=1).sort_index(axis=1)
        
        # Capitalize price types to match yfinance format (Open, High, Low, Close, Volume)
        new_columns = []
        for ticker, col in df_pivot.columns:
            new_columns.append((ticker, col.capitalize()))
            
        df_pivot.columns = pd.MultiIndex.from_tuples(new_columns)
        
        return df_pivot.sort_index()
        
    except Exception as e:
        print(f"Error loading prices: {e}")
        import traceback
        traceback.print_exc()
        return None


def delete_prices(tickers: List[str]) -> bool:
    """
    Deletes price data for specified tickers.
    
    Args:
        tickers: List of ticker symbols to delete
        
    Returns:
        True if successful, False otherwise
    """
    try:
        supabase.table(STOCK_PRICES_TABLE).delete().in_("ticker", tickers).execute()
        print(f"✅ Deleted price data for {len(tickers)} tickers")
        return True
    except Exception as e:
        print(f"Error deleting prices: {e}")
        return False


def get_available_tickers() -> List[str]:
    """
    Returns list of tickers that have price data in database.
    Handles pagination to fetch all tickers if there are many rows.
    
    Returns:
        List of ticker symbols
    """
    try:
        all_tickers = set()
        page_size = 1000
        offset = 0
        
        while True:
            response = supabase.table(STOCK_PRICES_TABLE)\
                .select("ticker")\
                .range(offset, offset + page_size - 1)\
                .execute()
            
            if not response.data:
                break
            
            for row in response.data:
                all_tickers.add(row['ticker'])
            
            if len(response.data) < page_size:
                break
                
            offset += page_size
            
        return sorted(list(all_tickers))
        
    except Exception as e:
        print(f"Error getting available tickers: {e}")
        return []


def get_date_range(ticker: str) -> Optional[Dict[str, str]]:
    """
    Returns the date range of available data for a ticker.
    
    Args:
        ticker: Ticker symbol
        
    Returns:
        Dict with 'start_date' and 'end_date', or None if no data
    """
    try:
        response = supabase.table(STOCK_PRICES_TABLE)\
            .select("date")\
            .eq("ticker", ticker)\
            .order("date")\
            .execute()
        
        if not response.data:
            return None
        
        dates = [row['date'] for row in response.data]
        return {
            'start_date': min(dates),
            'end_date': max(dates)
        }
        
    except Exception as e:
        print(f"Error getting date range for {ticker}: {e}")
        return None
