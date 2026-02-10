import AsyncStorage from '@react-native-async-storage/async-storage';

// No external dependencies for fetch in React Native
// Using direct fetch to query1.finance.yahoo.com

const CACHE_KEYS = {
    PRICES: 'market_prices_cache',
    CURRENCIES: 'currency_rates_cache'
};

const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours in ms

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

    // 1. Try to load from cache
    try {
        const cachedData = await AsyncStorage.getItem(CACHE_KEYS.PRICES);
        if (cachedData) {
            const { data, timestamp } = JSON.parse(cachedData);
            const now = Date.now();

            // Check if ALL requested tickers are in cache and cache is fresh
            const hasAllTickers = tickers.every(t => data[t]);
            if (hasAllTickers && (now - timestamp < CACHE_DURATION)) {
                console.log('Using cached market prices');
                return data;
            }
        }
    } catch (e) {
        console.error('Error reading prices cache:', e);
    }

    // 2. Fetch fresh data
    const prices = {};
    console.log('Fetching fresh market prices from Yahoo...');

    const promises = tickers.map(async (ticker) => {
        try {
            const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const data = await response.json();

            if (data.chart && data.chart.result && data.chart.result.length > 0) {
                const result = data.chart.result[0];
                let price = result.meta.regularMarketPrice;
                let currency = result.meta.currency;
                const previousClose = result.meta.previousClose;

                // Parse history
                let history = parseYahooHistory(result);

                if (currency === 'GBp') {
                    price = price / 100;
                    currency = 'GBP';
                    history = history.map(h => ({ ...h, price: h.price / 100 }));
                }

                prices[ticker] = {
                    price: price,
                    currency: currency,
                    change_pct: (price - previousClose) / previousClose,
                    history: history
                };
            }
        } catch (error) {
            console.error(`Error fetching price for ${ticker}:`, error);
        }
    });

    await Promise.all(promises);

    // 3. Save to cache
    if (Object.keys(prices).length > 0) {
        try {
            await AsyncStorage.setItem(CACHE_KEYS.PRICES, JSON.stringify({
                data: prices,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.error('Error saving prices cache:', e);
        }
    }

    return prices;
};

// Helper for currency conversion
export const getCurrencyRates = async (base = 'PLN') => {
    // 1. Try to load from cache
    try {
        const cachedData = await AsyncStorage.getItem(CACHE_KEYS.CURRENCIES);
        if (cachedData) {
            const { data, timestamp } = JSON.parse(cachedData);
            const now = Date.now();

            if (now - timestamp < CACHE_DURATION) {
                console.log('Using cached currency rates');
                return data;
            }
        }
    } catch (e) {
        console.error('Error reading currency cache:', e);
    }

    // 2. Fetch fresh data
    const pairs = ['USDPLN=X', 'EURPLN=X', 'GBPPLN=X'];
    const rates = {
        'PLN': { current: 1.0, history: {} }
    };

    console.log('Fetching fresh currency rates from Yahoo...');

    await Promise.all(pairs.map(async (pair) => {
        try {
            const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${pair}?interval=1d&range=1y`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const data = await response.json();
            if (data.chart && data.chart.result && data.chart.result.length > 0) {
                const result = data.chart.result[0];
                const price = result.meta.regularMarketPrice;
                const currency = pair.substring(0, 3); // USD, EUR -> PLN rate

                const historyArr = parseYahooHistory(result);
                const historyMap = {};
                historyArr.forEach(h => historyMap[h.date] = h.price);

                rates[currency] = {
                    current: price,
                    history: historyMap
                };
            }
        } catch (e) {
            console.error(`Error fetching rate for ${pair}:`, e);
        }
    }));

    // 3. Save to cache
    if (Object.keys(rates).length > 1) {
        try {
            await AsyncStorage.setItem(CACHE_KEYS.CURRENCIES, JSON.stringify({
                data: rates,
                timestamp: Date.now()
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
