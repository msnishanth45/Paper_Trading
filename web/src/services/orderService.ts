import api from './api';

export const orderService = {
  async buy(data: { symbol: string; qty: number; target?: number; stoploss?: number; instrument_key?: string; option_type?: string; strike?: number; expiry?: string; }) {
    const response = await api.post('/orders/buy', data);
    return response.data;
  },

  async sell(positionId: number, qty?: number) {
    const response = await api.post('/orders/sell', { position_id: positionId, qty });
    return response.data;
  },

  async optionBuy(data: { symbol: string; qty: number; instrument_key: string; option_type: string; strike: number; expiry: string; target?: number; stoploss?: number; trailing_sl?: number; order_type?: 'MARKET'|'LIMIT'; limit_price?: number; }) {
    const response = await api.post('/orders/option-buy', data);
    return response.data;
  },

  async optionSell(data: { position_id: number; qty?: number; exit_type?: 'FULL' | 'PARTIAL' }) {
    const response = await api.post('/orders/option-sell', data);
    return response.data;
  },

  async cancelOrder(orderId: number) {
    const response = await api.delete(`/orders/${orderId}/cancel`);
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

  async modifyPosition(id: number, data: { target?: number | null; stoploss?: number | null; trailing_sl?: number | null }) {
    const response = await api.patch(`/orders/${id}/modify`, data);
    return response.data;
  },

  async getTradeDetail(id: number) {
    const response = await api.get(`/trades/${id}`);
    return response.data;
  },
};
