import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, StatusBar } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { supabase } from '../services/supabase';
import { getMarketPrices, getCurrencyRates } from '../services/marketData';
import { calculatePortfolioState } from '../utils/portfolio'; // Assuming we have this, or simple logic here
import PortfolioChart from '../components/PortfolioChart';

const HomeScreen = () => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [portfolioValue, setPortfolioValue] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [history, setHistory] = useState([]); // Simplified history for chart

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
            // For chart history, we'd need historical prices.
            // For this prototype, we'll just show Current Value and maybe
            // a "fake" history based on transaction dates + current price (flat line projection)
            // or fetch historical data if possible.
            // 
            // REAL IMPLEMENTATION for Chart:
            // Mobile Replayer is complex. For now, let's just show Current Value
            // and a simulated chart of "Value if held" or just transaction accumulation.

            // 4. Calculate Current Value & History
            let cash = 0;
            let holdings = {};

            // We need to calculate state for BOTH current value AND history.
            // But History requires "time travel".

            // A. Calculate CURRENT STATE first (for Total Value display)
            // Replay all transactions
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
            Object.keys(holdings).forEach(ticker => {
                const shares = holdings[ticker];
                if (shares > 0) {
                    const priceInfo = prices[ticker];
                    if (priceInfo) {
                        const currency = priceInfo.currency || 'USD';
                        // Fix: currencyRates now returns object { current, history }
                        const rateObj = currencyRates[currency];
                        const rate = rateObj?.current || (currency === 'PLN' ? 1.0 : 0);

                        const val = shares * priceInfo.price * rate;
                        stocksValue += val;
                    }
                }
            });

            const totalValue = cash + stocksValue;
            setPortfolioValue(totalValue);

            // B. Calculate 5-Day History
            // Get dates from first ticker's history, or generate last 5 days
            let chartDates = [];
            const firstTicker = Object.keys(prices)[0];
            if (firstTicker && prices[firstTicker]?.history?.length > 0) {
                chartDates = prices[firstTicker].history.map(h => h.date);
            } else {
                // Fallback if no stocks or no history found
                for (let i = 4; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    // Skip weekends in fallback? Simple check:
                    if (d.getDay() !== 0 && d.getDay() !== 6) {
                        chartDates.push(d.toISOString().split('T')[0]);
                    }
                }
            }

            // Replay for History Points
            let historyPoints = [];
            let h_cash = 0;
            let h_holdings = {};
            let txIndex = 0;

            chartDates.forEach(date => {
                // Advance state to this date
                // Txs are sorted by date
                // Fix: Compare YYYY-MM-DD parts to include transactions from the same day
                while (txIndex < txData.length && txData[txIndex].date && txData[txIndex].date.substring(0, 10) <= date) {
                    const tx = txData[txIndex];
                    const t_type = tx.type;
                    const t_qty = parseFloat(tx.quantity) || 0;
                    const t_price = parseFloat(tx.price) || 0;
                    const t_fee = parseFloat(tx.fee_pln) || 0;
                    const t_amount = parseFloat(tx.amount_pln) || 0;

                    if (t_type === 'DEPOSIT') h_cash += Math.abs(t_amount);
                    else if (t_type === 'WITHDRAWAL') h_cash -= Math.abs(t_amount);
                    else if (t_type === 'BUY') {
                        let cost = (t_qty * t_price) + t_fee;
                        if (cost === 0 && t_amount !== 0) cost = Math.abs(t_amount);
                        h_cash -= cost;
                        h_holdings[tx.ticker] = (h_holdings[tx.ticker] || 0) + t_qty;
                    }
                    else if (t_type === 'SELL') {
                        let revenue = (t_qty * t_price) - t_fee;
                        if (revenue === 0 && t_amount !== 0) revenue = Math.abs(t_amount);
                        h_cash += revenue;
                        h_holdings[tx.ticker] = (h_holdings[tx.ticker] || 0) - t_qty;
                    }
                    txIndex++;
                }

                // Calculate Value at this date
                let dailyVal = h_cash;
                Object.keys(h_holdings).forEach(ticker => {
                    const shares = h_holdings[ticker];
                    if (shares > 0) {
                        const histPriceObj = prices[ticker]?.history?.find(h => h.date === date);
                        // Fallback to current price if history missing for day?
                        const price = histPriceObj ? histPriceObj.price : (prices[ticker]?.price || 0);

                        const currency = prices[ticker]?.currency || 'PLN';
                        const rateObj = currencyRates[currency];
                        // Get historical rate or current
                        let rate = 1.0;
                        if (currency !== 'PLN') {
                            rate = rateObj?.history?.[date] || rateObj?.current || 1.0;
                        }

                        dailyVal += (shares * price * rate);
                    }
                });

                historyPoints.push({
                    date: date,
                    total_value: dailyVal
                });
            });

            // Ensure the last point reflects the LIVE totalValue
            const todayStr = new Date().toISOString().split('T')[0];
            if (historyPoints.length > 0) {
                const lastPoint = historyPoints[historyPoints.length - 1];
                if (lastPoint.date === todayStr) {
                    // Overwrite with live value (more accurate than "close")
                    lastPoint.total_value = totalValue;
                } else {
                    // Append today if missing (e.g. market open but no close candle yet)
                    historyPoints.push({
                        date: todayStr,
                        total_value: totalValue
                    });
                }
            } else {
                // Fallback if chartDates was empty
                historyPoints.push({
                    date: todayStr,
                    total_value: totalValue
                });
            }

            // Ensure we have at least "Today" if list is empty?
            // If chartDates was empty, we might have issue. 
            // But we handled fallbacks.

            setHistory(historyPoints);

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
                            <Text style={styles.summaryLabel}>Total Value</Text>
                            <Text style={styles.summaryValue}>
                                {portfolioValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                            </Text>
                        </View>

                        {/* Chart Section */}
                        <PortfolioChart data={history} />

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
    }
});

export default HomeScreen;
