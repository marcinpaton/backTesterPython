import React, { useState, useEffect } from 'react';

const ConfigurationForm = ({ onRunBacktest, isLoading, initialValues }) => {
  const [startDate, setStartDate] = useState(initialValues?.start_date || '2020-01-01');
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



  // Effect to update state if initialValues changes (e.g., when navigation happens)
  useEffect(() => {
    if (initialValues) {
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
          <label className="block text-sm font-medium text-gray-700 whitespace-nowrap">Number of Tickers</label>
          <input
            type="number"
            value={nTickers}
            onChange={(e) => setNTickers(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>

        <div className="p-3 rounded-lg border border-red-100 bg-red-50/30 shadow-sm flex flex-col md:flex-row md:items-end space-y-3 md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-bold text-gray-700 whitespace-nowrap">Stop Loss (%)</label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="e.g. 10"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white"
            />
          </div>

          <div className="flex-[2] pb-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={smartStopLoss}
                onChange={(e) => setSmartStopLoss(e.target.checked)}
                disabled={!stopLoss || parseFloat(stopLoss) <= 0}
                className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="text-sm font-bold text-gray-700">
                Smart Stop Loss <span className="text-gray-500 font-normal italic text-xs">(only sell if not in top picks)</span>
              </span>
            </label>
          </div>
        </div>



        <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/50">
          <label className="flex items-center space-x-2 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={transactionFeeEnabled}
              onChange={(e) => setTransactionFeeEnabled(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-bold text-gray-700">
              Transaction Fee
            </span>
          </label>

          {transactionFeeEnabled && (
            <div className="space-y-3 mt-2 pl-6 border-l-2 border-gray-200">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    value="percentage"
                    checked={transactionFeeType === 'percentage'}
                    onChange={(e) => setTransactionFeeType(e.target.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Percentage (%)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    value="fixed"
                    checked={transactionFeeType === 'fixed'}
                    onChange={(e) => setTransactionFeeType(e.target.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Fixed ($)</span>
                </label>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Fee Value {transactionFeeType === 'percentage' ? '(%)' : '($)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={transactionFeeValue}
                  onChange={(e) => setTransactionFeeValue(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white"
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/50">
          <label className="flex items-center space-x-2 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={capitalGainsTaxEnabled}
              onChange={(e) => setCapitalGainsTaxEnabled(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-bold text-gray-700">
              Capital Gains Tax
            </span>
          </label>

          {capitalGainsTaxEnabled && (
            <div className="space-y-3 mt-2 pl-6 border-l-2 border-gray-200">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Tax Percentage (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={capitalGainsTaxPct}
                  onChange={(e) => setCapitalGainsTaxPct(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white"
                />
              </div>
            </div>
          )}
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Strategy</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            >
              <option value="scoring">Scoring</option>
              <option value="momentum">Momentum (Default)</option>
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

      <div className="mt-6 border border-blue-200 p-3 bg-blue-50/50 rounded-lg shadow-sm">
        {/* Smart Sell on Profit Section */}
        <div className="flex flex-col space-y-4">
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={smartSellOnProfitEnabled}
                onChange={(e) => setSmartSellOnProfitEnabled(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-bold text-gray-800">
                Smart Sell on Profit <span className="text-gray-500 font-normal italic text-xs">(Daily Check)</span>
              </span>
            </label>

            {smartSellOnProfitEnabled && (
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={smartSellOnProfitThreshold}
                  onChange={(e) => setSmartSellOnProfitThreshold(e.target.value)}
                  placeholder="Profit threshold %"
                  className="w-32 border border-gray-300 rounded-md shadow-sm p-2 bg-white font-bold"
                />
                <span className="text-sm font-bold text-blue-600">%</span>
              </div>
            )}
          </div>

          {smartSellOnProfitEnabled && (
            <div className="space-y-3 ml-6">
              <p className="text-xs text-gray-600 leading-relaxed">
                Check every <b>{smartSellOnProfitCheckFreq} day(s)</b>: if return since purchase <b>&ge; {smartSellOnProfitThreshold || 'X'}%</b> AND ticker is <b>NOT</b> in the current top picks, sell and replace with the next best available ticker.
              </p>
              <div className="flex items-center space-x-3">
                <label className="text-sm font-medium text-gray-700">Check Frequency:</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={smartSellOnProfitCheckFreq}
                    onChange={(e) => setSmartSellOnProfitCheckFreq(e.target.value)}
                    min="1"
                    className="w-16 border border-gray-300 rounded-md shadow-sm p-2 bg-white text-center font-bold"
                  />
                  <span className="text-sm text-gray-500 font-medium">days</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex space-x-4 items-center p-1">
        <label className="block text-sm font-bold text-gray-700 whitespace-nowrap">Initial Capital ($):</label>
        <input
          type="number"
          value={initialCapital}
          onChange={(e) => setInitialCapital(e.target.value)}
          className="block w-48 border border-gray-300 rounded-md shadow-sm p-2 bg-white font-bold text-blue-700"
        />
      </div>

      <div className="mt-4 p-3 rounded-lg border border-orange-200 bg-orange-50/30 shadow-sm">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={marginEnabled}
            onChange={(e) => setMarginEnabled(e.target.checked)}
            className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
          />
          <span className="text-sm font-bold text-gray-800">
            Enable Margin Trading <span className="text-gray-500 font-normal italic text-xs">(Leverage)</span>
          </span>
        </label>
        <p className="text-xs text-gray-600 ml-6 mt-1">
          If enabled, buys extra shares using borrowed cash (3% interest). Use with caution.
        </p>
      </div>

      <div className="mt-4 flex">
        <button
          onClick={handleRun}
          disabled={isLoading}
          className="w-full bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-4 rounded focus:outline-none focus:shadow-outline shadow-md transition-all active:scale-95 text-lg"
        >
          {isLoading ? 'Processing...' : 'Run Backtest 🚀'}
        </button>
      </div>
    </div >
  );
};

export default ConfigurationForm;
