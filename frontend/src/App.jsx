import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ConfigurationForm from './components/ConfigurationForm';
import ResultsDashboard from './components/ResultsDashboard';
import OptimizationView from './components/OptimizationView';
import OptimizationAnalysisPage from './components/OptimizationAnalysisPage';

function App() {
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' or 'optimization'

  const handleDownload = async (params) => {
    setIsLoading(true);
    setError(null);
    try {
      // Using port 8000 as configured in backend
      await axios.post('http://127.0.0.1:8000/api/download', params);
      alert('Data downloaded successfully!');
    } catch (err) {
      setError(err.message || 'Failed to download data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunBacktest = async (params) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post('http://127.0.0.1:8000/api/backtest', params);
      setResults(response.data);
    } catch (err) {
      setError(err.message || 'Failed to run backtest');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const [initialFormValues, setInitialFormValues] = useState(null);

  useEffect(() => {
    // Check URL params for auto-run configuration
    const params = new URLSearchParams(window.location.search);
    if (params.has('autoRun')) {
      const config = {};

      // Helper to parse boolean
      const parseBool = (key) => params.get(key) === 'true';
      // Helper to parse int/float
      const parseFloatVal = (key) => params.has(key) && params.get(key) !== '' ? parseFloat(params.get(key)) : undefined;
      const parseIntVal = (key) => params.has(key) && params.get(key) !== '' ? parseInt(params.get(key)) : undefined;

      if (params.has('n_tickers')) config.n_tickers = parseIntVal('n_tickers');
      if (params.has('rebalance_period')) config.rebalance_period = parseIntVal('rebalance_period');
      if (params.has('rebalance_period_unit')) config.rebalance_period_unit = params.get('rebalance_period_unit');
      if (params.has('start_date')) config.start_date = params.get('start_date');
      if (params.has('end_date')) config.end_date = params.get('end_date');
      if (params.has('broker')) config.broker = params.get('broker');
      if (params.has('stop_loss_pct')) config.stop_loss_pct = parseFloatVal('stop_loss_pct');
      if (params.has('smart_stop_loss')) config.smart_stop_loss = parseBool('smart_stop_loss');
      if (params.has('transaction_fee_enabled')) config.transaction_fee_enabled = parseBool('transaction_fee_enabled');
      if (params.has('transaction_fee_type')) config.transaction_fee_type = params.get('transaction_fee_type');
      if (params.has('transaction_fee_value')) config.transaction_fee_value = parseFloatVal('transaction_fee_value');
      if (params.has('capital_gains_tax_enabled')) config.capital_gains_tax_enabled = parseBool('capital_gains_tax_enabled');
      if (params.has('capital_gains_tax_pct')) config.capital_gains_tax_pct = parseFloatVal('capital_gains_tax_pct');
      if (params.has('margin_enabled')) config.margin_enabled = parseBool('margin_enabled');
      if (params.has('strategy')) config.strategy = params.get('strategy');
      if (params.has('sizing_method')) config.sizing_method = params.get('sizing_method');
      if (params.has('momentum_lookback_days')) config.momentum_lookback_days = parseIntVal('momentum_lookback_days');
      if (params.has('filter_negative_momentum')) config.filter_negative_momentum = parseBool('filter_negative_momentum');
      if (params.has('initial_capital')) config.initial_capital = parseFloatVal('initial_capital');

      // Add defaults for missing required params if needed, or rely on ConfigurationForm defaults if undefined
      // But we need to execute runBacktest with complete params.
      // Merging with defaults for run:
      const fullParams = {
        n_tickers: 7,
        rebalance_period: 1,
        rebalance_period_unit: 'months',
        initial_capital: 10000,
        start_date: '2020-01-01',
        end_date: '2025-11-15',
        margin_enabled: true,
        strategy: 'scoring',
        sizing_method: 'equal',
        ...config
      };

      setInitialFormValues(fullParams);
      // Auto run
      handleRunBacktest(fullParams);

      // Clean URL (optional, keeps history clean)
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  const handleRunOptimization = async (params, autoSave = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post('http://127.0.0.1:8000/api/optimize', params);
      const results = response.data;
      setResults(results);

      // Handle Auto-Save
      if (autoSave) {
        let saveData; // Declare outside try block so it's accessible in catch
        try {
          console.log('Auto-save params:', params);
          console.log('Auto-save results:', results);

          if (results.walk_forward_mode) {
            // Walk-forward mode - results is already a dict
            saveData = {
              params: params,
              results: results
            };
          } else if (results.train_test_mode) {
            // Train/Test mode - results is already a dict
            saveData = {
              params: params,
              results: results
            };
          } else {
            // Normal optimization - results has structure { total_tests, completed_tests, results: [...] }
            // Backend expects the full structure, not just the array
            saveData = {
              params: params,
              results: results  // Send entire results object, not just results.results
            };
          }

          const saveResponse = await axios.post('http://127.0.0.1:8000/api/save_optimization_results', saveData);
          console.log('Results auto-saved:', saveResponse.data);
          // Optional: User notification
          // alert(`Results auto-saved to: ${saveResponse.data.filename}`); 
        } catch (saveErr) {
          console.error('Auto-save failed:', saveErr);
          console.error('Save data that failed:', saveData);
          if (saveErr.response) {
            console.error('Response data:', saveErr.response.data);
          }
          setError('Optimization finished, but auto-save failed: ' + (saveErr.response?.data?.detail || saveErr.message));
        }
      }

    } catch (err) {
      setError(err.message || 'Failed to run optimization');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Investment Strategy Backtester 🙂</h1>
          <div className="flex gap-2">
            {currentView === 'dashboard' && (
              <>
                <button
                  onClick={() => setCurrentView('analysis')}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition font-semibold"
                >
                  Analysis
                </button>
                <button
                  onClick={() => setCurrentView('optimization')}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition font-semibold"
                >
                  Optimization
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {currentView === 'dashboard' ? (
          <>
            <ConfigurationForm
              onDownloadData={handleDownload}
              onRunBacktest={handleRunBacktest}
              isLoading={isLoading}
              initialValues={initialFormValues}
            />
            <ResultsDashboard results={results} />
          </>
        ) : currentView === 'analysis' ? (
          <OptimizationAnalysisPage
            results={results}
            onLoadResults={setResults} // Allow loading results directly here
            onBack={() => setCurrentView('dashboard')}
          />
        ) : (
          <OptimizationView
            onRunOptimization={handleRunOptimization}
            isLoading={isLoading}
            onBack={() => setCurrentView('dashboard')}
            onGoToAnalysis={() => setCurrentView('analysis')}
            results={results}
            onLoadResults={setResults}
          />
        )}
      </div>
    </div>
  );
}

export default App;
