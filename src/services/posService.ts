import { supabase, isSupabaseConfigured } from './supabase';
import {
  CashierShift,
  Sale,
  SaleItem,
  Return,
  Receipt,
  PaymentMethod
} from '../types/database';
import { INITIAL_SHIFT, INITIAL_LOCATION } from './mockData';
import {
  getMockInventoryRef,
  getMockTransactionsRef,
  getMockProductsRef,
  subscribeInventoryChanges
} from './inventoryService';

let currentShift: CashierShift = { ...INITIAL_SHIFT };
let mockSales: (Sale & { items: SaleItem[] })[] = [];

// Listeners for shift & sales reactivity
type PosListener = () => void;
const posListeners: Set<PosListener> = new Set();
const notifyPos = () => posListeners.forEach(l => l());

export const subscribePosChanges = (listener: PosListener) => {
  posListeners.add(listener);
  return () => {
    posListeners.delete(listener);
  };
};

export const getCurrentShift = async (): Promise<CashierShift> => {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.from('cashier_shifts').select('*').eq('status', 'open').single();
    return data || currentShift;
  }
  return currentShift;
};

export const openCashierShift = async (openingCash: number): Promise<CashierShift> => {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('open_cashier_shift', { p_opening_cash: openingCash });
    if (error) throw error;
    notifyPos();
    return data;
  }

  currentShift = {
    id: `shift-${Date.now()}`,
    cashier_id: 'usr-cashier',
    opening_cash: openingCash,
    opened_at: new Date().toISOString(),
    cash_sales: 0,
    card_sales: 0,
    other_sales: 0,
    total_returns: 0,
    status: 'open',
    notes: 'Shift opened'
  };

  notifyPos();
  return currentShift;
};

export const closeCashierShift = async (shiftId: string, actualCash: number): Promise<CashierShift> => {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('close_cashier_shift', {
      p_shift_id: shiftId,
      p_actual_cash: actualCash
    });
    if (error) throw error;
    notifyPos();
    return data;
  }

  const expected = currentShift.opening_cash + currentShift.cash_sales - currentShift.total_returns;
  currentShift = {
    ...currentShift,
    status: 'closed',
    closed_at: new Date().toISOString(),
    expected_cash: expected,
    actual_cash: actualCash,
    cash_difference: actualCash - expected
  };

  notifyPos();
  return currentShift;
};

export interface ProcessSalePayload {
  shift_id: string;
  customer_id?: string | null;
  payment_method: PaymentMethod;
  amount_received: number;
  discount_amount?: number;
  items: {
    product_id: string;
    quantity: number;
    unit_price: number;
    discount_amount?: number;
    tax_amount?: number;
  }[];
}

export const processSale = async (payload: ProcessSalePayload): Promise<{ sale: Sale; items: SaleItem[]; receipt: Receipt; change: number }> => {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('process_sale', { p_payload: payload });
    if (error) throw error;
    notifyPos();
    return data;
  }

  const mockProducts = getMockProductsRef();
  const mockInventory = getMockInventoryRef();
  const mockTransactions = getMockTransactionsRef();

  // Validate stock
  for (const item of payload.items) {
    const p = mockProducts.find(prod => prod.id === item.product_id);
    if (!p) throw new Error(`Product not found`);
    const inv = mockInventory[item.product_id];
    const avail = inv ? inv.quantity : 0;
    if (avail < item.quantity && !p.allow_negative_stock) {
      throw new Error(`Insufficient stock for ${p.name}. In stock: ${avail}, requested: ${item.quantity}`);
    }
  }

  let subtotal = 0;
  let taxTotal = 0;
  payload.items.forEach(i => {
    subtotal += i.quantity * i.unit_price;
    taxTotal += i.tax_amount || 0;
  });

  const discount = payload.discount_amount || 0;
  const total = subtotal - discount + taxTotal;
  const change = payload.payment_method === 'cash' ? Math.max(0, payload.amount_received - total) : 0;
  const receiptNum = `SL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  const saleId = `sale-${Date.now()}`;
  const newSale: Sale = {
    id: saleId,
    receipt_number: receiptNum,
    cashier_id: 'usr-cashier',
    customer_id: payload.customer_id || undefined,
    shift_id: payload.shift_id,
    subtotal,
    discount_amount: discount,
    tax_amount: taxTotal,
    total_amount: total,
    payment_method: payload.payment_method,
    payment_status: payload.amount_received >= total ? 'paid' : 'partial',
    status: 'completed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const saleItems: SaleItem[] = payload.items.map(i => {
    const p = mockProducts.find(prod => prod.id === i.product_id)!;
    return {
      id: `si-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sale_id: saleId,
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      unit_cost: p.cost_price,
      discount_amount: i.discount_amount || 0,
      tax_amount: i.tax_amount || 0,
      line_total: (i.quantity * i.unit_price) - (i.discount_amount || 0) + (i.tax_amount || 0),
      returned_quantity: 0,
      created_at: new Date().toISOString()
    };
  });

  // Deduct inventory & record movement
  for (const item of payload.items) {
    const inv = mockInventory[item.product_id];
    const prevQty = inv.quantity;
    inv.quantity -= item.quantity;
    inv.updated_at = new Date().toISOString();

    const p = mockProducts.find(prod => prod.id === item.product_id)!;
    mockTransactions.unshift({
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      product_id: item.product_id,
      location_id: INITIAL_LOCATION.id,
      transaction_type: 'sale',
      quantity: -item.quantity,
      previous_quantity: prevQty,
      new_quantity: inv.quantity,
      unit_cost: p.cost_price,
      related_sale_id: saleId,
      user_id: 'usr-cashier',
      reason: `POS Checkout #${receiptNum}`,
      created_at: new Date().toISOString()
    });
  }

  // Update shift totals
  if (currentShift && currentShift.status === 'open') {
    if (payload.payment_method === 'cash') {
      currentShift.cash_sales += total;
    } else if (payload.payment_method === 'card') {
      currentShift.card_sales += total;
    } else {
      currentShift.other_sales += total;
    }
  }

  const receipt: Receipt = {
    id: `rec-${Date.now()}`,
    sale_id: saleId,
    receipt_number: receiptNum,
    business_name: 'A-Mart Superstore',
    business_contact: '+92 300 1234567 | info@a-mart.pk',
    footer_message: 'Thank you for shopping at A-Mart!',
    printed_count: 1,
    last_printed_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  mockSales.unshift({ ...newSale, items: saleItems });

  notifyPos();
  return { sale: newSale, items: saleItems, receipt, change };
};

export const getRecentSales = async (): Promise<(Sale & { items: SaleItem[] })[]> => {
  return mockSales;
};
