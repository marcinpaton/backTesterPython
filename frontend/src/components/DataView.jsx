import React, { useState } from 'react';

const DataView = ({ onDownloadData, isLoading }) => {
    const [startDate, setStartDate] = useState('2006-06-01');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [customTickers, setCustomTickers] = useState('');
    const [isSavingCustom, setIsSavingCustom] = useState(false);

    // Fetch custom tickers on mount
    React.useEffect(() => {
        const fetchCustomTickers = async () => {
            try {
                const response = await fetch('http://127.0.0.1:8000/api/custom-tickers');
                const data = await response.json();
                if (Array.isArray(data)) {
                    setCustomTickers(data.join(', '));
                }
            } catch (err) {
                console.error("Failed to fetch custom tickers:", err);
            }
        };
        fetchCustomTickers();
    }, []);

    const handleSaveCustomTickers = async () => {
        setIsSavingCustom(true);
        try {
            const tickerList = customTickers.split(',')
                .map(t => t.trim().toUpperCase())
                .filter(t => t !== '');

            const response = await fetch('http://127.0.0.1:8000/api/custom-tickers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tickers: tickerList })
            });

            if (response.ok) {
                alert('Additional tickers saved successfully!');
            } else {
                alert('Failed to save additional tickers.');
            }
        } catch (err) {
            console.error("Error saving custom tickers:", err);
            alert('Error connecting to backend.');
        } finally {
            setIsSavingCustom(false);
        }
    };

    const handleDownload = async () => {
        try {
            // Fetch all unique tickers (now includes both groups and custom)
            const response = await fetch('http://127.0.0.1:8000/api/ticker-groups/unique-tickers');
            const tickerList = await response.json();

            if (tickerList && tickerList.length > 0) {
                console.log(`[DataView] Requesting download for ${tickerList.length} tickers:`, tickerList);
                if (onDownloadData) {
                    onDownloadData({ tickers: tickerList, start_date: startDate, end_date: endDate });
                }
            } else {
                alert('No tickers found. Please add some tickers to groups or the additional tickers list first.');
            }
        } catch (err) {
            console.error("Failed to fetch unique tickers for download:", err);
            alert('Failed to fetch tickers for download.');
        }
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="bg-white p-6 rounded-lg shadow border-b-4 border-blue-500">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Management 📊</h1>
                        <p className="text-gray-600">
                            Centralized hub for downloading historical price data and currency exchange rates.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Download Settings */}
                <div className="bg-white p-8 rounded-lg shadow border border-gray-100 flex flex-col">
                    <h2 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2 flex items-center">
                        <span className="mr-2">📅</span> Download Timeline
                    </h2>

                    <div className="space-y-6 flex-grow">
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
                                <p className="mt-1 text-xs text-gray-500 italic">Earliest date for price history.</p>
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
                                <p className="mt-1 text-xs text-gray-500 italic">Usually current date.</p>
                            </div>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start space-x-3">
                            <div className="text-blue-500 mt-1">
                                <span className="text-xl">ℹ️</span>
                            </div>
                            <div>
                                <p className="text-sm text-blue-800">
                                    Downloads price info for all <b>Ticker Groups</b> + <b>Additional Tickers</b>.
                                    Incremental download: only missing dates are fetched.
                                </p>
                            </div>
                        </div>

                        <div className="mt-auto pt-6">
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
                                    <p className="text-sm text-gray-500 mt-2">Fetching from Yahoo... Please wait.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Additional Tickers */}
                <div className="bg-white p-8 rounded-lg shadow border border-gray-100 flex flex-col">
                    <h2 className="text-xl font-bold mb-2 text-gray-800 border-b pb-2 flex items-center">
                        <span className="mr-2">➕</span> Additional Tickers
                    </h2>
                    <p className="text-sm text-gray-500 mb-4 italic">
                        Symbols entered here will always be downloaded along with group tickers.
                    </p>

                    <div className="space-y-4 flex-grow">
                        <textarea
                            value={customTickers}
                            onChange={(e) => setCustomTickers(e.target.value)}
                            placeholder="e.g. BTC-USD, GC=F, MSFT, AAPL"
                            className="w-full h-40 border border-gray-300 rounded-md shadow-sm p-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono"
                        ></textarea>
                        <p className="text-xs text-gray-400">Comma-separated ticker symbols.</p>

                        <div className="mt-auto pt-4">
                            <button
                                onClick={handleSaveCustomTickers}
                                disabled={isSavingCustom}
                                className={`w-full font-bold py-3 px-6 rounded-lg border-2 transition-all flex items-center justify-center space-x-2 ${isSavingCustom
                                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                    : 'border-blue-600 text-blue-600 hover:bg-blue-50 active:bg-blue-100'
                                    }`}
                            >
                                <span>{isSavingCustom ? '💾 Saving...' : '💾 Save Additional Tickers'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-2 flex items-center">
                        <span className="mr-2 text-blue-500">⚡</span> Smart Fetch
                    </h3>
                    <p className="text-sm text-gray-600">Our algorithm only downloads what's missing, saving time and bandwidth.</p>
                </div>
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-2 flex items-center">
                        <span className="mr-2 text-blue-500">🌐</span> Universal Sync
                    </h3>
                    <p className="text-sm text-gray-600">Data downloaded here is immediately available in Scanner, Backtests and Portfolio.</p>
                </div>
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-2 flex items-center">
                        <span className="mr-2 text-blue-500">📂</span> Full Coverage
                    </h3>
                    <p className="text-sm text-gray-600">Ensures all symbols across groups and your custom list have up-to-date pricing.</p>
                </div>
            </div>
        </div>
    );
};

export default DataView;
