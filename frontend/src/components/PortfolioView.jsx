
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

import PortfolioChart from './PortfolioChart';

const PortfolioView = ({ onBack }) => {
    const [transactions, setTransactions] = useState([]);
    const [performanceData, setPerformanceData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [performanceLoading, setPerformanceLoading] = useState(false);
    const [error, setError] = useState(null);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentTransaction, setCurrentTransaction] = useState(null); // null means new, object means edit

    useEffect(() => {
        fetchTransactions();
        fetchPerformance();
    }, []);

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
        // Check if ID exists in current list (actually we generated ID for new ones too)
        // But we need to know if we replace or add?
        // Since we pass ID, we can just filter out old and push new, then sort.

        const filtered = transactions.filter(t => t.id !== transaction.id);
        const updatedList = [transaction, ...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));

        setTransactions(updatedList);
        setIsModalOpen(false);
        handleSaveToServer(updatedList);
    };

    const handleDownloadAllPrices = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch all tickers from backend
            const response = await fetch('http://127.0.0.1:8000/api/tickers');
            if (!response.ok) {
                throw new Error('Failed to fetch ticker list');
            }
            const tickers = await response.json();

            if (!Array.isArray(tickers) || tickers.length === 0) {
                alert('No tickers found in tickers.csv');
                setIsLoading(false);
                return;
            }

            // 2. Trigger download
            const today = new Date().toISOString().split('T')[0];
            await axios.post('http://127.0.0.1:8000/api/download', {
                tickers: tickers,
                start_date: '2001-01-01',
                end_date: today
            });

            alert(`Prices downloaded successfully for ${tickers.length} tickers.`);
            fetchPerformance(); // Refresh analysis
        } catch (err) {
            setError('Failed to download prices');
            console.error(err);
            alert('Error downloading prices: ' + (err.response?.data?.detail || err.message));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white shadow-md rounded-lg p-6">
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
                        onClick={handleDownloadAllPrices}
                        className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded"
                        title="Download prices for ALL tickers in tickers.csv"
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
                        {transactions.map((t) => (
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

            {isModalOpen && (
                <TransactionModal
                    transaction={currentTransaction}
                    onSave={handleModalSave}
                    onClose={() => setIsModalOpen(false)}
                />
            )}

            <div className="mt-8 border-t pt-8">
                <h3 className="text-xl font-bold mb-4">Performance Analysis</h3>
                {performanceLoading && <p>Loading performance...</p>}
                {!performanceLoading && performanceData ? (
                    <>
                        <PortfolioChart data={performanceData.history} />

                        {/* Monthly Returns List */}
                        {performanceData.monthly_returns && (
                            <div className="mt-8">
                                <h4 className="text-lg font-bold mb-4 text-gray-700">Monthly Returns</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {Object.entries(performanceData.monthly_returns)
                                        .sort((a, b) => a[0].localeCompare(b[0]))
                                        .map(([month, ret], index, array) => {
                                            const isLast = index === array.length - 1;
                                            const label = isLast ? `${month} (MTD)` : month;
                                            const isPositive = ret >= 0;

                                            // Optional: Check if current month is actually current calendar month
                                            // const now = new Date();
                                            // const currentMonth = now.toISOString().slice(0, 7);
                                            // const isActuallyCurrent = month === currentMonth;

                                            return (
                                                <div key={month} className={`p-3 rounded border ${isLast ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}>
                                                    <div className="text-xs text-gray-500 font-semibold mb-1">{label}</div>
                                                    <div className={`text-lg font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                                        {isPositive ? '+' : ''}{(ret * 100).toFixed(2)}%
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    !performanceLoading && <p className="text-gray-500">Add transactions and ensure data is downloaded to see performance metrics.</p>
                )}
            </div>
        </div>
    );
};

const TransactionModal = ({ transaction, onSave, onClose }) => {
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
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 uppercase"
                                />
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
