import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Barcode,
  SlidersHorizontal,
  Printer,
  Edit2,
  AlertCircle,
  CheckCircle,
  X,
  Tag,
  Boxes,
  ArrowUpDown
} from 'lucide-react';
import {
  getProductsWithStock,
  getCategories,
  getSuppliers,
  addProduct,
  updateProduct,
  adjustStock,
  ProductWithStock,
  subscribeInventoryChanges
} from '../services/inventoryService';
import { Category, Supplier, Product, AdjustmentType } from '../types/database';

export const ProductCatalogView: React.FC = () => {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [quickAdjustProduct, setQuickAdjustProduct] = useState<ProductWithStock | null>(null);
  const [printLabelProduct, setPrintLabelProduct] = useState<ProductWithStock | null>(null);

  // Form states
  const [newProduct, setNewProduct] = useState({
    sku: '',
    barcode: '',
    name: '',
    category_id: '',
    supplier_id: '',
    unit: 'pcs',
    cost_price: 0,
    selling_price: 0,
    min_stock_level: 10,
    max_stock_level: 100,
    tax_rate: 0,
    allow_negative_stock: false,
    expiry_tracked: false,
    is_active: true
  });

  const [adjustData, setAdjustData] = useState({
    type: 'manual' as AdjustmentType,
    quantity_change: 0,
    reason: ''
  });

  const loadCatalog = async () => {
    try {
      const [prods, cats, sups] = await Promise.all([
        getProductsWithStock(),
        getCategories(),
        getSuppliers()
      ]);
      setProducts(prods);
      setCategories(cats);
      setSuppliers(sups);
    } catch (err) {
      console.error('Error loading catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
    const unsub = subscribeInventoryChanges(loadCatalog);
    return () => unsub();
  }, []);

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery));

    const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory;

    const matchesStock =
      stockFilter === 'all' ||
      p.stock_status === stockFilter;

    return matchesSearch && matchesCategory && matchesStock;
  });

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addProduct(newProduct);
      setIsAddModalOpen(false);
      setNewProduct({
        sku: '',
        barcode: '',
        name: '',
        category_id: '',
        supplier_id: '',
        unit: 'pcs',
        cost_price: 0,
        selling_price: 0,
        min_stock_level: 10,
        max_stock_level: 100,
        tax_rate: 0,
        allow_negative_stock: false,
        expiry_tracked: false,
        is_active: true
      });
    } catch (err: any) {
      alert(err.message || 'Failed to add product');
    }
  };

  const handleQuickAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAdjustProduct || adjustData.quantity_change === 0) return;

    try {
      await adjustStock({
        type: adjustData.type,
        reason: adjustData.reason || `Quick ${adjustData.type} adjustment from catalog`,
        items: [
          {
            product_id: quickAdjustProduct.id,
            quantity_change: Number(adjustData.quantity_change)
          }
        ]
      });
      setQuickAdjustProduct(null);
      setAdjustData({ type: 'manual', quantity_change: 0, reason: '' });
    } catch (err: any) {
      alert(err.message || 'Failed to adjust stock');
    }
  };

  return (
    <div className="space-y-5 pb-10">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            A-Mart Product Catalog & Stock
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Master SKU directory with live physical inventory, wholesale costs, and retail margins.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-mart-900 text-white hover:bg-mart-800 text-sm font-semibold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4 text-mart-200" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Product Name, SKU, or Scan Barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50"
            />
          </div>

          {/* Category Dropdown */}
          <div className="w-full md:w-56">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50 text-slate-700"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Filter Badges */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(['all', 'in_stock', 'low_stock', 'out_of_stock'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStockFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  stockFilter === filter
                    ? 'bg-white text-mart-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {filter.replace('_', ' ')}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-3">Barcode</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Cost Price</th>
                <th className="py-3 px-3 text-right">Selling Price</th>
                <th className="py-3 px-3 text-right">Margin %</th>
                <th className="py-3 px-4 text-center">Stock Balance</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading catalog items...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No products match your search or filter criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const margin = p.selling_price > 0
                    ? Math.round(((p.selling_price - p.cost_price) / p.selling_price) * 100)
                    : 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm leading-snug">{p.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                          <span>{p.sku}</span>
                          {p.expiry_tracked && (
                            <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded font-sans">
                              Perishable
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-600">
                        {p.barcode || '-'}
                      </td>

                      <td className="py-3 px-3 text-slate-700 font-medium">
                        {p.category_name || '-'}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        Rs. {p.cost_price.toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        Rs. {p.selling_price.toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-700">
                        {margin}%
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`px-2.5 py-1 rounded-full font-bold text-xs ${
                              p.stock_status === 'out_of_stock'
                                ? 'bg-rose-100 text-rose-800'
                                : p.stock_status === 'low_stock'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {p.current_stock} {p.unit}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            Min: {p.min_stock_level}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => {
                              setQuickAdjustProduct(p);
                              setAdjustData({ type: 'manual', quantity_change: 0, reason: '' });
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-mart-900 hover:bg-mart-50 border border-slate-200 transition-all"
                            title="Quick Stock Adjustment"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setPrintLabelProduct(p)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-mart-900 hover:bg-mart-50 border border-slate-200 transition-all"
                            title="Print Shelf Tag"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD PRODUCT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-mart-900 text-white rounded-t-2xl">
              <div>
                <h3 className="font-bold text-base">Add New Product to A-Mart</h3>
                <p className="text-xs text-mart-200">Enters catalog and establishes baseline stock attributes</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-mart-200 hover:text-white hover:bg-mart-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-6 space-y-4 text-xs">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Olpers Pure Milk 1L"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">SKU (Stock Keeping Unit) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DAI-MLK-002"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Barcode (UPC/EAN)</label>
                  <input
                    type="text"
                    placeholder="Scan or enter barcode"
                    value={newProduct.barcode}
                    onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Category *</label>
                  <select
                    required
                    value={newProduct.category_id}
                    onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Supplier</label>
                  <select
                    value={newProduct.supplier_id}
                    onChange={(e) => setNewProduct({ ...newProduct, supplier_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Cost Price (Rs.) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newProduct.cost_price}
                    onChange={(e) => setNewProduct({ ...newProduct, cost_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Selling Price (Rs.) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newProduct.selling_price}
                    onChange={(e) => setNewProduct({ ...newProduct, selling_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Unit of Measure</label>
                  <select
                    value={newProduct.unit}
                    onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="litres">Litres</option>
                    <option value="packs">Packs</option>
                    <option value="boxes">Boxes</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Min Stock Warning Level</label>
                  <input
                    type="number"
                    min="0"
                    value={newProduct.min_stock_level}
                    onChange={(e) => setNewProduct({ ...newProduct, min_stock_level: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 font-mono"
                  />
                </div>

                <div className="flex items-center space-x-6 pt-5">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newProduct.expiry_tracked}
                      onChange={(e) => setNewProduct({ ...newProduct, expiry_tracked: e.target.checked })}
                      className="rounded text-mart-800 focus:ring-mart-800"
                    />
                    <span className="text-slate-700 font-medium">Perishable / Expiry Tracked</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-mart-900 text-white hover:bg-mart-800 font-semibold shadow-sm"
                >
                  Save Product to Catalog
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* QUICK STOCK ADJUSTMENT MODAL */}
      {quickAdjustProduct && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-mart-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Quick Stock Adjustment</h3>
                <p className="text-[11px] text-mart-200">{quickAdjustProduct.name}</p>
              </div>
              <button
                onClick={() => setQuickAdjustProduct(null)}
                className="text-mart-200 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAdjust} className="p-5 space-y-4 text-xs">
              
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Current Stock Balance:</span>
                <span className="font-extrabold text-slate-900 text-sm font-mono">
                  {quickAdjustProduct.current_stock} {quickAdjustProduct.unit}
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Adjustment Type</label>
                <select
                  value={adjustData.type}
                  onChange={(e) => setAdjustData({ ...adjustData, type: e.target.value as AdjustmentType })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium"
                >
                  <option value="damage">Damage (Deduction)</option>
                  <option value="expiry">Expiry (Deduction)</option>
                  <option value="manual">Manual Adjustment</option>
                  <option value="stock_count">Physical Stock Count Reconciliation</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Quantity Change (+ to add, - to deduct)
                </label>
                <input
                  type="number"
                  required
                  value={adjustData.quantity_change}
                  onChange={(e) => setAdjustData({ ...adjustData, quantity_change: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-sm font-bold"
                />
                <div className="mt-1 text-[11px] text-slate-500 flex justify-between">
                  <span>New balance will be:</span>
                  <strong className="text-mart-900 font-mono">
                    {quickAdjustProduct.current_stock + Number(adjustData.quantity_change)} {quickAdjustProduct.unit}
                  </strong>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Reason / Note *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Broken packaging / physical count variance"
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setQuickAdjustProduct(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-mart-900 text-white hover:bg-mart-800 font-semibold"
                >
                  Apply & Record in Ledger
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* PRINT SHELF LABEL MODAL */}
      {printLabelProduct && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700">A-Mart Shelf Label Preview</span>
              <button onClick={() => setPrintLabelProduct(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center justify-center">
              <div className="w-full border-2 border-dashed border-slate-400 p-4 rounded-xl bg-white text-center shadow-inner">
                <div className="text-[10px] uppercase font-black text-mart-900 tracking-widest mb-1">
                  A-MART SUPERMARKET
                </div>
                <div className="font-bold text-sm text-slate-900 line-clamp-2">
                  {printLabelProduct.name}
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
                  Rs. {printLabelProduct.selling_price.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Unit: {printLabelProduct.unit} | SKU: {printLabelProduct.sku}
                </div>

                {/* Simulated Barcode */}
                <div className="mt-3 flex flex-col items-center">
                  <div className="flex items-center justify-center space-x-0.5 h-10 w-44 bg-slate-900 p-1 rounded">
                    <div className="w-1 bg-white h-full"></div>
                    <div className="w-0.5 bg-white h-full"></div>
                    <div className="w-1.5 bg-white h-full"></div>
                    <div className="w-0.5 bg-white h-full"></div>
                    <div className="w-1 bg-white h-full"></div>
                    <div className="w-2 bg-white h-full"></div>
                    <div className="w-0.5 bg-white h-full"></div>
                    <div className="w-1.5 bg-white h-full"></div>
                    <div className="w-1 bg-white h-full"></div>
                  </div>
                  <span className="font-mono text-[11px] font-bold tracking-widest text-slate-700 mt-1">
                    {printLabelProduct.barcode || '896400000000'}
                  </span>
                </div>
              </div>

              <div className="mt-5 w-full flex items-center justify-between gap-3">
                <button
                  onClick={() => setPrintLabelProduct(null)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="flex-1 py-2 rounded-xl bg-mart-900 text-white text-xs font-semibold hover:bg-mart-800 flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4 text-mart-200" />
                  <span>Print Label</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
