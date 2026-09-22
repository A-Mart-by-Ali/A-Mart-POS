import React, { useState, useRef, useEffect } from 'react';
import {
  ShoppingBag,
  AlertTriangle,
  Clock,
  Settings,
  LogOut,
  LogIn,
  User,
  Shield,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { isSupabaseConfigured } from '../../services/supabase';
import { CashierShift } from '../../types/database';
import { AuthUser, logout, loginAsRole, ROLE_PROFILES } from '../../services/authService';
import { AppRole } from '../../types/database';

interface NavbarProps {
  currentShift: CashierShift | null;
  lowStockCount: number;
  onNavigateToLowStock: () => void;
  onNavigateToSettings: () => void;
  onOpenLoginModal: () => void;
  currentUser: AuthUser | null;
  activeView: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentShift,
  lowStockCount,
  onNavigateToLowStock,
  onNavigateToSettings,
  onOpenLoginModal,
  currentUser
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await logout();
  };

  const handleQuickRole = (role: AppRole) => {
    loginAsRole(role);
    setIsUserMenuOpen(false);
  };

  return (
    <header className="bg-mart-900 border-b border-mart-800 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
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

            {/* User Profile & Account Menu Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-2 pl-2.5 pr-2 py-1 rounded-xl bg-mart-800/80 hover:bg-mart-800 border border-mart-700/70 transition-all cursor-pointer text-left"
              >
                <div className="w-8 h-8 rounded-full bg-mart-700 border border-mart-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                  {currentUser ? currentUser.full_name.charAt(0) : '?'}
                </div>
                <div className="hidden lg:block">
                  <div className="text-xs font-semibold text-white leading-tight">
                    {currentUser ? currentUser.full_name : 'Sign In'}
                  </div>
                  <div className="text-[10px] text-mart-300 capitalize font-medium">
                    {currentUser ? currentUser.role.replace('_', ' ') : 'Guest'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-mart-300 ml-0.5" />
              </button>

              {/* User Menu Dropdown */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white text-slate-800 shadow-xl border border-slate-200 py-2 z-50 animate-fade-in text-xs">
                  
                  {/* User Profile Header */}
                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="font-bold text-sm text-slate-900">
                      {currentUser ? currentUser.full_name : 'Guest User'}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {currentUser ? currentUser.email : 'Not signed in'}
                    </div>
                    {currentUser && (
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-mart-100 text-mart-900">
                        {currentUser.role.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  {/* Navigation Links */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onNavigateToSettings();
                      }}
                      className="w-full px-4 py-2 flex items-center space-x-2.5 text-slate-700 hover:bg-slate-50 hover:text-mart-900 transition-colors cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-mart-700" />
                      <span>Settings & Business Info</span>
                    </button>
                  </div>

                  {/* Quick Role Switch Section */}
                  <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Switch Active Role
                    </span>
                    <div className="grid grid-cols-2 gap-1">
                      {(['super_admin', 'admin_manager', 'cashier', 'inventory_staff'] as AppRole[]).map(role => (
                        <button
                          key={role}
                          onClick={() => handleQuickRole(role)}
                          className={`px-2 py-1 rounded text-[11px] font-medium capitalize text-left transition-colors ${
                            currentUser?.role === role
                              ? 'bg-mart-900 text-white font-bold'
                              : 'hover:bg-slate-200/70 text-slate-700'
                          }`}
                        >
                          {role.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Logout / Login button */}
                  <div className="pt-1 border-t border-slate-100">
                    {currentUser ? (
                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-2 flex items-center space-x-2.5 text-rose-600 hover:bg-rose-50 transition-colors font-medium cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenLoginModal();
                        }}
                        className="w-full px-4 py-2 flex items-center space-x-2.5 text-mart-800 hover:bg-mart-50 font-bold transition-colors cursor-pointer"
                      >
                        <LogIn className="w-4 h-4 text-mart-800" />
                        <span>Sign In</span>
                      </button>
                    )}
                  </div>

                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
