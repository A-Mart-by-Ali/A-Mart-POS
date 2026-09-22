import { supabase, isSupabaseConfigured } from './supabase';
import {
  Product,
  Category,
  Supplier,
  Location,
  Inventory,
  InventoryTransaction,
  AdjustmentType,
  Purchase,
  PurchaseItem,
  StockAdjustment
} from '../types/database';
import {
  INITIAL_CATEGORIES,
  INITIAL_SUPPLIERS,
  INITIAL_LOCATION,
  INITIAL_PRODUCTS,
  INITIAL_INVENTORY,
  INITIAL_TRANSACTIONS
} from './mockData';

// Local reactive storage for standalone/offline mode
let mockProducts: Product[] = [...INITIAL_PRODUCTS];
let mockCategories: Category[] = [...INITIAL_CATEGORIES];
let mockSuppliers: Supplier[] = [...INITIAL_SUPPLIERS];
let mockInventory: Record<string, Inventory> = { ...INITIAL_INVENTORY };
let mockTransactions: InventoryTransaction[] = [...INITIAL_TRANSACTIONS];
let mockPurchases: Purchase[] = [];

// Event listeners for state reactivity
type Listener = () => void;
const listeners: Set<Listener> = new Set();
const notifyListeners = () => listeners.forEach(l => l());

export const subscribeInventoryChanges = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export interface ProductWithStock extends Product {
  current_stock: number;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  category_name?: string;
  supplier_name?: string;
}

export const getLocations = async (): Promise<Location[]> => {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.from('locations').select('*').eq('is_active', true);
    return data || [];
  }
  return [INITIAL_LOCATION];
};

export const getCategories = async (): Promise<Category[]> => {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.from('categories').select('*').eq('is_active', true).order('name');
    return data || [];
  }
  return mockCategories;
};

export const getSuppliers = async (): Promise<Supplier[]> => {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.from('suppliers').select('*').order('name');
    return data || [];
  }
  return mockSuppliers;
};

export const addSupplier = async (supplierData: Omit<Supplier, 'id'>): Promise<Supplier> => {
  const newId = `sup-${Date.now().toString(36)}`;
  const openingBal = Number(supplierData.opening_balance || 0);
  const currentBal = Number(supplierData.current_balance !== undefined ? supplierData.current_balance : openingBal);

  const newSupplier: Supplier = {
    ...supplierData,
    id: newId,
    opening_balance: openingBal,
    current_balance: currentBal,
    status: supplierData.status || 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('suppliers').insert([{
      name: supplierData.name,
      phone: supplierData.phone || null,
      email: supplierData.email || null,
      address: supplierData.address || null,
      contact_person: supplierData.contact_person || null,
      payment_terms: supplierData.payment_terms || null,
      opening_balance: openingBal,
      current_balance: currentBal,
      status: supplierData.status || 'active',
      notes: supplierData.notes || null
    }]).select().single();

    if (error) throw error;
    notifyListeners();
    return data;
  }

  mockSuppliers.unshift(newSupplier);
  notifyListeners();
  return newSupplier;
};

export const updateSupplier = async (id: string, updates: Partial<Supplier>): Promise<Supplier> => {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('suppliers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    notifyListeners();
    return data;
  }

  mockSuppliers = mockSuppliers.map(s => (s.id === id ? { ...s, ...updates, updated_at: new Date().toISOString() } : s));
  notifyListeners();
  const updated = mockSuppliers.find(s => s.id === id);
  if (!updated) throw new Error('Supplier not found');
  return updated;
};

export const getProductsWithStock = async (): Promise<ProductWithStock[]> => {
  if (isSupabaseConfigured && supabase) {
    const { data: prods } = await supabase.from('products').select('*, categories(name), suppliers(name)');
    const { data: invs } = await supabase.from('inventory').select('*');

    const invMap = new Map<string, number>();
    invs?.forEach(i => invMap.set(i.product_id, (invMap.get(i.product_id) || 0) + Number(i.quantity)));

    return (prods || []).map((p: any) => {
      const stock = invMap.get(p.id) || 0;
      let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
      if (stock <= 0) status = 'out_of_stock';
      else if (stock <= p.min_stock_level) status = 'low_stock';

      return {
        ...p,
        current_stock: stock,
        stock_status: status,
        category_name: p.categories?.name,
        supplier_name: p.suppliers?.name
      };
    });
  }

  // Standalone / Mock Engine
  const catMap = new Map(mockCategories.map(c => [c.id, c.name]));
  const supMap = new Map(mockSuppliers.map(s => [s.id, s.name]));

  return mockProducts.map(p => {
    const inv = mockInventory[p.id];
    const stock = inv ? inv.quantity : 0;
    let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
    if (stock <= 0) status = 'out_of_stock';
    else if (stock <= p.min_stock_level) status = 'low_stock';

    return {
      ...p,
      current_stock: stock,
      stock_status: status,
      category_name: p.category_id ? catMap.get(p.category_id) : undefined,
      supplier_name: p.supplier_id ? supMap.get(p.supplier_id) : undefined
    };
  });
};

export const addProduct = async (productData: Omit<Product, 'id'>): Promise<Product> => {
  const newId = `prod-${Date.now().toString(36)}`;
  const newProduct: Product = {
    ...productData,
    id: newId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('products').insert([productData]).select().single();
    if (error) throw error;

    const { data: loc } = await supabase.from('locations').select('id').eq('is_default', true).single();
    if (loc && data?.id) {
      await supabase.from('inventory').insert([{
        product_id: data.id,
        location_id: loc.id,
        quantity: 0
      }]);
    }

    notifyListeners();
    return data;
  }

  mockProducts.unshift(newProduct);
  mockInventory[newId] = {
    id: `inv-${Date.now().toString(36)}`,
    product_id: newId,
    location_id: INITIAL_LOCATION.id,
    quantity: 0,
    reserved_quantity: 0,
    updated_at: new Date().toISOString()
  };

  notifyListeners();
  return newProduct;
};

export const updateProduct = async (id: string, updates: Partial<Product>): Promise<Product> => {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
    if (error) throw error;
    notifyListeners();
    return data;
  }

  const idx = mockProducts.findIndex(p => p.id === id);
  if (idx === -1) throw new Error('Product not found');
  mockProducts[idx] = { ...mockProducts[idx], ...updates, updated_at: new Date().toISOString() };
  notifyListeners();
  return mockProducts[idx];
};

// RPC 24.6 adjust_stock
export const adjustStock = async (payload: {
  type: AdjustmentType;
  reason: string;
  items: { product_id: string; quantity_change: number }[];
}): Promise<StockAdjustment> => {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('adjust_stock', { p_payload: payload });
    if (error) throw error;
    notifyListeners();
    return data;
  }

  // Mock RPC adjustment logic
  const adjNumber = `ADJ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const adjustment: StockAdjustment = {
    id: `adj-${Date.now()}`,
    adjustment_number: adjNumber,
    type: payload.type,
    reason: payload.reason,
    status: 'approved',
    created_at: new Date().toISOString(),
    approved_at: new Date().toISOString()
  };

  for (const item of payload.items) {
    const product = mockProducts.find(p => p.id === item.product_id);
    if (!product) throw new Error(`Product ${item.product_id} not found`);

    const inv = mockInventory[item.product_id] || {
      id: `inv-${Date.now()}`,
      product_id: item.product_id,
      location_id: INITIAL_LOCATION.id,
      quantity: 0,
      reserved_quantity: 0,
      updated_at: new Date().toISOString()
    };

    const newQty = inv.quantity + item.quantity_change;
    if (newQty < 0 && !product.allow_negative_stock) {
      throw new Error(`Insufficient stock for ${product.name}. Current: ${inv.quantity}, Adjustment: ${item.quantity_change}`);
    }

    const prevQty = inv.quantity;
    inv.quantity = newQty;
    inv.updated_at = new Date().toISOString();
    mockInventory[item.product_id] = inv;

    mockTransactions.unshift({
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      product_id: item.product_id,
      location_id: INITIAL_LOCATION.id,
      transaction_type: payload.type === 'stock_count' ? 'stock_count_adjustment' : payload.type === 'manual' ? 'manual_adjustment' : payload.type,
      quantity: item.quantity_change,
      previous_quantity: prevQty,
      new_quantity: newQty,
      unit_cost: product.cost_price,
      related_adjustment_id: adjustment.id,
      reason: payload.reason,
      created_at: new Date().toISOString()
    });
  }

  notifyListeners();
  return adjustment;
};

// RPC 24.4 receive_stock
export const receiveStock = async (payload: {
  supplier_id: string;
  reference_number?: string;
  paid_amount: number;
  items: { product_id: string; quantity: number; unit_cost: number; tax_amount: number }[];
}): Promise<Purchase> => {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('receive_stock', { p_payload: payload });
    if (error) throw error;
    notifyListeners();
    return data;
  }

  let subtotal = 0;
  let totalTax = 0;
  payload.items.forEach(i => {
    subtotal += i.quantity * i.unit_cost;
    totalTax += i.tax_amount || 0;
  });
  const totalAmount = subtotal + totalTax;

  const poNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const purchase: Purchase = {
    id: `po-${Date.now()}`,
    purchase_number: poNumber,
    supplier_id: payload.supplier_id,
    purchase_date: new Date().toISOString().slice(0, 10),
    reference_number: payload.reference_number,
    subtotal,
    tax_amount: totalTax,
    total_amount: totalAmount,
    paid_amount: payload.paid_amount,
    remaining_amount: totalAmount - payload.paid_amount,
    payment_status: payload.paid_amount >= totalAmount ? 'paid' : payload.paid_amount > 0 ? 'partial' : 'pending',
    status: 'received',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  mockPurchases.unshift(purchase);

  // Update Inventory and Ledger
  for (const item of payload.items) {
    const inv = mockInventory[item.product_id] || {
      id: `inv-${Date.now()}`,
      product_id: item.product_id,
      location_id: INITIAL_LOCATION.id,
      quantity: 0,
      reserved_quantity: 0,
      updated_at: new Date().toISOString()
    };

    const prevQty = inv.quantity;
    inv.quantity += item.quantity;
    inv.updated_at = new Date().toISOString();
    mockInventory[item.product_id] = inv;

    mockTransactions.unshift({
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      product_id: item.product_id,
      location_id: INITIAL_LOCATION.id,
      transaction_type: 'purchase',
      quantity: item.quantity,
      previous_quantity: prevQty,
      new_quantity: inv.quantity,
      unit_cost: item.unit_cost,
      related_purchase_id: purchase.id,
      reason: `Stock Receiving PO #${poNumber}`,
      created_at: new Date().toISOString()
    });
  }

  // Update supplier balance
  const sup = mockSuppliers.find(s => s.id === payload.supplier_id);
  if (sup) {
    sup.current_balance += (totalAmount - payload.paid_amount);
  }

  notifyListeners();
  return purchase;
};

export const getTransactions = async (): Promise<(InventoryTransaction & { product_name: string; sku: string })[]> => {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase
      .from('inventory_transactions')
      .select('*, products(name, sku)')
      .order('created_at', { ascending: false })
      .limit(100);

    return (data || []).map((t: any) => ({
      ...t,
      product_name: t.products?.name || 'Unknown',
      sku: t.products?.sku || '-'
    }));
  }

  const prodMap = new Map(mockProducts.map(p => [p.id, p]));
  return mockTransactions.map(tx => {
    const prod = prodMap.get(tx.product_id);
    return {
      ...tx,
      product_name: prod ? prod.name : 'Unknown Product',
      sku: prod ? prod.sku : '-'
    };
  });
};

export const getInventoryMetrics = async () => {
  const products = await getProductsWithStock();
  const totalItems = products.length;
  const totalUnits = products.reduce((acc, p) => acc + p.current_stock, 0);
  const totalCostValue = products.reduce((acc, p) => acc + (p.current_stock * p.cost_price), 0);
  const totalRetailValue = products.reduce((acc, p) => acc + (p.current_stock * p.selling_price), 0);
  const lowStockCount = products.filter(p => p.stock_status === 'low_stock').length;
  const outOfStockCount = products.filter(p => p.stock_status === 'out_of_stock').length;
  const potentialProfit = totalRetailValue - totalCostValue;

  return {
    totalItems,
    totalUnits,
    totalCostValue,
    totalRetailValue,
    lowStockCount,
    outOfStockCount,
    potentialProfit
  };
};

export const getMockInventoryRef = () => mockInventory;
export const getMockTransactionsRef = () => mockTransactions;
export const getMockProductsRef = () => mockProducts;
