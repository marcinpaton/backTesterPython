// No external dependencies for fetch in React Native
// Using direct fetch to query1.finance.yahoo.com

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

    const prices = {};

    const promises = tickers.map(async (ticker) => {
        try {
            // Fetch 5 days history + current
            // Using range=1mo to be safe and slice later, or 7d. 5d is exact.
            // Yahoo API: range=5d filters weekends automatically.
            const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`);
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
                console.log(`Fetched ${ticker}: ${price} ${currency} (+ ${history.length} days history)`); // DEBUG
            }
        } catch (error) {
            console.error(`Error fetching price for ${ticker}:`, error);
        }
    });

    await Promise.all(promises);
    return prices;
};

// Helper for currency conversion
export const getCurrencyRates = async (base = 'PLN') => {
    // For prototype, we will fetch USDPLN, EURPLN, GBPPLN
    // Yahoo tickers: USDPLN=X, EURPLN=X, GBPPLN=X
    const pairs = ['USDPLN=X', 'EURPLN=X', 'GBPPLN=X'];
    // We will store current rate + history map { 'YYYY-MM-DD': rate }
    const rates = {
        'PLN': { current: 1.0, history: {} }
    };

    await Promise.all(pairs.map(async (pair) => {
        try {
            const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${pair}?interval=1d&range=5d`);
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

    console.log("Fetched Currency Rates (Mobile):", JSON.stringify(rates, null, 2));
    return rates;
};
