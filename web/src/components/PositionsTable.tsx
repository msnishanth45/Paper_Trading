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
}

interface Props {
  positions: Position[];
  onSell: (id: number) => void;
  onModify: (id: number, target: number | null, stoploss: number | null) => Promise<void>;
  loading: boolean;
}

export default function PositionsTable({ positions, onSell, onModify, loading }: Props) {
  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [editTarget, setEditTarget] = useState<string>('');
  const [editStoploss, setEditStoploss] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

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
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/50 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
              <th className="px-6 py-4 font-medium">Symbol</th>
              <th className="px-6 py-4 font-medium text-right">Qty</th>
              <th className="px-6 py-4 font-medium text-right">Avg Price</th>
              <th className="px-6 py-4 font-medium text-right">LTP</th>
              <th className="px-6 py-4 font-medium text-right">Current Value</th>
              <th className="px-6 py-4 font-medium text-right">Target/SL</th>
              <th className="px-6 py-4 font-medium text-right">P&L</th>
              <th className="px-6 py-4 font-medium text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {positions.map((pos) => (
              <tr key={pos.id} className="hover:bg-slate-800/30 transition-colors group">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-semibold text-white">{pos.symbol}</div>
                  <div className="text-xs text-blue-400 mt-0.5">BUY</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-slate-300">
                  {pos.qty}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-slate-300">
                  {formatNumber(pos.avg_price)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-white">
                  {pos.ltp !== null ? formatNumber(pos.ltp) : '---'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-slate-300">
                  {formatCurrency(pos.currentValue)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-slate-400 text-xs text-mono">
                  <div>T: {pos.target ? pos.target : '-'}</div>
                  <div>S: {pos.stoploss ? pos.stoploss : '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium border ${getPnLBgClass(pos.unrealizedPnL)}`}>
                    {formatNumber(pos.unrealizedPnL, true)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center space-x-2">
                  <button
                    onClick={() => {
                      setEditingPos(pos);
                      setEditTarget(pos.target ? pos.target.toString() : '');
                      setEditStoploss(pos.stoploss ? pos.stoploss.toString() : '');
                    }}
                    className="bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all px-3 py-1.5 rounded font-medium text-sm focus:outline-none"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onSell(pos.id)}
                    className="bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all px-3 py-1.5 rounded font-medium text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                  >
                    Exit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl w-full max-w-sm">
            <h3 className="text-xl font-bold text-white mb-1">Modify Order</h3>
            <p className="text-sm text-slate-400 mb-6">Update limits for {editingPos.symbol}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Target Price</label>
                <input
                  type="number"
                  step="0.05"
                  value={editTarget}
                  onChange={(e) => setEditTarget(e.target.value)}
                  placeholder="Optional target"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Stoploss Price</label>
                <input
                  type="number"
                  step="0.05"
                  value={editStoploss}
                  onChange={(e) => setEditStoploss(e.target.value)}
                  placeholder="Optional stoploss"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button
                  onClick={() => setEditingPos(null)}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setIsSaving(true);
                    await onModify(
                      editingPos.id, 
                      editTarget ? parseFloat(editTarget) : null, 
                      editStoploss ? parseFloat(editStoploss) : null
                    );
                    setIsSaving(false);
                    setEditingPos(null);
                  }}
                  disabled={isSaving}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
