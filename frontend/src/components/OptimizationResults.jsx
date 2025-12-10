import React from 'react';

const OptimizationResults = ({ results, onSave }) => {
    if (!results || !results.results) {
        return null;
    }

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
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    #
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Broker
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    N Tickers
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Rebalance (mo)
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Lookback (d)
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Filter Neg. Mom.
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Stop Loss %
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Strategy
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Sizing
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                                    CAGR
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-red-50">
                                    Max DD
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Final Value
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {testResults.map((result, index) => (
                                <tr key={index} className={index < 3 ? 'bg-yellow-50' : ''}>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                        {result.test_number}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                        {result.broker === 'bossa' ? 'Bossa' : 'IB'}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                        {result.n_tickers}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                        {result.rebalance_period}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                        {result.momentum_lookback_days || '-'}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                        {result.filter_negative_momentum !== undefined ? (result.filter_negative_momentum ? 'Yes' : 'No') : '-'}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                        {result.stop_loss_pct ? `${result.stop_loss_pct}%` : '-'}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                        {result.strategy}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                        {result.sizing_method}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold text-green-700 bg-green-50">
                                        {(result.cagr * 100).toFixed(2)}%
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold text-red-700 bg-red-50">
                                        {(result.max_drawdown * 100).toFixed(2)}%
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                        ${result.final_value.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-gray-500">No results to display</p>
            )}

            <div className="mt-4 text-sm text-gray-600">
                <p className="font-semibold">Legend:</p>
                <ul className="list-disc list-inside mt-2">
                    <li>Results are sorted by CAGR (descending) and Max Drawdown (ascending)</li>
                    <li className="bg-yellow-50 inline-block px-2 py-1 rounded mt-1">Top 3 results highlighted</li>
                    <li>CAGR = Compound Annual Growth Rate</li>
                    <li>Max DD = Maximum Drawdown</li>
                </ul>
            </div>
        </div>
    );
};

export default OptimizationResults;
