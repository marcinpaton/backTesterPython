from app.backtester import run_backtest, calculate_metrics
from app.strategies import RandomSelectionStrategy
from app.data_loader import load_data
import pandas as pd
import traceback

def debug():
    print("Loading data...")
    df = load_data()
    if df is None:
        print("No data found.")
        return

    print("Data columns:", df.columns)
    print("Data head:", df.head())

    strategy = RandomSelectionStrategy(n_tickers=2, rebalance_period_months=1)
    
    try:
        print("Running backtest...")
        history_df = run_backtest(
            strategy, 
            df, 
            initial_capital=10000, 
            start_date="2023-01-01", 
            end_date="2023-01-31"
        )
        print("Backtest finished.")
        print(history_df.head())
        
        print("Calculating metrics...")
        metrics = calculate_metrics(history_df)
        print("Metrics:", metrics)
        
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    debug()
