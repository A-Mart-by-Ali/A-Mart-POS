// =====================================================================
// A-Mart Database Types (Matching mart_pos_schema.sql)
// =====================================================================

export type AppRole = 'super_admin' | 'admin_manager' | 'cashier' | 'inventory_staff';
export type UserStatus = 'active' | 'inactive';
export type ActiveStatus = 'active' | 'inactive';

export type TransactionType =
  | 'purchase'
  | 'sale'
  | 'sale_return'
  | 'purchase_return'
  | 'damage'
  | 'expiry'
  | 'manual_adjustment'
  | 'stock_count_adjustment'
  | 'initial_stock';

export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'mobile_wallet' | 'other';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded';
export type SaleStatus = 'completed' | 'cancelled' | 'partially_returned' | 'fully_returned';
export type ShiftStatus = 'open' | 'closed';
export type AdjustmentType = 'damage' | 'expiry' | 'manual' | 'stock_count';
export type AdjustmentStatus = 'pending' | 'approved' | 'rejected';
export type ReturnStatus = 'pending' | 'approved' | 'completed' | 'rejected';
export type DiscountType = 'percentage' | 'fixed';
export type CashTxnType = 'cash_in' | 'cash_out' | 'adjustment';

export interface Profile {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  role: AppRole;
  status: UserStatus;
  employee_code?: string;
  hire_date?: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface UserPermissions {
  profile_id: string;
  can_view_cost_price: boolean;
  can_view_profit_reports: boolean;
  can_apply_discount: boolean;
  can_process_returns: boolean;
  can_adjust_inventory: boolean;
  can_manage_expenses: boolean;
  can_view_audit_logs: boolean;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Brand {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  contact_person?: string;
  payment_terms?: string;
  opening_balance: number;
  current_balance: number;
  status: ActiveStatus;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Location {
  id: string;
  name: string;
  address?: string;
  is_default: boolean;
  is_active: boolean;
  created_at?: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  category_id?: string;
  brand_id?: string;
  supplier_id?: string;
  description?: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  min_stock_level: number;
  max_stock_level?: number;
  tax_rate: number;
  discount_type?: DiscountType;
  discount_value?: number;
  expiry_tracked: boolean;
  allow_negative_stock: boolean;
  image_url?: string;
  is_active: boolean;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductBatch {
  id: string;
  product_id: string;
  location_id: string;
  batch_number?: string;
  expiry_date?: string;
  quantity: number;
  created_at?: string;
}

export interface Inventory {
  id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  reserved_quantity: number;
  updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  product_id: string;
  location_id: string;
  transaction_type: TransactionType;
  quantity: number; // signed (+in / -out)
  previous_quantity: number;
  new_quantity: number;
  unit_cost?: number;
  related_sale_id?: string;
  related_purchase_id?: string;
  related_return_id?: string;
  related_adjustment_id?: string;
  user_id?: string;
  reason?: string;
  notes?: string;
  created_at: string;
}

export interface StockAdjustment {
  id: string;
  adjustment_number: string;
  type: AdjustmentType;
  reason?: string;
  status: AdjustmentStatus;
  created_by?: string;
  approved_by?: string;
  created_at: string;
  approved_at?: string;
  notes?: string;
}

export interface StockAdjustmentItem {
  id: string;
  adjustment_id: string;
  product_id: string;
  location_id: string;
  quantity_change: number;
  previous_quantity?: number;
  new_quantity?: number;
}

export interface Purchase {
  id: string;
  purchase_number: string;
  supplier_id: string;
  purchase_date: string;
  reference_number?: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount?: number;
  payment_status: PaymentStatus;
  status: 'pending' | 'received' | 'cancelled';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  tax_amount: number;
  total_cost: number;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  loyalty_points: number;
  notes?: string;
  is_walk_in: boolean;
  created_at: string;
  updated_at: string;
}

export interface CashierShift {
  id: string;
  cashier_id: string;
  opening_cash: number;
  opened_at: string;
  closed_at?: string;
  expected_cash?: number;
  actual_cash?: number;
  cash_difference?: number;
  cash_sales: number;
  card_sales: number;
  other_sales: number;
  total_returns: number;
  status: ShiftStatus;
  notes?: string;
}

export interface CashTransaction {
  id: string;
  shift_id: string;
  type: CashTxnType;
  amount: number;
  reason?: string;
  created_by?: string;
  created_at: string;
}

export interface Sale {
  id: string;
  receipt_number: string;
  cashier_id: string;
  customer_id?: string;
  shift_id?: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: SaleStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  returned_quantity: number;
  created_at: string;
}

export interface Payment {
  id: string;
  sale_id: string;
  payment_method: PaymentMethod;
  amount: number;
  amount_received?: number;
  change_amount?: number;
  reference_number?: string;
  created_at: string;
}

export interface Return {
  id: string;
  return_number: string;
  original_sale_id: string;
  customer_id?: string;
  refund_amount: number;
  reason?: string;
  status: ReturnStatus;
  processed_by?: string;
  created_at: string;
}

export interface ReturnItem {
  id: string;
  return_id: string;
  sale_item_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_refund: number;
  created_at: string;
}

export interface Receipt {
  id: string;
  sale_id: string;
  receipt_number: string;
  business_name?: string;
  business_contact?: string;
  footer_message?: string;
  printed_count: number;
  last_printed_at?: string;
  created_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: any;
  description?: string;
  updated_by?: string;
  updated_at: string;
}

// Reporting Views
export interface VCurrentStock {
  product_id: string;
  name: string;
  sku: string;
  barcode?: string;
  category_id?: string;
  min_stock_level: number;
  total_quantity: number;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'inactive';
}

export interface VSalesDailySummary {
  sale_date: string;
  total_transactions: number;
  total_sales: number;
  items_sold: number;
  cogs: number;
  gross_profit: number;
}
