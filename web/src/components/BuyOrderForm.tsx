"use client";

import { useState } from 'react';
import { orderService } from '../services/orderService';
import { formatCurrency } from '../utils/formatters';

interface Props {
  symbol: string;
  ltp: number;
  lotSize?: number;
  instrumentKey?: string;
  optionType?: string;
  strike?: number;
  expiry?: string;
  onSuccess: () => void;
}

export default function BuyOrderForm({ symbol, ltp, lotSize = 1, instrumentKey, optionType, strike, expiry, onSuccess }: Props) {
  const [qty, setQty] = useState(lotSize);
  const [target, setTarget] = useState<string>('');
  const [stoploss, setStoploss] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estCost = ltp * qty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await orderService.buy({
        symbol,
        qty,
        target: target ? parseFloat(target) : undefined,
        stoploss: stoploss ? parseFloat(stoploss) : undefined,
        instrument_key: instrumentKey,
        option_type: optionType,
        strike,
        expiry,
      });
      onSuccess();
      setQty(lotSize);
      setTarget('');
      setStoploss('');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h3 className="text-lg font-medium text-white mb-4">Place Order</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Symbol</label>
          <input
            type="text"
            value={symbol}
            disabled
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white opacity-70 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Quantity (Lot Size: {lotSize})</label>
          <input
            type="number"
            min={lotSize}
            step={lotSize}
            value={qty}
            onChange={(e) => setQty(parseInt(e.target.value) || lotSize)}
            required
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Target (Optional)</label>
            <input
              type="number"
              step="0.05"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Price"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Stoploss (Optional)</label>
            <input
              type="number"
              step="0.05"
              value={stoploss}
              onChange={(e) => setStoploss(e.target.value)}
              placeholder="Price"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-500">
            {error}
          </div>
        )}

        <div className="flex justify-between items-center pt-2">
          <div className="text-sm">
            <span className="text-slate-400">Est. Margin: </span>
            <span className="text-white font-medium">{formatCurrency(estCost)}</span>
          </div>
          <button
            type="submit"
            disabled={loading || ltp === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                Processing
              </span>
            ) : (
              'BUY MARKET'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
