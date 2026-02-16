import React, { useState, useEffect } from 'react';

const ConfigurationForm = ({ onRunBacktest, onDownloadData, isLoading, initialValues }) => {
  const [tickers, setTickers] = useState(
    initialValues?.tickers?.join(', ') || '');
  const [startDate, setStartDate] = useState(initialValues?.start_date || '2024-01-01');
  const [endDate, setEndDate] = useState(initialValues?.end_date || new Date().toISOString().split('T')[0]);
  const [nTickers, setNTickers] = useState(initialValues?.n_tickers || 5);
  const [rebalancePeriod, setRebalancePeriod] = useState(initialValues?.rebalance_period || 1);
  const [rebalancePeriodUnit, setRebalancePeriodUnit] = useState(initialValues?.rebalance_period_unit || 'months');
  const [stopLoss, setStopLoss] = useState(initialValues?.stop_loss_pct ? initialValues.stop_loss_pct * 100 : '');
  const [smartStopLoss, setSmartStopLoss] = useState(initialValues?.smart_stop_loss || false);
  const [transactionFeeEnabled, setTransactionFeeEnabled] = useState(initialValues?.transaction_fee_enabled !== undefined ? initialValues.transaction_fee_enabled : true);
  const [transactionFeeType, setTransactionFeeType] = useState(initialValues?.transaction_fee_type || 'percentage');
  const [transactionFeeValue, setTransactionFeeValue] = useState(initialValues?.transaction_fee_value || 0.29);
  const [capitalGainsTaxEnabled, setCapitalGainsTaxEnabled] = useState(initialValues?.capital_gains_tax_enabled || false);
  const [capitalGainsTaxPct, setCapitalGainsTaxPct] = useState(initialValues?.capital_gains_tax_pct || 19);



  const [smartSellOnProfitEnabled, setSmartSellOnProfitEnabled] = useState(initialValues?.smart_sell_on_profit_enabled || false);
  const [smartSellOnProfitThreshold, setSmartSellOnProfitThreshold] = useState(initialValues?.smart_sell_on_profit_threshold_pct ? initialValues.smart_sell_on_profit_threshold_pct * 100 : '');
  const [smartSellOnProfitCheckFreq, setSmartSellOnProfitCheckFreq] = useState(initialValues?.smart_sell_on_profit_check_freq || 1);

  const [marginEnabled, setMarginEnabled] = useState(initialValues?.margin_enabled !== undefined ? initialValues.margin_enabled : false);
  const [strategy, setStrategy] = useState(initialValues?.strategy || 'momentum');
  const [sizingMethod, setSizingMethod] = useState(initialValues?.sizing_method || 'equal');
  const [initialCapital, setInitialCapital] = useState(initialValues?.initial_capital || 10000);
  const [momentumLookbackDays, setMomentumLookbackDays] = useState(initialValues?.momentum_lookback_days || 120);
  const [filterNegativeMomentum, setFilterNegativeMomentum] = useState(initialValues?.filter_negative_momentum || false);
  const [smaPeriod, setSmaPeriod] = useState(initialValues?.sma_period !== undefined ? initialValues.sma_period : -1);

  // Fetch default tickers if not provided in initialValues
  useEffect(() => {
    if (!initialValues?.tickers) {
      fetch('http://127.0.0.1:8000/api/tickers')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setTickers(data.join(', '));
          }
        })
        .catch(err => console.error("Failed to fetch tickers:", err));
    }
  }, [initialValues]);

  // Effect to update state if initialValues changes (e.g., when navigation happens)
  useEffect(() => {
    if (initialValues) {
      if (initialValues.tickers) setTickers(initialValues.tickers.join(', '));
      if (initialValues.start_date) setStartDate(initialValues.start_date);
      if (initialValues.end_date) setEndDate(initialValues.end_date);
      if (initialValues.n_tickers) setNTickers(initialValues.n_tickers);
      if (initialValues.rebalance_period) setRebalancePeriod(initialValues.rebalance_period);
      if (initialValues.rebalance_period_unit) setRebalancePeriodUnit(initialValues.rebalance_period_unit);
      if (initialValues.stop_loss_pct !== undefined) setStopLoss(initialValues.stop_loss_pct ? initialValues.stop_loss_pct * 100 : '');
      if (initialValues.smart_stop_loss !== undefined) setSmartStopLoss(initialValues.smart_stop_loss);
      if (initialValues.transaction_fee_enabled !== undefined) setTransactionFeeEnabled(initialValues.transaction_fee_enabled);
      if (initialValues.transaction_fee_type) setTransactionFeeType(initialValues.transaction_fee_type);
      if (initialValues.transaction_fee_value !== undefined) setTransactionFeeValue(initialValues.transaction_fee_value);
      if (initialValues.capital_gains_tax_enabled !== undefined) setCapitalGainsTaxEnabled(initialValues.capital_gains_tax_enabled);
      if (initialValues.capital_gains_tax_pct !== undefined) setCapitalGainsTaxPct(initialValues.capital_gains_tax_pct);

      if (initialValues.smart_sell_on_profit_enabled !== undefined) setSmartSellOnProfitEnabled(initialValues.smart_sell_on_profit_enabled);
      if (initialValues.smart_sell_on_profit_threshold_pct !== undefined) setSmartSellOnProfitThreshold(initialValues.smart_sell_on_profit_threshold_pct ? initialValues.smart_sell_on_profit_threshold_pct * 100 : '');
      if (initialValues.smart_sell_on_profit_check_freq !== undefined) setSmartSellOnProfitCheckFreq(initialValues.smart_sell_on_profit_check_freq);
      if (initialValues.margin_enabled !== undefined) setMarginEnabled(initialValues.margin_enabled);
      if (initialValues.strategy) setStrategy(initialValues.strategy);
      if (initialValues.sizing_method) setSizingMethod(initialValues.sizing_method);
      if (initialValues.initial_capital) setInitialCapital(initialValues.initial_capital);
      if (initialValues.momentum_lookback_days) setMomentumLookbackDays(initialValues.momentum_lookback_days);
      if (initialValues.filter_negative_momentum !== undefined) setFilterNegativeMomentum(initialValues.filter_negative_momentum);
      if (initialValues.sma_period !== undefined) setSmaPeriod(initialValues.sma_period);
    }
  }, [initialValues]);

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
      filter_negative_momentum: filterNegativeMomentum,
      sma_period: parseInt(smaPeriod),

      smart_sell_on_profit_enabled: smartSellOnProfitEnabled || strategy === 'momentum_smart_tp',
      smart_sell_on_profit_threshold_pct: (smartSellOnProfitEnabled || strategy === 'momentum_smart_tp') && smartSellOnProfitThreshold ? parseFloat(smartSellOnProfitThreshold) / 100 : null,
      smart_sell_on_profit_check_freq: parseInt(smartSellOnProfitCheckFreq)
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

        <div className="mt-4 border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded-r-lg">
          {/* Smart Sell on Profit Section */}
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={smartSellOnProfitEnabled || strategy === 'momentum_smart_tp'}
                  onChange={(e) => setSmartSellOnProfitEnabled(e.target.checked)}
                  disabled={strategy === 'momentum_smart_tp'}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  Smart Sell on Profit (Daily Check)
                </span>
              </label>

              {(smartSellOnProfitEnabled || strategy === 'momentum_smart_tp') && (
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={smartSellOnProfitThreshold}
                    onChange={(e) => setSmartSellOnProfitThreshold(e.target.value)}
                    placeholder="%"
                    className="w-24 border border-gray-300 rounded-md shadow-sm p-2 bg-white"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              )}
            </div>
            {(smartSellOnProfitEnabled || strategy === 'momentum_smart_tp') && (
              <p className="text-xs text-gray-600 ml-6">
                Check every {smartSellOnProfitCheckFreq} day(s): if return since purchase &ge; threshold AND ticker is NOT in the current top picks, sell and replace with best available ticker.
              </p>
            )}

            {(smartSellOnProfitEnabled || strategy === 'momentum_smart_tp') && (
              <div className="flex items-center space-x-2 ml-6">
                <label className="text-sm font-medium text-gray-700">Check Frequency (days):</label>
                <input
                  type="number"
                  value={smartSellOnProfitCheckFreq}
                  onChange={(e) => setSmartSellOnProfitCheckFreq(e.target.value)}
                  min="1"
                  className="w-20 border border-gray-300 rounded-md shadow-sm p-2 bg-white"
                />
              </div>
            )}
          </div>
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
              <option value="momentum_smart_tp">Momentum + Daily Smart TP</option>
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
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Momentum Lookback (days)
                </label>
                <input
                  type="number"
                  value={momentumLookbackDays}
                  onChange={(e) => setMomentumLookbackDays(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Number of days to look back for calculating momentum (default: 30 days)
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  SMA Filter Period (days)
                </label>
                <input
                  type="number"
                  value={smaPeriod}
                  onChange={(e) => setSmaPeriod(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  title="Tickers with price below this SMA will be excluded. Set to -1 to disable."
                />
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
    </div >
  );
};

export default ConfigurationForm;
