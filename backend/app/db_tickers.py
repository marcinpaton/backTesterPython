"""
Database operations for tickers table.
"""
from typing import List, Optional, Dict, Any
from app.supabase_client import supabase, TICKERS_TABLE


def get_all_tickers() -> List[str]:
    """
    Retrieves all tickers from Supabase.
    
    Returns:
        List of ticker symbols
    """
    try:
        response = supabase.table(TICKERS_TABLE)\
            .select("ticker")\
            .order("ticker")\
            .execute()
        
        return [row['ticker'] for row in response.data] if response.data else []
    except Exception as e:
        print(f"Error fetching tickers: {e}")
        return []


def get_ticker_by_symbol(ticker: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves a ticker by its symbol.
    
    Args:
        ticker: Ticker symbol
        
    Returns:
        Ticker dictionary or None if not found
    """
    try:
        response = supabase.table(TICKERS_TABLE)\
            .select("*")\
            .eq("ticker", ticker)\
            .execute()
        
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error fetching ticker {ticker}: {e}")
        return None


def add_ticker(ticker: str) -> Optional[Dict[str, Any]]:
    """
    Adds a new ticker to Supabase.
    
    Args:
        ticker: Ticker symbol
        
    Returns:
        Created ticker or None if failed
    """
    try:
        response = supabase.table(TICKERS_TABLE)\
            .insert({"ticker": ticker})\
            .execute()
        
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error adding ticker {ticker}: {e}")
        return None


def add_tickers_bulk(tickers: List[str]) -> bool:
    """
    Adds multiple tickers to Supabase (upsert operation).
    
    Args:
        tickers: List of ticker symbols
        
    Returns:
        True if successful, False otherwise
    """
    try:
        if not tickers:
            return True
        
        # Convert to list of dictionaries
        ticker_dicts = [{"ticker": ticker} for ticker in tickers]
        
        # Upsert tickers
        supabase.table(TICKERS_TABLE).upsert(ticker_dicts).execute()
        
        return True
    except Exception as e:
        print(f"Error adding tickers in bulk: {e}")
        return False


def delete_ticker(ticker: str) -> bool:
    """
    Deletes a ticker from Supabase.
    
    Args:
        ticker: Ticker symbol
        
    Returns:
        True if successful, False otherwise
    """
    try:
        supabase.table(TICKERS_TABLE)\
            .delete()\
            .eq("ticker", ticker)\
            .execute()
        
        return True
    except Exception as e:
        print(f"Error deleting ticker {ticker}: {e}")
        return False


def ticker_exists(ticker: str) -> bool:
    """
    Checks if a ticker exists in the database.
    
    Args:
        ticker: Ticker symbol
        
    Returns:
        True if exists, False otherwise
    """
    try:
        response = supabase.table(TICKERS_TABLE)\
            .select("ticker")\
            .eq("ticker", ticker)\
            .execute()
        
        return len(response.data) > 0 if response.data else False
    except Exception as e:
        print(f"Error checking ticker existence {ticker}: {e}")
        return False


def save_all_tickers(tickers: List[str]) -> bool:
    """
    Saves all tickers to Supabase, replacing existing data.
    
    Args:
        tickers: List of ticker symbols
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Delete all existing tickers
        supabase.table(TICKERS_TABLE).delete().neq("id", 0).execute()
        
        # Add new tickers
        return add_tickers_bulk(tickers)
    except Exception as e:
        print(f"Error saving all tickers: {e}")
        return False
