import React, { useState } from 'react';
import axios from 'axios';

const MomentumScanner = ({ onDownloadData, isLoading: isGlobalLoading }) => {
    // Default tickers as requested (same as ConfigurationForm defaults)
    const [tickers, setTickers] = useState(
        'CIEN WDC MU FRES.L ABX.TO TER CLS.TO PAAS.TO AU ANTO.L ANGPY GOOG FIX EVN.AX FSLR NST.AX DELTA.BK FN AEM.TO AMD CRDO SHOP.TO PRY.MI UCBJY UCB.BR APH WPM.L WPM.TO ASML FNV.TO KLAC VRT MNST IDXX AVGO BWXT STLD PLTR KEYS WWD MPWR ANET PSTG RYCEY RR.L FLEX ARZGY 1177.HK HWM CRS NVDA DLTR GD ADI ISRG ULS EME SAAB-B.ST FCX FUTU AV.L AVVIY SCHW AIR.PA EADSY CBOE CTRA MA AMZN MET RJF V PKG ADBE ADYEY ARM ASM.AS ASMIY AXON BLK BSX CDNS DXCM FAST FTNT GWRE IFNNY IFX.DE INTU LNSTY META NOW NSIS-B.CO NVZMY PGHN.SW PINS RHM.DE RMD RMD.AX SAP SAP.DE SMCI SPOT SYK TOST TT TW VEEV WDAY GEV'
    );

    // Date states
    // Default analysis date to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const [analysisDate, setAnalysisDate] = useState(yesterday.toISOString().split('T')[0]);

    // Download params
    const [startDate, setStartDate] = useState('2020-01-01');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    // Scanner params
    const [momentumLookback, setMomentumLookback] = useState(120);
    const [nBestTickers, setNBestTickers] = useState(5);

    // Results state
    const [results, setResults] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expandedRow, setExpandedRow] = useState(null); // Ticker of expanded row

    const handleDownload = () => {
        // Split by comma OR whitespace
        const tickerList = tickers.split(/[\s,]+/).map(t => t.trim()).filter(t => t.length > 0);
        if (onDownloadData) {
            onDownloadData({ tickers: tickerList, start_date: startDate, end_date: endDate });
        }
    };

    const handleScan = async () => {
        setIsLoading(true);
        setError(null);
        setResults(null);

        try {
            // Split by comma OR whitespace
            const tickerList = tickers.split(/[\s,]+/).map(t => t.trim()).filter(t => t.length > 0);

            const response = await axios.post('http://127.0.0.1:8000/api/momentum_scan', {
                tickers: tickerList,
                analysis_date: analysisDate,
                momentum_lookback_days: parseInt(momentumLookback),
                n_best_tickers: parseInt(nBestTickers)
            });

            setResults(response.data);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.detail || err.message || 'Failed to scan momentum');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white p-6 rounded-lg shadow">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Momentum Scanner 🚀</h1>
                <p className="text-gray-600">
                    Scan the market for the best performing tickers based on momentum strategy.
                </p>
            </div>

            {/* Configuration */}
            <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-bold mb-4">Configuration</h2>

                {/* Tickers Input */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tickers (whitespace separated)
                    </label>
                    <textarea
                        value={tickers}
                        onChange={(e) => setTickers(e.target.value)}
                        rows={4}
                        className="w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Data Download Section */}
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h3 className="text-md font-semibold text-gray-800 mb-3">1. Data Management</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500">Data Start Date</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500">Data End Date</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                />
                            </div>
                            <button
                                onClick={handleDownload}
                                disabled={isGlobalLoading || isLoading}
                                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition disabled:bg-gray-400"
                            >
                                {isGlobalLoading ? 'Downloading...' : 'Load Prices from Yahoo'}
                            </button>
                            <p className="text-xs text-gray-500 mt-1">
                                * Downloads data for all tickers above and saves to disk. Required before scanning.
                            </p>
                        </div>
                    </div>

                    {/* Scan Settings Section */}
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h3 className="text-md font-semibold text-blue-900 mb-3">2. Scan Settings</h3>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-blue-800">Analysis Date</label>
                                    <input
                                        type="date"
                                        value={analysisDate}
                                        onChange={(e) => setAnalysisDate(e.target.value)}
                                        className="mt-1 block w-full border border-blue-300 rounded-md shadow-sm p-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-blue-800">Momentum Lookback (days)</label>
                                    <input
                                        type="number"
                                        value={momentumLookback}
                                        onChange={(e) => setMomentumLookback(e.target.value)}
                                        min="1"
                                        className="mt-1 block w-full border border-blue-300 rounded-md shadow-sm p-2"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-blue-800">Number of Best Tickers</label>
                                <input
                                    type="number"
                                    value={nBestTickers}
                                    onChange={(e) => setNBestTickers(e.target.value)}
                                    min="1"
                                    className="mt-1 block w-full border border-blue-300 rounded-md shadow-sm p-2"
                                />
                            </div>
                            <button
                                onClick={handleScan}
                                disabled={isLoading || isGlobalLoading}
                                className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition disabled:bg-gray-400 shadow-md"
                            >
                                {isLoading ? 'Scanning...' : 'Calculate Best Tickers'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                    <strong className="font-bold">Error: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            )}

            {/* Results */}
            {results && (
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-bold mb-4 flex items-center">
                        Scan Results <span className="ml-2 text-sm font-normal text-gray-500">({analysisDate})</span>
                    </h2>

                    {results.length === 0 ? (
                        <p className="text-gray-500 italic">No tickers found matching criteria (or data missing for date).</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticker</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Momentum</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {results.map((item, index) => (
                                        <React.Fragment key={item.ticker}>
                                            <tr
                                                className={`hover:bg-gray-50 cursor-pointer ${expandedRow === item.ticker ? 'bg-blue-50' : ''}`}
                                                onClick={() => setExpandedRow(expandedRow === item.ticker ? null : item.ticker)}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    #{index + 1}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                                    {item.ticker}
                                                </td>
                                                <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${item.momentum >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {(item.momentum * 100).toFixed(2)}%
                                                </td>
                                            </tr>
                                            {expandedRow === item.ticker && (
                                                <tr>
                                                    <td colSpan="3" className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                                                        <div className="text-sm text-gray-700">
                                                            <div className="grid grid-cols-2 gap-4 max-w-lg">
                                                                <div>
                                                                    <span className="font-semibold block text-gray-500 text-xs uppercase">Start Date</span>
                                                                    <span>{item.start_date}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold block text-gray-500 text-xs uppercase">End Date</span>
                                                                    <span>{item.end_date}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold block text-gray-500 text-xs uppercase">Start Price</span>
                                                                    <span>${item.start_price?.toFixed(2)}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold block text-gray-500 text-xs uppercase">End Price</span>
                                                                    <span>${item.end_price?.toFixed(2)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MomentumScanner;
