import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SimulationView = () => {
    const [tickers, setTickers] = useState([]);
    const [availableTickers, setAvailableTickers] = useState([]);
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [results, setResults] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchTickers();
    }, []);

    const fetchTickers = async () => {
        try {
            console.log('Fetching simulation tickers from backend...');
            const response = await axios.get('http://127.0.0.1:8000/api/simulation/tickers');
            console.log('Available tickers:', response.data.length);
            setAvailableTickers(response.data);
        } catch (err) {
            console.error('Error fetching tickers:', err);
            setError('Could not connect to backend to fetch tickers. Please ensure the backend is running on port 8000.');
        }
    };

    const handleRunSimulation = async () => {
        if (tickers.length === 0) {
            setError('Please select at least one ticker');
            return;
        }

        setIsLoading(true);
        setError(null);
        setResults(null);

        try {
            const response = await axios.post('http://127.0.0.1:8000/api/simulation/run', {
                tickers: tickers,
                start_date: startDate,
                end_date: endDate
            });
            setResults(response.data);
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Failed to run simulation');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleTicker = (ticker) => {
        if (tickers.includes(ticker)) {
            setTickers(tickers.filter(t => t !== ticker));
        } else {
            setTickers([...tickers, ticker]);
        }
    };

    const filteredTickers = availableTickers.filter(t =>
        t.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10);

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-4 text-gray-800">New Simulation</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="mb-4 relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tickers</label>
                    <div className="flex gap-2 mb-2">
                        <input
                            type="text"
                            placeholder="Type to search available tickers..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {searchTerm && (
                        <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1 p-1">
                            {filteredTickers.length > 0 ? filteredTickers.map(t => (
                                <button
                                    key={t}
                                    onClick={() => {
                                        toggleTicker(t);
                                        setSearchTerm('');
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-md transition-colors ${tickers.includes(t) ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}
                                >
                                    {t} {tickers.includes(t) && '✓'}
                                </button>
                            )) : (
                                <div className="px-3 py-2 text-gray-500 italic text-sm">No available tickers matching "{searchTerm}"</div>
                            )}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {tickers.map(t => (
                            <span key={t} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center">
                                {t}
                                <button onClick={() => toggleTicker(t)} className="ml-1 hover:text-blue-600 font-bold">×</button>
                            </span>
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleRunSimulation}
                    disabled={isLoading}
                    className={`w-full py-3 rounded-lg font-bold text-white transition-all transform active:scale-95 ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg'}`}
                >
                    {isLoading ? 'Running Simulation...' : 'Start Simulation'}
                </button>

                {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
            </div>

            {results && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                            <p className="text-sm text-gray-500 uppercase font-semibold">Initial Capital</p>
                            <p className="text-2xl font-bold text-gray-900">{results.summary.initial_capital.toLocaleString()} PLN</p>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                            <p className="text-sm text-gray-500 uppercase font-semibold">Final Value</p>
                            <p className="text-2xl font-bold text-gray-900">{results.summary.final_value.toLocaleString(undefined, { maximumFractionDigits: 2 })} PLN</p>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                            <p className="text-sm text-gray-500 uppercase font-semibold">Total Return</p>
                            <p className={`text-2xl font-bold ${(results.summary.total_return_pct >= 0) ? 'text-green-600' : 'text-red-600'}`}>
                                {(results.summary.total_return_pct * 100).toFixed(2)}%
                            </p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <h3 className="text-lg font-bold mb-4">Ticker Performance</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Ticker</th>
                                        <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{results.summary.start_date}</th>
                                        <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{results.summary.end_date}</th>
                                        <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Return</th>
                                        <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Shares</th>
                                        <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Final Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {results.tickers.map(t => (
                                        <tr key={t.ticker} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium">{t.ticker}</td>
                                            {t.error ? (
                                                <td colSpan="5" className="px-4 py-3 text-red-500 text-sm italic">{t.error}</td>
                                            ) : (
                                                <>
                                                    <td className="px-4 py-3">{t.price_start.toFixed(2)}</td>
                                                    <td className="px-4 py-3">{t.price_end.toFixed(2)}</td>
                                                    <td className={`px-4 py-3 font-semibold ${t.return_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {(t.return_pct * 100).toFixed(2)}%
                                                    </td>
                                                    <td className="px-4 py-2 text-sm">{t.shares.toFixed(4)}</td>
                                                    <td className="px-4 py-2 font-medium">{t.final_value.toFixed(2)} PLN</td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SimulationView;
