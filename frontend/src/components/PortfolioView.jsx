
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

import PortfolioChart from './PortfolioChart';
import TransactionImportModal from './TransactionImportModal';

const PortfolioView = ({ onBack }) => {
    const [transactions, setTransactions] = useState([]);
    const [performanceData, setPerformanceData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [performanceLoading, setPerformanceLoading] = useState(false);
    const [error, setError] = useState(null);
    const [availableTickers, setAvailableTickers] = useState([]);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [currentTransaction, setCurrentTransaction] = useState(null); // null means new, object means edit

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    useEffect(() => {
        fetchTransactions();
        fetchPerformance();
        fetchTickers();
    }, []);

    const fetchTickers = async () => {
        try {
            const response = await fetch('http://127.0.0.1:8000/api/ticker-groups/unique-tickers');
            if (response.ok) {
                const data = await response.json();
                setAvailableTickers(data || []);
            }
        } catch (err) {
            console.error("Failed to load tickers for suggestions", err);
        }
    };

    const fetchPerformance = async () => {
        setPerformanceLoading(true);
        try {
            const response = await axios.get('http://127.0.0.1:8000/api/portfolio/performance');
            if (response.data && response.data.history) {
                setPerformanceData(response.data);
            }
        } catch (err) {
            console.error("Failed to load performance", err);
        } finally {
            setPerformanceLoading(false);
        }
    };

    const fetchTransactions = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get('http://127.0.0.1:8000/api/portfolio/transactions');
            // Sort by date descending
            const sorted = (response.data || []).sort((a, b) => new Date(b.date) - new Date(a.date));
            setTransactions(sorted);
        } catch (err) {
            setError('Failed to load transactions');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveToServer = async (currentTransactions = transactions) => {
        setIsLoading(true);
        try {
            await axios.post('http://127.0.0.1:8000/api/portfolio/transactions', { transactions: currentTransactions });
            alert('Transactions saved successfully!');
            fetchPerformance(); // Refresh analysis
        } catch (err) {
            setError('Failed to save transactions');
            alert('Error saving transactions');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const toLocalISOString = (date) => {
        const pad = (num) => (num < 10 ? '0' + num : num);
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const handleAddClick = (initialType = 'DEPOSIT') => {
        setCurrentTransaction({
            id: uuidv4(),
            date: toLocalISOString(new Date()), // Use local time
            type: initialType,
            amount_pln: '',
            currency: initialType === 'DEPOSIT' ? 'PLN' : 'USD',
            ticker: '',
            quantity: '',
            price: '',
            fee_pln: ''
        });
        setIsModalOpen(true);
    };

    const handleEditClick = (t) => {
        setCurrentTransaction({ ...t });
        setIsModalOpen(true);
    };

    const handleDeleteClick = (id) => {
        if (window.confirm('Are you sure you want to delete this transaction?')) {
            const updatedList = transactions.filter(t => t.id !== id);
            setTransactions(updatedList);
            handleSaveToServer(updatedList);
        }
    };

    const handleModalSave = (transaction) => {
        // Logic to add or update
        const filtered = transactions.filter(t => t.id !== transaction.id);
        const updatedList = [transaction, ...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));

        setTransactions(updatedList);
        setIsModalOpen(false);
        handleSaveToServer(updatedList);
    };

    const handleImportSave = (newTransactions) => {
        const updatedList = [...newTransactions, ...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
        setTransactions(updatedList);
        setIsImportModalOpen(false);
        handleSaveToServer(updatedList);
    };

    const handleDownloadAllPrices = async () => {
        setIsLoading(true);
        try {
            // 1. Extract unique tickers from transactions
            const uniqueTickers = [...new Set(transactions.map(t => t.ticker).filter(t => t))];

            if (uniqueTickers.length === 0) {
                alert('No tickers found in transactions.');
                setIsLoading(false);
                return;
            }

            // 2. Trigger download
            const today = new Date().toISOString().split('T')[0];

            // Calculate start date: oldest transaction - 7 days
            let startDate = '2025-12-01'; // Default fallback
            if (transactions.length > 0) {
                const dates = transactions.map(t => new Date(t.date));
                const oldestDate = new Date(Math.min(...dates));
                oldestDate.setDate(oldestDate.getDate() - 7);
                startDate = oldestDate.toISOString().split('T')[0];
            }

            await axios.post('http://127.0.0.1:8000/api/download', {
                tickers: uniqueTickers,
                start_date: startDate,
                end_date: today,
                filename: 'portfolio_stock_prices.csv',
                currency_filename: 'portfolio_currency_prices.csv',
                use_transaction_file: true
            });

            alert(`Prices downloaded successfully for ${uniqueTickers.length} tickers.`);
            fetchPerformance(); // Refresh analysis
        } catch (err) {
            setError('Failed to download prices');
            console.error(err);
            alert('Error downloading prices: ' + (err.response?.data?.detail || err.message));
        } finally {
            setIsLoading(false);
        }
    };

    // Pagination logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentTransactions = transactions.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(transactions.length / itemsPerPage);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    // Unified YTD logic: Use the pre-calculated annual summaries from the backend
    const yearlyReturns = {};
    if (performanceData?.rebalance_history) {
        performanceData.rebalance_history.forEach(item => {
            if (item.type === 'annual_summary') {
                yearlyReturns[item.year] = item.annual_pnl_percent;
            }
        });
    }

    const returnsToRender = [];
    if (performanceData?.monthly_returns) {
        const sortedMonths = Object.entries(performanceData.monthly_returns).sort((a, b) => a[0].localeCompare(b[0]));
        let currentYear = null;
        
        sortedMonths.forEach(([monthStr, ret], index) => {
            const year = monthStr.split('-')[0];
            if (currentYear !== null && currentYear !== year) {
                // Push previous year YTD
                if (yearlyReturns[currentYear] !== undefined) {
                    returnsToRender.push({
                        key: `YTD-${currentYear}`,
                        label: `${currentYear} YTD`,
                        ret: yearlyReturns[currentYear],
                        isYtd: true,
                        isLastMonth: false
                    });
                }
            }
            
            currentYear = year;
            const isLastMonth = index === sortedMonths.length - 1;
            returnsToRender.push({
                key: monthStr,
                label: isLastMonth ? `${monthStr} (MTD)` : monthStr,
                ret: ret,
                isYtd: false,
                isLastMonth: isLastMonth
            });
            
            if (isLastMonth) {
                // Push final year YTD
                if (yearlyReturns[currentYear] !== undefined) {
                    returnsToRender.push({
                        key: `YTD-${currentYear}`,
                        label: `${currentYear} YTD`,
                        ret: yearlyReturns[currentYear],
                        isYtd: true,
                        isLastMonth: true // highlight the current YTD similarly
                    });
                }
            }
        });
    }

    return (
        <div className="bg-white shadow-md rounded-lg p-6">


            <div className="mb-8 border-b pb-8">

                {performanceLoading && <p>Loading performance...</p>}
                {!performanceLoading && performanceData ? (
                    <>
                        {/* Price Info Banner */}
                        {performanceData.price_timestamp && (
                            <div className={`mb-4 p-3 rounded-lg border ${performanceData.is_intraday ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}>
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-semibold ${performanceData.is_intraday ? 'text-green-800' : 'text-yellow-800'}`}>
                                        {performanceData.is_intraday ? '🟢 Live Prices' : '⚠️ Daily Prices'}
                                    </span>
                                    <span className="text-sm text-gray-600">
                                        Last updated: {performanceData.price_timestamp}
                                    </span>
                                    {performanceData.is_intraday && (
                                        <span className="text-xs text-gray-500 italic">
                                            (~15 min delay)
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        <PortfolioChart
                            data={performanceData.history}
                            onDownloadPrices={handleDownloadAllPrices}
                        />

                        {/* Monthly Returns List */}
                        {returnsToRender.length > 0 && (
                            <div className="mt-8">
                                <h4 className="text-lg font-bold mb-4 text-gray-700">Monthly Returns & YTD</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {returnsToRender.map((item) => {
                                        const isPositive = item.ret >= 0;
                                        const borderClass = item.isYtd 
                                            ? 'border-purple-300 bg-purple-50 ring-1 ring-purple-200' 
                                            : (item.isLastMonth ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200');

                                        return (
                                            <div key={item.key} className={`p-3 rounded border ${borderClass}`}>
                                                <div className={`text-xs font-semibold mb-1 ${item.isYtd ? 'text-purple-700' : 'text-gray-500'}`}>{item.label}</div>
                                                <div className={`text-lg font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                                    {isPositive ? '+' : ''}{(item.ret * 100).toFixed(2)}%
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    !performanceLoading && (
                        <div className="text-center py-8">
                            <p className="text-gray-500 mb-4">Add transactions and ensure data is downloaded to see performance metrics.</p>
                            <button
                                onClick={handleDownloadAllPrices}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-md"
                            >
                                Download Missing Prices
                            </button>
                        </div>
                    )
                )}
            </div>

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Portfolio Transactions</h2>
                <div className="space-x-4">
                    <button
                        onClick={() => handleAddClick('DEPOSIT')}
                        className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
                    >
                        + Deposit
                    </button>
                    <button
                        onClick={() => handleAddClick('BUY')}
                        className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
                    >
                        + Buy
                    </button>
                    <button
                        onClick={() => handleAddClick('SELL')}
                        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
                    >
                        + Sell
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                    >
                        Import tansactions
                    </button>

                    <button
                        onClick={handleDownloadAllPrices}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
                    >
                        Download Prices
                    </button>
                </div>
            </div>

            {error && <div className="text-red-500 mb-4">{error}</div>}

            {isLoading && <p>Loading...</p>}

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value (PLN)</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {currentTransactions.map((t) => (
                            <tr key={t.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {t.date.replace('T', ' ')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                     ${t.type === 'DEPOSIT' ? 'bg-green-100 text-green-800' :
                                            t.type === 'BUY' ? 'bg-blue-100 text-blue-800' :
                                                'bg-red-100 text-red-800'}`}>
                                        {t.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {t.type === 'DEPOSIT' && (
                                        <span>Deposit: <b>{t.amount_pln} {t.currency || 'PLN'}</b></span>
                                    )}
                                    {(t.type === 'BUY' || t.type === 'SELL') && (
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-900">{t.ticker}</span>
                                            <span>{t.quantity} x {t.price} PLN</span>
                                            <span className="text-xs text-gray-400">Fee: {t.fee_pln} PLN</span>
                                            {t.currency && t.currency !== 'PLN' && (
                                                <span className="text-xs font-bold text-gray-500">Asset Currency: {t.currency}</span>
                                            )}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                    {/* Display Value in PLN */}
                                    {t.type === 'DEPOSIT' ? `${t.amount_pln} PLN` :
                                        `${(t.quantity * t.price).toFixed(2)} PLN`}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => handleEditClick(t)} className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
                                    <button onClick={() => handleDeleteClick(t.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {transactions.length === 0 && !isLoading && (
                            <tr>
                                <td colSpan="5" className="px-6 py-4 text-center text-gray-500">No transactions found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>

            </div>

            {/* Pagination Controls */}
            {
                transactions.length > 0 && (
                    <div className="flex justify-between items-center mt-4 border-t pt-4">
                        <div className="flex items-center text-sm text-gray-700">
                            <span className="mr-2">Rows per page:</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="border border-gray-300 rounded p-1"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span className="ml-4">
                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, transactions.length)} of {transactions.length} entries
                            </span>
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className={`px-3 py-1 rounded border ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-blue-600 hover:bg-gray-50 border-gray-300'}`}
                            >
                                Previous
                            </button>
                            <div className="flex items-center space-x-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    // Simple logic to show a window of pages or just first few. 
                                    // Better: Show current, prev, next, first, last.
                                    // For now: Simple prev/next with "Page X of Y" is robust enough.
                                })}
                                <span className="px-3 py-1 text-sm text-gray-700">
                                    Page {currentPage} of {totalPages}
                                </span>
                            </div>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className={`px-3 py-1 rounded border ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-blue-600 hover:bg-gray-50 border-gray-300'}`}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )
            }

            {
                isModalOpen && (
                    <TransactionModal
                        transaction={currentTransaction}
                        onSave={handleModalSave}
                        onClose={() => setIsModalOpen(false)}
                        availableTickers={availableTickers}
                    />
                )
            }

            {
                isImportModalOpen && (
                    <TransactionImportModal
                        onClose={() => setIsImportModalOpen(false)}
                        onImport={handleImportSave}
                        availableTickers={availableTickers}
                    />
                )
            }


        </div >
    );
};

const TransactionModal = ({ transaction, onSave, onClose, availableTickers = [] }) => {
    const [formData, setFormData] = useState(transaction);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newData = { ...prev, [name]: value };
            // If switching to DEPOSIT, force currency to PLN
            if (name === 'type' && value === 'DEPOSIT') {
                newData.currency = 'PLN';
            }
            return newData;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Basic validation/conversion
        const processed = {
            ...formData,
            currency: formData.currency || 'PLN',
            amount_pln: formData.amount_pln ? parseFloat(formData.amount_pln) : null,
            quantity: formData.quantity ? parseFloat(formData.quantity) : null,
            price: formData.price ? parseFloat(formData.price) : null,
            fee_pln: formData.fee_pln ? parseFloat(formData.fee_pln) : 0.0
        };
        onSave(processed);
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
                <h3 className="text-xl font-bold mb-4">{transaction.id ? 'Edit' : 'Add'} Transaction</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className={formData.type === 'DEPOSIT' ? "col-span-2" : ""}>
                            <label className="block text-sm font-medium text-gray-700">Type</label>
                            <select
                                name="type"
                                value={formData.type}
                                onChange={handleChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            >
                                <option value="DEPOSIT">Deposit Account</option>
                                <option value="BUY">Buy Shares</option>
                                <option value="SELL">Sell Shares</option>
                            </select>
                        </div>
                        {formData.type !== 'DEPOSIT' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Currency</label>
                                <select
                                    name="currency"
                                    value={formData.currency}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 font-bold"
                                >
                                    <option value="PLN">PLN</option>
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="GBP">GBP</option>
                                </select>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Date & Time</label>
                        <input
                            type="datetime-local"
                            name="date"
                            value={formData.date}
                            onChange={handleChange}
                            required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        />
                    </div>

                    {formData.type === 'DEPOSIT' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Amount (PLN)</label>
                            <input
                                type="number"
                                step="0.01"
                                name="amount_pln"
                                value={formData.amount_pln}
                                onChange={handleChange}
                                required
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            />
                        </div>
                    )}

                    {(formData.type === 'BUY' || formData.type === 'SELL') && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Ticker</label>
                                <input
                                    type="text"
                                    name="ticker"
                                    value={formData.ticker}
                                    onChange={handleChange}
                                    required
                                    list="ticker-suggestions"
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 uppercase"
                                    autoComplete="off"
                                />
                                <datalist id="ticker-suggestions">
                                    {availableTickers.map((ticker) => (
                                        <option key={ticker} value={ticker} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Quantity</label>
                                    <input
                                        type="number"
                                        step="any"
                                        name="quantity"
                                        value={formData.quantity}
                                        onChange={handleChange}
                                        required
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Price (PLN)</label>
                                    <input
                                        type="number"
                                        step="any"
                                        name="price"
                                        value={formData.price}
                                        onChange={handleChange}
                                        required
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Fee (PLN)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="fee_pln"
                                    value={formData.fee_pln}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                />
                            </div>
                        </>
                    )}

                    <div className="flex justify-end space-x-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PortfolioView;
