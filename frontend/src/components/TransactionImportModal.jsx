import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

const TransactionImportModal = ({ onClose, onImport, availableTickers = [] }) => {
    const [step, setStep] = useState(1); // 1: Upload & Select, 2: Enrich
    const [parsedData, setParsedData] = useState([]);
    const [selectedIndices, setSelectedIndices] = useState(new Set());
    const [enrichmentData, setEnrichmentData] = useState({}); // { index: { ticker: '', currency: 'USD' } }
    const [error, setError] = useState(null);

    const parseCSV = (text) => {
        const lines = text.split('\n').filter(l => l.trim());
        const data = [];
        // Skip header if usually present, but let's try to detect or just assume row 0 is header if it contains 'data'
        let startIndex = 0;
        if (lines[0] && lines[0].toLowerCase().includes('data;papier')) {
            startIndex = 1;
        }

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Handle split by semicolon
            const cols = line.split(';');

            // Expected Format based on user providing:
            // 0: data (30.12.2025 15:51:27)
            // 1: papier (Name)
            // 2: isin
            // 3: ilosc (Quantity)
            // 4: type (K/S) - mapped to column index 4 based on user description "typ transakcji (K - kupno, S-sprzedaż)"
            // Actually looking at previous helper, user said: "data, papier, ilość, typ transakcji (K - kupno, S-sprzedaż), cena, wartość, prowizja"
            // Let's re-verify column indices from the earlier 'head' command output which was:
            // data;papier;isin;iloœæ;-;cena;wartoœæ;prowizja;po prowizji;waluta
            // 0: data
            // 1: papier
            // 2: isin
            // 3: ilosc
            // 4: - (maybe this is type? In the raw output "30.12...;17;K;855..." -> It seems col 4 is type K/S)
            // Wait, looking at "30.12.2025...;US17..;17;K;855..."
            // 0: Date
            // 1: Name
            // 2: ISIN
            // 3: Qty
            // 4: Type (K/S)
            // 5: Price
            // 6: Value
            // 7: Fee

            if (cols.length < 5) continue;

            try {
                // Parse Date: dd.mm.yyyy HH:MM:SS -> ISO
                const [d, t] = cols[0].split(' ');
                const [day, month, year] = d.split('.');
                const [h, m, s] = t.split(':');
                const isoDate = `${year}-${month}-${day}T${h}:${m}:${s}`; // Local ISO

                // Parse Type
                const rawType = cols[4].toUpperCase();
                let type = 'BUY';
                if (rawType === 'S') type = 'SELL';
                else if (rawType === 'K') type = 'BUY';
                else continue; // Skip unknown types

                // Parse Numbers (comma to dot)
                const parseNum = (str) => parseFloat(str.replace(',', '.').replace(/\s/g, ''));

                const quantity = parseNum(cols[3]);
                const price = parseNum(cols[5]);
                const fee = parseNum(cols[7]);

                data.push({
                    originalIndex: i,
                    date: isoDate,
                    name: cols[1],
                    quantity: quantity,
                    type: type,
                    price: price,
                    fee_pln: fee,
                    displayDate: cols[0]
                });
            } catch (e) {
                console.warn("Failed to parse line", i, line, e);
            }
        }
        return data;
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const parsed = parseCSV(evt.target.result);
                setParsedData(parsed);
                // Auto-select all by default? Or none? Let's select all.
                const allIndices = new Set(parsed.map((_, idx) => idx));
                setSelectedIndices(allIndices);
                setStep(1);
                setError(null);
            } catch (err) {
                setError("Failed to parse file.");
            }
        };
        reader.readAsText(file, 'UTF-8'); // Assuming UTF-8, might be Windows-1250 for PL
    };

    const toggleSelection = (idx) => {
        const newSet = new Set(selectedIndices);
        if (newSet.has(idx)) newSet.delete(idx);
        else newSet.add(idx);
        setSelectedIndices(newSet);
    };

    const handleEnrichmentChange = (idx, field, value) => {
        setEnrichmentData(prev => ({
            ...prev,
            [idx]: {
                ...prev[idx],
                [field]: value
            }
        }));
    };

    const handleNext = () => {
        if (selectedIndices.size === 0) {
            setError("Please select at least one transaction.");
            return;
        }
        setStep(2);

        // Pre-fill enrichment data where possible?
        // For now start empty, maybe default currency can be USD
        const initialEnrichment = {};
        parsedData.forEach((row, idx) => {
            if (selectedIndices.has(idx)) {
                initialEnrichment[idx] = { ticker: '', currency: 'USD' };
            }
        });
        setEnrichmentData(initialEnrichment);
    };

    const handleSave = () => {
        // Validate
        const transactionsToImport = [];
        for (let idx of selectedIndices) {
            const enrich = enrichmentData[idx];
            if (!enrich || !enrich.ticker || !enrich.currency) {
                alert("Please fill in Ticker and Currency for all selected transactions.");
                return;
            }

            const original = parsedData[idx];

            transactionsToImport.push({
                id: uuidv4(),
                date: original.date,
                type: original.type,
                ticker: enrich.ticker.toUpperCase(),
                currency: enrich.currency,
                quantity: original.quantity,
                price: original.price,
                amount_pln: null, // It's a stock transaction
                fee_pln: original.fee_pln
            });
        }

        onImport(transactionsToImport);
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Import Transactions (Step {step}/2)</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">X</button>
                </div>

                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

                <div className="flex-grow overflow-auto">
                    {step === 1 && (
                        <div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Upload CSV (transactionsHistory.csv)</label>
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileUpload}
                                    className="block w-full text-sm text-gray-500
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-full file:border-0
                                    file:text-sm file:font-semibold
                                    file:bg-blue-50 file:text-blue-700
                                    hover:file:bg-blue-100"
                                />
                            </div>

                            {parsedData.length > 0 && (
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                <input
                                                    type="checkbox"
                                                    checked={parsedData.length > 0 && selectedIndices.size === parsedData.length}
                                                    onChange={() => {
                                                        if (selectedIndices.size === parsedData.length) setSelectedIndices(new Set());
                                                        else setSelectedIndices(new Set(parsedData.map((_, i) => i)));
                                                    }}
                                                />
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paper (Name)</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price (PLN)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {parsedData.map((row, idx) => (
                                            <tr key={idx} className={selectedIndices.has(idx) ? "bg-blue-50" : ""}>
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIndices.has(idx)}
                                                        onChange={() => toggleSelection(idx)}
                                                    />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.displayDate}</td>
                                                <td className="px-6 py-4 text-sm text-gray-900">{row.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                                                    <span className={row.type === 'BUY' ? 'text-green-600' : 'text-red-600'}>{row.type}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.quantity}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.price}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paper (Name)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticker (Required)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency (Required)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {parsedData.map((row, idx) => {
                                    if (!selectedIndices.has(idx)) return null;
                                    const enrich = enrichmentData[idx] || {};
                                    return (
                                        <tr key={idx}>
                                            <td className="px-6 py-4 text-sm text-gray-900 w-1/3">{row.name}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                <div>{row.displayDate}</div>
                                                <div className={`font-bold ${row.type === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {row.type} {row.quantity} x {row.price}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="text"
                                                    className="border rounded p-2 w-full uppercase"
                                                    list="import-ticker-suggestions"
                                                    value={enrich.ticker || ''}
                                                    onChange={(e) => handleEnrichmentChange(idx, 'ticker', e.target.value)}
                                                    placeholder="Ticker..."
                                                />
                                                <datalist id="import-ticker-suggestions">
                                                    {availableTickers.map(t => <option key={t} value={t} />)}
                                                </datalist>
                                            </td>
                                            <td className="px-6 py-4">
                                                <select
                                                    className="border rounded p-2 w-full"
                                                    value={enrich.currency || 'USD'}
                                                    onChange={(e) => handleEnrichmentChange(idx, 'currency', e.target.value)}
                                                >
                                                    <option value="USD">USD</option>
                                                    <option value="PLN">PLN</option>
                                                    <option value="EUR">EUR</option>
                                                    <option value="GBP">GBP</option>
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="mt-4 flex justify-end space-x-3 border-t pt-4">
                    <button onClick={onClose} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">
                        Cancel
                    </button>
                    {step === 1 && parsedData.length > 0 && (
                        <button
                            onClick={handleNext}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                        >
                            Next: Enrich Data
                        </button>
                    )}
                    {step === 2 && (
                        <>
                            <button
                                onClick={() => setStep(1)}
                                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleSave}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                            >
                                Import Transactions
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TransactionImportModal;
