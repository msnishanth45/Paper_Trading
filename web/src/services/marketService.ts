import api from './api';

export const marketService = {
  async getPrices() {
    const response = await api.get('/market/prices');
    return response.data;
  },

  async getMarketStatus() {
    const response = await api.get('/market/status');
    return response.data;
  },

  async getFeedStatus() {
    const response = await api.get('/market/feed-status');
    return response.data;
  },

  async getOptionsChain(symbol: string) {
    const response = await api.get(`/options/chain?symbol=${symbol}`);
    return response.data;
  },
};
