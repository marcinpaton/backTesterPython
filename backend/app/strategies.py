from __future__ import annotations
from abc import ABC, abstractmethod
import random
from datetime import datetime, timedelta
import pandas as pd

class Strategy(ABC):
    @abstractmethod
    def select_tickers(self, available_tickers: list[str], current_date: datetime) -> list[tuple[str, float]]:
        pass

    @abstractmethod
    def should_rebalance(self, current_date: datetime, last_rebalance_date: datetime) -> bool:
        pass

class RandomSelectionStrategy(Strategy):
    def __init__(self, n_tickers: int, rebalance_period: int, rebalance_period_unit: str):
        self.n_tickers = n_tickers
        self.rebalance_period = rebalance_period
        self.rebalance_period_unit = rebalance_period_unit

    def select_tickers(self, available_tickers: list[str], current_date: datetime) -> list[tuple[str, float]]:
        # Simple random selection
        if len(available_tickers) <= self.n_tickers:
            return [(t, 0.0) for t in available_tickers]
        selected = random.sample(available_tickers, self.n_tickers)
        return [(t, 0.0) for t in selected]

    def should_rebalance(self, current_date: datetime, last_rebalance_date: datetime) -> bool:
        if last_rebalance_date is None:
            return True
        
        days_diff = (current_date - last_rebalance_date).days
        
        if self.rebalance_period_unit == 'days':
            return days_diff >= self.rebalance_period
        elif self.rebalance_period_unit == 'weeks':
            return days_diff >= (self.rebalance_period * 7)
        elif self.rebalance_period_unit == 'months':
            return days_diff >= (self.rebalance_period * 30)
        else:
            # Default to months if unknown
            return days_diff >= (self.rebalance_period * 30)

class MomentumStrategy(Strategy):
    def __init__(self, n_tickers: int, rebalance_period: int, rebalance_period_unit: str, data: pd.DataFrame, lookback_days: int = 30, filter_negative_momentum: bool = False):
        self.n_tickers = n_tickers
        self.rebalance_period = rebalance_period
        self.rebalance_period_unit = rebalance_period_unit
        self.data = data
        self.lookback_days = lookback_days
        self.filter_negative_momentum = filter_negative_momentum
        self.close_prices = self._get_close_prices(data)

    def _get_close_prices(self, data: pd.DataFrame) -> pd.DataFrame:
        # Helper to extract Close prices
        if isinstance(data.columns, pd.MultiIndex):
            try:
                return data.xs('Close', level=1, axis=1)
            except KeyError:
                try:
                    return data['Close']
                except KeyError:
                     return data # Assume it's already close prices or handle error
        else:
            return data

    def get_detailed_momentum(self, available_tickers: list[str], current_date: datetime) -> list[dict]:
        """
        Calculate momentum and return detailed stats (start/end dates, prices).
        Uses exact "trading days" lookback by selecting the N-th valid price backwards.
        """
        # Get data slice up to current_date
        # Note: loc[:date] includes the date if present
        slice_current = self.close_prices.loc[:current_date]
        
        if slice_current.empty:
            return []
            
        detailed_scores = []
        for ticker in available_tickers:
            if ticker not in self.close_prices.columns:
                continue
            
            try:
                # Get valid prices for this ticker up to current_date
                # dropna() ensures we only count actual trading days for this specific ticker
                ticker_prices = slice_current[ticker].dropna()
                
                # Check if we have enough history
                # We need lookback_days amount of history BEFORE the current price
                # So total length must be at least lookback_days + 1
                if len(ticker_prices) < self.lookback_days + 1:
                    continue
                
                # Get End Price (Current)
                # It's the last available valid price on or before current_date
                end_price = ticker_prices.iloc[-1]
                end_dt = ticker_prices.index[-1]
                
                # Get Start Price (N trading days ago)
                # If lookback is 120, we want the price 120 steps back from the end
                # Index: -1 is current, -2 is 1 day ago... -(1 + lookback) is lookback days ago
                start_price_idx = -1 - self.lookback_days
                start_price = ticker_prices.iloc[start_price_idx]
                start_dt = ticker_prices.index[start_price_idx]
                
                if pd.isna(end_price) or pd.isna(start_price) or start_price == 0:
                    continue
                
                # Check for float precision issues or non-float types
                end_price = float(end_price)
                start_price = float(start_price)
                
                ret = (end_price - start_price) / start_price
                
                # Filter negative momentum if enabled
                if self.filter_negative_momentum and ret < 0:
                    continue

                # Calculate score (0-90)
                # 0% -> 0 pts
                # 180% (1.8) -> 90 pts
                # Linear in between: score = ret * 50
                raw_score = ret * 50
                score = max(0, min(90, raw_score))
                
                detailed_scores.append({
                    "ticker": ticker,
                    "momentum": ret,
                    "score": round(score, 2),
                    "start_date": start_dt.strftime('%Y-%m-%d'),
                    "end_date": end_dt.strftime('%Y-%m-%d'),
                    "start_price": start_price,
                    "end_price": end_price
                })
                
            except Exception as e:
                # print(f"Error processing ticker {ticker}: {e}")
                continue
        
        # Sort by score descending (and momentum as secondary for consistency)
        detailed_scores.sort(key=lambda x: (x['score'], x['momentum']), reverse=True)
        return detailed_scores

    def select_tickers(self, available_tickers: list[str], current_date: datetime) -> list[tuple[str, float]]:
        detailed_scores = self.get_detailed_momentum(available_tickers, current_date)
        
        # Convert to expected format list[tuple[str, float]]
        selected = [(item['ticker'], item['momentum']) for item in detailed_scores[:self.n_tickers]]
        return selected

    def should_rebalance(self, current_date: datetime, last_rebalance_date: datetime) -> bool:
        if last_rebalance_date is None:
            return True
        
        days_diff = (current_date - last_rebalance_date).days
        
        if self.rebalance_period_unit == 'days':
            return days_diff >= self.rebalance_period
        elif self.rebalance_period_unit == 'weeks':
            return days_diff >= (self.rebalance_period * 7)
        elif self.rebalance_period_unit == 'months':
            return days_diff >= (self.rebalance_period * 30)
        else:
            return days_diff >= (self.rebalance_period * 30)

class ScoringStrategy(Strategy):
    def __init__(self, n_tickers: int, rebalance_period: int, rebalance_period_unit: str, data: pd.DataFrame):
        self.n_tickers = n_tickers
        self.rebalance_period = rebalance_period
        self.rebalance_period_unit = rebalance_period_unit
        self.data = data
        # Forward fill to handle missing data (holidays, etc.)
        self.close_prices = self._get_close_prices(data).ffill()

    def _get_close_prices(self, data: pd.DataFrame) -> pd.DataFrame:
        # Helper to extract Close prices
        if isinstance(data.columns, pd.MultiIndex):
            try:
                return data.xs('Close', level=1, axis=1)
            except KeyError:
                try:
                    return data['Close']
                except KeyError:
                     return data 
        else:
            return data

    def _calculate_return_score(self, current_price, past_price, min_thresh, max_thresh):
        if pd.isna(current_price) or pd.isna(past_price) or past_price <= 0:
            return 0
        
        ret = (current_price - past_price) / past_price
        
        if ret < min_thresh:
            return 0
        elif ret > max_thresh:
            return 30
        else:
            # Linear interpolation: 0 at min, 30 at max
            # score = 30 * (ret - min) / (max - min)
            return 30 * (ret - min_thresh) / (max_thresh - min_thresh)

    def select_tickers(self, available_tickers: list[str], current_date: datetime) -> list[tuple[str, float]]:
        if current_date not in self.close_prices.index:
            return []

        current_prices = self.close_prices.loc[current_date]
        
        # Calculate past dates
        # We use trading days approximation: 1 month ~ 20 days
        # But data might have gaps, so we look back by calendar days and find closest?
        # Or use iloc if we can find the index location.
        
        idx_loc = self.close_prices.index.searchsorted(current_date)
        # Assuming current_date is in index (checked above), idx_loc is its position
        
        # Capture self.close_prices in local variable for nested function
        close_prices_df = self.close_prices
        
        # Helper to get past price by offset
        def get_past_price(ticker, offset):
            if idx_loc < offset:
                return None
            past_date_idx = idx_loc - offset
            # Check if valid
            if past_date_idx < 0: return None
            
            # We need to access by integer location, but close_prices_df is a DataFrame
            # iloc works on row position
            return close_prices_df.iloc[past_date_idx].get(ticker)

        # SMA 200
        # We need average of last 200 prices
        # self.close_prices.iloc[idx_loc-199 : idx_loc+1] (inclusive of current?)
        # Usually SMA is calculated up to current date (or previous close if we trade at open)
        # Here we trade at Close of current_date, so we use current_date included?
        # Let's assume SMA includes current price.
        
        scores = []
        
        for ticker in available_tickers:
            if ticker not in current_prices or pd.isna(current_prices[ticker]):
                continue
                
            p_curr = current_prices[ticker]
            
            # 1. 1 month (20 days)
            p_20 = get_past_price(ticker, 20)
            score_1 = self._calculate_return_score(p_curr, p_20, 0.03, 0.15)
            
            # 2. 2 months (40 days)
            p_40 = get_past_price(ticker, 40)
            score_2 = self._calculate_return_score(p_curr, p_40, 0.03, 0.20)
            
            # 3. 3 months (60 days)
            p_60 = get_past_price(ticker, 60)
            score_3 = self._calculate_return_score(p_curr, p_60, 0.03, 0.25)
            
            # 4. SMA 200
            score_sma = 0
            if idx_loc >= 199:
                # Get last 200 prices for this ticker
                # Optimization: calculating SMA for all tickers at once is faster but let's do per ticker for clarity first
                # Actually, slicing the dataframe is fast.
                window = close_prices_df.iloc[idx_loc-199 : idx_loc+1][ticker]
                
                # Check for NaNs in window?
                # Relaxed check: allow some NaNs, just calculate mean
                # But if too many are missing, maybe skip?
                # For now, just check if mean is valid
                sma = window.mean()
                if not pd.isna(sma):
                    if p_curr > sma:
                        score_sma = 30
            
            total_score = score_1 + score_2 + score_3 + score_sma
            scores.append((ticker, total_score))
            
        # Sort by score descending
        scores.sort(key=lambda x: x[1], reverse=True)
        
        # Select top N
        selected = scores[:self.n_tickers]
        return selected

    def should_rebalance(self, current_date: datetime, last_rebalance_date: datetime) -> bool:
        if last_rebalance_date is None:
            return True
        
        days_diff = (current_date - last_rebalance_date).days
        
        if self.rebalance_period_unit == 'days':
            return days_diff >= self.rebalance_period
        elif self.rebalance_period_unit == 'weeks':
            return days_diff >= (self.rebalance_period * 7)
        elif self.rebalance_period_unit == 'months':
            return days_diff >= (self.rebalance_period * 30)
        else:
            return days_diff >= (self.rebalance_period * 30)
