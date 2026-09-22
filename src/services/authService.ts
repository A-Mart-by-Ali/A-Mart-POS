import { supabase, isSupabaseConfigured } from './supabase';
import { Profile, AppRole, UserPermissions } from '../types/database';

export interface AuthUser extends Profile {
  permissions: UserPermissions;
}

export const KNOWN_ACCOUNTS = {
  admin: {
    email: 'uk911574@gmail.com',
    password: '1221',
    role: 'super_admin' as AppRole,
    title: 'Super Admin',
    name: 'A-Mart Admin',
    description: 'Full management: Inventory, Stock GRN, Adjustments, POS, Ledger, Suppliers, Settings.'
  },
  staff: {
    email: 'mani911574@gmail.com',
    password: '9090',
    role: 'cashier' as AppRole,
    title: 'Store Staff',
    name: 'Store Staff',
    description: 'Restricted view: Product List (catalog) and Point of Sale (POS) only.'
  }
};

export const ROLE_PROFILES: Record<AppRole, AuthUser> = {
  super_admin: {
    id: 'a1111111-1111-1111-1111-111111111111',
    full_name: 'A-Mart Admin',
    email: 'uk911574@gmail.com',
    role: 'super_admin',
    status: 'active',
    employee_code: 'ADM-001',
    hire_date: '2025-01-01',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    permissions: {
      profile_id: 'a1111111-1111-1111-1111-111111111111',
      can_view_cost_price: true,
      can_view_profit_reports: true,
      can_apply_discount: true,
      can_process_returns: true,
      can_adjust_inventory: true,
      can_manage_expenses: true,
      can_view_audit_logs: true,
      updated_at: new Date().toISOString()
    }
  },
  admin_manager: {
    id: '00000000-0000-0000-0000-000000000002',
    full_name: 'Store Manager',
    email: 'manager@a-mart.pk',
    role: 'admin_manager',
    status: 'active',
    employee_code: 'MGR-001',
    hire_date: '2025-03-01',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    permissions: {
      profile_id: '00000000-0000-0000-0000-000000000002',
      can_view_cost_price: true,
      can_view_profit_reports: true,
      can_apply_discount: true,
      can_process_returns: true,
      can_adjust_inventory: true,
      can_manage_expenses: true,
      can_view_audit_logs: false,
      updated_at: new Date().toISOString()
    }
  },
  cashier: {
    id: 'b2222222-2222-2222-2222-222222222222',
    full_name: 'Store Staff',
    email: 'mani911574@gmail.com',
    role: 'cashier',
    status: 'active',
    employee_code: 'STF-001',
    hire_date: '2025-06-15',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    permissions: {
      profile_id: 'b2222222-2222-2222-2222-222222222222',
      can_view_cost_price: false,
      can_view_profit_reports: false,
      can_apply_discount: false,
      can_process_returns: false,
      can_adjust_inventory: false,
      can_manage_expenses: false,
      can_view_audit_logs: false,
      updated_at: new Date().toISOString()
    }
  },
  inventory_staff: {
    id: '00000000-0000-0000-0000-000000000004',
    full_name: 'Inventory Staff',
    email: 'inventory@a-mart.pk',
    role: 'inventory_staff',
    status: 'active',
    employee_code: 'INV-001',
    hire_date: '2025-07-01',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    permissions: {
      profile_id: '00000000-0000-0000-0000-000000000004',
      can_view_cost_price: true,
      can_view_profit_reports: false,
      can_apply_discount: false,
      can_process_returns: false,
      can_adjust_inventory: true,
      can_manage_expenses: false,
      can_view_audit_logs: false,
      updated_at: new Date().toISOString()
    }
  }
};

const AUTH_STORAGE_KEY = 'a_mart_active_user';

export const isAdmin = (user: AuthUser | null): boolean => {
  if (!user) return false;
  return (
    user.email?.toLowerCase() === KNOWN_ACCOUNTS.admin.email.toLowerCase() ||
    user.role === 'super_admin' ||
    user.role === 'admin_manager'
  );
};

export const isStaff = (user: AuthUser | null): boolean => {
  return !isAdmin(user);
};

const getInitialUser = (): AuthUser | null => {
  try {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    // fallback
  }
  // Default to Admin profile
  return ROLE_PROFILES.super_admin;
};

let currentUser: AuthUser | null = getInitialUser();

type AuthListener = (user: AuthUser | null) => void;
const listeners: Set<AuthListener> = new Set();
const notify = () => listeners.forEach(l => l(currentUser));

export const subscribeAuth = (listener: AuthListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getCurrentUser = (): AuthUser | null => {
  return currentUser;
};

export const loginAsRole = (role: AppRole): AuthUser => {
  const user = ROLE_PROFILES[role];
  currentUser = user;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  notify();
  return user;
};

export const loginWithEmail = async (email: string, password?: string): Promise<AuthUser> => {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password?.trim() || '';

  // 1. Try Supabase Auth first
  if (isSupabaseConfigured && supabase && cleanPassword) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.user) {
        // Fetch profile and permissions from Supabase
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, user_permissions(*)')
          .eq('id', data.user.id)
          .maybeSingle();

        const role = (profile?.role || (cleanEmail === KNOWN_ACCOUNTS.admin.email ? 'super_admin' : 'cashier')) as AppRole;
        const defaultPerms = ROLE_PROFILES[role]?.permissions || ROLE_PROFILES.cashier.permissions;

        const user: AuthUser = {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          full_name: profile?.full_name || (cleanEmail === KNOWN_ACCOUNTS.admin.email ? KNOWN_ACCOUNTS.admin.name : KNOWN_ACCOUNTS.staff.name),
          role: role,
          status: profile?.status || 'active',
          employee_code: profile?.employee_code || (cleanEmail === KNOWN_ACCOUNTS.admin.email ? 'ADM-001' : 'STF-001'),
          hire_date: profile?.hire_date || null,
          created_at: profile?.created_at || new Date().toISOString(),
          updated_at: profile?.updated_at || new Date().toISOString(),
          permissions: profile?.user_permissions || defaultPerms
        };

        currentUser = user;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        notify();
        return user;
      }
    } catch (e: any) {
      if (e.message && !e.message.includes('fetch') && !e.message.includes('Network')) {
        throw e;
      }
      console.warn('Supabase auth network issue, falling back to local verification:', e);
    }
  }

  // 2. Local credential validation fallback
  if (cleanEmail === KNOWN_ACCOUNTS.admin.email) {
    if (cleanPassword && cleanPassword !== KNOWN_ACCOUNTS.admin.password) {
      throw new Error('Invalid credentials. Password for Admin is 1221');
    }
    const user = ROLE_PROFILES.super_admin;
    currentUser = user;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    notify();
    return user;
  }

  if (cleanEmail === KNOWN_ACCOUNTS.staff.email) {
    if (cleanPassword && cleanPassword !== KNOWN_ACCOUNTS.staff.password) {
      throw new Error('Invalid credentials. Password for Staff is 9090');
    }
    const user = ROLE_PROFILES.cashier;
    currentUser = user;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    notify();
    return user;
  }

  // 3. Fallback match
  const matched = Object.values(ROLE_PROFILES).find(p => p.email?.toLowerCase() === cleanEmail);
  const user = matched || {
    ...ROLE_PROFILES.cashier,
    full_name: cleanEmail.split('@')[0],
    email: cleanEmail
  };

  currentUser = user;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  notify();
  return user;
};

export const logout = async (): Promise<void> => {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignore
    }
  }
  currentUser = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  notify();
};

// Listen for Supabase auth state changes
if (isSupabaseConfigured && supabase) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      localStorage.removeItem(AUTH_STORAGE_KEY);
      notify();
    } else if (session?.user && (!currentUser || currentUser.id !== session.user.id)) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*, user_permissions(*)')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile) {
        const role = profile.role as AppRole;
        const user: AuthUser = {
          ...profile,
          permissions: profile.user_permissions || ROLE_PROFILES[role]?.permissions || ROLE_PROFILES.cashier.permissions
        };
        currentUser = user;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        notify();
      }
    }
  });
}
