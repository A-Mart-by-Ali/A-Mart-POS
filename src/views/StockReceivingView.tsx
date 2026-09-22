import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  PackageCheck,
  Building2
} from 'lucide-react';
import {
  getSuppliers,
  getProductsWithStock,
  receiveStock,
  ProductWithStock
} from '../services/inventoryService';
import { Supplier, Purchase } from '../types/database';

interface ReceivingItem {
  product_id: string;
  quantity: number;
  unit_cost: number;
  tax_amount: number;
}

export const StockReceivingView: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [items, setItems] = useState<ReceivingItem[]>([]);

  // Success summary
  const [completedPurchase, setCompletedPurchase] = useState<Purchase | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [sups, prods] = await Promise.all([getSuppliers(), getProductsWithStock()]);
        setSuppliers(sups);
        setProducts(prods);
        if (sups.length > 0) setSelectedSupplierId(sups[0].id);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleAddItem = () => {
    if (products.length === 0) return;
    const defaultProduct = products[0];
    setItems([
      ...items,
      {
        product_id: defaultProduct.id,
        quantity: 10,
        unit_cost: defaultProduct.cost_price,
        tax_amount: 0
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ReceivingItem, value: any) => {
    const updated = [...items];
    if (field === 'product_id') {
      const prod = products.find(p => p.id === value);
      updated[index] = {
        ...updated[index],
        product_id: value,
        unit_cost: prod ? prod.cost_price : updated[index].unit_cost
      };
    } else {
      updated[index] = {
        ...updated[index],
        [field]: Number(value)
      };
    }
    setItems(updated);
  };

  const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unit_cost), 0);
  const totalTax = items.reduce((acc, item) => acc + (item.tax_amount || 0), 0);
  const grandTotal = subtotal + totalTax;
  const remainingPayable = Math.max(0, grandTotal - paidAmount);

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      alert('Please select a supplier');
      return;
    }
    if (items.length === 0) {
      alert('Please add at least one product to receive');
      return;
    }

    setSubmitting(true);
    try {
      const res = await receiveStock({
        supplier_id: selectedSupplierId,
        reference_number: referenceNumber,
        paid_amount: Number(paidAmount),
        items: items.map(i => ({
          product_id: i.product_id,
          quantity: Number(i.quantity),
          unit_cost: Number(i.unit_cost),
          tax_amount: Number(i.tax_amount || 0)
        }))
      });

      setCompletedPurchase(res);
      setItems([]);
      setReferenceNumber('');
      setPaidAmount(0);
    } catch (err: any) {
      alert(err.message || 'Failed to receive stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-10 max-w-6xl mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-mart-800" />
            <span>Stock Receiving & Purchase Intake</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Log incoming vendor shipments, update physical inventories atomically, and reconcile supplier payables.
          </p>
        </div>
      </div>

      {/* Success Banner */}
      {completedPurchase && (
        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-sm flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
            <div>
              <div className="font-bold text-sm">Stock Consignment Successfully Received!</div>
              <div className="text-xs text-emerald-800 mt-1 font-mono">
                PO Document Number: <strong>{completedPurchase.purchase_number}</strong>
              </div>
              <div className="text-xs text-emerald-700 mt-0.5">
                Total Value: <strong>Rs. {completedPurchase.total_amount.toLocaleString()}</strong> | Status: <strong>{completedPurchase.status.toUpperCase()}</strong>
              </div>
            </div>
          </div>
          <button
            onClick={() => setCompletedPurchase(null)}
            className="text-xs font-semibold text-emerald-800 hover:text-emerald-950"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Receiving Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Supplier & Header Metadata Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-mart-700" />
            <span>Supplier & Invoice Details</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Select Supplier *</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800"
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} (Bal: Rs. {s.current_balance.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Vendor Invoice / Ref #</label>
              <input
                type="text"
                placeholder="e.g. INV-98432 or PO-552"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Receiving Destination</label>
              <div className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium">
                A-Mart Main Store (Default Warehouse)
              </div>
            </div>
          </div>

          {selectedSupplier && (
            <div className="p-3 rounded-xl bg-mart-50/60 border border-mart-100 flex items-center justify-between text-xs text-mart-900">
              <span>Payment Terms: <strong>{selectedSupplier.payment_terms || 'Standard'}</strong></span>
              <span>Contact: <strong>{selectedSupplier.contact_person} ({selectedSupplier.phone})</strong></span>
              <span>Outstanding Balance: <strong>Rs. {selectedSupplier.current_balance.toLocaleString()}</strong></span>
            </div>
          )}
        </div>

        {/* Consignment Items Grid */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-mart-700" />
              <span>Received Line Items ({items.length})</span>
            </h2>

            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-mart-900 text-white hover:bg-mart-800 text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Line Item</span>
            </button>
          </div>

          {items.length === 0 ? (
            <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
              <PackageCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">No items added to this consignment yet.</p>
              <button
                type="button"
                onClick={handleAddItem}
                className="mt-3 px-3.5 py-1.5 rounded-lg bg-mart-900 text-white text-xs font-semibold hover:bg-mart-800"
              >
                + Add First Product
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-1/3">Product</th>
                    <th className="py-2.5 px-3 text-center w-24">Quantity</th>
                    <th className="py-2.5 px-3 text-right w-32">Unit Cost (Rs.)</th>
                    <th className="py-2.5 px-3 text-right w-24">Tax</th>
                    <th className="py-2.5 px-3 text-right w-32">Line Total</th>
                    <th className="py-2.5 px-2 text-center w-12">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => {
                    const lineTotal = (item.quantity * item.unit_cost) + (item.tax_amount || 0);
                    return (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3">
                          <select
                            value={item.product_id}
                            onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium focus:ring-1 focus:ring-mart-800"
                          >
                            {products.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} (Stock: {p.current_stock} {p.unit})
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-center font-mono font-bold"
                          />
                        </td>

                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_cost}
                            onChange={(e) => handleItemChange(idx, 'unit_cost', e.target.value)}
                            className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 text-right font-mono"
                          />
                        </td>

                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.tax_amount}
                            onChange={(e) => handleItemChange(idx, 'tax_amount', e.target.value)}
                            className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-right font-mono"
                          />
                        </td>

                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          Rs. {lineTotal.toLocaleString()}
                        </td>

                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Financial Settlement & Submission Card */}
        {items.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 text-xs">
              <div className="flex items-center space-x-4">
                <span className="text-slate-500">Subtotal:</span>
                <strong className="font-mono text-sm">Rs. {subtotal.toLocaleString()}</strong>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-slate-500">Tax Amount:</span>
                <strong className="font-mono text-sm">Rs. {totalTax.toLocaleString()}</strong>
              </div>
              <div className="flex items-center space-x-4 pt-1 border-t border-slate-200">
                <span className="font-bold text-slate-800 text-sm">Total Consignment:</span>
                <strong className="font-mono text-lg text-mart-900 font-extrabold">
                  Rs. {grandTotal.toLocaleString()}
                </strong>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-end gap-4 w-full md:w-auto">
              <div className="text-xs w-full sm:w-44">
                <label className="font-semibold text-slate-700 block mb-1">Paid Now (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  max={grandTotal}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-right text-emerald-800"
                />
                <div className="text-[10px] text-slate-500 mt-1 text-right">
                  Added to credit: <strong>Rs. {remainingPayable.toLocaleString()}</strong>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-mart-900 text-white font-bold hover:bg-mart-800 shadow-md text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <PackageCheck className="w-5 h-5 text-mart-200" />
                <span>{submitting ? 'Receiving...' : 'Confirm Stock Receiving'}</span>
              </button>
            </div>
          </div>
        )}

      </form>

    </div>
  );
};
