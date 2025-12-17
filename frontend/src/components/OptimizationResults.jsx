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
                    {onSave && (
                        <button
                            onClick={onSave}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition flex items-center"
                        >
                            <span className="mr-2">💾</span> Save Results
                        </button>
                    )}
                </div>

                <div className="mb-4 p-3 bg-purple-50 rounded border border-purple-200">
                    <p className="text-sm font-semibold">
                        Total Windows: {total_windows} | Train: {train_period_months}mo | Test: {test_period_months}mo | Step: {step_months}mo
                    </p>
                </div>

                {/* Aggregated Performance for all ranking positions */}
                {(() => {
                    // Determine how many results to show (minimum across all windows)
                    const minResults = Math.min(...windows.map(w => w.test_results?.length || 0));

                    // Helper function to render aggregated performance for a specific rank
                    const renderAggregatedPerformance = (rankIndex) => {
                        const rankLabel = rankIndex + 1; // 1-indexed for display

                        // Calculate geometric mean of Test CAGR from nth result of each window
                        const testCAGRs = windows.map(w => w.test_results[rankIndex]?.cagr || 0);
                        const testDDs = windows.map(w => w.test_results[rankIndex]?.max_drawdown || 0);

                        // Geometric mean: ((1+r1) * (1+r2) * ... * (1+rn))^(1/n) - 1
                        const product = testCAGRs.reduce((acc, cagr) => acc * (1 + cagr), 1);
                        const aggregatedCAGR = Math.pow(product, 1 / testCAGRs.length) - 1;

                        // Average drawdown
                        const avgDD = testDDs.reduce((sum, dd) => sum + dd, 0) / testDDs.length;

                        // Capital simulation: start with 10,000 and apply each window's Test CAGR
                        const initialCapital = 10000;
                        let capital = initialCapital;
                        const capitalGrowth = [initialCapital];

                        testCAGRs.forEach(cagr => {
                            capital = capital * (1 + cagr);
                            capitalGrowth.push(capital);
                        });

                        const finalCapital = capitalGrowth[capitalGrowth.length - 1];
                        const totalReturn = ((finalCapital - initialCapital) / initialCapital) * 100;

                        return (
                            <div key={rankIndex} className="mb-6 p-4 bg-green-50 rounded border border-green-300">
                                <h3 className="text-lg font-bold text-green-900 mb-2">
                                    Aggregated Performance - Rank #{rankLabel} from Each Window
                                </h3>

                                {/* Warning for overlapping periods - only show once for rank 1 */}
                                {rankIndex === 0 && test_period_months > step_months && (
                                    <div className="mb-3 p-3 bg-yellow-50 border border-yellow-400 rounded">
                                        <div className="flex items-start">
                                            <span className="text-yellow-600 mr-2">⚠️</span>
                                            <div className="text-xs text-yellow-800">
                                                <p className="font-semibold mb-1">Overlapping Test Periods Detected</p>
                                                <p>Test period ({test_period_months}mo) is longer than step size ({step_months}mo), causing {test_period_months - step_months} months of overlap between windows.
                                                    Aggregated CAGR and capital simulation may be misleading as they assume non-overlapping sequential periods.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div>
                                        <p className="text-xs text-gray-600">Aggregated Test CAGR</p>
                                        <p className="text-2xl font-bold text-green-700">{(aggregatedCAGR * 100).toFixed(2)}%</p>
                                        <p className="text-xs text-gray-500 mt-1">Geometric mean of {testCAGRs.length} windows</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-600">Average Test Max Drawdown</p>
                                        <p className="text-2xl font-bold text-red-700">{(avgDD * 100).toFixed(2)}%</p>
                                        <p className="text-xs text-gray-500 mt-1">Arithmetic mean of {testDDs.length} windows</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-600">Simulated Final Capital</p>
                                        <p className="text-2xl font-bold text-blue-700">${finalCapital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        <p className="text-xs text-gray-500 mt-1">From $10,000 initial ({totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(1)}%)</p>
                                    </div>
                                </div>

                                {/* Capital growth bar chart */}
                                <div className="mt-3 p-3 bg-white rounded border border-green-200">
                                    <p className="text-xs font-semibold text-gray-700 mb-3">Capital Growth Through Windows:</p>
                                    <div className="flex items-end justify-between gap-1" style={{ height: '160px' }}>
                                        {/* Initial capital bar */}
                                        <div className="flex flex-col items-center justify-end flex-1">
                                            <div className="text-xs font-semibold text-gray-700 mb-1">
                                                ${initialCapital.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                            </div>
                                            <div
                                                className="w-full bg-gray-400 rounded-t"
                                                style={{ height: `${Math.max((initialCapital / finalCapital) * 120, 20)}px` }}
                                            />
                                            <div className="text-xs text-gray-600 mt-1">Start</div>
                                        </div>

                                        {/* Window bars */}
                                        {capitalGrowth.slice(1).map((cap, idx) => {
                                            const isPositive = idx === 0 ? cap >= initialCapital : cap >= capitalGrowth[idx];
                                            return (
                                                <div key={idx} className="flex flex-col items-center justify-end flex-1">
                                                    <div className="text-xs font-semibold text-gray-700 mb-1">
                                                        ${cap.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                                    </div>
                                                    <div
                                                        className={`w-full rounded-t ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}
                                                        style={{ height: `${Math.max((cap / finalCapital) * 120, 20)}px` }}
                                                    />
                                                    <div className="text-xs text-gray-600 mt-1">W{idx + 1}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    };

                    // Render aggregated performance for each ranking position
                    return (
                        <>
                            {Array.from({ length: minResults }, (_, i) => renderAggregatedPerformance(i))}
                        </>
                    );
                })()}

                {/* Individual Windows */}
                <div>
                    <h3 className="text-xl font-bold mb-3">Individual Windows</h3>
                    <div className="space-y-2">
                        {windows.map((window) => (
                            <div key={window.window_number} className="border border-gray-300 rounded">
                                <button
                                    onClick={() => setExpandedWindow(expandedWindow === window.window_number ? null : window.window_number)}
                                    className="w-full px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
                                >
                                    <span className="font-medium">
                                        Window {window.window_number}: {window.window.train_start} → {window.window.test_end}
                                    </span>
                                    <span>{expandedWindow === window.window_number ? '▼' : '▶'}</span>
                                </button>

                                {expandedWindow === window.window_number && (
                                    <div className="p-4 bg-white">
                                        <p className="text-sm mb-2">
                                            <strong>Train:</strong> {window.window.train_start} to {window.window.train_end} |
                                            <strong className="ml-2">Test:</strong> {window.window.test_start} to {window.window.test_end}
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
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {window.train_results.map((result, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50">
                                                            <td className="px-2 py-2">{idx + 1}</td>
                                                            <td className="px-2 py-2">{result.broker === 'interactive_brokers' ? 'IB' : result.broker}</td>
                                                            <td className="px-2 py-2">{result.n_tickers}</td>
                                                            <td className="px-2 py-2">{result.rebalance_period}</td>
                                                            <td className="px-2 py-2">{result.momentum_lookback_days || '-'}</td>
                                                            <td className="px-2 py-2 bg-green-50">{(result.cagr * 100).toFixed(2)}%</td>
                                                            <td className="px-2 py-2 bg-red-50">{(result.max_drawdown * 100).toFixed(2)}%</td>
                                                            <td className="px-2 py-2 bg-green-100">{(window.test_results[idx]?.cagr * 100).toFixed(2)}%</td>
                                                            <td className="px-2 py-2 bg-red-100">{(window.test_results[idx]?.max_drawdown * 100).toFixed(2)}%</td>
                                                            <td className="px-2 py-2 bg-purple-50 font-bold">{window.scores[idx]?.toFixed(1)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
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
