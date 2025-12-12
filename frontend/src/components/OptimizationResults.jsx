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

                {/* Ranked Parameters by Frequency */}
                <div className="mb-6">
                    <h3 className="text-xl font-bold mb-3">Most Consistent Parameters</h3>
                    <p className="text-sm text-gray-600 mb-3">
                        Parameters that appeared more than once in top results (click row for details)
                    </p>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Broker</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">N</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rebal</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Look</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">SL%</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Strat</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-purple-700 uppercase bg-purple-50">Frequency</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-purple-700 uppercase bg-purple-50">% Windows</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {ranked_parameters.filter(p => p.frequency > 1).map((param, index) => (
                                    <tr
                                        key={index}
                                        onClick={() => setSelectedParam(selectedParam === index ? null : index)}
                                        className={`cursor-pointer ${selectedParam === index ? 'bg-purple-200' : 'hover:bg-purple-50'}`}
                                    >
                                        <td className="px-3 py-3 text-sm font-bold">{index + 1}</td>
                                        <td className="px-3 py-3 text-sm">{param.parameters.broker === 'interactive_brokers' ? 'IB' : param.parameters.broker}</td>
                                        <td className="px-3 py-3 text-sm">{param.parameters.n_tickers}</td>
                                        <td className="px-3 py-3 text-sm">{param.parameters.rebalance_period}</td>
                                        <td className="px-3 py-3 text-sm">{param.parameters.momentum_lookback_days || '-'}</td>
                                        <td className="px-3 py-3 text-sm">{param.parameters.stop_loss_pct || '-'}</td>
                                        <td className="px-3 py-3 text-sm">{param.parameters.strategy}</td>
                                        <td className="px-3 py-3 text-sm">{param.parameters.sizing_method}</td>
                                        <td className="px-3 py-3 text-sm font-bold text-purple-700 bg-purple-50">{param.frequency}</td>
                                        <td className="px-3 py-3 text-sm font-bold text-purple-700 bg-purple-50">{param.percentage.toFixed(1)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Parameter Details */}
                    {selectedParam !== null && (() => {
                        const param = ranked_parameters.filter(p => p.frequency > 1)[selectedParam];
                        const matchingResults = [];

                        // Find all results matching this parameter across all windows
                        windows.forEach(window => {
                            // Use all_train_results to search through ALL results, not just top N
                            const allTrainResults = window.all_train_results || window.train_results;
                            const allTestResults = window.all_test_results || window.test_results;
                            const allScores = window.all_scores || window.scores;

                            allTrainResults.forEach((result, idx) => {
                                if (
                                    result.broker === param.parameters.broker &&
                                    result.n_tickers === param.parameters.n_tickers &&
                                    result.rebalance_period === param.parameters.rebalance_period &&
                                    (result.momentum_lookback_days || 0) === (param.parameters.momentum_lookback_days || 0) &&
                                    (result.filter_negative_momentum || false) === (param.parameters.filter_negative_momentum || false) &&
                                    (result.stop_loss_pct || 0) === (param.parameters.stop_loss_pct || 0) &&
                                    result.strategy === param.parameters.strategy &&
                                    result.sizing_method === param.parameters.sizing_method
                                ) {
                                    matchingResults.push({
                                        window_number: window.window_number,
                                        window_period: `${window.window.train_start} → ${window.window.test_end}`,
                                        train_cagr: result.cagr,
                                        train_dd: result.max_drawdown,
                                        test_cagr: allTestResults[idx]?.cagr,
                                        test_dd: allTestResults[idx]?.max_drawdown,
                                        score: allScores[idx]
                                    });
                                }
                            });
                        });

                        console.log('Total matching results found:', matchingResults.length, 'across', windows.length, 'windows');
                        console.log('Selected param:', param.parameters);

                        return (
                            <div className="mt-4 p-4 bg-purple-100 rounded border border-purple-300">
                                <h4 className="font-bold mb-3">Results for Selected Parameters Across All Windows</h4>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-2 py-2 text-left">Window</th>
                                                <th className="px-2 py-2 text-left">Period</th>
                                                <th className="px-2 py-2 text-left bg-green-50">Train CAGR</th>
                                                <th className="px-2 py-2 text-left bg-red-50">Train DD</th>
                                                <th className="px-2 py-2 text-left bg-green-100">Test CAGR</th>
                                                <th className="px-2 py-2 text-left bg-red-100">Test DD</th>
                                                <th className="px-2 py-2 text-left bg-purple-50">Score</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {matchingResults.map((result, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="px-2 py-2">{result.window_number}</td>
                                                    <td className="px-2 py-2 text-xs">{result.window_period}</td>
                                                    <td className="px-2 py-2 bg-green-50">{(result.train_cagr * 100).toFixed(2)}%</td>
                                                    <td className="px-2 py-2 bg-red-50">{(result.train_dd * 100).toFixed(2)}%</td>
                                                    <td className="px-2 py-2 bg-green-100">{(result.test_cagr * 100).toFixed(2)}%</td>
                                                    <td className="px-2 py-2 bg-red-100">{(result.test_dd * 100).toFixed(2)}%</td>
                                                    <td className="px-2 py-2 bg-purple-50 font-bold">{result.score?.toFixed(1)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}
                </div>

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
