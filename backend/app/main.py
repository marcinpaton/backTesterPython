from __future__ import annotations
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional, List, Any, Dict
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.data_loader import download_data, smart_download_data, load_data, DATA_DIR, download_currency_rates, DATA_FILE, PORTFOLIO_DATA_FILE, PORTFOLIO_CURRENCY_DATA_FILE, CURRENCY_DATA_FILE
from app.portfolio_replayer import PortfolioReplayer
import uvicorn
import os
import json
import asyncio
import uuid
import pandas as pd
from queue import Queue
from queue import Queue
from datetime import datetime
from app.currency_utils import infer_currency
from app.ticker_group_parser import parse_ticker_group_file

app = FastAPI()

TRANSACTIONS_FILE = os.path.join(DATA_DIR, "transactions.csv")

class Transaction(BaseModel):
    id: str
    date: str # ISO format YYYY-MM-DD HH:MM
    type: str # 'DEPOSIT', 'BUY', 'SELL'
    
    # Deposit specific
    amount_pln: Optional[float] = None
    currency: str = 'PLN' # 'USD', 'GBP', 'EUR', 'PLN'
    
    # Buy/Sell specific
    ticker: Optional[str] = None
    quantity: Optional[float] = None
    price: Optional[float] = None # Price in PLN
    fee_pln: Optional[float] = 0.0

class TransactionList(BaseModel):
    transactions: List[Transaction]



class TickerGroup(BaseModel):
    id: Optional[str] = None
    name: str
    valid_from: str
    tickers: List[str]

class ImportTickerGroupsRequest(BaseModel):
    files: List[Dict[str, str]] # List of {filename: str, content: str}

ImportTickerGroupsRequest.model_rebuild()

@app.get("/api/portfolio/performance")
def get_portfolio_performance():
    try:
        # Load transactions from Supabase
        from app.db_transactions import get_all_transactions
        transactions = get_all_transactions()
        print(f"Performance Debug: Loaded {len(transactions)} transactions from Supabase.")
        
        if not transactions:
            print("Performance Debug: No transactions.")
            return {}
            
        # Calculate oldest transaction date to optimize data loading
        oldest_tx_date = min([t['date'] for t in transactions if t.get('date')])
        if isinstance(oldest_tx_date, datetime):
            oldest_tx_date = oldest_tx_date.strftime('%Y-%m-%d')
        elif isinstance(oldest_tx_date, str):
            # Ensure it's just YYYY-MM-DD
            oldest_tx_date = oldest_tx_date.split('T')[0]
            
        print(f"Performance Debug: Oldest transaction date: {oldest_tx_date}")
        
        # Load Price Data - SPECIFICALLY FOR PORTFOLIO from CSV
        unique_tickers = list(set([t['ticker'] for t in transactions if t.get('ticker')]))
        price_df = load_data(filename=PORTFOLIO_DATA_FILE, tickers=unique_tickers, start_date=oldest_tx_date)
        
        if price_df is None or price_df.empty:
             print("Performance Debug: Portfolio price data is empty or None.")
             return {"error": "No portfolio price data available. Please 'Download Prices' in Transactions tab first."}
        
        # Load Currency Data from CSV - Only for currencies present in transactions
        from app.data_loader import load_currency_data
        unique_currencies = list(set([t.get('currency', 'PLN') for t in transactions]))
        currency_df = load_currency_data(start_date=oldest_tx_date, currencies=unique_currencies, filename=PORTFOLIO_CURRENCY_DATA_FILE)
        
        # If currency_df is None (e.g. only PLN), create an empty DF with correct index to avoid errors
        if currency_df is None or currency_df.empty:
             if any(curr != 'PLN' for curr in unique_currencies):
                 print("Performance Debug: Currency data is empty but foreign currencies exist.")
                 return {"error": "No currency data available. Please 'Download Prices' in Transactions tab first."}
             else:
                 # Only PLN, create empty DF with dates from price_df
                 currency_df = pd.DataFrame(index=price_df.index)
        
        print(f"Performance Debug: Price data shape: {price_df.shape}")
        
        # Calculate Logic using Replayer
        replayer = PortfolioReplayer(transactions, price_df, currency_df)
        results = replayer.calculate_history()
        
        if results is None:
            print("Performance Debug: Replayer returned None.")
            return {}

        # --- Intraday Update Logic ---
        try:
            from app.data_loader import get_intraday_prices
            
            history = results.get('history', [])
            if history:
                latest = history[-1]
                # Identify currently held tickers (shares > 0)
                current_holdings = [item for item in latest['details'] if item['shares'] > 0]
                current_tickers = [item['ticker'] for item in current_holdings]
                
                if current_tickers:
                    print(f"Performance Debug: Fetching intraday prices for {len(current_tickers)} tickers...")
                    intraday_data = get_intraday_prices(current_tickers)
                    
                    if intraday_data:
                        # Check if we should append a new record or update the existing one
                        first_ticker_data = list(intraday_data.values())[0]
                        intraday_ts = first_ticker_data['timestamp'] # String "YYYY-MM-DD HH:MM:SS"
                        intraday_date_str = intraday_ts.split(' ')[0]
                        
                        latest_date_str = latest['date'] # "YYYY-MM-DD"

                        record_to_update = latest
                        
                        if intraday_date_str > latest_date_str:
                             # Create a new record for "Today"
                             # Deep copy would be ideal but simple dict copy + details copy is enough
                             import copy
                             new_record = copy.deepcopy(latest)
                             new_record['date'] = intraday_date_str
                             history.append(new_record)
                             record_to_update = new_record
                             print(f"Performance Debug: Appended new history record for {intraday_date_str}")
                        
                        # Apply updates to the chosen record
                        new_total_value = record_to_update['cash']
                        new_holdings_value = 0.0
                        is_updated = False
                        
                        # Let's rebuild the rate map briefly if currency_df exists
                        rate_map_perf = {}
                        if currency_df is not None and not currency_df.empty:
                            last_rates = currency_df.iloc[-1]
                            
                            def get_rate(ticker_str):
                                if ticker_str in last_rates:
                                    val = last_rates[ticker_str]
                                    if isinstance(val, pd.Series):
                                        return float(val.iloc[0])
                                    return float(val)
                                return None

                            usd_rate = get_rate('USDPLN=X')
                            if usd_rate: rate_map_perf['USD'] = usd_rate
                            
                            eur_rate = get_rate('EURPLN=X')
                            if eur_rate: rate_map_perf['EUR'] = eur_rate
                            
                            gbp_rate = get_rate('GBPPLN=X')
                            if gbp_rate: rate_map_perf['GBP'] = gbp_rate
                        
                        for item in record_to_update['details']:
                            t = item['ticker']
                            if t in intraday_data and item['shares'] > 0:
                                curr = infer_currency(t)
                                live_price = intraday_data[t]['price']
                                
                                # Special handling for GBP (LSE stocks usually in pence)
                                if curr == 'GBP':
                                    live_price = live_price / 100.0
                                
                                # Update price
                                item['price_native'] = live_price 
                                
                                rate = 1.0
                                if curr != 'PLN':
                                    rate = rate_map_perf.get(curr, 1.0)
                                    # Previously divided rate by 100 here, but now we ajusted price directly above
                                
                                # Update PLN values
                                item['price_pln'] = live_price * rate
                                item['value_pln'] = item['shares'] * item['price_pln']
                                
                                # Recalculate return_pct using total_cost from details
                                total_cost = item.get('total_cost', 0.0)
                                if total_cost > 0:
                                    item['return_pct'] = (item['value_pln'] - total_cost) / total_cost
                                else:
                                    item['return_pct'] = 0.0
                                
                                is_updated = True
                                
                            new_holdings_value += item['value_pln']
                            
                        if is_updated:
                            new_total_value = record_to_update['cash'] + new_holdings_value
                            record_to_update['total_value'] = new_total_value
                            record_to_update['holdings_value'] = new_holdings_value
                            
                            # Recalculate MTD Return
                            # We need month_start_value. 
                            # If we appended a new record (today), check if month changed.
                            current_dt = datetime.strptime(record_to_update['date'], '%Y-%m-%d')
                            current_month = current_dt.month
                            
                            # Find previous record (before record_to_update)
                            prev_record = None
                            if len(history) > 1:
                                # If we appended, history[-1] is record_to_update, so prev is history[-2]
                                if history[-1] == record_to_update:
                                    prev_record = history[-2]
                                else:
                                    # If updated in place, prev is history[-2] if exists
                                    prev_record = history[-2]
                            
                            month_start_value = 0.0
                            
                            if prev_record:
                                prev_dt = datetime.strptime(prev_record['date'], '%Y-%m-%d')
                                if prev_dt.month != current_month:
                                    # New month started, base is previous record (end of last month)
                                    month_start_value = prev_record['total_value']
                                else:
                                    # Same month, so month_start_value is the same as for prev_record
                                    # We can deduce it from prev_record mtd: prev_mtd = (prev_val - start) / start
                                    # => start * (1 + prev_mtd) = prev_val => start = prev_val / (1 + prev_mtd)
                                    # Handle division by zero
                                    if 1 + prev_record.get('mtd_return', 0) != 0:
                                        month_start_value = prev_record['total_value'] / (1 + prev_record.get('mtd_return', 0))
                            else:
                                # First record ever?
                                month_start_value = new_total_value # MTD 0

                            if month_start_value > 0:
                                record_to_update['mtd_return'] = (new_total_value - month_start_value) / month_start_value
                            else:
                                record_to_update['mtd_return'] = 0.0
                            
                            results['is_intraday'] = True
                            results['price_timestamp'] = intraday_ts
                            
                            # Also update summary metrics (Final Value)
                            results['final_value'] = new_total_value
                            
                            # Recalculate global Return/CAGR based on new final value
                            # simplistic update
                            initial_val = 10000 # default fallback
                            if history:
                                initial_val = history[0]['total_value']
                            
                            if initial_val > 0:
                                results['total_return'] = (new_total_value - initial_val) / initial_val
                            
                            print(f"Performance Debug: Updated record {record_to_update['date']} with intraday data. New Total: {new_total_value}")
                            
        except Exception as e:
            print(f"Performance Debug: Error applying intraday prices: {e}")
            import traceback
            traceback.print_exc()

        print("Performance Debug: Success.")
        return results

    except Exception as e:
        print(f"Error calculating performance: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/portfolio/transactions")
def get_transactions():
    try:
        from app.db_transactions import get_all_transactions
        transactions = get_all_transactions()
        return transactions
    except Exception as e:
        print(f"Error reading transactions: {e}")
        import traceback
        traceback.print_exc()
        return []


@app.get("/api/ticker-groups")
def get_ticker_groups():
    try:
        from app.db_tickers import get_all_ticker_groups
        return get_all_ticker_groups()
    except Exception as e:
        print(f"Error fetching ticker groups: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ticker-groups")
def save_ticker_group_endpoint(group: TickerGroup):
    try:
        from app.db_tickers import save_ticker_group
        success = save_ticker_group(group.name, group.valid_from, group.tickers, group.id)
        if success:
            return success
        else:
            raise HTTPException(status_code=500, detail="Failed to save ticker group")
    except Exception as e:
        print(f"Error saving ticker group: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/ticker-groups/{group_id}")
def delete_ticker_group_endpoint(group_id: str):
    try:
        from app.db_tickers import delete_ticker_group
        success = delete_ticker_group(group_id)
        if success:
            return {"message": "Ticker group deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete ticker group")
    except Exception as e:
        print(f"Error deleting ticker group: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class BulkDeleteRequest(BaseModel):
    ids: List[str]

@app.post("/api/ticker-groups/bulk-delete")
def bulk_delete_ticker_groups_endpoint(request: BulkDeleteRequest):
    try:
        from app.db_tickers import delete_ticker_groups_bulk
        success = delete_ticker_groups_bulk(request.ids)
        if success:
            return {"message": f"Successfully deleted {len(request.ids)} ticker groups"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete ticker groups in bulk")
    except Exception as e:
        print(f"Error in bulk deletion: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ticker-groups/import")
def import_ticker_groups(request: ImportTickerGroupsRequest):
    try:
        from app.db_tickers import save_ticker_group, get_ticker_group_by_date
        
        results = []
        import_date = datetime.now().strftime("%Y-%m-%d %H:%M")
        
        for file_data in request.files:
            filename = file_data.get('filename', 'unknown')
            content = file_data.get('content', '')
            
            valid_from, tickers = parse_ticker_group_file(content)
            
            if not valid_from:
                results.append({"filename": filename, "status": "error", "message": "Could not parse date from file"})
                continue
                
            if not tickers:
                results.append({"filename": filename, "status": "error", "message": "No tickers found in file"})
                continue
                
            # Check if group already exists for this date
            existing = get_ticker_group_by_date(valid_from)
            if existing:
                results.append({
                    "filename": filename, 
                    "status": "skipped", 
                    "message": f"Group for {valid_from} already exists: {existing['name']}",
                    "date": valid_from
                })
                continue
                
            # Save new group
            group_name = f"imported {import_date}"
            success = save_ticker_group(group_name, valid_from, tickers)
            
            if success:
                results.append({
                    "filename": filename, 
                    "status": "success", 
                    "message": f"Imported {len(tickers)} tickers for {valid_from}",
                    "date": valid_from
                })
            else:
                results.append({"filename": filename, "status": "error", "message": "Database save failed"})
                
        return {"results": results}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/portfolio/transactions")
def save_transactions(request: TransactionList):
    try:
        from app.db_transactions import save_all_transactions
        
        data = [t.dict() for t in request.transactions]
        success = save_all_transactions(data)
        
        if success:
            return {"message": "Transactions saved successfully", "count": len(data)}
        else:
            raise HTTPException(status_code=500, detail="Failed to save transactions")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DownloadRequest(BaseModel):
    tickers: List[str]
    start_date: str
    end_date: str
    filename: Optional[str] = None
    currency_filename: Optional[str] = None
    use_transaction_file: bool = False

@app.get("/api/ticker-groups/active")
def get_active_ticker_group_endpoint(date: str):
    try:
        from app.db_tickers import get_active_ticker_group_for_date
        group = get_active_ticker_group_for_date(date)
        if not group:
            raise HTTPException(status_code=404, detail=f"No active ticker group found for date {date}")
        return group
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ticker-groups/unique-tickers")
def get_unique_tickers_endpoint():
    try:
        from app.db_tickers import get_unique_tickers_from_groups
        from app.db_custom_tickers import get_custom_tickers
        
        group_tickers = get_unique_tickers_from_groups()
        custom_tickers = get_custom_tickers()
        
        # Merge and remove duplicates
        all_tickers = list(set(group_tickers + custom_tickers))
        return sorted(all_tickers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/custom-tickers")
def get_custom_tickers_endpoint():
    try:
        from app.db_custom_tickers import get_custom_tickers
        return get_custom_tickers()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CustomTickersRequest(BaseModel):
    tickers: List[str]

@app.post("/api/custom-tickers")
def save_custom_tickers_endpoint(request: CustomTickersRequest):
    try:
        from app.db_custom_tickers import save_custom_tickers
        success = save_custom_tickers(request.tickers)
        if success:
            return {"message": "Custom tickers saved successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to save custom tickers")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/download")
def download_stock_data(request: DownloadRequest):
    try:
        # Determine target filename
        target_file = request.filename if request.filename else DATA_FILE
        # If it's a relative path name like "portfolio_stock_prices.csv", prepend DATA_DIR
        if target_file and not os.path.isabs(target_file):
            target_file = os.path.join(DATA_DIR, target_file)
            
        # Use smart incremental download – only fetches what is missing
        result = smart_download_data(request.tickers, request.start_date, request.end_date, filename=target_file)
        
        # Also download currency rates to CSV
        currency_target = request.currency_filename if request.currency_filename else CURRENCY_DATA_FILE
        # If relative, prepend DATA_DIR
        if currency_target and not os.path.isabs(currency_target):
            currency_target = os.path.join(DATA_DIR, currency_target)
            
        download_currency_rates(filename=currency_target, start_date=request.start_date)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class MomentumScanRequest(BaseModel):
    tickers: List[str]
    analysis_date: str
    momentum_lookback_days: int = 120
    n_best_tickers: int = 5
    filter_negative_momentum: bool = False
    sma_period: int = -1

@app.post("/api/momentum_scan")
def scan_momentum(request: MomentumScanRequest):
    from datetime import timedelta
    from dateutil.relativedelta import relativedelta
    
    # Calculate start_date for optimization
    # Formula: lookback_days / 22 + 2 months back
    analysis_dt = datetime.strptime(request.analysis_date, '%Y-%m-%d')
    months_back = int(request.momentum_lookback_days / 22) + 2
    start_date_dt = analysis_dt - relativedelta(months=months_back)
    start_date = start_date_dt.strftime('%Y-%m-%d')
    
    # Load ALL data from CSV
    df = load_data()
    if df is None:
        raise HTTPException(status_code=404, detail="No data found. Please download data first.")
    
    # Initialize Momentum Strategy
    # We only need it for selection, rebalance period doesn't matter here so passing dummy 1 month
    strategy = MomentumStrategy(
        n_tickers=request.n_best_tickers,
        rebalance_period=1, 
        rebalance_period_unit='months', 
        data=df, 
        lookback_days=request.momentum_lookback_days,
        filter_negative_momentum=request.filter_negative_momentum, # Return raw momentum even if negative, user can see valid vs bad
        sma_period=request.sma_period
    )
    
    try:
        analysis_dt = datetime.strptime(request.analysis_date, '%Y-%m-%d')
        print(f"--- Momentum Scan Started for Date: {request.analysis_date} ---")
        print(f"Scanning {len(request.tickers)} tickers...")
        
        # Use new detailed method - strategy handles loose date matching per ticker
        detailed_results = strategy.get_detailed_momentum(request.tickers, analysis_dt)
        
        # Take top N
        best_results = detailed_results[:request.n_best_tickers]
        
        return best_results
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/market_status")
def get_market_status(date: str):
    from datetime import datetime
    import pandas as pd
    from app.data_loader import load_data, smart_download_data
    
    try:
        # Load local data first
        df = load_data()
        
        # Check if ^GSPC is present and has enough data
        # We need at least 200 observation points before the date
        needs_download = False
        if df is None or '^GSPC' not in df.columns:
            needs_download = True
        else:
            # Check if we have enough history for SMA200
            target_dt = pd.to_datetime(date)
            available_history = df.index[df.index <= target_dt]
            if len(available_history) < 200:
                needs_download = True

        if needs_download:
            print(f"S&P 500 data missing or insufficient for {date}. Downloading...")
            target_dt = pd.to_datetime(date)
            # Fetch 1.5 years to be safe for 200 business days
            start_dt = target_dt - pd.Timedelta(days=550) 
            smart_download_data(['^GSPC'], start_dt.strftime('%Y-%m-%d'), date)
            df = load_data()

        if df is None or '^GSPC' not in df.columns:
            raise HTTPException(status_code=404, detail="^GSPC data still missing after download attempt")
            
        gspc = df['^GSPC']
        sma200 = gspc.rolling(window=200).mean()
        
        # Determine actual date (might be a weekend/holiday)
        # Use simple floor-matching
        target_dt = pd.to_datetime(date)
        valid_dates = gspc.index[gspc.index <= target_dt]
        if valid_dates.empty:
            raise HTTPException(status_code=404, detail=f"No data available for date {date}")
        
        actual_date = valid_dates[-1]
        current_price = float(gspc.loc[actual_date])
        current_sma = float(sma200.loc[actual_date])
        
        if pd.isna(current_sma):
            raise HTTPException(status_code=400, detail=f"Insufficient historical data to calculate SMA200 for {date}")
            
        diff_pct = ((current_price - current_sma) / current_sma) * 100
        
        # Recommendation logic
        status_type = "success"
        recommendation = "✅ Dobra koniunktura (nad SMA200). Warunki sprzyjające strategii momentum."
        
        if diff_pct < 0:
            status_type = "danger"
            recommendation = "🚫 Rynek pod SMA200. Wysokie ryzyko kontynuacji spadków. Filtr Market Regime sugeruje wstrzymanie się od zakupów."
        elif diff_pct > 8.5:
            status_type = "warning"
            recommendation = "⚠️ Rynek przegrzany (>8.5% nad SMA200). Zachowaj dużą ostrożność przy nowych wejściach."
            
        return {
            "price": current_price,
            "sma200": current_sma,
            "diff_pct": diff_pct,
            "status_type": status_type,
            "recommendation": recommendation,
            "date": actual_date.strftime('%Y-%m-%d')
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class ScannerAllocationRequest(BaseModel):
    tickers: List[str]

@app.post("/api/scanner/allocation_data")
def get_allocation_data(request: ScannerAllocationRequest):
    """
    Returns data needed for allocation calculation:
    1. Current Portfolio Value and Holdings (from transactions & portfolio prices)
    2. Latest prices for candidate tickers (from intraday Yahoo Finance data)
    """
    try:
        # 1. Get Portfolio State from Supabase
        from app.db_transactions import get_all_transactions
        transactions = get_all_transactions()
        
        if not transactions:
            return {"error": "No transactions found. Cannot calculate allocation."}
        
        # Load Portfolio Prices from Database
        from app.data_loader import load_currency_data, get_intraday_prices
        
        # Calculate oldest transaction date
        oldest_tx_date = min([t['date'] for t in transactions if t.get('date')])
        if isinstance(oldest_tx_date, datetime):
            oldest_tx_date = oldest_tx_date.strftime('%Y-%m-%d')
        elif isinstance(oldest_tx_date, str):
            oldest_tx_date = oldest_tx_date.split('T')[0]
            
        unique_tickers = list(set([t['ticker'] for t in transactions if t.get('ticker')]))
        portfolio_prices = load_data(filename=PORTFOLIO_DATA_FILE, tickers=unique_tickers, start_date=oldest_tx_date)
        
        # Load Currency Data from CSV - Only for currencies present in transactions
        unique_currencies = list(set([t.get('currency', 'PLN') for t in transactions]))
        currency_df = load_currency_data(start_date=oldest_tx_date, currencies=unique_currencies, filename=PORTFOLIO_CURRENCY_DATA_FILE)
        
        if currency_df is None or currency_df.empty:
             if any(curr != 'PLN' for curr in unique_currencies):
                 return {"error": "No currency data available. Please 'Download Prices' in Transactions tab first."}
             else:
                 # Only PLN, create empty DF with dates from portfolio_prices
                 currency_df = pd.DataFrame(index=portfolio_prices.index)

        # Calculate Portfolio History to get current state
        replayer = PortfolioReplayer(transactions, portfolio_prices, currency_df)
        history = replayer.calculate_history()
        
        if not history or not history.get('history'):
            return {"error": "Failed to calculate portfolio state. Ensure 'Download Prices' is run in Portfolio view."}

        latest_record = history['history'][-1]
        total_portfolio_value = latest_record['total_value']
        current_cash = latest_record['cash']
        
        current_holdings = {}
        for item in latest_record['details']:
            t = item['ticker']
            val = item['value_pln']
            price = item['price_pln']
            if price > 0:
                qty = val / price
                current_holdings[t] = qty
        
        # 2. Get Latest Prices for Candidates using INTRADAY data
        # Combine requested tickers with current holdings to ensure we have data for selling
        owned_tickers = list(current_holdings.keys())
        all_tickers = list(set(request.tickers + owned_tickers))
        
        # Fetch intraday prices from Yahoo Finance
        intraday_prices = get_intraday_prices(all_tickers)
        
        # Prepare Rate Map from Currency DF
        rate_map = {'PLN': 1.0}
        if currency_df is not None and not currency_df.empty:
            last_rates = currency_df.iloc[-1]
            # Map standard codes to Yahoo pairs
            # USD -> USDPLN=X
            if 'USDPLN=X' in last_rates: rate_map['USD'] = float(last_rates['USDPLN=X'])
            if 'EURPLN=X' in last_rates: rate_map['EUR'] = float(last_rates['EURPLN=X'])
            if 'GBPPLN=X' in last_rates: rate_map['GBP'] = float(last_rates['GBPPLN=X'])
            # Add others if available or needed (e.g. SEK, CAD usually not default in that file but logic is extensible)

        candidates_data = []
        price_timestamp = None  # Track timestamp of price data
        
        # If intraday fetch failed, fallback to daily prices
        if not intraday_prices:
            print("Warning: Intraday prices not available, falling back to daily prices")
            general_prices = load_data(DATA_FILE)
            
            if general_prices is not None and not general_prices.empty:
                last_prices = general_prices.iloc[-1]
                price_timestamp = general_prices.index[-1].strftime('%Y-%m-%d')
                is_multi = isinstance(general_prices.columns, pd.MultiIndex)
                
                for t in all_tickers:
                    price = 0.0
                    if is_multi:
                        if (t, 'Close') in last_prices.index:
                             price = float(last_prices[(t, 'Close')])
                        elif t in last_prices.index: 
                             try:
                                 price = float(last_prices[t]['Close']) 
                             except:
                                 pass
                    else:
                        if t in last_prices.index:
                            price = float(last_prices[t])
                        elif 'Close' in last_prices.index: 
                             price = float(last_prices['Close'])

                    curr = infer_currency(t)
                    rate = rate_map.get(curr, 1.0) # Default to 1.0 if not found (or user edit)
                    
                    # Special handling for GBP (LSE stocks usually in pence)
                    if curr == 'GBP':
                        price = price / 100.0
                    
                    candidates_data.append({
                        "ticker": t,
                        "price": price,
                        "currency": curr,
                        "rate": rate
                    })
        else:
            # Use intraday prices
            for t in all_tickers:
                if t in intraday_prices:
                    price = intraday_prices[t]['price']
                    if price_timestamp is None:
                        price_timestamp = intraday_prices[t]['timestamp']
                else:
                    price = 0.0
                
                curr = infer_currency(t)
                rate = rate_map.get(curr, 1.0)
                
                # Special handling for GBP (LSE stocks usually in pence)
                if curr == 'GBP':
                    price = price / 100.0
                
                candidates_data.append({
                    "ticker": t,
                    "price": price,
                    "currency": curr,
                    "rate": rate
                })

        return {
            "total_portfolio_value": total_portfolio_value,
            "cash": current_cash,
            "holdings": current_holdings,
            "candidates": candidates_data,
            "latest_date": latest_record['date'],
            "price_timestamp": price_timestamp,  # Add timestamp info
            "is_intraday": bool(intraday_prices)  # Flag to indicate if intraday prices were used
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
def get_data():
    df = load_data()
    if df is None:
        raise HTTPException(status_code=404, detail="No data found. Please download data first.")
    # Convert to JSON compatible format (simplified)
    return {"columns": df.columns.tolist(), "index": df.index.astype(str).tolist(), "data": "Data loaded (preview)"}

from app.backtester import run_backtest, calculate_metrics
from app.strategies import RandomSelectionStrategy, MomentumStrategy, ScoringStrategy
import pandas as pd

class BacktestRequest(BaseModel):
    n_tickers: int
    rebalance_period: int
    rebalance_period_unit: str # 'days', 'weeks', 'months'
    initial_capital: float
    start_date: str
    end_date: str
    stop_loss_pct: Optional[float] = None # Optional Stop Loss percentage (e.g., 0.10 for 10%)
    smart_stop_loss: bool = False # If True, only sell if not in top tickers
    transaction_fee_enabled: bool = False
    transaction_fee_type: str = 'percentage' # 'percentage' or 'fixed'
    transaction_fee_value: float = 0.0
    capital_gains_tax_enabled: bool = False
    capital_gains_tax_pct: float = 0.0
    margin_enabled: bool = True
    strategy: str = 'scoring' # 'random', 'momentum', 'scoring'
    sizing_method: str = 'equal' # 'equal', 'var'
    momentum_lookback_days: int = 30 # Lookback period for momentum strategy
    filter_negative_momentum: bool = False # If True, skip tickers with negative momentum
    sma_period: int = -1
    sell_on_profit_enabled: bool = False
    sell_on_profit_threshold_pct: Optional[float] = None
    smart_sell_on_profit_enabled: bool = False
    smart_sell_on_profit_threshold_pct: Optional[float] = None
    smart_sell_on_profit_check_freq: int = 1 # Default to daily check
    market_regime_filter_enabled: bool = False
    market_regime_sma_period: int = 200

@app.post("/api/backtest")
def run_backtest_endpoint(request: BacktestRequest):
    # Ensure we load from CSV for backtest as requested
    df = load_data()
    if df is None:
        raise HTTPException(status_code=404, detail="No data found. Please download data first.")
    
    if request.strategy == 'random':
        strategy = RandomSelectionStrategy(request.n_tickers, request.rebalance_period, request.rebalance_period_unit)
    elif request.strategy == 'momentum' or request.strategy == 'momentum_smart_tp':
        strategy = MomentumStrategy(request.n_tickers, request.rebalance_period, request.rebalance_period_unit, df, request.momentum_lookback_days, request.filter_negative_momentum, request.sma_period)
    elif request.strategy == 'scoring':
        strategy = ScoringStrategy(request.n_tickers, request.rebalance_period, request.rebalance_period_unit, df)
    else:
        # Default to scoring if unknown
        strategy = ScoringStrategy(request.n_tickers, request.rebalance_period, request.rebalance_period_unit, df)
    
    try:
        # Fetch ticker groups for the backtest
        from app.db_tickers import get_all_ticker_groups
        ticker_groups = get_all_ticker_groups()
        
        # Coverage check
        if not ticker_groups:
             raise HTTPException(status_code=400, detail="No ticker groups defined. Please add ticker groups first.")
        
        # Sort by valid_from to check coverage
        sorted_groups = sorted(ticker_groups, key=lambda x: x['valid_from'])
        simulation_start = request.start_date
        simulation_end = request.end_date
        
        # Check if first group starts before or at simulation start
        if sorted_groups[0]['valid_from'] > simulation_start:
             raise HTTPException(status_code=400, detail=f"No ticker group data for the period before {sorted_groups[0]['valid_from']}. Please adjust start date or add earlier ticker group.")

        portfolio = run_backtest(
            strategy, 
            df, 
            request.initial_capital, 
            request.start_date, 
            request.end_date,
            request.stop_loss_pct,
            request.smart_stop_loss,
            request.transaction_fee_enabled,
            request.transaction_fee_type,
            request.transaction_fee_value,
            request.capital_gains_tax_enabled,
            request.capital_gains_tax_pct,
            request.margin_enabled,
            sizing_method=request.sizing_method,
            sell_on_profit_enabled=request.sell_on_profit_enabled,
            sell_on_profit_threshold_pct=request.sell_on_profit_threshold_pct,
            smart_sell_on_profit_enabled=request.smart_sell_on_profit_enabled or request.strategy == 'momentum_smart_tp',
            smart_sell_on_profit_threshold_pct=request.smart_sell_on_profit_threshold_pct,
            smart_sell_on_profit_check_freq=request.smart_sell_on_profit_check_freq,
            ticker_groups=ticker_groups,
            market_regime_filter_enabled=request.market_regime_filter_enabled,
            market_regime_sma_period=request.market_regime_sma_period
        )
        metrics = calculate_metrics(portfolio)
        return metrics
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class OptimizationRangeRequest(BaseModel):
    min: float
    max: float
    step: float

class ScoringConfig(BaseModel):
    """Configuration for scoring calculation"""
    # Train metrics
    cagr_min: float = 0.0  # 0%
    cagr_max: float = 1.0  # 100%
    cagr_weight: float = 0.0
    dd_min: float = -0.50  # -50%
    dd_max: float = 0.0  # 0%
    dd_weight: float = 0.0
    
    # Test metrics (separate configuration)
    test_cagr_min: float = 0.0  # 0%
    test_cagr_max: float = 1.0  # 100%
    test_cagr_weight: float = 70.0
    test_dd_min: float = -0.50  # -50%
    test_dd_max: float = 0.0  # 0%
    test_dd_weight: float = 30.0

class OptimizationRequest(BaseModel):
    tickers: List[str]
    start_date: str
    end_date: str
    brokers: List[str]  # ['bossa', 'interactive_brokers']
    n_tickers_range: OptimizationRangeRequest
    stop_loss_range: Optional[OptimizationRangeRequest] = None
    rebalance_period_range: OptimizationRangeRequest  # In months
    momentum_lookback_range: OptimizationRangeRequest  # In days
    filter_negative_momentum: List[bool] = [False] # Default to False if not provided
    sma_period_range: Optional[OptimizationRangeRequest] = None # Optional, defaults to -1 if not provided
    margin_enabled: bool
    strategies: List[str]  # ['scoring', 'momentum']
    sizing_methods: List[str]  # ['equal', 'var']
    
    # Train/Test Split Parameters (optional)
    enable_train_test: bool = False
    train_start_date: Optional[str] = None
    train_months: Optional[int] = None
    test_months: Optional[int] = None
    top_n_for_test: Optional[int] = 10
    
    # Scoring Configuration (optional)
    scoring_config: Optional[ScoringConfig] = None
    
    # Walk-Forward Parameters (optional)
    enable_walk_forward: bool = False
    walk_forward_start: Optional[str] = None  # Overall start date
    walk_forward_end: Optional[str] = None    # Overall end date  
    walk_forward_step_months: Optional[int] = 6  # Step size in months
    walk_forward_dynamic_step: bool = False  # If True, step size is determined by winning strategy's rebalance period
    use_ticker_groups: bool = False  # If True, use dynamic ticker groups from database

# Helper function to run a single backtest for optimization
def run_single_backtest(df, config, start_date, end_date, margin_enabled, initial_capital=10000, ticker_groups=None):
    broker_configs = {
        'bossa': {
            'transaction_fee_enabled': True,
            'transaction_fee_type': 'percentage',
            'transaction_fee_value': 0.29,
            'capital_gains_tax_enabled': False,
            'capital_gains_tax_pct': 0.0
        },
        'interactive_brokers': {
            'transaction_fee_enabled': True,
            'transaction_fee_type': 'fixed',
            'transaction_fee_value': 1.0,
            'capital_gains_tax_enabled': True,
            'capital_gains_tax_pct': 19.0
        }
    }
    
    broker_config = broker_configs[config['broker']]
    
    # Create strategy
    if config['strategy'] == 'momentum':
        strategy = MomentumStrategy(
            config['n_tickers'], 
            config['rebalance_period'], 
            'months', 
            df, 
            config['momentum_lookback_days'], 
            config['filter_negative_momentum'],
            config.get('sma_period', -1)
        )
    elif config['strategy'] == 'scoring':
        strategy = ScoringStrategy(config['n_tickers'], config['rebalance_period'], 'months', df)
    else:
        return None # Should not happen with validation
    
    # Run backtest
    portfolio = run_backtest(
        strategy,
        df,
        initial_capital,  # Use provided initial capital
        start_date,
        end_date,
        config['stop_loss_pct'] / 100 if config['stop_loss_pct'] else None,
        False,  # smart_stop_loss
        broker_config['transaction_fee_enabled'],
        broker_config['transaction_fee_type'],
        broker_config['transaction_fee_value'],
        broker_config['capital_gains_tax_enabled'],
        broker_config['capital_gains_tax_pct'],
        margin_enabled,
        config['sizing_method'],
        ticker_groups=ticker_groups
    )
    
    metrics = calculate_metrics(portfolio)
    
    # Store result with parameters
    result = {
        'broker': config['broker'],
        'n_tickers': config['n_tickers'],
        'rebalance_period': config['rebalance_period'],
        'stop_loss_pct': config['stop_loss_pct'],
        'strategy': config['strategy'],
        'sizing_method': config['sizing_method'],
        'margin_enabled': margin_enabled,
        'cagr': metrics.get('cagr', 0),
        'max_drawdown': metrics.get('max_drawdown', 0),
        'final_value': metrics.get('final_value', 0),
        'total_return': metrics.get('total_return', 0)
    }
    
    # Add momentum specific params
    if config['strategy'] == 'momentum':
        result['momentum_lookback_days'] = config['momentum_lookback_days']
    if config['strategy'] == 'momentum':
        result['momentum_lookback_days'] = config['momentum_lookback_days']
        result['filter_negative_momentum'] = config['filter_negative_momentum']
        result['sma_period'] = config.get('sma_period', -1)
        
    return result

def calculate_train_test_score(train_cagr, train_dd, test_cagr, test_dd, config=None):
    """
    Calculate score for train/test optimization based on BOTH train and test results.
    
    Uses configurable thresholds and weights from ScoringConfig.
    Train and Test metrics can have separate configurations.
    
    Score = Train_CAGR_score + Train_DD_score + Test_CAGR_score + Test_DD_score
    Maximum: (cagr_weight + dd_weight) + (test_cagr_weight + test_dd_weight)
    
    Both train and test results are included to evaluate both in-sample and out-of-sample performance.
    """
    if config is None:
        config = ScoringConfig()  # Use defaults
    
    def calc_train_cagr_score(cagr):
        if cagr < config.cagr_min:
            return 0
        elif cagr > config.cagr_max:
            return config.cagr_weight
        else:
            return ((cagr - config.cagr_min) / (config.cagr_max - config.cagr_min)) * config.cagr_weight
    
    def calc_train_dd_score(dd):
        # Note: max_drawdown is negative, so dd_max (less negative) is better than dd_min (more negative)
        if dd < config.dd_min:  # Worse than min threshold
            return 0
        elif dd > config.dd_max:  # Better than max threshold
            return config.dd_weight
        else:
            return ((dd - config.dd_min) / (config.dd_max - config.dd_min)) * config.dd_weight
    
    def calc_test_cagr_score(cagr):
        if cagr < config.test_cagr_min:
            return 0
        elif cagr > config.test_cagr_max:
            return config.test_cagr_weight
        else:
            return ((cagr - config.test_cagr_min) / (config.test_cagr_max - config.test_cagr_min)) * config.test_cagr_weight
    
    def calc_test_dd_score(dd):
        # Note: max_drawdown is negative, so dd_max (less negative) is better than dd_min (more negative)
        if dd < config.test_dd_min:  # Worse than min threshold
            return 0
        elif dd > config.test_dd_max:  # Better than max threshold
            return config.test_dd_weight
        else:
            return ((dd - config.test_dd_min) / (config.test_dd_max - config.test_dd_min)) * config.test_dd_weight
    
    # Calculate scores for both train and test using their respective configurations
    train_cagr_score = calc_train_cagr_score(train_cagr)
    train_dd_score = calc_train_dd_score(train_dd)
    test_cagr_score = calc_test_cagr_score(test_cagr)
    test_dd_score = calc_test_dd_score(test_dd)
    
    # Sum of Train and Test scores
    # This evaluates both in-sample (train) and out-of-sample (test) performance
    train_score = train_cagr_score + train_dd_score
    test_score = test_cagr_score + test_dd_score
    
    return train_score + test_score

def calculate_single_score(cagr, dd, config=None):
    """
    Calculate score for normal optimization (single period).
    
    Uses configurable thresholds and weights from ScoringConfig.
    
    Score = CAGR_score + DD_score
    Maximum: cagr_weight + dd_weight
    """
    if config is None:
        config = ScoringConfig()  # Use defaults
    
    # CAGR score
    if cagr < config.cagr_min:
        cagr_score = 0
    elif cagr > config.cagr_max:
        cagr_score = config.cagr_weight
    else:
        cagr_score = ((cagr - config.cagr_min) / (config.cagr_max - config.cagr_min)) * config.cagr_weight
    
    # DD score
    if dd < config.dd_min:
        dd_score = 0
    elif dd > config.dd_max:
        dd_score = config.dd_weight
    else:
        dd_score = ((dd - config.dd_min) / (config.dd_max - config.dd_min)) * config.dd_weight
    
    return cagr_score + dd_score





def run_walk_forward_optimization(request: OptimizationRequest, df):
    """
    Run walk-forward optimization across multiple time windows.
    
    Returns aggregated parameter frequency ranking and all window results.
    """
    from dateutil.relativedelta import relativedelta
    from datetime import datetime as dt, timedelta

    
    # Validate required parameters for walk-forward
    if not request.train_months or not request.test_months:
        raise ValueError("Walk-Forward Optimization requires train_months and test_months to be set. Please enable Train/Test Split.")
    
    # Fetch ticker groups if enabled
    ticker_groups = None
    if request.use_ticker_groups:
        from app.db_tickers import get_all_ticker_groups
        ticker_groups = get_all_ticker_groups()
        if not ticker_groups:
             print("Warning: use_ticker_groups is True but no groups found in Walk-Forward.")
    
    # Run train/test for each window iteratively
    all_window_results = []
    
    # Track capital across windows for realistic simulation
    current_capital = 10000  # Initial capital for first window
    
    current_start = dt.strptime(request.walk_forward_start, '%Y-%m-%d')
    overall_end = dt.strptime(request.walk_forward_end, '%Y-%m-%d')
    
    
    window_index = 0
    
    while True:
        # Calculate train and test periods for this window
        train_start = current_start
        train_end = train_start + relativedelta(months=request.train_months) - relativedelta(days=1)
        test_start = train_end + relativedelta(days=1)
        test_end = test_start + relativedelta(months=request.test_months) - relativedelta(days=1)
        
        # Check if we've exceeded overall end date
        if test_end > overall_end:
            break
            
        window = {
            'train_start': train_start.strftime('%Y-%m-%d'),
            'train_end': train_end.strftime('%Y-%m-%d'),
            'test_start': test_start.strftime('%Y-%m-%d'),
            'test_end': test_end.strftime('%Y-%m-%d')
        }
        
        # Create modified request for this window
        window_request = OptimizationRequest(
            tickers=request.tickers,
            start_date=request.start_date,  # Not used in train/test mode
            end_date=request.end_date,      # Not used in train/test mode
            brokers=request.brokers,
            n_tickers_range=request.n_tickers_range,
            stop_loss_range=request.stop_loss_range,
            rebalance_period_range=request.rebalance_period_range,
            momentum_lookback_range=request.momentum_lookback_range,
            filter_negative_momentum=request.filter_negative_momentum,
            sma_period_range=request.sma_period_range,
            margin_enabled=request.margin_enabled,
            strategies=request.strategies,
            sizing_methods=request.sizing_methods,
            enable_train_test=True,
            train_start_date=window['train_start'],
            train_months=request.train_months,
            test_months=request.test_months,
            top_n_for_test=request.top_n_for_test,
            scoring_config=request.scoring_config,
            enable_walk_forward=False,  # Prevent recursion
            use_ticker_groups=request.use_ticker_groups
        )
        
        # Run train/test for this window
        window_results = run_optimization_endpoint(window_request)
        
        # Extract top N configurations from training results
        top_configs = window_results['train_results'][:request.top_n_for_test]
        test_configs = window_results['test_results'][:request.top_n_for_test]
        scores = window_results.get('scores', [])[:request.top_n_for_test]
        
        # Store results for this window
        all_window_results.append({
            'window_number': window_index + 1,
            'window': window,
            'train_results': top_configs,  # Top N for display
            'test_results': test_configs,   # Top N for display
            'scores': scores,               # Top N for display
            'all_train_results': window_results.get('all_train_results', window_results['train_results']),  # ALL results
            'all_test_results': window_results.get('all_test_results', window_results['test_results']),    # ALL results
            'all_scores': window_results.get('all_scores', window_results.get('scores', []))                # ALL scores
        })
        
        # === PORTFOLIO SIMULATION & DYNAMIC STEP CALCULATION ===
        # Use existing backtest mechanism to simulate real trading
        all_scores_list = window_results.get('all_scores', window_results.get('scores', []))
        all_train_results = window_results.get('all_train_results', window_results['train_results'])
        
        step_months_for_next = request.walk_forward_step_months # Default to fixed step
        
        if all_scores_list and len(all_scores_list) > 0:
            # Find index of best score
            best_idx = all_scores_list.index(max(all_scores_list))
            best_result = all_train_results[best_idx]
            
            # --- DYNAMIC STEP LOGIC ---
            if request.walk_forward_dynamic_step:
                # Use winning strategy's rebalance period as the step for next window
                step_months_for_next = best_result.get('rebalance_period', 1)
                print(f"DEBUG: Dynamic Step - Window {window_index+1} winner rebalance: {step_months_for_next} months. Next window will shift by this amount.")
            
            # Calculate simulation period (from day after test_end to rebalance_period later)
            test_end_date = dt.strptime(window['test_end'], '%Y-%m-%d')
            sim_start_date = test_end_date + timedelta(days=1)
            sim_end_date = sim_start_date + relativedelta(months=best_result.get('rebalance_period', 1))
            
            # Check if simulation period is within available data
            last_available_date = df.index.max()
            if pd.to_datetime(sim_start_date) > last_available_date:
                print(f"DEBUG: Skipping portfolio simulation for window {window_index+1} - start date beyond available data")
                all_window_results[-1]['portfolio_state'] = {
                    'error': f'Simulation start date {sim_start_date.strftime("%Y-%m-%d")} is beyond available data'
                }
            else:
                # Adjust end date if beyond available data
                if pd.to_datetime(sim_end_date) > last_available_date:
                    sim_end_date = last_available_date
                    print(f"DEBUG: Adjusted simulation end date to last available: {sim_end_date}")
                
                # Run backtest with best parameters
                try:
                    config = {
                        'broker': best_result.get('broker', 'bossa'),
                        'n_tickers': best_result.get('n_tickers', 5),
                        'rebalance_period': best_result.get('rebalance_period', 1),
                        'stop_loss_pct': best_result.get('stop_loss_pct', None),
                        'momentum_lookback_days': best_result.get('momentum_lookback_days', 30),
                        'filter_negative_momentum': best_result.get('filter_negative_momentum', False),
                        'sma_period': best_result.get('sma_period', -1),
                        'strategy': best_result.get('strategy', 'momentum'),
                        'sizing_method': best_result.get('sizing_method', 'equal'),
                        'margin_enabled': best_result.get('margin_enabled', request.margin_enabled)
                    }
                    
                    sim_result = run_single_backtest(
                        df,
                        config,
                        sim_start_date.strftime('%Y-%m-%d'),
                        sim_end_date.strftime('%Y-%m-%d'),
                        request.margin_enabled,
                        initial_capital=current_capital,  # Use capital from previous window
                        ticker_groups=ticker_groups
                    )
                    
                    if sim_result:
                        final_capital = sim_result.get('final_value', current_capital)
                        # Use total_return from backtest (same as Dashboard)
                        # total_return is a decimal (e.g., -0.0008), convert to percentage
                        window_return_pct = sim_result.get('total_return', 0) * 100
                        
                        # Store portfolio simulation results
                        all_window_results[-1]['portfolio_state'] = {
                            'sim_start_date': sim_start_date.strftime('%Y-%m-%d'),
                            'sim_end_date': sim_end_date.strftime('%Y-%m-%d'),
                            'best_params': config,
                            'initial_capital': current_capital,  # Capital at start of this window
                            'final_capital': final_capital,
                            'total_return_pct': window_return_pct,  # Return for this window (from backtest)
                            'max_drawdown_pct': sim_result.get('max_drawdown', 0) * 100
                        }
                        
                        # Update capital for next window
                        current_capital = final_capital
                        
                        print(f"DEBUG: Portfolio simulation completed for window {window_index+1}")
                        print(f"DEBUG: Initial=${sim_result.get('final_value', current_capital):.2f}, Final=${final_capital:.2f}, Return={window_return_pct:.2f}%")
                        print(f"DEBUG: Carrying forward capital=${current_capital:.2f} to next window")
                    else:
                        # Keep current capital if simulation failed
                        all_window_results[-1]['portfolio_state'] = {
                            'error': 'Backtest returned no results',
                            'capital_carried_forward': current_capital
                        }
                        
                except Exception as e:
                    import traceback
                    print(f"ERROR: Portfolio simulation failed for window {window_index+1}: {e}")
                    traceback.print_exc()
                    all_window_results[-1]['portfolio_state'] = {
                        'error': str(e)
                    }
        

        
        # Move forward for next iteration
        current_start += relativedelta(months=step_months_for_next)
        window_index += 1
    
    # Mark walk-forward as complete - tracker removed

    
    # Calculate overall portfolio performance and actual simulation period
    total_return_pct = ((current_capital - 10000) / 10000) * 100
    
    # Get actual simulation dates from first and last windows
    simulation_start_date = request.walk_forward_start  # Fallback
    simulation_end_date = request.walk_forward_end      # Fallback
    
    # Find first window with successful simulation
    for window in all_window_results:
        if 'portfolio_state' in window and 'sim_start_date' in window['portfolio_state']:
            simulation_start_date = window['portfolio_state']['sim_start_date']
            break
    
    # Find last window with successful simulation (iterate backwards)
    for window in reversed(all_window_results):
        if 'portfolio_state' in window and 'sim_end_date' in window['portfolio_state']:
            simulation_end_date = window['portfolio_state']['sim_end_date']
            break
            
    # Calculate overall portfolio performance
    overall_initial = 10000  # Starting capital
    overall_final = current_capital
    overall_return_pct = ((overall_final - overall_initial) / overall_initial) * 100
    
    # Calculate CAGR for overall portfolio
    # CAGR = (final_value / initial_value)^(1/years) - 1
    start_date = dt.strptime(all_window_results[0]['portfolio_state']['sim_start_date'], '%Y-%m-%d')
    end_date = dt.strptime(all_window_results[-1]['portfolio_state']['sim_end_date'], '%Y-%m-%d')
    years = (end_date - start_date).days / 365.25
    
    if years > 0:
        overall_cagr = ((overall_final / overall_initial) ** (1 / years) - 1) * 100
    else:
        overall_cagr = 0
    
    portfolio_summary = {
        'initial_capital': overall_initial,
        'final_capital': overall_final,
        'total_return_pct': overall_return_pct,
        'cagr': overall_cagr,
        'start_date': start_date.strftime('%Y-%m-%d'),
        'end_date': end_date.strftime('%Y-%m-%d')
    }
    
    return {
        'walk_forward_mode': True,
        'total_windows': len(all_window_results),
        'windows': all_window_results,
        'train_period_months': request.train_months,
        'test_period_months': request.test_months,
        'step_months': request.walk_forward_step_months,
        'portfolio_summary': portfolio_summary
    }




@app.post("/api/optimize")
def run_optimization_endpoint(request: OptimizationRequest):
    df = load_data()
    if df is None:
        raise HTTPException(status_code=404, detail="No data found. Please download data first.")
    
    # Fetch ticker groups if enabled
    ticker_groups = None
    if request.use_ticker_groups:
        from app.db_tickers import get_all_ticker_groups
        ticker_groups = get_all_ticker_groups()
        if not ticker_groups:
             print("Warning: use_ticker_groups is True but no groups found.")
    
    # Handle Walk-Forward Optimization
    if request.enable_walk_forward:
        return run_walk_forward_optimization(request, df)
    
    # Handle Train/Test Split
    if request.enable_train_test:
        from dateutil.relativedelta import relativedelta
        from datetime import datetime as dt
        
        # Calculate train and test periods
        train_start = dt.strptime(request.train_start_date, '%Y-%m-%d')
        train_end = train_start + relativedelta(months=request.train_months) - relativedelta(days=1)
        test_start = train_end + relativedelta(days=1)
        test_end = test_start + relativedelta(months=request.test_months) - relativedelta(days=1)
        
        train_start_str = train_start.strftime('%Y-%m-%d')
        train_end_str = train_end.strftime('%Y-%m-%d')
        test_start_str = test_start.strftime('%Y-%m-%d')
        test_end_str = test_end.strftime('%Y-%m-%d')
        
        # Run optimization on training period
        train_request = OptimizationRequest(
            tickers=request.tickers,
            start_date=train_start_str,
            end_date=train_end_str,
            brokers=request.brokers,
            n_tickers_range=request.n_tickers_range,
            stop_loss_range=request.stop_loss_range,
            rebalance_period_range=request.rebalance_period_range,
            momentum_lookback_range=request.momentum_lookback_range,
            filter_negative_momentum=request.filter_negative_momentum,
            sma_period_range=request.sma_period_range,
            margin_enabled=request.margin_enabled,
            strategies=request.strategies,
            sizing_methods=request.sizing_methods,
            enable_train_test=False,  # Disable recursion
            use_ticker_groups=request.use_ticker_groups
        )
        
        # Get training results
        train_results = run_optimization_endpoint(train_request)
        
        # Run backtests on test period for ALL training results to calculate scores
        all_results_with_scores = []
        for train_result in train_results['results']:
            # Extract parameters from training result
            test_config = {
                'broker': train_result['broker'],
                'n_tickers': train_result['n_tickers'],
                'rebalance_period': train_result['rebalance_period'],
                'stop_loss_pct': train_result.get('stop_loss_pct'),
                'strategy': train_result['strategy'],
                'sizing_method': train_result['sizing_method'],
                'momentum_lookback_days': train_result.get('momentum_lookback_days', 30),
                'filter_negative_momentum': train_result.get('filter_negative_momentum', False),
                'sma_period': train_result.get('sma_period', -1)
            }
            
            # Run backtest on test period
            test_result = run_single_backtest(
                df, test_config, test_start_str, test_end_str, request.margin_enabled, ticker_groups=ticker_groups
            )
            
            # Calculate score based on both train and test results
            score = calculate_train_test_score(
                train_result['cagr'], 
                train_result['max_drawdown'],
                test_result['cagr'], 
                test_result['max_drawdown'],
                request.scoring_config
            )
            
            # Combine train and test results with score
            combined_result = {
                'train_result': train_result,
                'test_result': test_result,
                'score': score
            }
            all_results_with_scores.append(combined_result)
        
        # Sort by score (descending) and select top N
        all_results_with_scores.sort(key=lambda x: x['score'], reverse=True)
        top_n_scored = all_results_with_scores[:request.top_n_for_test]
        
        # Extract train and test results for top N (for display)
        top_n_train_results = [r['train_result'] for r in top_n_scored]
        top_n_test_results = [r['test_result'] for r in top_n_scored]
        top_n_scores = [r['score'] for r in top_n_scored]
        
        # Extract ALL results (before top N selection) for walk-forward analysis
        all_train_results = [r['train_result'] for r in all_results_with_scores]
        all_test_results = [r['test_result'] for r in all_results_with_scores]
        all_scores = [r['score'] for r in all_results_with_scores]
        
        # Return combined results
        return {
            'train_test_mode': True,
            'train_period': {'start': train_start_str, 'end': train_end_str},
            'test_period': {'start': test_start_str, 'end': test_end_str},
            'train_results': top_n_train_results,      # Top N for display
            'test_results': top_n_test_results,        # Top N for display
            'scores': top_n_scores,                     # Top N for display
            'all_train_results': all_train_results,    # ALL results for walk-forward
            'all_test_results': all_test_results,      # ALL results for walk-forward
            'all_scores': all_scores,                   # ALL scores for walk-forward
            'total_tests': train_results['total_tests'],
            'completed_tests': train_results['completed_tests']
        }
    
    
    # Broker presets
    broker_configs = {
        'bossa': {
            'transaction_fee_enabled': True,
            'transaction_fee_type': 'percentage',
            'transaction_fee_value': 0.29,
            'capital_gains_tax_enabled': False,
            'capital_gains_tax_pct': 0.0
        },
        'interactive_brokers': {
            'transaction_fee_enabled': True,
            'transaction_fee_type': 'fixed',
            'transaction_fee_value': 1.0,
            'capital_gains_tax_enabled': True,
            'capital_gains_tax_pct': 19.0
        }
    }
    
    # Generate parameter combinations
    import numpy as np
    
    # Number of tickers range
    n_tickers_values = list(range(
        int(request.n_tickers_range.min),
        int(request.n_tickers_range.max) + 1,
        int(request.n_tickers_range.step)
    ))
    
    # Rebalance period range (in months)
    rebalance_period_values = list(range(
        int(request.rebalance_period_range.min),
        int(request.rebalance_period_range.max) + 1,
        int(request.rebalance_period_range.step)
    ))
    
    # Momentum lookback range (in days)
    momentum_lookback_values = list(range(
        int(request.momentum_lookback_range.min),
        int(request.momentum_lookback_range.max) + 1,
        int(request.momentum_lookback_range.step)
    ))
    
    # Stop loss range (optional)
    if request.stop_loss_range:
        stop_loss_values = list(np.arange(
            request.stop_loss_range.min,
            request.stop_loss_range.max + request.stop_loss_range.step,
            request.stop_loss_range.step
        ))
        stop_loss_values = [round(v, 2) for v in stop_loss_values]
    else:
        stop_loss_values = [None]
        
    # SMA Period range (optional)
    if request.sma_period_range:
        sma_period_values = list(range(
            int(request.sma_period_range.min),
            int(request.sma_period_range.max) + 1,
            int(request.sma_period_range.step)
        ))
    else:
        sma_period_values = [-1]
    
    # Generate all combinations
    results = []
    total_combinations = (
        len(request.brokers) * 
        len(n_tickers_values) * 
        len(rebalance_period_values) *
        len(stop_loss_values) * 
        len(request.strategies) * 
        len(request.sizing_methods) *
        len(request.sizing_methods) *
        len(momentum_lookback_values) * # Only used when momentum is selected
        len(request.filter_negative_momentum) * # Only used when momentum is selected
        len(sma_period_values) # Only used when momentum is selected
    )
    
    # Initialize progress tracker - removed

    
    current_test = 0
    last_progress_update = 0
    
    try:
        for broker in request.brokers:
            broker_config = broker_configs[broker]
            
            for n_tickers in n_tickers_values:
                for rebalance_period in rebalance_period_values:
                    for stop_loss_pct in stop_loss_values:
                        for strategy_name in request.strategies:
                            for sizing_method in request.sizing_methods:
                                # For momentum, iterate over lookback values and filter options
                                lookback_values = momentum_lookback_values if strategy_name == 'momentum' else [30]
                                filter_values = request.filter_negative_momentum if strategy_name == 'momentum' else [False]
                                sma_values = sma_period_values if strategy_name == 'momentum' else [-1]
                                
                                for lookback_days in lookback_values:
                                    for filter_neg_mom in filter_values:
                                        for sma_period in sma_values:
                                            current_test += 1
                                            
                                            # Create strategy
                                            if strategy_name == 'momentum':
                                                strategy = MomentumStrategy(n_tickers, rebalance_period, 'months', df, lookback_days, filter_neg_mom, sma_period)
                                            elif strategy_name == 'scoring':
                                                strategy = ScoringStrategy(n_tickers, rebalance_period, 'months', df)
                                            else:
                                                continue
                                            
                                            # Run backtest
                                            try:
                                                portfolio = run_backtest(
                                                    strategy,
                                                    df,
                                                    10000,  # Fixed initial capital
                                                    request.start_date,
                                                    request.end_date,
                                                    stop_loss_pct / 100 if stop_loss_pct else None,
                                                    False,  # smart_stop_loss
                                                    broker_config['transaction_fee_enabled'],
                                                    broker_config['transaction_fee_type'],
                                                    broker_config['transaction_fee_value'],
                                                    broker_config['capital_gains_tax_enabled'],
                                                    broker_config['capital_gains_tax_pct'],
                                                    request.margin_enabled,
                                                    sizing_method,
                                                    ticker_groups=ticker_groups
                                                )
                                                
                                                metrics = calculate_metrics(portfolio)
                                                
                                                # Store result with parameters
                                                result = {
                                                    'test_number': current_test,
                                                    'broker': broker,
                                                    'n_tickers': n_tickers,
                                                    'rebalance_period': rebalance_period,
                                                    'stop_loss_pct': stop_loss_pct,
                                                    'strategy': strategy_name,
                                                    'sizing_method': sizing_method,
                                                    'margin_enabled': request.margin_enabled,
                                                    'cagr': metrics.get('cagr', 0),
                                                    'max_drawdown': metrics.get('max_drawdown', 0),
                                                    'final_value': metrics.get('final_value', 0),
                                                    'total_return': metrics.get('total_return', 0)
                                                }
                                                
                                                # Add momentum specific params
                                                if strategy_name == 'momentum':
                                                    result['momentum_lookback_days'] = lookback_days
                                                    result['filter_negative_momentum'] = filter_neg_mom
                                                    result['sma_period'] = sma_period
                                                
                                                # Calculate score for this result
                                                result['score'] = calculate_single_score(
                                                    metrics.get('cagr', 0),
                                                    metrics.get('max_drawdown', 0),
                                                    request.scoring_config
                                                )
                                                
                                                results.append(result)
                                            except Exception as e:
                                                import traceback
                                                print(f"Error in test {current_test}: {e}")
                                                traceback.print_exc()
                                                # Continue with next combination
                                                continue
        
        # Sort results by score (descending), then by CAGR and Max Drawdown
        results.sort(key=lambda x: (-x.get('score', 0), -x['cagr'], -x['max_drawdown']))
        

        
        return {
            'total_tests': total_combinations,
            'completed_tests': len(results),
            'results': results
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

OPTIMIZATION_RESULTS_DIR = os.getenv("OPTIMIZATION_RESULTS_DIR", "/home/mpaton/Projects/my/backTesterPython/backTesterPython/optimization_results")

class SaveOptimizationResultsRequest(BaseModel):
    params: OptimizationRequest
    results: Any  # Accept any structure - dict for walk-forward/train-test, or object with results array for normal optimization

@app.post("/api/save_optimization_results")
async def save_optimization_results(request: SaveOptimizationResultsRequest):
    try:
        if not os.path.exists(OPTIMIZATION_RESULTS_DIR):
            os.makedirs(OPTIMIZATION_RESULTS_DIR)
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        
        # Check if walk-forward mode to add train period to filename
        if isinstance(request.results, dict) and request.results.get('walk_forward_mode'):
            train_months = request.results.get('train_period_months', 0)
            train_years = train_months / 12
            filename = f"optimization_results_{train_years:.0f}y_{timestamp}.txt"
        else:
            filename = f"optimization_results_{timestamp}.txt"
        
        filepath = os.path.join(OPTIMIZATION_RESULTS_DIR, filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"Optimization Results - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 50 + "\n\n")
            
            # Check if walk-forward mode
            if isinstance(request.results, dict) and request.results.get('walk_forward_mode'):
                # Walk-Forward Mode
                f.write("MODE: Walk-Forward Optimization\n")
                f.write(f"Total Windows: {request.results.get('total_windows')}\n")
                
                # Convert train period from months to years for display
                train_months = request.results.get('train_period_months')
                train_years = train_months / 12 if train_months else 0
                f.write(f"Train Period: {train_years:.1f} years ({train_months} months)\n")
                
                f.write(f"Test Period: {request.results.get('test_period_months')} months\n")
                f.write(f"Step: {request.results.get('step_months')} months\n\n")
                
                # Calculate Aggregated Performance from top result of each window
                windows = request.results.get('windows', [])
                if windows:
                    test_cagrs = [w['test_results'][0]['cagr'] for w in windows if w.get('test_results')]
                    test_dds = [w['test_results'][0]['max_drawdown'] for w in windows if w.get('test_results')]
                    
                    if test_cagrs:
                        # Geometric mean: ((1+r1) * (1+r2) * ... * (1+rn))^(1/n) - 1
                        product = 1
                        for cagr in test_cagrs:
                            product *= (1 + cagr)
                        aggregated_cagr = pow(product, 1 / len(test_cagrs)) - 1
                        
                        # Arithmetic mean for drawdown
                        avg_dd = sum(test_dds) / len(test_dds) if test_dds else 0
                        
                        f.write("=" * 50 + "\n")
                        f.write("AGGREGATED PERFORMANCE (Top Result from Each Window)\n")
                        f.write("=" * 50 + "\n\n")
                        f.write(f"Aggregated Test CAGR: {aggregated_cagr * 100:.2f}%\n")
                        f.write(f"  (Geometric mean of {len(test_cagrs)} windows)\n\n")
                        f.write(f"Average Test Max Drawdown: {avg_dd * 100:.2f}%\n")
                        f.write(f"  (Arithmetic mean of {len(test_dds)} windows)\n\n")
                
                # Individual Windows
                f.write("\n" + "=" * 50 + "\n")
                f.write("INDIVIDUAL WINDOWS (Top Results)\n")
                f.write("=" * 50 + "\n\n")
                
                for window in request.results.get('windows', []):
                    f.write(f"\nWindow {window['window_number']}: {window['window']['train_start']} → {window['window']['test_end']}\n")
                    f.write(f"Train: {window['window']['train_start']} to {window['window']['train_end']}\n")
                    f.write(f"Test: {window['window']['test_start']} to {window['window']['test_end']}\n")
                    f.write("-" * 50 + "\n")
                    
                    for i, (train, test, score) in enumerate(zip(window['train_results'], window['test_results'], window['scores']), 1):
                        lookback = train.get('momentum_lookback_days', '-')
                        f.write(f"{i}. {train['broker']} | N:{train['n_tickers']} | Rebal:{train['rebalance_period']} | Look:{lookback} | ")
                        f.write(f"Train CAGR:{train['cagr']*100:.2f}% DD:{train['max_drawdown']*100:.2f}% | ")
                        f.write(f"Test CAGR:{test['cagr']*100:.2f}% DD:{test['max_drawdown']*100:.2f}% | ")
                        f.write(f"Score:{score:.1f}\n")
                    f.write("\n")
                
                # Add JSON footer for easy re-loading (walk-forward mode)
                f.write("\n" + "=" * 80 + "\n")
                f.write("# JSON DATA (for re-loading results)\n")
                f.write("=" * 80 + "\n")
                f.write(json.dumps(request.results, indent=2))
                f.write("\n")
                
            else:
                # Normal or Train/Test Mode
                f.write("Parameters:\n")
                f.write("-" * 20 + "\n")
                f.write(f"Start Date: {request.params.start_date}\n")
                f.write(f"End Date: {request.params.end_date}\n")
                f.write(f"Tickers: {', '.join(request.params.tickers)}\n")
                f.write(f"Brokers: {', '.join(request.params.brokers)}\n")
                f.write(f"Strategies: {', '.join(request.params.strategies)}\n")
                f.write(f"Sizing Methods: {', '.join(request.params.sizing_methods)}\n")
                f.write(f"Margin Enabled: {request.params.margin_enabled}\n")
                f.write(f"Filter Negative Momentum: {request.params.filter_negative_momentum}\n")
                
                f.write("\nRanges:\n")
                f.write(f"N Tickers: {request.params.n_tickers_range}\n")
                f.write(f"Rebalance Period: {request.params.rebalance_period_range}\n")
                f.write(f"Momentum Lookback: {request.params.momentum_lookback_range}\n")
                if request.params.stop_loss_range:
                    f.write(f"Stop Loss: {request.params.stop_loss_range}\n")
                
                f.write("\n" + "=" * 50 + "\n\n")
                f.write("Top 300 Results:\n")
                f.write("-" * 20 + "\n")
                
                # Get results list
                # For normal optimization, results is a dict with 'results' key containing the list
                # For other modes, it might be a list directly
                if isinstance(request.results, dict) and 'results' in request.results:
                    results_list = request.results['results']
                elif isinstance(request.results, list):
                    results_list = request.results
                else:
                    results_list = []
                
                # Header
                headers = ["#", "Broker", "N Tickers", "Rebalance", "Lookback", "Filter Neg Mom", "Stop Loss", "Strategy", "Sizing", "CAGR", "Max DD", "Final Value"]
                header_str = " | ".join(headers)
                f.write(header_str + "\n")
                f.write("-" * len(header_str) + "\n")
                
                for res in results_list[:300]:
                    row = [
                        str(res.get('test_number', '')),
                        str(res.get('broker', '')),
                        str(res.get('n_tickers', '')),
                        str(res.get('rebalance_period', '')),
                        str(res.get('momentum_lookback_days', '-')),
                        'Yes' if res.get('filter_negative_momentum') else 'No' if res.get('filter_negative_momentum') is False else '-',
                        f"{res.get('stop_loss_pct')}%" if res.get('stop_loss_pct') else '-',
                        str(res.get('strategy', '')),
                        str(res.get('sizing_method', '')),
                        f"{res.get('cagr', 0)*100:.2f}%",
                        f"{res.get('max_drawdown', 0)*100:.2f}%",
                        f"${res.get('final_value', 0):.2f}"
                    ]
                    f.write(" | ".join(row) + "\n")
                
                # Add JSON footer for easy re-loading
                f.write("\n" + "=" * 80 + "\n")
                f.write("# JSON DATA (for re-loading results)\n")
                f.write("=" * 80 + "\n")
                f.write(json.dumps(request.results, indent=2))
                f.write("\n")
        
        return {"message": "Results saved successfully", "filename": filename, "path": filepath}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class ParseResultsRequest(BaseModel):
    file_content: str

@app.post("/api/parse_results")
async def parse_results(request: ParseResultsRequest):
    """Parse results from saved text file by extracting JSON footer"""
    try:
        content = request.file_content
        
        # Find JSON data marker
        json_marker = "# JSON DATA (for re-loading results)"
        marker_index = content.find(json_marker)
        
        if marker_index == -1:
            raise HTTPException(status_code=400, detail="File does not contain JSON data. Please use a file saved with the Save Results button.")
        
        # Extract JSON part (after the separator line following the marker)
        json_start = content.find("{", marker_index)
        if json_start == -1:
            raise HTTPException(status_code=400, detail="Invalid file format - JSON data not found")
        
        json_str = content[json_start:].strip()
        
        # Parse JSON
        results = json.loads(json_str)
        
        return results
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class SimulationRequest(BaseModel):
    tickers: List[str]
    start_date: str
    end_date: str

@app.get("/api/simulation/tickers")
def get_simulation_tickers():
    try:
        all_tickers = set()
        
        # Try general stock prices
        try:
            df = load_data()
            if df is not None and not df.empty:
                if isinstance(df.columns, pd.MultiIndex):
                    all_tickers.update(df.columns.get_level_values(0).unique())
                else:
                    all_tickers.update(df.columns)
        except Exception as e:
            print(f"Error loading general data: {e}")
        
        # Try portfolio stock prices
        try:
            pdf = load_data(filename=PORTFOLIO_DATA_FILE)
            if pdf is not None and not pdf.empty:
                if isinstance(pdf.columns, pd.MultiIndex):
                    all_tickers.update(pdf.columns.get_level_values(0).unique())
                else:
                    all_tickers.update(pdf.columns)
        except Exception as e:
            print(f"Error loading portfolio data: {e}")
                
        # Clean up
        result = [t for t in all_tickers if t and t != 'Date' and not pd.isna(t)]
        final_list = sorted(list(set(result)))
        print(f"Simulation tickers found: {len(final_list)}")
        return final_list
    except Exception as e:
        print(f"Error getting simulation tickers: {e}")
        return []

@app.post("/api/simulation/run")
def run_simulation(request: SimulationRequest):
    try:
        df_general = load_data()
        df_portfolio = load_data(filename=PORTFOLIO_DATA_FILE)
        
        df = None
        if df_general is not None and not df_general.empty and df_portfolio is not None and not df_portfolio.empty:
             df = pd.concat([df_general, df_portfolio], axis=1)
             df = df.loc[:, ~df.columns.duplicated()]
        elif df_general is not None and not df_general.empty:
             df = df_general
        elif df_portfolio is not None and not df_portfolio.empty:
             df = df_portfolio
             
        if df is None:
            raise HTTPException(status_code=404, detail="No data found. Please download data first.")
        
        start_dt = pd.to_datetime(request.start_date)
        end_dt = pd.to_datetime(request.end_date)
        
        # Filter dates within range
        available_dates = df.index[(df.index >= start_dt) & (df.index <= end_dt)]
        if available_dates.empty:
             raise HTTPException(status_code=400, detail="No data available for the selected date range.")
             
        actual_start_date = available_dates[0]
        actual_end_date = available_dates[-1]
        
        results = []
        initial_capital = 10000.0
        
        if not request.tickers:
            return {"error": "No tickers provided"}
            
        allocation_per_ticker = initial_capital / len(request.tickers)
        total_final_value = 0.0
        
        is_multi = isinstance(df.columns, pd.MultiIndex)
        
        for ticker in request.tickers:
            try:
                if is_multi:
                    # Check if ticker exists
                    if ticker not in df.columns.get_level_values(0):
                         results.append({"ticker": ticker, "error": "Ticker not found in data"})
                         continue
                    price_start = float(df.loc[actual_start_date, (ticker, 'Close')])
                    price_end = float(df.loc[actual_end_date, (ticker, 'Close')])
                else:
                    if ticker not in df.columns:
                         results.append({"ticker": ticker, "error": "Ticker not found in data"})
                         continue
                    price_start = float(df.loc[actual_start_date, ticker])
                    price_end = float(df.loc[actual_end_date, ticker])
                
                if pd.isna(price_start) or pd.isna(price_end):
                     results.append({
                        "ticker": ticker,
                        "error": "Missing price data for selected dates"
                     })
                     continue
                     
                shares = allocation_per_ticker / price_start
                final_value = shares * price_end
                return_pct = (price_end - price_start) / price_start if price_start != 0 else 0
                
                results.append({
                    "ticker": ticker,
                    "price_start": price_start,
                    "price_end": price_end,
                    "shares": shares,
                    "initial_value": allocation_per_ticker,
                    "final_value": final_value,
                    "return_pct": return_pct
                })
                total_final_value += final_value
            except Exception as e:
                results.append({
                    "ticker": ticker,
                    "error": str(e)
                })
                
        total_return_pct = (total_final_value - initial_capital) / initial_capital
        
        return {
            "summary": {
                "initial_capital": initial_capital,
                "final_value": total_final_value,
                "total_return_pct": total_return_pct,
                "start_date": actual_start_date.strftime('%Y-%m-%d'),
                "end_date": actual_end_date.strftime('%Y-%m-%d')
            },
            "tickers": results
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8002, reload=True)
