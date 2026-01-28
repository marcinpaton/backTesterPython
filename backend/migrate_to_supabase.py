"""
Migration script to transfer data from CSV files to Supabase.

This script:
1. Creates necessary tables in Supabase
2. Migrates transactions from transactions.csv
3. Migrates tickers from tickers.csv
"""
import os
import sys
import csv
from datetime import datetime

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.supabase_client import supabase, TRANSACTIONS_TABLE, TICKERS_TABLE

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
TRANSACTIONS_CSV = os.path.join(DATA_DIR, "transactions.csv")
TICKERS_CSV = os.path.join(DATA_DIR, "tickers.csv")


def create_tables():
    """
    Creates tables in Supabase using SQL.
    Note: You should run this SQL in Supabase SQL Editor first:
    
    -- Transactions table
    CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY,
        date TIMESTAMP NOT NULL,
        type VARCHAR(20) NOT NULL,
        amount_pln DECIMAL(15, 2),
        currency VARCHAR(10) DEFAULT 'PLN',
        ticker VARCHAR(20),
        quantity DECIMAL(15, 6),
        price DECIMAL(15, 6),
        fee_pln DECIMAL(15, 2) DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT NOW()
    );
    
    -- Tickers table
    CREATE TABLE IF NOT EXISTS tickers (
        id SERIAL PRIMARY KEY,
        ticker VARCHAR(20) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    );
    
    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_ticker ON transactions(ticker);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    """
    print("\n" + "="*60)
    print("IMPORTANT: Please run the following SQL in Supabase SQL Editor:")
    print("="*60)
    print(create_tables.__doc__)
    print("="*60)
    
    response = input("\nHave you created the tables in Supabase? (yes/no): ")
    if response.lower() != 'yes':
        print("Please create the tables first, then run this script again.")
        sys.exit(0)


def migrate_transactions():
    """
    Migrates transactions from CSV to Supabase.
    """
    print(f"\n📊 Migrating transactions from {TRANSACTIONS_CSV}...")
    
    if not os.path.exists(TRANSACTIONS_CSV):
        print(f"❌ File not found: {TRANSACTIONS_CSV}")
        return
    
    transactions = []
    
    with open(TRANSACTIONS_CSV, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Skip empty rows
            if not row.get('id'):
                continue
            
            # Prepare transaction data
            transaction = {
                'id': row['id'],
                'date': row['date'],
                'type': row['type'],
                'amount_pln': float(row['amount_pln']) if row['amount_pln'] else None,
                'currency': row['currency'] or 'PLN',
                'ticker': row['ticker'] if row['ticker'] else None,
                'quantity': float(row['quantity']) if row['quantity'] else None,
                'price': float(row['price']) if row['price'] else None,
                'fee_pln': float(row['fee_pln']) if row['fee_pln'] else 0.0
            }
            transactions.append(transaction)
    
    if not transactions:
        print("⚠️  No transactions to migrate")
        return
    
    print(f"Found {len(transactions)} transactions to migrate")
    
    # Insert transactions in batches
    batch_size = 100
    for i in range(0, len(transactions), batch_size):
        batch = transactions[i:i + batch_size]
        try:
            result = supabase.table(TRANSACTIONS_TABLE).upsert(batch).execute()
            print(f"✅ Migrated batch {i//batch_size + 1} ({len(batch)} transactions)")
        except Exception as e:
            print(f"❌ Error migrating batch {i//batch_size + 1}: {e}")
            print(f"   First transaction in batch: {batch[0]}")
    
    print(f"✅ Successfully migrated {len(transactions)} transactions!")


def migrate_tickers():
    """
    Migrates tickers from CSV to Supabase.
    """
    print(f"\n📈 Migrating tickers from {TICKERS_CSV}...")
    
    if not os.path.exists(TICKERS_CSV):
        print(f"❌ File not found: {TICKERS_CSV}")
        return
    
    tickers = []
    
    with open(TICKERS_CSV, 'r', encoding='utf-8') as f:
        for line in f:
            ticker = line.strip()
            if ticker:  # Skip empty lines
                tickers.append({'ticker': ticker})
    
    if not tickers:
        print("⚠️  No tickers to migrate")
        return
    
    print(f"Found {len(tickers)} tickers to migrate")
    
    # Insert tickers
    try:
        result = supabase.table(TICKERS_TABLE).upsert(tickers).execute()
        print(f"✅ Successfully migrated {len(tickers)} tickers!")
    except Exception as e:
        print(f"❌ Error migrating tickers: {e}")


def verify_migration():
    """
    Verifies the migration by counting records in Supabase.
    """
    print("\n🔍 Verifying migration...")
    
    try:
        # Count transactions
        transactions_result = supabase.table(TRANSACTIONS_TABLE).select("id", count="exact").execute()
        transactions_count = transactions_result.count
        print(f"✅ Transactions in Supabase: {transactions_count}")
        
        # Count tickers
        tickers_result = supabase.table(TICKERS_TABLE).select("id", count="exact").execute()
        tickers_count = tickers_result.count
        print(f"✅ Tickers in Supabase: {tickers_count}")
        
    except Exception as e:
        print(f"❌ Error verifying migration: {e}")


def main():
    """
    Main migration function.
    """
    print("\n" + "="*60)
    print("🚀 CSV to Supabase Migration Script")
    print("="*60)
    
    # Step 1: Ensure tables are created
    create_tables()
    
    # Step 2: Migrate transactions
    migrate_transactions()
    
    # Step 3: Migrate tickers
    migrate_tickers()
    
    # Step 4: Verify migration
    verify_migration()
    
    print("\n" + "="*60)
    print("✅ Migration completed!")
    print("="*60)


if __name__ == "__main__":
    main()
