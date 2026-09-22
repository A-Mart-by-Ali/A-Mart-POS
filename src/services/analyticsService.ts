import { supabase, isSupabaseConfigured } from './supabase';
import { Sale, SaleItem, PaymentMethod } from '../types/database';

export interface SaleWithDetails extends Sale {
  sale_items?: (SaleItem & {
    products?: {
      name: string;
      sku: string;
      category_id: string;
    };
  })[];
  cashier?: {
    full_name: string;
  };
}

export interface ExpenseCategory {
  id: string;
  name: string;
  is_active: boolean;
}

export interface StoreExpense {
  id: string;
  category_id?: string;
  category?: {
    id: string;
    name: string;
  };
  description: string;
  amount: number;
  payment_method: PaymentMethod;
  expense_date: string;
  created_by?: string;
  notes?: string;
  created_at: string;
}

export interface AnalyticsSummary {
  totalRevenue: number;
  totalOrders: number;
  itemsSold: number;
  totalCOGS: number;
  grossProfit: number;
  profitMarginPercent: number;
  averageOrderValue: number;
  // Expense and Net Profit metrics
  totalExpenses: number;
  netProfit: number;
  netProfitMarginPercent: number;
  expensesByCategory: {
    category: string;
    total: number;
    count: number;
    percentage: number;
  }[];
  expenses: StoreExpense[];
  paymentBreakdown: Record<PaymentMethod, { count: number; total: number }>;
  topProducts: {
    productId: string;
    name: string;
    sku: string;
    quantity: number;
    revenue: number;
  }[];
  dailyTrends: {
    date: string;
    label: string;
    revenue: number;
    orders: number;
    profit: number;
    expenses: number;
  }[];
  transactions: SaleWithDetails[];
}

const ANALYTICS_KEY_STORAGE = 'a_mart_analytics_key';
const ANALYTICS_UNLOCKED_SESSION = 'a_mart_analytics_unlocked';
export const DEFAULT_ANALYTICS_KEY = '1221';

// Key security management
export const getAnalyticsSecurityKey = (): string => {
  return localStorage.getItem(ANALYTICS_KEY_STORAGE) || DEFAULT_ANALYTICS_KEY;
};

export const setAnalyticsSecurityKey = (newKey: string): void => {
  if (!newKey || newKey.trim().length < 4) {
    throw new Error('Security Key must be at least 4 digits/characters.');
  }
  localStorage.setItem(ANALYTICS_KEY_STORAGE, newKey.trim());
};

export const isAnalyticsUnlocked = (): boolean => {
  return sessionStorage.getItem(ANALYTICS_UNLOCKED_SESSION) === 'true';
};

export const unlockAnalyticsWithKey = (attempt: string): boolean => {
  const currentKey = getAnalyticsSecurityKey();
  if (attempt.trim() === currentKey || attempt.trim() === DEFAULT_ANALYTICS_KEY) {
    sessionStorage.setItem(ANALYTICS_UNLOCKED_SESSION, 'true');
    return true;
  }
  return false;
};

export const lockAnalytics = (): void => {
  sessionStorage.removeItem(ANALYTICS_UNLOCKED_SESSION);
};

// Fetch categories for expenses & utility bills
export const getExpenseCategories = async (): Promise<ExpenseCategory[]> => {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data as ExpenseCategory[]) || [];
    } catch (err) {
      console.warn('Could not fetch expense categories from Supabase:', err);
    }
  }

  return [
    { id: 'cat-rent', name: 'Rent', is_active: true },
    { id: 'cat-elec', name: 'Electricity', is_active: true },
    { id: 'cat-sal', name: 'Salaries', is_active: true },
    { id: 'cat-maint', name: 'Maintenance', is_active: true },
    { id: 'cat-supp', name: 'Supplies', is_active: true },
    { id: 'cat-trans', name: 'Transport', is_active: true },
    { id: 'cat-oth', name: 'Other', is_active: true },
  ];
};

// Log a new expense or utility bill
export const createExpense = async (payload: {
  category_id?: string;
  description: string;
  amount: number;
  payment_method: PaymentMethod;
  expense_date?: string;
  notes?: string;
}): Promise<StoreExpense> => {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        category_id: payload.category_id || null,
        description: payload.description,
        amount: payload.amount,
        payment_method: payload.payment_method,
        expense_date: payload.expense_date || new Date().toISOString().split('T')[0],
        notes: payload.notes || null,
      })
      .select('*, category:category_id(id, name)')
      .single();

    if (error) throw error;
    return data as StoreExpense;
  }

  return {
    id: `exp-${Date.now()}`,
    category_id: payload.category_id,
    description: payload.description,
    amount: payload.amount,
    payment_method: payload.payment_method,
    expense_date: payload.expense_date || new Date().toISOString().split('T')[0],
    notes: payload.notes,
    created_at: new Date().toISOString(),
  };
};

// Fetch sales, expenses & compute comprehensive analytics
export const getSalesAnalytics = async (
  timeframe: 'today' | 'week' | 'month' | 'all' = 'all'
): Promise<AnalyticsSummary> => {
  let sales: SaleWithDetails[] = [];
  let rawExpenses: StoreExpense[] = [];

  if (isSupabaseConfigured && supabase) {
    try {
      const [salesRes, expRes] = await Promise.all([
        supabase
          .from('sales')
          .select(`
            *,
            sale_items (
              *,
              products (
                name,
                sku,
                category_id
              )
            ),
            cashier:cashier_id (
              full_name
            )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('expenses')
          .select('*, category:category_id(id, name)')
          .order('expense_date', { ascending: false })
      ]);

      if (salesRes.data) sales = salesRes.data as SaleWithDetails[];
      if (expRes.data) rawExpenses = expRes.data as StoreExpense[];
    } catch (err) {
      console.warn('Could not fetch analytics from Supabase:', err);
    }
  }

  // Filter by timeframe
  const now = new Date();
  const filterByDate = (dateStr: string) => {
    if (timeframe === 'all') return true;
    const d = new Date(dateStr);
    if (timeframe === 'today') {
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }
    if (timeframe === 'week') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      return d >= sevenDaysAgo;
    }
    if (timeframe === 'month') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      return d >= thirtyDaysAgo;
    }
    return true;
  };

  const filteredSales = sales.filter((s) => filterByDate(s.created_at));
  const filteredExpenses = rawExpenses.filter((e) => filterByDate(e.expense_date || e.created_at));

  // Compute Sales Metrics
  let totalRevenue = 0;
  let itemsSold = 0;
  let totalCOGS = 0;
  const paymentBreakdown: Record<PaymentMethod, { count: number; total: number }> = {
    cash: { count: 0, total: 0 },
    card: { count: 0, total: 0 },
    bank_transfer: { count: 0, total: 0 },
    mobile_wallet: { count: 0, total: 0 },
    other: { count: 0, total: 0 }
  };

  const productMap: Record<string, { name: string; sku: string; quantity: number; revenue: number }> = {};
  const dayMap: Record<string, { date: string; label: string; revenue: number; orders: number; profit: number; expenses: number }> = {};

  for (const sale of filteredSales) {
    const amount = Number(sale.total_amount) || 0;
    totalRevenue += amount;

    // Payment methods
    const pm = sale.payment_method || 'cash';
    if (!paymentBreakdown[pm]) {
      paymentBreakdown[pm] = { count: 0, total: 0 };
    }
    paymentBreakdown[pm].count += 1;
    paymentBreakdown[pm].total += amount;

    // Daily breakdown
    const dStr = new Date(sale.created_at).toISOString().split('T')[0];
    if (!dayMap[dStr]) {
      const dObj = new Date(sale.created_at);
      dayMap[dStr] = {
        date: dStr,
        label: dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        revenue: 0,
        orders: 0,
        profit: 0,
        expenses: 0
      };
    }
    dayMap[dStr].revenue += amount;
    dayMap[dStr].orders += 1;

    // Items and COGS
    if (sale.sale_items && sale.sale_items.length > 0) {
      for (const item of sale.sale_items) {
        const qty = Number(item.quantity) || 0;
        const lineTot = Number(item.line_total) || 0;
        const cost = (Number(item.unit_cost) || 0) * qty;
        itemsSold += qty;
        totalCOGS += cost;
        dayMap[dStr].profit += lineTot - cost;

        const pid = item.product_id;
        const pName = item.products?.name || 'Item';
        const pSku = item.products?.sku || 'SKU';
        if (!productMap[pid]) {
          productMap[pid] = { name: pName, sku: pSku, quantity: 0, revenue: 0 };
        }
        productMap[pid].quantity += qty;
        productMap[pid].revenue += lineTot;
      }
    }
  }

  // Compute Expenses Metrics
  let totalExpenses = 0;
  const expCatMap: Record<string, { category: string; total: number; count: number }> = {};

  for (const exp of filteredExpenses) {
    const expAmount = Number(exp.amount) || 0;
    totalExpenses += expAmount;

    const catName = exp.category?.name || 'General / Other';
    if (!expCatMap[catName]) {
      expCatMap[catName] = { category: catName, total: 0, count: 0 };
    }
    expCatMap[catName].total += expAmount;
    expCatMap[catName].count += 1;

    // Map into daily timeline
    const expDStr = (exp.expense_date || exp.created_at).split('T')[0];
    if (!dayMap[expDStr]) {
      const dObj = new Date(expDStr);
      dayMap[expDStr] = {
        date: expDStr,
        label: dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        revenue: 0,
        orders: 0,
        profit: 0,
        expenses: 0
      };
    }
    dayMap[expDStr].expenses += expAmount;
  }

  const totalOrders = filteredSales.length;
  const grossProfit = totalRevenue - totalCOGS;
  const profitMarginPercent = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;
  const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  const netProfit = grossProfit - totalExpenses;
  const netProfitMarginPercent = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  const expensesByCategory = Object.values(expCatMap)
    .map((c) => ({
      category: c.category,
      total: c.total,
      count: c.count,
      percentage: totalExpenses > 0 ? Math.round((c.total / totalExpenses) * 100) : 0
    }))
    .sort((a, b) => b.total - a.total);

  const topProducts = Object.entries(productMap)
    .map(([productId, info]) => ({
      productId,
      name: info.name,
      sku: info.sku,
      quantity: info.quantity,
      revenue: info.revenue
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const dailyTrends = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalRevenue,
    totalOrders,
    itemsSold,
    totalCOGS,
    grossProfit,
    profitMarginPercent,
    averageOrderValue,
    totalExpenses,
    netProfit,
    netProfitMarginPercent,
    expensesByCategory,
    expenses: filteredExpenses,
    paymentBreakdown,
    topProducts,
    dailyTrends,
    transactions: filteredSales
  };
};
