import pandas as pd
import numpy as np
from datetime import datetime

class PortfolioReplayer:
    def __init__(self, transactions: list, price_data: pd.DataFrame, currency_data: pd.DataFrame = None):
        self.transactions = transactions
        self.price_data = price_data
        self.currency_data = currency_data
        self.history = []
        
    def calculate_history(self):
        if not self.transactions or self.price_data is None or self.price_data.empty:
            return None

        # 1. Prepare transactions
        sorted_tx = sorted(self.transactions, key=lambda x: x['date'])
        if not sorted_tx:
            return None
            
        start_date = pd.to_datetime(sorted_tx[0]['date']).normalize()
        # Limit simulation to available price data
        price_end_date = self.price_data.index.max()
        end_date = price_end_date
        
        if start_date > end_date:
            return None
        
        # 2. Initialize state
        cash = 0.0
        # Holdings: {ticker: {'qty': float, 'currency': str, 'total_cost': float}}
        holdings = {} 
        
        tx_by_date = {}
        for t in sorted_tx:
            d = pd.to_datetime(t['date']).normalize()
            if d not in tx_by_date:
                tx_by_date[d] = []
            tx_by_date[d].append(t)
            
        history_records = []
        
        full_date_range = pd.date_range(start=start_date, end=end_date, freq='D')
        
        # Helper to get price from row
        def get_prices_from_row(row):
            p = {}
            if isinstance(self.price_data.columns, pd.MultiIndex):
                for col in self.price_data.columns:
                    if len(col) == 2:
                        if col[1] == 'Close':
                             p[col[0]] = row[col]
                        elif col[0] == 'Close':
                             p[col[1]] = row[col]
            else:
                # If flat CSV (e.g. minimal download), assume columns are tickers
                # But data_loader usually standardizes to MultiIndex if multiple, or we need to be careful.
                # Assuming safe dictionary usage
                pass
            return p

        # Helper to get currency rate
        def get_exchange_rate(target_currency, date_idx):
            if target_currency == 'PLN':
                return 1.0
            
            if self.currency_data is None:
                # Fallback if no currency data: assume 1:1 or error? 
                # User asked to use currency data. If missing, 1.0 is safest fallback to avoid crash
                return 1.0
                
            # Try to start from 'current_date' or last available
            # We want Rate(Foreign -> PLN). e.g. USDPLN=X
            ticker = f"{target_currency}PLN=X"
            
            # Check availability
            # We need to find the specific rate for this date
            # Optimization: could cache "last known rates" globally in the loop
            pass # logic moved to loop for efficiency
            return 1.0

        last_known_prices = {} 
        last_known_rates = {} # {currency: rate_to_PLN}

        # Pre-fill prices/rates if starting late (rare)
        if start_date > price_end_date:
             # Should not happen due to check above
             pass
        
        last_month = None
        month_start_value = 0.0
        prev_total_value = 0.0
        
        for current_date in full_date_range:
            # ... (Prices and Rates updates remain same) ...
            # 1. Update Prices
            if current_date in self.price_data.index:
                row = self.price_data.loc[current_date]
                current_prices = get_prices_from_row(row)
                for t, p in current_prices.items():
                   if pd.notna(p):
                       last_known_prices[t] = p
            
            # 2. Update Rates
            if self.currency_data is not None and current_date in self.currency_data.index:
                curr_row = self.currency_data.loc[current_date]
                for ticker, rate in curr_row.items():
                    if pd.notna(rate):
                        if 'PLN=X' in ticker:
                            code = ticker.replace('PLN=X', '')
                            last_known_rates[code] = rate

            # 3. Apply Transactions
            if current_date in tx_by_date:
                # ... (Transaction logic remains same) ...
                for tx in tx_by_date[current_date]:
                    t_type = tx.get('type')
                    t_amount = tx.get('amount_pln')
                    t_qty = tx.get('quantity') or 0.0
                    t_price = tx.get('price') or 0.0 
                    t_fee = tx.get('fee_pln') or 0.0
                    t_ticker = tx.get('ticker')
                    t_currency = tx.get('currency') or 'PLN' 
                    
                    if t_type == 'DEPOSIT':
                        cash += (t_amount or 0.0)
                    elif t_type == 'BUY':
                        cost = (t_qty * t_price) + t_fee
                        cash -= cost
                        if t_ticker not in holdings:
                            holdings[t_ticker] = {'qty': 0.0, 'currency': t_currency, 'total_cost': 0.0}
                        holdings[t_ticker]['qty'] += t_qty
                        holdings[t_ticker]['total_cost'] += cost # Add to cost basis
                        holdings[t_ticker]['currency'] = t_currency
                    elif t_type == 'SELL':
                        revenue = (t_qty * t_price)
                        cash += (revenue - t_fee)
                        if t_ticker in holdings:
                            # Reduce cost basis proportionally
                            current_qty = holdings[t_ticker]['qty']
                            if current_qty > 0:
                                cost_portion = (t_qty / current_qty) * holdings[t_ticker]['total_cost']
                                holdings[t_ticker]['total_cost'] -= cost_portion
                            
                            holdings[t_ticker]['qty'] -= t_qty
                            if holdings[t_ticker]['qty'] <= 1e-9:
                                del holdings[t_ticker]

            # 4. Calculate Valuation
            holdings_value = 0.0
            daily_details = []
            
            for ticker, data in holdings.items():
                qty = data['qty']
                asset_currency = data['currency']
                raw_price = last_known_prices.get(ticker, 0.0)
                
                if asset_currency == 'GBP':
                    raw_price = raw_price / 100.0
                
                rate = 1.0
                if asset_currency != 'PLN':
                    rate = last_known_rates.get(asset_currency, 1.0)
                    
                val = qty * raw_price * rate
                holdings_value += val
                
                # Calculate P&L
                total_cost = data.get('total_cost', 0.0)
                avg_price_pln = total_cost / qty if qty > 0 else 0.0
                return_pct = ((val - total_cost) / total_cost) if total_cost > 0 else 0.0

                daily_details.append({
                    "ticker": ticker,
                    "shares": qty,
                    "price_native": raw_price,
                    "currency": asset_currency,
                    "price_pln": raw_price * rate,
                    "value_pln": val,
                    "return_pct": return_pct,
                    "avg_price_pln": avg_price_pln,
                    "total_cost": total_cost  # Export for intraday recalculation
                })
                
            total_value = cash + holdings_value
            
            # MTD Calculation
            current_month = current_date.month
            if last_month is None:
                # First day of simulation
                month_start_value = total_value
            elif current_month != last_month:
                # New month started, base is previous day (end of last month)
                month_start_value = prev_total_value
                
            mtd_return = 0.0
            if month_start_value > 0:
                mtd_return = (total_value - month_start_value) / month_start_value
            
            # Update state for next day
            last_month = current_month
            prev_total_value = total_value

            history_records.append({
                "date": current_date,
                "total_value": total_value,
                "cash": cash,
                "holdings_value": holdings_value,
                "details": daily_details,
                "mtd_return": mtd_return
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
        monthly_returns_dict = {k.strftime('%Y-%m'): v for k, v in monthly_returns.items()}
        
        # Format history for frontend
        formatted_history = [
            {
                "date": index.strftime('%Y-%m-%d'),
                "total_value": row['total_value'],
                "cash": row['cash'],
                "holdings_value": row['holdings_value'],
                "details": row['details'],
                "mtd_return": row['mtd_return']
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
