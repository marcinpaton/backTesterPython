
import pandas as pd
from app.backtester import run_backtest
from app.strategies import ScoringStrategy

def test_sell_on_profit():
    print("Testing Sell on Profit logic...")
    
    # 1. Create Mock Data
    # 3 tickers: A (Constant), B (Goes up 10% daily), C (Goes down)
    dates = pd.date_range(start='2024-01-01', periods=10)
    
    # B starts at 100
    # Day 0: 100
    # Day 1: 110 (10% return)
    # Day 2: 121 (10% return)
    
    data_dict = {
        ('A', 'Close'): [100]*10,
        ('B', 'Close'): [100 * (1.1**i) for i in range(10)],
        ('C', 'Close'): [100 * (0.9**i) for i in range(10)]
    }
    
    df = pd.DataFrame(data_dict)
    df.index = dates
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    
    # 2. Setup Strategy
    # Select all tickers
    strategy = ScoringStrategy(n_tickers=3, rebalance_period=1, rebalance_period_unit='months', data=df)
    
    # 3. Run Backtest with Sell on Profit = 9%
    # B should trigger it every day (since it grows 10%)
    # Start Date: 2024-01-01. Buy happens on Day 0.
    # Day 1: Prev Close (Day 0) = 100. Entry = 100. Close = 110.
    # Check logic: (Prev - Entry) / Entry? NO. 
    # The logic is: Check trigger (Prev Close) vs Entry.
    # Wait, the logic I implemented:
    # if (prev_prices[ticker] - entry_price) / entry_price >= threshold
    
    # Let's trace:
    # Day 0 (Jan 1): Buy B at 100. Entry = 100.
    # Day 1 (Jan 2): Prev Price = 100 (Jan 1). Current (Jan 2) = 110.
    #   Trigger condition: (100 - 100) / 100 = 0%. No sell.
    
    # Day 2 (Jan 3): Prev Price = 110 (Jan 2). Current = 121.
    #   Trigger condition: (110 - 100) / 100 = 10%.
    #   10% >= 9% -> SELL!
    #   Sell at Current Price (121).
    
    # So B should be sold on Day 2.
    
    portfolio = run_backtest(
        strategy, 
        df, 
        initial_capital=10000, 
        start_date='2024-01-01', 
        end_date='2024-01-10',
        sell_on_profit_enabled=True,
        sell_on_profit_threshold_pct=0.09 # 9%
    )
    
    # 4. Verify
    print("\nRebalance History:")
    found_sale = False
    for event in portfolio.rebalance_history:
        print(f"Date: {event['date']}, Type: {event['type']}")
        if event['type'] == 'sell_on_profit':
            if 'B' in event['sold']:
                print(f"  SUCCESS: Sold B at {event['sold']['B']['revenue']/event['sold']['B'].get('quantity',1):.2f}")
                found_sale = True
    
    if found_sale:
        print("\nTEST PASSED: Sell on Profit triggered correctly.")
    else:
        print("\nTEST FAILED: No Sell on Profit event found for B.")

if __name__ == "__main__":
    test_sell_on_profit()
