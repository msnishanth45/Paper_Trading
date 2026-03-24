"use client";

import { useState, useEffect } from 'react';
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
  action?: 'BUY' | 'SELL';
  onSuccess: () => void;
}

export default function BuyOrderForm({ symbol, ltp, lotSize = 1, instrumentKey, optionType, strike, expiry, action = 'BUY', onSuccess }: Props) {
  const [qty, setQty] = useState(lotSize);
  const [target, setTarget] = useState<string>('');
  const [stoploss, setStoploss] = useState<string>('');
  const [trailingSl, setTrailingSl] = useState<string>('');
  const [useTrailingSl, setUseTrailingSl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync lot size when selection changes
  useEffect(() => {
    setQty(lotSize);
    setError(null);
  }, [symbol, lotSize, action]);

  const isOption = !!instrumentKey && !!optionType;
  const estCost = ltp * qty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (action === 'SELL') {
      setError("Short selling options is not currently supported in paper trading. To exit a position, please use the Open Positions table.");
      setLoading(false);
      return;
    }

    try {
      if (isOption) {
        await orderService.optionBuy({
          symbol,
          qty,
          instrument_key: instrumentKey,
          option_type: optionType,
          strike: strike as number,
          expiry: expiry as string,
          target: target ? parseFloat(target) : undefined,
          stoploss: stoploss ? parseFloat(stoploss) : undefined,
          trailing_sl: useTrailingSl && trailingSl ? parseFloat(trailingSl) : undefined,
          order_type: 'MARKET'
        });
      } else {
        await orderService.buy({
          symbol,
          qty,
          target: target ? parseFloat(target) : undefined,
          stoploss: stoploss ? parseFloat(stoploss) : undefined,
        });
        // Note: The base buy API doesn't fully support trailing_sl right now, but we can pass it
      }
      
      onSuccess();
      setTarget('');
      setStoploss('');
      setTrailingSl('');
      setUseTrailingSl(false);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`border rounded-xl p-6 ${action === 'SELL' ? 'bg-red-900/20 border-red-500/30' : 'bg-slate-900 border-slate-800'}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-white">
          {action === 'SELL' ? 'Short Sell' : 'Place Order'}
        </h3>
        <span className={`px-2 py-1 text-xs font-bold rounded ${action === 'SELL' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
          {isOption ? 'OPTION' : 'EQUITY/IDX'}
        </span>
      </div>
      
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
           <label className="block text-sm font-medium text-slate-400 mb-1">
             Quantity <span className="text-slate-500 text-xs ml-1">(Lot Size: {lotSize})</span>
           </label>
           <div className="flex items-center space-x-2">
             <button type="button" onClick={() => setQty(Math.max(lotSize, qty - lotSize))} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-medium border border-slate-700 transition-colors">-</button>
             <input
               type="number"
               min={lotSize}
               step={lotSize}
               value={qty}
               onChange={(e) => setQty(parseInt(e.target.value) || lotSize)}
               required
               className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-center"
             />
             <button type="button" onClick={() => setQty(qty + lotSize)} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-medium border border-slate-700 transition-colors">+</button>
           </div>
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

        {/* Trailing SL Toggle & Input */}
        <div className="pt-2 border-t border-slate-800">
          <label className="flex items-center cursor-pointer mb-2">
            <input 
              type="checkbox" 
              checked={useTrailingSl}
              onChange={(e) => setUseTrailingSl(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500 relative"></div>
            <span className="ml-3 text-sm font-medium text-slate-300">Enable Trailing Stoploss</span>
          </label>
          
          {useTrailingSl && (
             <div className="mt-2 animate-in fade-in slide-in-from-top-2">
               <label className="block text-sm font-medium text-slate-400 mb-1">Trail Amount (Points)</label>
               <input
                 type="number"
                 step="0.05"
                 value={trailingSl}
                 onChange={(e) => setTrailingSl(e.target.value)}
                 placeholder="e.g. 10.5"
                 required={useTrailingSl}
                 className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
               />
               <p className="text-xs text-slate-500 mt-1">Stoploss actively adjusts upwards by this amount.</p>
             </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-500">
            {error}
          </div>
        )}

        <div className="flex justify-between items-center pt-4">
          <div className="text-sm">
            <span className="text-slate-400">Est. Margin: </span>
            <span className="text-white font-medium">{formatCurrency(estCost)}</span>
          </div>
          <button
            type="submit"
            disabled={loading || ltp === 0 || action === 'SELL'}
            className={`font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center
              ${action === 'SELL' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          >
            {loading ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                Processing
              </span>
            ) : (
              action === 'SELL' ? 'SELL MARKET' : 'BUY MARKET'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
