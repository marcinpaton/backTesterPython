import { parseISO, isBefore, isEqual } from 'date-fns';

export const calculatePortfolioState = (transactions, currentPrices, currencyRates) => {
    // 1. Sort transactions
    const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    let cash = 0.0;
    const holdings = {}; // { 'AAPL': 10, 'MSFT': 5 }

    // 2. Replay all transactions to get current holdings
    sortedTx.forEach(tx => {
        const type = tx.type;
        const amount = parseFloat(tx.amount_pln || 0);
        const ticker = tx.ticker;
        const shares = parseFloat(tx.shares || 0);

        if (type === 'DEPOSIT') {
            cash += amount;
        } else if (type === 'WITHDRAWAL') {
            cash -= amount;
        } else if (type === 'BUY') {
            cash -= amount; // Amount includes details, simplified
            if (ticker) {
                holdings[ticker] = (holdings[ticker] || 0) + shares;
            }
        } else if (type === 'SELL') {
            cash += amount;
            if (ticker) {
                holdings[ticker] = (holdings[ticker] || 0) - shares;
            }
        } else if (type === 'DIVIDEND') {
            cash += amount;
        }
        else if (type === 'TAX') {
            cash -= amount;
        }
    });

    // 3. Calculate Current Value
    let stocksValue = 0.0;
    const details = [];

    Object.keys(holdings).forEach(ticker => {
        const shareCount = holdings[ticker];
        if (shareCount > 0.000001) { // Filter out closed positions
            const priceData = currentPrices[ticker];
            let currentValue = 0;
            let currentPrice = 0;

            if (priceData) {
                currentPrice = priceData.price;
                const currency = priceData.currency || 'USD';
                const rate = currencyRates[currency] || 1.0;
                currentValue = shareCount * currentPrice * rate;
            }

            stocksValue += currentValue;
            details.push({
                ticker,
                shares: shareCount,
                price: currentPrice,
                value_pln: currentValue
            });
        }
    });

    const totalValue = cash + stocksValue;

    return {
        total_value: totalValue,
        cash: cash,
        stocks_value: stocksValue,
        holdings: details
    };
};
