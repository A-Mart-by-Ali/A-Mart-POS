import React, { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  Truck,
  SlidersHorizontal,
  History,
  ShoppingBag,
  Building2,
  CircleDollarSign,
  Barcode,
  Settings,
  Pin,
  PinOff,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  TrendingUp,
  Lock
} from 'lucide-react';
import { AuthUser, isAdmin } from '../../services/authService';

export type ViewType =
  | 'dashboard'
  | 'catalog'
  | 'receiving'
  | 'adjustments'
  | 'ledger'
  | 'pos'
  | 'suppliers'
  | 'shifts'
  | 'settings'
  | 'analytics';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  lowStockCount: number;
  currentUser: AuthUser | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  lowStockCount,
  currentUser
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  // Auto-expand on hover unless pinned
  const isExpanded = isPinned || isHovered;
  const userIsAdmin = isAdmin(currentUser);

  // Navigation Items
  const allNavItems = [
    { id: 'dashboard' as ViewType, label: 'Dashboard', icon: LayoutDashboard, badge: null, adminOnly: true, isKeyLocked: false },
    { id: 'pos' as ViewType, label: 'Point of Sale (POS)', icon: ShoppingBag, badge: 'Terminal', adminOnly: false, isKeyLocked: false },
    { id: 'analytics' as ViewType, label: 'Sales & Analytics', icon: TrendingUp, badge: null, adminOnly: false, isKeyLocked: true },
    { id: 'catalog' as ViewType, label: userIsAdmin ? 'Inventory Catalog' : 'Product List', icon: Package, badge: lowStockCount > 0 ? lowStockCount : null, adminOnly: false, isKeyLocked: false },
    { id: 'receiving' as ViewType, label: 'Stock Receiving', icon: Truck, badge: null, adminOnly: true, isKeyLocked: false },
    { id: 'adjustments' as ViewType, label: 'Stock Adjustments', icon: SlidersHorizontal, badge: null, adminOnly: true, isKeyLocked: false },
    { id: 'ledger' as ViewType, label: 'Movement Ledger', icon: History, badge: null, adminOnly: true, isKeyLocked: false },
    { id: 'suppliers' as ViewType, label: 'Suppliers & Balances', icon: Building2, badge: null, adminOnly: true, isKeyLocked: false },
    { id: 'shifts' as ViewType, label: 'Cashier Shifts', icon: CircleDollarSign, badge: null, adminOnly: true, isKeyLocked: false },
    { id: 'settings' as ViewType, label: 'Settings & Roles', icon: Settings, badge: null, adminOnly: true, isKeyLocked: false },
  ];

  // Filter items: staff sees strictly POS, Sales & Analytics (key protected), and Product List
  const navItems = userIsAdmin ? allNavItems : allNavItems.filter(item => !item.adminOnly);

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`bg-white border-r border-slate-200 flex-shrink-0 flex flex-col justify-between shadow-sm min-h-[calc(100vh-4rem)] transition-all duration-300 ease-in-out relative z-20 ${
        isExpanded ? 'w-64' : 'w-20'
      }`}
    >
      <div className="p-3 space-y-1">
        
        {/* Header with Navigation Title & Pin Button */}
        <div className="flex items-center justify-between px-2 py-1.5 min-h-[32px]">
          {isExpanded ? (
            <>
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                  {userIsAdmin ? 'Admin Control' : 'Staff Terminal'}
                </span>
                {!userIsAdmin && (
                  <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                    Restricted
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsPinned(!isPinned)}
                title={isPinned ? 'Unpin (enable auto-hide)' : 'Pin sidebar open'}
                className={`p-1.5 rounded-full text-slate-400 hover:text-mart-900 hover:bg-slate-100 transition-all ${
                  isPinned ? 'text-mart-800 bg-mart-50' : ''
                }`}
              >
                {isPinned ? <Pin className="w-3.5 h-3.5 fill-current" /> : <PinOff className="w-3.5 h-3.5" />}
              </button>
            </>
          ) : (
            <div className="w-full flex justify-center py-1 text-slate-400">
              <ChevronRight className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Navigation Item Links */}
        <nav className="space-y-1.5 pt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                title={!isExpanded ? item.label : undefined}
                className={`w-full flex items-center rounded-full text-sm transition-all cursor-pointer group relative ${
                  isExpanded ? 'px-4 py-2.5 justify-between' : 'p-3 justify-center'
                } ${
                  isActive
                    ? 'bg-mart-900 text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:bg-mart-50 hover:text-mart-900'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 transition-colors ${
                      isActive ? 'text-mart-200' : 'text-slate-500 group-hover:text-mart-800'
                    }`}
                  />
                  {isExpanded && (
                    <span className="whitespace-nowrap font-medium text-xs sm:text-sm">{item.label}</span>
                  )}
                </div>

                {/* Badge when expanded */}
                {isExpanded && item.badge !== null && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      isActive
                        ? 'bg-mart-700 text-white'
                        : item.isKeyLocked
                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                        : item.badge === 'Terminal'
                        ? 'bg-orange-100 text-orange-950 border border-orange-200'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {item.isKeyLocked && <Lock className="w-3 h-3 text-amber-700" />}
                    <span>{item.badge}</span>
                  </span>
                )}

                {/* Notification indicator in collapsed mode */}
                {!isExpanded && item.badge !== null && (
                  <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-white ${
                    item.isKeyLocked ? 'bg-amber-500' : 'bg-orange-500'
                  }`}></span>
                )}

                {/* Hover Tooltip in collapsed mode */}
                {!isExpanded && (
                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    <span>{item.label}</span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Store Branch / Footer Widget */}
      <div className="p-3">
        {isExpanded ? (
          <div className="p-3.5 rounded-2xl bg-mart-50 border border-mart-100 text-mart-900 transition-all">
            <div className="flex items-center space-x-2 text-xs font-bold text-mart-800 uppercase tracking-wider">
              <Barcode className="w-4 h-4 text-mart-700" />
              <span>A-Mart Main Store</span>
            </div>
            <p className="text-[12px] text-slate-600 mt-1 leading-snug">
              Active: <strong>Location #1</strong> (Default)
            </p>
            {currentUser && (
              <div className="mt-2 pt-2 border-t border-mart-200/50 flex items-center justify-between text-[11px]">
                <span className="text-slate-600 font-medium flex items-center gap-1">
                  {userIsAdmin ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-mart-700" />
                      <span>Admin Access</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>Staff Access</span>
                    </>
                  )}
                </span>
                <span className="font-bold text-orange-800 bg-orange-100/80 px-2 py-0.5 rounded-full text-[10px]">
                  Online
                </span>
              </div>
            )}
          </div>
        ) : (
          <div
            className="w-full py-3 rounded-2xl bg-mart-50 border border-mart-100 flex flex-col items-center justify-center text-mart-900 cursor-pointer"
            title="A-Mart Main Store"
          >
            <Barcode className="w-5 h-5 text-mart-800" />
            <span className="text-[9px] font-bold text-mart-800 mt-1">#1</span>
          </div>
        )}
      </div>
    </aside>
  );
};
