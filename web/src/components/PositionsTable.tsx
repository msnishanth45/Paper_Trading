import { useState } from 'react';
import { formatCurrency, getPnLColorClass, getPnLBgClass, formatNumber } from '../utils/formatters';

interface Position {
  id: number;
  symbol: string;
  qty: number;
  avg_price: number;
  ltp: number | null;
  currentValue: number;
  unrealizedPnL: number;
  target?: number | null;
  stoploss?: number | null;
  trailing_sl?: number | null;
  instrument_key?: string | null;
  option_type?: string | null;
  strike?: string | null;
  expiry?: string | null;
}

interface Props {
  positions: Position[];
  onSell: (id: number, qty?: number) => void;
  onModify: (id: number, target: number | null, stoploss: number | null, trailing_sl: number | null) => Promise<void>;
  loading: boolean;
}

export default function PositionsTable({ positions, onSell, onModify, loading }: Props) {
  // Edit Limits Modal
  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [editTarget, setEditTarget] = useState<string>('');
  const [editStoploss, setEditStoploss] = useState<string>('');
  const [editTrailingSl, setEditTrailingSl] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Partial Exit Modal
  const [exitingPos, setExitingPos] = useState<Position | null>(null);
  const [exitQty, setExitQty] = useState<number>(0);
  const [isExiting, setIsExiting] = useState(false);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        <p className="text-slate-400 mt-4">Loading positions...</p>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
        <div className="text-slate-500 mb-2">
          <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-white">No active positions</h3>
        <p className="text-slate-400 mt-1">Execute a buy order to open a position.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/50 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
              <th className="px-6 py-4 font-medium">Symbol</th>
              <th className="px-6 py-4 font-medium text-right">Qty</th>
              <th className="px-6 py-4 font-medium text-right">Avg Price</th>
              <th className="px-6 py-4 font-medium text-right">LTP</th>
              <th className="px-6 py-4 font-medium text-right">Current Value</th>
              <th className="px-6 py-4 font-medium text-right">Target/SL/Trail</th>
              <th className="px-6 py-4 font-medium text-right">P&L</th>
              <th className="px-6 py-4 font-medium text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {positions.map((pos) => (
              <tr key={pos.id} className="hover:bg-slate-800/30 transition-colors group">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-semibold text-white">{pos.symbol}</div>
                  {pos.option_type && (
                     <div className="flex space-x-2 mt-1">
                       <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pos.option_type === 'CE' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                         {pos.option_type}
                       </span>
                       <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                         {pos.strike}
                       </span>
                       {pos.expiry && (
                         <span className="text-[10px] text-slate-500">
                           {new Date(pos.expiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                         </span>
                       )}
                     </div>
                  )}
                  {!pos.option_type && <div className="text-[10px] uppercase text-blue-400 mt-0.5 tracking-wider font-semibold">EQUITY</div>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-200">
                  {pos.qty}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-slate-400 font-mono">
                  {formatNumber(pos.avg_price)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-white font-mono">
                  {pos.ltp !== null ? formatNumber(pos.ltp) : '---'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-slate-300 font-mono">
                  {formatCurrency(pos.currentValue)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-slate-400 text-xs font-mono">
                  <div className={pos.target ? 'text-green-400' : ''}>T: {pos.target ? pos.target : '-'}</div>
                  <div className={pos.stoploss ? 'text-red-400' : ''}>S: {pos.stoploss ? pos.stoploss : '-'}</div>
                  <div className={pos.trailing_sl ? 'text-blue-400' : ''}>TS: {pos.trailing_sl ? pos.trailing_sl : '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium border font-mono ${getPnLBgClass(pos.unrealizedPnL)}`}>
                    {formatNumber(pos.unrealizedPnL, true)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center space-x-2">
                  <button
                    onClick={() => {
                      setEditingPos(pos);
                      setEditTarget(pos.target ? pos.target.toString() : '');
                      setEditStoploss(pos.stoploss ? pos.stoploss.toString() : '');
                      setEditTrailingSl(pos.trailing_sl ? pos.trailing_sl.toString() : '');
                    }}
                    className="bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all px-3 py-1.5 rounded font-medium text-sm focus:outline-none"
                  >
                    Modify
                  </button>
                  <button
                    onClick={() => {
                      setExitingPos(pos);
                      setExitQty(pos.qty);
                    }}
                    className="bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-600 hover:text-white transition-all px-3 py-1.5 rounded font-medium text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                  >
                    Exit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Limits Modal */}
      {editingPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col scale-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">Modify Limits</h3>
                <p className="text-sm text-slate-400 mt-1">{editingPos.symbol}</p>
              </div>
              <div className="text-right">
                 <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Live P&L</p>
                 <span className={`text-lg font-bold font-mono ${getPnLColorClass(editingPos.unrealizedPnL)}`}>
                   {formatNumber(editingPos.unrealizedPnL, true)}
                 </span>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Target Price (Optional)</label>
                <input
                  type="number"
                  step="0.05"
                  value={editTarget}
                  onChange={(e) => setEditTarget(e.target.value)}
                  placeholder="Leave empty to clear"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 flex-1 text-white outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 font-mono transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Stoploss Price (Optional)</label>
                <input
                  type="number"
                  step="0.05"
                  value={editStoploss}
                  onChange={(e) => setEditStoploss(e.target.value)}
                  placeholder="Leave empty to clear"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 font-mono transition-all"
                />
              </div>
              <div className="pt-2 border-t border-slate-800">
                <label className="block text-sm font-medium text-slate-300 mb-1">Trailing SL Points (Optional)</label>
                <input
                  type="number"
                  step="0.05"
                  value={editTrailingSl}
                  onChange={(e) => setEditTrailingSl(e.target.value)}
                  placeholder="e.g. 10.5"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 font-mono transition-all"
                />
                <p className="text-xs text-slate-500 mt-1">Leave empty to disable. Active SL moves up with price.</p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-800/20 flex justify-end space-x-3">
              <button
                onClick={() => setEditingPos(null)}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setIsSaving(true);
                  await onModify(
                    editingPos.id, 
                    editTarget ? parseFloat(editTarget) : null, 
                    editStoploss ? parseFloat(editStoploss) : null,
                    editTrailingSl ? parseFloat(editTrailingSl) : null
                  );
                  setIsSaving(false);
                  setEditingPos(null);
                }}
                disabled={isSaving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white shadow shadow-blue-500/20 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial / Full Exit Modal */}
      {exitingPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col scale-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 bg-red-950/20 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">Exit Position</h3>
                <p className="text-sm text-slate-400 mt-1">{exitingPos.symbol}</p>
              </div>
              <div className="bg-red-500/10 text-red-500 px-2 py-1 rounded text-xs font-bold border border-red-500/20">
                MARKET
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex justify-between text-sm mb-4 bg-slate-800/50 p-3 rounded-lg border border-slate-800">
                <div>
                   <span className="block text-slate-500">Current Ltp</span>
                   <span className="font-mono text-white text-lg">{exitingPos.ltp ? formatNumber(exitingPos.ltp) : '---'}</span>
                </div>
                <div className="text-right">
                   <span className="block text-slate-500">Live P&L</span>
                   <span className={`font-mono text-lg font-bold ${getPnLColorClass(exitingPos.unrealizedPnL)}`}>
                     {formatNumber(exitingPos.unrealizedPnL, true)}
                   </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Exit Quantity (Max: {exitingPos.qty})
                </label>
                <div className="flex space-x-2">
                   <input
                     type="number"
                     min={1}
                     max={exitingPos.qty}
                     value={exitQty}
                     onChange={(e) => setExitQty(Math.min(exitingPos.qty, Math.max(1, parseInt(e.target.value) || 0)))}
                     className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-red-500/50 focus:border-red-500 outline-none text-center text-lg font-medium transition-all"
                   />
                   <div className="flex flex-col space-y-1">
                      <button onClick={() => setExitQty(exitingPos.qty)} className="bg-slate-800 hover:bg-slate-700 text-xs text-white px-2 py-1 rounded flex-1 transition-colors border border-slate-700">MAX</button>
                      <button onClick={() => setExitQty(Math.max(1, Math.floor(exitingPos.qty / 2)))} className="bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 px-2 py-1 rounded flex-1 transition-colors border border-slate-700">50%</button>
                   </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-800/30 flex flex-col space-y-2">
              <button
                onClick={async () => {
                  try {
                    setIsExiting(true);
                    await onSell(exitingPos.id, exitQty);
                    setExitingPos(null);
                  } finally {
                    setIsExiting(false);
                  }
                }}
                disabled={isExiting || exitQty <= 0}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white shadow shadow-red-500/20 text-sm font-bold rounded-lg transition-all disabled:opacity-50 uppercase tracking-widest"
              >
                {isExiting ? "Processing..." : `Exit ${exitQty} Qty`}
              </button>
              <button
                onClick={() => setExitingPos(null)}
                disabled={isExiting}
                className="w-full py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
