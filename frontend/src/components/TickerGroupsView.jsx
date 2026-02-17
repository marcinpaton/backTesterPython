import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TickerGroupsView = ({ onBack }) => {
    const [groups, setGroups] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [currentGroup, setCurrentGroup] = useState({
        name: '',
        valid_from: new Date().toISOString().split('T')[0],
        tickers: ''
    });

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get('http://127.0.0.1:8000/api/ticker-groups');
            setGroups(response.data);
        } catch (err) {
            setError('Failed to load ticker groups');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccessMessage('');

        try {
            const tickerList = currentGroup.tickers.split(/\s+/).filter(t => t.trim());
            const payload = {
                ...currentGroup,
                tickers: tickerList
            };

            await axios.post('http://127.0.0.1:8000/api/ticker-groups', payload);
            setSuccessMessage(`Successfully saved group "${currentGroup.name}"!`);
            setIsEditing(false);
            fetchGroups();
        } catch (err) {
            setError('Failed to save group: ' + (err.response?.data?.detail || err.message));
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this group?')) return;

        setIsLoading(true);
        try {
            await axios.delete(`http://127.0.0.1:8000/api/ticker-groups/${id}`);
            setSuccessMessage('Group deleted successfully');
            fetchGroups();
        } catch (err) {
            setError('Failed to delete group');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const startEditing = (group = null) => {
        if (group) {
            setCurrentGroup({
                ...group,
                tickers: group.tickers.join(' ')
            });
        } else {
            setCurrentGroup({
                name: '',
                valid_from: new Date().toISOString().split('T')[0],
                tickers: ''
            });
        }
        setIsEditing(true);
    };

    return (
        <div className="bg-white shadow-md rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Ticker Groups</h2>
                <div className="space-x-4">
                    {!isEditing && (
                        <button
                            onClick={() => startEditing()}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                        >
                            + Add Group
                        </button>
                    )}
                    <button
                        onClick={onBack}
                        className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                    >
                        ← Back
                    </button>
                </div>
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

            {isEditing ? (
                <form onSubmit={handleSave} className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <h3 className="text-xl font-semibold mb-6">{currentGroup.id ? 'Edit Group' : 'New ticker group'}</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                            <input
                                type="text"
                                value={currentGroup.name}
                                onChange={e => setCurrentGroup({ ...currentGroup, name: e.target.value })}
                                required
                                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., S&P 500 Jan 2025"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                            <input
                                type="date"
                                value={currentGroup.valid_from}
                                onChange={e => setCurrentGroup({ ...currentGroup, valid_from: e.target.value })}
                                required
                                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tickers (separated by spaces)</label>
                        <textarea
                            value={currentGroup.tickers}
                            onChange={e => setCurrentGroup({ ...currentGroup, tickers: e.target.value })}
                            required
                            className="w-full h-48 p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                            placeholder="AAPL MSFT GOOGL..."
                        />
                    </div>

                    <div className="flex justify-end space-x-4">
                        <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded disabled:opacity-50"
                        >
                            {isLoading ? 'Saving...' : 'Save Group'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {groups.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                            <p className="text-gray-500">No ticker groups defined. Click "Add Group" to create one.</p>
                        </div>
                    ) : (
                        groups.map(group => (
                            <div key={group.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="text-lg font-bold text-gray-800">{group.name}</h4>
                                        <p className="text-sm text-blue-600 font-medium">Valid from: {group.valid_from}</p>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => startEditing(group)}
                                            className="text-blue-600 hover:text-blue-800 font-medium px-3 py-1 rounded hover:bg-blue-50"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(group.id)}
                                            className="text-red-600 hover:text-red-800 font-medium px-3 py-1 rounded hover:bg-red-50"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-3 rounded text-sm text-gray-600 font-mono max-h-24 overflow-y-auto">
                                    {group.tickers.join(', ')}
                                </div>
                                <div className="mt-2 text-xs text-gray-400">
                                    {group.tickers.length} tickers
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h4 className="text-blue-800 font-semibold mb-2">💡 How it works</h4>
                <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                    <li>Add multiple ticker groups with different "Valid From" dates.</li>
                    <li>During a backtest, the system automatically uses the group that matches each date.</li>
                    <li>Always make sure you have a group starting on or before your simulation start date.</li>
                    <li>Only one group is active at any given time.</li>
                </ul>
            </div>
        </div>
    );
};

export default TickerGroupsView;
