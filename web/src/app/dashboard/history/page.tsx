"use client";

import { useEffect, useState } from "react";
import AuthGuard from "../../../components/AuthGuard";
import Navbar from "../../../components/Navbar";
import { portfolioService } from "../../../services/portfolioService";
import { formatCurrency } from "../../../utils/formatters";

export default function TradeHistory() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await portfolioService.getHistory();
        if (res.success) {
          setHistory(res.trades || []);
        }
      } catch (err) {
        console.error("Failed to fetch history:", err);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, []);

  const totalRealizedPnl = history?.reduce((sum, trade) => sum + parseFloat(trade.pnl), 0) || 0;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Navbar />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <header className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Trade History</h1>
              <p className="text-slate-400">Review all your previous executed trades and realized PnL.</p>
            </div>
            <a href="/dashboard" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">&larr; Back to Dashboard</a>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
              <h3 className="text-slate-400 text-sm font-medium mb-1">Total Realized P&L</h3>
              <p className={`text-3xl font-bold tracking-tight ${totalRealizedPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                {totalRealizedPnl > 0 ? "+" : ""}{formatCurrency(totalRealizedPnl)}
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
              <h3 className="text-slate-400 text-sm font-medium mb-1">Total Trades</h3>
              <p className="text-3xl font-bold tracking-tight text-white">{history.length}</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-400 uppercase bg-slate-950/50">
                  <tr>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Symbol</th>
                    <th className="px-6 py-4 font-medium text-right">Qty</th>
                    <th className="px-6 py-4 font-medium text-right">Entry</th>
                    <th className="px-6 py-4 font-medium text-right">Exit</th>
                    <th className="px-6 py-4 font-medium text-center">Reason</th>
                    <th className="px-6 py-4 font-medium text-right">P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                        Loading history...
                      </td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                        No trades found. Start trading to view your history.
                      </td>
                    </tr>
                  ) : (
                    history.map((trade) => {
                      const pnl = parseFloat(trade.pnl);
                      const isProfit = pnl >= 0;
                      
                      return (
                        <tr key={trade.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                            {new Date(trade.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-white flex items-center space-x-2">
                            <span>{trade.symbol}</span>
                            {trade.option_type && (
                               <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${trade.option_type === 'CE' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                 {trade.option_type}
                               </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">{trade.qty}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">{parseFloat(trade.entry_price).toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">{parseFloat(trade.exit_price).toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-md text-xs">
                              {trade.exit_reason || 'MANUAL'}
                            </span>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-right font-medium ${isProfit ? "text-green-400" : "text-red-400"}`}>
                            {isProfit ? "+" : ""}{formatCurrency(pnl)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
