import pandas as pd
from datetime import datetime
from app.backtester import run_backtest
from app.strategies import ScoringStrategy

def verify_fix():
    print("Running verification script for ticker group transition...")
    
    # 1. Setup mock data: Constant price of 100 for all tickers
    dates = pd.date_range(start='2025-01-01', end='2026-01-01', freq='D')
    tickers = ['TICKER_A', 'TICKER_B']
    data = pd.DataFrame(100.0, index=dates, columns=tickers)
    
    # 2. Define groups
    # Group A valid from start, contains only TICKER_A
    # Group B switches on 2025-06-01, contains only TICKER_B
    ticker_groups = [
        {'valid_from': '2025-01-01', 'tickers': ['TICKER_A'], 'name': 'Group A'},
        {'valid_from': '2025-06-01', 'tickers': ['TICKER_B'], 'name': 'Group B'}
    ]
    
    # 3. Strategy: Buy 1 ticker based on score (random or simple)
    # We use ScoringStrategy but since price is constant, score doesn't matter much.
    # We just need it to buy available tickers.
    strategy = ScoringStrategy(n_tickers=1, rebalance_period=1, rebalance_period_unit='months', data=data)
    
    # 4. Run Backtest
    # Start before switch, end after switch.
    portfolio = run_backtest(
        strategy, 
        data, 
        initial_capital=10000, 
        start_date='2025-05-01', 
        end_date='2025-07-01',
        ticker_groups=ticker_groups,
        transaction_fee_enabled=False
    )
    
    # 5. Check Portfolio Value continuity
    history_df = pd.DataFrame(portfolio.history)
    history_df['date'] = pd.to_datetime(history_df['date'])
    history_df.set_index('date', inplace=True)
    
    # Check value on the day BEFORE switch (2025-05-31) and ON/AFTER switch (2025-06-01)
    date_before = pd.Timestamp('2025-05-31')
    date_after = pd.Timestamp('2025-06-01')
    
    try:
        val_before = history_df.loc[date_before, 'total_value']
        val_after = history_df.loc[date_after, 'total_value']
        
        print(f"Value before switch ({date_before.date()}): {val_before}")
        print(f"Value after switch ({date_after.date()}): {val_after}")
        
        # In current bug, val_after should be close to cash (if fully invested, close to 0 or remaining cash)
        # Expected correct behavior: val_after ~= val_before (since prices are constant 100)
        
        drop_pct = (val_before - val_after) / val_before
        print(f"Drop percentage: {drop_pct:.2%}")
        
        if drop_pct > 0.5:
             # This confirms the bug exists (or regression if checking after fix)
             print("FAILURE: Portfolio value dropped significantly!")
             # Return False to indicate failure/bug presence
             return False
        else:
             print("SUCCESS: Portfolio value remained stable.")
             return True

    except KeyError as e:
        print(f"Date not found in history: {e}")
        return False

if __name__ == "__main__":
    success = verify_fix()
    if not success:
        exit(1)
