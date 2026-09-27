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
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Menu
} from 'lucide-react';
import { isSupabaseConfigured } from '../../services/supabase';
import { CashierShift } from '../../types/database';
import { AuthUser, logout, isAdmin, KNOWN_ACCOUNTS } from '../../services/authService';
import {
  subscribeUpdateStatus,
  checkForUpdates,
  applyUpdate,
  SystemStatus
} from '../../services/updateService';

interface NavbarProps {
  currentShift: CashierShift | null;
  lowStockCount: number;
  onNavigateToLowStock: () => void;
  onNavigateToSettings: () => void;
  currentUser: AuthUser | null;
  activeView: string;
  onMenuToggle?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentShift,
  lowStockCount,
  onNavigateToLowStock,
  onNavigateToSettings,
  currentUser,
  onMenuToggle
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const userIsAdmin = isAdmin(currentUser);

  const [updateStatus, setUpdateStatus] = useState<SystemStatus>({
    hasUpdate: false,
    pendingCommits: 0,
    message: '',
    isUpdating: false,
    offline: !navigator.onLine,
    version: '1.0.0',
    mode: 'web',
    lastChecked: null
  });
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [justCheckedSuccess, setJustCheckedSuccess] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeUpdateStatus(setUpdateStatus);
    return () => unsubscribe();
  }, []);

  const handleUpdateClick = async () => {
    if (updateStatus.hasUpdate) {
      await applyUpdate();
      return;
    }

    setIsCheckingUpdate(true);
    setJustCheckedSuccess(false);
    try {
      const res = await checkForUpdates();
      if (!res.hasUpdate && !res.offline) {
        setJustCheckedSuccess(true);
        setTimeout(() => setJustCheckedSuccess(false), 3500);
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  };

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

  return (
    <header className="bg-mart-900 border-b border-mart-800 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
            {/* Brand Logo & Name */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {onMenuToggle && (
              <button 
                onClick={onMenuToggle}
                className="md:hidden p-1.5 -ml-2 text-mart-200 hover:text-white rounded-lg hover:bg-mart-800 transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
            )}
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white flex items-center justify-center shadow-inner text-mart-900 font-extrabold text-lg sm:text-xl tracking-tighter">
              A
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white">A-Mart</span>
                <span className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider bg-mart-800 text-mart-200 px-2 sm:px-2.5 py-0.5 rounded-full border border-mart-700 hidden sm:inline-block">
                  {userIsAdmin ? 'Admin ERP' : 'POS Terminal'}
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
            <div className="hidden md:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-mart-950/60 border border-mart-800/80 text-xs">
              <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span className="text-mart-100 font-medium">
                {isSupabaseConfigured ? 'Supabase Connected' : 'Local Retail Engine'}
              </span>
            </div>

            {/* Active Shift Indicator */}
            {currentShift && (
              <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-mart-800/90 border border-mart-700/80 text-xs">
                <Clock className="w-3.5 h-3.5 text-mart-400" />
                <div className="text-left">
                  <span className="text-mart-200 block text-[10px] leading-3 uppercase font-bold">Shift</span>
                  <span className="font-semibold text-white">
                    {currentShift.status === 'open' ? 'Register Open' : 'Register Closed'}
                  </span>
                </div>
              </div>
            )}

            {/* Low Stock Warning Pill Button (Admin only) */}
            {userIsAdmin && lowStockCount > 0 && (
              <button
                onClick={onNavigateToLowStock}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 hover:bg-amber-500/30 transition-all text-xs font-semibold cursor-pointer group"
                title="View low stock products"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>{lowStockCount} Low Stock</span>
              </button>
            )}

            {/* Quick In-App 1-Click Update Button */}
            {updateStatus.hasUpdate ? (
              <button
                onClick={handleUpdateClick}
                disabled={updateStatus.isUpdating}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md shadow-orange-950/40 text-xs font-bold transition-all animate-pulse cursor-pointer border border-orange-400/50"
                title="Click to install update"
              >
                {updateStatus.isUpdating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Installing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Update Ready (Install)</span>
                  </>
                )}
              </button>
            ) : justCheckedSuccess ? (
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-semibold animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Up to Date (v{updateStatus.version})</span>
              </div>
            ) : (
              <button
                onClick={handleUpdateClick}
                disabled={isCheckingUpdate}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-mart-800/80 hover:bg-mart-700 border border-mart-700/80 text-mart-200 hover:text-white transition-all text-xs font-medium cursor-pointer shadow-xs"
                title="Check for software updates"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-mart-300 ${isCheckingUpdate ? 'animate-spin text-orange-400' : ''}`} />
                <span>{isCheckingUpdate ? 'Checking...' : 'Check Updates'}</span>
              </button>
            )}

            {/* User Profile & Account Menu Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-2 pl-2.5 pr-3 py-1.5 rounded-full bg-mart-800/80 hover:bg-mart-800 border border-mart-700/70 transition-all cursor-pointer text-left"
              >
                <div className="w-8 h-8 rounded-full bg-mart-700 border border-mart-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                  {currentUser ? currentUser.full_name.charAt(0) : '?'}
                </div>
                <div className="hidden lg:block">
                  <div className="text-xs font-semibold text-white leading-tight">
                    {currentUser ? currentUser.full_name : 'Guest'}
                  </div>
                  <div className="text-[10px] text-mart-300 capitalize font-medium">
                    {userIsAdmin ? 'Administrator' : 'Store Staff'}
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
                      {currentUser ? currentUser.full_name : 'Authorized User'}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate font-mono">
                      {currentUser?.email}
                    </div>
                    <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      userIsAdmin ? 'bg-orange-100 text-orange-950 border border-orange-200' : 'bg-blue-100 text-blue-900'
                    }`}>
                      {userIsAdmin ? 'Admin (All Access)' : 'Staff (POS Only)'}
                    </span>
                  </div>

                  {/* Navigation Links - Admin Only */}
                  {userIsAdmin && (
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onNavigateToSettings();
                        }}
                        className="w-full px-4 py-2 flex items-center space-x-2.5 text-slate-700 hover:bg-slate-50 hover:text-mart-900 transition-colors cursor-pointer"
                      >
                        <Settings className="w-4 h-4 text-mart-700" />
                        <span>Store & System Settings</span>
                      </button>
                    </div>
                  )}

                  {/* Logout / Switch Account button */}
                  <div className="pt-1 border-t border-slate-100">
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 flex items-center space-x-2.5 text-rose-600 hover:bg-rose-50 transition-colors font-medium cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out (Switch Account)</span>
                    </button>
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
