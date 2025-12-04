from app.data_loader import download_data
import traceback

def debug_download():
    try:
        print("Attempting download...")
        # Use the same tickers as default in frontend
        tickers = ["AAPL", "MSFT", "GOOGL"]
        start_date = "2023-01-01"
        end_date = "2023-12-31"
        
        result = download_data(tickers, start_date, end_date)
        print("Download result:", result)
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    debug_download()
