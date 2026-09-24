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

export const getAllCategories = async (): Promise<Category[]> => {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.from('categories').select('*').order('name');
    return data || [];
  }
  return mockCategories;
};

export const addCategory = async (categoryData: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<Category> => {
  const newId = `cat-${Date.now().toString(36)}`;
  const newCat: Category = {
    ...categoryData,
    id: newId,
    is_active: categoryData.is_active !== undefined ? categoryData.is_active : true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('categories').insert([{
      name: categoryData.name,
      description: categoryData.description || null,
      is_active: categoryData.is_active !== undefined ? categoryData.is_active : true
    }]).select().single();
    if (error) throw error;
    notifyListeners();
    return data;
  }

  mockCategories.push(newCat);
  notifyListeners();
  return newCat;
};

export const updateCategory = async (id: string, updates: Partial<Category>): Promise<Category> => {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('categories')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    notifyListeners();
    return data;
  }

  const idx = mockCategories.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Category not found');
  mockCategories[idx] = { ...mockCategories[idx], ...updates, updated_at: new Date().toISOString() };
  notifyListeners();
  return mockCategories[idx];
};

export const deleteCategory = async (id: string): Promise<void> => {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
    notifyListeners();
    return;
  }

  mockCategories = mockCategories.filter(c => c.id !== id);
  notifyListeners();
};

export interface VariationPresetGroup {
  id: string;
  name: string;
  unit: string;
  options: string[];
}

export const DEFAULT_VARIATION_PRESETS: VariationPresetGroup[] = [
  {
    id: 'volume',
    name: 'Liquid / Volume',
    unit: 'litres',
    options: ['100ml', '250ml', '500ml', '1 Litre', '1.5 Litre', '2 Litre', '5 Litre']
  },
  {
    id: 'weight',
    name: 'Solid / Weight',
    unit: 'kg',
    options: ['50g', '100g', '250g', '500g', '1kg', '2kg', '5kg', '10kg', '25kg']
  },
  {
    id: 'packaging',
    name: 'Packaging / Bundles',
    unit: 'packs',
    options: ['Single Pack', 'Half Roll', 'Family Pack', 'Box (6 pcs)', 'Box (12 pcs)', 'Carton (24 pcs)']
  },
  {
    id: 'sizes',
    name: 'Sizes',
    unit: 'pcs',
    options: ['Small', 'Medium', 'Large', 'Extra Large']
  }
];

export const getVariationPresets = (): VariationPresetGroup[] => {
  try {
    const saved = localStorage.getItem('amart_variation_presets');
    if (saved) return JSON.parse(saved);
  } catch {
    console.warn('Failed to load variation presets from localStorage');
  }
  return DEFAULT_VARIATION_PRESETS;
};

export const saveVariationPresets = (presets: VariationPresetGroup[]) => {
  try {
    localStorage.setItem('amart_variation_presets', JSON.stringify(presets));
    notifyListeners();
  } catch {
    console.warn('Failed to save variation presets');
  }
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

export type NewProductPayload = Omit<Product, 'id' | 'created_at' | 'updated_at'> & {
  initial_stock?: number;
};

export const addProduct = async (productData: NewProductPayload): Promise<Product> => {
  const { initial_stock, ...productFields } = productData;
  const newId = `prod-${Date.now().toString(36)}`;
  const newProduct: Product = {
    ...productFields,
    id: newId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const initQty = Number(initial_stock) || 0;

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('products').insert([productFields]).select().single();
    if (error) throw error;

    const { data: loc } = await supabase.from('locations').select('id').eq('is_default', true).single();
    const locId = loc?.id;

    if (locId && data?.id) {
      if (initQty > 0) {
        try {
          await supabase.rpc('adjust_stock', {
            p_payload: {
              type: 'stock_count',
              reason: 'Initial stock on product creation',
              items: [{ product_id: data.id, quantity_change: initQty }]
            }
          });
        } catch (rpcErr) {
          console.warn('adjust_stock RPC failed, falling back to direct inventory upsert:', rpcErr);
          await supabase.from('inventory').upsert([{
            product_id: data.id,
            location_id: locId,
            quantity: initQty
          }]);
        }
      } else {
        await supabase.from('inventory').insert([{
          product_id: data.id,
          location_id: locId,
          quantity: 0
        }]);
      }
    }

    notifyListeners();
    return data;
  }

  mockProducts.unshift(newProduct);
  mockInventory[newId] = {
    id: `inv-${Date.now().toString(36)}`,
    product_id: newId,
    location_id: INITIAL_LOCATION.id,
    quantity: initQty,
    reserved_quantity: 0,
    updated_at: new Date().toISOString()
  };

  if (initQty > 0) {
    mockTransactions.unshift({
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      product_id: newId,
      location_id: INITIAL_LOCATION.id,
      transaction_type: 'initial_stock',
      quantity: initQty,
      previous_quantity: 0,
      new_quantity: initQty,
      unit_cost: productFields.cost_price,
      reason: 'Initial stock on product creation',
      created_at: new Date().toISOString()
    });
  }

  notifyListeners();
  return newProduct;
};

export const addProductsBulk = async (
  products: NewProductPayload[]
): Promise<{ count: number; products: Product[] }> => {
  if (!products || products.length === 0) return { count: 0, products: [] };

  if (isSupabaseConfigured && supabase) {
    const cleanProducts = products.map(({ initial_stock, ...p }) => p);

    const { data: inserted, error } = await supabase.from('products').insert(cleanProducts).select();
    if (error) throw error;

    const { data: loc } = await supabase.from('locations').select('id').eq('is_default', true).single();
    const locId = loc?.id;

    if (locId && inserted && inserted.length > 0) {
      const stockItems = inserted
        .map(p => {
          const original = products.find(orig => orig.sku === p.sku);
          const qty = Number(original?.initial_stock) || 0;
          return { product_id: p.id, quantity_change: qty };
        })
        .filter(item => item.quantity_change > 0);

      if (stockItems.length > 0) {
        try {
          await supabase.rpc('adjust_stock', {
            p_payload: {
              type: 'stock_count',
              reason: 'Initial stock on bulk product import',
              items: stockItems
            }
          });
        } catch (rpcErr) {
          console.warn('adjust_stock RPC failed for bulk:', rpcErr);
          const invRows = stockItems.map(item => ({
            product_id: item.product_id,
            location_id: locId,
            quantity: item.quantity_change
          }));
          await supabase.from('inventory').upsert(invRows);
        }
      }

      const zeroStockItems = inserted
        .filter(p => !stockItems.some(si => si.product_id === p.id))
        .map(p => ({
          product_id: p.id,
          location_id: locId,
          quantity: 0
        }));

      if (zeroStockItems.length > 0) {
        try {
          await supabase.from('inventory').insert(zeroStockItems);
        } catch {
          // ignore duplicate insert errors if any
        }
      }
    }

    notifyListeners();
    return { count: inserted?.length || 0, products: inserted || [] };
  }

  // Standalone / Mock Engine
  const createdProducts: Product[] = [];
  for (const item of products) {
    const { initial_stock, ...productFields } = item;
    const newId = `prod-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newProd: Product = {
      ...productFields,
      id: newId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const initQty = Number(initial_stock) || 0;

    mockProducts.unshift(newProd);
    mockInventory[newId] = {
      id: `inv-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      product_id: newId,
      location_id: INITIAL_LOCATION.id,
      quantity: initQty,
      reserved_quantity: 0,
      updated_at: new Date().toISOString()
    };

    if (initQty > 0) {
      mockTransactions.unshift({
        id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        product_id: newId,
        location_id: INITIAL_LOCATION.id,
        transaction_type: 'initial_stock',
        quantity: initQty,
        previous_quantity: 0,
        new_quantity: initQty,
        unit_cost: item.cost_price,
        reason: 'Initial stock on bulk product creation',
        created_at: new Date().toISOString()
      });
    }

    createdProducts.push(newProd);
  }

  notifyListeners();
  return { count: createdProducts.length, products: createdProducts };
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
