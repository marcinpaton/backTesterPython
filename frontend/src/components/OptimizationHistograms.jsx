import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const OptimizationHistograms = ({ results }) => {
    // State for controls
    const [selectedPeriods, setSelectedPeriods] = useState({
        test: true,
        simulation: true,
        training: false
    });
    const [recordType, setRecordType] = useState('top'); // 'top' (per window) or 'all' (if available)
    const [groupingParam, setGroupingParam] = useState('none'); // 'none', 'n_tickers', 'rebalance_period', 'momentum_lookback_days'
    const [binSize, setBinSize] = useState(1); // 1% default

    // Extract data based on selection
    const rawData = useMemo(() => {
        if (!results) return [];

        let extractedData = [];

        // Helper to extract relevant fields
        const extractFields = (result, score, extraContext = {}) => ({
            cagr: result.cagr * 100, // Convert to %
            n_tickers: result.n_tickers,
            rebalance_period: result.rebalance_period,
            momentum_lookback_days: result.momentum_lookback_days || 'N/A',
            test_period_months: result.test_period_months || extraContext.test_period_months || 'N/A',
            score: score
        });

        if (results.walk_forward_mode) {
            // Walk-Forward Mode
            results.windows.forEach(window => {
                // Training Data
                if (selectedPeriods.training) {
                    const sourceList = recordType === 'top' ? window.train_results : (window.all_train_results || window.train_results);
                    if (sourceList) {
                        sourceList.forEach((res, idx) => {
                            extractedData.push(extractFields(res, window.scores?.[idx] || 0, { test_period_months: window.test_period_months }));
                        });
                    }
                }

                // Simulation Data (WF Test Windows)
                if (selectedPeriods.simulation) {
                    const sourceList = recordType === 'top' ? window.test_results : (window.all_test_results || window.test_results);
                    if (sourceList) {
                        sourceList.forEach((res, idx) => {
                            extractedData.push(extractFields(res, window.scores?.[idx] || 0, { test_period_months: window.test_period_months }));
                        });
                    }
                }
            });
        } else if (results.train_test_mode) {
            // Train/Test Mode

            // Training Data
            if (selectedPeriods.training) {
                const sourceList = recordType === 'top' ? results.train_results : (results.all_train_results || results.train_results);
                if (sourceList) {
                    sourceList.forEach((res, idx) => {
                        extractedData.push(extractFields(res, results.scores?.[idx] || 0));
                    });
                }
            }

            // Test Data
            if (selectedPeriods.test) {
                const sourceList = recordType === 'top' ? results.test_results : (results.all_test_results || results.test_results);
                if (sourceList) {
                    sourceList.forEach((res, idx) => {
                        extractedData.push(extractFields(res, results.scores?.[idx] || 0));
                    });
                }
            }

        } else {
            // Normal Mode
            // Maps to 'test' usually as it's the "Result"
            if (selectedPeriods.test) {
                // Normal Mode - implicit extractFields usage
                const sourceList = results.results || results.results?.results || [];
                sourceList.forEach(res => {
                    extractedData.push(extractFields(res, res.score || 0));
                });
            }
        }

        return extractedData;
    }, [results, selectedPeriods, recordType]);

    // Calculate Histogram Data
    const histogramData = useMemo(() => {
        if (!rawData.length) return [];

        // 1. Determine Range
        const cagrs = rawData.map(d => d.cagr);
        // ... (rest is same logic, just groupKey changes)

        // 2. Create Bins
        const bins = {};

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

                {/* ... Period & Record Selection ... */}
                {/* Data Period */}
                <div>
                    <label className="block font-medium text-gray-700 mb-1">Results Period</label>
                    <div className="flex flex-col space-y-2">
                        {/* Show Test for Normal/TrainTest (NOT WF) */}
                        {!results.walk_forward_mode && (
                            <label className="inline-flex items-center">
                                <input
                                    type="checkbox"
                                    checked={selectedPeriods.test}
                                    onChange={(e) => setSelectedPeriods(prev => ({ ...prev, test: e.target.checked }))}
                                    className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-gray-700">Test (OOS)</span>
                            </label>
                        )}

                        {/* Show Simulation for WF */}
                        {results.walk_forward_mode && (
                            <label className="inline-flex items-center">
                                <input
                                    type="checkbox"
                                    checked={selectedPeriods.simulation}
                                    onChange={(e) => setSelectedPeriods(prev => ({ ...prev, simulation: e.target.checked }))}
                                    className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-gray-700">Simulation (Walk-Forward OOS)</span>
                            </label>
                        )}

                        <label className="inline-flex items-center">
                            <input
                                type="checkbox"
                                checked={selectedPeriods.training}
                                onChange={(e) => setSelectedPeriods(prev => ({ ...prev, training: e.target.checked }))}
                                className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-gray-700">Training (In-Sample)</span>
                        </label>
                    </div>
                </div>

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
                        <option value="test_period_months">Test Period (months)</option>
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
                            formatter={(value, name) => [value, groupingParam === 'none' ? 'Count' : `${groupingParam === 'momentum_lookback_days' ? 'Lookback:' : groupingParam === 'test_period_months' ? 'Period:' : groupingParam === 'rebalance_period' ? 'Rebal:' : 'N:'} ${name}`]}
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
