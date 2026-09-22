import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, ViewType } from './components/layout/Sidebar';
import { InventoryDashboard } from './views/InventoryDashboard';
import { ProductCatalogView } from './views/ProductCatalogView';
import { StockReceivingView } from './views/StockReceivingView';
import { StockAdjustmentView } from './views/StockAdjustmentView';
import { StockLedgerView } from './views/StockLedgerView';
import { POSView } from './views/POSView';
import { SuppliersView } from './views/SuppliersView';
import { ShiftsView } from './views/ShiftsView';
import { SettingsView } from './views/SettingsView';
import { LoginModal } from './components/auth/LoginModal';
import { getProductsWithStock, subscribeInventoryChanges } from './services/inventoryService';
import { getCurrentShift, subscribePosChanges } from './services/posService';
import { getCurrentUser, subscribeAuth, AuthUser, isAdmin } from './services/authService';
import { CashierShift } from './types/database';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(getCurrentUser());
  const userIsAdmin = isAdmin(currentUser);

  // Default initial view: Admin -> dashboard, Staff -> pos
  const [currentView, setCurrentView] = useState<ViewType>(userIsAdmin ? 'dashboard' : 'pos');
  const [currentShift, setCurrentShift] = useState<CashierShift | null>(null);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Role access guard: If user is staff, only 'catalog' and 'pos' are permitted
  useEffect(() => {
    if (!userIsAdmin && currentView !== 'catalog' && currentView !== 'pos') {
      setCurrentView('pos');
    }
  }, [userIsAdmin, currentView]);

  const refreshGlobalState = async () => {
    try {
      const [prods, shift] = await Promise.all([
        getProductsWithStock(),
        getCurrentShift()
      ]);
      const low = prods.filter(p => p.stock_status === 'low_stock' || p.stock_status === 'out_of_stock').length;
      setLowStockCount(low);
      setCurrentShift(shift);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    refreshGlobalState();
    const unsubInv = subscribeInventoryChanges(refreshGlobalState);
    const unsubPos = subscribePosChanges(refreshGlobalState);
    const unsubAuth = subscribeAuth((user) => {
      setCurrentUser(user);
      if (!isAdmin(user)) {
        setCurrentView('pos');
      }
    });
    return () => {
      unsubInv();
      unsubPos();
      unsubAuth();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      
      {/* Top Navigation Bar with Dark Green Theme */}
      <Navbar
        currentShift={currentShift}
        lowStockCount={lowStockCount}
        onNavigateToLowStock={() => setCurrentView('catalog')}
        onNavigateToSettings={() => {
          if (userIsAdmin) {
            setCurrentView('settings');
          }
        }}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        currentUser={currentUser}
        activeView={currentView}
      />

      {/* Main Body with Auto-Hiding Sidebar + View Content */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        
        {/* Navigation Sidebar (Auto-shrinks to icons when cursor moves away; staff sees only POS & Product List) */}
        <Sidebar
          currentView={currentView}
          onViewChange={(view) => {
            if (!userIsAdmin && view !== 'catalog' && view !== 'pos') {
              setCurrentView('pos');
            } else {
              setCurrentView(view);
            }
          }}
          lowStockCount={lowStockCount}
          currentUser={currentUser}
        />

        {/* View Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-w-0 transition-all">
          {/* Admin-only views */}
          {currentView === 'dashboard' && userIsAdmin && (
            <InventoryDashboard onNavigate={(v) => setCurrentView(v)} />
          )}
          {currentView === 'receiving' && userIsAdmin && <StockReceivingView />}
          {currentView === 'adjustments' && userIsAdmin && <StockAdjustmentView />}
          {currentView === 'ledger' && userIsAdmin && <StockLedgerView />}
          {currentView === 'suppliers' && userIsAdmin && <SuppliersView />}
          {currentView === 'shifts' && userIsAdmin && <ShiftsView />}
          {currentView === 'settings' && userIsAdmin && (
            <SettingsView onOpenLoginModal={() => setIsLoginModalOpen(true)} />
          )}

          {/* Shared views (with role-specific restrictions inside) */}
          {currentView === 'catalog' && (
            <ProductCatalogView isAdmin={userIsAdmin} />
          )}
          {currentView === 'pos' && <POSView />}

          {/* Unauthorized view attempt fallback for staff */}
          {!userIsAdmin && currentView !== 'catalog' && currentView !== 'pos' && (
            <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Restricted Staff Access</h2>
              <p className="text-xs text-slate-500 mt-2 mb-6">
                Your account is restricted to Point of Sale (POS) and Product List. Administrative management modules require an Admin login.
              </p>
              <button
                onClick={() => setCurrentView('pos')}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-mart-900 text-white font-semibold text-xs hover:bg-mart-800 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to POS Terminal</span>
              </button>
            </div>
          )}
        </main>

      </div>

      {/* Login & Role Selection Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          setIsLoginModalOpen(false);
          if (!isAdmin(user)) {
            setCurrentView('pos');
          }
        }}
      />

    </div>
  );
};

export default App;
