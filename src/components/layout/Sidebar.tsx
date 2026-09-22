import React from 'react';
import {
  LayoutDashboard,
  Package,
  Truck,
  SlidersHorizontal,
  History,
  ShoppingBag,
  Building2,
  CircleDollarSign,
  Barcode
} from 'lucide-react';

export type ViewType =
  | 'dashboard'
  | 'catalog'
  | 'receiving'
  | 'adjustments'
  | 'ledger'
  | 'pos'
  | 'suppliers'
  | 'shifts';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  lowStockCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, lowStockCount }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'catalog', label: 'Inventory Catalog', icon: Package, badge: lowStockCount > 0 ? lowStockCount : null },
    { id: 'receiving', label: 'Stock Receiving', icon: Truck, badge: null },
    { id: 'adjustments', label: 'Stock Adjustments', icon: SlidersHorizontal, badge: null },
    { id: 'ledger', label: 'Movement Ledger', icon: History, badge: null },
    { id: 'pos', label: 'Point of Sale (POS)', icon: ShoppingBag, badge: 'Terminal' },
    { id: 'suppliers', label: 'Suppliers & Balances', icon: Building2, badge: null },
    { id: 'shifts', label: 'Cashier Shifts', icon: CircleDollarSign, badge: null },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col justify-between shadow-sm min-h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Main Navigation
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id as ViewType)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-mart-900 text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:bg-mart-50 hover:text-mart-900'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-mart-200' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== null && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-mart-700 text-white'
                        : item.badge === 'Terminal'
                        ? 'bg-emerald-100 text-mart-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Store Branch Footer Widget */}
      <div className="p-4 m-3 rounded-2xl bg-mart-50 border border-mart-100 text-mart-900">
        <div className="flex items-center space-x-2 text-xs font-bold text-mart-800 uppercase tracking-wider">
          <Barcode className="w-4 h-4 text-mart-700" />
          <span>A-Mart Main Store</span>
        </div>
        <p className="text-[12px] text-slate-600 mt-1 leading-snug">
          Multi-location active: <strong>Location #1</strong> (Default)
        </p>
        <div className="mt-2 text-[11px] text-mart-700 font-medium">
          PostgreSQL 15+ Schema Ready
        </div>
      </div>
    </aside>
  );
};
