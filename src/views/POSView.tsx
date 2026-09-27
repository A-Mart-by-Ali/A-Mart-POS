import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  CreditCard,
  DollarSign,
  Smartphone,
  CheckCircle2,
  X,
  Receipt as ReceiptIcon,
  Tag
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { getProductsWithStock, ProductWithStock, subscribeInventoryChanges } from '../services/inventoryService';
import {
  getCurrentShift,
  processSale,
  ProcessSalePayload
} from '../services/posService';
import { CashierShift, Receipt, Sale, SaleItem, PaymentMethod } from '../types/database';

interface CartItem {
  product: ProductWithStock;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
}

export const POSView: React.FC = () => {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [currentShift, setCurrentShift] = useState<CashierShift | null>(null);
  const [loading, setLoading] = useState(true);

  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [overallDiscount, setOverallDiscount] = useState<number>(0);

  // Receipt Modal
  const [lastReceipt, setLastReceipt] = useState<{
    receipt: Receipt;
    sale: Sale;
    items: SaleItem[];
    change: number;
  } | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      const [prods, shift] = await Promise.all([getProductsWithStock(), getCurrentShift()]);
      setProducts(prods);
      setCurrentShift(shift);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeInventoryChanges(loadData);
    return () => unsub();
  }, []);

  const addToCart = (product: ProductWithStock) => {
    if (product.current_stock <= 0 && !product.allow_negative_stock) {
      alert(`Cannot add ${product.name}: Out of Stock`);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity + 1 > product.current_stock && !product.allow_negative_stock) {
          alert(`Cannot add more than available stock (${product.current_stock})`);
          return prev;
        }
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          unit_price: product.selling_price,
          discount_amount: 0,
          tax_amount: (product.selling_price * (product.tax_rate || 0)) / 100
        }
      ];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(item => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.product.current_stock && !item.product.allow_negative_stock) {
              alert(`Maximum available stock is ${item.product.current_stock}`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;

    // Search by exact barcode or SKU or prefix
    const matched = products.find(
      p =>
        (p.barcode && p.barcode.toLowerCase() === search.trim().toLowerCase()) ||
        p.sku.toLowerCase() === search.trim().toLowerCase()
    );

    if (matched) {
      addToCart(matched);
      setSearch('');
    } else {
      // Find by partial name
      const fuzzy = products.find(p => p.name.toLowerCase().includes(search.trim().toLowerCase()));
      if (fuzzy) {
        addToCart(fuzzy);
        setSearch('');
      } else {
        alert('Product not found for scanned barcode / SKU');
      }
    }
  };

  // Cart Calculations
  const subtotal = cart.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  const taxTotal = cart.reduce((acc, item) => acc + (item.quantity * (item.tax_amount || 0)), 0);
  const grandTotal = Math.max(0, subtotal - overallDiscount + taxTotal);
  const changeDue = paymentMethod === 'cash' ? Math.max(0, amountReceived - grandTotal) : 0;

  // Sync amount received with total for card/other
  useEffect(() => {
    if (paymentMethod !== 'cash') {
      setAmountReceived(grandTotal);
    } else if (amountReceived === 0 || amountReceived < grandTotal) {
      setAmountReceived(grandTotal);
    }
  }, [grandTotal, paymentMethod]);

  const handleCheckout = async () => {
    if (!currentShift || currentShift.status !== 'open') {
      alert('Please open a cashier shift before checking out.');
      return;
    }
    if (cart.length === 0) {
      alert('Cart is empty.');
      return;
    }
    if (paymentMethod === 'cash' && amountReceived < grandTotal) {
      alert('Tendered cash is less than the grand total.');
      return;
    }

    try {
      const payload: ProcessSalePayload = {
        shift_id: currentShift.id,
        payment_method: paymentMethod,
        amount_received: Number(amountReceived),
        discount_amount: Number(overallDiscount),
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_amount: item.discount_amount,
          tax_amount: item.tax_amount * item.quantity
        }))
      };

      const result = await processSale(payload);
      setLastReceipt(result);
      setCart([]);
      setOverallDiscount(0);
      setAmountReceived(0);
    } catch (err: any) {
      alert(err.message || 'Error processing sale');
    }
  };

  const categories = Array.from(new Set(products.map(p => p.category_name).filter(Boolean))) as string[];

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'all' || p.category_name === selectedCategory;
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-4 pb-2 h-auto lg:h-[calc(100vh-6.5rem)]">
      
      {/* Left 60%: Barcode Scanner, Categories & Product Grid */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-hidden min-h-[500px] lg:min-h-0">
        
        {/* Barcode Search Bar */}
        <form onSubmit={handleBarcodeSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Barcode className="w-5 h-5 text-mart-700 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan barcode or type SKU/Name and press Enter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50 font-mono"
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-mart-900 text-white font-semibold text-xs hover:bg-mart-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>
        </form>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-3 no-scrollbar border-b border-slate-100">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-mart-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Products
          </button>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === c
                  ? 'bg-mart-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto pt-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {filteredProducts.map(p => {
            const isOutOfStock = p.current_stock <= 0 && !p.allow_negative_stock;
            return (
              <button
                key={p.id}
                disabled={isOutOfStock}
                onClick={() => addToCart(p)}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  isOutOfStock
                    ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                    : 'border-slate-200 hover:border-mart-700 hover:bg-mart-50/40 hover:shadow-xs cursor-pointer'
                }`}
              >
                <div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">{p.sku}</div>
                  <div className="font-bold text-xs text-slate-900 line-clamp-2 mt-0.5 leading-snug">
                    {p.name}
                  </div>
                </div>

                <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-1 sm:gap-0">
                  <div className="font-extrabold text-sm text-mart-900 font-mono">
                    Rs. {p.selling_price.toLocaleString()}
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full self-start sm:self-auto ${
                      p.current_stock <= 0
                        ? 'bg-rose-100 text-rose-800'
                        : p.current_stock <= p.min_stock_level
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}
                  >
                    {p.current_stock} {p.unit}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

      </div>

      {/* Right 40%: Active Cart & Checkout Terminal */}
      <div className="w-full lg:w-[420px] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-hidden min-h-[500px] lg:min-h-0">
        
        {/* Cart Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="w-5 h-5 text-mart-800" />
            <h2 className="font-bold text-base text-slate-900">Current Order</h2>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-mart-100 text-mart-900">
            {cart.reduce((acc, i) => acc + i.quantity, 0)} Items
          </span>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <ShoppingBag className="w-10 h-10 mb-2 stroke-1 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">Cart is empty</p>
              <p className="text-xs text-slate-400 mt-0.5">Scan a barcode or select products to begin checkout.</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                <div className="flex items-start justify-between">
                  <div className="pr-2">
                    <div className="font-semibold text-xs text-slate-900 line-clamp-1">{item.product.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Rs. {item.unit_price.toLocaleString()} / {item.product.unit}
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded-full cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-full px-1.5 py-0.5">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-5 h-5 flex items-center justify-center hover:bg-slate-100 rounded-full text-slate-600 cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center font-mono font-bold text-xs text-slate-800">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-5 h-5 flex items-center justify-center hover:bg-slate-100 rounded-full text-slate-600 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="font-bold font-mono text-sm text-slate-900">
                    Rs. {(item.quantity * item.unit_price).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Settlement Calculations */}
        <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal:</span>
            <span className="font-mono font-medium text-slate-800">Rs. {subtotal.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between text-slate-500">
            <span>Discount (Rs.):</span>
            <input
              type="number"
              min="0"
              value={overallDiscount}
              onChange={(e) => setOverallDiscount(Number(e.target.value))}
              className="w-20 px-2.5 py-0.5 rounded-full border border-slate-200 font-mono text-center font-medium"
            />
          </div>

          <div className="flex justify-between text-slate-500">
            <span>Sales Tax (GST):</span>
            <span className="font-mono font-medium text-slate-800">Rs. {taxTotal.toLocaleString()}</span>
          </div>

          <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
            <span>Total Payable:</span>
            <span className="font-mono text-mart-900 text-lg">Rs. {grandTotal.toLocaleString()}</span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="pt-3 space-y-2">
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`py-2.5 rounded-full font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                paymentMethod === 'cash'
                  ? 'border-mart-800 bg-mart-50 text-mart-900 ring-2 ring-mart-800/10'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Cash</span>
            </button>
            <button
              onClick={() => setPaymentMethod('card')}
              className={`py-2.5 rounded-full font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                paymentMethod === 'card'
                  ? 'border-mart-800 bg-mart-50 text-mart-900 ring-2 ring-mart-800/10'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Card</span>
            </button>
            <button
              onClick={() => setPaymentMethod('mobile_wallet')}
              className={`py-2.5 rounded-full font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                paymentMethod === 'mobile_wallet'
                  ? 'border-mart-800 bg-mart-50 text-mart-900 ring-2 ring-mart-800/10'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Wallet</span>
            </button>
          </div>

          {/* Cash Tendered & Change */}
          {paymentMethod === 'cash' && (
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Cash Tendered</span>
                <input
                  type="number"
                  min={grandTotal}
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(Number(e.target.value))}
                  className="w-28 px-3 py-1 rounded-full border border-slate-200 font-mono font-bold text-sm bg-white"
                />
              </div>

              <div className="text-right">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Change Due</span>
                <strong className="text-base font-extrabold font-mono text-orange-700">
                  Rs. {changeDue.toLocaleString()}
                </strong>
              </div>
            </div>
          )}

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full py-3.5 rounded-full bg-mart-900 hover:bg-mart-800 text-white font-extrabold text-sm shadow-md transition-all disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
          >
            <ReceiptIcon className="w-4 h-4 text-mart-200" />
            <span>Complete Sale & Print Receipt</span>
          </button>
        </div>

      </div>

      {/* THERMAL RECEIPT MODAL */}
      <Modal
        isOpen={!!lastReceipt}
        onClose={() => setLastReceipt(null)}
        size="sm"
        icon={<ReceiptIcon className="w-5 h-5 text-mart-900" />}
        title="Sale Completed Successfully"
        subtitle="Register 1 • Thermal Receipt"
        bodyClassName="p-5"
      >
        {lastReceipt && (
          <div>
            {/* Printable Thermal Receipt Container */}
            <div id="thermal-receipt" className="font-mono text-xs text-slate-800 bg-white space-y-3">
              <div className="text-center space-y-0.5">
                <div className="text-base font-black tracking-tight text-slate-900">A-MART SUPERMARKET</div>
                <div className="text-[10px] text-slate-500">{lastReceipt.receipt.business_contact}</div>
                <div className="text-[10px] text-slate-400">NTN: 8765432-1 | Branch #01</div>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-0.5 text-[11px]">
                <div className="flex justify-between">
                  <span>Receipt #:</span>
                  <span className="font-bold">{lastReceipt.receipt.receipt_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date(lastReceipt.sale.created_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span>Register 1 (Admin)</span>
                </div>
              </div>

              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-1">Item</th>
                    <th className="py-1 text-center">Qty</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lastReceipt.items.map(item => {
                    const prod = products.find(p => p.id === item.product_id);
                    return (
                      <tr key={item.id}>
                        <td className="py-1 pr-1">
                          <div className="font-semibold">{prod?.name || 'Product'}</div>
                          <div className="text-[9px] text-slate-400">@ Rs. {item.unit_price}</div>
                        </td>
                        <td className="py-1 text-center font-bold">{item.quantity}</td>
                        <td className="py-1 text-right font-bold">Rs. {item.line_total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>Rs. {lastReceipt.sale.subtotal.toLocaleString()}</span>
                </div>
                {lastReceipt.sale.discount_amount > 0 && (
                  <div className="flex justify-between text-orange-700">
                    <span>Discount:</span>
                    <span>-Rs. {lastReceipt.sale.discount_amount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-slate-200">
                  <span>TOTAL PAID:</span>
                  <span>Rs. {lastReceipt.sale.total_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span>Payment Method:</span>
                  <span className="uppercase font-bold">{lastReceipt.sale.payment_method}</span>
                </div>
                {lastReceipt.change > 0 && (
                  <div className="flex justify-between text-orange-800 font-bold">
                    <span>Change Returned:</span>
                    <span>Rs. {lastReceipt.change.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="text-center pt-3 border-t border-dashed border-slate-300 space-y-1">
                <p className="text-[10px] text-slate-500 italic">
                  {lastReceipt.receipt.footer_message}
                </p>
                <div className="text-[9px] text-slate-400 font-sans">
                  Returns accepted within 3 days with original receipt.
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setLastReceipt(null)}
                className="flex-1 py-2.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all"
              >
                Done / Next Sale
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-full bg-mart-900 text-white text-xs font-semibold hover:bg-mart-800 flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm hover:shadow-mart"
              >
                <Printer className="w-4 h-4 text-mart-200" />
                <span>Print Thermal Receipt</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};
