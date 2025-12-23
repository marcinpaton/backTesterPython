import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const OptimizationHistograms = ({ results }) => {
    // State for controls
    const [periodType, setPeriodType] = useState('test'); // 'test' or 'train' or 'simulation' (if WF)
    const [recordType, setRecordType] = useState('top'); // 'top' (per window) or 'all' (if available)
    const [groupingParam, setGroupingParam] = useState('none'); // 'none', 'n_tickers', 'rebalance_period', 'momentum_lookback_days'
    const [binSize, setBinSize] = useState(1); // 1% default

    // Extract data based on selection
    const rawData = useMemo(() => {
        if (!results) return [];

        let extractedData = [];

        // Helper to extract relevant fields
        const extractFields = (result, score) => ({
            cagr: result.cagr * 100, // Convert to %
            n_tickers: result.n_tickers,
            rebalance_period: result.rebalance_period,
            momentum_lookback_days: result.momentum_lookback_days || 'N/A',
            score: score
        });

        if (results.walk_forward_mode) {
            // Walk-Forward Mode
            results.windows.forEach(window => {
                // Determine source list based on recordType
                let sourceList;
                if (recordType === 'top') {
                    // Top results per window
                    sourceList = periodType === 'test' ? window.test_results : window.train_results;
                } else {
                    // All results (if available)
                    sourceList = periodType === 'test' ? (window.all_test_results || window.test_results) : (window.all_train_results || window.train_results);
                }

                if (sourceList) {
                    sourceList.forEach((res, idx) => {
                        extractedData.push(extractFields(res, window.scores?.[idx] || 0));
                    });
                }
            });
        } else if (results.train_test_mode) {
            // Train/Test Mode
            let sourceList;
            if (recordType === 'top') {
                sourceList = periodType === 'test' ? results.test_results : results.train_results;
            } else {
                sourceList = periodType === 'test' ? (results.all_test_results || results.test_results) : (results.all_train_results || results.train_results);
            }

            if (sourceList) {
                sourceList.forEach((res, idx) => {
                    extractedData.push(extractFields(res, results.scores?.[idx] || 0));
                });
            }

        } else {
            // Normal Mode
            // Only 'test' (which is the main result) applies really, but let's handle it
            // 'train' doesn't exist here usually (unless specifically mapped)
            const sourceList = results.results || [];
            sourceList.forEach(res => {
                extractedData.push(extractFields(res, res.score || 0));
            });
        }

        return extractedData;
    }, [results, periodType, recordType]);

    // Calculate Histogram Data
    const histogramData = useMemo(() => {
        if (!rawData.length) return [];

        // 1. Determine Range
        const cagrs = rawData.map(d => d.cagr);
        const minCagr = Math.floor(Math.min(...cagrs));
        const maxCagr = Math.ceil(Math.max(...cagrs));

        // 2. Create Bins
        const bins = {};
        // Initialize bins (optional, but good for continuous axis)
        // for (let i = minCagr; i <= maxCagr; i += binSize) {
        //     bins[i] = {}; 
        // }

        // 3. Group and Count
        rawData.forEach(item => {
            // Calculate bin floor
            const binFloor = Math.floor(item.cagr / binSize) * binSize;

            if (!bins[binFloor]) bins[binFloor] = { bin: binFloor };

            // Grouping Key
            let groupKey = 'All';
            if (groupingParam !== 'none') {
                groupKey = `${item[groupingParam]}`;
            }

            if (!bins[binFloor][groupKey]) {
                bins[binFloor][groupKey] = 0;
            }
            bins[binFloor][groupKey]++;
        });

        // 4. Format for Recharts
        // Recharts expects array of objects: [{ bin: 10, '5': 4, '10': 2 }, { bin: 11, ... }]
        const chartData = Object.values(bins).sort((a, b) => a.bin - b.bin);
        return chartData;

    }, [rawData, binSize, groupingParam]);

    // Identify unique keys for Bar generation (e.g., "5", "10" for n_tickers)
    const dataKeys = useMemo(() => {
        const keys = new Set();
        histogramData.forEach(item => {
            Object.keys(item).forEach(k => {
                if (k !== 'bin') keys.add(k);
            });
        });
        return Array.from(keys).sort((a, b) => {
            // Try numeric sort
            const numA = parseFloat(a);
            const numB = parseFloat(b);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b);
        });
    }, [histogramData]);

    // Colors for different groups
    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f', '#ffbb28', '#ff8042'];

    return (
        <div className="p-4 bg-white rounded-lg border border-gray-200 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded text-sm">

                {/* Data Period */}
                <div>
                    <label className="block font-medium text-gray-700 mb-1">Results Period</label>
                    <div className="flex rounded-md shadow-sm" role="group">
                        <button
                            onClick={() => setPeriodType('test')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-l-lg border ${periodType === 'test' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                        >
                            Test / Simulation
                        </button>
                        <button
                            onClick={() => setPeriodType('train')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-r-lg border ${periodType === 'train' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                        >
                            Training
                        </button>
                    </div>
                </div>

                {/* Record Selection */}
                <div>
                    <label className="block font-medium text-gray-700 mb-1">Records Included</label>
                    <div className="flex rounded-md shadow-sm" role="group">
                        <button
                            onClick={() => setRecordType('top')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-l-lg border ${recordType === 'top' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                        >
                            Top Records (Winners)
                        </button>
                        <button
                            onClick={() => setRecordType('all')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-r-lg border ${recordType === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                        >
                            All Records (If Available)
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        {recordType === 'all' && "Note: 'All' requires full optimization history in file."}
                    </p>
                </div>

                {/* Grouping Parameter */}
                <div>
                    <label className="block font-medium text-gray-700 mb-1">Group By (Color)</label>
                    <select
                        value={groupingParam}
                        onChange={(e) => setGroupingParam(e.target.value)}
                        className="block w-full text-xs border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-1.5 border"
                    >
                        <option value="none">None (Total Count)</option>
                        <option value="n_tickers">N Tickers</option>
                        <option value="rebalance_period">Rebalance Period</option>
                        <option value="momentum_lookback_days">Momentum Lookback</option>
                    </select>
                </div>

                {/* Bin Size */}
                <div>
                    <label className="block font-medium text-gray-700 mb-1">Bin Size (Accuracy)</label>
                    <select
                        value={binSize}
                        onChange={(e) => setBinSize(parseInt(e.target.value))}
                        className="block w-full text-xs border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-1.5 border"
                    >
                        <option value="1">1%</option>
                        <option value="2">2%</option>
                        <option value="5">5%</option>
                        <option value="10">10%</option>
                    </select>
                </div>
            </div>

            {/* Chart */}
            <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={histogramData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="bin"
                            label={{ value: 'CAGR (%)', position: 'bottom', offset: 0 }}
                            tickFormatter={(val) => `${val}%`}
                        />
                        <YAxis
                            label={{ value: 'Frequency (Count)', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip
                            formatter={(value, name) => [value, groupingParam === 'none' ? 'Count' : `${groupingParam === 'momentum_lookback_days' ? 'Lookback:' : groupingParam === 'rebalance_period' ? 'Rebal:' : 'N:'} ${name}`]}
                            labelFormatter={(label) => `CAGR Range: ${label}% - ${label + binSize}%`}
                        />
                        <Legend />
                        {dataKeys.map((key, index) => (
                            <Bar
                                key={key}
                                dataKey={key}
                                stackId="a"
                                fill={colors[index % colors.length]}
                                name={groupingParam === 'none' ? 'Total' : `${key}`}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <p className="text-center text-sm text-gray-500 mt-2">
                Histogram showing distribution of CAGR results.
                X-axis: CAGR bins (approx {binSize}%). Y-axis: Number of occurrences.
            </p>
        </div>
    );
};

export default OptimizationHistograms;
