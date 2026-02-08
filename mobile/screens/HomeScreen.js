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

            let cash = 0;
            let holdings = {};
            let historyPoints = [];

            txData.forEach(tx => {
                const t_type = tx.type;
                const t_qty = parseFloat(tx.quantity) || 0;
                const t_price = parseFloat(tx.price) || 0;
                const t_fee = parseFloat(tx.fee_pln) || 0;
                const t_amount = parseFloat(tx.amount_pln) || 0;

                if (t_type === 'DEPOSIT') {
                    cash += Math.abs(t_amount);
                }
                else if (t_type === 'WITHDRAWAL') {
                    cash -= Math.abs(t_amount);
                }
                else if (t_type === 'BUY') {
                    // Replicate backend logic: cost = (qty * price) + fee
                    // Fallback to t_amount if price/qty missing (but prefer calculated)
                    let cost = (t_qty * t_price) + t_fee;
                    if (cost === 0 && t_amount !== 0) cost = Math.abs(t_amount);

                    cash -= cost;
                    holdings[tx.ticker] = (holdings[tx.ticker] || 0) + t_qty;
                    console.log(`BUY ${tx.ticker}: Cost ${cost.toFixed(2)} (Qty: ${t_qty}, Price: ${t_price}, Fee: ${t_fee}) -> New Cash: ${cash.toFixed(2)}`);
                }
                else if (t_type === 'SELL') {
                    // Replicate backend logic: revenue = (qty * price) - fee
                    let revenue = (t_qty * t_price) - t_fee;
                    if (revenue === 0 && t_amount !== 0) revenue = Math.abs(t_amount);

                    cash += revenue;
                    holdings[tx.ticker] = (holdings[tx.ticker] || 0) - t_qty;
                    console.log(`SELL ${tx.ticker}: Revenue ${revenue.toFixed(2)} -> New Cash: ${cash.toFixed(2)}`);
                }

                // Snapshot state at each transaction (Simplified history)
                historyPoints.push({
                    date: tx.date,
                    total_value: cash // This is CASH only + Book Value of stocks?
                    // Without historical prices, we can't calculate accurate history.
                    // We will display "Net Invested Capital" history for now.
                });
            });

            // Calculate CURRENT total value with LIVE prices
            let stocksValue = 0;
            Object.keys(holdings).forEach(ticker => {
                const shares = holdings[ticker];
                if (shares > 0) {
                    const priceInfo = prices[ticker];
                    if (priceInfo) {
                        const currency = priceInfo.currency || 'USD';
                        const rate = currencyRates[currency] || 1.0;
                        const val = shares * priceInfo.price * rate;
                        console.log(`Valuation: ${ticker} | Shares: ${shares} | Price: ${priceInfo.price} ${currency} | Rate: ${rate} | Value: ${val.toFixed(2)} PLN`);
                        stocksValue += val;
                    }
                }
            });

            const totalValue = cash + stocksValue;
            console.log(`--- CALCULATION SUMMARY ---`);
            console.log(`Final Cash: ${cash.toFixed(2)} PLN`);
            console.log(`Stocks Value: ${stocksValue.toFixed(2)} PLN`);
            console.log(`Total Value: ${totalValue.toFixed(2)} PLN`);
            console.log(`---------------------------`);
            setPortfolioValue(totalValue);

            // Add "Today" to history
            historyPoints.push({
                date: new Date().toISOString(),
                total_value: totalValue
            });

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
                            {transactions.slice(-5).reverse().map((tx, index) => (
                                <View key={index} style={styles.txRow}>
                                    <View>
                                        <Text style={styles.txType}>{tx.type}</Text>
                                        <Text style={styles.txDate}>{tx.date}</Text>
                                    </View>
                                    <Text style={styles.txAmount}>
                                        {parseFloat(tx.amount_pln).toFixed(2)} PLN
                                    </Text>
                                </View>
                            ))}
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
