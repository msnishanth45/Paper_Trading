import { TrendingUp, TrendingDown } from 'lucide-react';

interface PriceCardProps {
  symbol: string;
  price: number;
  prevClose?: number; // Optional: could add this later for % change
}

export default function PriceCard({ symbol, price }: PriceCardProps) {
  // Simple heuristic for demo: assume price ending in even digit is up, odd is down (only for styling if no prev close)
  // In a real app, you compare with yesterday's close or the previous tick.
  const isUp = true; // Placeholder until prevClose logic is added

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-slate-400 font-medium tracking-wide">{symbol}</h3>
        {isUp ? (
          <TrendingUp className="w-5 h-5 text-green-500" />
        ) : (
          <TrendingDown className="w-5 h-5 text-red-500" />
        )}
      </div>
      
      <div className="flex items-baseline space-x-2">
        <span className={`text-3xl font-bold tracking-tight ${price ? 'text-white' : 'text-slate-600'}`}>
          {price !== undefined && price !== null ? price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'}
        </span>
      </div>
    </div>
  );
}
