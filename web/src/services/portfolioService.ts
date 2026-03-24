import api from './api';

export const portfolioService = {
  async getPositions() {
    const response = await api.get('/portfolio/positions');
    return response.data;
  },

  async getPnL() {
    const response = await api.get('/portfolio/pnl');
    return response.data;
  },

  async getHistory() {
    const response = await api.get('/portfolio/history');
    return response.data;
  },

  async getSummary() {
    const response = await api.get('/portfolio/summary');
    return response.data;
  },
};
