import React from 'react';
import OptimizationHistograms from './OptimizationHistograms';

const OptimizationAnalysisPage = ({ results, onLoadResults, onBack }) => {

    const parseJSONFromText = (text) => {
        const jsonMarker = "# JSON DATA (for re-loading results)";
        const markerIndex = text.indexOf(jsonMarker);
        if (markerIndex !== -1) {
            // Find the start of JSON object after the marker
            const jsonStartIndex = text.indexOf('{', markerIndex);
            if (jsonStartIndex !== -1) {
                const jsonStr = text.substring(jsonStartIndex).trim();
                return JSON.parse(jsonStr);
            }
        }
        throw new Error("Invalid results file format. JSON marker not found.");
    };

    const handleFiles = async (fileList) => {
        if (!fileList || fileList.length === 0) return;

        const files = Array.from(fileList);
        const validResults = [];
        let errorCount = 0;

        for (const file of files) {
            // Skip non-txt files if any (though accept prop limits it, folder select might not)
            if (!file.name.endsWith('.txt')) continue;

            try {
                const text = await file.text();
                const parsed = parseJSONFromText(text);
                validResults.push(parsed);
            } catch (err) {
                console.error(`Failed to parse ${file.name}:`, err);
                errorCount++;
            }
        }

        if (validResults.length === 0) {
            alert(`Failed to load any valid results from ${files.length} files.`);
            return;
        }

        if (errorCount > 0) {
            alert(`Loaded ${validResults.length} files. Failed to load ${errorCount} files (check console for details).`);
        }

        // Merge Results
        try {
            const merged = mergeResults(validResults);
            onLoadResults(merged);
        } catch (err) {
            alert("Error merging results: " + err.message);
        }
    };

    const mergeResults = (resultsList) => {
        if (resultsList.length === 0) return null;

        // Pre-process to inject metadata (like test period) into children
        resultsList.forEach(res => {
            // Determine test period based on mode
            let testPeriod = 0;
            if (res.walk_forward_mode) testPeriod = res.test_period_months;
            else if (res.train_test_mode) testPeriod = res.test_months; // API uses test_months for train/test params 

            // Fallback or explicit check
            if (!testPeriod && res.test_period_months) testPeriod = res.test_period_months;

            if (res.walk_forward_mode && res.windows) {
                res.windows.forEach(w => w.test_period_months = testPeriod);
            } else if (res.train_test_mode) {
                if (res.test_results) res.test_results.forEach(r => r.test_period_months = testPeriod);
                if (res.train_results) res.train_results.forEach(r => r.test_period_months = testPeriod);
            } else {
                // Normal mode - implicit or n/a, but lets inject if we have it
                const list = Array.isArray(res.results) ? res.results : (res.results?.results || []);
                list.forEach(r => r.test_period_months = testPeriod);
            }
        });

        if (resultsList.length === 1) return resultsList[0];

        const base = resultsList[0];
        const isWF = base.walk_forward_mode;
        const isTrainTest = base.train_test_mode;

        // Ensure all are same type
        const allSameType = resultsList.every(r =>
            (!!r.walk_forward_mode === !!isWF) && (!!r.train_test_mode === !!isTrainTest)
        );

        if (!allSameType) {
            throw new Error("Cannot merge different types of optimization results (e.g. Walk-Forward and Normal).");
        }

        if (isWF) {
            // Merge Walk-Forward Results
            // We'll concat the 'windows' arrays.
            // Note: This might duplicate window numbers (e.g. Window 1 from Run A, Window 1 from Run B).
            // OptimizationHistograms validates structure but doesn't strictly require unique window numbers for aggregate stats.
            const mergedWindows = resultsList.flatMap(r => r.windows || []);

            return {
                ...base,
                windows: mergedWindows,
                // Sum up totals if needed, or just keep base config for display
                total_windows: mergedWindows.length
            };
        } else if (isTrainTest) {
            // Merge Train/Test
            const mergedTrain = resultsList.flatMap(r => r.train_results || []);
            const mergedTest = resultsList.flatMap(r => r.test_results || []);
            const mergedScores = resultsList.flatMap(r => r.scores || []);
            const mergedAllTrain = resultsList.flatMap(r => r.all_train_results || []);
            const mergedAllTest = resultsList.flatMap(r => r.all_test_results || []);

            return {
                ...base,
                train_results: mergedTrain,
                test_results: mergedTest,
                scores: mergedScores,
                all_train_results: mergedAllTrain,
                all_test_results: mergedAllTest,
                total_tests: resultsList.reduce((acc, r) => acc + (r.total_tests || 0), 0),
                completed_tests: resultsList.reduce((acc, r) => acc + (r.completed_tests || 0), 0)
            };
        } else {
            // Normal Mode
            // results.results is the list
            // Handle structure variation: some modes put list in 'results.results', others might be list directly (though parser usually returns object)
            const extractList = (r) => Array.isArray(r) ? r : (r.results || []);

            const mergedList = resultsList.flatMap(extractList);

            return {
                ...base,
                results: mergedList,
                total_tests: resultsList.reduce((acc, r) => acc + (r.total_tests || 0), 0),
                completed_tests: resultsList.reduce((acc, r) => acc + (r.completed_tests || 0), 0)
            };
        }
    };
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

                <div className="flex space-x-2">
                    <label className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center cursor-pointer">
                        <span className="mr-2">📂</span> Load Files
                        <input
                            type="file"
                            accept=".txt"
                            multiple
                            className="hidden"
                            onChange={(e) => handleFiles(e.target.files)}
                        />
                    </label>
                    <label className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition flex items-center cursor-pointer">
                        <span className="mr-2">📁</span> Load Folder
                        <input
                            type="file"
                            webkitdirectory=""
                            directory=""
                            className="hidden"
                            onChange={(e) => handleFiles(e.target.files)}
                        />
                    </label>
                </div>
            </div>

            {/* Error Message Display (if any) */}
            {/* Logic handled by alert for now, but could be state based */}

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
