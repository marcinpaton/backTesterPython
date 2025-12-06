import requests
import json

url = "http://127.0.0.1:8000/api/backtest"
payload = {
    "n_tickers": 5,
    "rebalance_period": 1,
    "rebalance_period_unit": "months",
    "initial_capital": 10000,
    "start_date": "2020-01-01",
    "end_date": "2020-06-01",
    "strategy": "random"
}

try:
    response = requests.post(url, json=payload)
    if response.status_code == 200:
        data = response.json()
        if "rebalance_history" in data and len(data["rebalance_history"]) > 0:
            first_event = data["rebalance_history"][0]
            print("First rebalance event keys:", first_event.keys())
            if "cash" in first_event:
                print(f"Cash found: {first_event['cash']}")
            else:
                print("Cash NOT found in rebalance event!")
        else:
            print("No rebalance history returned.")
    else:
        print(f"Error: {response.status_code} - {response.text}")
except Exception as e:
    print(f"Exception: {e}")
