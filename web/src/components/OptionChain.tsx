"use client";

import React, { useEffect, useState, memo, useCallback } from "react";
import { marketService } from "../services/marketService";

interface OptionProps {
  tradingSymbol: string;
  instrumentKey: string;
  ltp: number | null;
  oi: number | null;
  lotSize: number;
}

interface StrikeRow {
  strike: number;
  type: string; // ATM, ITM_CE, ITM_PE, OTM
  CE?: OptionProps;
  PE?: OptionProps;
}

interface ComponentProps {
  symbol: string;
  onSelectOption: (option: OptionProps & { strike: number; optionType: string; underlying: string; action: 'BUY' | 'SELL' }) => void;
}

// Phase 8: Memoized Row for Frontend Performance
const StrikeRowItem = memo(({ row, atmStrike, symbol, onSelectOption }: { row: StrikeRow, atmStrike: number, symbol: string, onSelectOption: any }) => {
  const isATM = row.type === 'ATM';
  const isCEITM = row.type === 'ITM_CE' || row.strike < atmStrike;
  const isPEITM = row.type === 'ITM_PE' || row.strike > atmStrike;
  
  return (
    <tr className={`hover:bg-slate-800/50 transition-colors group ${isATM ? 'relative z-0' : ''}`}>
      {/* CALLS */}
      <td className={`px-2 py-1 border-r border-slate-800 ${isCEITM ? 'bg-green-900/20' : 'bg-slate-900/30'}`}>
        {row.CE ? (
          <div className="flex justify-between items-center w-full px-2">
            <div className="flex flex-col items-start">
              <span className="text-green-400 font-medium font-mono">
                {row.CE.ltp ? row.CE.ltp.toFixed(2) : '-'}
              </span>
              <span className="text-slate-500 text-[10px]" title="Open Interest">
                OI: {row.CE.oi ?? '-'}
              </span>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <button
                onClick={() => onSelectOption({ ...row.CE!, strike: row.strike, optionType: 'CE', underlying: symbol, action: 'BUY' })}
                className="px-2 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
              >
                B
              </button>
              <button
                onClick={() => onSelectOption({ ...row.CE!, strike: row.strike, optionType: 'CE', underlying: symbol, action: 'SELL' })}
                className="px-2 py-1 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
              >
                S
              </button>
            </div>
          </div>
        ) : <span className="text-slate-600 block text-center">-</span>}
      </td>
      
      {/* STRIKE */}
      <td className={`px-2 py-2 font-bold font-mono border-x border-slate-800 relative
        ${isATM ? 'bg-blue-600/20 text-blue-300 shadow-[inset_0_0_15px_rgba(59,130,246,0.3)]' : 'bg-slate-900 text-slate-300'}`}>
        {isATM && (
          <div className="absolute inset-0 border-y border-blue-500/50 pointer-events-none" />
        )}
        {row.strike}
      </td>
      
      {/* PUTS */}
      <td className={`px-2 py-1 border-l border-slate-800 ${isPEITM ? 'bg-red-900/20' : 'bg-slate-900/30'}`}>
        {row.PE ? (
          <div className="flex justify-between items-center w-full px-2">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <button
                onClick={() => onSelectOption({ ...row.PE!, strike: row.strike, optionType: 'PE', underlying: symbol, action: 'BUY' })}
                className="px-2 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
              >
                B
              </button>
              <button
                onClick={() => onSelectOption({ ...row.PE!, strike: row.strike, optionType: 'PE', underlying: symbol, action: 'SELL' })}
                className="px-2 py-1 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
              >
                S
              </button>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-red-400 font-medium font-mono">
                {row.PE.ltp ? row.PE.ltp.toFixed(2) : '-'}
              </span>
              <span className="text-slate-500 text-[10px]" title="Open Interest">
                OI: {row.PE.oi ?? '-'}
              </span>
            </div>
          </div>
        ) : <span className="text-slate-600 block text-center">-</span>}
      </td>
    </tr>
  );
}, (prevProps, nextProps) => {
  // Custom memo comparison to avoid rerenders if LTP & OI hasn't changed
  if (prevProps.atmStrike !== nextProps.atmStrike) return false;
  if (prevProps.row.CE?.ltp !== nextProps.row.CE?.ltp) return false;
  if (prevProps.row.PE?.ltp !== nextProps.row.PE?.ltp) return false;
  if (prevProps.row.CE?.oi !== nextProps.row.CE?.oi) return false;
  if (prevProps.row.PE?.oi !== nextProps.row.PE?.oi) return false;
  return true;
});

const OptionChain = memo(function OptionChain({ symbol, onSelectOption }: ComponentProps) {
  const [chain, setChain] = useState<StrikeRow[]>([]);
  const [underlyingLtp, setUnderlyingLtp] = useState<number>(0);
  const [atmStrike, setAtmStrike] = useState<number>(0);
  
  const [expiries, setExpiries] = useState<string[]>([]);
  const [selectedExpiry, setSelectedExpiry] = useState<string>("");
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch expiries when symbol changes
  useEffect(() => {
    let mounted = true;
    const fetchExpiries = async () => {
      try {
        const res = await marketService.getExpiries(symbol);
        if (res.success && mounted) {
          setExpiries(res.data.expiries);
          if (res.data.nearestWeekly) {
            setSelectedExpiry(res.data.nearestWeekly);
          }
        }
      } catch (err: any) {
        if (mounted) setError("Failed to load expiries");
      }
    };
    fetchExpiries();
    return () => { mounted = false; };
  }, [symbol]);

  // Fetch option chain when symbol or expiry changes
  useEffect(() => {
    if (!selectedExpiry) return;
    
    let mounted = true;
    setLoading(true);
    
    const fetchChain = async () => {
      try {
        const res = await marketService.getOptionsChain(symbol, selectedExpiry);
        if (res.success && mounted) {
          setChain(res.data.chain);
          setUnderlyingLtp(res.data.futuresLtp || res.data.indexLtp || 0);
          setAtmStrike(res.data.atmStrike);
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
  }, [symbol, selectedExpiry]);

  if (loading && chain.length === 0) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px] bg-slate-900 rounded-xl border border-slate-800 text-slate-400">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500 mr-3"></div>
        Loading Option Chain...
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full max-h-[600px] shadow-lg">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80 backdrop-blur-sm z-20">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-bold text-white tracking-tight">{symbol} Chain</h3>
          <select 
            value={selectedExpiry}
            onChange={(e) => setSelectedExpiry(e.target.value)}
            className="bg-slate-800 border-slate-700 text-sm rounded-md text-slate-200 focus:ring-blue-500 focus:border-blue-500 px-3 py-1.5 outline-none transition-colors hover:bg-slate-700"
          >
            {expiries.map(exp => (
              <option key={exp} value={exp}>{exp}</option>
            ))}
          </select>
        </div>
        <span className="text-sm px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20 font-medium font-mono">
          FUT: {underlyingLtp.toFixed(2)}
        </span>
      </div>
      
      {error ? (
        <div className="p-6 text-red-400 text-center flex-1 flex items-center justify-center">
          {error}
        </div>
      ) : (
        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="w-full text-sm text-center border-collapse">
            <thead className="text-xs text-slate-400 uppercase bg-slate-950/80 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="px-2 py-3 border-r border-slate-800 bg-green-500/5 text-left w-1/3">CE (Calls)</th>
                <th className="px-2 py-3 font-bold w-24 border-x border-slate-800 bg-slate-900">Strike</th>
                <th className="px-2 py-3 border-l border-slate-800 bg-red-500/5 text-right w-1/3">PE (Puts)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {chain.map((row) => (
                <StrikeRowItem
                  key={row.strike}
                  row={row}
                  atmStrike={atmStrike}
                  symbol={symbol}
                  onSelectOption={onSelectOption}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

export default OptionChain;
