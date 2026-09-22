import React, { useEffect, useState } from 'react';
import {
  Package,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Truck,
  SlidersHorizontal,
  ShoppingBag,
  PlusCircle,
  Clock,
  Layers,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import {
  getInventoryMetrics,
  getProductsWithStock,
  getTransactions,
  ProductWithStock,
  subscribeInventoryChanges
} from '../services/inventoryService';
import { InventoryTransaction } from '../types/database';
import { ViewType } from '../components/layout/Sidebar';

interface InventoryDashboardProps {
  onNavigate: (view: ViewType) => void;
  onQuickReceiveProduct?: (productId: string) => void;
}

export const InventoryDashboard: React.FC<InventoryDashboardProps> = ({ onNavigate }) => {
  const [metrics, setMetrics] = useState({
    totalItems: 0,
    totalUnits: 0,
    totalCostValue: 0,
    totalRetailValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    potentialProfit: 0
  });
  const [lowStockItems, setLowStockItems] = useState<ProductWithStock[]>([]);
  const [recentMovements, setRecentMovements] = useState<(InventoryTransaction & { product_name: string; sku: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [m, products, txs] = await Promise.all([
        getInventoryMetrics(),
        getProductsWithStock(),
        getTransactions()
      ]);

      setMetrics(m);
      setLowStockItems(products.filter(p => p.stock_status === 'low_stock' || p.stock_status === 'out_of_stock'));
      setRecentMovements(txs.slice(0, 6));
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeInventoryChanges(loadData);
    return () => unsubscribe();
  }, []);

  const formatCurrency = (val: number) => {
    return `Rs. ${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-mart-800 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">Loading A-Mart Inventory Metrics...</p>
        </div>
      </div>
    );
  }

  const marginPercentage = metrics.totalRetailValue > 0
    ? Math.round((metrics.potentialProfit / metrics.totalRetailValue) * 100)
    : 0;

  return (
    <div className="space-y-6 pb-10">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>A-Mart Inventory Overview</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-mart-100 text-mart-900 border border-mart-200">
              Live Stock
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time stock valuation, reorder thresholds, and transactional audit ledger.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => onNavigate('receiving')}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-mart-900 text-white hover:bg-mart-800 text-xs font-semibold shadow-sm transition-all"
          >
            <Truck className="w-4 h-4 text-mart-200" />
            <span>Receive Stock (PO)</span>
          </button>
          <button
            onClick={() => onNavigate('adjustments')}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-sm transition-all"
          >
            <SlidersHorizontal className="w-4 h-4 text-mart-700" />
            <span>Stock Adjustment</span>
          </button>
          <button
            onClick={() => onNavigate('pos')}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold shadow-sm transition-all"
          >
            <ShoppingBag className="w-4 h-4 text-white" />
            <span>Open POS Terminal</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Stock Value */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-mart-700/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Stock Value</span>
            <div className="w-9 h-9 rounded-xl bg-mart-50 text-mart-800 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900">{formatCurrency(metrics.totalCostValue)}</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span>Retail Value: <strong>{formatCurrency(metrics.totalRetailValue)}</strong></span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-emerald-700 font-medium">
            <span>Potential Gross Profit:</span>
            <span className="font-bold">{formatCurrency(metrics.potentialProfit)} ({marginPercentage}%)</span>
          </div>
        </div>

        {/* Unique SKUs & Units */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-mart-700/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Cataloged SKUs</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900">{metrics.totalItems} Products</div>
            <div className="text-xs text-slate-500 mt-1">
              Total Units in Store: <strong className="text-slate-800">{metrics.totalUnits.toLocaleString()} units</strong>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
            <span>Active Categories:</span>
            <span className="font-bold text-slate-800">8 Categories</span>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-400/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Low Stock Warnings</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-amber-600">{metrics.lowStockCount} Items</div>
            <div className="text-xs text-slate-500 mt-1">
              Quantity is below threshold
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-amber-700">
            <span>Requires reorder from vendors</span>
          </div>
        </div>

        {/* Out of Stock */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-rose-400/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Out of Stock</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-rose-600">{metrics.outOfStockCount} Items</div>
            <div className="text-xs text-slate-500 mt-1">
              Zero physical units remaining
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-rose-700">
            <span>Lost revenue risk</span>
          </div>
        </div>

      </div>

      {/* Two Column Layout: Low Stock Table & Recent Movement Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2 Cols): Urgent Reorders Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h2 className="font-bold text-base text-slate-900">Reorder Attention Queue</h2>
            </div>
            <button
              onClick={() => onNavigate('catalog')}
              className="text-xs font-semibold text-mart-700 hover:text-mart-900 flex items-center gap-1"
            >
              View Full Catalog &rarr;
            </button>
          </div>

          {lowStockItems.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">All inventory levels are optimal</p>
              <p className="text-xs text-slate-400 mt-0.5">No products are currently under minimum stock thresholds.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Product / SKU</th>
                    <th className="py-2.5 px-3">Supplier</th>
                    <th className="py-2.5 px-3 text-center">Min Req.</th>
                    <th className="py-2.5 px-3 text-center">Current Stock</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lowStockItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{item.sku}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {item.supplier_name || 'Standard Vendor'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                        {item.min_stock_level} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[11px] ${
                            item.current_stock === 0
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.current_stock} {item.unit}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => onNavigate('receiving')}
                          className="px-2.5 py-1 rounded-lg bg-mart-50 hover:bg-mart-100 text-mart-900 border border-mart-200 text-[11px] font-semibold transition-all"
                        >
                          Reorder
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column (1 Col): Realtime Stock Movement Audit Feed */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-mart-700" />
              <h2 className="font-bold text-base text-slate-900">Recent Movements</h2>
            </div>
            <button
              onClick={() => onNavigate('ledger')}
              className="text-xs font-semibold text-mart-700 hover:text-mart-900"
            >
              Full Ledger &rarr;
            </button>
          </div>

          <div className="space-y-3">
            {recentMovements.map((tx) => {
              const isPositive = tx.quantity > 0;
              return (
                <div key={tx.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                          tx.transaction_type === 'purchase'
                            ? 'bg-emerald-100 text-emerald-800'
                            : tx.transaction_type === 'sale'
                            ? 'bg-blue-100 text-blue-800'
                            : tx.transaction_type === 'damage' || tx.transaction_type === 'expiry'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {tx.transaction_type.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-900 leading-tight">
                      {tx.product_name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {tx.reason || 'Movement logged'}
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-xs font-extrabold font-mono ${
                        isPositive ? 'text-emerald-600' : 'text-slate-800'
                      }`}
                    >
                      {isPositive ? `+${tx.quantity}` : tx.quantity}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Bal: {tx.new_quantity}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
