// No external dependencies for fetch in React Native
// Using direct fetch to query1.finance.yahoo.com

export const getMarketPrices = async (tickers) => {
    if (!tickers || tickers.length === 0) return {};

    const prices = {};

    // Fetch one by one to avoid complex batching logic without library
    // Yahoo API: https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1d

    const promises = tickers.map(async (ticker) => {
        try {
            // Add random cache buster to avoid stale data if needed
            const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`);
            const data = await response.json();

            if (data.chart && data.chart.result && data.chart.result.length > 0) {
                const result = data.chart.result[0];
                let price = result.meta.regularMarketPrice;
                let currency = result.meta.currency;
                const previousClose = result.meta.previousClose;

                if (currency === 'GBp') {
                    price = price / 100;
                    currency = 'GBP';
                }

                prices[ticker] = {
                    price: price,
                    currency: currency,
                    change_pct: (price - previousClose) / previousClose
                };
                console.log(`Fetched price for ${ticker}: ${price} ${currency}`); // DEBUG
            }
        } catch (error) {
            console.error(`Error fetching price for ${ticker}:`, error);
            // Fail silently for UI responsiveness, or handle error
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
    const rates = { 'PLN': 1.0 };

    await Promise.all(pairs.map(async (pair) => {
        try {
            const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${pair}?interval=1d&range=1d`);
            const data = await response.json();
            if (data.chart && data.chart.result && data.chart.result.length > 0) {
                const price = data.chart.result[0].meta.regularMarketPrice;
                const currency = pair.substring(0, 3); // USD, EUR -> PLN rate
                rates[currency] = price;
            }
        } catch (e) {
            console.error(`Error fetching rate for ${pair}:`, e);
        }
    }));

    return rates;
};
