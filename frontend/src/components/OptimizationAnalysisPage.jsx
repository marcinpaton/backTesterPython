import React from 'react';
import OptimizationHistograms from './OptimizationHistograms';

const OptimizationAnalysisPage = ({ results, onLoadResults, onBack }) => {
    return (
        <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center">
                    <button
                        onClick={onBack}
                        className="mr-4 px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition"
                    >
                        ← Back
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900">Optimization Analysis</h1>
                </div>

                <label className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center cursor-pointer">
                    <span className="mr-2">📂</span> Load New Results
                    <input
                        type="file"
                        accept=".txt"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && window.handleLoadResults) {
                                window.handleLoadResults(file);
                            } else if (file) {
                                // Fallback if window handler not available (e.g. direct prop usage)
                                const reader = new FileReader();
                                reader.onload = async (e) => {
                                    const text = e.target.result;
                                    // Basic JSON extraction logic if window.handleLoadResults isn't available
                                    const jsonMarker = "# JSON DATA (for re-loading results)";
                                    const markerIndex = text.indexOf(jsonMarker);
                                    if (markerIndex !== -1) {
                                        // Find the start of JSON object after the marker
                                        const jsonStartIndex = text.indexOf('{', markerIndex);
                                        if (jsonStartIndex !== -1) {
                                            const jsonStr = text.substring(jsonStartIndex).trim();
                                            try {
                                                const parsed = JSON.parse(jsonStr);
                                                onLoadResults(parsed);
                                            } catch (err) {
                                                alert("Failed to parse results file: " + err.message);
                                                console.error("JSON Parsing Error:", err);
                                            }
                                        } else {
                                            alert("Invalid results file format. JSON object not found after marker.");
                                        }
                                    } else {
                                        alert("Invalid results file format. JSON marker not found.");
                                    }
                                };
                                reader.readAsText(file);
                            }
                        }}
                    />
                </label>
            </div>

            {results ? (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="mb-4">
                        <p className="text-sm text-gray-600">
                            <strong>Loaded Data:</strong> {results.walk_forward_mode ? 'Walk-Forward Optimization' : results.train_test_mode ? 'Train/Test Split' : 'Standard Optimization'}
                        </p>
                    </div>
                    <OptimizationHistograms results={results} />
                </div>
            ) : (
                <div className="text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-xl text-gray-500 mb-4">No optimization results loaded.</p>
                    <p className="text-gray-400">Please load a results file to view analysis.</p>
                </div>
            )}
        </div>
    );
};

export default OptimizationAnalysisPage;
