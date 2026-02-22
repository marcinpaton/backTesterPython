import React, { useState } from 'react';

const DataView = ({ onDownloadData, isLoading }) => {
    const [startDate, setStartDate] = useState('2006-06-01');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const handleDownload = async () => {
        try {
            // Fetch all unique tickers from all groups in the database
            const response = await fetch('http://127.0.0.1:8000/api/ticker-groups/unique-tickers');
            const tickerList = await response.json();

            if (tickerList && tickerList.length > 0) {
                console.log(`[DataView] Requesting download for ${tickerList.length} tickers:`, tickerList);
                if (onDownloadData) {
                    onDownloadData({ tickers: tickerList, start_date: startDate, end_date: endDate });
                }
            } else {
                alert('No tickers found in any ticker groups. Please add some tickers to a group first.');
            }
        } catch (err) {
            console.error("Failed to fetch unique tickers for download:", err);
            alert('Failed to fetch tickers from groups.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white p-6 rounded-lg shadow border-b-4 border-blue-500">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Management 📊</h1>
                <p className="text-gray-600">
                    Centralized hub for downloading historical price data and currency exchange rates (USD, EUR, GBP) from Yahoo Finance.
                    This will download data for all tickers defined in your Ticker Groups.
                </p>
            </div>

            {/* Main Content */}
            <div className="bg-white p-8 rounded-lg shadow max-w-2xl mx-auto">
                <h2 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">Download Settings</h2>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                            <p className="mt-1 text-xs text-gray-500 italic">Earliest date to include in history.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                End Date
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                            <p className="mt-1 text-xs text-gray-500 italic">Latest date to include (usually today).</p>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start space-x-3">
                        <div className="text-blue-500 mt-1">
                            <span className="text-xl">ℹ️</span>
                        </div>
                        <div>
                            <p className="text-sm text-blue-800">
                                This process will check your locally stored data and only download missing price information
                                (incremental download). It targets all tickers across all your defined Ticker Groups.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleDownload}
                        disabled={isLoading}
                        className={`w-full font-bold py-4 px-6 rounded-lg shadow-lg transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center space-x-2 ${isLoading
                            ? 'bg-gray-400 cursor-not-allowed text-white'
                            : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white'
                            }`}
                    >
                        <span>{isLoading ? '📥 Downloading Data...' : '🚀 Start Data Download'}</span>
                    </button>

                    {isLoading && (
                        <div className="mt-4 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p className="text-sm text-gray-500 mt-2">Checking local cache and fetching from Yahoo... Please wait.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h3 className="font-bold text-gray-800 mb-2">Smart Fetch</h3>
                    <p className="text-xs text-gray-600">Our algorithm only downloads what's missing, saving time and bandwidth.</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h3 className="font-bold text-gray-800 mb-2">Universal Sync</h3>
                    <p className="text-xs text-gray-600">Data downloaded here is immediately available in Scanner, Backtests and Portfolio.</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h3 className="font-bold text-gray-800 mb-2">Group Coverage</h3>
                    <p className="text-xs text-gray-600">Ensures all symbols defined in your ticker groups have up-to-date pricing.</p>
                </div>
            </div>
        </div>
    );
};

export default DataView;
