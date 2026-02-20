"""
Database operations for tickers table.
"""
from typing import List, Optional, Dict, Any
from app.supabase_client import supabase, TICKERS_TABLE, TICKER_GROUPS_TABLE, TICKER_GROUP_MEMBERS_TABLE


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


def get_all_ticker_groups() -> List[Dict[str, Any]]:
    """
    Retrieves all ticker groups with their members.
    """
    try:
        # Get groups with members. Supabase join default limit is 1000.
        # Since we have > 2000 total members, a single group might eventually exceed this,
        # or the total rows in the joined view might be truncated.
        response = supabase.table(TICKER_GROUPS_TABLE)\
            .select(f"*, {TICKER_GROUP_MEMBERS_TABLE}(ticker)")\
            .order("valid_from", desc=True)\
            .limit(1000)\
            .execute()
        
        groups = response.data if response.data else []
        
        # Flatten the members list
        for group in groups:
            # members are in a list under the table name key
            members = group.get(TICKER_GROUP_MEMBERS_TABLE, [])
            group['tickers'] = [m['ticker'] for m in members] if members else []
            # Remove the raw members list to keep results clean
            if TICKER_GROUP_MEMBERS_TABLE in group:
                del group[TICKER_GROUP_MEMBERS_TABLE]
            
        return groups
    except Exception as e:
        print(f"Error fetching ticker groups: {e}")
        import traceback
        traceback.print_exc()
        return []


def save_ticker_group(name: str, valid_from: str, tickers: List[str], group_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Saves a ticker group and its members.
    """
    try:
        group_data = {
            "name": name,
            "valid_from": valid_from
        }
        
        if group_id:
            # Update existing group
            response = supabase.table(TICKER_GROUPS_TABLE)\
                .update(group_data)\
                .eq("id", group_id)\
                .execute()
            
            # Delete old members
            supabase.table(TICKER_GROUP_MEMBERS_TABLE)\
                .delete()\
                .eq("group_id", group_id)\
                .execute()
        else:
            # Create new group
            response = supabase.table(TICKER_GROUPS_TABLE)\
                .insert(group_data)\
                .execute()
            
            if not response.data:
                return None
            group_id = response.data[0]['id']
            
        # Add new members
        if tickers:
            member_dicts = [{"group_id": group_id, "ticker": t.strip().upper()} for t in tickers if t.strip()]
            supabase.table(TICKER_GROUP_MEMBERS_TABLE).insert(member_dicts).execute()
            
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error saving ticker group: {e}")
        return None


def delete_ticker_group(group_id: str) -> bool:
    """
    Deletes a ticker group. Members are deleted via ON DELETE CASCADE.
    """
    try:
        supabase.table(TICKER_GROUPS_TABLE)\
            .delete()\
            .eq("id", group_id)\
            .execute()
        return True
    except Exception as e:
        print(f"Error deleting ticker group {group_id}: {e}")
        return False


def get_ticker_group_by_date(valid_from: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves a ticker group by its valid_from date.
    """
    try:
        response = supabase.table(TICKER_GROUPS_TABLE)\
            .select("*")\
            .eq("valid_from", valid_from)\
            .execute()
        
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error fetching ticker group for date {valid_from}: {e}")
        return None


def get_unique_tickers_from_groups() -> List[str]:
    """
    Retrieves all unique tickers from all ticker groups.
    Handles Supabase 1000-row limit by using pagination.
    """
    try:
        all_tickers = set()
        page_size = 1000
        offset = 0
        
        while True:
            response = supabase.table(TICKER_GROUP_MEMBERS_TABLE)\
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
        print(f"Error fetching unique tickers from groups: {e}")
        return []


def get_active_ticker_group_for_date(target_date: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves the ticker group that is active for a given date.
    Active group is the one with the latest valid_from <= target_date.
    """
    try:
        # Get all groups
        groups = get_all_ticker_groups()
        if not groups:
            return None
            
        # Filter for groups that started before or on target_date
        # groups are already sorted by valid_from DESC in get_all_ticker_groups
        for group in groups:
            if group['valid_from'] <= target_date:
                return group
                
        return None
    except Exception as e:
        print(f"Error fetching active ticker group for date {target_date}: {e}")
        return None
