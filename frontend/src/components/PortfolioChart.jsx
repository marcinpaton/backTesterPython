import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
                        <Tooltip
                            formatter={(value) => [`${value.toFixed(2)} PLN`, "Total Value"]}
                            labelFormatter={(label) => `Date: ${label}`}
                        />
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
