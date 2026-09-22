-- =====================================================================
-- MART INVENTORY & POINT OF SALE (POS) MANAGEMENT SYSTEM
-- Supabase / PostgreSQL Schema
-- =====================================================================
-- Based on the Mart Inventory & POS SRS v1.0
--
-- HOW TO APPLY
--   Option A: paste this whole file into the Supabase SQL editor and run it.
--   Option B: save as a migration, e.g.
--             supabase/migrations/00000000000000_mart_pos_schema.sql
--             then `supabase db push`.
--
-- NOTES
--   - Run this once against an empty `public` schema.
--   - Designed for Postgres 15+ (Supabase default) — uses generated
--     columns, jsonb_to_recordset, and `security_invoker` views.
--   - Money columns use numeric(12,2). Quantities use numeric(12,3)
--     so fractional units (kg, litres, etc.) are supported.
--   - Multi-location/multi-branch is modelled now (`locations` +
--     `inventory`) even though the MVP only needs one store, per the
--     SRS "Future Expansion" and "Scalability" requirements.
--   - All checkout / receiving / return / adjustment / shift-close
--     operations are exposed as SECURITY DEFINER RPC functions so the
--     frontend never assembles multi-table writes itself (SRS §19, §41).
-- =====================================================================


-- =====================================================================
-- 0. EXTENSIONS
-- =====================================================================
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- fuzzy product name search


-- =====================================================================
-- 1. ENUM TYPES
-- =====================================================================
create type public.app_role as enum
  ('super_admin', 'admin_manager', 'cashier', 'inventory_staff');

create type public.user_status as enum ('active', 'inactive');
create type public.active_status as enum ('active', 'inactive');

create type public.transaction_type as enum (
  'purchase', 'sale', 'sale_return', 'purchase_return',
  'damage', 'expiry', 'manual_adjustment', 'stock_count_adjustment',
  'initial_stock'
);

create type public.payment_method as enum
  ('cash', 'card', 'bank_transfer', 'mobile_wallet', 'other');

create type public.payment_status as enum
  ('pending', 'partial', 'paid', 'refunded');

create type public.sale_status as enum
  ('completed', 'cancelled', 'partially_returned', 'fully_returned');

create type public.shift_status as enum ('open', 'closed');

create type public.adjustment_type as enum
  ('damage', 'expiry', 'manual', 'stock_count');

create type public.adjustment_status as enum
  ('pending', 'approved', 'rejected');

create type public.return_status as enum
  ('pending', 'approved', 'completed', 'rejected');

create type public.discount_type as enum ('percentage', 'fixed');

create type public.cash_txn_type as enum
  ('cash_in', 'cash_out', 'adjustment');


-- =====================================================================
-- 2. UTILITY FUNCTIONS
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.generate_document_number(p_prefix text, p_seq regclass)
returns text
language plpgsql
as $$
declare
  v_num bigint;
begin
  v_num := nextval(p_seq);
  return p_prefix || to_char(now(), 'YYYYMMDD') || '-' || lpad(v_num::text, 5, '0');
end;
$$;


-- =====================================================================
-- 3. PROFILES / ROLES / PERMISSIONS
-- =====================================================================
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text not null default '',
  email           text,
  phone           text,
  role            public.app_role not null default 'cashier',
  status          public.user_status not null default 'active',
  employee_code   text unique,
  hire_date       date,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Fine-grained overrides on top of the base role (SRS §5, §41)
create table public.user_permissions (
  profile_id              uuid primary key references public.profiles(id) on delete cascade,
  can_view_cost_price     boolean not null default false,
  can_view_profit_reports boolean not null default false,
  can_apply_discount      boolean not null default false,
  can_process_returns     boolean not null default false,
  can_adjust_inventory    boolean not null default false,
  can_manage_expenses     boolean not null default false,
  can_view_audit_logs     boolean not null default false,
  updated_at              timestamptz not null default now()
);

create trigger trg_user_permissions_updated_at
  before update on public.user_permissions
  for each row execute function public.set_updated_at();

-- Auto-create a profile (and default permission row) for every new auth user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'cashier')
  );

  insert into public.user_permissions (profile_id) values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =====================================================================
-- 4. CATALOG: CATEGORIES / BRANDS / SUPPLIERS / LOCATIONS
-- =====================================================================
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_categories_updated_at
  before update on public.categories for each row execute function public.set_updated_at();

create table public.brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_brands_updated_at
  before update on public.brands for each row execute function public.set_updated_at();

create table public.suppliers (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  phone            text,
  email            text,
  address          text,
  contact_person   text,
  payment_terms    text,
  opening_balance  numeric(12,2) not null default 0,
  current_balance  numeric(12,2) not null default 0,
  status           public.active_status not null default 'active',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger trg_suppliers_updated_at
  before update on public.suppliers for each row execute function public.set_updated_at();

-- Store / warehouse locations. Single-branch marts just get one default row.
create table public.locations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  address    text,
  is_default boolean not null default false,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index one_default_location on public.locations (is_default) where is_default = true;


-- =====================================================================
-- 5. PRODUCTS
-- =====================================================================
create table public.products (
  id                   uuid primary key default gen_random_uuid(),
  sku                  text not null unique,
  barcode              text unique,
  name                 text not null,
  category_id          uuid references public.categories(id) on delete set null,
  brand_id             uuid references public.brands(id) on delete set null,
  supplier_id          uuid references public.suppliers(id) on delete set null,
  description          text,
  unit                 text not null default 'pcs',
  cost_price           numeric(12,2) not null default 0 check (cost_price >= 0),
  selling_price        numeric(12,2) not null default 0 check (selling_price >= 0),
  min_stock_level      numeric(12,3) not null default 0,
  max_stock_level      numeric(12,3),
  tax_rate             numeric(5,2) not null default 0 check (tax_rate >= 0),
  discount_type        public.discount_type,
  discount_value       numeric(12,2) default 0,
  expiry_tracked       boolean not null default false,
  allow_negative_stock boolean not null default false,
  image_url            text,
  is_active            boolean not null default true,
  created_by           uuid references public.profiles(id),
  updated_by           uuid references public.profiles(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger trg_products_updated_at
  before update on public.products for each row execute function public.set_updated_at();

-- Optional batch/expiry tracking for products that need it
create table public.product_batches (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  location_id uuid not null references public.locations(id),
  batch_number text,
  expiry_date date,
  quantity    numeric(12,3) not null default 0 check (quantity >= 0),
  created_at  timestamptz not null default now()
);


-- =====================================================================
-- 6. INVENTORY (current stock, per product per location)
-- =====================================================================
create table public.inventory (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null references public.products(id) on delete cascade,
  location_id        uuid not null references public.locations(id) on delete restrict,
  quantity           numeric(12,3) not null default 0,
  reserved_quantity  numeric(12,3) not null default 0,
  updated_at         timestamptz not null default now(),
  unique (product_id, location_id)
);

-- Enforce BR-05: no negative stock unless the product explicitly allows it
create or replace function public.fn_check_inventory_non_negative()
returns trigger
language plpgsql
as $$
declare
  v_allow boolean;
begin
  if new.quantity < 0 then
    select allow_negative_stock into v_allow from public.products where id = new.product_id;
    if not coalesce(v_allow, false) then
      raise exception 'Insufficient stock for product % (would become %)', new.product_id, new.quantity;
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_inventory_non_negative
  before insert or update on public.inventory
  for each row execute function public.fn_check_inventory_non_negative();

-- Stock status derived at query time (In Stock / Low Stock / Out of Stock)
-- see reporting views in section 18.


-- =====================================================================
-- 7. STOCK ADJUSTMENTS (damage, expiry, manual, stock counts)
-- =====================================================================
create table public.stock_adjustments (
  id                 uuid primary key default gen_random_uuid(),
  adjustment_number  text not null unique,
  type               public.adjustment_type not null,
  reason             text,
  status             public.adjustment_status not null default 'pending',
  created_by         uuid references public.profiles(id),
  approved_by        uuid references public.profiles(id),
  created_at         timestamptz not null default now(),
  approved_at        timestamptz,
  notes              text
);

create table public.stock_adjustment_items (
  id                 uuid primary key default gen_random_uuid(),
  adjustment_id      uuid not null references public.stock_adjustments(id) on delete cascade,
  product_id         uuid not null references public.products(id),
  location_id        uuid not null references public.locations(id),
  quantity_change    numeric(12,3) not null,  -- signed: negative for damage/expiry
  previous_quantity  numeric(12,3),
  new_quantity       numeric(12,3)
);


-- =====================================================================
-- 8. PURCHASES / STOCK RECEIVING
-- =====================================================================
create table public.purchases (
  id                uuid primary key default gen_random_uuid(),
  purchase_number   text not null unique,
  supplier_id       uuid not null references public.suppliers(id),
  purchase_date     date not null default current_date,
  reference_number  text,
  subtotal          numeric(12,2) not null default 0,
  tax_amount        numeric(12,2) not null default 0,
  total_amount      numeric(12,2) not null default 0,
  paid_amount       numeric(12,2) not null default 0,
  remaining_amount  numeric(12,2) generated always as (total_amount - paid_amount) stored,
  payment_status    public.payment_status not null default 'pending',
  status            text not null default 'received' check (status in ('pending','received','cancelled')),
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger trg_purchases_updated_at
  before update on public.purchases for each row execute function public.set_updated_at();

create table public.purchase_items (
  id            uuid primary key default gen_random_uuid(),
  purchase_id   uuid not null references public.purchases(id) on delete cascade,
  product_id    uuid not null references public.products(id),
  quantity      numeric(12,3) not null check (quantity > 0),
  unit_cost     numeric(12,2) not null check (unit_cost >= 0),
  tax_amount    numeric(12,2) not null default 0,
  total_cost    numeric(12,2) not null
);


-- =====================================================================
-- 9. CUSTOMERS
-- =====================================================================
create table public.customers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null default 'Walk-in Customer',
  phone           text,
  email           text,
  address         text,
  loyalty_points  numeric(12,2) not null default 0,
  notes           text,
  is_walk_in      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_customers_updated_at
  before update on public.customers for each row execute function public.set_updated_at();


-- =====================================================================
-- 10. CASHIER SHIFTS
-- =====================================================================
create table public.cashier_shifts (
  id               uuid primary key default gen_random_uuid(),
  cashier_id       uuid not null references public.profiles(id),
  opening_cash     numeric(12,2) not null default 0,
  opened_at        timestamptz not null default now(),
  closed_at        timestamptz,
  expected_cash    numeric(12,2),
  actual_cash      numeric(12,2),
  cash_difference  numeric(12,2),
  cash_sales       numeric(12,2) not null default 0,
  card_sales       numeric(12,2) not null default 0,
  other_sales      numeric(12,2) not null default 0,
  total_returns    numeric(12,2) not null default 0,
  status           public.shift_status not null default 'open',
  notes            text
);

-- Only one open shift per cashier at a time
create unique index one_open_shift_per_cashier
  on public.cashier_shifts (cashier_id) where status = 'open';

create table public.cash_transactions (
  id          uuid primary key default gen_random_uuid(),
  shift_id    uuid not null references public.cashier_shifts(id) on delete cascade,
  type        public.cash_txn_type not null,
  amount      numeric(12,2) not null,
  reason      text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);


-- =====================================================================
-- 11. SALES / POS
-- =====================================================================
create table public.sales (
  id              uuid primary key default gen_random_uuid(),
  receipt_number  text not null unique,
  cashier_id      uuid not null references public.profiles(id),
  customer_id     uuid references public.customers(id),
  shift_id        uuid references public.cashier_shifts(id),
  subtotal        numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_amount      numeric(12,2) not null default 0,
  total_amount    numeric(12,2) not null default 0,
  payment_method  public.payment_method not null,
  payment_status  public.payment_status not null default 'paid',
  status          public.sale_status not null default 'completed',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_sales_updated_at
  before update on public.sales for each row execute function public.set_updated_at();

create table public.sale_items (
  id                 uuid primary key default gen_random_uuid(),
  sale_id            uuid not null references public.sales(id) on delete cascade,
  product_id         uuid not null references public.products(id),
  quantity           numeric(12,3) not null check (quantity > 0),
  unit_price         numeric(12,2) not null,   -- selling price at time of sale
  unit_cost          numeric(12,2) not null,   -- cost price at time of sale (BR-04)
  discount_amount    numeric(12,2) not null default 0,
  tax_amount         numeric(12,2) not null default 0,
  line_total         numeric(12,2) not null,
  returned_quantity  numeric(12,3) not null default 0,
  created_at         timestamptz not null default now()
);

create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  sale_id           uuid not null references public.sales(id) on delete cascade,
  payment_method    public.payment_method not null,
  amount            numeric(12,2) not null,
  amount_received   numeric(12,2),
  change_amount     numeric(12,2) default 0,
  reference_number  text,
  created_at        timestamptz not null default now()
);


-- =====================================================================
-- 12. RETURNS
-- =====================================================================
create table public.returns (
  id                uuid primary key default gen_random_uuid(),
  return_number     text not null unique,
  original_sale_id  uuid not null references public.sales(id),
  customer_id       uuid references public.customers(id),
  refund_amount     numeric(12,2) not null default 0,
  reason            text,
  status            public.return_status not null default 'completed',
  processed_by      uuid references public.profiles(id),
  created_at        timestamptz not null default now()
);

create table public.return_items (
  id            uuid primary key default gen_random_uuid(),
  return_id     uuid not null references public.returns(id) on delete cascade,
  sale_item_id  uuid not null references public.sale_items(id),
  product_id    uuid not null references public.products(id),
  quantity      numeric(12,3) not null check (quantity > 0),
  unit_price    numeric(12,2) not null,
  line_refund   numeric(12,2) not null,
  created_at    timestamptz not null default now()
);


-- =====================================================================
-- 13. INVENTORY TRANSACTIONS (full stock movement ledger)
-- =====================================================================
create table public.inventory_transactions (
  id                     uuid primary key default gen_random_uuid(),
  product_id             uuid not null references public.products(id),
  location_id            uuid not null references public.locations(id),
  transaction_type       public.transaction_type not null,
  quantity               numeric(12,3) not null,  -- signed: +in / -out
  previous_quantity      numeric(12,3) not null,
  new_quantity           numeric(12,3) not null,
  unit_cost              numeric(12,2),
  related_sale_id        uuid references public.sales(id),
  related_purchase_id    uuid references public.purchases(id),
  related_return_id      uuid references public.returns(id),
  related_adjustment_id  uuid references public.stock_adjustments(id),
  user_id                uuid references public.profiles(id),
  reason                 text,
  notes                  text,
  created_at             timestamptz not null default now()
);


-- =====================================================================
-- 14. RECEIPTS
-- =====================================================================
create table public.receipts (
  id                uuid primary key default gen_random_uuid(),
  sale_id           uuid not null unique references public.sales(id) on delete cascade,
  receipt_number    text not null,
  business_name     text,
  business_contact  text,
  footer_message    text,
  printed_count     int not null default 0,
  last_printed_at   timestamptz,
  created_at        timestamptz not null default now()
);


-- =====================================================================
-- 15. EXPENSES
-- =====================================================================
create table public.expense_categories (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  is_active boolean not null default true
);

create table public.expenses (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid references public.expense_categories(id),
  description     text,
  amount          numeric(12,2) not null check (amount > 0),
  payment_method  public.payment_method not null default 'cash',
  expense_date    date not null default current_date,
  created_by      uuid references public.profiles(id),
  notes           text,
  created_at      timestamptz not null default now()
);


-- =====================================================================
-- 16. AUDIT LOGS
-- =====================================================================
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id),
  action      text not null,      -- INSERT / UPDATE / DELETE / custom action
  entity      text not null,      -- table / logical entity name
  entity_id   uuid,
  old_value   jsonb,
  new_value   jsonb,
  reason      text,
  created_at  timestamptz not null default now()
);


-- =====================================================================
-- 17. SETTINGS
-- =====================================================================
create table public.settings (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  value       jsonb not null,
  description text,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);
create trigger trg_settings_updated_at
  before update on public.settings for each row execute function public.set_updated_at();


-- =====================================================================
-- 18. INDEXES
-- =====================================================================
create index idx_products_category on public.products(category_id);
create index idx_products_brand on public.products(brand_id);
create index idx_products_supplier on public.products(supplier_id);
create index idx_products_active on public.products(is_active);
create index idx_products_name_trgm on public.products using gin (name gin_trgm_ops);

create index idx_inventory_product on public.inventory(product_id);
create index idx_inventory_location on public.inventory(location_id);

create index idx_inv_txn_product_date on public.inventory_transactions(product_id, created_at desc);
create index idx_inv_txn_type on public.inventory_transactions(transaction_type);
create index idx_inv_txn_sale on public.inventory_transactions(related_sale_id);
create index idx_inv_txn_purchase on public.inventory_transactions(related_purchase_id);

create index idx_sales_created_at on public.sales(created_at desc);
create index idx_sales_cashier on public.sales(cashier_id);
create index idx_sales_customer on public.sales(customer_id);
create index idx_sales_status on public.sales(status);

create index idx_sale_items_sale on public.sale_items(sale_id);
create index idx_sale_items_product on public.sale_items(product_id);

create index idx_purchase_items_purchase on public.purchase_items(purchase_id);
create index idx_purchase_items_product on public.purchase_items(product_id);

create index idx_returns_sale on public.returns(original_sale_id);
create index idx_return_items_return on public.return_items(return_id);

create index idx_expenses_date on public.expenses(expense_date desc);
create index idx_cashier_shifts_cashier on public.cashier_shifts(cashier_id);

create index idx_audit_logs_entity on public.audit_logs(entity, entity_id);
create index idx_audit_logs_user on public.audit_logs(user_id);
create index idx_audit_logs_created_at on public.audit_logs(created_at desc);


-- =====================================================================
-- 19. SEQUENCES (for human-readable document numbers)
-- =====================================================================
create sequence public.sale_number_seq;
create sequence public.purchase_number_seq;
create sequence public.return_number_seq;
create sequence public.adjustment_number_seq;


-- =====================================================================
-- 20. RLS HELPER FUNCTIONS
-- =====================================================================
create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable as $$ select public.current_role() = 'super_admin' $$;

create or replace function public.is_admin_manager() returns boolean
language sql stable as $$ select public.current_role() = 'admin_manager' $$;

create or replace function public.is_cashier() returns boolean
language sql stable as $$ select public.current_role() = 'cashier' $$;

create or replace function public.is_inventory_staff() returns boolean
language sql stable as $$ select public.current_role() = 'inventory_staff' $$;

create or replace function public.is_manager_or_admin() returns boolean
language sql stable as $$ select public.current_role() in ('super_admin', 'admin_manager') $$;

-- Fixed whitelist of permission keys (avoids dynamic-SQL injection risk)
create or replace function public.has_permission(p_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_perm boolean;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role = 'super_admin' then
    return true;
  end if;

  select case p_permission
    when 'view_cost_price'     then can_view_cost_price
    when 'view_profit_reports' then can_view_profit_reports
    when 'apply_discount'      then can_apply_discount
    when 'process_returns'     then can_process_returns
    when 'adjust_inventory'    then can_adjust_inventory
    when 'manage_expenses'     then can_manage_expenses
    when 'view_audit_logs'     then can_view_audit_logs
    else false
  end
  into v_perm
  from public.user_permissions
  where profile_id = auth.uid();

  return coalesce(v_perm, false);
end;
$$;

-- Prevent a non-super-admin from escalating their own role/status
create or replace function public.fn_guard_profile_update()
returns trigger
language plpgsql
as $$
begin
  if not public.is_super_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status then
      raise exception 'Only a super admin may change role or status';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_guard_profile_update
  before update on public.profiles
  for each row execute function public.fn_guard_profile_update();


-- =====================================================================
-- 21. ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.user_permissions enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.suppliers enable row level security;
alter table public.locations enable row level security;
alter table public.products enable row level security;
alter table public.product_batches enable row level security;
alter table public.inventory enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.stock_adjustment_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.customers enable row level security;
alter table public.cashier_shifts enable row level security;
alter table public.cash_transactions enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;
alter table public.returns enable row level security;
alter table public.return_items enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.receipts enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.audit_logs enable row level security;
alter table public.settings enable row level security;

-- ---- profiles / permissions -----------------------------------------
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_manager_or_admin());
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_super_admin());
create policy profiles_insert on public.profiles for insert
  with check (public.is_super_admin());
create policy profiles_delete on public.profiles for delete
  using (public.is_super_admin());

create policy user_permissions_select on public.user_permissions for select
  using (profile_id = auth.uid() or public.is_manager_or_admin());
create policy user_permissions_write on public.user_permissions for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---- catalog: categories / brands / suppliers / locations -----------
create policy categories_select on public.categories for select using (true);
create policy categories_write on public.categories for all
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());

create policy brands_select on public.brands for select using (true);
create policy brands_write on public.brands for all
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());

create policy suppliers_select on public.suppliers for select
  using (public.is_manager_or_admin() or public.is_inventory_staff());
create policy suppliers_write on public.suppliers for all
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());

create policy locations_select on public.locations for select using (true);
create policy locations_write on public.locations for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---- products ---------------------------------------------------------
-- Cashiers do NOT get row access to the base table (it carries cost_price);
-- they use public.pos_search_products() instead (section 22).
create policy products_select on public.products for select
  using (public.is_manager_or_admin() or public.is_inventory_staff());
create policy products_write on public.products for all
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());

create policy product_batches_select on public.product_batches for select
  using (public.is_manager_or_admin() or public.is_inventory_staff());
create policy product_batches_write on public.product_batches for all
  using (public.is_manager_or_admin() or public.is_inventory_staff())
  with check (public.is_manager_or_admin() or public.is_inventory_staff());

-- ---- inventory & movement history -------------------------------------
create policy inventory_select on public.inventory for select using (true);
-- Direct writes to inventory/inventory_transactions are blocked for everyone;
-- all stock changes must go through the SECURITY DEFINER RPCs (section 23),
-- which bypass RLS internally.
create policy inventory_no_direct_write on public.inventory for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy inv_txn_select on public.inventory_transactions for select
  using (public.is_manager_or_admin() or public.is_inventory_staff());
create policy inv_txn_no_direct_write on public.inventory_transactions for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy stock_adj_select on public.stock_adjustments for select
  using (public.is_manager_or_admin() or public.is_inventory_staff());
create policy stock_adj_no_direct_write on public.stock_adjustments for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy stock_adj_items_select on public.stock_adjustment_items for select
  using (public.is_manager_or_admin() or public.is_inventory_staff());
create policy stock_adj_items_no_direct_write on public.stock_adjustment_items for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---- purchases ----------------------------------------------------------
create policy purchases_select on public.purchases for select
  using (public.is_manager_or_admin() or public.is_inventory_staff());
create policy purchases_no_direct_write on public.purchases for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy purchase_items_select on public.purchase_items for select
  using (public.is_manager_or_admin() or public.is_inventory_staff());
create policy purchase_items_no_direct_write on public.purchase_items for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---- customers ------------------------------------------------------------
create policy customers_select on public.customers for select using (true);
create policy customers_write on public.customers for insert with check (true);
create policy customers_update on public.customers for update using (true);
create policy customers_delete on public.customers for delete
  using (public.is_manager_or_admin());

-- ---- cashier shifts ---------------------------------------------------
create policy shifts_select on public.cashier_shifts for select
  using (cashier_id = auth.uid() or public.is_manager_or_admin());
create policy shifts_no_direct_write on public.cashier_shifts for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy cash_txn_select on public.cash_transactions for select
  using (
    public.is_manager_or_admin()
    or exists (select 1 from public.cashier_shifts s
               where s.id = shift_id and s.cashier_id = auth.uid())
  );
create policy cash_txn_no_direct_write on public.cash_transactions for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---- sales / sale items / payments -------------------------------------
create policy sales_select on public.sales for select
  using (cashier_id = auth.uid() or public.is_manager_or_admin());
create policy sales_no_direct_write on public.sales for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy sale_items_select on public.sale_items for select
  using (
    public.is_manager_or_admin()
    or exists (select 1 from public.sales s where s.id = sale_id and s.cashier_id = auth.uid())
  );
create policy sale_items_no_direct_write on public.sale_items for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy payments_select on public.payments for select
  using (
    public.is_manager_or_admin()
    or exists (select 1 from public.sales s where s.id = sale_id and s.cashier_id = auth.uid())
  );
create policy payments_no_direct_write on public.payments for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---- returns ------------------------------------------------------------
create policy returns_select on public.returns for select
  using (public.is_manager_or_admin() or processed_by = auth.uid());
create policy returns_no_direct_write on public.returns for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy return_items_select on public.return_items for select
  using (
    public.is_manager_or_admin()
    or exists (select 1 from public.returns r where r.id = return_id and r.processed_by = auth.uid())
  );
create policy return_items_no_direct_write on public.return_items for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---- receipts -------------------------------------------------------------
create policy receipts_select on public.receipts for select
  using (
    public.is_manager_or_admin()
    or exists (select 1 from public.sales s where s.id = sale_id and s.cashier_id = auth.uid())
  );
create policy receipts_no_direct_write on public.receipts for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---- expenses ---------------------------------------------------------
create policy expense_categories_select on public.expense_categories for select using (true);
create policy expense_categories_write on public.expense_categories for all
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());

create policy expenses_select on public.expenses for select
  using (public.is_manager_or_admin() or public.has_permission('manage_expenses'));
create policy expenses_write on public.expenses for insert
  with check (public.is_manager_or_admin() or public.has_permission('manage_expenses'));
create policy expenses_update on public.expenses for update
  using (public.is_manager_or_admin());
create policy expenses_delete on public.expenses for delete
  using (public.is_super_admin());

-- ---- audit logs (read-only to ordinary users, never editable) ---------
create policy audit_logs_select on public.audit_logs for select
  using (public.is_super_admin() or public.has_permission('view_audit_logs'));
create policy audit_logs_insert on public.audit_logs for insert
  with check (true);  -- rows are only ever inserted by SECURITY DEFINER triggers/functions
create policy audit_logs_no_update on public.audit_logs for update using (false);
create policy audit_logs_no_delete on public.audit_logs for delete using (false);

-- ---- settings -----------------------------------------------------------
create policy settings_select on public.settings for select using (true);
create policy settings_write on public.settings for all
  using (public.is_super_admin()) with check (public.is_super_admin());


-- =====================================================================
-- 22. PRODUCT SEARCH FOR POS (excludes cost_price / profit fields)
-- =====================================================================
create or replace function public.pos_search_products(p_search text default null)
returns table (
  id             uuid,
  name           text,
  sku            text,
  barcode        text,
  unit           text,
  selling_price  numeric,
  tax_rate       numeric,
  discount_type  public.discount_type,
  discount_value numeric,
  image_url      text,
  stock          numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.name, p.sku, p.barcode, p.unit, p.selling_price, p.tax_rate,
    p.discount_type, p.discount_value, p.image_url,
    coalesce(sum(i.quantity), 0) as stock
  from public.products p
  left join public.inventory i on i.product_id = p.id
  where p.is_active = true
    and (
      p_search is null
      or p.name ilike '%' || p_search || '%'
      or p.sku ilike p_search || '%'
      or p.barcode = p_search
    )
  group by p.id
  order by p.name
  limit 50;
$$;

grant execute on function public.pos_search_products(text) to authenticated;


-- =====================================================================
-- 23. AUDIT TRIGGER (representative set of sensitive tables)
-- =====================================================================
create or replace function public.fn_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (user_id, action, entity, entity_id, old_value, new_value)
  values (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    coalesce((to_jsonb(new) ->> 'id')::uuid, (to_jsonb(old) ->> 'id')::uuid),
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('UPDATE','INSERT') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_audit_products
  after insert or update or delete on public.products
  for each row execute function public.fn_audit_log();

create trigger trg_audit_profiles
  after update on public.profiles
  for each row execute function public.fn_audit_log();

create trigger trg_audit_suppliers
  after insert or update or delete on public.suppliers
  for each row execute function public.fn_audit_log();

create trigger trg_audit_sales
  after update on public.sales
  for each row execute function public.fn_audit_log();

create trigger trg_audit_stock_adjustments
  after insert or update on public.stock_adjustments
  for each row execute function public.fn_audit_log();

create trigger trg_audit_expenses
  after insert or delete on public.expenses
  for each row execute function public.fn_audit_log();

create trigger trg_audit_user_permissions
  after update on public.user_permissions
  for each row execute function public.fn_audit_log();


-- =====================================================================
-- 24. TRANSACTIONAL RPC FUNCTIONS
--     These are the only supported way to write sales, receiving,
--     returns, adjustments and shift closing (SRS §19, §41, §43).
--     Each function is one Postgres transaction: it either fully
--     succeeds or fully rolls back.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 24.1 open_cashier_shift
-- ---------------------------------------------------------------------
create or replace function public.open_cashier_shift(p_opening_cash numeric)
returns public.cashier_shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift public.cashier_shifts;
begin
  if public.current_role() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.cashier_shifts (cashier_id, opening_cash, status)
  values (auth.uid(), p_opening_cash, 'open')
  returning * into v_shift;

  return v_shift;
end;
$$;

-- ---------------------------------------------------------------------
-- 24.2 close_cashier_shift
-- ---------------------------------------------------------------------
create or replace function public.close_cashier_shift(p_shift_id uuid, p_actual_cash numeric)
returns public.cashier_shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift public.cashier_shifts;
  v_expected numeric;
begin
  select * into v_shift from public.cashier_shifts where id = p_shift_id for update;

  if v_shift is null then
    raise exception 'Shift not found';
  end if;
  if v_shift.status = 'closed' then
    raise exception 'Shift already closed';
  end if;
  if v_shift.cashier_id <> auth.uid() and not public.is_manager_or_admin() then
    raise exception 'Not authorized to close this shift';
  end if;

  v_expected := v_shift.opening_cash + v_shift.cash_sales - v_shift.total_returns;

  update public.cashier_shifts
  set status          = 'closed',
      closed_at       = now(),
      expected_cash   = v_expected,
      actual_cash     = p_actual_cash,
      cash_difference = p_actual_cash - v_expected
  where id = p_shift_id
  returning * into v_shift;

  return v_shift;
end;
$$;

-- ---------------------------------------------------------------------
-- 24.3 process_sale  (POS checkout — SRS §19 Atomic Sale Processing)
--
-- p_payload shape:
-- {
--   "shift_id": "uuid",
--   "customer_id": "uuid|null",
--   "payment_method": "cash",
--   "amount_received": 500.00,
--   "discount_amount": 0,
--   "items": [
--     {"product_id":"uuid","quantity":2,"unit_price":100,
--      "discount_amount":0,"tax_amount":0}
--   ]
-- }
-- ---------------------------------------------------------------------
create or replace function public.process_sale(p_payload jsonb)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role              public.app_role;
  v_location_id       uuid;
  v_shift             public.cashier_shifts;
  v_item              record;
  v_subtotal          numeric := 0;
  v_discount          numeric := coalesce((p_payload->>'discount_amount')::numeric, 0);
  v_tax               numeric := 0;
  v_total             numeric;
  v_sale              public.sales;
  v_receipt_number    text;
  v_payment_method    public.payment_method := (p_payload->>'payment_method')::public.payment_method;
  v_amount_received   numeric := (p_payload->>'amount_received')::numeric;
  v_change            numeric := 0;
  v_product           public.products;
  v_inv               public.inventory;
  v_new_qty           numeric;
  v_line_total        numeric;
  v_payment_status    public.payment_status;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_location_id from public.locations where is_default = true limit 1;
  if v_location_id is null then
    raise exception 'No default location configured';
  end if;

  select * into v_shift from public.cashier_shifts where id = (p_payload->>'shift_id')::uuid for update;
  if v_shift is null or v_shift.status <> 'open' then
    raise exception 'No open shift found for this sale';
  end if;
  if v_shift.cashier_id <> auth.uid() and not public.is_manager_or_admin() then
    raise exception 'Shift does not belong to the current cashier';
  end if;

  if jsonb_array_length(p_payload->'items') is null or jsonb_array_length(p_payload->'items') = 0 then
    raise exception 'Sale must contain at least one item';
  end if;

  -- Pass 1: compute totals
  for v_item in
    select * from jsonb_to_recordset(p_payload->'items') as x(
      product_id uuid, quantity numeric, unit_price numeric,
      discount_amount numeric, tax_amount numeric
    )
  loop
    v_line_total := (v_item.quantity * v_item.unit_price)
                     - coalesce(v_item.discount_amount, 0)
                     + coalesce(v_item.tax_amount, 0);
    v_subtotal := v_subtotal + (v_item.quantity * v_item.unit_price);
    v_tax := v_tax + coalesce(v_item.tax_amount, 0);
  end loop;

  v_total := v_subtotal - v_discount + v_tax;
  v_payment_status := (case when v_amount_received >= v_total then 'paid' else 'partial' end)::public.payment_status;
  v_change := case when v_payment_method = 'cash' then greatest(v_amount_received - v_total, 0) else 0 end;

  v_receipt_number := public.generate_document_number('SL-', 'public.sale_number_seq');

  insert into public.sales (
    receipt_number, cashier_id, customer_id, shift_id,
    subtotal, discount_amount, tax_amount, total_amount,
    payment_method, payment_status, status
  ) values (
    v_receipt_number, auth.uid(), (p_payload->>'customer_id')::uuid, v_shift.id,
    v_subtotal, v_discount, v_tax, v_total,
    v_payment_method, v_payment_status, 'completed'
  ) returning * into v_sale;

  -- Pass 2: create sale_items, deduct inventory, log movements
  for v_item in
    select * from jsonb_to_recordset(p_payload->'items') as x(
      product_id uuid, quantity numeric, unit_price numeric,
      discount_amount numeric, tax_amount numeric
    )
  loop
    select * into v_product from public.products where id = v_item.product_id;
    if v_product is null then
      raise exception 'Product % not found', v_item.product_id;
    end if;

    v_line_total := (v_item.quantity * v_item.unit_price)
                     - coalesce(v_item.discount_amount, 0)
                     + coalesce(v_item.tax_amount, 0);

    insert into public.sale_items (
      sale_id, product_id, quantity, unit_price, unit_cost,
      discount_amount, tax_amount, line_total
    ) values (
      v_sale.id, v_item.product_id, v_item.quantity, v_item.unit_price, v_product.cost_price,
      coalesce(v_item.discount_amount, 0), coalesce(v_item.tax_amount, 0), v_line_total
    );

    select * into v_inv from public.inventory
      where product_id = v_item.product_id and location_id = v_location_id
      for update;

    if v_inv is null then
      insert into public.inventory (product_id, location_id, quantity)
      values (v_item.product_id, v_location_id, 0)
      returning * into v_inv;
    end if;

    v_new_qty := v_inv.quantity - v_item.quantity;

    if v_new_qty < 0 and not v_product.allow_negative_stock then
      raise exception 'Insufficient stock for product % (have %, need %)',
        v_product.name, v_inv.quantity, v_item.quantity;
    end if;

    update public.inventory set quantity = v_new_qty where id = v_inv.id;

    insert into public.inventory_transactions (
      product_id, location_id, transaction_type, quantity,
      previous_quantity, new_quantity, unit_cost, related_sale_id, user_id, reason
    ) values (
      v_item.product_id, v_location_id, 'sale', -v_item.quantity,
      v_inv.quantity, v_new_qty, v_product.cost_price, v_sale.id, auth.uid(), 'POS sale'
    );
  end loop;

  insert into public.payments (sale_id, payment_method, amount, amount_received, change_amount)
  values (v_sale.id, v_payment_method, v_total, v_amount_received, v_change);

  update public.cashier_shifts
  set cash_sales = cash_sales + (case when v_payment_method = 'cash' then v_total else 0 end),
      card_sales = card_sales + (case when v_payment_method = 'card' then v_total else 0 end),
      other_sales = other_sales + (case when v_payment_method not in ('cash','card') then v_total else 0 end)
  where id = v_shift.id;

  insert into public.receipts (sale_id, receipt_number)
  values (v_sale.id, v_receipt_number);

  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------
-- 24.4 receive_stock  (Purchase / Stock Receiving — SRS §13, §14)
--
-- p_payload shape:
-- {
--   "supplier_id": "uuid",
--   "reference_number": "PO-123",
--   "paid_amount": 0,
--   "items": [
--     {"product_id":"uuid","quantity":100,"unit_cost":50,"tax_amount":0}
--   ]
-- }
-- ---------------------------------------------------------------------
create or replace function public.receive_stock(p_payload jsonb)
returns public.purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location_id     uuid;
  v_item            record;
  v_subtotal        numeric := 0;
  v_tax             numeric := 0;
  v_total           numeric;
  v_paid            numeric := coalesce((p_payload->>'paid_amount')::numeric, 0);
  v_purchase        public.purchases;
  v_purchase_number text;
  v_inv             public.inventory;
  v_new_qty         numeric;
begin
  if not (public.is_manager_or_admin() or public.is_inventory_staff()) then
    raise exception 'Not authorized to receive stock';
  end if;

  select id into v_location_id from public.locations where is_default = true limit 1;

  for v_item in
    select * from jsonb_to_recordset(p_payload->'items') as x(
      product_id uuid, quantity numeric, unit_cost numeric, tax_amount numeric
    )
  loop
    v_subtotal := v_subtotal + (v_item.quantity * v_item.unit_cost);
    v_tax := v_tax + coalesce(v_item.tax_amount, 0);
  end loop;
  v_total := v_subtotal + v_tax;

  v_purchase_number := public.generate_document_number('PO-', 'public.purchase_number_seq');

  insert into public.purchases (
    purchase_number, supplier_id, reference_number,
    subtotal, tax_amount, total_amount, paid_amount,
    payment_status, status, created_by
  ) values (
    v_purchase_number, (p_payload->>'supplier_id')::uuid, p_payload->>'reference_number',
    v_subtotal, v_tax, v_total, v_paid,
    (case when v_paid >= v_total then 'paid' when v_paid > 0 then 'partial' else 'pending' end)::public.payment_status,
    'received', auth.uid()
  ) returning * into v_purchase;

  for v_item in
    select * from jsonb_to_recordset(p_payload->'items') as x(
      product_id uuid, quantity numeric, unit_cost numeric, tax_amount numeric
    )
  loop
    insert into public.purchase_items (purchase_id, product_id, quantity, unit_cost, tax_amount, total_cost)
    values (
      v_purchase.id, v_item.product_id, v_item.quantity, v_item.unit_cost,
      coalesce(v_item.tax_amount, 0), (v_item.quantity * v_item.unit_cost) + coalesce(v_item.tax_amount, 0)
    );

    select * into v_inv from public.inventory
      where product_id = v_item.product_id and location_id = v_location_id
      for update;

    if v_inv is null then
      insert into public.inventory (product_id, location_id, quantity)
      values (v_item.product_id, v_location_id, 0)
      returning * into v_inv;
    end if;

    v_new_qty := v_inv.quantity + v_item.quantity;
    update public.inventory set quantity = v_new_qty where id = v_inv.id;

    insert into public.inventory_transactions (
      product_id, location_id, transaction_type, quantity,
      previous_quantity, new_quantity, unit_cost, related_purchase_id, user_id, reason
    ) values (
      v_item.product_id, v_location_id, 'purchase', v_item.quantity,
      v_inv.quantity, v_new_qty, v_item.unit_cost, v_purchase.id, auth.uid(), 'Stock receiving'
    );
  end loop;

  update public.suppliers
  set current_balance = current_balance + (v_total - v_paid)
  where id = v_purchase.supplier_id;

  return v_purchase;
end;
$$;

-- ---------------------------------------------------------------------
-- 24.5 process_return  (Sales Return — SRS §23)
--
-- p_payload shape:
-- {
--   "original_sale_id": "uuid",
--   "reason": "Damaged item",
--   "items": [ {"sale_item_id":"uuid","quantity":1} ]
-- }
-- ---------------------------------------------------------------------
create or replace function public.process_return(p_payload jsonb)
returns public.returns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location_id      uuid;
  v_item             record;
  v_sale_item        public.sale_items;
  v_available        numeric;
  v_line_refund      numeric;
  v_total_refund     numeric := 0;
  v_return           public.returns;
  v_return_number    text;
  v_inv              public.inventory;
  v_new_qty          numeric;
  v_sale             public.sales;
  v_all_returned     boolean;
  v_any_returned     boolean;
begin
  if not (public.is_manager_or_admin() or public.has_permission('process_returns')) then
    raise exception 'Not authorized to process returns';
  end if;

  select * into v_sale from public.sales where id = (p_payload->>'original_sale_id')::uuid;
  if v_sale is null then
    raise exception 'Original sale not found';
  end if;

  select id into v_location_id from public.locations where is_default = true limit 1;
  v_return_number := public.generate_document_number('RT-', 'public.return_number_seq');

  insert into public.returns (return_number, original_sale_id, customer_id, reason, processed_by, status)
  values (v_return_number, v_sale.id, v_sale.customer_id, p_payload->>'reason', auth.uid(), 'completed')
  returning * into v_return;

  for v_item in
    select * from jsonb_to_recordset(p_payload->'items') as x(sale_item_id uuid, quantity numeric)
  loop
    select * into v_sale_item from public.sale_items where id = v_item.sale_item_id for update;
    if v_sale_item is null or v_sale_item.sale_id <> v_sale.id then
      raise exception 'Sale item % does not belong to this sale', v_item.sale_item_id;
    end if;

    v_available := v_sale_item.quantity - v_sale_item.returned_quantity;
    if v_item.quantity > v_available then
      raise exception 'Cannot return % of product %, only % available to return',
        v_item.quantity, v_sale_item.product_id, v_available;
    end if;

    v_line_refund := round((v_sale_item.line_total / v_sale_item.quantity) * v_item.quantity, 2);
    v_total_refund := v_total_refund + v_line_refund;

    insert into public.return_items (return_id, sale_item_id, product_id, quantity, unit_price, line_refund)
    values (v_return.id, v_sale_item.id, v_sale_item.product_id, v_item.quantity, v_sale_item.unit_price, v_line_refund);

    update public.sale_items
    set returned_quantity = returned_quantity + v_item.quantity
    where id = v_sale_item.id;

    select * into v_inv from public.inventory
      where product_id = v_sale_item.product_id and location_id = v_location_id
      for update;

    v_new_qty := coalesce(v_inv.quantity, 0) + v_item.quantity;

    if v_inv is null then
      insert into public.inventory (product_id, location_id, quantity)
      values (v_sale_item.product_id, v_location_id, v_new_qty);
    else
      update public.inventory set quantity = v_new_qty where id = v_inv.id;
    end if;

    insert into public.inventory_transactions (
      product_id, location_id, transaction_type, quantity,
      previous_quantity, new_quantity, unit_cost, related_return_id, user_id, reason
    ) values (
      v_sale_item.product_id, v_location_id, 'sale_return', v_item.quantity,
      coalesce(v_inv.quantity, 0), v_new_qty, v_sale_item.unit_cost, v_return.id, auth.uid(), 'Sales return'
    );
  end loop;

  update public.returns set refund_amount = v_total_refund where id = v_return.id;

  -- Feed the refund into the processing cashier's currently open shift (if any)
  -- so cash reconciliation at shift close accounts for money paid back out.
  update public.cashier_shifts
  set total_returns = total_returns + v_total_refund
  where cashier_id = auth.uid() and status = 'open';

  select
    bool_and(returned_quantity >= quantity),
    bool_or(returned_quantity > 0)
  into v_all_returned, v_any_returned
  from public.sale_items where sale_id = v_sale.id;

  update public.sales
  set status = case
        when v_all_returned then 'fully_returned'
        when v_any_returned then 'partially_returned'
        else status
      end
  where id = v_sale.id;

  select * into v_return from public.returns where id = v_return.id;
  return v_return;
end;
$$;

-- ---------------------------------------------------------------------
-- 24.6 adjust_stock  (Manual adjustments, damage, expiry, stock counts)
--
-- p_payload shape:
-- {
--   "type": "damage",
--   "reason": "Broken during shelving",
--   "items": [ {"product_id":"uuid","quantity_change":-3} ]
-- }
-- ---------------------------------------------------------------------
create or replace function public.adjust_stock(p_payload jsonb)
returns public.stock_adjustments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location_id   uuid;
  v_item          record;
  v_adjustment    public.stock_adjustments;
  v_adj_number    text;
  v_txn_type      public.transaction_type;
  v_inv           public.inventory;
  v_new_qty       numeric;
  v_product       public.products;
begin
  if not (public.is_manager_or_admin() or public.has_permission('adjust_inventory')) then
    raise exception 'Not authorized to adjust inventory';
  end if;

  select id into v_location_id from public.locations where is_default = true limit 1;
  v_adj_number := public.generate_document_number('ADJ-', 'public.adjustment_number_seq');

  v_txn_type := (case p_payload->>'type'
    when 'damage' then 'damage'
    when 'expiry' then 'expiry'
    when 'stock_count' then 'stock_count_adjustment'
    else 'manual_adjustment'
  end)::public.transaction_type;

  insert into public.stock_adjustments (adjustment_number, type, reason, status, created_by, approved_by, approved_at)
  values (
    v_adj_number, (p_payload->>'type')::public.adjustment_type, p_payload->>'reason',
    'approved', auth.uid(), auth.uid(), now()
  ) returning * into v_adjustment;

  for v_item in
    select * from jsonb_to_recordset(p_payload->'items') as x(product_id uuid, quantity_change numeric)
  loop
    select * into v_product from public.products where id = v_item.product_id;

    select * into v_inv from public.inventory
      where product_id = v_item.product_id and location_id = v_location_id
      for update;

    if v_inv is null then
      insert into public.inventory (product_id, location_id, quantity)
      values (v_item.product_id, v_location_id, 0)
      returning * into v_inv;
    end if;

    v_new_qty := v_inv.quantity + v_item.quantity_change;

    if v_new_qty < 0 and not v_product.allow_negative_stock then
      raise exception 'Adjustment would make stock negative for product %', v_product.name;
    end if;

    update public.inventory set quantity = v_new_qty where id = v_inv.id;

    insert into public.stock_adjustment_items (adjustment_id, product_id, location_id, quantity_change, previous_quantity, new_quantity)
    values (v_adjustment.id, v_item.product_id, v_location_id, v_item.quantity_change, v_inv.quantity, v_new_qty);

    insert into public.inventory_transactions (
      product_id, location_id, transaction_type, quantity,
      previous_quantity, new_quantity, related_adjustment_id, user_id, reason
    ) values (
      v_item.product_id, v_location_id, v_txn_type, v_item.quantity_change,
      v_inv.quantity, v_new_qty, v_adjustment.id, auth.uid(), p_payload->>'reason'
    );
  end loop;

  return v_adjustment;
end;
$$;

grant execute on function public.open_cashier_shift(numeric) to authenticated;
grant execute on function public.close_cashier_shift(uuid, numeric) to authenticated;
grant execute on function public.process_sale(jsonb) to authenticated;
grant execute on function public.receive_stock(jsonb) to authenticated;
grant execute on function public.process_return(jsonb) to authenticated;
grant execute on function public.adjust_stock(jsonb) to authenticated;


-- =====================================================================
-- 25. REPORTING VIEWS (dashboard / low-stock / sales summaries)
--     security_invoker = true means these respect the querying user's
--     own RLS on the underlying tables (Postgres 15+).
-- =====================================================================
create view public.v_current_stock
with (security_invoker = true) as
select
  p.id as product_id, p.name, p.sku, p.barcode, p.category_id, p.min_stock_level,
  coalesce(sum(i.quantity), 0) as total_quantity,
  case
    when coalesce(sum(i.quantity), 0) <= 0 then 'out_of_stock'
    when coalesce(sum(i.quantity), 0) <= p.min_stock_level then 'low_stock'
    when not p.is_active then 'inactive'
    else 'in_stock'
  end as stock_status
from public.products p
left join public.inventory i on i.product_id = p.id
group by p.id;

create view public.v_low_stock_products
with (security_invoker = true) as
select * from public.v_current_stock where stock_status in ('low_stock', 'out_of_stock');

create view public.v_sales_daily_summary
with (security_invoker = true) as
select
  date_trunc('day', s.created_at) as sale_date,
  count(distinct s.id) as total_transactions,
  sum(s.total_amount) as total_sales,
  sum(si.quantity) as items_sold,
  sum(si.unit_cost * si.quantity) as cogs,
  sum(s.total_amount) - sum(si.unit_cost * si.quantity) as gross_profit
from public.sales s
join public.sale_items si on si.sale_id = s.id
where s.status in ('completed', 'partially_returned')
group by date_trunc('day', s.created_at);


-- =====================================================================
-- 26. GRANTS
--     Supabase's `authenticated` role needs table-level privileges
--     before RLS policies can take effect at all. RLS still governs
--     which rows/operations are actually allowed.
-- =====================================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
revoke all on all tables in schema public from anon;


-- =====================================================================
-- 27. SEED DATA
-- =====================================================================
insert into public.locations (name, is_default) values ('Main Store', true);

insert into public.categories (name) values
  ('Beverages'), ('Dairy'), ('Bakery'), ('Snacks'),
  ('Grocery'), ('Household'), ('Personal Care'), ('Frozen Food');

insert into public.expense_categories (name) values
  ('Rent'), ('Electricity'), ('Salaries'), ('Transport'),
  ('Maintenance'), ('Supplies'), ('Other');

insert into public.customers (name, is_walk_in) values ('Walk-in Customer', true);

insert into public.settings (key, value, description) values
  ('business_name', '"My Mart"', 'Printed on receipts'),
  ('business_contact', '""', 'Phone/address printed on receipts'),
  ('receipt_footer', '"Thank you for shopping with us!"', 'Receipt footer message'),
  ('currency', '"PKR"', 'Default currency code'),
  ('receipt_width_mm', '80', 'Thermal receipt width: 58 or 80');

-- =====================================================================
-- END OF SCHEMA
-- =====================================================================
