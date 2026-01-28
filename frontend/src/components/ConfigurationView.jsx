import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ConfigurationView = ({ onBack }) => {
    const [tickers, setTickers] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        fetchTickers();
    }, []);

    const fetchTickers = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get('http://127.0.0.1:8000/api/tickers');
            // Join tickers with space
            setTickers(response.data.join(' '));
        } catch (err) {
            setError('Failed to load tickers');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
        setError(null);
        setSuccessMessage('');

        try {
            // Split by space and filter empty strings
            const tickerList = tickers.split(/\s+/).filter(t => t.trim());

            await axios.post('http://127.0.0.1:8000/api/tickers', {
                tickers: tickerList
            });

            setSuccessMessage(`Successfully saved ${tickerList.length} tickers!`);

            // Refresh the list to show cleaned/deduplicated tickers
            setTimeout(() => {
                fetchTickers();
            }, 500);
        } catch (err) {
            setError('Failed to save tickers: ' + (err.response?.data?.detail || err.message));
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white shadow-md rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Configuration</h2>
                <button
                    onClick={onBack}
                    className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                >
                    ← Back
                </button>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            {successMessage && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                    {successMessage}
                </div>
            )}

            <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-700 mb-4">Ticker List</h3>
                <p className="text-sm text-gray-600 mb-2">
                    Enter ticker symbols separated by spaces. Duplicates will be removed automatically.
                </p>

                <textarea
                    value={tickers}
                    onChange={(e) => setTickers(e.target.value)}
                    placeholder="AMD NVDA AAPL MSFT GOOGL..."
                    className="w-full h-64 p-4 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    disabled={isLoading}
                />

                <div className="mt-2 text-sm text-gray-500">
                    Current count: {tickers.split(/\s+/).filter(t => t.trim()).length} tickers
                </div>
            </div>

            <div className="flex justify-end space-x-4">
                <button
                    onClick={fetchTickers}
                    disabled={isLoading}
                    className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded disabled:opacity-50"
                >
                    {isLoading ? 'Loading...' : 'Reload'}
                </button>
                <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded disabled:opacity-50"
                >
                    {isLoading ? 'Saving...' : 'Save'}
                </button>
            </div>

            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-700 mb-2">ℹ️ Information</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    <li>Tickers are automatically converted to uppercase</li>
                    <li>Duplicate tickers are removed</li>
                    <li>Empty entries are ignored</li>
                    <li>Changes are saved to the database and synced across all devices</li>
                </ul>
            </div>
        </div>
    );
};

export default ConfigurationView;
