import pandas as pd
import numpy as np
from datetime import datetime
from app.strategies import MomentumStrategy
from app.backtester import run_backtest

def test_smart_tp():
    # Create dummy data with 40 days
    dates = pd.date_range(start='2024-01-01', periods=40, freq='D')
    
    # Ticker A: Steady 1% growth
    # Ticker B: Fast 10% growth for 15 days, then flat
    # Ticker C: Flat for 15 days, then explosive 20% growth
    
    prices_a = [100 * (1.01**i) for i in range(40)]
    
    prices_b = []
    curr_b = 100
    for i in range(40):
        if i < 15:
            curr_b *= 1.10
        prices_b.append(curr_b)
        
    prices_c = []
    curr_c = 100
    for i in range(40):
        if i >= 15:
            curr_c *= 1.20 # Explosive
        prices_c.append(curr_c)

    data = {
        ('A', 'Close'): prices_a,
        ('B', 'Close'): prices_b,
        ('C', 'Close'): prices_c,
    }
    df = pd.DataFrame(data, index=dates)
    df.columns = pd.MultiIndex.from_tuples(df.columns)

    # Strategy: Select top 1 ticker, 3 day lookback
    # Rebalance every 30 days to ensure it doesn't rebalance during the TP window
    strategy = MomentumStrategy(n_tickers=1, rebalance_period=30, rebalance_period_unit='days', data=df, lookback_days=3)

    print("\nRunning backtest with Momentum + Smart TP (50%)...")
    # Start on day 5. 
    # Day 5: B is top pick (10% growth vs 1% vs 0%). Bought B.
    # Day 15: B has grown significantly (>50% return).
    # Day 16: C starts explosive growth. 
    # Day 17-18: C momentum (last 3 days) will eventually beat B's momentum (which is now flat).
    # Since B has > 50% return AND is no longer top pick -> Smart TP should trigger.
    
    p2 = run_backtest(strategy, df, 10000, '2024-01-05', '2024-02-05', 
                      smart_sell_on_profit_enabled=True, 
                      smart_sell_on_profit_threshold_pct=0.50)
    
    print(f"Final Value P2: {p2.get_total_value(df.iloc[-1].to_dict())}")
    
    tp_events = [h for h in p2.rebalance_history if h.get('type') == 'smart_sell_on_profit']
    print(f"Smart TP events: {len(tp_events)}")
    for e in tp_events:
        print(f"  Date: {e['date']}, Sold: {list(e['sold'].keys())}, Bought: {[b['ticker'] for b in e['bought']]}")

if __name__ == "__main__":
    test_smart_tp()
