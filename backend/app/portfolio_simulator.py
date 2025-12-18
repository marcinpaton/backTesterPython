"""
Portfolio Simulator for Walk-Forward Optimization

Simulates real-time buying and selling of tickers based on optimization results.
Tracks portfolio value, positions, and P&L across multiple windows.
"""

from typing import List, Dict, Optional
from datetime import datetime, timedelta
import pandas as pd


class PortfolioSimulator:
    """Simulates portfolio management during Walk-Forward Optimization"""
    
    def __init__(self, initial_capital: float = 10000.0):
        """
        Initialize portfolio simulator
        
        Args:
            initial_capital: Starting capital in dollars
        """
        self.initial_capital = initial_capital
        self.capital = initial_capital
        self.positions = []  # Current holdings: [{ticker, shares, buy_price, buy_date}]
        self.transaction_history = []  # All transactions
        
    def sell_all_positions(self, sell_date: str, df: pd.DataFrame, broker_config: Dict) -> Dict:
        """
        Sell all current positions
        
        Args:
            sell_date: Date to sell (YYYY-MM-DD)
            df: Price dataframe
            broker_config: Broker fee configuration
            
        Returns:
            Dict with sale details
        """
        if not self.positions:
            return {
                'positions_sold': [],
                'total_proceeds': 0,
                'total_pnl': 0,
                'capital_after': self.capital
            }
        
        positions_sold = []
        total_proceeds = 0
        total_pnl = 0
        
        for position in self.positions:
            ticker = position['ticker']
            shares = position['shares']
            buy_price = position['buy_price']
            
            # Get sell price (close price on sell_date)
            try:
                sell_price = self._get_price(df, ticker, sell_date)
                
                # Calculate proceeds before fees
                gross_proceeds = shares * sell_price
                
                # Apply transaction fees
                fee = self._calculate_fee(gross_proceeds, broker_config)
                net_proceeds = gross_proceeds - fee
                
                # Calculate P&L
                cost_basis = shares * buy_price
                pnl = net_proceeds - cost_basis
                pnl_pct = (pnl / cost_basis) * 100 if cost_basis > 0 else 0
                
                positions_sold.append({
                    'ticker': ticker,
                    'shares': shares,
                    'buy_price': buy_price,
                    'buy_date': position['buy_date'],
                    'sell_price': sell_price,
                    'sell_date': sell_date,
                    'gross_proceeds': gross_proceeds,
                    'fee': fee,
                    'net_proceeds': net_proceeds,
                    'pnl': pnl,
                    'pnl_pct': pnl_pct
                })
                
                total_proceeds += net_proceeds
                total_pnl += pnl
                
            except Exception as e:
                print(f"Warning: Could not sell {ticker} on {sell_date}: {e}")
                # Still remove from positions
                positions_sold.append({
                    'ticker': ticker,
                    'shares': shares,
                    'buy_price': buy_price,
                    'buy_date': position['buy_date'],
                    'sell_price': None,
                    'sell_date': sell_date,
                    'error': str(e),
                    'pnl': 0,
                    'pnl_pct': 0
                })
        
        # Update capital
        self.capital += total_proceeds
        
        # Clear positions
        self.positions = []
        
        # Record transaction
        self.transaction_history.append({
            'type': 'SELL_ALL',
            'date': sell_date,
            'positions': positions_sold,
            'total_proceeds': total_proceeds,
            'total_pnl': total_pnl,
            'capital_after': self.capital
        })
        
        return {
            'positions_sold': positions_sold,
            'total_proceeds': total_proceeds,
            'total_pnl': total_pnl,
            'capital_after': self.capital
        }
    
    def buy_tickers(
        self, 
        buy_date: str, 
        tickers: List[str], 
        n_tickers: int,
        df: pd.DataFrame, 
        broker_config: Dict,
        sizing_method: str = 'equal'
    ) -> Dict:
        """
        Buy top N tickers
        
        Args:
            buy_date: Date to buy (YYYY-MM-DD)
            tickers: List of tickers to buy (already ranked)
            n_tickers: Number of tickers to buy
            df: Price dataframe
            broker_config: Broker fee configuration
            sizing_method: 'equal' or 'var'
            
        Returns:
            Dict with purchase details
        """
        print("=" * 80)
        print("DEBUG buy_tickers VERSION 2.0 - NEW CODE LOADED")
        print("=" * 80)
        print(f"DEBUG buy_tickers START: buy_date={buy_date}, n_tickers={n_tickers}, tickers_count={len(tickers)}, capital={self.capital}")
        
        if self.capital <= 0:
            print(f"DEBUG buy_tickers: Insufficient capital ({self.capital})")
            return {
                'positions_bought': [],
                'total_cost': 0,
                'capital_after': self.capital,
                'error': 'Insufficient capital'
            }
        
        # Select top N tickers
        tickers_to_buy = tickers[:n_tickers]
        print(f"DEBUG buy_tickers: tickers_to_buy count={len(tickers_to_buy)}, list={tickers_to_buy}")
        
        positions_bought = []
        total_cost = 0
        capital_before = self.capital
        
        print(f"DEBUG buy_tickers: sizing_method='{sizing_method}', checking if equal...")
        
        # Equal weight allocation
        if sizing_method == 'equal':
            allocation_per_ticker = self.capital / len(tickers_to_buy)
            print(f"DEBUG buy_tickers: Capital={self.capital}, Tickers to buy={len(tickers_to_buy)}, Allocation per ticker={allocation_per_ticker}")
            
            for ticker in tickers_to_buy:
                try:
                    # Get buy price (close price on buy_date)
                    buy_price = self._get_price(df, ticker, buy_date)
                    
                    # Calculate shares (before fees)
                    # We need to account for fees, so we allocate slightly less
                    fee_rate = self._get_fee_rate(broker_config)
                    net_allocation = allocation_per_ticker / (1 + fee_rate)
                    shares = net_allocation / buy_price
                    
                    # Calculate actual cost
                    gross_cost = shares * buy_price
                    fee = self._calculate_fee(gross_cost, broker_config)
                    total_position_cost = gross_cost + fee
                    
                    # Check if we have enough capital
                    if total_position_cost > self.capital:
                        print(f"Warning: Insufficient capital to buy {ticker}")
                        continue
                    
                    # Execute purchase
                    self.capital -= total_position_cost
                    total_cost += total_position_cost
                    
                    # Add to positions
                    position = {
                        'ticker': ticker,
                        'shares': shares,
                        'buy_price': buy_price,
                        'buy_date': buy_date,
                        'cost_basis': gross_cost,
                        'fee': fee,
                        'total_cost': total_position_cost
                    }
                    self.positions.append(position)
                    positions_bought.append(position)
                    print(f"DEBUG: Bought {ticker}: {shares:.2f} shares @ ${buy_price:.2f}, cost=${total_position_cost:.2f}, capital left=${self.capital:.2f}")
                    
                except Exception as e:
                    print(f"Warning: Could not buy {ticker} on {buy_date}: {e}")
        else:
            print(f"DEBUG buy_tickers: sizing_method '{sizing_method}' not implemented, skipping purchases")
        
        # Record transaction
        self.transaction_history.append({
            'type': 'BUY',
            'date': buy_date,
            'positions': positions_bought,
            'total_cost': total_cost,
            'capital_before': capital_before,
            'capital_after': self.capital
        })
        
        return {
            'positions_bought': positions_bought,
            'total_cost': total_cost,
            'capital_before': capital_before,
            'capital_after': self.capital
        }
    
    def get_portfolio_value(self, date: str, df: pd.DataFrame) -> float:
        """
        Calculate current portfolio value (cash + positions)
        
        Args:
            date: Date to value portfolio (YYYY-MM-DD)
            df: Price dataframe
            
        Returns:
            Total portfolio value
        """
        positions_value = 0
        
        for position in self.positions:
            try:
                current_price = self._get_price(df, position['ticker'], date)
                positions_value += position['shares'] * current_price
            except:
                # If price not available, use buy price
                positions_value += position['shares'] * position['buy_price']
        
        return self.capital + positions_value
    
    def get_summary(self) -> Dict:
        """Get portfolio summary"""
        return {
            'initial_capital': self.initial_capital,
            'current_capital': self.capital,
            'positions': self.positions,
            'transaction_history': self.transaction_history,
            'total_return': self.capital - self.initial_capital,
            'total_return_pct': ((self.capital - self.initial_capital) / self.initial_capital) * 100
        }
    
    def _get_price(self, df: pd.DataFrame, ticker: str, date: str) -> float:
        """Get close price for ticker on date"""
        # DataFrame has MultiIndex columns: (ticker, price_type)
        # Index is DatetimeIndex
        
        # Convert date string to datetime
        target_date = pd.to_datetime(date)
        
        # Check if ticker exists in columns
        if ticker not in df.columns.get_level_values(0):
            raise ValueError(f"Ticker {ticker} not found in dataframe")
        
        # Get close price for this ticker on this date
        try:
            price = df.loc[target_date, (ticker, 'Close')]
            if pd.isna(price):
                raise ValueError(f"No price data for {ticker} on {date} (NaN)")
            return float(price)
        except KeyError:
            raise ValueError(f"No price data for {ticker} on {date}")
    
    def _calculate_fee(self, amount: float, broker_config: Dict) -> float:
        """Calculate transaction fee"""
        if not broker_config.get('transaction_fee_enabled', False):
            return 0.0
        
        fee_type = broker_config.get('transaction_fee_type', 'percentage')
        fee_value = broker_config.get('transaction_fee_value', 0.0)
        
        if fee_type == 'percentage':
            return amount * (fee_value / 100)
        else:  # fixed
            return fee_value
    
    def _get_fee_rate(self, broker_config: Dict) -> float:
        """Get fee rate as decimal (for percentage fees)"""
        if not broker_config.get('transaction_fee_enabled', False):
            return 0.0
        
        fee_type = broker_config.get('transaction_fee_type', 'percentage')
        fee_value = broker_config.get('transaction_fee_value', 0.0)
        
        if fee_type == 'percentage':
            return fee_value / 100
        else:
            # For fixed fees, approximate as percentage of average allocation
            # This is a simplification
            return 0.001  # 0.1%
