"use client";

import { useEffect, useState } from "react";
import { marketService } from "../services/marketService";

interface OptionProps {
  tradingSymbol: string;
  instrumentKey: string;
  price: number | null;
  lotSize: number;
}

interface StrikeRow {
  strike: number;
  CE?: OptionProps;
  PE?: OptionProps;
}

interface ComponentProps {
  symbol: string;
  onSelectOption: (option: OptionProps & { strike: number; optionType: string; underlying: string }) => void;
}

export default function OptionChain({ symbol, onSelectOption }: ComponentProps) {
  const [chain, setChain] = useState<StrikeRow[]>([]);
  const [underlyingLtp, setUnderlyingLtp] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    // Auto refresh chain API every 5 seconds (LTPs update via WS on the dashboard, this just keeps strikes relevant)
    const fetchChain = async () => {
      try {
        const res = await marketService.getOptionsChain(symbol);
        if (res.success && mounted) {
          setChain(res.data.chain);
          setUnderlyingLtp(res.data.ltp);
          setError(null);
        }
      } catch (err: any) {
        if (mounted) setError(err.response?.data?.message || "Failed to load option chain");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchChain();
    const interval = setInterval(fetchChain, 5000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [symbol]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48 bg-slate-900 rounded-xl border border-slate-800 text-slate-400">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500 mr-3"></div>
        Loading Option Chain...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-slate-900 rounded-xl border border-red-500/20 text-red-400 text-center">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full max-h-[600px]">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <h3 className="text-lg font-medium text-white">{symbol} Option Chain</h3>
        <span className="text-sm px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
          Spot: {underlyingLtp.toFixed(2)}
        </span>
      </div>
      
      <div className="overflow-auto flex-1 custom-scrollbar">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-400 uppercase bg-slate-950/50 sticky top-0 z-10 backdrop-blur-sm">
            <tr>
              <th className="px-4 py-3 text-center border-r border-slate-800 bg-green-500/5">CE (Calls)</th>
              <th className="px-4 py-3 font-bold text-center w-24">Strike</th>
              <th className="px-4 py-3 text-center border-l border-slate-800 bg-red-500/5">PE (Puts)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {chain.map((row) => (
              <tr key={row.strike} className="hover:bg-slate-800/30 transition-colors">
                {/* CALLS */}
                <td className="px-2 py-2 border-r border-slate-800 bg-green-500/5">
                  {row.CE ? (
                    <button
                      onClick={() => onSelectOption({ ...row.CE!, strike: row.strike, optionType: 'CE', underlying: symbol })}
                      className="w-full flex justify-between items-center px-4 py-2 hover:bg-slate-700/50 rounded-md transition-all group"
                    >
                      <span className="text-slate-400 text-xs hidden sm:block whitespace-nowrap overflow-hidden text-ellipsis mr-2 max-w-[100px]" title={row.CE.tradingSymbol}>
                        {row.CE.tradingSymbol}
                      </span>
                      <span className="text-green-400 font-medium font-mono group-hover:text-green-300">
                        {row.CE.price ? row.CE.price.toFixed(2) : '-'}
                      </span>
                    </button>
                  ) : <span className="text-slate-600 block text-center">-</span>}
                </td>
                
                {/* STRIKE */}
                <td className="px-2 py-3 text-center text-white font-bold bg-slate-900 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
                  {row.strike}
                </td>
                
                {/* PUTS */}
                <td className="px-2 py-2 border-l border-slate-800 bg-red-500/5">
                  {row.PE ? (
                    <button
                      onClick={() => onSelectOption({ ...row.PE!, strike: row.strike, optionType: 'PE', underlying: symbol })}
                      className="w-full flex justify-between items-center px-4 py-2 hover:bg-slate-700/50 rounded-md transition-all group"
                    >
                      <span className="text-red-400 font-medium font-mono group-hover:text-red-300">
                        {row.PE.price ? row.PE.price.toFixed(2) : '-'}
                      </span>
                      <span className="text-slate-400 text-xs hidden sm:block whitespace-nowrap overflow-hidden text-ellipsis ml-2 max-w-[100px]" title={row.PE.tradingSymbol}>
                        {row.PE.tradingSymbol}
                      </span>
                    </button>
                  ) : <span className="text-slate-600 block text-center">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
