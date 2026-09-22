import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  FileSpreadsheet,
  Calendar
} from 'lucide-react';
import { getTransactions, subscribeInventoryChanges } from '../services/inventoryService';
import { InventoryTransaction, TransactionType } from '../types/database';

export const StockLedgerView: React.FC = () => {
  const [transactions, setTransactions] = useState<(InventoryTransaction & { product_name: string; sku: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const loadTransactions = async () => {
    try {
      const data = await getTransactions();
      setTransactions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
    const unsub = subscribeInventoryChanges(loadTransactions);
    return () => unsub();
  }, []);

  const filtered = transactions.filter(t => {
    const matchesSearch =
      t.product_name.toLowerCase().includes(search.toLowerCase()) ||
      t.sku.toLowerCase().includes(search.toLowerCase()) ||
      (t.reason && t.reason.toLowerCase().includes(search.toLowerCase()));

    const matchesType = typeFilter === 'all' || t.transaction_type === typeFilter;

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-5 pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <History className="w-6 h-6 text-mart-800" />
            <span>Stock Movement Audit Ledger</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Immutable, double-entry style stock ledger tracking every unit received, sold, returned, or adjusted.
          </p>
        </div>

        <button
          onClick={loadTransactions}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-sm transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-mart-700" />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Product Name, SKU, Reason, or Document..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50"
          />
        </div>

        <div className="w-full sm:w-60">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50 text-slate-700"
          >
            <option value="all">All Movements</option>
            <option value="purchase">Purchases (Stock In)</option>
            <option value="sale">POS Sales (Stock Out)</option>
            <option value="sale_return">Sales Returns (Restock)</option>
            <option value="damage">Damages (Write-off)</option>
            <option value="expiry">Expiries (Write-off)</option>
            <option value="manual_adjustment">Manual Adjustments</option>
            <option value="stock_count_adjustment">Stock Count Audits</option>
            <option value="initial_stock">Initial Stock Intake</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Date / Time</th>
                <th className="py-3 px-3">Movement Type</th>
                <th className="py-3 px-3">Product / SKU</th>
                <th className="py-3 px-3 text-right">Variance</th>
                <th className="py-3 px-3 text-center">Prev Stock</th>
                <th className="py-3 px-3 text-center">New Balance</th>
                <th className="py-3 px-3 text-right">Unit Cost</th>
                <th className="py-3 px-4">Reason & Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading audit ledger entries...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No ledger entries match your filter.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => {
                  const isPositive = tx.quantity > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                        {new Date(tx.created_at).toLocaleString([], {
                          year: 'numeric',
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            tx.transaction_type === 'purchase' || tx.transaction_type === 'initial_stock'
                              ? 'bg-orange-100 text-orange-800'
                              : tx.transaction_type === 'sale'
                              ? 'bg-blue-100 text-blue-800'
                              : tx.transaction_type === 'damage' || tx.transaction_type === 'expiry'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {tx.transaction_type.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 leading-snug">{tx.product_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{tx.sku}</div>
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-bold">
                        <span
                          className={`inline-flex items-center gap-0.5 ${
                            isPositive ? 'text-orange-600' : 'text-slate-800'
                          }`}
                        >
                          {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />}
                          {isPositive ? `+${tx.quantity}` : tx.quantity}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-mono text-slate-500">
                        {tx.previous_quantity}
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold text-mart-900">
                        {tx.new_quantity}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        {tx.unit_cost ? `Rs. ${tx.unit_cost.toLocaleString()}` : '-'}
                      </td>

                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate text-[11px]">
                        {tx.reason || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
