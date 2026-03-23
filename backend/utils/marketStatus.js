const TEST_MODE = true;

const isMarketOpen = () => {

  if (TEST_MODE) return true;

  const now = new Date();

  const ist = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const day = ist.getDay();
  const hours = ist.getHours();
  const minutes = ist.getMinutes();

  const currentMinutes = hours * 60 + minutes;

  const openTime = 9 * 60 + 15;
  const closeTime = 15 * 60 + 30;

  if (day === 0 || day === 6) return false;

  return currentMinutes >= openTime && currentMinutes <= closeTime;
};

module.exports = { isMarketOpen };