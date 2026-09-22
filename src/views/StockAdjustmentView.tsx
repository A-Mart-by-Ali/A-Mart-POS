import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  Plus,
  Trash2,
  RotateCcw
} from 'lucide-react';
import {
  getProductsWithStock,
  adjustStock,
  ProductWithStock
} from '../services/inventoryService';
import { AdjustmentType, StockAdjustment } from '../types/database';

export const StockAdjustmentView: React.FC = () => {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('damage');
  const [reason, setReason] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qtyChange, setQtyChange] = useState<number>(-1);

  // Success summary
  const [recentAdjustment, setRecentAdjustment] = useState<StockAdjustment | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const prods = await getProductsWithStock();
        setProducts(prods);
        if (prods.length > 0) setSelectedProductId(prods[0].id);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const currentQty = selectedProduct ? selectedProduct.current_stock : 0;
  const resultingQty = currentQty + Number(qtyChange);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || qtyChange === 0) {
      alert('Please select a product and specify non-zero quantity change');
      return;
    }
    if (!reason.trim()) {
      alert('Please provide an audit reason for this adjustment');
      return;
    }

    setSubmitting(true);
    try {
      const res = await adjustStock({
        type: adjustmentType,
        reason,
        items: [
          {
            product_id: selectedProductId,
            quantity_change: Number(qtyChange)
          }
        ]
      });

      setRecentAdjustment(res);
      setReason('');
      setQtyChange(-1);

      // Refresh products list
      const updated = await getProductsWithStock();
      setProducts(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to apply adjustment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-10 max-w-4xl mx-auto">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <SlidersHorizontal className="w-6 h-6 text-mart-800" />
          <span>Stock Adjustments & Write-Offs</span>
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Audit, reconcile physical inventory, write off damaged or expired items, and preserve compliance records.
        </p>
      </div>

      {/* Confirmation Banner */}
      {recentAdjustment && (
        <div className="p-5 rounded-2xl bg-orange-50 border border-orange-200 text-orange-950 shadow-sm flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-orange-600 mt-0.5" />
            <div>
              <div className="font-bold text-sm">Stock Adjustment Logged & Approved</div>
              <div className="text-xs text-orange-900 mt-0.5 font-mono">
                Document Number: <strong>{recentAdjustment.adjustment_number}</strong>
              </div>
              <div className="text-xs text-orange-800 mt-0.5">
                Type: <strong>{recentAdjustment.type.toUpperCase()}</strong> | Ledger updated atomically.
              </div>
            </div>
          </div>
          <button
            onClick={() => setRecentAdjustment(null)}
            className="text-xs font-semibold text-orange-800 hover:text-orange-950 px-3 py-1 rounded-full hover:bg-orange-100 transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Adjustment Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          
          {/* Adjustment Reason Categories */}
          <div>
            <label className="font-bold text-slate-800 uppercase tracking-wider block mb-2">
              1. Select Adjustment Nature
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { type: 'damage', label: 'Damaged Goods', desc: 'Broken / unsaleable' },
                { type: 'expiry', label: 'Expired Stock', desc: 'Past best-before date' },
                { type: 'stock_count', label: 'Physical Audit', desc: 'Cycle count variance' },
                { type: 'manual', label: 'Manual Correction', desc: 'General reconciliation' }
              ].map(opt => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => {
                    setAdjustmentType(opt.type as AdjustmentType);
                    if (opt.type === 'damage' || opt.type === 'expiry') {
                      if (qtyChange > 0) setQtyChange(-1);
                    }
                  }}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    adjustmentType === opt.type
                      ? 'border-mart-800 bg-mart-50 text-mart-900 ring-2 ring-mart-800/10'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs">{opt.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Product & Quantity Selection */}
          <div className="pt-4 border-t border-slate-100">
            <label className="font-bold text-slate-800 uppercase tracking-wider block mb-2">
              2. Select Product & Quantity Variance
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target Product *</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Available: {p.current_stock} {p.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Quantity Adjustment (Negative to deduct, positive to add) *
                </label>
                <input
                  type="number"
                  required
                  value={qtyChange}
                  onChange={(e) => setQtyChange(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 font-mono text-sm font-bold focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800"
                />
              </div>
            </div>
          </div>

          {/* Live Preview Box */}
          {selectedProduct && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-slate-500 font-medium">Stock Calculation Preview:</span>
                <div className="text-sm font-semibold text-slate-800">
                  {selectedProduct.name}
                </div>
              </div>

              <div className="flex items-center space-x-6 text-center font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-sans">Current</span>
                  <strong className="text-sm text-slate-700">{currentQty} {selectedProduct.unit}</strong>
                </div>
                <span className="text-lg text-slate-300 font-bold">&rarr;</span>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-sans">Adjustment</span>
                  <strong className={`text-sm ${qtyChange >= 0 ? 'text-orange-600' : 'text-rose-600'}`}>
                    {qtyChange >= 0 ? `+${qtyChange}` : qtyChange}
                  </strong>
                </div>
                <span className="text-lg text-slate-300 font-bold">&rarr;</span>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-sans">New Balance</span>
                  <strong className={`text-sm font-extrabold ${resultingQty < 0 ? 'text-rose-600' : 'text-mart-900'}`}>
                    {resultingQty} {selectedProduct.unit}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Reason & Audit Note */}
          <div className="pt-2">
            <label className="font-semibold text-slate-700 block mb-1">
              Audit Reason / Internal Justification *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Expired on 2026-03-15 or Found 2 damaged packs during shelf re-stocking"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              type="submit"
              disabled={submitting || (resultingQty < 0 && !selectedProduct?.allow_negative_stock)}
              className="px-6 py-3 rounded-full bg-mart-900 text-white font-bold hover:bg-mart-800 text-sm shadow-md transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-mart-200" />
              <span>{submitting ? 'Applying...' : 'Apply Stock Adjustment'}</span>
            </button>
          </div>

        </form>
      </div>

    </div>
  );
};
