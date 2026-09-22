import React from 'react';
import { ShoppingBag, AlertTriangle, ShieldCheck, Clock, Layers, Sparkles } from 'lucide-react';
import { isSupabaseConfigured } from '../../services/supabase';
import { CashierShift } from '../../types/database';

interface NavbarProps {
  currentShift: CashierShift | null;
  lowStockCount: number;
  onNavigateToLowStock: () => void;
  activeView: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentShift,
  lowStockCount,
  onNavigateToLowStock
}) => {
  return (
    <header className="bg-mart-900 border-b border-mart-800 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-inner text-mart-900 font-extrabold text-xl tracking-tighter">
              A
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl tracking-tight text-white">A-Mart</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider bg-mart-800 text-mart-200 px-2 py-0.5 rounded-full border border-mart-700">
                  Inventory & POS
                </span>
              </div>
              <p className="text-[11px] text-mart-200 font-medium hidden sm:block">
                Smart Retail & Ledger Management System
              </p>
            </div>
          </div>

          {/* Quick Metrics & System Status */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            
            {/* Database Engine Status Pill */}
            <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-mart-950/60 border border-mart-800/80 text-xs">
              <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span className="text-mart-100 font-medium">
                {isSupabaseConfigured ? 'Supabase Connected' : 'Local Retail Engine'}
              </span>
            </div>

            {/* Active Shift Indicator */}
            {currentShift && (
              <div className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-mart-800/90 border border-mart-700/80 text-xs">
                <Clock className="w-3.5 h-3.5 text-mart-400" />
                <div className="text-left">
                  <span className="text-mart-200 block text-[10px] leading-3 uppercase font-bold">Shift</span>
                  <span className="font-semibold text-white">
                    {currentShift.status === 'open' ? 'Register Open' : 'Register Closed'}
                  </span>
                </div>
              </div>
            )}

            {/* Low Stock Warning Pill Button */}
            {lowStockCount > 0 && (
              <button
                onClick={onNavigateToLowStock}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 hover:bg-amber-500/30 transition-all text-xs font-semibold cursor-pointer group"
                title="View low stock products"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>{lowStockCount} Low Stock</span>
              </button>
            )}

            {/* Cashier / User Avatar */}
            <div className="flex items-center space-x-2 pl-2 border-l border-mart-800">
              <div className="w-8 h-8 rounded-full bg-mart-700 border-2 border-mart-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                AM
              </div>
              <div className="hidden lg:block text-left">
                <div className="text-xs font-semibold text-white leading-tight">Admin Manager</div>
                <div className="text-[10px] text-mart-200">Main Branch</div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
