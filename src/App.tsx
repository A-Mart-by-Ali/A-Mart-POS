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
import { getProductsWithStock, subscribeInventoryChanges } from './services/inventoryService';
import { getCurrentShift, subscribePosChanges } from './services/posService';
import { CashierShift } from './types/database';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [currentShift, setCurrentShift] = useState<CashierShift | null>(null);
  const [lowStockCount, setLowStockCount] = useState<number>(0);

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
    return () => {
      unsubInv();
      unsubPos();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      
      {/* Top Navigation Bar with Dark Green Theme */}
      <Navbar
        currentShift={currentShift}
        lowStockCount={lowStockCount}
        onNavigateToLowStock={() => setCurrentView('catalog')}
        activeView={currentView}
      />

      {/* Main Body with Sidebar + View Content */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        
        {/* Navigation Sidebar */}
        <Sidebar
          currentView={currentView}
          onViewChange={(view) => setCurrentView(view)}
          lowStockCount={lowStockCount}
        />

        {/* View Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {currentView === 'dashboard' && (
            <InventoryDashboard onNavigate={(v) => setCurrentView(v)} />
          )}
          {currentView === 'catalog' && <ProductCatalogView />}
          {currentView === 'receiving' && <StockReceivingView />}
          {currentView === 'adjustments' && <StockAdjustmentView />}
          {currentView === 'ledger' && <StockLedgerView />}
          {currentView === 'pos' && <POSView />}
          {currentView === 'suppliers' && <SuppliersView />}
          {currentView === 'shifts' && <ShiftsView />}
        </main>

      </div>

    </div>
  );
};

export default App;
