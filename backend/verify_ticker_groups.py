import pandas as pd
from datetime import datetime
from app.backtester import run_backtest
from app.strategies import ScoringStrategy

def verify_ticker_groups():
    # Mock data
    dates = pd.date_range(start='2025-01-01', end='2026-12-31', freq='D')
    tickers = ['AAPL', 'MSFT', 'NVDA', 'AMD']
    data = pd.DataFrame(100, index=dates, columns=tickers)
    
    # Define groups
    ticker_groups = [
        {'valid_from': '2025-01-01', 'tickers': ['AAPL', 'MSFT'], 'name': 'Group A'},
        {'valid_from': '2026-01-01', 'tickers': ['NVDA', 'AMD'], 'name': 'Group B'}
    ]
    
    # Strategy
    strategy = ScoringStrategy(n_tickers=2, rebalance_period=1, rebalance_period_unit='months', data=data)
    
    # Run backtest
    print("Running verification backtest...")
    portfolio = run_backtest(
        strategy, 
        data, 
        initial_capital=10000, 
        start_date='2025-06-01', 
        end_date='2026-06-01',
        ticker_groups=ticker_groups
    )
    
    # Verify results
    # Check holdings in 2025
    rebalances_2025 = [r for r in portfolio.rebalance_history if r['date'].year == 2025]
    for r in rebalances_2025:
        for t in r['bought']:
            print(f"2025 rebalance on {r['date'].date()}: bought {t['ticker']}")
            assert t['ticker'] in ['AAPL', 'MSFT'], f"Unexpected ticker {t['ticker']} in 2025"
            
    # Check holdings in 2026
    rebalances_2026 = [r for r in portfolio.rebalance_history if r['date'].year == 2026]
    for r in rebalances_2026:
        for t in r['bought']:
            print(f"2026 rebalance on {r['date'].date()}: bought {t['ticker']}")
            assert t['ticker'] in ['NVDA', 'AMD'], f"Unexpected ticker {t['ticker']} in 2026"

    print("Verification successful!")

if __name__ == "__main__":
    verify_ticker_groups()
