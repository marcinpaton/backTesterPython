import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

const OptimizationHistograms = ({ results }) => {
    // State for controls
    const [selectedPeriods, setSelectedPeriods] = useState({
        test: true,
        simulation: true,
        training: false,
        better_than_winner: false,
        all_simulations: false
    });
    const [recordType, setRecordType] = useState('top'); // 'top' (per window) or 'all' (if available)
    const [groupingParam, setGroupingParam] = useState('none'); // 'none', 'n_tickers', 'rebalance_period', 'momentum_lookback_days'
    const [binSize, setBinSize] = useState(1); // 1% default

    // Extract data based on selection
    const rawData = useMemo(() => {
        if (!results) return [];

        let extractedData = [];

        // Helper to extract relevant fields
        const extractFields = (result, score, extraContext = {}) => {
            let cagr = result.cagr;
            if (cagr === undefined && result.total_return_pct !== undefined) {
                // Calculate CAGR from Total Return if missing
                const months = result.test_period_months || extraContext.test_period_months;
                if (months && months > 0) {
                    const totalRet = result.total_return_pct / 100;
                    const years = months / 12;
                    cagr = (Math.pow(1 + totalRet, 1 / years) - 1);
                }
            }

            return {
                cagr: (cagr !== undefined ? cagr : 0) * 100, // Convert to %
                n_tickers: result.n_tickers,
                rebalance_period: result.rebalance_period,
                momentum_lookback_days: result.momentum_lookback_days || 'N/A',
                test_period_months: result.test_period_months || extraContext.test_period_months || 'N/A',
                score: score
            };
        };

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

                // Portfolio Simulation Data (Real Trading)
                if (selectedPeriods.better_than_winner || selectedPeriods.all_simulations) {
                    const portfolioState = window.portfolio_state;

                    if (portfolioState && !portfolioState.error) {
                        // Calculate CAGR for Portfolio Simulation using exact dates
                        const startDate = new Date(portfolioState.sim_start_date);
                        const endDate = new Date(portfolioState.sim_end_date);
                        const diffTime = Math.abs(endDate - startDate);
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        let simCagr = 0;
                        if (diffDays > 0) {
                            const years = diffDays / 365.25;
                            const totalRet = portfolioState.total_return_pct / 100;
                            simCagr = (Math.pow(1 + totalRet, 1 / years) - 1);
                        }

                        const resultObj = {
                            cagr: simCagr * 100,
                            n_tickers: portfolioState.best_params.n_tickers,
                            rebalance_period: portfolioState.best_params.rebalance_period,
                            momentum_lookback_days: portfolioState.best_params.momentum_lookback_days || 'N/A',
                            test_period_months: portfolioState.best_params.rebalance_period || window.test_period_months || 'N/A',
                            score: 0
                        };

                        // 1. Profitable Simulations (formerly Better Than Winner)
                        if (selectedPeriods.better_than_winner && simCagr > 0) {
                            extractedData.push(resultObj);
                        }

                        // 2. All Simulations
                        if (selectedPeriods.all_simulations) {
                            extractedData.push(resultObj);
                        }
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

            // Better Than Winner
            if (selectedPeriods.better_than_winner) {
                const winnerCagr = results.test_results?.[0]?.cagr;
                if (winnerCagr !== undefined) {
                    const sourceList = results.all_test_results || results.test_results;
                    if (sourceList) {
                        sourceList.forEach(res => {
                            if (res.cagr > winnerCagr) {
                                extractedData.push(extractFields(res, 0));
                            }
                        });
                    }
                }
            }

        } else {
            // Normal Mode
            if (selectedPeriods.test) {
                const sourceList = results.results || results.results?.results || [];
                sourceList.forEach(res => {
                    extractedData.push(extractFields(res, res.score || 0));
                });
            }

            // Better Than Winner
            if (selectedPeriods.better_than_winner) {
                const list = results.results || results.results?.results || [];
                const winnerCagr = list[0]?.cagr;
                if (winnerCagr !== undefined) {
                    list.forEach(res => {
                        if (res.cagr > winnerCagr) {
                            extractedData.push(extractFields(res, 0));
                        }
                    });
                }
            }
        }

        return extractedData;
    }, [results, selectedPeriods, recordType]);

    // Calculate Histogram Data
    const histogramData = useMemo(() => {
        if (!rawData.length) return [];

        const cagrs = rawData.map(d => d.cagr);

        // Handle case with no data or single point
        if (cagrs.length === 0) return [];

        const minCagr = Math.floor(Math.min(...cagrs) / binSize) * binSize;
        const maxCagr = Math.ceil(Math.max(...cagrs) / binSize) * binSize;

        // Initialize bins
        const bins = {};
        // Adjust loop to ensure we cover the full range
        // Handle edge case where minCagr > maxCagr (shouldn't happen with sorted)
        const start = isFinite(minCagr) ? minCagr : 0;
        const end = isFinite(maxCagr) ? maxCagr : 0;

        for (let b = start; b <= end; b += binSize) {
            bins[b] = { bin: b };
        }

        // Fill bins
        rawData.forEach(item => {
            // Calculate bin floor
            const val = item.cagr;
            if (!isFinite(val)) return;

            const binFloor = Math.floor(val / binSize) * binSize;

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

    // Calculate Percentile Data (Reverse CDF)
    const percentileData = useMemo(() => {
        if (!histogramData.length) return [];

        const dataPoints = [];

        // Identify all unique group keys used in histogramData
        const groupKeys = new Set();
        histogramData.forEach(item => {
            Object.keys(item).forEach(k => {
                if (k !== 'bin') groupKeys.add(k);
            });
        });

        // Current counts for accumulation
        const currentCounts = {};
        const totalCounts = {};

        // Initialize totals
        groupKeys.forEach(k => {
            currentCounts[k] = 0;
            totalCounts[k] = 0;
        });

        // 1. Calculate Grand Totals first
        histogramData.forEach(binItem => {
            groupKeys.forEach(k => {
                if (binItem[k]) totalCounts[k] += binItem[k];
            });
        });

        // 2. Iterate from RIGHT (Highest CAGR) to LEFT
        // We want: % of records with CAGR >= X
        const reversedData = [...histogramData].sort((a, b) => b.bin - a.bin);

        reversedData.forEach(binItem => {
            const point = { bin: binItem.bin };

            groupKeys.forEach(k => {
                if (binItem[k]) {
                    currentCounts[k] += binItem[k];
                }
                const pct = totalCounts[k] > 0 ? (currentCounts[k] / totalCounts[k]) * 100 : 0;
                point[k] = parseFloat(pct.toFixed(1));
            });
            dataPoints.push(point);
        });

        // Sort back by bin for Chart X-Axis
        return dataPoints.sort((a, b) => a.bin - b.bin);

    }, [histogramData]);

    const dataKeys = useMemo(() => {
        const keys = new Set();
        histogramData.forEach(item => {
            Object.keys(item).forEach(k => {
                if (k !== 'bin') keys.add(k);
            });
        });
        return Array.from(keys).sort((a, b) => {
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
                {/* ... (Controls remain same) ... */}
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

                        <label className="inline-flex items-center">
                            <input
                                type="checkbox"
                                checked={selectedPeriods.better_than_winner}
                                onChange={(e) => setSelectedPeriods(prev => ({ ...prev, better_than_winner: e.target.checked }))}
                                className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-gray-700">Profitable Simulations (Sim)</span>
                        </label>

                        <label className="inline-flex items-center">
                            <input
                                type="checkbox"
                                checked={selectedPeriods.all_simulations}
                                onChange={(e) => setSelectedPeriods(prev => ({ ...prev, all_simulations: e.target.checked }))}
                                className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-gray-700">All Simulations (Sim)</span>
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

            {/* Histogram Chart */}
            <h3 className="text-md font-semibold text-gray-800 mb-2">Distribution Histogram</h3>
            <div className="h-80 w-full mb-8">
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
                <p className="text-center text-xs text-gray-500">
                    X-axis: CAGR bins. Y-axis: Number of records.
                </p>
            </div>

            {/* Percentile Chart */}
            <h3 className="text-md font-semibold text-gray-800 mb-2 mt-6 border-t pt-4">Percentile Ranking (Reverse CDF)</h3>
            <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={percentileData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="bin"
                            label={{ value: 'CAGR >= X (%)', position: 'bottom', offset: 0 }}
                            tickFormatter={(val) => `${val}%`}
                        />
                        <YAxis
                            label={{ value: '% of Records (Reverse CDF)', angle: -90, position: 'insideLeft' }}
                            domain={[0, 100]}
                        />
                        <Tooltip
                            formatter={(value, name) => [`${value}%`, groupingParam === 'none' ? 'All Records' : `${groupingParam === 'momentum_lookback_days' ? 'Lookback:' : groupingParam === 'test_period_months' ? 'Period:' : groupingParam === 'rebalance_period' ? 'Rebal:' : 'N:'} ${name}`]}
                            labelFormatter={(label) => `CAGR >= ${label}%`}
                        />
                        <Legend />
                        {dataKeys.map((key, index) => (
                            <Line
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={colors[index % colors.length]}
                                strokeWidth={2}
                                dot={false}
                                name={groupingParam === 'none' ? 'Total' : `${key}`}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
                <p className="text-center text-xs text-gray-500">
                    Chart shows the percentage of records that achieved a CAGR greater than or equal to the X-axis value.
                    Higher and further to the right is better.
                </p>
            </div>
        </div>
    );
};

export default OptimizationHistograms;
