import { formatCurrency, getPnLColorClass, formatNumber } from '../utils/formatters';

interface Props {
  totalPnL: number;
  invested: number;
  currentValue: number;
  roi: number;
}

export default function PnlSummary({ totalPnL, invested, currentValue, roi }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center">
        <p className="text-slate-400 text-sm font-medium mb-1">Total P&L</p>
        <p className={`text-2xl font-bold tracking-tight ${getPnLColorClass(totalPnL)}`}>
          {totalPnL > 0 ? '+' : ''}{formatCurrency(totalPnL)}
        </p>
      </div>
      
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center">
        <p className="text-slate-400 text-sm font-medium mb-1">Total ROI</p>
        <p className={`text-2xl font-bold tracking-tight ${getPnLColorClass(roi)}`}>
          {roi > 0 ? '+' : ''}{formatNumber(roi)}%
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center">
        <p className="text-slate-400 text-sm font-medium mb-1">Invested Value</p>
        <p className="text-2xl font-bold tracking-tight text-white">
          {formatCurrency(invested)}
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center">
        <p className="text-slate-400 text-sm font-medium mb-1">Current Value</p>
        <p className="text-2xl font-bold tracking-tight text-white">
          {formatCurrency(currentValue)}
        </p>
      </div>
    </div>
  );
}
