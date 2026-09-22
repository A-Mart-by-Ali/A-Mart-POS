import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Package,
  Layers,
  Calendar,
  Lock,
  RotateCw,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  ArrowUpRight,
  Receipt,
  FileText,
  Plus,
  Zap,
  Building,
  Wrench,
  Truck,
  Briefcase,
  AlertCircle,
  HelpCircle,
  TrendingDown
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import {
  getSalesAnalytics,
  AnalyticsSummary,
  lockAnalytics,
  getAnalyticsSecurityKey,
  setAnalyticsSecurityKey,
  getExpenseCategories,
  createExpense,
  ExpenseCategory,
  StoreExpense
} from '../services/analyticsService';
import { PaymentMethod } from '../types/database';

interface SalesAnalyticsViewProps {
  onLock: () => void;
}

export const SalesAnalyticsView: React.FC<SalesAnalyticsViewProps> = ({ onLock }) => {
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'sales' | 'expenses'>('sales');
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Key change modal
  const [isKeyChangeOpen, setIsKeyChangeOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [keySuccess, setKeySuccess] = useState(false);
  const [keyError, setKeyError] = useState('');

  // Add Expense Modal
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category_id: '',
    description: '',
    amount: '',
    payment_method: 'cash' as PaymentMethod,
    expense_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, cats] = await Promise.all([
        getSalesAnalytics(timeframe),
        getExpenseCategories()
      ]);
      setAnalytics(data);
      setCategories(cats);
      if (cats.length > 0 && !expenseForm.category_id) {
        setExpenseForm(prev => ({ ...prev, category_id: cats[0].id }));
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [timeframe]);

  const handleLockNow = () => {
    lockAnalytics();
    onLock();
  };

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    setKeyError('');
    try {
      setAnalyticsSecurityKey(newKey);
      setKeySuccess(true);
      setTimeout(() => {
        setKeySuccess(false);
        setIsKeyChangeOpen(false);
        setNewKey('');
      }, 1500);
    } catch (err: any) {
      setKeyError(err.message || 'Failed to update key');
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.description.trim() || !expenseForm.amount) return;

    setSubmittingExpense(true);
    try {
      await createExpense({
        category_id: expenseForm.category_id,
        description: expenseForm.description.trim(),
        amount: parseFloat(expenseForm.amount),
        payment_method: expenseForm.payment_method,
        expense_date: expenseForm.expense_date,
        notes: expenseForm.notes.trim()
      });

      setIsAddExpenseOpen(false);
      setExpenseForm({
        category_id: categories[0]?.id || '',
        description: '',
        amount: '',
        payment_method: 'cash',
        expense_date: new Date().toISOString().split('T')[0],
        notes: ''
      });

      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to record expense.');
    } finally {
      setSubmittingExpense(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Sales, Expenses & Profit Analytics
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-950 border border-orange-200 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-orange-600" />
              <span>Verified Session</span>
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Comprehensive store P&L: revenue, wholesale COGS, utility bills, operational expenses, and net profit
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Timeframe selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-full">
            {(['today', 'week', 'month', 'all'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-all cursor-pointer ${
                  timeframe === t
                    ? 'bg-white text-mart-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t === 'today' ? 'Today' : t === 'week' ? '7 Days' : t === 'month' ? '30 Days' : 'All Time'}
              </button>
            ))}
          </div>

          {/* Record Expense Button */}
          <button
            onClick={() => setIsAddExpenseOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-amber-50 border border-amber-300/70 text-amber-900 hover:bg-amber-100 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-amber-700" />
            <span>+ Log Bill / Expense</span>
          </button>

          {/* Refresh */}
          <button
            onClick={loadData}
            title="Refresh Data"
            className="p-2.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all cursor-pointer shadow-2xs"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-mart-800' : ''}`} />
          </button>

          {/* Key Settings Button */}
          <button
            onClick={() => setIsKeyChangeOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
            title="Change Security Key"
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline">Change Key</span>
          </button>

          {/* Lock Analytics Button */}
          <button
            onClick={handleLockNow}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-mart-900 hover:bg-mart-800 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
            title="Lock Analytics View"
          >
            <Lock className="w-3.5 h-3.5 text-mart-200" />
            <span>Lock View</span>
          </button>

        </div>
      </div>

      {/* 5 High-Level Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        
        {/* Gross Revenue */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Gross Sales
            </span>
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-800 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-xl font-extrabold text-slate-900 font-mono">
              Rs. {analytics?.totalRevenue.toLocaleString() || '0'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {analytics?.totalOrders || 0} checkouts
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-500"></div>
        </div>

        {/* Cost of Goods Sold (COGS) */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Cost of Goods (COGS)
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-xl font-extrabold text-slate-800 font-mono">
              Rs. {analytics?.totalCOGS.toLocaleString() || '0'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {analytics?.itemsSold || 0} items sold
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-400"></div>
        </div>

        {/* Gross Profit */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Gross Profit
            </span>
            <span className="text-[10px] font-bold text-orange-800 bg-orange-100 px-1.5 py-0.2 rounded font-sans">
              {analytics?.profitMarginPercent || 0}%
            </span>
          </div>
          <div className="mt-1.5">
            <div className="text-xl font-extrabold text-orange-900 font-mono">
              Rs. {analytics?.grossProfit.toLocaleString() || '0'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Sales minus wholesale cost
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500"></div>
        </div>

        {/* Store Expenses & Bills */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Bills & Expenses
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-xl font-extrabold text-amber-900 font-mono">
              Rs. {analytics?.totalExpenses.toLocaleString() || '0'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {analytics?.expenses.length || 0} expense entries
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500"></div>
        </div>

        {/* Net Profit */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Net Profit
            </span>
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-800 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className={`text-xl font-extrabold font-mono ${
              (analytics?.netProfit || 0) >= 0 ? 'text-orange-950' : 'text-rose-700'
            }`}>
              Rs. {analytics?.netProfit.toLocaleString() || '0'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-between">
              <span>Gross Profit - Expenses</span>
              <span className={`font-bold ${
                (analytics?.netProfit || 0) >= 0 ? 'text-orange-700' : 'text-rose-600'
              }`}>
                {analytics?.netProfitMarginPercent || 0}%
              </span>
            </div>
          </div>
          <div className={`absolute bottom-0 left-0 right-0 h-1 ${
            (analytics?.netProfit || 0) >= 0 ? 'bg-orange-600' : 'bg-rose-500'
          }`}></div>
        </div>

      </div>

      {/* Tabs Navigation: Sales vs Operating Expenses */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-5 py-2 rounded-full transition-all cursor-pointer flex items-center space-x-2 ${
            activeTab === 'sales'
              ? 'bg-mart-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Sales & Revenue Trends</span>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-5 py-2 rounded-full transition-all cursor-pointer flex items-center space-x-2 ${
            activeTab === 'expenses'
              ? 'bg-mart-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Bills & Operating Expenses ({analytics?.expenses.length || 0})</span>
        </button>
      </div>

      {/* TAB 1: SALES & REVENUE */}
      {activeTab === 'sales' && (
        <div className="space-y-5 animate-fade-in">
          
          {/* Middle Grid: Daily Timeline + Payment Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            
            {/* Daily Sales Trend Timeline (2 Cols) */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-mart-800" />
                  <h2 className="font-bold text-sm text-slate-900">Daily Sales & Gross Profit Timeline</h2>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {analytics?.dailyTrends.length || 0} days recorded
                </span>
              </div>

              {analytics?.dailyTrends && analytics.dailyTrends.length > 0 ? (
                <div className="space-y-3">
                  {analytics.dailyTrends.map((d) => {
                    const maxRevenue = Math.max(...analytics.dailyTrends.map(x => x.revenue), 1);
                    const pct = Math.min(100, Math.round((d.revenue / maxRevenue) * 100));
                    return (
                      <div key={d.date} className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-700 font-medium">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900">{d.label}</span>
                            <span className="text-[10px] text-slate-400">({d.orders} checkouts)</span>
                          </div>
                          <div className="flex items-center space-x-3 font-mono">
                            <span className="text-slate-500">Gross Profit: Rs. {d.profit.toLocaleString()}</span>
                            <span className="font-bold text-slate-900">Rs. {d.revenue.toLocaleString()}</span>
                          </div>
                        </div>
                        {/* Visual Bar */}
                        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-500 to-mart-900 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center text-slate-400 text-xs">
                  No sales transactions in the selected period.
                </div>
              )}
            </div>

            {/* Payment Methods Breakdown (1 Col) */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <CreditCard className="w-4 h-4 text-mart-800" />
                <h2 className="font-bold text-sm text-slate-900">Payment Breakdown</h2>
              </div>

              <div className="space-y-3.5 text-xs">
                {/* Cash */}
                {(() => {
                  const cash = analytics?.paymentBreakdown.cash || { count: 0, total: 0 };
                  const total = analytics?.totalRevenue || 1;
                  const pct = Math.round((cash.total / total) * 100) || 0;
                  return (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 font-bold text-slate-900">
                          <Banknote className="w-4 h-4 text-orange-600" />
                          <span>Cash</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900">Rs. {cash.total.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full bg-orange-600 rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{cash.count} checkouts</span>
                        <span className="font-semibold">{pct}% share</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Card */}
                {(() => {
                  const card = analytics?.paymentBreakdown.card || { count: 0, total: 0 };
                  const total = analytics?.totalRevenue || 1;
                  const pct = Math.round((card.total / total) * 100) || 0;
                  return (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 font-bold text-slate-900">
                          <CreditCard className="w-4 h-4 text-blue-600" />
                          <span>Credit / Debit Card</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900">Rs. {card.total.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{card.count} checkouts</span>
                        <span className="font-semibold">{pct}% share</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Mobile Wallet */}
                {(() => {
                  const wallet = analytics?.paymentBreakdown.mobile_wallet || { count: 0, total: 0 };
                  const total = analytics?.totalRevenue || 1;
                  const pct = Math.round((wallet.total / total) * 100) || 0;
                  return (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 font-bold text-slate-900">
                          <Smartphone className="w-4 h-4 text-purple-600" />
                          <span>Mobile Wallet / QR</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900">Rs. {wallet.total.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full bg-purple-600 rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{wallet.count} checkouts</span>
                        <span className="font-semibold">{pct}% share</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

          </div>

          {/* Top Selling Products */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Package className="w-4 h-4 text-mart-800" />
                <h2 className="font-bold text-sm text-slate-900">Top Performing Products</h2>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Ranked by revenue</span>
            </div>

            {analytics?.topProducts && analytics.topProducts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Product Name & SKU</th>
                      <th className="py-2.5 px-3 text-center">Units Sold</th>
                      <th className="py-2.5 px-3 text-right">Total Revenue</th>
                      <th className="py-2.5 px-3 text-right">Revenue Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {analytics.topProducts.map((p) => {
                      const share = analytics.totalRevenue > 0
                        ? Math.round((p.revenue / analytics.totalRevenue) * 100)
                        : 0;
                      return (
                        <tr key={p.productId} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{p.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                            {p.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            Rs. {p.revenue.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800">
                              {share}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs">
                No item sales recorded yet.
              </div>
            )}
          </div>

          {/* Completed Transactions Log */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Receipt className="w-4 h-4 text-mart-800" />
                <h2 className="font-bold text-sm text-slate-900">Recent Completed Transactions</h2>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                {analytics?.transactions.length || 0} sales total
              </span>
            </div>

            {analytics?.transactions && analytics.transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">Receipt #</th>
                      <th className="py-3 px-3">Date & Time</th>
                      <th className="py-3 px-3">Cashier</th>
                      <th className="py-3 px-3 text-center">Items</th>
                      <th className="py-3 px-3">Payment Method</th>
                      <th className="py-3 px-3 text-right">Total Amount</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {analytics.transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {t.receipt_number}
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {new Date(t.created_at).toLocaleString([], {
                             month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          {t.cashier?.full_name || 'Staff'}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-700">
                          {t.sale_items?.length || 1}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                            {t.payment_method}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900">
                          Rs. {Number(t.total_amount).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-orange-100 text-orange-800">
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                No sales completed yet.
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 2: STORE EXPENSES & BILLS */}
      {activeTab === 'expenses' && (
        <div className="space-y-5 animate-fade-in">
          
          {/* Category Breakdown Cards */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-amber-600" />
                <h2 className="font-bold text-sm text-slate-900">Operating Expenses by Category</h2>
              </div>
              <button
                onClick={() => setIsAddExpenseOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-mart-900 text-white font-bold text-xs flex items-center space-x-1.5 hover:bg-mart-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-mart-200" />
                <span>Add Expense</span>
              </button>
            </div>

            {analytics?.expensesByCategory && analytics.expensesByCategory.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {analytics.expensesByCategory.map((c) => (
                  <div key={c.category} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">{c.category}</span>
                      <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                        {c.percentage}%
                      </span>
                    </div>
                    <div className="text-base font-extrabold text-slate-900 font-mono">
                      Rs. {c.total.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {c.count} recorded {c.count === 1 ? 'bill' : 'bills'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs">
                No expense categories recorded.
              </div>
            )}
          </div>

          {/* Expenses & Bills Table */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-mart-800" />
                <h2 className="font-bold text-sm text-slate-900">Logged Store Bills & Expense Receipts</h2>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Total: Rs. {analytics?.totalExpenses.toLocaleString() || '0'}
              </span>
            </div>

            {analytics?.expenses && analytics.expenses.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">Description</th>
                      <th className="py-3 px-3">Payment Method</th>
                      <th className="py-3 px-3 text-right">Amount</th>
                      <th className="py-3 px-3">Notes & Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {analytics.expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                          {exp.expense_date}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                            {exp.category?.name || 'General'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {exp.description}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                            {exp.payment_method}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-extrabold text-amber-900">
                          Rs. {Number(exp.amount).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[11px]">
                          {exp.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                No bills or expenses logged for this period.
              </div>
            )}
          </div>

        </div>
      )}

      {/* LOG EXPENSE MODAL */}
      <Modal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        size="lg"
        icon={<FileText className="w-5 h-5 text-mart-900" />}
        title="Record Store Bill / Operational Expense"
        subtitle="Deducts from store Net Profit in P&L reporting"
      >
        <form onSubmit={handleCreateExpense} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Expense Category *</label>
              <select
                required
                value={expenseForm.category_id}
                onChange={(e) => setExpenseForm({ ...expenseForm, category_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-full border border-slate-200 font-medium bg-slate-50/50 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Payment Method *</label>
              <select
                required
                value={expenseForm.payment_method}
                onChange={(e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value as PaymentMethod })}
                className="w-full px-4 py-2.5 rounded-full border border-slate-200 font-medium bg-slate-50/50 text-sm"
              >
                <option value="cash">Cash in Drawer</option>
                <option value="bank_transfer">Bank Transfer / Online</option>
                <option value="card">Company Debit Card</option>
                <option value="mobile_wallet">Mobile Wallet / EasyPaisa / JazzCash</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Expense Description *</label>
            <input
              type="text"
              required
              placeholder="e.g. October Electricity Bill, Store Rent, Receipt Paper Rolls"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-full border border-slate-200 bg-slate-50/50 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Amount (Rs.) *</label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                placeholder="0.00"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                className="w-full px-4 py-2.5 rounded-full border border-slate-200 font-mono font-bold bg-slate-50/50 text-sm"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Expense Date *</label>
              <input
                type="date"
                required
                value={expenseForm.expense_date}
                onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-full border border-slate-200 font-mono bg-slate-50/50 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Notes / Bank Reference / Slip #</label>
            <input
              type="text"
              placeholder="Optional reference number or invoice note"
              value={expenseForm.notes}
              onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
              className="w-full px-4 py-2.5 rounded-full border border-slate-200 bg-slate-50/50 text-sm"
            />
          </div>

          <div className="flex space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddExpenseOpen(false)}
              className="flex-1 py-2.5 rounded-full border border-slate-200 text-slate-600 font-semibold cursor-pointer hover:bg-slate-50 transition-all text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingExpense}
              className="flex-1 py-2.5 rounded-full bg-mart-900 hover:bg-mart-800 text-white font-bold cursor-pointer disabled:opacity-50 transition-all shadow-sm text-xs hover:shadow-mart"
            >
              {submittingExpense ? 'Recording...' : 'Save Expense to Directory'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CHANGE SECURITY KEY MODAL */}
      <Modal
        isOpen={isKeyChangeOpen}
        onClose={() => setIsKeyChangeOpen(false)}
        size="sm"
        icon={<KeyRound className="w-5 h-5 text-mart-900" />}
        title="Update Analytics Key"
        subtitle="Change manager authorization security PIN"
      >
        {keySuccess ? (
          <div className="p-3.5 rounded-2xl bg-orange-50 border border-orange-200 text-orange-900 text-xs font-semibold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0" />
            <span>Security key updated successfully!</span>
          </div>
        ) : (
          <form onSubmit={handleSaveKey} className="space-y-4 text-xs">
            {keyError && (
              <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {keyError}
              </div>
            )}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                New Access Key (Min 4 digits) *
              </label>
              <input
                type="password"
                required
                placeholder="Enter new PIN"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="w-full px-4 py-2.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 font-mono text-center font-bold bg-slate-50/50 text-sm"
              />
            </div>
            <div className="flex space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsKeyChangeOpen(false)}
                className="flex-1 py-2.5 rounded-full border border-slate-200 text-slate-600 font-semibold cursor-pointer hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-full bg-mart-900 text-white font-bold hover:bg-mart-800 cursor-pointer transition-all shadow-sm hover:shadow-mart"
              >
                Save Key
              </button>
            </div>
          </form>
        )}
      </Modal>

    </div>
  );
};
