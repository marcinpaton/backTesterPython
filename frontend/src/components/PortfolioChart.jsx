import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white p-3 border border-gray-200 shadow-lg rounded text-sm">
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
                        <p className="text-xs text-gray-500 mb-1 font-semibold">Asset Prices:</p>
                        {data.details.map((item, index) => (
                            <div key={index} className="flex justify-between gap-4 text-xs">
                                <span>{item.ticker}:</span>
                                <span className="text-gray-700">
                                    {item.price_native.toFixed(2)} {item.currency}
                                    {item.currency !== 'PLN' && (
                                        <span className="text-gray-400 ml-1">
                                            (~{item.price_pln.toFixed(2)} PLN)
                                        </span>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }
    return null;
};

const PortfolioChart = ({ data }) => {
    if (!data || data.length === 0) return <p className="text-gray-500">No performance data available.</p>;

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4 text-gray-700">Portfolio Value Over Time</h3>
            <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{
                            top: 10,
                            right: 30,
                            left: 0,
                            bottom: 0,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(str) => str.slice(0, 10)}
                            minTickGap={30}
                        />
                        <YAxis
                            domain={['auto', 'auto']}
                            tickFormatter={(val) => `${val.toFixed(0)} PLN`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="total_value"
                            stroke="#2563eb"
                            fill="#3b82f6"
                            fillOpacity={0.1}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default PortfolioChart;
