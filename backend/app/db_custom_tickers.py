"""
Database operations for custom_tickers table.
"""
from typing import List, Optional, Dict, Any
from app.supabase_client import supabase, CUSTOM_TICKERS_TABLE

def get_custom_tickers() -> List[str]:
    """
    Retrieves all custom tickers from Supabase.
    """
    try:
        response = supabase.table(CUSTOM_TICKERS_TABLE)\
            .select("ticker")\
            .order("ticker")\
            .execute()
        
        return [row['ticker'] for row in response.data] if response.data else []
    except Exception as e:
        print(f"Error fetching custom tickers: {e}")
        return []

def save_custom_tickers(tickers: List[str]) -> bool:
    """
    Saves a list of custom tickers, replacing existing ones.
    """
    try:
        # 1. Get current tickers to avoid unnecessary deletes if possible, 
        # but simple delete + insert is more robust for a small list.
        
        # Delete all existing record
        supabase.table(CUSTOM_TICKERS_TABLE).delete().neq("ticker", "___NONE___").execute()
        
        if not tickers:
            return True
        
        # Prepare data
        data = [{"ticker": t.strip().upper()} for t in tickers if t.strip()]
        
        if data:
            supabase.table(CUSTOM_TICKERS_TABLE).insert(data).execute()
            
        return True
    except Exception as e:
        print(f"Error saving custom tickers: {e}")
        return False

def add_custom_ticker(ticker: str) -> bool:
    """
    Adds a single custom ticker.
    """
    try:
        ticker = ticker.strip().upper()
        if not ticker:
            return False
            
        supabase.table(CUSTOM_TICKERS_TABLE).upsert({"ticker": ticker}).execute()
        return True
    except Exception as e:
        print(f"Error adding custom ticker {ticker}: {e}")
        return False

def delete_custom_ticker(ticker: str) -> bool:
    """
    Deletes a single custom ticker.
    """
    try:
        supabase.table(CUSTOM_TICKERS_TABLE).delete().eq("ticker", ticker.strip().upper()).execute()
        return True
    except Exception as e:
        print(f"Error deleting custom ticker {ticker}: {e}")
        return False
