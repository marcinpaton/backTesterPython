from __future__ import annotations
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional, List, Any
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.data_loader import download_data, load_data
import uvicorn
import os
import json
import asyncio
from queue import Queue
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
    Calculate score for train/test optimization based ONLY on train results.
    
    Uses configurable thresholds and weights from ScoringConfig.
    
    Score = Train_CAGR_score + Train_DD_score
    Maximum: cagr_weight + dd_weight
    
    Note: Test results are calculated but excluded from the score to prevent look-ahead bias.
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
    # test_cagr_score = calc_cagr_score(test_cagr)
    # test_dd_score = calc_dd_score(test_dd)
    
    # ONLY use Train score for selection to prevent look-ahead bias
    return train_cagr_score + train_dd_score

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

    
    # Validate required parameters for walk-forward
    if not request.train_months or not request.test_months:
        raise ValueError("Walk-Forward Optimization requires train_months and test_months to be set. Please enable Train/Test Split.")
    
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
    
    # Initialize progress tracker for walk-forward (we'll update per window)
    # Total combinations will be calculated inside each window
    progress_tracker.start(total=0, window_total=len(windows))
    
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
        
        # Extract top N configurations from training results
        top_configs = window_results['train_results'][:request.top_n_for_test]
        test_configs = window_results['test_results'][:request.top_n_for_test]
        scores = window_results.get('scores', [])[:request.top_n_for_test]
        
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
        
        # Update window progress (don't update current - it's managed by inner optimization)
        progress_tracker.update(current=progress_tracker.current, window_current=i + 1)
    
    # Mark walk-forward as complete
    progress_tracker.finish()
    
    return {
        'walk_forward_mode': True,
        'total_windows': len(windows),
        'windows': all_window_results,
        'train_period_months': request.train_months,
        'test_period_months': request.test_months,
        'step_months': request.walk_forward_step_months
    }

# Import progress tracker
from app.progress_tracker import progress_tracker

@app.get("/api/optimization_progress")
def get_optimization_progress():
    """Get current optimization progress status"""
    return progress_tracker.get_status()


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
    
    # Initialize progress tracker (skip if already running - walk-forward mode)
    if not progress_tracker.get_status()['is_running']:
        progress_tracker.start(total_combinations)
    
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
                                
                                for lookback_days in lookback_values:
                                    for filter_neg_mom in filter_values:
                                        current_test += 1
                                        
                                        # Update progress (every 50 combinations or 10%)
                                        if (current_test - last_progress_update >= 50) or \
                                           ((current_test / total_combinations) - (last_progress_update / total_combinations) >= 0.1):
                                            progress_tracker.update(current_test)
                                            last_progress_update = current_test
                                        
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
        
        # Mark progress as complete (only if NOT in walk-forward mode)
        # Walk-forward will call finish() after all windows complete
        if progress_tracker.get_status()['window_total'] is None:
            progress_tracker.finish()
        
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

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8002, reload=True)
