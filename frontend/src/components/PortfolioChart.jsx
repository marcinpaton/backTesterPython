import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts';

const COLORS = [
    '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899',
    '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#a855f7'
];

const BarTooltip = ({ active, payload, label, mode }) => {
    if (active && payload && payload.length) {
        const originalData = payload[0].payload;
        const total = originalData.total_value;

        return (
            <div className="bg-white p-3 border border-gray-200 shadow-lg rounded text-sm z-50">
                <p className="font-bold mb-2">{label}</p>
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100">
                    <span className="text-gray-600 font-semibold mr-4">Total Value:</span>
                    <span className="text-blue-600 font-bold">{total?.toFixed(2)} PLN</span>
                </div>
                {originalData.mtd_return !== undefined && (
                    <p className={`text-xs font-bold mb-2 ${originalData.mtd_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        MTD Return: {(originalData.mtd_return * 100).toFixed(2)}%
                    </p>
                )}
                <div className="space-y-1">
                    {[...payload].reverse().map((entry, index) => {
                        // Find details for this ticker
                        const detail = originalData.details?.find(d => d.ticker === entry.name);
                        let displayValue = `${entry.value?.toFixed(2)} PLN`;
                        let colorClass = "text-gray-700";

                        if (mode === 'pnl' && detail && detail.return_pct !== undefined) {
                            const pnl = detail.return_pct * 100;
                            displayValue = `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%`;
                            colorClass = pnl >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold";
                        }

                        return (
                            <div key={index} className="flex justify-between gap-4 text-xs">
                                <span style={{ color: entry.color }} className="font-semibold">
                                    {entry.name}:
                                </span>
                                <span className={colorClass}>
                                    {displayValue}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    return null;
};

const AreaTooltip = ({ active, payload, label, mode }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white p-3 border border-gray-200 shadow-lg rounded text-sm z-50">
                <p className="font-bold mb-2">{label}</p>
                <p className="text-blue-600 font-semibold mb-1">
                    Total Value: {data.total_value.toFixed(2)} PLN
                </p>
                {data.mtd_return !== undefined && (
                    <p className={`text-xs font-bold mb-2 ${data.mtd_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        MTD Return: {(data.mtd_return * 100).toFixed(2)}%
                    </p>
                )}
                {data.details && data.details.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-1 font-semibold">{mode === 'pnl' ? 'Asset P&L:' : 'Asset Prices:'}</p>
                        {data.details.map((item, index) => {
                            if (mode === 'pnl') {
                                const pnl = (item.return_pct || 0) * 100;
                                return (
                                    <div key={index} className="flex justify-between gap-4 text-xs">
                                        <span>{item.ticker}:</span>
                                        <span className={pnl >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                                            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                                        </span>
                                    </div>
                                );
                            }
                            return (
                                <div key={index} className="flex justify-between gap-4 text-xs">
                                    <span>{item.ticker} ({item.shares}):</span>
                                    <span className="text-gray-700">
                                        {item.price_native.toFixed(2)} {item.currency}
                                        {item.currency !== 'PLN' && (
                                            <span className="text-gray-400 ml-1">
                                                (~{item.price_pln.toFixed(2)} PLN)
                                            </span>
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }
    return null;
};

const PortfolioChart = ({ data, onDownloadPrices }) => {
    const [chartType, setChartType] = useState('area'); // 'bar' or 'area'
    const [tooltipMode, setTooltipMode] = useState('price'); // 'price' or 'pnl'

    if (!data || data.length === 0) return <p className="text-gray-500">No performance data available.</p>;

    // Identify start of each month for vertical lines
    const startOfMonthDates = useMemo(() => {
        const dates = [];
        let lastMonth = null;

        // Sort data by date just in case
        const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));

        sortedData.forEach(day => {
            const dateObj = new Date(day.date);
            const currentMonth = dateObj.getMonth();
            const currentYear = dateObj.getFullYear();
            const monthKey = `${currentYear}-${currentMonth}`;

            if (lastMonth !== monthKey) {
                // It's a new month!
                // Skip the very first data point if it's the start of the chart's history to avoid line on Y-axis
                if (lastMonth !== null) {
                    dates.push(day.date);
                }
                lastMonth = monthKey;
            }
        });
        return dates;
    }, [data]);

    // Prepare data for Bar Chart (Composition)
    const { chartData, tickers } = useMemo(() => {
        const uniqueTickers = new Set();

        const transformed = data.map(day => {
            const entry = {
                date: day.date,
                Cash: day.cash,
                total_value: day.total_value, // For tooltip
                mtd_return: day.mtd_return,
                details: day.details // Also pass details for potential usage
            };

            if (day.details) {
                day.details.forEach(d => {
                    entry[d.ticker] = d.value_pln;
                    uniqueTickers.add(d.ticker);
                });
            }
            return entry;
        });

        return { chartData: transformed, tickers: Array.from(uniqueTickers) };
    }, [data]);

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-700">
                    {chartType === 'bar' ? 'Portfolio Composition (PLN)' : 'Portfolio Value Over Time'}
                </h3>
                <div className="flex items-center space-x-4">
                    {onDownloadPrices && (
                        <button
                            onClick={onDownloadPrices}
                            className="bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold py-1 px-3 rounded text-sm transition-colors"
                            title="Download prices for tickers in your transactions"
                        >
                            Download Prices
                        </button>
                    )}
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setChartType('bar')}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${chartType === 'bar'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Composition
                        </button>
                        <button
                            onClick={() => setChartType('area')}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${chartType === 'area'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Total Value
                        </button>
                    </div>
                </div>
            </div>

            <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                        <BarChart
                            data={chartData}
                            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            {startOfMonthDates.map(date => (
                                <ReferenceLine key={date} x={date} stroke="red" strokeWidth={2} />
                            ))}
                            <XAxis
                                dataKey="date"
                                tickFormatter={(str) => str.slice(0, 10)}
                                minTickGap={30}
                            />
                            <YAxis
                                tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                            />
                            <Tooltip content={<BarTooltip mode={tooltipMode} />} />
                            <Legend />
                            {/* Cash Bar (Base) */}
                            <Bar dataKey="Cash" stackId="a" fill="#22c55e" />
                            {/* Ticker Bars */}
                            {tickers.map((ticker, index) => (
                                <Bar
                                    key={ticker}
                                    dataKey={ticker}
                                    stackId="a"
                                    fill={COLORS[index % COLORS.length]}
                                />
                            ))}
                        </BarChart>
                    ) : (
                        <AreaChart
                            data={data}
                            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            {startOfMonthDates.map(date => (
                                <ReferenceLine key={date} x={date} stroke="#fcd34d" strokeWidth={2} strokeDasharray="3 3" />
                            ))}
                            <XAxis
                                dataKey="date"
                                tickFormatter={(str) => str.slice(0, 10)}
                                minTickGap={30}
                            />
                            <YAxis
                                domain={['auto', 'auto']}
                                tickFormatter={(val) => `${val.toFixed(0)} PLN`}
                            />
                            <Tooltip content={<AreaTooltip mode={tooltipMode} />} />
                            <Area
                                type="monotone"
                                dataKey="total_value"
                                stroke="#2563eb"
                                fill="#3b82f6"
                                fillOpacity={0.1}
                            />
                        </AreaChart>
                    )}
                </ResponsiveContainer>
            </div>

            <div className="flex justify-center mt-4 space-x-4">
                <span className="text-sm font-medium text-gray-500 pt-1">Tooltip:</span>
                <button
                    onClick={() => setTooltipMode('price')}
                    className={`px-3 py-1 text-sm font-medium rounded-full border ${tooltipMode === 'price'
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                >
                    Show prices
                </button>
                <button
                    onClick={() => setTooltipMode('pnl')}
                    className={`px-3 py-1 text-sm font-medium rounded-full border ${tooltipMode === 'pnl'
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                >
                    Show P&L
                </button>
            </div>
        </div>
    );
};

export default PortfolioChart;
