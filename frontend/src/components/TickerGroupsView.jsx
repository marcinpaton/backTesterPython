import React, { useState, useEffect, useRef, useMemo } from 'react';
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
    const [currentPage, setCurrentPage] = useState(1);
    const [groupsPerPage, setGroupsPerPage] = useState(10);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get('http://127.0.0.1:8000/api/ticker-groups');
            setGroups(response.data);
            setSelectedIds(new Set()); // Reset selection on fetch
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

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} selected groups?`)) return;

        setIsLoading(true);
        setError(null);
        setSuccessMessage('');

        try {
            await axios.post('http://127.0.0.1:8000/api/ticker-groups/bulk-delete', { ids: Array.from(selectedIds) });
            setSuccessMessage(`Successfully deleted ${selectedIds.size} groups`);
            fetchGroups();
        } catch (err) {
            setError('Failed to delete groups: ' + (err.response?.data?.detail || err.message));
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setIsLoading(true);
        setError(null);
        setSuccessMessage('');

        try {
            const filePromises = files.map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (event) => resolve({ filename: file.name, content: event.target.result });
                    reader.onerror = (error) => reject(error);
                    reader.readAsText(file);
                });
            });

            const fileContents = await Promise.all(filePromises);
            const response = await axios.post('http://127.0.0.1:8000/api/ticker-groups/import', { files: fileContents });

            const results = response.data.results;
            const successCount = results.filter(r => r.status === 'success').length;
            const skippedCount = results.filter(r => r.status === 'skipped').length;
            const errorCount = results.filter(r => r.status === 'error').length;

            let msg = `Import complete: ${successCount} groups added.`;
            if (skippedCount > 0) msg += ` ${skippedCount} skipped (already exists).`;
            if (errorCount > 0) msg += ` ${errorCount} errors.`;

            setSuccessMessage(msg);
            fetchGroups();
        } catch (err) {
            setError('Failed to import groups: ' + (err.response?.data?.detail || err.message));
            console.error(err);
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
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

    const currentVisibleGroups = useMemo(() => {
        const startIndex = (currentPage - 1) * groupsPerPage;
        return groups.slice(startIndex, startIndex + groupsPerPage);
    }, [groups, currentPage, groupsPerPage]);

    const toggleSelect = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAllVisible = () => {
        const allVisibleIds = currentVisibleGroups.map(g => g.id);
        const allSelected = allVisibleIds.every(id => selectedIds.has(id));

        const newSelected = new Set(selectedIds);
        if (allSelected) {
            allVisibleIds.forEach(id => newSelected.delete(id));
        } else {
            allVisibleIds.forEach(id => newSelected.add(id));
        }
        setSelectedIds(newSelected);
    };

    return (
        <div className="bg-white shadow-md rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Ticker Groups</h2>
                <div className="space-x-4">
                    {!isEditing && (
                        <>
                            <input
                                type="file"
                                multiple
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                            <button
                                onClick={handleImportClick}
                                disabled={isLoading}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                            >
                                {isLoading ? 'Importing...' : 'Import Groups'}
                            </button>
                            <button
                                onClick={() => startEditing()}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                            >
                                + Add Group
                            </button>
                        </>
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

            {!isEditing && groups.length > 0 && (
                <div className="flex justify-between items-center mb-4 bg-gray-50 p-3 rounded border border-gray-200">
                    <div className="flex items-center space-x-6">
                        <label className="flex items-center cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={currentVisibleGroups.length > 0 && currentVisibleGroups.every(g => selectedIds.has(g.id))}
                                onChange={toggleSelectAllVisible}
                                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="ml-2 text-sm font-medium text-gray-700 group-hover:text-blue-600">
                                Select All (this page)
                            </span>
                        </label>

                        <div className="flex items-center">
                            <span className="text-sm text-gray-500 mr-2">Page size:</span>
                            <select
                                value={groupsPerPage}
                                onChange={(e) => {
                                    setGroupsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="text-sm border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 bg-white py-1 px-2"
                            >
                                {[10, 20, 50, 100].map(size => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {selectedIds.size > 0 && (
                        <div className="flex items-center space-x-4">
                            <span className="text-sm font-semibold text-blue-700">
                                {selectedIds.size} selected
                            </span>
                            <button
                                onClick={handleBulkDelete}
                                className="bg-red-100 hover:bg-red-200 text-red-700 font-bold py-1.5 px-4 rounded border border-red-300 transition-colors"
                            >
                                Delete Selected
                            </button>
                        </div>
                    )}
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
                <>
                    <div className="grid grid-cols-1 gap-6">
                        {groups.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                <p className="text-gray-500">No ticker groups defined. Click "Add Group" to create one.</p>
                            </div>
                        ) : (
                            currentVisibleGroups.map(group => (
                                <div
                                    key={group.id}
                                    className={`relative border rounded-lg p-6 hover:shadow-md transition-all ${selectedIds.has(group.id) ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200'}`}
                                >
                                    <div className="absolute top-6 left-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(group.id)}
                                            onChange={() => toggleSelect(group.id)}
                                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex justify-between items-start mb-4 ml-8">
                                        <div>
                                            <p className="text-xl text-blue-600 font-bold mb-1">Valid from: {group.valid_from}</p>
                                            <h4 className="text-sm font-medium text-gray-500">{group.name}</h4>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => startEditing(group)}
                                                className="text-blue-600 hover:text-blue-800 font-medium px-3 py-1 rounded hover:bg-blue-100/50"
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
                                    <div className={`ml-8 bg-white p-3 rounded text-sm text-gray-600 font-mono max-h-24 overflow-y-auto border ${selectedIds.has(group.id) ? 'border-blue-200' : 'border-gray-100'}`}>
                                        {group.tickers.join(', ')}
                                    </div>
                                    <div className="mt-2 ml-8 text-xs text-gray-400">
                                        {group.tickers.length} tickers
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Pagination Controls */}
                    {groups.length > groupsPerPage && (
                        <div className="flex justify-center items-center space-x-2 mt-8">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 border rounded border-gray-300 disabled:opacity-20 hover:bg-gray-50 font-medium"
                            >
                                Previous
                            </button>

                            <div className="flex items-center space-x-1">
                                {Array.from({ length: Math.ceil(groups.length / groupsPerPage) }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`w-10 h-10 flex items-center justify-center border rounded font-medium transition-colors ${currentPage === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-50'}`}
                                    >
                                        {page}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(groups.length / groupsPerPage)))}
                                disabled={currentPage === Math.ceil(groups.length / groupsPerPage)}
                                className="px-4 py-2 border rounded border-gray-300 disabled:opacity-20 hover:bg-gray-50 font-medium"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
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
