"""
Supabase client configuration and database utilities.
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Validate configuration
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError(
        "Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_KEY in .env file"
    )

# Create Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_supabase_client() -> Client:
    """
    Returns the configured Supabase client.
    
    Returns:
        Client: Supabase client instance
    """
    return supabase


# Table names
TRANSACTIONS_TABLE = "transactions"
TICKERS_TABLE = "tickers"
TICKER_GROUPS_TABLE = "ticker_groups"
TICKER_GROUP_MEMBERS_TABLE = "ticker_group_members"
