import { useEffect, useState } from 'react';
import { orderService } from '../services/orderService';
import { formatCurrency, formatNumber, getPnLColorClass, getPnLBgClass } from '../utils/formatters';

interface Props {
  tradeId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function TradeDetailDrawer({ tradeId, isOpen, onClose }: Props) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && tradeId) {
      setLoading(true);
      setError(null);
      orderService.getTradeDetail(tradeId)
        .then(res => {
          if (res.success) setDetail(res.data);
          else setError(res.message);
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [isOpen, tradeId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="pointer-events-auto w-screen max-w-md transform transition duration-500 ease-in-out sm:duration-700">
          <div className="flex h-full flex-col overflow-y-scroll bg-slate-900 border-l border-slate-800 shadow-2xl pb-6">
            <div className="px-4 py-6 sm:px-6 bg-slate-800/50 sticky top-0 z-10 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white shadow-sm" id="slide-over-title">Trade Detail</h2>
                <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                  Trade ID: #{tradeId}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 p-2 transition-colors"
              >
                <span className="sr-only">Close panel</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="relative mt-6 flex-1 px-4 sm:px-6">
              {loading ? (
                <div className="flex justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : error || !detail ? (
                <div className="bg-red-900/20 border border-red-500/20 text-red-400 p-4 rounded-lg text-center">
                  {error || "Failed to load trade detail"}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Headline / Summary Card */}
                  <div className={`p-5 rounded-xl border ${detail.pnl >= 0 ? 'bg-green-900/10 border-green-500/20' : 'bg-red-900/10 border-red-500/20'} flex flex-col items-center justify-center text-center space-y-1`}>
                    <p className="text-sm text-slate-400 font-medium uppercase tracking-wider">Realized P&L</p>
                    <h3 className={`text-4xl font-bold font-mono tracking-tight ${getPnLColorClass(detail.pnl)}`}>
                      {detail.pnl > 0 ? '+' : ''}{formatCurrency(detail.pnl)}
                    </h3>
                    <span className="text-xs text-slate-500 bg-slate-900/50 px-2 py-1 rounded-full border border-slate-800/50 mt-2">
                      Reason: <strong className="text-slate-300">{detail.exitReason}</strong>
                    </span>
                  </div>

                  {/* Instrument Details */}
                  <div className="bg-slate-950 rounded-xl p-5 border border-slate-800 space-y-4">
                    <h4 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Instrument</h4>
                    
                    <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                      <span className="text-slate-400">Symbol</span>
                      <span className="font-bold text-white text-lg">{detail.symbol}</span>
                    </div>

                    {detail.option_type ? (
                      <>
                        <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                          <span className="text-slate-400">Option Info</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-200">{detail.strike}</span>
                            <span className={`px-2 py-0.5 text-xs font-bold rounded ${detail.option_type === 'CE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                              {detail.option_type}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Expiry</span>
                          <span className="text-slate-200">
                            {detail.expiry ? new Date(detail.expiry).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Type</span>
                        <span className="px-2 py-0.5 text-xs font-bold rounded bg-blue-500/20 text-blue-400">EQUITY</span>
                      </div>
                    )}
                  </div>

                  {/* Execution Specs */}
                  <div className="bg-slate-950 rounded-xl p-5 border border-slate-800 grid grid-cols-2 gap-y-5 gap-x-4">
                    <div className="col-span-2">
                      <h4 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Execution</h4>
                    </div>
                    
                    <div>
                      <span className="block text-slate-500 text-xs mb-1">Quantity</span>
                      <span className="text-white font-medium text-lg">{formatNumber(detail.qty)}</span>
                    </div>
                    
                    <div>
                      <span className="block text-slate-500 text-xs mb-1">Side</span>
                      <span className="text-white font-medium text-sm bg-slate-800 px-2 py-1 rounded inline-block">
                        {detail.side} / EXIT
                      </span>
                    </div>

                    <div>
                      <span className="block text-slate-500 text-xs mb-1">Entry Price</span>
                      <span className="text-white font-mono">{formatNumber(detail.entryPrice)}</span>
                    </div>

                    <div>
                      <span className="block text-slate-500 text-xs mb-1">Exit Price</span>
                      <span className="text-white font-mono">{formatNumber(detail.exitPrice)}</span>
                    </div>

                    <div className="col-span-2 pt-3 border-t border-slate-800/50">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Capital Used</span>
                        <span className="text-slate-300 font-mono">{formatCurrency(detail.entryPrice * detail.qty)}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-2">
                        <span className="text-slate-500">Capital Returned</span>
                        <span className="text-slate-300 font-mono">{formatCurrency(detail.exitPrice * detail.qty)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="bg-slate-950 rounded-xl p-5 border border-slate-800 space-y-3">
                    <h4 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Timeline</h4>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Trade Time</span>
                      <span className="text-slate-300 text-right">
                        {new Date(detail.exitTime).toLocaleString()}
                        <p className="text-[10px] text-slate-500 mt-0.5">Note: Paper Trading enters and exits synchronously in logs unless held multi-day</p>
                      </span>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
