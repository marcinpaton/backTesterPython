import React, { useState } from 'react';
import axios from 'axios';
import ConfigurationForm from './components/ConfigurationForm';
import ResultsDashboard from './components/ResultsDashboard';
import OptimizationView from './components/OptimizationView';

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

  const handleRunOptimization = async (params) => {
    setIsLoading(true);
    setError(null);
    try {
      // TODO: Implement backend endpoint
      console.log('Optimization params:', params);
      alert('Optimization will be implemented in the backend');
      // const response = await axios.post('http://127.0.0.1:8000/api/optimize', params);
      // setResults(response.data);
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
          {currentView === 'dashboard' && (
            <button
              onClick={() => setCurrentView('optimization')}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition font-semibold"
            >
              Optimization
            </button>
          )}
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
            />
            <ResultsDashboard results={results} />
          </>
        ) : (
          <OptimizationView
            onRunOptimization={handleRunOptimization}
            isLoading={isLoading}
            onBack={() => setCurrentView('dashboard')}
          />
        )}
      </div>
    </div>
  );
}

export default App;
