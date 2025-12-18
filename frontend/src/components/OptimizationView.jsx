import React, { useState, useEffect, useRef } from 'react';
import OptimizationResults from './OptimizationResults';

const OptimizationView = ({ onRunOptimization, isLoading, onBack, results, onLoadResults }) => {
    const [tickers, setTickers] = useState(
        'AU, GOOG, FSLR, IDXX, WDC, ULS, FRES.L, WWD, KEYS, ISRG, NST.AX, TER, AMD, CLS.TO, CRS, DELTA.BK, FN, MU, STLD, FIX, CRDO, CTRA, APH, ANGPY, VRT, ASML, SDVKY, ANTO.L, KLAC, AEM.TO, ADI, FNV.TO, SHOP.TO, HWM, IFX.DE, UCBJY, UCB.BR, WPM.TO, PRY.MI, MPWR, BWXT, PSTG, EADSY, WPM.L, AIR.PA, FCX, FLEX, IFNNY, PLTR, BSX, NVDA, GD, AMZN, 1177.HK, ARZGY, ANET, EME, FUTU, RR.L, RYCEY, SAAB-B.ST, SCHW, TT, RMD, GEV, ASMIY, ASM.AS, FTNT, NVZMY, ADBE, ADYEN.AS, ADYEY, ARM, AXON, BLK, CDNS, DXCM, GWRE, LNSTY, MA, META, NOW, NSIS-B.CO, NTNX, PGHN.SW, PINS, RHM.DE, RJF, RMD.AX, SAP, SAP.DE, SMCI, SPOT, SYK, TOST, TW, V, VEEV, WDAY');
    const [startDate, setStartDate] = useState('2011-01-01');
    const [endDate, setEndDate] = useState('2025-12-01');

    // Broker presets
    const [bossaEnabled, setBossaEnabled] = useState(true);
    const [ibEnabled, setIbEnabled] = useState(false);

    // Number of tickers range
    const [nTickersMin, setNTickersMin] = useState(5);
    const [nTickersMax, setNTickersMax] = useState(10);
    const [nTickersStep, setNTickersStep] = useState(1);

    // Stop loss range (optional)
    const [stopLossEnabled, setStopLossEnabled] = useState(false);
    const [stopLossMin, setStopLossMin] = useState(10);
    const [stopLossMax, setStopLossMax] = useState(10);
    const [stopLossStep, setStopLossStep] = useState(1);

    // Rebalance period range (in months)
    const [rebalancePeriodMin, setRebalancePeriodMin] = useState(1);
    const [rebalancePeriodMax, setRebalancePeriodMax] = useState(6);
    const [rebalancePeriodStep, setRebalancePeriodStep] = useState(1);

    // Momentum lookback period range (in days)
    const [momentumLookbackMin, setMomentumLookbackMin] = useState(20);
    const [momentumLookbackMax, setMomentumLookbackMax] = useState(120);
    const [momentumLookbackStep, setMomentumLookbackStep] = useState(20);
    const [filterNegativeMomentumEnabled, setFilterNegativeMomentumEnabled] = useState(false); // Test with filter=True
    const [filterNegativeMomentumDisabled, setFilterNegativeMomentumDisabled] = useState(true); // Test with filter=False

    // Margin trading
    const [marginEnabled, setMarginEnabled] = useState(false);

    // Strategies (multi-select)
    const [scoringEnabled, setScoringEnabled] = useState(false);
    const [momentumEnabled, setMomentumEnabled] = useState(true);

    // Position sizing (multi-select)
    const [equalWeightEnabled, setEqualWeightEnabled] = useState(false);
    const [riskParityEnabled, setRiskParityEnabled] = useState(true);

    // Train/Test Split
    const [enableTrainTest, setEnableTrainTest] = useState(true);
    const [trainStartDate, setTrainStartDate] = useState('2011-01-01');
    const [trainYears, setTrainYears] = useState(2);  // User inputs years, converted to months
    const [testMonths, setTestMonths] = useState(12);
    const [topNForTest, setTopNForTest] = useState(3);

    // Scoring Configuration - Train
    const [cagrMin, setCagrMin] = useState(0);
    const [cagrMax, setCagrMax] = useState(100);
    const [cagrWeight, setCagrWeight] = useState(0);
    const [ddMin, setDdMin] = useState(-50);
    const [ddMax, setDdMax] = useState(0);
    const [ddWeight, setDdWeight] = useState(0);

    // Scoring Configuration - Test
    const [testCagrMin, setTestCagrMin] = useState(0);
    const [testCagrMax, setTestCagrMax] = useState(100);
    const [testCagrWeight, setTestCagrWeight] = useState(70);
    const [testDdMin, setTestDdMin] = useState(-50);
    const [testDdMax, setTestDdMax] = useState(0);
    const [testDdWeight, setTestDdWeight] = useState(30);

    const [showScoringConfig, setShowScoringConfig] = useState(false);

    // Walk-Forward
    const [enableWalkForward, setEnableWalkForward] = useState(true);
    const [walkForwardStart, setWalkForwardStart] = useState('2011-01-01');
    const [walkForwardEnd, setWalkForwardEnd] = useState('2025-12-01');
    const [walkForwardStep, setWalkForwardStep] = useState(12);
    const [walkForwardDynamicStep, setWalkForwardDynamicStep] = useState(false);

    // Auto-save
    const [autoSaveAfterOptimization, setAutoSaveAfterOptimization] = useState(true);

    // Progress tracking
    const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0 });
    const [windowProgress, setWindowProgress] = useState(null);

    // Poll for progress updates when optimization is running
    useEffect(() => {
        if (!isLoading) {
            setProgress({ current: 0, total: 0, percentage: 0 });
            setWindowProgress(null);
            return;
        }

        const pollProgress = async () => {
            try {
                const response = await fetch('http://localhost:8000/api/optimization_progress');
                const data = await response.json();

                if (data.is_running) {
                    setProgress({
                        current: data.current,
                        total: data.total,
                        percentage: data.percentage
                    });

                    if (data.window_current && data.window_total) {
                        setWindowProgress({
                            current: data.window_current,
                            total: data.window_total
                        });
                    } else {
                        setWindowProgress(null);
                    }
                }
            } catch (error) {
                console.error('Error polling progress:', error);
            }
        };

        // Poll every 2 seconds
        const interval = setInterval(pollProgress, 2000);
        pollProgress(); // Initial poll

        return () => clearInterval(interval);
    }, [isLoading]);

    const handleRunOptimization = () => {
        // Reset progress
        setProgress({ current: 0, total: 0, percentage: 0 });
        setWindowProgress(null);

        // Validate at least one broker is selected
        if (!bossaEnabled && !ibEnabled) {
            alert('Please select at least one broker');
            return;
        }

        // Validate at least one strategy is selected
        if (!scoringEnabled && !momentumEnabled) {
            alert('Please select at least one strategy');
            return;
        }

        // Validate at least one sizing method is selected
        if (!equalWeightEnabled && !riskParityEnabled) {
            alert('Please select at least one sizing method');
            return;
        }

        const brokers = [];
        if (bossaEnabled) brokers.push('bossa');
        if (ibEnabled) brokers.push('interactive_brokers');

        const strategies = [];
        if (scoringEnabled) strategies.push('scoring');
        if (momentumEnabled) strategies.push('momentum');

        const sizingMethods = [];
        if (equalWeightEnabled) sizingMethods.push('equal');
        if (riskParityEnabled) sizingMethods.push('var');

        const filterNegativeMomentum = [];
        if (filterNegativeMomentumEnabled) filterNegativeMomentum.push(true);
        if (filterNegativeMomentumDisabled) filterNegativeMomentum.push(false);

        // If neither selected, default to false (or alert?)
        if (momentumEnabled && filterNegativeMomentum.length === 0) {
            alert('Please select at least one option for Filter Negative Momentum');
            return;
        }
        // If momentum not selected, just pass [false] to satisfy type, though it won't be used
        if (!momentumEnabled && filterNegativeMomentum.length === 0) {
            filterNegativeMomentum.push(false);
        }

        const params = {
            tickers: tickers.split(',').map(t => t.trim()),
            start_date: startDate,
            end_date: endDate,
            brokers: brokers,
            n_tickers_range: {
                min: parseInt(nTickersMin),
                max: parseInt(nTickersMax),
                step: parseInt(nTickersStep)
            },
            stop_loss_range: stopLossEnabled ? {
                min: parseFloat(stopLossMin),
                max: parseFloat(stopLossMax),
                step: parseFloat(stopLossStep)
            } : null,
            rebalance_period_range: {
                min: parseInt(rebalancePeriodMin),
                max: parseInt(rebalancePeriodMax),
                step: parseInt(rebalancePeriodStep)
            },
            momentum_lookback_range: {
                min: parseInt(momentumLookbackMin),
                max: parseInt(momentumLookbackMax),
                step: parseInt(momentumLookbackStep)
            },
            filter_negative_momentum: filterNegativeMomentum,
            margin_enabled: marginEnabled,
            strategies: strategies,
            sizing_methods: sizingMethods,

            // Train/Test Split parameters
            enable_train_test: enableTrainTest,
            train_start_date: enableTrainTest ? startDate : null,
            train_months: enableTrainTest ? parseInt(trainYears) * 12 : null,
            test_months: enableTrainTest ? parseInt(testMonths) : null,
            top_n_for_test: enableTrainTest ? parseInt(topNForTest) : null,

            // Scoring Configuration
            scoring_config: {
                cagr_min: cagrMin / 100,
                cagr_max: cagrMax / 100,
                cagr_weight: parseFloat(cagrWeight),
                dd_min: ddMin / 100,
                dd_max: ddMax / 100,
                dd_weight: parseFloat(ddWeight),
                test_cagr_min: testCagrMin / 100,
                test_cagr_max: testCagrMax / 100,
                test_cagr_weight: parseFloat(testCagrWeight),
                test_dd_min: testDdMin / 100,
                test_dd_max: testDdMax / 100,
                test_dd_weight: parseFloat(testDdWeight)
            },

            // Walk-Forward parameters (always enabled with train/test)
            enable_walk_forward: enableTrainTest,
            walk_forward_start: enableTrainTest ? startDate : null,
            walk_forward_end: enableTrainTest ? endDate : null,
            walk_forward_step_months: enableTrainTest ? parseInt(walkForwardStep) : null,
            walk_forward_dynamic_step: enableTrainTest ? walkForwardDynamicStep : false
        };

        onRunOptimization(params, autoSaveAfterOptimization);
    };

    const handleLoadResults = async (file) => {
        try {
            const text = await file.text();

            // Send to backend for parsing
            const response = await fetch('http://localhost:8000/api/parse_results', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ file_content: text })
            });

            if (!response.ok) {
                throw new Error('Failed to parse results file');
            }

            const parsedResults = await response.json();

            // Update results state using the callback prop
            if (onLoadResults) {
                onLoadResults(parsedResults);
            }

            alert('Results loaded successfully!');
        } catch (error) {
            console.error('Error loading results:', error);
            alert('Error loading results file. Please check the file format.');
        }
    };

    // Expose handleLoadResults to window for file input
    useEffect(() => {
        window.handleLoadResults = handleLoadResults;
        return () => {
            delete window.handleLoadResults;
        };
    }, []);

    const handleSaveResults = async () => {
        // Check if we have results (any mode)
        if (!results) return;

        // Reconstruct params object (similar to handleRunOptimization but we need it here)
        const tickerList = tickers.split(',').map(t => t.trim());
        const brokers = [];
        if (bossaEnabled) brokers.push('bossa');
        if (ibEnabled) brokers.push('ib');

        const strategies = [];
        if (scoringEnabled) strategies.push('scoring');
        if (momentumEnabled) strategies.push('momentum');

        const sizingMethods = [];
        if (equalWeightEnabled) sizingMethods.push('equal');
        if (riskParityEnabled) sizingMethods.push('var');

        const filterNegativeMomentum = [];
        if (filterNegativeMomentumEnabled) filterNegativeMomentum.push(true);
        if (filterNegativeMomentumDisabled) filterNegativeMomentum.push(false);
        if (!momentumEnabled && filterNegativeMomentum.length === 0) filterNegativeMomentum.push(false);

        const params = {
            tickers: tickerList,
            start_date: startDate,
            end_date: endDate,
            brokers: brokers,
            n_tickers_range: {
                min: parseInt(nTickersMin),
                max: parseInt(nTickersMax),
                step: parseInt(nTickersStep)
            },
            stop_loss_range: stopLossEnabled ? {
                min: parseFloat(stopLossMin),
                max: parseFloat(stopLossMax),
                step: parseFloat(stopLossStep)
            } : null,
            rebalance_period_range: {
                min: parseInt(rebalancePeriodMin),
                max: parseInt(rebalancePeriodMax),
                step: parseInt(rebalancePeriodStep)
            },
            momentum_lookback_range: {
                min: parseInt(momentumLookbackMin),
                max: parseInt(momentumLookbackMax),
                step: parseInt(momentumLookbackStep)
            },
            filter_negative_momentum: filterNegativeMomentum,
            margin_enabled: marginEnabled,
            strategies: strategies,
            sizing_methods: sizingMethods,

            // Train/Test Split parameters (required for validation)
            enable_train_test: enableTrainTest,
            train_start_date: enableTrainTest ? startDate : null,
            train_months: enableTrainTest ? parseInt(trainYears) * 12 : null,
            test_months: enableTrainTest ? parseInt(testMonths) : null,
            top_n_for_test: enableTrainTest ? parseInt(topNForTest) : null,

            // Scoring Configuration
            scoring_config: {
                cagr_min: cagrMin / 100,
                cagr_max: cagrMax / 100,
                cagr_weight: parseFloat(cagrWeight),
                dd_min: ddMin / 100,
                dd_max: ddMax / 100,
                dd_weight: parseFloat(ddWeight),
                test_cagr_min: testCagrMin / 100,
                test_cagr_max: testCagrMax / 100,
                test_cagr_weight: parseFloat(testCagrWeight),
                test_dd_min: testDdMin / 100,
                test_dd_max: testDdMax / 100,
                test_dd_weight: parseFloat(testDdWeight)
            },

            // Walk-Forward parameters (always enabled with train/test)
            enable_walk_forward: enableTrainTest,
            walk_forward_start: enableTrainTest ? startDate : null,
            walk_forward_end: enableTrainTest ? endDate : null,
            walk_forward_step_months: enableTrainTest ? parseInt(walkForwardStep) : null
        };

        try {
            // Determine the mode and prepare appropriate data
            let saveData;
            if (results.walk_forward_mode) {
                // Walk-forward mode - save complete walk-forward results
                saveData = {
                    params: params,
                    results: results  // Send entire walk-forward structure
                };
            } else {
                // Normal or train/test mode
                saveData = {
                    params: params,
                    results: results.results || results
                };
            }

            const response = await fetch('http://127.0.0.1:8000/api/save_optimization_results', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(saveData),
            });

            if (response.ok) {
                const data = await response.json();
                alert(`Results saved to: ${data.filename}`);
            } else {
                alert('Failed to save results');
            }
        } catch (error) {
            console.error('Error saving results:', error);
            alert('Error saving results' + error);
        }
    };

    return (
        <div className="p-4 bg-white shadow rounded-lg">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Parameter Optimization</h2>
                <div className="flex gap-2">
                    <label className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center cursor-pointer">
                        <span className="mr-2">📂</span> Load Results
                        <input
                            type="file"
                            accept=".txt"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    handleLoadResults(file);
                                }
                            }}
                        />
                    </label>
                    <button
                        onClick={onBack}
                        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
                    >
                        ← Back to Dashboard
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                {/* Date Range */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Date Range</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Start Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">End Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            />
                        </div>
                    </div>
                </div>

                {/* Train/Test Split */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="flex items-center space-x-2 mb-3">
                        <input
                            type="checkbox"
                            checked={enableTrainTest}
                            onChange={(e) => {
                                setEnableTrainTest(e.target.checked);
                                // Auto-disable Walk-Forward when Train/Test Split is disabled
                                if (!e.target.checked && enableWalkForward) {
                                    setEnableWalkForward(false);
                                }
                            }}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        />
                        <span className="text-lg font-semibold text-gray-700">
                            Enable Train/Test Split
                        </span>
                    </label>

                    {enableTrainTest && (
                        <div className="mt-4 space-y-4 bg-blue-50 p-4 rounded border border-blue-200">
                            <p className="text-sm text-blue-800 mb-3">
                                Optimize on training period, then test top N results on test period. Uses Date Range as overall period.
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Training Period (years)</label>
                                    <input
                                        type="number"
                                        value={trainYears}
                                        onChange={(e) => setTrainYears(e.target.value)}
                                        min="1"
                                        step="1"
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Test Period (months)</label>
                                    <input
                                        type="number"
                                        value={testMonths}
                                        onChange={(e) => setTestMonths(e.target.value)}
                                        min="1"
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Top N to Test</label>
                                    <input
                                        type="number"
                                        value={topNForTest}
                                        onChange={(e) => setTopNForTest(e.target.value)}
                                        min="1"
                                        max="100"
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    />
                                </div>
                            </div>

                            {/* Date Preview */}
                            {startDate && trainYears && testMonths && (
                                <div className="mt-4 p-3 bg-white rounded border border-blue-300">
                                    <p className="text-xs font-semibold text-gray-600 mb-2">📅 Period Preview:</p>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="font-medium text-green-700">Training:</span>
                                            <div className="text-gray-700 ml-2">
                                                {(() => {
                                                    const start = new Date(startDate);
                                                    const end = new Date(start);
                                                    end.setMonth(end.getMonth() + parseInt(trainYears) * 12);
                                                    end.setDate(end.getDate() - 1);
                                                    return `${start.toLocaleDateString('en-CA')} to ${end.toLocaleDateString('en-CA')}`;
                                                })()}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="font-medium text-blue-700">Test:</span>
                                            <div className="text-gray-700 ml-2">
                                                {(() => {
                                                    const trainStart = new Date(startDate);
                                                    const trainEnd = new Date(trainStart);
                                                    trainEnd.setMonth(trainEnd.getMonth() + parseInt(trainYears) * 12);
                                                    trainEnd.setDate(trainEnd.getDate() - 1);
                                                    const testStart = new Date(trainEnd);
                                                    testStart.setDate(testStart.getDate() + 1);
                                                    const testEnd = new Date(testStart);
                                                    testEnd.setMonth(testEnd.getMonth() + parseInt(testMonths));
                                                    testEnd.setDate(testEnd.getDate() - 1);
                                                    return `${testStart.toLocaleDateString('en-CA')} to ${testEnd.toLocaleDateString('en-CA')}`;
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Scoring Configuration */}
                            <div className="mt-4">
                                <button
                                    onClick={() => setShowScoringConfig(!showScoringConfig)}
                                    className="text-sm text-blue-700 hover:text-blue-900 underline font-medium"
                                >
                                    {showScoringConfig ? '▼' : '▶'} Advanced: Configure Scoring Parameters
                                </button>

                                {showScoringConfig && (
                                    <div className="mt-3 p-4 bg-yellow-50 rounded border border-yellow-300">
                                        <h4 className="font-semibold text-sm mb-3">Scoring Configuration</h4>

                                        <div className="grid grid-cols-3 gap-4">
                                            {/* CAGR Settings */}
                                            <div className="col-span-3">
                                                <p className="font-medium text-sm mb-2 text-green-700">Train CAGR Thresholds & Weight</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700">Min CAGR (%)</label>
                                                <input
                                                    type="number"
                                                    value={cagrMin}
                                                    onChange={(e) => setCagrMin(e.target.value)}
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700">Max CAGR (%)</label>
                                                <input
                                                    type="number"
                                                    value={cagrMax}
                                                    onChange={(e) => setCagrMax(e.target.value)}
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700">Weight (points)</label>
                                                <input
                                                    type="number"
                                                    value={cagrWeight}
                                                    onChange={(e) => setCagrWeight(e.target.value)}
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                                />
                                            </div>

                                            {/* DD Settings */}
                                            <div className="col-span-3">
                                                <p className="font-medium text-sm mb-2 mt-2 text-red-700">Train Max DD Thresholds & Weight</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700">Min DD (%)</label>
                                                <input
                                                    type="number"
                                                    value={ddMin}
                                                    onChange={(e) => setDdMin(e.target.value)}
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700">Max DD (%)</label>
                                                <input
                                                    type="number"
                                                    value={ddMax}
                                                    onChange={(e) => setDdMax(e.target.value)}
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700">Weight (points)</label>
                                                <input
                                                    type="number"
                                                    value={ddWeight}
                                                    onChange={(e) => setDdWeight(e.target.value)}
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                                />
                                            </div>

                                            {/* Test CAGR Settings */}
                                            <div className="col-span-3">
                                                <p className="font-medium text-sm mb-2 mt-4 text-green-700 border-t pt-3">Test CAGR Thresholds & Weight</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700">Min Test CAGR (%)</label>
                                                <input
                                                    type="number"
                                                    value={testCagrMin}
                                                    onChange={(e) => setTestCagrMin(e.target.value)}
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700">Max Test CAGR (%)</label>
                                                <input
                                                    type="number"
                                                    value={testCagrMax}
                                                    onChange={(e) => setTestCagrMax(e.target.value)}
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700">Weight (points)</label>
                                                <input
                                                    type="number"
                                                    value={testCagrWeight}
                                                    onChange={(e) => setTestCagrWeight(e.target.value)}
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                                />
                                            </div>

                                            {/* Test DD Settings */}
                                            <div className="col-span-3">
                                                <p className="font-medium text-sm mb-2 mt-2 text-red-700">Test Max DD Thresholds & Weight</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700">Min Test DD (%)</label>
                                                <input
                                                    type="number"
                                                    value={testDdMin}
                                                    onChange={(e) => setTestDdMin(e.target.value)}
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700">Max Test DD (%)</label>
                                                <input
                                                    type="number"
                                                    value={testDdMax}
                                                    onChange={(e) => setTestDdMax(e.target.value)}
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700">Weight (points)</label>
                                                <input
                                                    type="number"
                                                    value={testDdWeight}
                                                    onChange={(e) => setTestDdWeight(e.target.value)}
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-3 p-2 bg-white rounded border border-yellow-400">
                                            <p className="text-xs text-gray-700">
                                                <strong>Max Score:</strong> {enableTrainTest ? (parseFloat(cagrWeight) + parseFloat(ddWeight) + parseFloat(testCagrWeight) + parseFloat(testDdWeight)) : parseFloat(cagrWeight) + parseFloat(ddWeight)} points
                                                {enableTrainTest && (
                                                    <span className="ml-2 text-gray-600">
                                                        (Train: {parseFloat(cagrWeight) + parseFloat(ddWeight)}, Test: {parseFloat(testCagrWeight) + parseFloat(testDdWeight)})
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Walk-Forward Analysis - always enabled with Train/Test */}
                            {enableTrainTest && (
                                <div className="mt-4 p-4 bg-purple-50 rounded border border-purple-200">
                                    <h4 className="font-semibold text-purple-900 mb-2">Walk-Forward Analysis</h4>
                                    <p className="text-xs text-purple-800 mb-3">
                                        Run multiple train/test windows across time period
                                    </p>

                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="block text-xs font-medium text-gray-700">Step Size (months)</label>
                                                <label className="flex items-center space-x-1 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={walkForwardDynamicStep}
                                                        onChange={(e) => setWalkForwardDynamicStep(e.target.checked)}
                                                        className="h-3 w-3 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                                    />
                                                    <span className="text-xs font-medium text-purple-700">Dynamic (use winner's rebalance)</span>
                                                </label>
                                            </div>
                                            <input
                                                type="number"
                                                value={walkForwardStep}
                                                onChange={(e) => setWalkForwardStep(e.target.value)}
                                                min="1"
                                                disabled={walkForwardDynamicStep}
                                                className={`mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm ${walkForwardDynamicStep ? 'bg-gray-100 text-gray-500' : ''}`}
                                            />
                                        </div>
                                    </div>

                                    {/* Window count preview */}
                                    {startDate && endDate && trainYears && testMonths && walkForwardStep && (
                                        <div className="p-2 bg-white rounded border border-purple-400 mt-3">
                                            <p className="text-xs text-gray-700">
                                                <strong>Estimated Windows:</strong> {(() => {
                                                    const start = new Date(startDate);
                                                    const end = new Date(endDate);
                                                    const trainM = parseInt(trainYears) * 12;
                                                    const testM = parseInt(testMonths);
                                                    const stepM = parseInt(walkForwardStep);

                                                    let count = 0;
                                                    let current = new Date(start);

                                                    while (true) {
                                                        const testEnd = new Date(current);
                                                        testEnd.setMonth(testEnd.getMonth() + trainM + testM);
                                                        if (testEnd > end) break;
                                                        count++;
                                                        current.setMonth(current.getMonth() + stepM);
                                                    }

                                                    return count;
                                                })()} windows
                                                <span className="ml-2 text-gray-600">
                                                    (Train: {trainYears}y, Test: {testMonths}mo, Step: {walkForwardStep}mo)
                                                </span>
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Broker Presets */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Broker Presets</h3>
                    <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={bossaEnabled}
                                onChange={(e) => setBossaEnabled(e.target.checked)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                            <span className="text-sm font-medium text-gray-700">
                                Bossa (0.29% fee, no tax)
                            </span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={ibEnabled}
                                onChange={(e) => setIbEnabled(e.target.checked)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                            <span className="text-sm font-medium text-gray-700">
                                Interactive Brokers ($1 fee, 19% tax)
                            </span>
                        </label>
                    </div>
                </div>

                {/* Tickers */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Tickers</h3>
                    <textarea
                        value={tickers}
                        onChange={(e) => setTickers(e.target.value)}
                        rows={3}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        placeholder="Comma separated"
                    />
                </div>

                {/* Number of Tickers Range */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Number of Tickers to Select</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Min</label>
                            <input
                                type="number"
                                value={nTickersMin}
                                onChange={(e) => setNTickersMin(e.target.value)}
                                min="1"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Max</label>
                            <input
                                type="number"
                                value={nTickersMax}
                                onChange={(e) => setNTickersMax(e.target.value)}
                                min="1"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Step</label>
                            <input
                                type="number"
                                value={nTickersStep}
                                onChange={(e) => setNTickersStep(e.target.value)}
                                min="1"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            />
                        </div>
                    </div>
                </div>

                {/* Rebalance Period Range */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Rebalance Period (months)</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Min</label>
                            <input
                                type="number"
                                value={rebalancePeriodMin}
                                onChange={(e) => setRebalancePeriodMin(e.target.value)}
                                min="1"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Max</label>
                            <input
                                type="number"
                                value={rebalancePeriodMax}
                                onChange={(e) => setRebalancePeriodMax(e.target.value)}
                                min="1"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Step</label>
                            <input
                                type="number"
                                value={rebalancePeriodStep}
                                onChange={(e) => setRebalancePeriodStep(e.target.value)}
                                min="1"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            />
                        </div>
                    </div>
                </div>

                {/* Momentum Lookback Period Range */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Momentum Lookback Period (days)</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Min</label>
                            <input
                                type="number"
                                value={momentumLookbackMin}
                                onChange={(e) => setMomentumLookbackMin(e.target.value)}
                                min="1"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Max</label>
                            <input
                                type="number"
                                value={momentumLookbackMax}
                                onChange={(e) => setMomentumLookbackMax(e.target.value)}
                                min="1"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Step</label>
                            <input
                                type="number"
                                value={momentumLookbackStep}
                                onChange={(e) => setMomentumLookbackStep(e.target.value)}
                                min="1"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        Used only when Momentum strategy is selected
                    </p>

                    <div className="mt-4 border-t border-gray-200 pt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Filter Negative Momentum</h4>
                        <div className="flex space-x-4">
                            <label className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={filterNegativeMomentumEnabled}
                                    onChange={(e) => setFilterNegativeMomentumEnabled(e.target.checked)}
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                />
                                <span className="text-sm text-gray-700">Test Enabled (True)</span>
                            </label>
                            <label className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={filterNegativeMomentumDisabled}
                                    onChange={(e) => setFilterNegativeMomentumDisabled(e.target.checked)}
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                />
                                <span className="text-sm text-gray-700">Test Disabled (False)</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Stop Loss Range */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-700">Stop Loss (%)</h3>
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={stopLossEnabled}
                                onChange={(e) => setStopLossEnabled(e.target.checked)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                            <span className="text-sm font-medium text-gray-700">Enable</span>
                        </label>
                    </div>
                    {stopLossEnabled && (
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Min (%)</label>
                                <input
                                    type="number"
                                    value={stopLossMin}
                                    onChange={(e) => setStopLossMin(e.target.value)}
                                    min="0"
                                    step="0.1"
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Max (%)</label>
                                <input
                                    type="number"
                                    value={stopLossMax}
                                    onChange={(e) => setStopLossMax(e.target.value)}
                                    min="0"
                                    step="0.1"
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Step (%)</label>
                                <input
                                    type="number"
                                    value={stopLossStep}
                                    onChange={(e) => setStopLossStep(e.target.value)}
                                    min="0.1"
                                    step="0.1"
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Margin Trading */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            checked={marginEnabled}
                            onChange={(e) => setMarginEnabled(e.target.checked)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        />
                        <span className="text-sm font-medium text-gray-700">
                            Enable Margin Trading (Leverage)
                        </span>
                    </label>
                    <p className="text-xs text-gray-500 ml-6 mt-1">
                        If enabled, buys extra shares using borrowed funds (3% interest).
                    </p>
                </div>

                {/* Strategy Selection */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Strategy</h3>
                    <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={scoringEnabled}
                                onChange={(e) => setScoringEnabled(e.target.checked)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                            <span className="text-sm font-medium text-gray-700">Scoring</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={momentumEnabled}
                                onChange={(e) => setMomentumEnabled(e.target.checked)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                            <span className="text-sm font-medium text-gray-700">Momentum</span>
                        </label>
                    </div>
                </div>

                {/* Position Sizing */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Position Sizing</h3>
                    <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={equalWeightEnabled}
                                onChange={(e) => setEqualWeightEnabled(e.target.checked)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                            <span className="text-sm font-medium text-gray-700">Equal Weight (1/N)</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={riskParityEnabled}
                                onChange={(e) => setRiskParityEnabled(e.target.checked)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                            <span className="text-sm font-medium text-gray-700">Risk Parity (Inverse VaR)</span>
                        </label>
                    </div>
                </div>

                {/* Run Button */}
                <div className="flex flex-col items-center pt-4 space-y-3">
                    <label className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            checked={autoSaveAfterOptimization}
                            onChange={(e) => setAutoSaveAfterOptimization(e.target.checked)}
                            className="h-4 w-4 text-green-600 border-gray-300 rounded"
                        />
                        <span className="text-sm font-medium text-gray-700">Auto-save results after completion</span>
                    </label>

                    {/* Progress Display */}
                    {isLoading && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            {/* Walk-Forward: Show window progress */}
                            {windowProgress ? (
                                <React.Fragment>
                                    <div className="flex justify-between items-center gap-4 mb-2">
                                        <span className="text-sm font-semibold text-blue-900">
                                            Processing Window {windowProgress.current} of {windowProgress.total}
                                        </span>
                                        <span className="text-sm font-bold text-blue-700">
                                            {((windowProgress.current / windowProgress.total) * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                    {/* Progress Bar for windows */}
                                    <div className="w-full bg-gray-200 rounded-full h-3">
                                        <div
                                            className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                                            style={{ width: `${(windowProgress.current / windowProgress.total) * 100}%` }}
                                        />
                                    </div>
                                </React.Fragment>
                            ) : (
                                /* Normal optimization: Show combination progress */
                                progress.total > 0 && (
                                    <React.Fragment>
                                        <div className="flex justify-between items-center gap-4 mb-2">
                                            <span className="text-sm font-semibold text-blue-900">
                                                Testing {progress.current.toLocaleString()} of {progress.total.toLocaleString()} combinations
                                            </span>
                                            <span className="text-sm font-bold text-blue-700">
                                                {progress.percentage.toFixed(1)}%
                                            </span>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="w-full bg-gray-200 rounded-full h-3">
                                            <div
                                                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                                                style={{ width: `${Math.min(progress.percentage, 100)}%` }}
                                            />
                                        </div>
                                    </React.Fragment>
                                )
                            )}
                        </div>
                    )}

                    <button
                        onClick={handleRunOptimization}
                        disabled={isLoading}
                        className="bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Optimization in progress...' : 'Run Optimization'}
                    </button>
                </div>
            </div>

            <OptimizationResults results={results} onSave={handleSaveResults} startDate={startDate} endDate={endDate} />
        </div>
    );
};

export default OptimizationView;
