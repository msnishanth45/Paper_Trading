"use client";

import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatters';
import { LogOut, Wallet } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-xl">P</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-white">PaperTrade</span>
        </div>

        {user && (
          <div className="flex items-center space-x-6">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs text-slate-400">Available Margin</span>
              <div className="flex items-center space-x-1.5 text-white">
                <Wallet className="w-4 h-4 text-blue-400" />
                <span className="font-semibold">{formatCurrency(user.balance)}</span>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-700 hidden sm:block"></div>

            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-slate-300">
                {user.username}
              </span>
              <button
                onClick={logout}
                className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
