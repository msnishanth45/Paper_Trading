"use client";

import { useEffect, useState } from "react";
import AuthGuard from "../../../components/AuthGuard";
import Navbar from "../../../components/Navbar";
import PnlDashboard from "../../../components/PnlDashboard";
import TradeDetailDrawer from "../../../components/TradeDetailDrawer";
import { portfolioService } from "../../../services/portfolioService";
import { formatCurrency, formatNumber } from "../../../utils/formatters";

export default function TradeHistory() {
  const [history, setHistory] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Drawer state
  const [selectedTradeId, setSelectedTradeId] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [histRes, sumRes] = await Promise.all([
          portfolioService.getHistory(),
          portfolioService.getSummary()
        ]);
        
        if (histRes.success) setHistory(histRes.trades || []);
        if (sumRes.success) setSummary(sumRes.data);
      } catch (err) {
        console.error("Failed to fetch history data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const openTradeDetail = (id: number) => {
    setSelectedTradeId(id);
    setIsDrawerOpen(true);
  };

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
            <a href="/dashboard" className="text-blue-400 hover:text-blue-300 text-sm transition-colors font-medium">
              &larr; Back to Dashboard
            </a>
          </header>

          {/* Performance Dashboard */}
          <PnlDashboard data={summary} loading={loading} />

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg mt-8">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-lg font-medium text-white">Execution Log</h3>
              <span className="text-xs text-slate-500 bg-slate-800 px-3 py-1.5 rounded-md font-medium border border-slate-700/50">
                Click any row for detailed breakdown
              </span>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-400 uppercase bg-slate-950/80 sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="px-6 py-4 font-medium border-b border-slate-800">Date/Time</th>
                    <th className="px-6 py-4 font-medium border-b border-slate-800">Symbol</th>
                    <th className="px-6 py-4 font-medium border-b border-slate-800">Side/Action</th>
                    <th className="px-6 py-4 font-medium text-right border-b border-slate-800">Qty</th>
                    <th className="px-6 py-4 font-medium text-right border-b border-slate-800">Entry / Exit</th>
                    <th className="px-6 py-4 font-medium text-right border-b border-slate-800">Realized P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        <div className="flex justify-center items-center h-full">
                          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500 mr-3"></div>
                          Loading execution log...
                        </div>
                      </td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        <p className="text-lg mb-2">No completed trades yet.</p>
                        <p className="text-sm">Start trading to build your performance history.</p>
                      </td>
                    </tr>
                  ) : (
                    history.map((trade) => {
                      const pnl = parseFloat(trade.pnl);
                      const isProfit = pnl >= 0;
                      
                      return (
                        <tr 
                          key={trade.id} 
                          onClick={() => openTradeDetail(trade.id)}
                          className="hover:bg-slate-800/60 cursor-pointer transition-colors group"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                            <div className="text-sm text-slate-300 group-hover:text-white transition-colors">{new Date(trade.created_at).toLocaleDateString()}</div>
                            <div className="text-xs text-slate-500">{new Date(trade.created_at).toLocaleTimeString()}</div>
                          </td>
                          
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-semibold text-white group-hover:text-blue-400 transition-colors">{trade.symbol}</div>
                            {trade.option_type && (
                               <div className="flex space-x-2 mt-1">
                                 <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${trade.option_type === 'CE' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                   {trade.option_type}
                                 </span>
                                 <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                                   {trade.strike}
                                 </span>
                               </div>
                            )}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col space-y-1">
                               <span className="text-xs font-semibold text-white bg-slate-800 w-max px-2 py-0.5 rounded border border-slate-700">
                                 {trade.side}
                               </span>
                               <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                                 {trade.exit_reason || 'MANUAL'}
                               </span>
                            </div>
                          </td>
                          
                          <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-200">
                            {formatNumber(trade.qty)}
                          </td>
                          
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-slate-400 font-mono text-xs mb-1">In: {formatNumber(trade.entry_price)}</div>
                            <div className="text-white font-mono text-sm">Out: {formatNumber(trade.exit_price)}</div>
                          </td>
                          
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-bold font-mono tracking-tight bg-slate-900 border ${isProfit ? "text-green-400 border-green-500/20" : "text-red-400 border-red-500/20"}`}>
                              {isProfit ? "+" : ""}{formatCurrency(pnl)}
                            </span>
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

      {/* Slide-out Drawer Component */}
      <TradeDetailDrawer 
        tradeId={selectedTradeId} 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
      />
    </AuthGuard>
  );
}
