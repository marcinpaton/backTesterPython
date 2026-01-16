import pandas as pd
import numpy as np
from datetime import datetime

class PortfolioReplayer:
    def __init__(self, transactions: list, price_data: pd.DataFrame):
        self.transactions = transactions
        self.price_data = price_data
        self.history = []
        
    def calculate_history(self):
        if not self.transactions or self.price_data is None or self.price_data.empty:
            return None

        # 1. Prepare transactions
        sorted_tx = sorted(self.transactions, key=lambda x: x['date'])
        if not sorted_tx:
            return None
            
        start_date = pd.to_datetime(sorted_tx[0]['date']).normalize()
        tx_end_date = pd.to_datetime(sorted_tx[-1]['date']).normalize()
        price_end_date = self.price_data.index.max()
        
        # Limit simulation strictly to available price data as requested
        end_date = price_end_date
        
        if start_date > end_date:
            # All transactions are in the future relative to data
            return None
        
        # 2. Initialize state
        cash = 0.0
        holdings = {} # {ticker: quantity}
        
        tx_by_date = {}
        for t in sorted_tx:
            d = pd.to_datetime(t['date']).normalize()
            if d not in tx_by_date:
                tx_by_date[d] = []
            tx_by_date[d].append(t)
            
        history_records = []
        
        full_date_range = pd.date_range(start=start_date, end=end_date, freq='D')
        
        # Initialize last known prices efficiently
        # If start_date > price_end_date, we need the VERY LAST prices from data
        # If start_date is within range, we just start empty and fill as we go?
        # Better: Get the row at or before start_date.
        last_known_prices = {} 
        
        # Find latest index <= start_date (or just last index if start > last)
        init_price_idx = self.price_data.index.asof(start_date)
        if pd.isna(init_price_idx):
             # start_date is before ANY data.
             # If start_date is after all data? asof returns last index.
             # Wait, asof returns NaN if label is before first index.
             # If label is after last index, it returns last index.
             pass
        else:
            # Initialize with prices at that date
            try:
                # Handle MultiIndex vs Single
                row = self.price_data.loc[init_price_idx]
                # If MultiIndex with (Ticker, OHLCV) or (OHLCV, Ticker)
                # We assume we can iterate.
                # Simplest hack: iterate columns.
                # But let's stick to the structure we observed or loop during day.
                # Actually, strictly speaking, we can just rely on the loop updating prices 
                # IF the loop covers the price_data.
                # But if start_date > price_end_date, the loop (start..end) will NOT cover any price_data indices.
                # So we must pre-fill.
                pass
            except Exception:
                pass

        # We need a function to extract prices from a row regardless of schema
        def get_prices_from_row(row):
            p = {}
            # Check if MultiIndex
            if isinstance(self.price_data.columns, pd.MultiIndex):
                # Try (Ticker, 'Close')
                for col in self.price_data.columns:
                    # col is (Ticker, Type) or (Type, Ticker)
                    # We don't know order.
                    # Usually yfinance is (Attrib, Ticker) or (Ticker, Attrib) depending on version/args.
                    # data_loader uses group_by='ticker' -> (Ticker, Attrib).
                    # check col[1] == 'Close'
                    if len(col) == 2:
                        if col[1] == 'Close':
                             p[col[0]] = row[col]
                        elif col[0] == 'Close':
                             p[col[1]] = row[col]
            else:
                # Flat columns? maybe just Ticker names (if just Close prices)
                # But data_loader suggests all OHLCV.
                pass
            return p

        # Pre-fill if we are starting late
        if start_date > price_end_date:
             last_row = self.price_data.iloc[-1]
             last_known_prices = get_prices_from_row(last_row)
        
        for current_date in full_date_range:
            # 1. Update prices if available (Trading Day)
            if current_date in self.price_data.index:
                row = self.price_data.loc[current_date]
                # Update last known prices with current day prices
                current_prices = get_prices_from_row(row)
                # Only update if valid (not NaN)
                for t, p in current_prices.items():
                   if pd.notna(p):
                       last_known_prices[t] = p
            
            # To get prices efficiently, let's look at the price_data row
            # We need to withstand potential missing data
            
            # 2. Apply Transactions
            # We apply them at the START of the day (or end, doesn't matter much for daily resolution, usually start or mixed)
            if current_date in tx_by_date:
                for tx in tx_by_date[current_date]:
                    t_type = tx.get('type')
                    t_amount = tx.get('amount_pln')
                    
                    # Convert None to 0
                    t_qty = tx.get('quantity') or 0.0
                    t_price = tx.get('price') or 0.0 # Price in PLN (entered by user)
                    t_fee = tx.get('fee_pln') or 0.0
                    t_ticker = tx.get('ticker')
                    
                    if t_type == 'DEPOSIT':
                        cash += (t_amount or 0.0)
                    elif t_type == 'BUY':
                        cost = (t_qty * t_price) + t_fee
                        cash -= cost
                        
                        # Calculate implicit ratio to handle currency/unit differences
                        # ratio = price_paid_PLN / price_in_csv
                        # If we have no CSV price, assume 1.0 (best effort)
                        csv_price = last_known_prices.get(t_ticker)
                        ratio = 1.0
                        if csv_price and csv_price > 0:
                            ratio = t_price / csv_price
                        
                        if t_ticker not in holdings:
                            holdings[t_ticker] = {'raw_qty': 0.0, 'normalized_qty': 0.0}
                            
                        holdings[t_ticker]['raw_qty'] += t_qty
                        holdings[t_ticker]['normalized_qty'] += (t_qty * ratio)
                        
                    elif t_type == 'SELL':
                        revenue = (t_qty * t_price)
                        cash += (revenue - t_fee)
                        
                        if t_ticker in holdings:
                            # Reduce proportionally
                            current_raw = holdings[t_ticker]['raw_qty']
                            if current_raw > 0:
                                fraction = t_qty / current_raw
                                # Cap at 1.0 to avoid precision errors
                                fraction = min(fraction, 1.0)
                                
                                holdings[t_ticker]['raw_qty'] -= t_qty
                                holdings[t_ticker]['normalized_qty'] -= (holdings[t_ticker]['normalized_qty'] * fraction)
                                
                                if holdings[t_ticker]['raw_qty'] <= 1e-9:
                                    del holdings[t_ticker]
                            else:
                                del holdings[t_ticker] # Should not happen

            # 3. Calculate Valuation
            # We need price for each holding.
            # If current_date is in price_data, update last_known_prices
            # 1. Update prices if available (Trading Day)
            if current_date in self.price_data.index:
                row = self.price_data.loc[current_date]
                # Update last known prices with current day prices
                current_prices = get_prices_from_row(row)
                # Only update if valid (not NaN)
                for t, p in current_prices.items():
                   if pd.notna(p):
                       last_known_prices[t] = p
            
            holdings_value = 0.0
            for ticker, data in holdings.items():
                price = last_known_prices.get(ticker, 0.0)
                # Value = normalized_qty (which represents "units of CSV price") * CSV price
                holdings_value += data['normalized_qty'] * price
                
            total_value = cash + holdings_value
            
            # Only record history if we actually have data (usually trading days)
            # Or record every day? Recharts handles gaps nicely or requires continuous data.
            # Let's record daily to show flat lines on weekends.
            
            history_records.append({
                "date": current_date,
                "total_value": total_value,
                "cash": cash,
                "holdings_value": holdings_value
            })
            
        return self._generate_metrics(history_records)

    def _generate_metrics(self, history):
        if not history:
            return {}
            
        df = pd.DataFrame(history)
        df.set_index('date', inplace=True)
        
        # Calculate returns
        df['daily_return'] = df['total_value'].pct_change().fillna(0.0)
        
        # Total Return
        start_val = df['total_value'].iloc[0]
        end_val = df['total_value'].iloc[-1]
        total_return = (end_val - start_val) / start_val if start_val > 0 else 0.0
        
        # CAGR
        days = (df.index[-1] - df.index[0]).days
        years = days / 365.25
        cagr = ((end_val / start_val) ** (1/years) - 1) if (start_val > 0 and years > 0) else 0.0
        
        # Max Drawdown
        running_max = df['total_value'].cummax()
        drawdown = (df['total_value'] - running_max) / running_max
        max_drawdown = drawdown.min()
        
        # Monthly Returns
        monthly_returns = df['total_value'].resample('M').last().pct_change().fillna(0.0)
        # Fix first month return: (End - Start) / Start
        # The resample pct_change compares end of this month vs end of last month.
        # Only correct if we had full history.
        # Let's ignore first partial month precision for now or fix it.
        # Actually resample('M').last() gives values at end of months.
        monthly_returns_dict = {k.strftime('%Y-%m'): v for k, v in monthly_returns.items()}
        
        # Format history for frontend
        formatted_history = [
            {
                "date": index.strftime('%Y-%m-%d'),
                "total_value": row['total_value'],
                "cash": row['cash'],
                "holdings_value": row['holdings_value']
            }
            for index, row in df.iterrows()
        ]
        
        return {
            "total_return": total_return,
            "cagr": cagr,
            "max_drawdown": max_drawdown,
            "final_value": end_val,
            "monthly_returns": monthly_returns_dict,
            "history": formatted_history,
             # Frontend expects rebalance_history, provide empty list or derive if needed
            "rebalance_history": [] 
        }
