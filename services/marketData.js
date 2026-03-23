// services/marketData.js

const PREV_CLOSES = {
  'NIFTY': 22350.50,
  'BANKNIFTY': 47280.15,
  'SENSEX': 73650.80
};

const SYMBOL_MAP = {
  'NIFTY': '^NSEI',
  'BANKNIFTY': '^NSEBANK',
  'SENSEX': '^BSESN'
};

let simulatedPrices = {};

const isMarketOpen = () => {
  // Indian market timings: 9:15 AM to 3:30 PM IST (Monday to Friday)
  const now = new Date();
  
  // Convert current time to IST
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(utc + istOffset);
  
  const day = istTime.getDay();
  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  
  // Check if weekend
  if (day === 0 || day === 6) return false;
  
  const timeInMinutes = hours * 60 + minutes;
  const marketOpenMinutes = 9 * 60 + 15; // 9:15 AM
  const marketCloseMinutes = 15 * 60 + 30; // 3:30 PM
  
  return timeInMinutes >= marketOpenMinutes && timeInMinutes <= marketCloseMinutes;
};

const simulatePriceMessage = (symbol, prevClose) => {
  if (!simulatedPrices[symbol]) {
    simulatedPrices[symbol] = prevClose;
  }
  
  // Random walk: max +/- 0.05% change per tick
  const maxChangePercent = 0.0005; 
  const changeMultiplier = 1 + (Math.random() * maxChangePercent * 2 - maxChangePercent);
  
  simulatedPrices[symbol] = simulatedPrices[symbol] * changeMultiplier;
  
  const currentPrice = simulatedPrices[symbol];
  const absoluteChange = currentPrice - prevClose;
  const changePercent = (absoluteChange / prevClose) * 100;
  
  return {
    price: currentPrice,
    change: absoluteChange,
    changePercent: changePercent,
    isSimulated: true,
    success: true
  };
};

export const fetchLivePrice = async (symbol) => {
  const yahooSymbol = SYMBOL_MAP[symbol] || symbol;
  const prevClose = PREV_CLOSES[symbol] || 1000;
  
  if (!isMarketOpen()) {
    console.log(`[Simulation] Market closed. Simulating tick for ${symbol}`);
    return simulatePriceMessage(symbol, prevClose);
  }

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooSymbol}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.quoteResponse && data.quoteResponse.result && data.quoteResponse.result.length > 0) {
      const quote = data.quoteResponse.result[0];
      const currentPrice = quote.regularMarketPrice;
      const actualPrevClose = quote.regularMarketPreviousClose || prevClose;
      
      const change = currentPrice - actualPrevClose;
      const changePercent = (change / actualPrevClose) * 100;
      
      // Keep simulation base updated
      simulatedPrices[symbol] = currentPrice;
      PREV_CLOSES[symbol] = actualPrevClose;

      return {
        price: currentPrice,
        change: change,
        changePercent: changePercent,
        isSimulated: false,
        success: true
      };
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.log(`[API Fallback] Fetch failed for ${symbol}: ${error.message}. Simulating tick.`);
    return simulatePriceMessage(symbol, prevClose);
  }
};
