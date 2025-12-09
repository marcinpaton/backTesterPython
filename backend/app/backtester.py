from __future__ import annotations
import pandas as pd
import numpy as np
from datetime import datetime
from app.strategies import Strategy

class Portfolio:
    def __init__(self, initial_capital: float, transaction_fee_enabled: bool = False, transaction_fee_type: str = 'percentage', transaction_fee_value: float = 0.0, capital_gains_tax_enabled: bool = False, capital_gains_tax_pct: float = 0.0, margin_enabled: bool = True, sizing_method: str = 'equal'):
        self.initial_capital = initial_capital
        self.cash = initial_capital
        self.holdings = {} # {ticker: quantity}
        self.cost_basis = {} # {ticker: total_cost}
        self.entry_prices = {} # {ticker: price_per_share}
        self.history = [] # List of {date, total_value, cash, holdings_value}
        self.rebalance_history = [] # List of {date, sold_pnl, new_tickers}
        self.transaction_fee_enabled = transaction_fee_enabled
        self.transaction_fee_type = transaction_fee_type
        self.transaction_fee_value = transaction_fee_value
        self.capital_gains_tax_enabled = capital_gains_tax_enabled
        self.capital_gains_tax_pct = capital_gains_tax_pct
        self.annual_realized_pnl = 0.0  # Track annual profit/loss for tax settlement
        self.annual_realized_pnl = 0.0  # Track annual profit/loss for tax settlement
        self.loss_carryforward = []  # List of (year, remaining_loss) tuples for tax loss carryforward
        self.margin_interest_rate_annual = 0.03 # 3% annual interest on negative cash balance
        self.margin_enabled = margin_enabled
        self.sizing_method = sizing_method

    def get_total_value(self, current_prices: dict) -> float:
        holdings_value = sum(self.holdings.get(t, 0) * p for t, p in current_prices.items() if t in self.holdings)
        return self.cash + holdings_value

    def sell_ticker(self, ticker, price, date, reason="rebalance"):
        if ticker not in self.holdings:
            return None
            
        quantity = self.holdings[ticker]
        revenue = quantity * price
        
        # Calculate fee
        fee = 0.0
        if self.transaction_fee_enabled:
            if self.transaction_fee_type == 'percentage':
                fee = revenue * (self.transaction_fee_value / 100)
            else:  # fixed
                fee = self.transaction_fee_value
        
        # Calculate PnL (net profit after fee)
        cost = self.cost_basis.get(ticker, 0)
        pnl = revenue - cost - fee
        pnl_percent = (pnl / cost) if cost > 0 else 0
        
        # Accumulate net profit for annual tax settlement
        if self.capital_gains_tax_enabled:
            self.annual_realized_pnl += pnl
        
        sold_record = {
            "revenue": revenue,
            "profit": pnl,
            "return_pct": pnl_percent,
            "fee": fee
        }

        self.cash += (revenue - fee)
        del self.holdings[ticker]
        del self.cost_basis[ticker]
        if ticker in self.entry_prices:
            del self.entry_prices[ticker]
            
        return sold_record

    def buy_ticker(self, ticker, amount, price, score, date, var=None):
        if price <= 0: return None
        
        # Calculate quantity (whole shares only)
        # Margin Trading: Buy 1 extra share beyond what cash allows IF enabled
        if self.margin_enabled:
            quantity = int(amount // price) + 1
        else:
            quantity = int(amount // price)
        
        if quantity <= 0: # Should be at least 1 now, but safe check
            return None

        # Recalculate actual cost based on whole shares
        actual_cost = quantity * price

        # Recalculate fee based on actual cost
        fee = 0.0
        if self.transaction_fee_enabled:
            if self.transaction_fee_type == 'percentage':
                fee = actual_cost * (self.transaction_fee_value / 100)
            else:  # fixed
                fee = self.transaction_fee_value
        
        # Check if we have enough cash (cost + fee)
        # Note: 'amount' was the target allocation, but we might need slightly less or more depending on fee calculation order.
        # Here we assume 'amount' was the max we wanted to spend including fee? 
        # Or 'amount' is raw capital allocation. 
        # Let's stick to: we spend 'actual_cost' + 'fee'.
        
        self.holdings[ticker] = quantity
        self.cost_basis[ticker] = actual_cost
        self.entry_prices[ticker] = price
        self.cash -= (actual_cost + fee)
        
        return {
            "ticker": ticker,
            "quantity": quantity,
            "price": price,
            "score": score,
            "fee": fee,
            "var": var
        }

    def settle_annual_tax(self, date):
        """
        Settle annual capital gains tax in January with loss carryforward.
        Losses can be carried forward for 5 years, max 50% deductible per year.
        """
        if not self.capital_gains_tax_enabled:
            return
        
        current_year = date.year
        tax = 0.0
        taxable_profit = self.annual_realized_pnl
        loss_deductions_applied = []
        
        # Clean up expired losses (older than 5 years)
        self.loss_carryforward = [(year, loss) for year, loss in self.loss_carryforward if current_year - year < 5]
        
        # If we have a loss this year, add it to carryforward
        if self.annual_realized_pnl < 0:
            self.loss_carryforward.append((current_year, abs(self.annual_realized_pnl)))
        
        # If we have profit, apply loss carryforward (max 50% of each loss)
        elif self.annual_realized_pnl > 0 and self.loss_carryforward:
            remaining_profit = self.annual_realized_pnl
            updated_losses = []
            
            for loss_year, loss_amount in self.loss_carryforward:
                if remaining_profit <= 0:
                    # No more profit to offset, keep the loss for future
                    updated_losses.append((loss_year, loss_amount))
                else:
                    # Can deduct max 50% of this loss
                    max_deduction = loss_amount * 0.5
                    actual_deduction = min(max_deduction, remaining_profit)
                    
                    loss_deductions_applied.append({
                        "year": loss_year,
                        "original_loss": loss_amount,
                        "deduction": actual_deduction
                    })
                    
                    remaining_profit -= actual_deduction
                    remaining_loss = loss_amount - actual_deduction
                    
                    if remaining_loss > 0.01:  # Keep losses > 1 cent
                        updated_losses.append((loss_year, remaining_loss))
            
            self.loss_carryforward = updated_losses
            taxable_profit = remaining_profit
        
        # Calculate tax on taxable profit (after loss deductions)
        if taxable_profit > 0:
            tax = taxable_profit * (self.capital_gains_tax_pct / 100)
            self.cash -= tax
        
        # Record tax settlement
        if tax > 0 or self.annual_realized_pnl != 0 or loss_deductions_applied:
            self.rebalance_history.append({
                "date": date,
                "type": "tax_settlement",
                "annual_pnl": self.annual_realized_pnl,
                "taxable_profit": taxable_profit,
                "loss_deductions": loss_deductions_applied,
                "remaining_losses": [(y, l) for y, l in self.loss_carryforward],
                "tax": tax,
                "sold": {},
                "bought": [],
                "cash": float(self.cash)
            })
        
        # Reset annual P&L for new year
        self.annual_realized_pnl = 0.0

    def get_stop_loss_candidates(self, trigger_prices: dict, stop_loss_pct: float) -> list[str]:
        if stop_loss_pct is None:
            return []

        candidates = []
        for ticker, quantity in self.holdings.items():
            # Check condition using trigger_prices (Previous Day Close)
            if ticker in trigger_prices and not pd.isna(trigger_prices[ticker]):
                trigger_price = trigger_prices[ticker]
                entry_price = self.entry_prices.get(ticker, 0)
                
                # Stop Loss Condition: Trigger Price < Entry Price * (1 - SL%)
                if entry_price > 0 and trigger_price < entry_price * (1 - stop_loss_pct):
                    candidates.append(ticker)
        return candidates

    def rebalance(self, target_tickers_with_scores: list[tuple[str, float]], current_prices: dict, date, var_map: dict = None):
        sold_performance = {}
        
        target_tickers = [t for t, s in target_tickers_with_scores]
        target_tickers_set = set(target_tickers)
        scores_map = {t: s for t, s in target_tickers_with_scores}
        
        # 1. Sell ONLY tickers that are NOT in the new target list
        for ticker in list(self.holdings.keys()):
            if ticker not in target_tickers_set:
                if ticker in current_prices and not pd.isna(current_prices[ticker]):
                    price = current_prices[ticker]
                    record = self.sell_ticker(ticker, price, date, reason="rebalance")
                    if record:
                        sold_performance[ticker] = record
        
        # 2. Buy ONLY tickers that we don't own yet (from the target list)
        bought_performance = []
        tickers_to_buy = [t for t in target_tickers if t not in self.holdings]
        
        if tickers_to_buy:
             # Allocate available cash (including recent sales) among new buys
             
            if self.sizing_method == 'var' and var_map:
                # Risk Parity: Allocation proportional to 1 / |VaR|
                # Calculate weights
                inverse_vars = {}
                total_inverse_var = 0.0
                
                for ticker in tickers_to_buy:
                    # Default to a small risk if VaR is missing or 0 to avoid division by zero
                    # If VaR is -0.05 (5%), absolute is 0.05.
                    if ticker in var_map and var_map[ticker] is not None and abs(var_map[ticker]) > 0.0001:
                        inv_var = 1.0 / abs(var_map[ticker])
                    else:
                        # Fallback for missing/zero VaR: Assume it's average or high risk?
                        # Let's give it median weight or equal weight equivalent?
                        # For safety, let's treat it as "Average Risk" -> imply some default VaR e.g. 5%
                        inv_var = 1.0 / 0.05 
                    
                    inverse_vars[ticker] = inv_var
                    total_inverse_var += inv_var
                
                if total_inverse_var > 0:
                     allocations = {t: (self.cash * (inv / total_inverse_var)) for t, inv in inverse_vars.items()}
                else:
                     # Fallback to equal
                     allocations = {t: self.cash / len(tickers_to_buy) for t in tickers_to_buy}
                     
            else:
                # Equal Weighting
                allocations = {t: self.cash / len(tickers_to_buy) for t in tickers_to_buy}
            
            for ticker in tickers_to_buy:
                if ticker in current_prices and not pd.isna(current_prices[ticker]):
                    price = current_prices[ticker]
                    # Get allocation for this ticker
                    allocation = allocations.get(ticker, 0.0)
                    
                    buy_record = self.buy_ticker(ticker, allocation, price, scores_map.get(ticker, 0.0), date, var=(var_map.get(ticker) if var_map else None))
                    if buy_record:
                        bought_performance.append(buy_record)

        self.rebalance_history.append({
            "date": date,
            "type": "rebalance",
            "sold": sold_performance,
            "bought": bought_performance,
            "cash": float(self.cash)
        })

    def record_history(self, date, current_prices):
        total_value = self.get_total_value(current_prices)
        self.history.append({
            "date": date,
            "total_value": total_value,
            "cash": self.cash
        })

    def apply_daily_interest(self):
        """
        Apply daily interest if cash balance is negative (margin loan).
        Interest is 3% annually.
        """
        if self.margin_enabled and self.cash < 0:
            daily_rate = self.margin_interest_rate_annual / 365.25
            interest = abs(self.cash) * daily_rate
            self.cash -= interest

def run_backtest(strategy: Strategy, data: pd.DataFrame, initial_capital: float, start_date: str, end_date: str, stop_loss_pct: float = None, smart_stop_loss: bool = False, transaction_fee_enabled: bool = False, transaction_fee_type: str = 'percentage', transaction_fee_value: float = 0.0, capital_gains_tax_enabled: bool = False, capital_gains_tax_pct: float = 0.0, margin_enabled: bool = True, sizing_method: str = 'equal'):
    # Preprocessing to get Close prices only
    if isinstance(data.columns, pd.MultiIndex):
        try:
            close_prices = data.xs('Close', level=1, axis=1)
        except KeyError:
            try:
                close_prices = data['Close']
            except KeyError:
                 raise ValueError("Could not find 'Close' prices in data")
    else:
        close_prices = data
    
    # Keep full history for VaR calculation
    full_close_prices = close_prices.copy()

    close_prices = close_prices.loc[start_date:end_date]
    
    print(f"Starting backtest from {start_date} to {end_date} with initial capital {initial_capital}")
    if stop_loss_pct:
        print(f"Stop Loss enabled: {stop_loss_pct*100}% (Smart: {smart_stop_loss})")
    if transaction_fee_enabled:
        print(f"Transaction Fee enabled: {transaction_fee_value}{'%' if transaction_fee_type == 'percentage' else ' (fixed)'}")
    if capital_gains_tax_enabled:
        print(f"Capital Gains Tax enabled: {capital_gains_tax_pct}%")
    
        print(f"Capital Gains Tax enabled: {capital_gains_tax_pct}%")
    print(f"Margin Trading enabled: {margin_enabled}")
    
    portfolio = Portfolio(initial_capital, transaction_fee_enabled, transaction_fee_type, transaction_fee_value, capital_gains_tax_enabled, capital_gains_tax_pct, margin_enabled, sizing_method)
    last_rebalance_date = None
    prev_prices = None
    
    for date, prices in close_prices.iterrows():
        current_prices = prices.to_dict()
        
        # Check Stop Loss (using previous day's close as trigger)
        if stop_loss_pct and prev_prices:
             candidates = portfolio.get_stop_loss_candidates(prev_prices, stop_loss_pct)
             
             if candidates:
                 # If smart SL, we need strategy top tickers
                 top_tickers_with_scores = []
                 top_tickers_set = set()
                 if smart_stop_loss:
                     available_tickers = [t for t, p in current_prices.items() if not pd.isna(p)]
                     top_tickers_with_scores = strategy.select_tickers(available_tickers, date)
                     top_tickers_set = {t for t, s in top_tickers_with_scores}
                 
                 sold_performance = {}
                 bought_performance = []
                 
                 for ticker in candidates:
                     should_sell = True
                     if smart_stop_loss:
                         if ticker in top_tickers_set:
                             should_sell = False
                             # print(f"Smart SL: Holding {ticker} despite drop")
                     
                     if should_sell:
                         # Execute sell
                         if ticker in current_prices and not pd.isna(current_prices[ticker]):
                             price = current_prices[ticker]
                             record = portfolio.sell_ticker(ticker, price, date, reason="stop_loss")
                             if record:
                                 sold_performance[ticker] = record
                                 
                                 # Smart SL: Buy replacement
                                 if smart_stop_loss:
                                     # Find best ticker from top_tickers that we don't own
                                     replacement = None
                                     replacement_score = 0
                                     for t, s in top_tickers_with_scores:
                                         if t not in portfolio.holdings and t != ticker:
                                             replacement = t
                                             replacement_score = s
                                             break
                                     
                                     if replacement and replacement in current_prices:
                                         buy_amount = record['revenue']
                                         buy_price = current_prices[replacement]
                                         buy_record = portfolio.buy_ticker(replacement, buy_amount, buy_price, replacement_score, date)
                                         if buy_record:
                                             bought_performance.append(buy_record)

                 if sold_performance or bought_performance:
                     portfolio.rebalance_history.append({
                         "date": date,
                         "type": "stop_loss_smart" if smart_stop_loss else "stop_loss",
                         "sold": sold_performance,
                         "bought": bought_performance,
                         "cash": float(portfolio.cash)
                     })
        
        # Settle annual tax in January (before rebalancing)
        if capital_gains_tax_enabled and date.month == 1:
            # Only settle once per year (check if we haven't settled yet this year)
            # We check if last_rebalance_date is None or from previous year
            if last_rebalance_date is None or last_rebalance_date.year < date.year:
                annual_pnl = portfolio.annual_realized_pnl
                portfolio.settle_annual_tax(date)
                print(f"[{date.date()}] Annual tax settlement: PnL={annual_pnl:.2f}, Tax enabled={capital_gains_tax_enabled}")
        
        if strategy.should_rebalance(date, last_rebalance_date):
            print(f"[{date.date()}] Rebalancing...")
            available_tickers = [t for t, p in current_prices.items() if not pd.isna(p)]
            target_tickers_with_scores = strategy.select_tickers(available_tickers, date)
            print(f"  Target tickers: {target_tickers_with_scores}")
            # Calculate VaR for target tickers
            var_map = {}
            lookback_days = 252
            
            # Get historical data up to this date (exclusive of today for calculation? or inclusive?)
            # Usually VaR is calculated on past returns.
            # We use data up to 'date'.
            
            # Optimization: Pre-calculate or slice efficiently
            # We need ~252 rows ending at 'date'
            
            # Find integer location of current date in full_close_prices
            if date in full_close_prices.index:
                current_loc = full_close_prices.index.get_loc(date)
                start_loc = max(0, current_loc - lookback_days)
                # Slice: start_loc to current_loc (inclusive or exclusive?)
                # We want past 252 days.
                history_window = full_close_prices.iloc[start_loc : current_loc + 1]
                
                for ticker, _ in target_tickers_with_scores:
                    if ticker in history_window.columns:
                        series = history_window[ticker].dropna()
                        if len(series) > 1:
                            returns = series.pct_change().dropna()
                            if not returns.empty:
                                # 95% Confidence VaR (5th percentile)
                                var_95 = np.percentile(returns, 5)
                                var_map[ticker] = var_95

            portfolio.rebalance(target_tickers_with_scores, current_prices, date, var_map)
            last_rebalance_date = date
            print(f"  Portfolio Value: {portfolio.get_total_value(current_prices):.2f}")
        
        portfolio.apply_daily_interest()
        portfolio.record_history(date, current_prices)
        prev_prices = current_prices
        
    print("Backtest completed.")
    return portfolio

def calculate_metrics(portfolio: Portfolio):
    history_df = pd.DataFrame(portfolio.history)
    if history_df.empty:
        return {}
    
    # Ensure date is datetime
    history_df['date'] = pd.to_datetime(history_df['date'])
    history_df.set_index('date', inplace=True)
    
    # Daily returns
    history_df['daily_return'] = history_df['total_value'].pct_change()
    
    # Total Return
    start_value = history_df['total_value'].iloc[0]
    end_value = history_df['total_value'].iloc[-1]
    total_return = (end_value - start_value) / start_value
    
    # CAGR
    days = (history_df.index[-1] - history_df.index[0]).days
    years = days / 365.25
    if years > 0:
        cagr = (end_value / start_value) ** (1 / years) - 1
    else:
        cagr = 0
        
    # Max Drawdown
    running_max = history_df['total_value'].cummax()
    drawdown = (history_df['total_value'] - running_max) / running_max
    max_drawdown = drawdown.min()
        
    # Monthly Returns
    monthly_returns = history_df['daily_return'].resample('M').apply(lambda x: (1 + x).prod() - 1)
    
    # Format monthly returns for easier JSON serialization
    monthly_returns_dict = {k.strftime('%Y-%m'): float(v) for k, v in monthly_returns.items()}
    
    # Sanitize history for JSON
    history_records = history_df.reset_index().to_dict(orient='records')
    for record in history_records:
        for k, v in record.items():
            if pd.isna(v):
                record[k] = None
            elif isinstance(v, pd.Timestamp):
                record[k] = v.strftime('%Y-%m-%d')
            elif hasattr(v, 'item'): # Handle numpy types
                record[k] = v.item()

    return {
        "total_return": float(total_return),
        "cagr": float(cagr),
        "max_drawdown": float(max_drawdown),
        "final_value": float(end_value),
        "monthly_returns": monthly_returns_dict,
        "history": history_records,
        "rebalance_history": [
            {
                **r,
                "date": r["date"].strftime('%Y-%m-%d'),
                "type": r.get("type", "rebalance"),
            } for r in portfolio.rebalance_history
        ]
    }
