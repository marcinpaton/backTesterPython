import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ResultsDashboard = ({ results }) => {
    if (!results) return null;

    const { total_return, cagr, final_value, monthly_returns, history } = results;

    return (
        <div className="space-y-6">
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-gray-500 text-sm uppercase">Total Return</h3>
                    <p className="text-2xl font-bold text-green-600">{(total_return * 100).toFixed(2)}%</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-gray-500 text-sm uppercase">CAGR</h3>
                    <p className="text-2xl font-bold text-blue-600">{(cagr * 100).toFixed(2)}%</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-gray-500 text-sm uppercase">Max Drawdown</h3>
                    <p className="text-2xl font-bold text-red-600">{(results.max_drawdown * 100).toFixed(2)}%</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-gray-500 text-sm uppercase">Final Value</h3>
                    <p className="text-2xl font-bold text-gray-800">${final_value.toFixed(2)}</p>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-white p-4 rounded-lg shadow h-96">
                <h3 className="text-lg font-bold mb-4">Portfolio Value Over Time</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={['auto', 'auto']} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="total_value" stroke="#8884d8" name="Portfolio Value" />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Combined History */}
            <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-lg font-bold mb-4">History (Returns & Rebalancing)</h3>
                <div className="space-y-4">
                    {(() => {
                        // Merge and sort events
                        const events = [];

                        // Add monthly returns
                        Object.entries(monthly_returns).forEach(([month, ret]) => {
                            events.push({
                                type: 'monthly_return',
                                date: month, // "YYYY-MM"
                                sortDate: month + '-31', // Approximate end of month for sorting
                                value: ret
                            });
                        });

                        // Add rebalancing events
                        if (results.rebalance_history) {
                            results.rebalance_history.forEach(event => {
                                events.push({
                                    type: 'rebalance',
                                    date: event.date,
                                    sortDate: event.date,
                                    data: event
                                });
                            });
                        }

                        // Sort by date
                        events.sort((a, b) => a.sortDate.localeCompare(b.sortDate));

                        return events.map((event, index) => {
                            if (event.type === 'monthly_return') {
                                return (
                                    <div key={`mr-${index}`} className="flex justify-between items-center bg-gray-100 p-3 rounded">
                                        <span className="font-medium text-gray-700">Monthly Return ({event.date})</span>
                                        <span className={`font-bold ${event.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {(event.value * 100).toFixed(2)}%
                                        </span>
                                    </div>
                                );
                            } else {
                                const { sold, bought, type, tax, annual_pnl, taxable_profit, loss_deductions, remaining_losses } = event.data;
                                const isStopLoss = type === 'stop_loss' || type === 'stop_loss_smart';
                                const isTaxSettlement = type === 'tax_settlement';

                                if (isTaxSettlement) {
                                    return (
                                        <div key={`tax-${index}`} className="border rounded p-3 bg-white border-yellow-200">
                                            <div className="font-semibold text-yellow-800 bg-yellow-50 p-2 rounded mb-2 flex justify-between">
                                                <span>💰 Tax Settlement</span>
                                                <span>{event.date}</span>
                                            </div>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Annual P&L:</span>
                                                    <span className={`font-bold ${annual_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        ${annual_pnl?.toFixed(2) || '0.00'}
                                                    </span>
                                                </div>
                                                {loss_deductions && loss_deductions.length > 0 && (
                                                    <div className="bg-blue-50 p-2 rounded">
                                                        <div className="font-semibold text-blue-800 mb-1">Loss Carryforward Applied:</div>
                                                        {loss_deductions.map((deduction, idx) => (
                                                            <div key={idx} className="text-xs text-blue-700 flex justify-between">
                                                                <span>From {deduction.year}:</span>
                                                                <span>-${deduction.deduction?.toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Taxable Profit:</span>
                                                    <span className="font-bold text-gray-800">
                                                        ${taxable_profit?.toFixed(2) || '0.00'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between border-t pt-2">
                                                    <span className="font-semibold text-gray-700">Tax Paid:</span>
                                                    <span className="font-bold text-red-600">
                                                        ${tax?.toFixed(2) || '0.00'}
                                                    </span>
                                                </div>
                                                {remaining_losses && remaining_losses.length > 0 && (
                                                    <div className="bg-gray-50 p-2 rounded mt-2">
                                                        <div className="font-semibold text-gray-700 mb-1 text-xs">Remaining Losses:</div>
                                                        {remaining_losses.map((loss, idx) => (
                                                            <div key={idx} className="text-xs text-gray-600 flex justify-between">
                                                                <span>Year {loss[0]}:</span>
                                                                <span>${loss[1]?.toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }

                                // Annual Summary
                                const isAnnualSummary = type === 'annual_summary';
                                if (isAnnualSummary) {
                                    const { year, year_start_value, year_end_value, annual_pnl_dollars, annual_pnl_percent } = event.data;
                                    return (
                                        <div key={`annual-${index}`} className="border rounded p-3 bg-white border-purple-200">
                                            <div className="font-semibold text-purple-800 bg-purple-50 p-2 rounded mb-2 flex justify-between">
                                                <span>📊 Annual Summary - {year}</span>
                                                <span>{event.date}</span>
                                            </div>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Year Start Value:</span>
                                                    <span className="font-bold text-gray-800">
                                                        ${year_start_value?.toFixed(2) || '0.00'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Year End Value:</span>
                                                    <span className="font-bold text-gray-800">
                                                        ${year_end_value?.toFixed(2) || '0.00'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between border-t pt-2">
                                                    <span className="font-semibold text-gray-700">P&L (Dollars):</span>
                                                    <span className={`font-bold ${annual_pnl_dollars >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {annual_pnl_dollars >= 0 ? '+' : ''}${annual_pnl_dollars?.toFixed(2) || '0.00'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="font-semibold text-gray-700">P&L (Percent):</span>
                                                    <span className={`font-bold ${annual_pnl_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {annual_pnl_percent >= 0 ? '+' : ''}{(annual_pnl_percent * 100)?.toFixed(2) || '0.00'}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }


                                return (
                                    <div key={`rb-${index}`} className={`border rounded p-3 bg-white ${isStopLoss ? 'border-red-200' : 'border-blue-200'}`}>
                                        <div className={`font-semibold ${isStopLoss ? 'text-red-800 bg-red-50' : 'text-blue-800 bg-blue-50'} p-2 rounded mb-2 flex justify-between`}>
                                            <span>{isStopLoss ? 'Stop Loss Triggered' : 'Rebalancing Event'}</span>
                                            <span>{event.date}</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <h4 className="text-sm font-bold text-red-600 mb-1">Sold</h4>
                                                {Object.keys(sold).length === 0 ? (
                                                    <p className="text-sm text-gray-500">Nothing sold</p>
                                                ) : (
                                                    <ul className="text-sm space-y-1">
                                                        {Object.entries(sold).map(([ticker, data]) => (
                                                            <li key={ticker} className="flex justify-between">
                                                                <span>{ticker}</span>
                                                                <span className={data.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                                    {data.profit >= 0 ? '+' : ''}{data.profit.toFixed(2)} ({(data.return_pct * 100).toFixed(2)}%)
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-green-600 mb-1">Bought</h4>
                                                {bought.length === 0 ? (
                                                    <p className="text-sm text-gray-500">Nothing bought</p>
                                                ) : (
                                                    <div className="flex flex-wrap gap-2">
                                                        {bought.map((item, index) => {
                                                            // Handle both old format (string) and new format (object)
                                                            const ticker = typeof item === 'string' ? item : item.ticker;
                                                            const score = typeof item === 'string' ? null : item.score;

                                                            return (
                                                                <span key={`${ticker}-${index}`} className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded flex items-center">
                                                                    <span className="font-bold">{ticker}</span>
                                                                    {score !== null && score !== undefined && (
                                                                        <span className="ml-1 text-green-600">
                                                                            ({score.toFixed(2)})
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                        });
                    })()}
                </div>
            </div>
        </div>
    );
};

export default ResultsDashboard;
