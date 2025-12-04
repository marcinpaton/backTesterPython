import requests
import sys

try:
    # Test Download
    response = requests.post(
        "http://127.0.0.1:8001/api/download",
        json={
            "tickers": ["AAPL", "MSFT", "GOOGL"],
            "start_date": "2023-01-01",
            "end_date": "2023-12-31"
        }
    )
    response.raise_for_status()
    print("Download:", response.json())

    # Test Backtest
    # response = requests.post(
    #     "http://127.0.0.1:8001/api/backtest",
    #     json={
    #         "n_tickers": 2,
    #         "rebalance_period_months": 1,
    #         "initial_capital": 10000,
    #         "start_date": "2023-01-01",
    #         "end_date": "2023-01-31"
    #     }
    # )
    # response.raise_for_status()
    # print("Backtest Metrics:", response.json().keys())
    # print("CAGR:", response.json().get('cagr'))
    # print("Total Return:", response.json().get('total_return'))
except Exception as e:
    print(f"Error: {e}")
    if hasattr(e, 'response') and e.response is not None:
        print(e.response.text)
    sys.exit(1)
