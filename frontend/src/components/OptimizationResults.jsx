import React, { useState } from 'react';

const OptimizationResults = ({ results, onSave }) => {
    const [sortBy, setSortBy] = useState('train_cagr');

    if (!results) {
        return null;
    }

    // Check if this is train/test mode
    const isTrainTestMode = results.train_test_mode === true;

    if (isTrainTestMode) {
        // Train/Test Split Mode
        const { train_period, test_period, train_results, test_results, total_tests, completed_tests } = results;

        // Combine train and test results for display
        const combinedResults = train_results.map((trainResult, index) => ({
            ...trainResult,
            test_cagr: test_results[index]?.cagr || 0,
            test_max_drawdown: test_results[index]?.max_drawdown || 0,
            test_final_value: test_results[index]?.final_value || 0
        }));

        // Sort combined results
        const sortedResults = [...combinedResults].sort((a, b) => {
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
                    </div>

                    <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                        <p className="text-sm">
                            <strong>Sort by:</strong>
                            <button onClick={() => setSortBy('train_cagr')} className={`ml-2 px-2 py-1 rounded text-xs ${sortBy === 'train_cagr' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                                Train CAGR
                            </button>
                            <button onClick={() => setSortBy('test_cagr')} className={`ml-2 px-2 py-1 rounded text-xs ${sortBy === 'test_cagr' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                                Test CAGR
                            </button>
                            <button onClick={() => setSortBy('train_dd')} className={`ml-2 px-2 py-1 rounded text-xs ${sortBy === 'train_dd' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                                Train DD
                            </button>
                            <button onClick={() => setSortBy('test_dd')} className={`ml-2 px-2 py-1 rounded text-xs ${sortBy === 'test_dd' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                                Test DD
                            </button>
                        </p>
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
