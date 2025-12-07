from fastapi import FastAPI, HTTPException
from typing import Optional
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
    tickers: list[str]
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

@app.post("/api/backtest")
def run_backtest_endpoint(request: BacktestRequest):
    df = load_data()
    if df is None:
        raise HTTPException(status_code=404, detail="No data found. Please download data first.")
    
    if request.strategy == 'random':
        strategy = RandomSelectionStrategy(request.n_tickers, request.rebalance_period, request.rebalance_period_unit)
    elif request.strategy == 'momentum':
        strategy = MomentumStrategy(request.n_tickers, request.rebalance_period, request.rebalance_period_unit, df)
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
            request.margin_enabled
        )
        metrics = calculate_metrics(portfolio)
        return metrics
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8002, reload=True)
