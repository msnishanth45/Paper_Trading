"use client";

import { useEffect, useState } from "react";
import AuthGuard from "../../components/AuthGuard";
import Navbar from "../../components/Navbar";
import PriceCard from "../../components/PriceCard";
import PnlDashboard from "../../components/PnlDashboard";
import PositionsTable from "../../components/PositionsTable";
import BuyOrderForm from "../../components/BuyOrderForm";
import OptionChain from "../../components/OptionChain";
import { useMarketPrices } from "../../hooks/useMarketPrices";
import { portfolioService } from "../../services/portfolioService";
import { orderService } from "../../services/orderService";
import { useAuth } from "../../context/AuthContext";
import { socketService } from "../../services/socketService";

export default function Dashboard() {
  const { user, refreshProfile } = useAuth();
  const { prices } = useMarketPrices();
  const [portfolio, setPortfolio] = useState<{
    totalPnL: number;
    invested: number;
    currentValue: number;
    roi: number;
    positions: any[];
  }>({
    totalPnL: 0,
    invested: 0,
    currentValue: 0,
    roi: 0,
    positions: [],
  });
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);


  // Selected state for Buy Form
  const [selectedSymbol, setSelectedSymbol] = useState("NIFTY");
  const [selectedOption, setSelectedOption] = useState<any>(null); // To hold CE/PE selection

  const fetchPortfolio = async () => {
    try {
      const [pnlRes, sumRes] = await Promise.all([
        portfolioService.getPnL(),
        portfolioService.getSummary()
      ]);
      
      if (pnlRes.success) setPortfolio(pnlRes);
      if (sumRes.success) setSummary(sumRes.data);
    } catch (err) {
      console.error("Failed to fetch portfolio:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();

    // Subscribe to specific user rooms for Live Trade/PnL updates
    if (user?.id) {
      socketService.subscribe(`subscribe-pnl:${user.id}`);
      socketService.subscribe(`subscribe-orders:${user.id}`);

      const unsubOrders = socketService.on("order-update", () => {
        // Refresh positions and wallet balance when any order occurs
        fetchPortfolio();
        refreshProfile();
      });

      const unsubPnl = socketService.on("pnl-update", (data: any) => {
        setPortfolio((prev) => ({
          ...prev,
          totalPnL: data.unrealized_pnl,
          invested: data.invested,
          currentValue: data.current,
          roi: data.invested > 0 ? (data.unrealized_pnl / data.invested) * 100 : 0
        }));
      });

      return () => {
        unsubOrders();
        unsubPnl();
      };
    }
  }, [user]);

  // Handle Sell Action
  const handleSell = async (positionId: number, qty?: number) => {
    try {
      await orderService.sell(positionId, qty);
      await fetchPortfolio();
      await refreshProfile();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message);
    }
  };

  // Handle Modify Target/SL/Trailing SL Action
  const handleModify = async (positionId: number, target: number | null, stoploss: number | null, trailing_sl: number | null) => {
    try {
      await orderService.modifyPosition(positionId, { target, stoploss, trailing_sl });
      await fetchPortfolio();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message);
    }
  };



  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Navbar />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Header */}
          <header>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              Trading Dashboard
            </h1>
            <p className="text-slate-400">
              Welcome back. The market awaits your next move.
            </p>
          </header>

          {/* Top Row: Prices & PnL Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="col-span-1 grid grid-cols-2 gap-4">
              <PriceCard symbol="NIFTY" price={prices["NIFTY"] || 0} />
              <PriceCard symbol="BANKNIFTY" price={prices["BANKNIFTY"] || 0} />
            </div>
            <div className="col-span-1 lg:col-span-2">
              <PnlDashboard data={summary} loading={loading} />
            </div>
          </div>

          {/* New Row: Option Chain */}
          <div className="h-[400px]">
             <OptionChain 
                symbol={selectedSymbol} 
                onSelectOption={(opt) => setSelectedOption(opt)} 
             />
          </div>

          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Col: Positions */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Open Positions</h2>
                <a href="/dashboard/history" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">View Trade History &rarr;</a>
              </div>
              
              <PositionsTable
                // Inject real-time Ltp directly from socket feed manually for table row coloring if needed
                positions={portfolio.positions.map(p => ({
                  ...p,
                  ltp: prices[p.symbol] || p.avg_price,
                  currentValue: (prices[p.symbol] || p.avg_price) * p.qty,
                  unrealizedPnL: ((prices[p.symbol] || p.avg_price) - p.avg_price) * p.qty
                }))}
                loading={loading}
                onSell={handleSell}
                onModify={handleModify}
              />
            </div>

            {/* Right Col: Order Form */}
            <div className="lg:col-span-1">
              <div className="sticky top-8">
                <div className="flex space-x-2 mb-4 bg-slate-900 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => { setSelectedSymbol("NIFTY"); setSelectedOption(null); }}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      selectedSymbol === "NIFTY"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    NIFTY
                  </button>
                  <button
                    onClick={() => { setSelectedSymbol("BANKNIFTY"); setSelectedOption(null); }}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      selectedSymbol === "BANKNIFTY"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    BANKNIFTY
                  </button>
                </div>

                <BuyOrderForm
                  symbol={selectedOption ? selectedOption.tradingSymbol : selectedSymbol}
                  ltp={selectedOption ? (prices[selectedOption.tradingSymbol] || selectedOption.ltp || 0) : (prices[selectedSymbol] || 0)}
                  lotSize={selectedOption ? selectedOption.lotSize : 1}
                  instrumentKey={selectedOption ? selectedOption.instrumentKey : undefined}
                  optionType={selectedOption ? selectedOption.optionType : undefined}
                  strike={selectedOption ? selectedOption.strike : undefined}
                  expiry={selectedOption ? selectedOption.expiry : undefined}
                  action={selectedOption ? selectedOption.action : 'BUY'}
                  onSuccess={() => {
                    fetchPortfolio();
                    refreshProfile();
                  }}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
