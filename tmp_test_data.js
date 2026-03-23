const fetch = require('node-fetch');

const SYMBOLS = {
  NIFTY: '%5ENSEI',
  BANKNIFTY: '%5ENSEBANK',
  SENSEX: '%5EBSESN'
};

async function testFetch() {
  console.log('--- Testing Market Service Logic ---');
  for (const [name, sym] of Object.entries(SYMBOLS)) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1m&range=1d`;
      console.log(`Fetching ${name} from: ${url}`);
      const response = await fetch(url);
      const data = await response.json();
      const meta = data.chart.result[0].meta;
      
      console.log(`${name}:`);
      console.log(`  Current Price: ${meta.regularMarketPrice}`);
      console.log(`  Previous Close: ${meta.previousClose}`);
      console.log(`  Net Change: ${(meta.regularMarketPrice - meta.previousClose).toFixed(2)}`);
      console.log(`  % Change: ${(((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100).toFixed(2)}%`);
    } catch (e) {
      console.error(`Error fetching ${name}:`, e.message);
    }
  }
}

testFetch();
