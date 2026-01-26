import React, { useState } from 'react';
import axios from 'axios';

const MomentumScanner = ({ onDownloadData, isLoading: isGlobalLoading }) => {
    // Default tickers will be fetched from server
    const [tickers, setTickers] = useState('');

    // Date states
    // Default analysis date to today
    const [analysisDate, setAnalysisDate] = useState(new Date().toISOString().split('T')[0]);

    // Download params
    const [startDate, setStartDate] = useState('2020-01-01');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    // Scanner params
    const [lookbackDays, setLookbackDays] = useState(120);
    const [nBestTickers, setNBestTickers] = useState(5);
    const [smaPeriod, setSmaPeriod] = useState(-1);

    React.useEffect(() => {
        fetch('http://127.0.0.1:8000/api/tickers')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setTickers(data.join(' ')); // Space separated for scanner typically? 
                    // Actually scanner handles both comma and whitespace in logic. 
                    // Let's use space to be consistent with previous default visual.
                }
            })
            .catch(err => console.error("Failed to fetch tickers:", err));
    }, []);

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
                momentum_lookback_days: parseInt(lookbackDays),
                n_best_tickers: parseInt(nBestTickers),
                filter_negative_momentum: false, // Default
                sma_period: parseInt(smaPeriod)
            });

            setResults(response.data);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.detail || err.message || 'Failed to scan momentum');
        } finally {
            setIsLoading(false);
        }
    };

    // Allocation State
    const [allocationData, setAllocationData] = useState(null);
    const [showAllocation, setShowAllocation] = useState(false);
    const [allocationLoading, setAllocationLoading] = useState(false);

    const handleCalculateAllocation = async () => {
        if (!results || results.length === 0) return;

        setAllocationLoading(true);
        try {
            const topTickers = results.map(r => r.ticker);
            const response = await axios.post('http://127.0.0.1:8000/api/scanner/allocation_data', {
                tickers: topTickers
            });

            const data = response.data;
            if (data.error) {
                alert(data.error);
                setAllocationLoading(false);
                return;
            }

            // Prepare Table Data
            const targetValuePerTicker = data.total_portfolio_value / topTickers.length;

            const tableRows = data.candidates.map(c => {
                const ownedQty = data.holdings[c.ticker] || 0;

                // Initialize rate (Use backend provided rate if available, else defaults)
                let rate = c.rate || 1.0;
                if (!c.rate) {
                    if (c.currency === 'USD') rate = 4.0;
                    if (c.currency === 'EUR') rate = 4.3;
                    if (c.currency === 'GBP') rate = 5.0;
                    if (c.currency === 'PLN') rate = 1.0;
                }

                const currentValPLN = ownedQty * c.price * rate;

                const isSelected = topTickers.includes(c.ticker);
                const currentTargetValue = isSelected ? targetValuePerTicker : 0;

                const diff = currentTargetValue - currentValPLN;

                const buyValueRaw = diff > 0 ? diff : 0;
                const sellValueRaw = diff < 0 ? Math.abs(diff) : 0;

                const priceInPLN = c.price * rate;
                const buyQty = (diff > 0 && priceInPLN > 0) ? Math.floor(buyValueRaw / priceInPLN) : 0;
                const sellQty = (diff < 0 && priceInPLN > 0) ? Math.floor(sellValueRaw / priceInPLN) : 0;

                // Recalculate Value based on Integer Qty
                const buyValue = buyQty * priceInPLN;
                const sellValue = sellQty * priceInPLN;

                return {
                    ticker: c.ticker,
                    currency: c.currency,
                    price: c.price,
                    rate: rate, // Editable Exchange Rate
                    ownedQty: ownedQty,
                    targetValue: currentTargetValue,
                    buyValue: buyValue,
                    buyQty: buyQty, // Editable
                    sellValue: sellValue,
                    sellQty: sellQty // Editable
                };
            });

            setAllocationData({
                ...data,
                rows: tableRows,
                activeTickerCount: topTickers.length // Store active count for display
            });
            setShowAllocation(true);

        } catch (err) {
            console.error("Allocation error:", err);
            alert("Failed to calculate allocation");
        } finally {
            setAllocationLoading(false);
        }
    };

    const handleAllocationChange = (index, field, value) => {
        const newRows = [...allocationData.rows];
        const row = { ...newRows[index] };

        row[field] = parseFloat(value) || 0;

        // Recalculate dependents
        if (field === 'price' || field === 'rate') {
            // Recalculate logic when Price or Rate changes
            const priceInPLN = row.price * row.rate;
            const newOwnedValue = row.ownedQty * priceInPLN;

            // Recalculate diff
            const diff = row.targetValue - newOwnedValue;

            const buyValueRaw = diff > 0 ? diff : 0;
            const sellValueRaw = diff < 0 ? Math.abs(diff) : 0;

            row.buyQty = (diff > 0 && priceInPLN > 0) ? Math.floor(buyValueRaw / priceInPLN) : 0;
            row.sellQty = (diff < 0 && priceInPLN > 0) ? Math.floor(sellValueRaw / priceInPLN) : 0;

            // Recalculate Value based on Integer Qty
            row.buyValue = row.buyQty * priceInPLN;
            row.sellValue = row.sellQty * priceInPLN;

        } else if (field === 'buyQty') {
            // User manually overrides Buy Qty
            const priceInPLN = row.price * row.rate;
            row.buyValue = row.buyQty * priceInPLN;
            // If buying, we are not selling
            row.sellValue = 0;
            row.sellQty = 0;
        } else if (field === 'sellQty') {
            // User manually overrides Sell Qty
            const priceInPLN = row.price * row.rate;
            row.sellValue = row.sellQty * priceInPLN;
            // If selling, we are not buying
            row.buyValue = 0;
            row.buyQty = 0;
        }

        newRows[index] = row;
        setAllocationData({ ...allocationData, rows: newRows });
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
                                        value={lookbackDays}
                                        onChange={(e) => setLookbackDays(e.target.value)}
                                        min="1"
                                        className="mt-1 block w-full border border-blue-300 rounded-md shadow-sm p-2"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-blue-800">Momentum SMA Filter (days)</label>
                                <input
                                    type="number"
                                    value={smaPeriod}
                                    onChange={(e) => setSmaPeriod(e.target.value)}
                                    className="mt-1 block w-full border border-blue-300 rounded-md shadow-sm p-2"
                                    title="Set to -1 to disable filter"
                                />
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
                <div className="bg-white p-6 rounded-lg shadow space-y-6">
                    <div>
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
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
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
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                                        {item.score !== undefined ? item.score.toFixed(1) : '-'}
                                                    </td>
                                                </tr>
                                                {expandedRow === item.ticker && (
                                                    <tr>
                                                        <td colSpan="4" className="px-6 py-4 bg-gray-50 border-b border-gray-200">
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

                    {/* Allocation Calculator Button */}
                    {results.length > 0 && (
                        <div>
                            <button
                                onClick={handleCalculateAllocation}
                                disabled={allocationLoading}
                                className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded shadow-lg transition disabled:bg-gray-400"
                            >
                                {allocationLoading ? 'Calculating...' : 'Calculate Allocation'}
                            </button>
                        </div>
                    )}

                    {/* Allocation Results */}
                    {showAllocation && allocationData && (
                        <div className="mt-8 border-t pt-8">
                            <h3 className="text-xl font-bold mb-4 text-purple-900">Allocation Plan</h3>

                            {/* Price Info Banner */}
                            {allocationData.price_timestamp && (
                                <div className={`mb-4 p-3 rounded-lg border ${allocationData.is_intraday ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-semibold ${allocationData.is_intraday ? 'text-green-800' : 'text-yellow-800'}`}>
                                            {allocationData.is_intraday ? '🟢 Live Prices' : '⚠️ Daily Prices'}
                                        </span>
                                        <span className="text-sm text-gray-600">
                                            Last updated: {allocationData.price_timestamp}
                                        </span>
                                        {allocationData.is_intraday && (
                                            <span className="text-xs text-gray-500 italic">
                                                (~15 min delay)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
                                <div className="bg-purple-50 p-3 rounded">
                                    <span className="block text-gray-500">Total Portfolio Value</span>
                                    <span className="text-lg font-bold">{allocationData.total_portfolio_value?.toFixed(2)} PLN</span>
                                </div>
                                <div className="bg-purple-50 p-3 rounded">
                                    <span className="block text-gray-500">Target Value per Ticker</span>
                                    <span className="text-lg font-bold">{(allocationData.total_portfolio_value / (allocationData.activeTickerCount || allocationData.rows.length)).toFixed(2)} PLN</span>
                                </div>
                                <div className="bg-purple-50 p-3 rounded">
                                    <span className="block text-gray-500">Current Cash</span>
                                    <span className="text-lg font-bold">{allocationData.cash?.toFixed(2)} PLN</span>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 border">
                                    <thead className="bg-purple-100">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-bold text-purple-800 uppercase">Ticker</th>
                                            <th className="px-4 py-2 text-left text-xs font-bold text-purple-800 uppercase">Currency</th>
                                            <th className="px-4 py-2 text-left text-xs font-bold text-purple-800 uppercase w-32">Price (Native)</th>
                                            <th className="px-4 py-2 text-left text-xs font-bold text-purple-800 uppercase w-24">Rate (to PLN)</th>
                                            <th className="px-4 py-2 text-left text-xs font-bold text-purple-800 uppercase">Price PLN</th>
                                            <th className="px-4 py-2 text-left text-xs font-bold text-purple-800 uppercase">Owned Qty</th>
                                            <th className="px-4 py-2 text-left text-xs font-bold text-purple-800 uppercase">Owned Value (PLN)</th>

                                            <th className="px-4 py-2 text-left text-xs font-bold text-purple-800 uppercase">To Buy (PLN)</th>
                                            <th className="px-4 py-2 text-left text-xs font-bold text-purple-800 uppercase w-32">Buy Qty</th>
                                            <th className="px-4 py-2 text-left text-xs font-bold text-red-800 uppercase">To Sell (PLN)</th>
                                            <th className="px-4 py-2 text-left text-xs font-bold text-red-800 uppercase w-32">Sell Qty</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {allocationData.rows.map((row, idx) => (
                                            <tr key={row.ticker} className={row.targetValue === 0 ? "bg-red-50" : "bg-green-50"}>
                                                <td className="px-4 py-2 font-bold">{row.ticker}</td>
                                                <td className="px-4 py-2 text-gray-600">{row.currency}</td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="number"
                                                        value={row.price}
                                                        onChange={(e) => handleAllocationChange(idx, 'price', e.target.value)}
                                                        className="w-24 border rounded p-1 text-right"
                                                        step="any"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="number"
                                                        value={row.rate}
                                                        onChange={(e) => handleAllocationChange(idx, 'rate', e.target.value)}
                                                        className="w-20 border rounded p-1 text-right"
                                                        step="any"
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-right font-medium">{(row.price * row.rate).toFixed(2)}</td>
                                                <td className="px-4 py-2 text-right">{row.ownedQty?.toFixed(0)}</td>
                                                <td className="px-4 py-2 text-right">{(row.ownedQty * row.price * row.rate).toFixed(2)}</td>

                                                <td className="px-4 py-2 text-right font-semibold text-green-600">{row.buyValue > 0 ? row.buyValue.toFixed(2) : '-'}</td>
                                                <td className="px-4 py-2">
                                                    {row.buyValue > 0 ? (
                                                        <input
                                                            type="number"
                                                            value={row.buyQty}
                                                            onChange={(e) => handleAllocationChange(idx, 'buyQty', e.target.value)}
                                                            className="w-24 border rounded p-1 text-right font-bold text-green-600"
                                                            step="1"
                                                        />
                                                    ) : '-'}
                                                </td>
                                                <td className="px-4 py-2 text-right font-semibold text-red-600">{row.sellValue > 0 ? row.sellValue.toFixed(2) : '-'}</td>
                                                <td className="px-4 py-2">
                                                    {row.sellValue > 0 ? (
                                                        <input
                                                            type="number"
                                                            value={row.sellQty}
                                                            onChange={(e) => handleAllocationChange(idx, 'sellQty', e.target.value)}
                                                            className="w-24 border rounded p-1 text-right font-bold text-red-600"
                                                            step="any"
                                                        />
                                                    ) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                        <tr>
                                            <td colSpan="7" className="px-4 py-2 text-right uppercase text-gray-700">Total:</td>
                                            <td className="px-4 py-2 text-right text-green-700">
                                                {allocationData.rows.reduce((sum, row) => sum + (row.buyValue || 0), 0).toFixed(2)}
                                            </td>
                                            <td></td>
                                            <td className="px-4 py-2 text-right text-red-700">
                                                {allocationData.rows.reduce((sum, row) => sum + (row.sellValue || 0), 0).toFixed(2)}
                                            </td>
                                            <td></td>
                                        </tr>
                                        <tr>
                                            <td colSpan="9" className="px-4 py-1 text-right text-xs uppercase text-gray-500">
                                                + Current Cash ({allocationData.cash?.toFixed(2)}):
                                            </td>
                                            <td className="px-4 py-1 text-right font-medium text-gray-600 border-t border-gray-300 border-dashed">
                                                {(allocationData.rows.reduce((sum, row) => sum + (row.sellValue || 0), 0) + (allocationData.cash || 0)).toFixed(2)}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                * <b>Price</b> matches data from Yahoo (Original Currency). <br />
                                * <b>Rate</b> is estimated conversion to PLN. Adjust manually for precision. <br />
                                * <b>Buy Qty</b> is calculated to reach Target Value (PLN) given the Price and Rate.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MomentumScanner;
