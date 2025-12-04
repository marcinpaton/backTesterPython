import React, { useState } from 'react';
import axios from 'axios';
import ConfigurationForm from './components/ConfigurationForm';
import ResultsDashboard from './components/ResultsDashboard';

function App() {
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Investment Strategy Backtester 🙂</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <ConfigurationForm
          onDownloadData={handleDownload}
          onRunBacktest={handleRunBacktest}
          isLoading={isLoading}
        />

        <ResultsDashboard results={results} />
      </div>
    </div>
  );
}

export default App;
