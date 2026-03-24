import api from './api';

export const orderService = {
  async buy(data: { symbol: string; qty: number; target?: number; stoploss?: number; instrument_key?: string; option_type?: string; strike?: number; expiry?: string; }) {
    const response = await api.post('/orders/buy', data);
    return response.data;
  },

  async sell(positionId: number) {
    const response = await api.post('/orders/sell', { position_id: positionId });
    return response.data;
  },

  async placeLimitOrder(data: { symbol: string; qty: number; limit_price: number; side?: 'BUY' | 'SELL'; target?: number; stoploss?: number; instrument_key?: string; option_type?: string; strike?: number; expiry?: string; }) {
    const response = await api.post('/orders/limit', data);
    return response.data;
  },

  async getOpenPositions() {
    const response = await api.get('/orders/open');
    return response.data;
  },

  async getPendingOrders() {
    const response = await api.get('/orders/pending');
    return response.data;
  },

  async modifyPosition(id: number, data: { target?: number | null; stoploss?: number | null }) {
    const response = await api.patch(`/orders/${id}`, data);
    return response.data;
  },
};
