import React, { useState } from 'react';
import OptimizationResults from './OptimizationResults';

const OptimizationView = ({ onRunOptimization, isLoading, onBack, results }) => {
    const [tickers, setTickers] = useState(
        'AU, GOOG, FSLR, IDXX, WDC, ULS, FRES.L, WWD, KEYS, ISRG, NST.AX, TER, AMD, CLS.TO, CRS, DELTA.BK, FN, MU, STLD, FIX, CRDO, CTRA, APH, ANGPY, VRT, ASML, SDVKY, ANTO.L, KLAC, AEM.TO, ADI, FNV.TO, SHOP.TO, HWM, IFX.DE, UCBJY, UCB.BR, WPM.TO, PRY.MI, MPWR, BWXT, PSTG, EADSY, WPM.L, AIR.PA, FCX, FLEX, IFNNY, PLTR, BSX, NVDA, GD, AMZN, 1177.HK, ARZGY, ANET, EME, FUTU, RR.L, RYCEY, SAAB-B.ST, SCHW, TT, RMD, GEV, ASMIY, ASM.AS, FTNT, NVZMY, ADBE, ADYEN.AS, ADYEY, ARM, AXON, BLK, CDNS, DXCM, GWRE, LNSTY, MA, META, NOW, NSIS-B.CO, NTNX, PGHN.SW, PINS, RHM.DE, RJF, RMD.AX, SAP, SAP.DE, SMCI, SPOT, SYK, TOST, TW, V, VEEV, WDAY');
    const [startDate, setStartDate] = useState('2020-01-01');
    const [endDate, setEndDate] = useState('2025-11-15');

    // Broker presets
    const [bossaEnabled, setBossaEnabled] = useState(true);
    const [ibEnabled, setIbEnabled] = useState(false);

    // Number of tickers range
    const [nTickersMin, setNTickersMin] = useState(5);
    const [nTickersMax, setNTickersMax] = useState(5);
    const [nTickersStep, setNTickersStep] = useState(1);

    // Stop loss range (optional)
    const [stopLossEnabled, setStopLossEnabled] = useState(false);
    const [stopLossMin, setStopLossMin] = useState(10);
    const [stopLossMax, setStopLossMax] = useState(10);
    const [stopLossStep, setStopLossStep] = useState(1);

    // Rebalance period range (in months)
    const [rebalancePeriodMin, setRebalancePeriodMin] = useState(1);
    const [rebalancePeriodMax, setRebalancePeriodMax] = useState(1);
    const [rebalancePeriodStep, setRebalancePeriodStep] = useState(1);

    // Momentum lookback period range (in days)
    const [momentumLookbackMin, setMomentumLookbackMin] = useState(30);
    const [momentumLookbackMax, setMomentumLookbackMax] = useState(30);
    const [momentumLookbackStep, setMomentumLookbackStep] = useState(10);
    const [filterNegativeMomentumEnabled, setFilterNegativeMomentumEnabled] = useState(false); // Test with filter=True
    const [filterNegativeMomentumDisabled, setFilterNegativeMomentumDisabled] = useState(true); // Test with filter=False

    // Margin trading
    const [marginEnabled, setMarginEnabled] = useState(false);

    // Strategies (multi-select)
    const [scoringEnabled, setScoringEnabled] = useState(false);
    const [momentumEnabled, setMomentumEnabled] = useState(true);

    // Position sizing (multi-select)
    const [equalWeightEnabled, setEqualWeightEnabled] = useState(true);
    const [riskParityEnabled, setRiskParityEnabled] = useState(false);

    const handleRunOptimization = () => {
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
            sizing_methods: sizingMethods
        };

        onRunOptimization(params);
    };

    const handleSaveResults = async () => {
        if (!results || !results.results) return;

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
            sizing_methods: sizingMethods
        };

        try {
            const response = await fetch('http://127.0.0.1:8000/api/save_optimization_results', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    params: params,
                    results: results.results
                }),
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
                <button
                    onClick={onBack}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
                >
                    ← Back to Dashboard
                </button>
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
                <div className="flex justify-center pt-4">
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
