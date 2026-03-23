export const SYMBOLS = {
  NIFTY: '%5ENSEI',
  BANKNIFTY: '%5ENSEBANK',
  SENSEX: '%5EBSESN'
};

export const LOT_SIZES = {
  NIFTY: 50,
  BANKNIFTY: 15,
  SENSEX: 10
};

// Store simulated prices to provide continuous pseudo-live experience if API fails or during off-market hours
let simulatedPrices = {
  NIFTY: { price: 22350.50, prevClose: 22250.00 },
  BANKNIFTY: { price: 47280.15, prevClose: 47350.50 },
  SENSEX: { price: 73650.80, prevClose: 73400.00 }
};

/**
 * Fetches live market data for a given symbol from Yahoo Finance.
 * @param {string} symbol - The symbol (NIFTY, BANKNIFTY, SENSEX)
 * @returns {Promise<{price: number, change: number, changePercent: number, success: boolean}>}
 */
export const fetchLivePrice = async (symbol) => {
  try {
    const yahooSymbol = SYMBOLS[symbol];
    if (!yahooSymbol) throw new Error('Unsupported symbol');

    // Attempt to fetch from Yahoo Finance
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d`
    );
    
    if (!response.ok) throw new Error('Network response was not ok');
    
    const data = await response.json();
    const result = data.chart.result[0];
    const meta = result.meta;
    
    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose;
    
    // Update our simulator baseline
    simulatedPrices[symbol] = { price, prevClose };
    
    return {
      success: true,
      price: price,
      change: price - prevClose,
      changePercent: ((price - prevClose) / prevClose) * 100,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.warn(`Fallback simulation triggered for ${symbol} due to API error/limits:`, error.message);
    
    // Fallback: Generate a realistic pseudo-random walk
    const base = simulatedPrices[symbol];
    const volatility = symbol === 'NIFTY' ? 5 : (symbol === 'BANKNIFTY' ? 15 : 20); // typical per-tick swing
    const randomShift = (Math.random() - 0.5) * volatility;
    
    base.price = base.price + randomShift;
    
    return {
      success: true,
      price: base.price,
      change: base.price - base.prevClose,
      changePercent: ((base.price - base.prevClose) / base.prevClose) * 100,
      timestamp: new Date().toISOString(),
      isSimulated: true // Flag to show it's simulated
    };
  }
};

/**
 * Simulates option pricing based on Black-Scholes-like simplified model for UI
 */
export const calculateOptionPrice = (spotPrice, strike, type, isCall = true) => {
  const intrinsicValue = isCall 
    ? Math.max(0, spotPrice - strike) 
    : Math.max(0, strike - spotPrice);
  
  // Advanced realistic time value approximation
  const distance = Math.abs(spotPrice - strike);
  // Options very far out of the money have almost 0 value, At-the-money have highest time premium
  let timeValue = Math.max(0, 150 * Math.exp(-distance / (spotPrice * 0.015)));
  
  // Add micro-volatility to simulate live order book ticking
  const orderBookJitter = (Math.random() - 0.5) * 1.5;
  
  const finalPrice = intrinsicValue + timeValue + orderBookJitter;
  return Math.max(0.05, finalPrice); // Minimum price is 0.05
};
