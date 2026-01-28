"""
Database operations for currency prices table.
Handles conversion between pandas DataFrame (wide format) and database (long format).
"""
from typing import List, Optional, Dict, Any
import pandas as pd
from datetime import datetime
from app.supabase_client import supabase

CURRENCY_PRICES_TABLE = "currency_prices"


def save_currency_rates(df: pd.DataFrame) -> bool:
    """
    Saves currency exchange rates to Supabase.
    
    Converts from pandas DataFrame (wide format with pairs as columns)
    to database format (long format - one row per pair per date).
    
    Args:
        df: pandas DataFrame with currency pairs as columns
            Index: dates
            Values: Close prices
            
    Returns:
        True if successful, False otherwise
    """
    try:
        if df is None or df.empty:
            print("No currency data to save")
            return True
        
        # Convert DataFrame to long format
        records = []
        
        for date_idx in df.index:
            # Convert date to string format
            if isinstance(date_idx, pd.Timestamp):
                date_str = date_idx.strftime('%Y-%m-%d')
            else:
                date_str = str(date_idx)
            
            for pair in df.columns:
                try:
                    close_val = df.loc[date_idx, pair]
                    
                    # Skip if close price is missing or NaN
                    if pd.isna(close_val):
                        continue
                    
                    record = {
                        'pair': pair,
                        'date': date_str,
                        'close': float(close_val)
                    }
                    records.append(record)
                    
                except Exception as e:
                    print(f"Error processing {pair} on {date_str}: {e}")
                    continue
        
        if not records:
            print("No valid currency records to save")
            return True
        
        # Save to database in batches
        batch_size = 1000
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            try:
                # Upsert (insert or update on conflict)
                supabase.table(CURRENCY_PRICES_TABLE).upsert(batch).execute()
            except Exception as e:
                print(f"Error saving batch {i//batch_size + 1}: {e}")
                return False
        
        print(f"✅ Saved {len(records)} currency records for {len(df.columns)} pairs")
        return True
        
    except Exception as e:
        print(f"Error saving currency rates: {e}")
        import traceback
        traceback.print_exc()
        return False


def get_currency_rates(pairs: List[str], start_date: Optional[str] = None, end_date: Optional[str] = None) -> Optional[pd.DataFrame]:
    """
    Retrieves currency exchange rates from Supabase and converts to pandas DataFrame.
    
    Args:
        pairs: List of currency pairs (e.g. ['USDPLN=X', 'EURPLN=X'])
        start_date: Optional start date (YYYY-MM-DD)
        end_date: Optional end date (YYYY-MM-DD)
        
    Returns:
        pandas DataFrame with currency pairs as columns
        Index: dates
        Returns None if no data found
    """
    try:
        if not pairs:
            return None
        
        # Build query with pagination to fetch all rows
        all_data = []
        page_size = 1000
        offset = 0
        
        while True:
            query = supabase.table(CURRENCY_PRICES_TABLE).select("*").in_("pair", pairs)
            
            if start_date:
                query = query.gte("date", start_date)
            if end_date:
                query = query.lte("date", end_date)
            
            # Add deterministic ordering and range for pagination
            response = query.order("pair").order("date").range(offset, offset + page_size - 1).execute()
            
            if not response.data:
                break
                
            all_data.extend(response.data)
            
            if len(response.data) < page_size:
                break
                
            offset += page_size
        
        if not all_data:
            print(f"No currency data found for pairs: {pairs}")
            return None
        
        # Convert to DataFrame
        df_long = pd.DataFrame(all_data)
        
        # Convert date to datetime and normalize
        df_long['date'] = pd.to_datetime(df_long['date']).dt.normalize()
        
        # Drop duplicates just in case
        df_long = df_long.drop_duplicates(subset=['pair', 'date'], keep='first')
        
        # Pivot to wide format: rows=date, columns=pair, values=close
        df_wide = df_long.pivot(index='date', columns='pair', values='close')
        
        # Convert index to datetime
        df_wide.index = pd.to_datetime(df_wide.index)
        
        # Sort index (dates)
        df_wide = df_wide.sort_index()
        
        return df_wide
        
    except Exception as e:
        print(f"Error loading currency rates: {e}")
        import traceback
        traceback.print_exc()
        return None
