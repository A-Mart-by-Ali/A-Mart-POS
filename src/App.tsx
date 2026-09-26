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
import { CategoriesVariationsView } from './views/CategoriesVariationsView';
import { SalesAnalyticsView } from './views/SalesAnalyticsView';
import { LoginPage } from './views/LoginPage';
import { AnalyticsKeyModal } from './components/analytics/AnalyticsKeyModal';
import { UpdateNotifier } from './components/UpdateNotifier';
import { getProductsWithStock, subscribeInventoryChanges } from './services/inventoryService';
import { getCurrentShift, subscribePosChanges } from './services/posService';
import { getCurrentUser, subscribeAuth, AuthUser, isAdmin } from './services/authService';
import { isAnalyticsUnlocked, lockAnalytics } from './services/analyticsService';
import { CashierShift } from './types/database';
import { ShieldAlert, ArrowLeft, Lock, KeyRound } from 'lucide-react';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(getCurrentUser());
  const userIsAdmin = isAdmin(currentUser);

  // Default initial view: Admin -> dashboard, Staff -> pos
  const [currentView, setCurrentView] = useState<ViewType>(userIsAdmin ? 'dashboard' : 'pos');
  const [currentShift, setCurrentShift] = useState<CashierShift | null>(null);
  const [lowStockCount, setLowStockCount] = useState<number>(0);

  // Security Key state for Sales & Analytics
  const [analyticsUnlocked, setAnalyticsUnlocked] = useState<boolean>(isAnalyticsUnlocked());
  const [isAnalyticsKeyModalOpen, setIsAnalyticsKeyModalOpen] = useState(false);

  // Role access guard: If user is staff, only 'catalog', 'pos', and 'analytics' (key-protected) are permitted
  useEffect(() => {
    if (
      currentUser &&
      !userIsAdmin &&
      currentView !== 'catalog' &&
      currentView !== 'pos' &&
      currentView !== 'analytics'
    ) {
      setCurrentView('pos');
    }
  }, [currentUser, userIsAdmin, currentView]);

  const refreshGlobalState = async () => {
    if (!currentUser) return;
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
    if (currentUser) {
      refreshGlobalState();
    }
    const unsubInv = subscribeInventoryChanges(refreshGlobalState);
    const unsubPos = subscribePosChanges(refreshGlobalState);
    const unsubAuth = subscribeAuth((user) => {
      setCurrentUser(user);
      if (user) {
        if (!isAdmin(user)) {
          setCurrentView('pos');
        } else {
          setCurrentView('dashboard');
        }
      }
    });
    return () => {
      unsubInv();
      unsubPos();
      unsubAuth();
    };
  }, [currentUser]);

  // Handle navigation requests
  const handleNavigate = (view: ViewType) => {
    if (view === 'analytics') {
      if (analyticsUnlocked) {
        setCurrentView('analytics');
      } else {
        setIsAnalyticsKeyModalOpen(true);
      }
      return;
    }

    if (!userIsAdmin && view !== 'catalog' && view !== 'pos') {
      setCurrentView('pos');
    } else {
      setCurrentView(view);
    }
  };

  // If not logged in, render the dedicated A-Mart Login Page
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setCurrentView(isAdmin(user) ? 'dashboard' : 'pos');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      
      {/* Top Navigation Bar with Vibrant Orange Theme */}
      <Navbar
        currentShift={currentShift}
        lowStockCount={lowStockCount}
        onNavigateToLowStock={() => setCurrentView('catalog')}
        onNavigateToSettings={() => {
          if (userIsAdmin) {
            setCurrentView('settings');
          }
        }}
        currentUser={currentUser}
        activeView={currentView}
      />

      {/* Main Body with Auto-Hiding Sidebar + View Content */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        
        {/* Navigation Sidebar */}
        <Sidebar
          currentView={currentView}
          onViewChange={handleNavigate}
          lowStockCount={lowStockCount}
          currentUser={currentUser}
        />

        {/* View Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-w-0 transition-all">
          {/* Admin-only views */}
          {currentView === 'dashboard' && userIsAdmin && (
            <InventoryDashboard onNavigate={handleNavigate} />
          )}
          {currentView === 'categories' && userIsAdmin && <CategoriesVariationsView />}
          {currentView === 'receiving' && userIsAdmin && <StockReceivingView />}
          {currentView === 'adjustments' && userIsAdmin && <StockAdjustmentView />}
          {currentView === 'ledger' && userIsAdmin && <StockLedgerView />}
          {currentView === 'suppliers' && userIsAdmin && <SuppliersView />}
          {currentView === 'shifts' && userIsAdmin && <ShiftsView />}
          {currentView === 'settings' && userIsAdmin && <SettingsView />}

          {/* Shared views */}
          {currentView === 'catalog' && (
            <ProductCatalogView isAdmin={userIsAdmin} />
          )}
          {currentView === 'pos' && <POSView />}

          {/* Sales & Analytics (Protected by Security Key) */}
          {currentView === 'analytics' && (
            analyticsUnlocked ? (
              <SalesAnalyticsView
                onLock={() => {
                  lockAnalytics();
                  setAnalyticsUnlocked(false);
                  setCurrentView(userIsAdmin ? 'dashboard' : 'pos');
                }}
              />
            ) : (
              <div className="max-w-md mx-auto my-14 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm text-center">
                <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-950 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-7 h-7 text-mart-800" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Protected Sales Analytics</h2>
                <p className="text-xs text-slate-500 mt-2 mb-6 leading-relaxed">
                  Sales revenue, profit margins, and transaction logs are encrypted. Enter your authorization key to proceed.
                </p>
                <button
                  onClick={() => setIsAnalyticsKeyModalOpen(true)}
                  className="inline-flex items-center space-x-2 px-6 py-3 rounded-full bg-mart-900 text-white font-bold text-xs hover:bg-mart-800 transition-all cursor-pointer shadow-md"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Enter Security Key</span>
                </button>
              </div>
            )
          )}

          {/* Unauthorized view attempt fallback for staff */}
          {!userIsAdmin &&
            currentView !== 'catalog' &&
            currentView !== 'pos' &&
            currentView !== 'analytics' && (
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
                  className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-full bg-mart-900 text-white font-semibold text-xs hover:bg-mart-800 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to POS Terminal</span>
                </button>
              </div>
            )}
        </main>

      </div>

      {/* Security Key Challenge Modal for Sales & Analytics */}
      <AnalyticsKeyModal
        isOpen={isAnalyticsKeyModalOpen}
        onSuccess={() => {
          setAnalyticsUnlocked(true);
          setIsAnalyticsKeyModalOpen(false);
          setCurrentView('analytics');
        }}
        onCancel={() => {
          setIsAnalyticsKeyModalOpen(false);
        }}
      />

      {/* Update Notification Banner */}
      <UpdateNotifier />

    </div>
  );
};

export default App;
