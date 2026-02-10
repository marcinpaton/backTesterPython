import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, StatusBar, TouchableOpacity } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { supabase } from '../services/supabase';
import { getMarketPrices, getCurrencyRates, clearCache } from '../services/marketData';
import { calculatePortfolioState } from '../utils/portfolio'; // Assuming we have this, or simple logic here
import PortfolioChart from '../components/PortfolioChart';

const HomeScreen = () => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [portfolioValue, setPortfolioValue] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [history, setHistory] = useState([]); // Simplified history for chart
    const [selectedPoint, setSelectedPoint] = useState(null); // For interactive chart
    const [returns, setReturns] = useState({ today: 0, mtd: 0, ytd: 0 });

    const fetchData = async () => {
        try {
            // 1. Fetch Transactions
            const { data: txData, error } = await supabase
                .from('transactions')
                .select('*')
                .order('date', { ascending: true }); // Ascending for replay

            if (error) throw error;
            console.log('Sample transaction:', txData[0]); // DEBUG
            setTransactions(txData);

            // 2. Identify Unique Tickers
            console.log('Transactions fetched:', txData.length);
            const uniqueTickers = [...new Set(txData.filter(t => t.ticker).map(t => t.ticker))];

            // 3. Fetch Market Prices (Yahoo)
            const prices = await getMarketPrices(uniqueTickers);
            const currencyRates = await getCurrencyRates(); // e.g. USDPLN

            // 4. Calculate Current Value (Simplified Replayer)
            let cash = 0;
            let holdings = {};

            txData.forEach(tx => {
                const t_type = tx.type;
                const t_qty = parseFloat(tx.quantity) || 0;
                const t_price = parseFloat(tx.price) || 0;
                const t_fee = parseFloat(tx.fee_pln) || 0;
                const t_amount = parseFloat(tx.amount_pln) || 0;

                if (t_type === 'DEPOSIT') cash += Math.abs(t_amount);
                else if (t_type === 'WITHDRAWAL') cash -= Math.abs(t_amount);
                else if (t_type === 'BUY') {
                    let cost = (t_qty * t_price) + t_fee;
                    if (cost === 0 && t_amount !== 0) cost = Math.abs(t_amount);
                    cash -= cost;
                    holdings[tx.ticker] = (holdings[tx.ticker] || 0) + t_qty;
                }
                else if (t_type === 'SELL') {
                    let revenue = (t_qty * t_price) - t_fee;
                    if (revenue === 0 && t_amount !== 0) revenue = Math.abs(t_amount);
                    cash += revenue;
                    holdings[tx.ticker] = (holdings[tx.ticker] || 0) - t_qty;
                }
            });

            // Calculate CURRENT total value with LIVE prices
            let stocksValue = 0;
            let liveAssets = [];

            Object.keys(holdings).forEach(ticker => {
                const shares = holdings[ticker];
                if (shares > 0) {
                    const priceInfo = prices[ticker];
                    if (priceInfo) {
                        const currency = priceInfo.currency || 'USD';
                        const rateObj = currencyRates[currency];
                        const rate = rateObj?.current || (currency === 'PLN' ? 1.0 : 0);

                        const val = shares * priceInfo.price * rate;
                        stocksValue += val;

                        // Calculate daily change from history
                        const tickerHistory = priceInfo.history || [];
                        let changePct = priceInfo.change_pct; // Fallback
                        if (tickerHistory.length > 1) {
                            // If market is open, history might contain today's partial candle at the end.
                            // If range=1y, history contains many points.
                            // We compare the current price (regularMarketPrice) with the PREVIOUS trading day's close.
                            // If today's date is at the end of history, previous close is history[len-2]
                            const todayStrStrict = new Date().toISOString().split('T')[0];
                            const lastHistPoint = tickerHistory[tickerHistory.length - 1];

                            let prevClose;
                            if (lastHistPoint.date === todayStrStrict) {
                                // Last point is today, previous close is one before
                                prevClose = tickerHistory[tickerHistory.length - 2]?.price;
                            } else {
                                // Last point is yesterday, it IS the previous close
                                prevClose = lastHistPoint.price;
                            }

                            if (prevClose) {
                                changePct = (priceInfo.price - prevClose) / prevClose;
                            }
                        }

                        liveAssets.push({
                            ticker,
                            shares,
                            price: priceInfo.price,
                            currency,
                            rate,
                            valuePLN: val,
                            change_pct: changePct
                        });
                    }
                }
            });

            if (Math.abs(cash) > 0.01) {
                liveAssets.push({
                    ticker: 'CASH',
                    shares: cash,
                    price: 1.0,
                    currency: 'PLN',
                    rate: 1.0,
                    valuePLN: cash
                });
            }
            liveAssets.sort((a, b) => b.valuePLN - a.valuePLN);

            const totalValue = cash + stocksValue;
            setPortfolioValue(totalValue);

            // 5. Calculate Returns (Today, MTD, YTD)
            const todayObj = new Date();
            const todayStr = todayObj.toISOString().split('T')[0];
            const startOfMonth = new Date(todayObj.getFullYear(), todayObj.getMonth(), 1).toISOString().split('T')[0];
            const startOfYear = new Date(todayObj.getFullYear(), 0, 1).toISOString().split('T')[0];

            // Helper to get value at specific date
            const calculateValueAtDate = (targetDate) => {
                let h_cash = 0;
                let h_holdings = {};
                let h_txIndex = 0;

                // 1. Replay Transactions up to targetDate
                while (h_txIndex < txData.length && txData[h_txIndex].date && txData[h_txIndex].date.substring(0, 10) < targetDate) {
                    const tx = txData[h_txIndex];
                    const t_qty = parseFloat(tx.quantity) || 0;
                    const t_price = parseFloat(tx.price) || 0;
                    const t_fee = parseFloat(tx.fee_pln) || 0;
                    const t_amount = parseFloat(tx.amount_pln) || 0;

                    if (tx.type === 'DEPOSIT') h_cash += Math.abs(t_amount);
                    else if (tx.type === 'WITHDRAWAL') h_cash -= Math.abs(t_amount);
                    else if (tx.type === 'BUY') {
                        let cost = (t_qty * t_price) + t_fee;
                        if (cost === 0 && t_amount !== 0) cost = Math.abs(t_amount);
                        h_cash -= cost;
                        h_holdings[tx.ticker] = (h_holdings[tx.ticker] || 0) + t_qty;
                    }
                    else if (tx.type === 'SELL') {
                        let revenue = (t_qty * t_price) - t_fee;
                        if (revenue === 0 && t_amount !== 0) revenue = Math.abs(t_amount);
                        h_cash += revenue;
                        h_holdings[tx.ticker] = (h_holdings[tx.ticker] || 0) - t_qty;
                    }
                    h_txIndex++;
                }

                // 2. Value assets at targetDate
                let h_stocksValue = 0;
                Object.keys(h_holdings).forEach(ticker => {
                    const shares = h_holdings[ticker];
                    if (shares > 0) {
                        const tickerHistory = prices[ticker]?.history || [];
                        // Find the closest price BEFORE or ON targetDate
                        const pricePoint = tickerHistory.reduce((prev, curr) => {
                            if (curr.date <= targetDate) return curr;
                            return prev;
                        }, tickerHistory[0]);

                        const price = pricePoint ? pricePoint.price : (prices[ticker]?.price || 0);
                        const currency = prices[ticker]?.currency || 'USD';
                        const rateObj = currencyRates[currency];

                        // Get historical rate
                        let rate = 1.0;
                        if (currency !== 'PLN' && rateObj?.history) {
                            // Find closest rate
                            const rateDate = Object.keys(rateObj.history).reduce((prev, curr) => {
                                if (curr <= targetDate) return curr;
                                return prev;
                            }, Object.keys(rateObj.history)[0]);
                            rate = rateObj.history[rateDate] || rateObj.current || 1.0;
                        }

                        h_stocksValue += (shares * price * rate);
                    }
                });

                return h_cash + h_stocksValue;
            };

            // Get benchmark dates - we need the CLOSE price of the PREVIOUS day for these calculations
            // To be robust, we find the latest date in history strictly < targetDate
            const getLatestAvailableDateBefore = (targetDate) => {
                const firstTicker = Object.keys(prices)[0];
                if (!firstTicker || !prices[firstTicker].history) return targetDate;
                const dates = prices[firstTicker].history.map(h => h.date).filter(d => d < targetDate);
                return dates.length > 0 ? dates[dates.length - 1] : targetDate;
            };

            const prevDayDate = getLatestAvailableDateBefore(todayStr);
            const prevMonthDate = getLatestAvailableDateBefore(startOfMonth);
            const prevYearDate = getLatestAvailableDateBefore(startOfYear);

            const v_prev = calculateValueAtDate(prevDayDate);
            const v_mtd = calculateValueAtDate(prevMonthDate);
            const v_ytd = calculateValueAtDate(prevYearDate);

            setReturns({
                today: v_prev > 0 ? (totalValue - v_prev) / v_prev : 0,
                mtd: v_mtd > 0 ? (totalValue - v_mtd) / v_mtd : 0,
                ytd: v_ytd > 0 ? (totalValue - v_ytd) / v_ytd : 0
            });

            // B. Calculate Chart History (Last 5 available days)
            let chartDates = [];
            const firstTicker = Object.keys(prices)[0];
            if (firstTicker && prices[firstTicker]?.history?.length > 0) {
                // Take last 5 points
                chartDates = prices[firstTicker].history.slice(-5).map(h => h.date);
            } else {
                for (let i = 4; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    if (d.getDay() !== 0 && d.getDay() !== 6) {
                        chartDates.push(d.toISOString().split('T')[0]);
                    }
                }
            }

            // Replay for Chart Points
            let historyPoints = [];
            let h_cash = 0;
            let h_holdings = {};
            let txIndex = 0;

            chartDates.forEach(date => {
                while (txIndex < txData.length && txData[txIndex].date && txData[txIndex].date.substring(0, 10) <= date) {
                    const tx = txData[txIndex];
                    const t_qty = parseFloat(tx.quantity) || 0;
                    const t_price = parseFloat(tx.price) || 0;
                    const t_fee = parseFloat(tx.fee_pln) || 0;
                    const t_amount = parseFloat(tx.amount_pln) || 0;

                    if (tx.type === 'DEPOSIT') h_cash += Math.abs(t_amount);
                    else if (tx.type === 'WITHDRAWAL') h_cash -= Math.abs(t_amount);
                    else if (tx.type === 'BUY') {
                        let cost = (t_qty * t_price) + t_fee;
                        if (cost === 0 && t_amount !== 0) cost = Math.abs(t_amount);
                        h_cash -= cost;
                        h_holdings[tx.ticker] = (h_holdings[tx.ticker] || 0) + t_qty;
                    }
                    else if (tx.type === 'SELL') {
                        let revenue = (t_qty * t_price) - t_fee;
                        if (revenue === 0 && t_amount !== 0) revenue = Math.abs(t_amount);
                        h_cash += revenue;
                        h_holdings[tx.ticker] = (h_holdings[tx.ticker] || 0) - t_qty;
                    }
                    txIndex++;
                }

                let dailyVal = h_cash;
                let dailyAssets = [];

                Object.keys(h_holdings).forEach(ticker => {
                    const shares = h_holdings[ticker];
                    if (shares > 0) {
                        const histPriceObj = prices[ticker]?.history?.find(h => h.date === date);
                        const price = histPriceObj ? histPriceObj.price : (prices[ticker]?.price || 0);

                        const currency = prices[ticker]?.currency || 'PLN';
                        const rateObj = currencyRates[currency];
                        let rate = 1.0;
                        if (currency !== 'PLN') {
                            rate = rateObj?.history?.[date] || rateObj?.current || 1.0;
                        }

                        const val = shares * price * rate;
                        dailyVal += val;

                        // Calculate daily change for historical date
                        const tickerHistory = prices[ticker]?.history || [];
                        const histPriceIdx = tickerHistory.findIndex(h => h.date === date);
                        let histChange = 0;
                        if (histPriceIdx > 0) {
                            const prevPrice = tickerHistory[histPriceIdx - 1].price;
                            histChange = (price - prevPrice) / prevPrice;
                        }

                        dailyAssets.push({
                            ticker,
                            shares,
                            price,
                            currency,
                            rate,
                            valuePLN: val,
                            change_pct: histChange
                        });
                    }
                });

                if (Math.abs(h_cash) > 0.01) {
                    dailyAssets.push({
                        ticker: 'CASH',
                        price: 1.0,
                        currency: 'PLN',
                        rate: 1.0,
                        valuePLN: h_cash,
                        shares: h_cash
                    });
                }
                dailyAssets.sort((a, b) => b.valuePLN - a.valuePLN);

                historyPoints.push({
                    date: date,
                    total_value: dailyVal,
                    assets: dailyAssets
                });
            });

            // Ensure the last point reflects the LIVE totalValue
            if (historyPoints.length > 0) {
                const lastPoint = historyPoints[historyPoints.length - 1];
                if (lastPoint.date === todayStr) {
                    lastPoint.total_value = totalValue;
                    lastPoint.assets = liveAssets;
                } else {
                    historyPoints.push({
                        date: todayStr,
                        total_value: totalValue,
                        assets: liveAssets
                    });
                }
            }

            setHistory(historyPoints);
            if (historyPoints.length > 0) {
                setSelectedPoint(historyPoints[historyPoints.length - 1]);
            }

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleClearCache = async () => {
        setLoading(true);
        await clearCache();
        await fetchData();
    };

    const handleChartPointClick = (index) => {
        if (history[index]) {
            setSelectedPoint(history[index]);
        }
    };

    const ReturnLabel = ({ label, value }) => {
        const isPositive = value >= 0;
        return (
            <View style={styles.returnItem}>
                <Text style={styles.returnLabelText}>{label}</Text>
                <Text style={[styles.returnValueText, { color: isPositive ? '#16a34a' : '#dc2626' }]}>
                    {isPositive ? '+' : ''}{(value * 100).toFixed(2)}%
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <ExpoStatusBar style="auto" />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>My Portfolio</Text>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 50 }} />
                ) : (
                    <>
                        <View style={styles.summaryCard}>
                            <View>
                                <Text style={styles.summaryLabel}>Total Value</Text>
                                <Text style={styles.summaryValue}>
                                    {portfolioValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                                </Text>
                            </View>

                            <View style={styles.returnsContainer}>
                                <ReturnLabel label="Today" value={returns.today} />
                                <ReturnLabel label="MTD" value={returns.mtd} />
                                <ReturnLabel label="YTD" value={returns.ytd} />
                            </View>
                        </View>

                        {/* Chart Section */}
                        <PortfolioChart
                            data={history}
                            onPointClick={handleChartPointClick}
                        />

                        {/* Selected Point Details */}
                        {selectedPoint && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>
                                    Details: {new Date(selectedPoint.date).toLocaleDateString()}
                                </Text>
                                <View style={styles.statRow}>
                                    <Text style={styles.statLabel}>Valuation:</Text>
                                    <Text style={styles.statValueSmall}>
                                        {selectedPoint.total_value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                                    </Text>
                                </View>
                                <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: 8 }} />
                                {selectedPoint.assets && selectedPoint.assets.map((asset, idx) => (
                                    <View key={idx} style={styles.assetRow}>
                                        <View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text style={styles.assetTicker}>{asset.ticker}</Text>
                                                {asset.change_pct != null && asset.ticker !== 'CASH' && (
                                                    <Text style={[styles.assetChange, { color: asset.change_pct >= 0 ? '#16a34a' : '#dc2626' }]}>
                                                        {asset.change_pct >= 0 ? '+' : ''}{(asset.change_pct * 100).toFixed(2)}%
                                                    </Text>
                                                )}
                                            </View>
                                            {asset.ticker !== 'CASH' && (
                                                <Text style={styles.assetSub}>
                                                    {asset.shares.toFixed(0)} x {asset.price.toFixed(2)} {asset.currency}
                                                </Text>
                                            )}
                                        </View>
                                        <Text style={styles.assetValue}>
                                            {asset.valuePLN.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Holdings List (Optional) */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Recent Transactions</Text>
                            {transactions.slice(-5).reverse().map((tx, index) => {
                                let amount = parseFloat(tx.amount_pln) || 0;

                                // Logic for display: User requested NO FEES, just Qty * Price
                                if (tx.type === 'BUY' || tx.type === 'SELL') {
                                    const qty = parseFloat(tx.quantity) || 0;
                                    const price = parseFloat(tx.price) || 0;
                                    // Fee is ignored for display as per user request
                                    amount = (qty * price);
                                }

                                const displayAmount = Math.abs(amount).toFixed(2);
                                return (
                                    <View key={index} style={styles.txRow}>
                                        <View>
                                            <Text style={styles.txType}>{tx.type} {tx.ticker ? `(${tx.ticker})` : ''}</Text>
                                            <Text style={styles.txDate}>{new Date(tx.date).toLocaleDateString()}</Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={[styles.txAmount, { color: tx.type === 'DEPOSIT' || tx.type === 'SELL' ? '#16a34a' : '#1f2937' }]}>
                                                {displayAmount} PLN
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>

                        <View style={{ marginBottom: 40, marginTop: 10 }}>
                            <TouchableOpacity
                                style={styles.clearCacheButton}
                                onPress={handleClearCache}
                            >
                                <Text style={styles.clearCacheButtonText}>Clear cache</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
        paddingTop: StatusBar.currentHeight || 40,
    },
    scrollContent: {
        padding: 20
    },
    header: {
        marginBottom: 20
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1f2937'
    },
    summaryCard: {
        backgroundColor: '#2563eb', // Blue-600
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5
    },
    summaryLabel: {
        color: '#bfdbfe', // Blue-200
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4
    },
    summaryValue: {
        color: '#ffffff',
        fontSize: 32,
        fontWeight: 'bold'
    },
    section: {
        marginTop: 20,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#374151'
    },
    txRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6'
    },
    txType: {
        fontWeight: '600',
        color: '#4b5563'
    },
    txDate: {
        fontSize: 12,
        color: '#9ca3af'
    },
    txAmount: {
        fontWeight: 'bold',
        color: '#1f2937'
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    statLabel: {
        fontSize: 14,
        color: '#6b7280',
    },
    statValueSmall: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937'
    },
    assetRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    assetTicker: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151'
    },
    assetChange: {
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 6
    },
    assetSub: {
        fontSize: 12,
        color: '#9ca3af'
    },
    assetValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1f2937'
    },
    returnsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.2)'
    },
    returnItem: {
        alignItems: 'center',
        flex: 1,
        backgroundColor: '#ffffff',
        marginHorizontal: 4,
        paddingVertical: 8,
        borderRadius: 10,
    },
    returnLabelText: {
        color: '#000000',
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 2,
        textTransform: 'uppercase'
    },
    returnValueText: {
        fontSize: 18,
        fontWeight: '900'
    },
    clearCacheButton: {
        backgroundColor: '#fee2e2', // Red-100
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#fecaca', // Red-200
    },
    clearCacheButtonText: {
        color: '#b91c1c', // Red-700
        fontWeight: 'bold',
        fontSize: 14
    }
});

export default HomeScreen;
