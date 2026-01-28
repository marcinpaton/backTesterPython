"""
Database operations for transactions table.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.supabase_client import supabase, TRANSACTIONS_TABLE


def get_all_transactions() -> List[Dict[str, Any]]:
    """
    Retrieves all transactions from Supabase.
    
    Returns:
        List of transaction dictionaries
    """
    try:
        response = supabase.table(TRANSACTIONS_TABLE)\
            .select("*")\
            .order("date", desc=True)\
            .execute()
        
        return response.data if response.data else []
    except Exception as e:
        print(f"Error fetching transactions: {e}")
        return []


def get_transaction_by_id(transaction_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves a single transaction by ID.
    
    Args:
        transaction_id: UUID of the transaction
        
    Returns:
        Transaction dictionary or None if not found
    """
    try:
        response = supabase.table(TRANSACTIONS_TABLE)\
            .select("*")\
            .eq("id", transaction_id)\
            .execute()
        
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error fetching transaction {transaction_id}: {e}")
        return None


def create_transaction(transaction: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Creates a new transaction in Supabase.
    
    Args:
        transaction: Transaction data dictionary
        
    Returns:
        Created transaction or None if failed
    """
    try:
        response = supabase.table(TRANSACTIONS_TABLE)\
            .insert(transaction)\
            .execute()
        
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error creating transaction: {e}")
        return None


def update_transaction(transaction_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Updates an existing transaction.
    
    Args:
        transaction_id: UUID of the transaction
        updates: Dictionary of fields to update
        
    Returns:
        Updated transaction or None if failed
    """
    try:
        response = supabase.table(TRANSACTIONS_TABLE)\
            .update(updates)\
            .eq("id", transaction_id)\
            .execute()
        
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error updating transaction {transaction_id}: {e}")
        return None


def delete_transaction(transaction_id: str) -> bool:
    """
    Deletes a transaction from Supabase.
    
    Args:
        transaction_id: UUID of the transaction
        
    Returns:
        True if successful, False otherwise
    """
    try:
        supabase.table(TRANSACTIONS_TABLE)\
            .delete()\
            .eq("id", transaction_id)\
            .execute()
        
        return True
    except Exception as e:
        print(f"Error deleting transaction {transaction_id}: {e}")
        return False


def save_all_transactions(transactions: List[Dict[str, Any]]) -> bool:
    """
    Saves multiple transactions to Supabase.
    This will DELETE all existing transactions and insert the new list.
    This ensures that deletions are properly handled.
    
    Args:
        transactions: List of transaction dictionaries
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Step 1: Delete all existing transactions
        # Using a condition that's always true to delete all records
        supabase.table(TRANSACTIONS_TABLE).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        
        # Step 2: Insert new transactions if any
        if transactions:
            # Insert transactions in batches of 100
            batch_size = 100
            for i in range(0, len(transactions), batch_size):
                batch = transactions[i:i + batch_size]
                supabase.table(TRANSACTIONS_TABLE).insert(batch).execute()
        
        return True
    except Exception as e:
        print(f"Error saving transactions: {e}")
        import traceback
        traceback.print_exc()
        return False


def get_transactions_by_ticker(ticker: str) -> List[Dict[str, Any]]:
    """
    Retrieves all transactions for a specific ticker.
    
    Args:
        ticker: Ticker symbol
        
    Returns:
        List of transaction dictionaries
    """
    try:
        response = supabase.table(TRANSACTIONS_TABLE)\
            .select("*")\
            .eq("ticker", ticker)\
            .order("date", desc=True)\
            .execute()
        
        return response.data if response.data else []
    except Exception as e:
        print(f"Error fetching transactions for ticker {ticker}: {e}")
        return []


def get_transactions_by_type(transaction_type: str) -> List[Dict[str, Any]]:
    """
    Retrieves all transactions of a specific type (BUY, SELL, DEPOSIT, etc.).
    
    Args:
        transaction_type: Type of transaction
        
    Returns:
        List of transaction dictionaries
    """
    try:
        response = supabase.table(TRANSACTIONS_TABLE)\
            .select("*")\
            .eq("type", transaction_type)\
            .order("date", desc=True)\
            .execute()
        
        return response.data if response.data else []
    except Exception as e:
        print(f"Error fetching transactions of type {transaction_type}: {e}")
        return []


def get_transactions_by_date_range(start_date: str, end_date: str) -> List[Dict[str, Any]]:
    """
    Retrieves transactions within a date range.
    
    Args:
        start_date: Start date (ISO format)
        end_date: End date (ISO format)
        
    Returns:
        List of transaction dictionaries
    """
    try:
        response = supabase.table(TRANSACTIONS_TABLE)\
            .select("*")\
            .gte("date", start_date)\
            .lte("date", end_date)\
            .order("date", desc=True)\
            .execute()
        
        return response.data if response.data else []
    except Exception as e:
        print(f"Error fetching transactions in date range: {e}")
        return []
