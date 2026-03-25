import { formatCurrency, formatNumber } from '../utils/formatters';
import React, { memo } from "react";

interface SummaryData {
  totalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalTrades: number;
  winners: number;
  losers: number;
  winRate: number;
  avgProfit: number;
  avgLoss: number;
  runningPositions: number;
  roi: number;
}

interface Props {
  data: SummaryData | null;
  loading: boolean;
}

const PnlDashboard = memo(function PnlDashboard({ data, loading }: Props) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-28"></div>
        ))}
      </div>
    );
  }

  const isGreen = data.totalPnl >= 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Performance Overview</h2>
          <p className="text-sm text-slate-400">Comprehensive statistics across all paper trades</p>
        </div>
        <div className="text-right">
           <span className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">TOTAL ROI</span>
           <span className={`text-2xl font-black ${data.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
             {data.roi > 0 ? '+' : ''}{data.roi.toFixed(2)}%
           </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {/* PnL Card */}
        <div className="col-span-2 bg-slate-950 p-5 rounded-xl border border-slate-800 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Net P&L (Realized + Unrealized)</h3>
            <p className={`text-4xl font-bold tracking-tight font-mono ${isGreen ? 'text-green-500' : 'text-red-500'}`}>
              {data.totalPnl > 0 ? '+' : ''}{formatCurrency(data.totalPnl)}
            </p>
            <div className="mt-4 flex gap-4 text-sm">
               <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800/50 flex-1">
                 <span className="text-slate-500 text-xs block mb-0.5">Realized</span>
                 <span className={`font-medium ${data.realizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(data.realizedPnl)}</span>
               </div>
               <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800/50 flex-1">
                 <span className="text-slate-500 text-xs block mb-0.5">Running</span>
                 <span className={`font-medium ${data.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(data.unrealizedPnl)}</span>
               </div>
            </div>
          </div>
          {/* Decorative background glow */}
          <div className={`absolute -right-10 -bottom-10 w-40 h-40 blur-3xl opacity-20 rounded-full ${isGreen ? 'bg-green-500' : 'bg-red-500'}`}></div>
        </div>

        {/* Win Rate Card */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Win Rate</h3>
            <p className="text-3xl font-bold text-white tracking-tight">{data.winRate.toFixed(1)}%</p>
          </div>
          <div className="flex justify-between items-end mt-4">
             <div className="text-center">
               <span className="block text-green-400 text-lg font-bold">{data.winners}</span>
               <span className="text-[10px] text-slate-500 uppercase tracking-widest">Wins</span>
             </div>
             <span className="text-slate-700 font-light text-2xl">/</span>
             <div className="text-center">
               <span className="block text-red-400 text-lg font-bold">{data.losers}</span>
               <span className="text-[10px] text-slate-500 uppercase tracking-widest">Losses</span>
             </div>
          </div>
        </div>

        {/* Avg Profit/Loss */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
          <div>
            <h3 className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-0.5 flex justify-between">
              <span>Avg Profit</span>
              <span className="text-green-400">{formatCurrency(data.avgProfit)}</span>
            </h3>
            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
               <div className="h-full bg-green-500" style={{ width: data.avgProfit === 0 ? '0%' : `${(data.avgProfit / (data.avgProfit + Math.abs(data.avgLoss))) * 100}%` }}></div>
            </div>
          </div>
          
          <div>
            <h3 className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-0.5 flex justify-between">
              <span>Avg Loss</span>
              <span className="text-red-400">{formatCurrency(Math.abs(data.avgLoss))}</span>
            </h3>
            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
               <div className="h-full bg-red-500" style={{ width: data.avgLoss === 0 ? '0%' : `${(Math.abs(data.avgLoss) / (data.avgProfit + Math.abs(data.avgLoss))) * 100}%` }}></div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/50 text-[11px] flex justify-between">
             <span className="text-slate-500">Reward/Risk</span>
             <span className="text-white font-medium">
               {data.avgLoss !== 0 ? Math.abs(data.avgProfit / data.avgLoss).toFixed(2) : '-'} R
             </span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default PnlDashboard;
