import React, { useState } from 'react';

const OptimizationResults = ({ results, onSave }) => {
    const [sortBy, setSortBy] = useState('score'); // Default sort by score
    const [expandedWindow, setExpandedWindow] = useState(null); // For walk-forward mode
    const [selectedParam, setSelectedParam] = useState(null); // For showing parameter details

    if (!results) {
        return null;
    }

    // Check if this is walk-forward mode
    const isWalkForwardMode = results.walk_forward_mode === true;

    // Check if this is train/test mode
    const isTrainTestMode = results.train_test_mode === true;

    if (isWalkForwardMode) {
        // Walk-Forward Mode - show ranked parameters and all windows
        const { total_windows, windows, ranked_parameters, train_period_months, test_period_months, step_months } = results;

        return (
            <div className="mt-6 p-4 bg-white shadow rounded-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Walk-Forward Optimization Results</h2>
                    <div className="flex gap-2">
                        {onSave && (
                            <button
                                onClick={onSave}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition flex items-center"
                            >
                                <span className="mr-2">💾</span> Save Results
                            </button>
                        )}
                        <label className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center cursor-pointer">
                            <span className="mr-2">📂</span> Load Results
                            <input
                                type="file"
                                accept=".txt"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file && window.handleLoadResults) {
                                        window.handleLoadResults(file);
                                    }
                                }}
                            />
                        </label>
                    </div>
                </div>

                <div className="mb-4 p-3 bg-purple-50 rounded border border-purple-200">
                    <p className="text-sm font-semibold">
                        Total Windows: {total_windows} | Train: {train_period_months}mo | Test: {test_period_months}mo | Step: {step_months}mo
                    </p>
                </div>


                {/* Individual Windows */}
                <div>
                    <h3 className="text-xl font-bold mb-3">Individual Windows</h3>
                    <div className="space-y-2">
                        {windows.map((wfWindow) => (
                            <div key={wfWindow.window_number} className="border border-gray-300 rounded">
                                <button
                                    onClick={() => setExpandedWindow(expandedWindow === wfWindow.window_number ? null : wfWindow.window_number)}
                                    className="w-full px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
                                >
                                    <span className="font-medium">
                                        Window {wfWindow.window_number}: {wfWindow.window.train_start} → {wfWindow.window.test_end}
                                    </span>
                                    <span>{expandedWindow === wfWindow.window_number ? '▼' : '▶'}</span>
                                </button>

                                {expandedWindow === wfWindow.window_number && (
                                    <div className="p-4 bg-white">
                                        <p className="text-sm mb-2">
                                            <strong>Train:</strong> {wfWindow.window.train_start} to {wfWindow.window.train_end} |
                                            <strong className="ml-2">Test:</strong> {wfWindow.window.test_start} to {wfWindow.window.test_end}
                                        </p>

                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200 text-xs">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-2 py-2 text-left">#</th>
                                                        <th className="px-2 py-2 text-left">Broker</th>
                                                        <th className="px-2 py-2 text-left">N</th>
                                                        <th className="px-2 py-2 text-left">Rebal</th>
                                                        <th className="px-2 py-2 text-left">Look</th>
                                                        <th className="px-2 py-2 text-left bg-green-50">Train CAGR</th>
                                                        <th className="px-2 py-2 text-left bg-red-50">Train DD</th>
                                                        <th className="px-2 py-2 text-left bg-green-100">Test CAGR</th>
                                                        <th className="px-2 py-2 text-left bg-red-100">Test DD</th>
                                                        <th className="px-2 py-2 text-left bg-purple-50">Score</th>
                                                        <th className="px-2 py-2 text-left bg-blue-50">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {wfWindow.train_results.map((result, idx) => {
                                                        const testResult = wfWindow.test_results[idx];

                                                        // Function to open Dashboard with pre-filled parameters
                                                        const handleRunTest = () => {
                                                            console.log('Run Test clicked for result:', result);

                                                            // Build URL with parameters (using snake_case to match App.jsx)
                                                            const params = new URLSearchParams({
                                                                autoRun: 'true',
                                                                n_tickers: result.n_tickers,
                                                                rebalance_period: result.rebalance_period,
                                                                start_date: wfWindow.window.test_start,
                                                                end_date: wfWindow.window.test_end,
                                                                strategy: result.strategy || 'scoring',
                                                                sizing_method: result.sizing_method || 'equal',
                                                                margin_enabled: result.margin_enabled || false,
                                                                filter_negative_momentum: result.filter_negative_momentum || false
                                                            });

                                                            // Add Bossa preset parameters if broker is bossa
                                                            if (result.broker === 'bossa') {
                                                                params.append('transaction_fee_enabled', 'true');
                                                                params.append('transaction_fee_type', 'percentage');
                                                                params.append('transaction_fee_value', '0.29');
                                                                params.append('capital_gains_tax_enabled', 'false');
                                                            }

                                                            // Add momentum lookback if present
                                                            if (result.momentum_lookback_days) {
                                                                params.append('momentum_lookback_days', result.momentum_lookback_days);
                                                            }

                                                            // Add stop loss if present
                                                            if (result.stop_loss_pct) {
                                                                params.append('stop_loss_pct', result.stop_loss_pct);
                                                            }

                                                            const url = `/?${params.toString()}`;
                                                            console.log('Opening URL:', url);

                                                            // Open in new tab
                                                            const newWindow = window.open(url, '_blank');
                                                            if (!newWindow) {
                                                                alert('Pop-up blocked! Please allow pop-ups for this site.');
                                                            }
                                                        };

                                                        return (
                                                            <tr key={idx} className="hover:bg-gray-50">
                                                                <td className="px-2 py-2">{idx + 1}</td>
                                                                <td className="px-2 py-2">{result.broker === 'interactive_brokers' ? 'IB' : result.broker}</td>
                                                                <td className="px-2 py-2">{result.n_tickers}</td>
                                                                <td className="px-2 py-2">{result.rebalance_period}</td>
                                                                <td className="px-2 py-2">{result.momentum_lookback_days || '-'}</td>
                                                                <td className="px-2 py-2 bg-green-50">{(result.cagr * 100).toFixed(2)}%</td>
                                                                <td className="px-2 py-2 bg-red-50">{(result.max_drawdown * 100).toFixed(2)}%</td>
                                                                <td className="px-2 py-2 bg-green-100">{(testResult?.cagr * 100).toFixed(2)}%</td>
                                                                <td className="px-2 py-2 bg-red-100">{(testResult?.max_drawdown * 100).toFixed(2)}%</td>
                                                                <td className="px-2 py-2 bg-purple-50 font-bold">{wfWindow.scores[idx]?.toFixed(1)}</td>
                                                                <td className="px-2 py-2 bg-blue-50">
                                                                    <button
                                                                        onClick={handleRunTest}
                                                                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition"
                                                                        title="Run test with these parameters"
                                                                    >
                                                                        ▶ Run
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Portfolio Simulation */}
                                        {wfWindow.portfolio_state && !wfWindow.portfolio_state.error && (
                                            <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-300">
                                                <h4 className="font-semibold text-sm mb-3 text-blue-800">📊 Portfolio Simulation</h4>

                                                {/* Best Parameters Used */}
                                                <div className="mb-3 p-3 bg-white rounded shadow-sm">
                                                    <p className="text-xs font-semibold mb-2 text-gray-700">Best Parameters Used:</p>
                                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                                        <div>
                                                            <span className="text-gray-600">Broker:</span> <span className="font-medium">{wfWindow.portfolio_state.best_params.broker}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600">N Tickers:</span> <span className="font-medium">{wfWindow.portfolio_state.best_params.n_tickers}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600">Lookback:</span> <span className="font-medium">{wfWindow.portfolio_state.best_params.momentum_lookback_days} days</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600">Rebalance:</span> <span className="font-medium">{wfWindow.portfolio_state.best_params.rebalance_period} month(s)</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600">Buy Date:</span> <span className="font-medium">{wfWindow.portfolio_state.buy_date}</span>
                                                        </div>
                                                        {wfWindow.portfolio_state.sell_date && (
                                                            <div>
                                                                <span className="text-gray-600">Sell Date:</span> <span className="font-medium">{wfWindow.portfolio_state.sell_date}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Positions Table */}
                                                {wfWindow.portfolio_state.positions && wfWindow.portfolio_state.positions.length > 0 && (
                                                    <div className="mb-3 overflow-x-auto">
                                                        <p className="text-xs font-semibold mb-2 text-gray-700">Positions Bought:</p>
                                                        <table className="min-w-full text-xs bg-white rounded shadow-sm">
                                                            <thead className="bg-gray-100">
                                                                <tr>
                                                                    <th className="px-2 py-1 text-left">Ticker</th>
                                                                    <th className="px-2 py-1 text-right">Shares</th>
                                                                    <th className="px-2 py-1 text-right">Buy Price</th>
                                                                    <th className="px-2 py-1 text-right">Cost</th>
                                                                    <th className="px-2 py-1 text-right">Fee</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {wfWindow.portfolio_state.positions.map((pos, idx) => (
                                                                    <tr key={idx} className="border-t">
                                                                        <td className="px-2 py-1 font-medium">{pos.ticker}</td>
                                                                        <td className="px-2 py-1 text-right">{pos.shares.toFixed(2)}</td>
                                                                        <td className="px-2 py-1 text-right">${pos.buy_price.toFixed(2)}</td>
                                                                        <td className="px-2 py-1 text-right">${pos.cost_basis.toFixed(2)}</td>
                                                                        <td className="px-2 py-1 text-right text-red-600">${pos.fee.toFixed(2)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {/* Sold Positions (for last window) */}
                                                {wfWindow.portfolio_state.final_positions_sold && wfWindow.portfolio_state.final_positions_sold.length > 0 && (
                                                    <div className="mb-3 overflow-x-auto">
                                                        <p className="text-xs font-semibold mb-2 text-gray-700">Final Positions Sold:</p>
                                                        <table className="min-w-full text-xs bg-white rounded shadow-sm">
                                                            <thead className="bg-gray-100">
                                                                <tr>
                                                                    <th className="px-2 py-1 text-left">Ticker</th>
                                                                    <th className="px-2 py-1 text-right">Shares</th>
                                                                    <th className="px-2 py-1 text-right">Buy Price</th>
                                                                    <th className="px-2 py-1 text-right">Sell Price</th>
                                                                    <th className="px-2 py-1 text-right">P&L</th>
                                                                    <th className="px-2 py-1 text-right">P&L %</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {wfWindow.portfolio_state.final_positions_sold.map((pos, idx) => (
                                                                    <tr key={idx} className="border-t">
                                                                        <td className="px-2 py-1 font-medium">{pos.ticker}</td>
                                                                        <td className="px-2 py-1 text-right">{pos.shares.toFixed(2)}</td>
                                                                        <td className="px-2 py-1 text-right">${pos.buy_price.toFixed(2)}</td>
                                                                        <td className="px-2 py-1 text-right">${pos.sell_price ? pos.sell_price.toFixed(2) : 'N/A'}</td>
                                                                        <td className={`px-2 py-1 text-right font-medium ${pos.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                            ${pos.pnl.toFixed(2)}
                                                                        </td>
                                                                        <td className={`px-2 py-1 text-right font-medium ${pos.pnl_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                            {pos.pnl_pct.toFixed(2)}%
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {/* Capital Summary */}
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div className="p-2 bg-white rounded shadow-sm">
                                                        <p className="text-xs text-gray-600">Cash After Buy</p>
                                                        <p className="font-bold text-sm">${wfWindow.portfolio_state.capital_after.toFixed(2)}</p>
                                                    </div>
                                                    <div className="p-2 bg-white rounded shadow-sm">
                                                        <p className="text-xs text-gray-600">Portfolio Value</p>
                                                        <p className="font-bold text-sm">${wfWindow.portfolio_state.portfolio_value.toFixed(2)}</p>
                                                    </div>
                                                    <div className={`p-2 bg-white rounded shadow-sm ${wfWindow.portfolio_state.total_return_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        <p className="text-xs text-gray-600">Total Return</p>
                                                        <p className="font-bold text-sm">{wfWindow.portfolio_state.total_return_pct.toFixed(2)}%</p>
                                                    </div>
                                                </div>

                                                {/* Final Summary (for last window) */}
                                                {wfWindow.portfolio_state.final_capital !== undefined && (
                                                    <div className="mt-3 p-3 bg-green-50 rounded border border-green-300">
                                                        <p className="text-xs font-semibold mb-2 text-green-800">Final Portfolio Summary:</p>
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            <div>
                                                                <span className="text-gray-600">Final Capital:</span> <span className="font-bold text-green-700">${wfWindow.portfolio_state.final_capital.toFixed(2)}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-600">Total Return:</span> <span className={`font-bold ${wfWindow.portfolio_state.final_total_return_pct >= 0 ? 'text-green-700' : 'text-red-700'}`}>{wfWindow.portfolio_state.final_total_return_pct.toFixed(2)}%</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (isTrainTestMode) {
        // Train/Test Split Mode
        const { train_period, test_period, train_results, test_results, scores, total_tests, completed_tests } = results;

        // Combine train and test results for display
        const combinedResults = train_results.map((trainResult, index) => ({
            ...trainResult,
            test_cagr: test_results[index]?.cagr || 0,
            test_max_drawdown: test_results[index]?.max_drawdown || 0,
            test_final_value: test_results[index]?.final_value || 0,
            score: scores[index] || 0
        }));

        // Sort combined results
        const sortedResults = [...combinedResults].sort((a, b) => {
            if (sortBy === 'score') return b.score - a.score;
            if (sortBy === 'train_cagr') return b.cagr - a.cagr;
            if (sortBy === 'test_cagr') return b.test_cagr - a.test_cagr;
            if (sortBy === 'train_dd') return b.max_drawdown - a.max_drawdown;
            if (sortBy === 'test_dd') return b.test_max_drawdown - a.test_max_drawdown;
            return 0;
        });

        return (
            <div className="mt-6 p-4 bg-white shadow rounded-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Train/Test Optimization Results</h2>
                    {onSave && (
                        <button
                            onClick={onSave}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition flex items-center"
                        >
                            <span className="mr-2">💾</span> Save Results
                        </button>
                    )}
                </div>

                <div className="mb-4 space-y-2">
                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                        <p className="text-sm font-semibold">
                            Training Period: {train_period.start} to {train_period.end}
                        </p>
                        <p className="text-sm font-semibold">
                            Test Period: {test_period.start} to {test_period.end}
                        </p>
                        <p className="text-sm font-semibold">
                            Completed: {completed_tests} / {total_tests} tests on training period
                        </p>
                        <p className="text-sm text-blue-700 mt-2">
                            ℹ️ Top N selected based on <strong>Scoring</strong> (Test CAGR: 0-60 pts + Test DD: 0-40 pts)
                        </p>
                    </div>

                    <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                        <div className="flex items-center gap-3 flex-wrap">
                            <strong className="text-sm">Sort by:</strong>
                            <button onClick={() => setSortBy('score')} className={`px - 3 py - 1.5 rounded text - sm font - medium ${sortBy === 'score' ? 'bg-purple-600 text-white' : 'bg-gray-200 hover:bg-gray-300'} `}>
                                Score
                            </button>
                            <button onClick={() => setSortBy('train_cagr')} className={`px - 3 py - 1.5 rounded text - sm font - medium ${sortBy === 'train_cagr' ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'} `}>
                                Train CAGR
                            </button>
                            <button onClick={() => setSortBy('test_cagr')} className={`px - 3 py - 1.5 rounded text - sm font - medium ${sortBy === 'test_cagr' ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'} `}>
                                Test CAGR
                            </button>
                            <button onClick={() => setSortBy('train_dd')} className={`px - 3 py - 1.5 rounded text - sm font - medium ${sortBy === 'train_dd' ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'} `}>
                                Train DD
                            </button>
                            <button onClick={() => setSortBy('test_dd')} className={`px - 3 py - 1.5 rounded text - sm font - medium ${sortBy === 'test_dd' ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'} `}>
                                Test DD
                            </button>
                        </div>
                    </div>
                </div>

                {sortedResults && sortedResults.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Broker</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">N</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rebal</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Look</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">SL%</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Strat</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-green-700 uppercase bg-green-50">Train CAGR</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-red-700 uppercase bg-red-50">Train DD</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-green-700 uppercase bg-green-100">Test CAGR</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-red-700 uppercase bg-red-100">Test DD</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-purple-700 uppercase bg-purple-50">Score</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {sortedResults.map((result, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-2 py-2 text-sm">{index + 1}</td>
                                        <td className="px-2 py-2 text-sm">{result.broker === 'interactive_brokers' ? 'IB' : result.broker}</td>
                                        <td className="px-2 py-2 text-sm">{result.n_tickers}</td>
                                        <td className="px-2 py-2 text-sm">{result.rebalance_period}</td>
                                        <td className="px-2 py-2 text-sm">{result.momentum_lookback_days || '-'}</td>
                                        <td className="px-2 py-2 text-sm">{result.stop_loss_pct || '-'}</td>
                                        <td className="px-2 py-2 text-sm">{result.strategy}</td>
                                        <td className="px-2 py-2 text-sm">{result.sizing_method}</td>
                                        <td className="px-2 py-2 text-sm font-semibold text-green-700 bg-green-50">
                                            {(result.cagr * 100).toFixed(2)}%
                                        </td>
                                        <td className="px-2 py-2 text-sm font-semibold text-red-700 bg-red-50">
                                            {(result.max_drawdown * 100).toFixed(2)}%
                                        </td>
                                        <td className="px-2 py-2 text-sm font-semibold text-green-700 bg-green-100">
                                            {(result.test_cagr * 100).toFixed(2)}%
                                        </td>
                                        <td className="px-2 py-2 text-sm font-semibold text-red-700 bg-red-100">
                                            {(result.test_max_drawdown * 100).toFixed(2)}%
                                        </td>
                                        <td className="px-2 py-2 text-sm font-bold text-purple-700 bg-purple-50">
                                            {result.score.toFixed(1)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-gray-500">No results to display.</p>
                )}
            </div>
        );
    }

    // Normal optimization mode (no train/test split)
    const { total_tests, completed_tests, results: testResults } = results;

    return (
        <div className="mt-6 p-4 bg-white shadow rounded-lg">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Optimization Results</h2>
                {onSave && (
                    <button
                        onClick={onSave}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition flex items-center"
                    >
                        <span className="mr-2">💾</span> Save Results
                    </button>
                )}
            </div>

            <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                <p className="text-sm font-semibold">
                    Completed: {completed_tests} / {total_tests} tests
                </p>
            </div>

            {testResults && testResults.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broker</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N Tickers</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rebalance (mo)</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lookback (d)</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filter Neg. Mom.</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stop Loss %</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strategy</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sizing</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">CAGR</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-red-50">Max DD</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-purple-700 uppercase tracking-wider bg-purple-50">Score</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Final Value</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {testResults.map((result, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                    <td className="px-3 py-3 text-sm text-gray-900">{index + 1}</td>
                                    <td className="px-3 py-3 text-sm text-gray-900">
                                        {result.broker === 'interactive_brokers' ? 'IB' : result.broker}
                                    </td>
                                    <td className="px-3 py-3 text-sm text-gray-900">{result.n_tickers}</td>
                                    <td className="px-3 py-3 text-sm text-gray-900">{result.rebalance_period}</td>
                                    <td className="px-3 py-3 text-sm text-gray-900">
                                        {result.momentum_lookback_days || '-'}
                                    </td>
                                    <td className="px-3 py-3 text-sm text-gray-900">
                                        {result.filter_negative_momentum !== undefined ? (result.filter_negative_momentum ? 'Yes' : 'No') : '-'}
                                    </td>
                                    <td className="px-3 py-3 text-sm text-gray-900">
                                        {result.stop_loss_pct || '-'}
                                    </td>
                                    <td className="px-3 py-3 text-sm text-gray-900">{result.strategy}</td>
                                    <td className="px-3 py-3 text-sm text-gray-900">{result.sizing_method}</td>
                                    <td className="px-3 py-3 text-sm font-semibold text-green-700 bg-green-50">
                                        {(result.cagr * 100).toFixed(2)}%
                                    </td>
                                    <td className="px-3 py-3 text-sm font-semibold text-red-700 bg-red-50">
                                        {(result.max_drawdown * 100).toFixed(2)}%
                                    </td>
                                    <td className="px-3 py-3 text-sm font-bold text-purple-700 bg-purple-50">
                                        {result.score ? result.score.toFixed(1) : '-'}
                                    </td>
                                    <td className="px-3 py-3 text-sm text-gray-900">
                                        ${result.final_value.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-gray-500">No results to display.</p>
            )}
        </div>
    );
};

export default OptimizationResults;
