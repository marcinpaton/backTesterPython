from __future__ import annotations
from fastapi import FastAPI, HTTPException
from typing import Optional, List
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.data_loader import download_data, load_data
import uvicorn

app = FastAPI()

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

@app.post("/api/download")
def download_stock_data(request: DownloadRequest):
    try:
        result = download_data(request.tickers, request.start_date, request.end_date)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/data")
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

@app.post("/api/backtest")
def run_backtest_endpoint(request: BacktestRequest):
    df = load_data()
    if df is None:
        raise HTTPException(status_code=404, detail="No data found. Please download data first.")
    
    if request.strategy == 'random':
        strategy = RandomSelectionStrategy(request.n_tickers, request.rebalance_period, request.rebalance_period_unit)
    elif request.strategy == 'momentum':
        strategy = MomentumStrategy(request.n_tickers, request.rebalance_period, request.rebalance_period_unit, df, request.momentum_lookback_days)
    elif request.strategy == 'scoring':
        strategy = ScoringStrategy(request.n_tickers, request.rebalance_period, request.rebalance_period_unit, df)
    else:
        # Default to scoring if unknown
        strategy = ScoringStrategy(request.n_tickers, request.rebalance_period, request.rebalance_period_unit, df)
    
    try:
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
            request.sizing_method
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

class OptimizationRequest(BaseModel):
    tickers: List[str]
    start_date: str
    end_date: str
    brokers: List[str]  # ['bossa', 'interactive_brokers']
    n_tickers_range: OptimizationRangeRequest
    stop_loss_range: Optional[OptimizationRangeRequest] = None
    rebalance_period_range: OptimizationRangeRequest  # In months
    momentum_lookback_range: OptimizationRangeRequest  # In days
    margin_enabled: bool
    strategies: List[str]  # ['scoring', 'momentum']
    sizing_methods: List[str]  # ['equal', 'var']

@app.post("/api/optimize")
def run_optimization_endpoint(request: OptimizationRequest):
    df = load_data()
    if df is None:
        raise HTTPException(status_code=404, detail="No data found. Please download data first.")
    
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
    
    # Generate all combinations
    results = []
    total_combinations = (
        len(request.brokers) * 
        len(n_tickers_values) * 
        len(rebalance_period_values) *
        len(stop_loss_values) * 
        len(request.strategies) * 
        len(request.sizing_methods) *
        len(momentum_lookback_values)  # Only used when momentum is selected
    )
    
    current_test = 0
    
    try:
        for broker in request.brokers:
            broker_config = broker_configs[broker]
            
            for n_tickers in n_tickers_values:
                for rebalance_period in rebalance_period_values:
                    for stop_loss_pct in stop_loss_values:
                        for strategy_name in request.strategies:
                            for sizing_method in request.sizing_methods:
                                # For momentum, iterate over lookback values
                                lookback_values = momentum_lookback_values if strategy_name == 'momentum' else [30]
                                
                                for lookback_days in lookback_values:
                                    current_test += 1
                                    
                                    # Create strategy
                                    if strategy_name == 'momentum':
                                        strategy = MomentumStrategy(n_tickers, rebalance_period, 'months', df, lookback_days)
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
                                            sizing_method
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
                                            'cagr': metrics.get('cagr', 0),
                                            'max_drawdown': metrics.get('max_drawdown', 0),
                                            'final_value': metrics.get('final_value', 0),
                                            'total_return': metrics.get('total_return', 0)
                                        }
                                        
                                        # Add momentum lookback only if momentum strategy
                                        if strategy_name == 'momentum':
                                            result['momentum_lookback_days'] = lookback_days
                                        
                                        results.append(result)
                                    except Exception as e:
                                        import traceback
                                        print(f"Error in test {current_test}: {e}")
                                        traceback.print_exc()
                                        # Continue with next combination
                                        continue
        
        # Sort results by CAGR (descending) and Max Drawdown (ascending - less negative is better)
        results.sort(key=lambda x: (-x['cagr'], -x['max_drawdown']))
        
        return {
            'total_tests': total_combinations,
            'completed_tests': len(results),
            'results': results
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8002, reload=True)
