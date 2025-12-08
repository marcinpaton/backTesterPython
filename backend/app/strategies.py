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
    def __init__(self, n_tickers: int, rebalance_period: int, rebalance_period_unit: str, data: pd.DataFrame):
        self.n_tickers = n_tickers
        self.rebalance_period = rebalance_period
        self.rebalance_period_unit = rebalance_period_unit
        self.data = data
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

    def select_tickers(self, available_tickers: list[str], current_date: datetime) -> list[tuple[str, float]]:
        # Calculate 1-month return (approx 30 days)
        start_date = current_date - timedelta(days=30)
        
        # Get price at current_date (or closest previous)
        # We use 'asof' logic or just loc if we are sure dates match. 
        # The backtester loop iterates over existing dates in data, so current_date should exist.
        
        if current_date not in self.close_prices.index:
            # Should not happen if driven by backtester loop on same data, but for safety
            return []

        current_prices = self.close_prices.loc[current_date]
        
        # Get price at start_date (or closest previous)
        # We need to find the index location of current_date and go back ~20 trading days?
        # Or just use asof logic on the index.
        
        # Using searchsorted to find position
        idx_loc = self.close_prices.index.searchsorted(start_date)
        if idx_loc == 0 and self.close_prices.index[0] > start_date:
             # Not enough history
             return []
             
        # If exact match not found, searchsorted returns where it should be inserted.
        # We want the closest date BEFORE or ON start_date.
        # If self.close_prices.index[idx_loc] > start_date, we take idx_loc - 1
        
        # Easier way: truncate and take last
        past_slice = self.close_prices.loc[:start_date]
        if past_slice.empty:
            return []
            
        past_prices = past_slice.iloc[-1]
        
        momentum_scores = []
        for ticker in available_tickers:
            if ticker in current_prices and ticker in past_prices:
                p0 = past_prices[ticker]
                p1 = current_prices[ticker]
                
                if not pd.isna(p0) and not pd.isna(p1) and p0 > 0:
                    ret = (p1 - p0) / p0
                    momentum_scores.append((ticker, ret))
        
        # Sort by return descending
        momentum_scores.sort(key=lambda x: x[1], reverse=True)
        
        # Select top N
        selected = momentum_scores[:self.n_tickers]
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
        
        # Helper to get past price by offset
        def get_past_price(ticker, offset):
            if idx_loc < offset:
                return None
            past_date_idx = idx_loc - offset
            # Check if valid
            if past_date_idx < 0: return None
            
            # We need to access by integer location, but self.close_prices is a DataFrame
            # iloc works on row position
            return self.close_prices.iloc[past_date_idx].get(ticker)

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
                window = self.close_prices.iloc[idx_loc-199 : idx_loc+1][ticker]
                
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
