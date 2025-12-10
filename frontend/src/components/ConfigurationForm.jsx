import React, { useState } from 'react';

const ConfigurationForm = ({ onRunBacktest, onDownloadData, isLoading }) => {
  const [tickers, setTickers] = useState(
    'AU, GOOG, FSLR, IDXX, WDC, ULS, FRES.L, WWD, KEYS, ISRG, NST.AX, TER, AMD, CLS.TO, CRS, DELTA.BK, FN, MU, STLD, FIX, CRDO, CTRA, APH, ANGPY, VRT, ASML, SDVKY, ANTO.L, KLAC, AEM.TO, ADI, FNV.TO, SHOP.TO, HWM, IFX.DE, UCBJY, UCB.BR, WPM.TO, PRY.MI, MPWR, BWXT, PSTG, EADSY, WPM.L, AIR.PA, FCX, FLEX, IFNNY, PLTR, BSX, NVDA, GD, AMZN, 1177.HK, ARZGY, ANET, EME, FUTU, RR.L, RYCEY, SAAB-B.ST, SCHW, TT, RMD, GEV, ASMIY, ASM.AS, FTNT, NVZMY, ADBE, ADYEN.AS, ADYEY, ARM, AXON, BLK, CDNS, DXCM, GWRE, LNSTY, MA, META, NOW, NSIS-B.CO, NTNX, PGHN.SW, PINS, RHM.DE, RJF, RMD.AX, SAP, SAP.DE, SMCI, SPOT, SYK, TOST, TW, V, VEEV, WDAY');
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState('2025-11-15');
  const [nTickers, setNTickers] = useState(7);
  const [rebalancePeriod, setRebalancePeriod] = useState(1);
  const [rebalancePeriodUnit, setRebalancePeriodUnit] = useState('months');
  const [stopLoss, setStopLoss] = useState('');
  const [smartStopLoss, setSmartStopLoss] = useState(false);
  const [transactionFeeEnabled, setTransactionFeeEnabled] = useState(false);
  const [transactionFeeType, setTransactionFeeType] = useState('percentage');
  const [transactionFeeValue, setTransactionFeeValue] = useState(0.1);
  const [capitalGainsTaxEnabled, setCapitalGainsTaxEnabled] = useState(false);
  const [capitalGainsTaxPct, setCapitalGainsTaxPct] = useState(19);

  const [marginEnabled, setMarginEnabled] = useState(true);
  const [strategy, setStrategy] = useState('scoring');
  const [sizingMethod, setSizingMethod] = useState('equal');
  const [initialCapital, setInitialCapital] = useState(10000);
  const [momentumLookbackDays, setMomentumLookbackDays] = useState(30);
  const [filterNegativeMomentum, setFilterNegativeMomentum] = useState(false);

  const handleDownload = () => {
    const tickerList = tickers.split(',').map(t => t.trim());
    onDownloadData({ tickers: tickerList, start_date: startDate, end_date: endDate });
  };

  const handleRun = () => {
    onRunBacktest({
      n_tickers: parseInt(nTickers),
      rebalance_period: parseInt(rebalancePeriod),
      rebalance_period_unit: rebalancePeriodUnit,
      initial_capital: parseFloat(initialCapital),
      start_date: startDate,
      end_date: endDate,
      stop_loss_pct: stopLoss ? parseFloat(stopLoss) / 100 : null,
      smart_stop_loss: smartStopLoss,
      transaction_fee_enabled: transactionFeeEnabled,
      transaction_fee_type: transactionFeeType,
      transaction_fee_value: parseFloat(transactionFeeValue),
      capital_gains_tax_enabled: capitalGainsTaxEnabled,
      capital_gains_tax_pct: parseFloat(capitalGainsTaxPct),
      margin_enabled: marginEnabled,
      strategy: strategy,
      sizing_method: sizingMethod,
      momentum_lookback_days: parseInt(momentumLookbackDays),
      filter_negative_momentum: filterNegativeMomentum
    });
  };

  const applyBossaPreset = () => {
    setTransactionFeeEnabled(true);
    setTransactionFeeType('percentage');
    setTransactionFeeValue(0.29);
    setCapitalGainsTaxEnabled(false);
  };

  const applyInteractiveBrokersPreset = () => {
    setTransactionFeeEnabled(true);
    setTransactionFeeType('fixed');
    setTransactionFeeValue(1);
    setCapitalGainsTaxEnabled(true);
    setCapitalGainsTaxPct(19);
  };

  return (
    <div className="p-4 bg-white shadow rounded-lg mb-4">
      <h2 className="text-xl font-bold mb-4">Configuration</h2>

      {/* Broker Presets */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Broker Presets</h3>
        <div className="flex gap-2">
          <button
            onClick={applyBossaPreset}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Bossa
          </button>
          <button
            onClick={applyInteractiveBrokersPreset}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
          >
            Interactive Brokers
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Tickers (comma separated)</label>
          <input
            type="text"
            value={tickers}
            onChange={(e) => setTickers(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>

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

        <div>
          <label className="block text-sm font-medium text-gray-700">Number of Tickers to Select</label>
          <input
            type="number"
            value={nTickers}
            onChange={(e) => setNTickers(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Rebalance Period</label>
          <div className="flex space-x-2">
            <input
              type="number"
              value={rebalancePeriod}
              onChange={(e) => setRebalancePeriod(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
            <select
              value={rebalancePeriodUnit}
              onChange={(e) => setRebalancePeriodUnit(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            >
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Stop Loss (%)</label>
          <input
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            placeholder="Optional (e.g. 10)"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>

        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={smartStopLoss}
              onChange={(e) => setSmartStopLoss(e.target.checked)}
              disabled={!stopLoss || parseFloat(stopLoss) <= 0}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <span className="text-sm font-medium text-gray-700">
              Smart Stop Loss (only sell if not in top picks)
            </span>
          </label>
        </div>



        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={transactionFeeEnabled}
              onChange={(e) => setTransactionFeeEnabled(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <span className="text-sm font-medium text-gray-700">
              Transaction Fee
            </span>
          </label>
        </div>

        {transactionFeeEnabled && (
          <div className="ml-6 space-y-2">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="percentage"
                  checked={transactionFeeType === 'percentage'}
                  onChange={(e) => setTransactionFeeType(e.target.value)}
                  className="h-4 w-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">Percentage (%)</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="fixed"
                  checked={transactionFeeType === 'fixed'}
                  onChange={(e) => setTransactionFeeType(e.target.value)}
                  className="h-4 w-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">Fixed Amount</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Fee Value {transactionFeeType === 'percentage' ? '(%)' : '($)'}
              </label>
              <input
                type="number"
                step="0.01"
                value={transactionFeeValue}
                onChange={(e) => setTransactionFeeValue(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>
          </div>
        )}

        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={capitalGainsTaxEnabled}
              onChange={(e) => setCapitalGainsTaxEnabled(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <span className="text-sm font-medium text-gray-700">
              Capital Gains Tax
            </span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Tax Percentage (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={capitalGainsTaxPct}
            onChange={(e) => setCapitalGainsTaxPct(e.target.value)}
            disabled={!capitalGainsTaxEnabled}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Initial Capital</label>
          <input
            type="number"
            value={initialCapital}
            onChange={(e) => setInitialCapital(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>

        <div>
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
          <p className="text-xs text-gray-500 ml-6">
            If enabled, buys extra shares using borrowed cash (3% interest).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Strategy</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            >
              <option value="scoring">Scoring (Default)</option>
              <option value="momentum">Momentum</option>
              <option value="random">Random</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Position Sizing</label>
            <select
              value={sizingMethod}
              onChange={(e) => setSizingMethod(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            >
              <option value="equal">Equal Weight</option>
              <option value="var">Risk Parity (VaR)</option>
            </select>
          </div>
        </div>

        {strategy === 'momentum' && (
          <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">Momentum Settings</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500">Lookback Period (days)</label>
                <input
                  type="number"
                  value={momentumLookbackDays}
                  onChange={(e) => setMomentumLookbackDays(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Number of days to look back for calculating momentum (default: 30 days)
                </p>
              </div>
              <div className="flex items-center mt-6">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterNegativeMomentum}
                    onChange={(e) => setFilterNegativeMomentum(e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Filter Negative Momentum
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex space-x-4">
        <button
          onClick={handleDownload}
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          {isLoading ? 'Processing...' : '1. Download Data'}
        </button>
        <button
          onClick={handleRun}
          disabled={isLoading}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          {isLoading ? 'Processing...' : '2. Run Backtest'}
        </button>
      </div>
    </div>
  );
};

export default ConfigurationForm;
