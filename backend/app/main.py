from __future__ import annotations
from fastapi import FastAPI, HTTPException
from typing import Optional, List
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.data_loader import download_data, load_data
import uvicorn
import os
from datetime import datetime

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
    filter_negative_momentum: bool = False # If True, skip tickers with negative momentum

@app.post("/api/backtest")
def run_backtest_endpoint(request: BacktestRequest):
    df = load_data()
    if df is None:
        raise HTTPException(status_code=404, detail="No data found. Please download data first.")
    
    if request.strategy == 'random':
        strategy = RandomSelectionStrategy(request.n_tickers, request.rebalance_period, request.rebalance_period_unit)
    elif request.strategy == 'momentum':
        strategy = MomentumStrategy(request.n_tickers, request.rebalance_period, request.rebalance_period_unit, df, request.momentum_lookback_days, request.filter_negative_momentum)
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

class ScoringConfig(BaseModel):
    """Configuration for scoring calculation"""
    cagr_min: float = 0.40  # 40%
    cagr_max: float = 0.60  # 60%
    cagr_weight: float = 60.0
    dd_min: float = -0.45  # -45%
    dd_max: float = -0.30  # -30%
    dd_weight: float = 40.0

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

# Helper function to run a single backtest for optimization
def run_single_backtest(df, config, start_date, end_date, margin_enabled):
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
        strategy = MomentumStrategy(config['n_tickers'], config['rebalance_period'], 'months', df, config['momentum_lookback_days'], config['filter_negative_momentum'])
    elif config['strategy'] == 'scoring':
        strategy = ScoringStrategy(config['n_tickers'], config['rebalance_period'], 'months', df)
    else:
        return None # Should not happen with validation
    
    # Run backtest
    portfolio = run_backtest(
        strategy,
        df,
        10000,  # Fixed initial capital
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
        config['sizing_method']
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
        result['filter_negative_momentum'] = config['filter_negative_momentum']
        
    return result

def calculate_train_test_score(train_cagr, train_dd, test_cagr, test_dd, config=None):
    """
    Calculate score for train/test optimization based on both train and test results.
    
    Uses configurable thresholds and weights from ScoringConfig.
    
    Score = Train_CAGR_score + Train_DD_score + Test_CAGR_score + Test_DD_score
    Maximum: (cagr_weight + dd_weight) * 2
    """
    if config is None:
        config = ScoringConfig()  # Use defaults
    
    def calc_cagr_score(cagr):
        if cagr < config.cagr_min:
            return 0
        elif cagr > config.cagr_max:
            return config.cagr_weight
        else:
            return ((cagr - config.cagr_min) / (config.cagr_max - config.cagr_min)) * config.cagr_weight
    
    def calc_dd_score(dd):
        # Note: max_drawdown is negative, so dd_max (less negative) is better than dd_min (more negative)
        if dd < config.dd_min:  # Worse than min threshold
            return 0
        elif dd > config.dd_max:  # Better than max threshold
            return config.dd_weight
        else:
            return ((dd - config.dd_min) / (config.dd_max - config.dd_min)) * config.dd_weight
    
    # Calculate scores for train and test
    train_cagr_score = calc_cagr_score(train_cagr)
    train_dd_score = calc_dd_score(train_dd)
    test_cagr_score = calc_cagr_score(test_cagr)
    test_dd_score = calc_dd_score(test_dd)
    
    return train_cagr_score + train_dd_score + test_cagr_score + test_dd_score

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
    from datetime import datetime as dt
    from collections import Counter
    
    # Calculate all windows
    windows = []
    current_start = dt.strptime(request.walk_forward_start, '%Y-%m-%d')
    overall_end = dt.strptime(request.walk_forward_end, '%Y-%m-%d')
    
    while True:
        # Calculate train and test periods for this window
        train_start = current_start
        train_end = train_start + relativedelta(months=request.train_months) - relativedelta(days=1)
        test_start = train_end + relativedelta(days=1)
        test_end = test_start + relativedelta(months=request.test_months) - relativedelta(days=1)
        
        # Check if we've exceeded overall end date
        if test_end > overall_end:
            break
        
        windows.append({
            'train_start': train_start.strftime('%Y-%m-%d'),
            'train_end': train_end.strftime('%Y-%m-%d'),
            'test_start': test_start.strftime('%Y-%m-%d'),
            'test_end': test_end.strftime('%Y-%m-%d')
        })
        
        # Move forward by step
        current_start += relativedelta(months=request.walk_forward_step_months)
    
    # Run train/test for each window
    all_window_results = []
    parameter_frequency = Counter()
    
    for i, window in enumerate(windows):
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
            margin_enabled=request.margin_enabled,
            strategies=request.strategies,
            sizing_methods=request.sizing_methods,
            enable_train_test=True,
            train_start_date=window['train_start'],
            train_months=request.train_months,
            test_months=request.test_months,
            top_n_for_test=request.top_n_for_test,
            scoring_config=request.scoring_config,
            enable_walk_forward=False  # Prevent recursion
        )
        
        # Run train/test for this window
        window_results = run_optimization_endpoint(window_request)
        
        # Extract top N configurations from training results for frequency counting
        top_configs = window_results['train_results'][:request.top_n_for_test]
        test_configs = window_results['test_results'][:request.top_n_for_test]
        scores = window_results.get('scores', [])[:request.top_n_for_test]
        
        # Count parameter combinations (only from top N)
        for config in top_configs:
            # Create hashable key from parameters
            param_key = (
                config['broker'],
                config['n_tickers'],
                config['rebalance_period'],
                config.get('momentum_lookback_days', 0),
                config.get('filter_negative_momentum', False),
                config.get('stop_loss_pct', 0),
                config['strategy'],
                config['sizing_method']
            )
            parameter_frequency[param_key] += 1
        
        # Store results for this window
        all_window_results.append({
            'window_number': i + 1,
            'window': window,
            'train_results': top_configs,  # Top N for display
            'test_results': test_configs,   # Top N for display
            'scores': scores,               # Top N for display
            'all_train_results': window_results.get('all_train_results', window_results['train_results']),  # ALL results
            'all_test_results': window_results.get('all_test_results', window_results['test_results']),    # ALL results
            'all_scores': window_results.get('all_scores', window_results.get('scores', []))                # ALL scores
        })
    
    # Rank parameters by frequency
    ranked_params = []
    for key, count in parameter_frequency.most_common():
        ranked_params.append({
            'parameters': {
                'broker': key[0],
                'n_tickers': key[1],
                'rebalance_period': key[2],
                'momentum_lookback_days': key[3] if key[3] != 0 else None,
                'filter_negative_momentum': key[4],
                'stop_loss_pct': key[5] if key[5] != 0 else None,
                'strategy': key[6],
                'sizing_method': key[7]
            },
            'frequency': count,
            'percentage': (count / len(windows)) * 100
        })
    
    return {
        'walk_forward_mode': True,
        'total_windows': len(windows),
        'windows': all_window_results,
        'ranked_parameters': ranked_params,
        'train_period_months': request.train_months,
        'test_period_months': request.test_months,
        'step_months': request.walk_forward_step_months
    }


@app.post("/api/optimize")
def run_optimization_endpoint(request: OptimizationRequest):
    df = load_data()
    if df is None:
        raise HTTPException(status_code=404, detail="No data found. Please download data first.")
    
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
            margin_enabled=request.margin_enabled,
            strategies=request.strategies,
            sizing_methods=request.sizing_methods,
            enable_train_test=False  # Disable recursion
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
                'filter_negative_momentum': train_result.get('filter_negative_momentum', False)
            }
            
            # Run backtest on test period
            test_result = run_single_backtest(
                df, test_config, test_start_str, test_end_str, request.margin_enabled
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
    
    # Generate all combinations
    results = []
    total_combinations = (
        len(request.brokers) * 
        len(n_tickers_values) * 
        len(rebalance_period_values) *
        len(stop_loss_values) * 
        len(request.strategies) * 
        len(request.sizing_methods) *
        len(momentum_lookback_values) * # Only used when momentum is selected
        len(request.filter_negative_momentum) # Only used when momentum is selected
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
                                # For momentum, iterate over lookback values and filter options
                                lookback_values = momentum_lookback_values if strategy_name == 'momentum' else [30]
                                filter_values = request.filter_negative_momentum if strategy_name == 'momentum' else [False]
                                
                                for lookback_days in lookback_values:
                                    for filter_neg_mom in filter_values:
                                        current_test += 1
                                        
                                        # Create strategy
                                        if strategy_name == 'momentum':
                                            strategy = MomentumStrategy(n_tickers, rebalance_period, 'months', df, lookback_days, filter_neg_mom)
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

OPTIMIZATION_RESULTS_DIR = "/home/mpaton/Projects/my/backTesterPython/backTesterPython/optimisation"

class SaveOptimizationResultsRequest(BaseModel):
    params: OptimizationRequest
    results: List[dict]

@app.post("/api/save_optimization_results")
async def save_optimization_results(request: SaveOptimizationResultsRequest):
    try:
        if not os.path.exists(OPTIMIZATION_RESULTS_DIR):
            os.makedirs(OPTIMIZATION_RESULTS_DIR)
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        filename = f"optimization_results_{timestamp}.txt"
        filepath = os.path.join(OPTIMIZATION_RESULTS_DIR, filename)
        
        with open(filepath, "w") as f:
            f.write(f"Optimization Results - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 50 + "\n\n")
            
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
            
            # Header
            headers = ["#", "Broker", "N Tickers", "Rebalance", "Lookback", "Filter Neg Mom", "Stop Loss", "Strategy", "Sizing", "CAGR", "Max DD", "Final Value"]
            # Simple formatting
            header_str = " | ".join(headers)
            f.write(header_str + "\n")
            f.write("-" * len(header_str) + "\n")
            
            for res in request.results[:300]:
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
                
        return {"message": "Results saved successfully", "filename": filename, "path": filepath}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8002, reload=True)
