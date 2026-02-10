import AsyncStorage from '@react-native-async-storage/async-storage';

// No external dependencies for fetch in React Native
// Using direct fetch to query1.finance.yahoo.com

const CACHE_KEYS = {
    PRICES: 'market_prices_cache',
    CURRENCIES: 'currency_rates_cache'
};

const HISTORY_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours for history

// Helper to parsing Yahoo chart timestamps
const parseYahooHistory = (result) => {
    const history = [];
    if (result.timestamp && result.indicators && result.indicators.quote) {
        const quotes = result.indicators.quote[0];
        result.timestamp.forEach((ts, i) => {
            if (quotes.close && quotes.close[i] != null) {
                history.push({
                    date: new Date(ts * 1000).toISOString().split('T')[0], // YYYY-MM-DD
                    price: quotes.close[i]
                });
            }
        });
    }
    return history;
};

export const getMarketPrices = async (tickers) => {
    if (!tickers || tickers.length === 0) return {};

    const now = Date.now();
    let cachedDataObj = null;

    // 1. Load from cache (to get history)
    try {
        const cachedStr = await AsyncStorage.getItem(CACHE_KEYS.PRICES);
        if (cachedStr) {
            cachedDataObj = JSON.parse(cachedStr);
        }
    } catch (e) {
        console.error('Error reading prices cache:', e);
    }

    // 2. Fetch fresh data (Always fetch at least current price)
    const prices = {};
    const timestamp = cachedDataObj?.timestamp || 0;
    const isHistoryFresh = (now - timestamp < HISTORY_CACHE_DURATION);

    console.log(`Fetching market prices (Mode: ${isHistoryFresh ? 'Price only' : 'Full history'})...`);

    const promises = tickers.map(async (ticker) => {
        try {
            const cachedTicker = cachedDataObj?.data?.[ticker];
            const range = (isHistoryFresh && cachedTicker?.history) ? '1d' : '1y';

            const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=${range}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const data = await response.json();

            if (data.chart && data.chart.result && data.chart.result.length > 0) {
                const result = data.chart.result[0];
                let price = result.meta.regularMarketPrice;
                let currency = result.meta.currency;
                let prevClose = result.meta.previousClose;

                // 1. Handle GBp (pence) to GBP conversion immediately
                if (currency === 'GBp') {
                    price = price / 100;
                    prevClose = prevClose / 100;
                    currency = 'GBP';
                }

                // 2. Parse history from fetch
                let history = parseYahooHistory(result);
                if (result.meta.currency === 'GBp') {
                    history = history.map(h => ({ ...h, price: h.price / 100 }));
                }

                // 3. If we only fetched 1d, merge with cached history (which is already in GBP)
                if (range === '1d' && cachedTicker?.history) {
                    history = cachedTicker.history;
                }

                prices[ticker] = {
                    price: price,
                    currency: currency,
                    change_pct: (price - prevClose) / prevClose,
                    history: history
                };
            } else if (cachedTicker) {
                // Fallback to cache if fetch fails
                prices[ticker] = cachedTicker;
            }
        } catch (error) {
            console.error(`Error fetching price for ${ticker}:`, error);
            if (cachedDataObj?.data?.[ticker]) {
                prices[ticker] = cachedDataObj.data[ticker];
            }
        }
    });

    await Promise.all(promises);

    // 3. Save to cache
    if (Object.keys(prices).length > 0) {
        try {
            // Only update timestamp if we did a full history fetch
            const newTimestamp = isHistoryFresh ? timestamp : now;
            await AsyncStorage.setItem(CACHE_KEYS.PRICES, JSON.stringify({
                data: prices,
                timestamp: newTimestamp
            }));
        } catch (e) {
            console.error('Error saving prices cache:', e);
        }
    }

    return prices;
};

// Helper for currency conversion
export const getCurrencyRates = async (base = 'PLN') => {
    const now = Date.now();
    let cachedDataObj = null;

    // 1. Load from cache
    try {
        const cachedStr = await AsyncStorage.getItem(CACHE_KEYS.CURRENCIES);
        if (cachedStr) {
            cachedDataObj = JSON.parse(cachedStr);
        }
    } catch (e) {
        console.error('Error reading currency cache:', e);
    }

    // 2. Fetch fresh data
    const pairs = ['USDPLN=X', 'EURPLN=X', 'GBPPLN=X'];
    const rates = {
        'PLN': { current: 1.0, history: {} }
    };

    const timestamp = cachedDataObj?.timestamp || 0;
    const isHistoryFresh = (now - timestamp < HISTORY_CACHE_DURATION);

    console.log(`Fetching currency rates (Mode: ${isHistoryFresh ? 'Rate only' : 'Full history'})...`);

    await Promise.all(pairs.map(async (pair) => {
        try {
            const currency = pair.substring(0, 3);
            const cachedCurrency = cachedDataObj?.data?.[currency];
            const range = (isHistoryFresh && cachedCurrency?.history) ? '1d' : '1y';

            const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${pair}?interval=1d&range=${range}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const data = await response.json();
            if (data.chart && data.chart.result && data.chart.result.length > 0) {
                const result = data.chart.result[0];
                const price = result.meta.regularMarketPrice;

                let historyMap = {};
                if (range === '1y') {
                    const historyArr = parseYahooHistory(result);
                    historyArr.forEach(h => historyMap[h.date] = h.price);
                } else if (cachedCurrency?.history) {
                    historyMap = cachedCurrency.history;
                }

                rates[currency] = {
                    current: price,
                    history: historyMap
                };
            } else if (cachedCurrency) {
                rates[currency] = cachedCurrency;
            }
        } catch (e) {
            console.error(`Error fetching rate for ${pair}:`, e);
            const currency = pair.substring(0, 3);
            if (cachedDataObj?.data?.[currency]) {
                rates[currency] = cachedDataObj.data[currency];
            }
        }
    }));

    // 3. Save to cache
    if (Object.keys(rates).length > 1) {
        try {
            const newTimestamp = isHistoryFresh ? timestamp : now;
            await AsyncStorage.setItem(CACHE_KEYS.CURRENCIES, JSON.stringify({
                data: rates,
                timestamp: newTimestamp
            }));
        } catch (e) {
            console.error('Error saving currency cache:', e);
        }
    }

    console.log("Fetched Currency Rates (Mobile):", JSON.stringify(rates, null, 2));
    return rates;
};

export const clearCache = async () => {
    try {
        await AsyncStorage.removeItem(CACHE_KEYS.PRICES);
        await AsyncStorage.removeItem(CACHE_KEYS.CURRENCIES);
        console.log('Cache cleared successfully');
    } catch (e) {
        console.error('Error clearing cache:', e);
    }
};

