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
    title: 'Admin',
    name: 'A-Mart Admin',
    description: 'Full Management: Can see and change everything across all modules.'
  },
  staff: {
    email: 'mani911574@gmail.com',
    password: '9090',
    role: 'cashier' as AppRole,
    title: 'Staff',
    name: 'Store Staff',
    description: 'Restricted Access: Product List and Point of Sale (POS) only.'
  }
};

export const ROLE_PROFILES: Record<'super_admin' | 'cashier', AuthUser> = {
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
  }
};

const AUTH_STORAGE_KEY = 'a_mart_active_user';

export const isAdmin = (user: AuthUser | null): boolean => {
  if (!user) return false;
  return (
    user.email?.toLowerCase() === KNOWN_ACCOUNTS.admin.email.toLowerCase() ||
    user.role === 'super_admin'
  );
};

export const isStaff = (user: AuthUser | null): boolean => {
  if (!user) return false;
  return !isAdmin(user);
};

const getInitialUser = (): AuthUser | null => {
  try {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    // fallback
  }
  // No user by default: Requires authenticating through the Login Page
  return null;
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

export const loginWithEmail = async (email: string, password?: string): Promise<AuthUser> => {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password?.trim() || '';

  if (!cleanEmail || !cleanPassword) {
    throw new Error('Please provide both email and password.');
  }

  // 1. Authenticate with Supabase Auth
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, user_permissions(*)')
          .eq('id', data.user.id)
          .maybeSingle();

        const isUserAdminEmail = cleanEmail === KNOWN_ACCOUNTS.admin.email.toLowerCase();
        const role = (profile?.role || (isUserAdminEmail ? 'super_admin' : 'cashier')) as AppRole;
        const defaultPerms = isUserAdminEmail
          ? ROLE_PROFILES.super_admin.permissions
          : ROLE_PROFILES.cashier.permissions;

        const user: AuthUser = {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          full_name: profile?.full_name || (isUserAdminEmail ? KNOWN_ACCOUNTS.admin.name : KNOWN_ACCOUNTS.staff.name),
          role: role,
          status: profile?.status || 'active',
          employee_code: profile?.employee_code || (isUserAdminEmail ? 'ADM-001' : 'STF-001'),
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
      console.warn('Supabase auth network issue, verifying with verified credentials:', e);
    }
  }

  // 2. Direct verification for known accounts if offline
  if (cleanEmail === KNOWN_ACCOUNTS.admin.email.toLowerCase()) {
    if (cleanPassword !== KNOWN_ACCOUNTS.admin.password) {
      throw new Error('Invalid password. Password for Admin is 1221');
    }
    const user = ROLE_PROFILES.super_admin;
    currentUser = user;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    notify();
    return user;
  }

  if (cleanEmail === KNOWN_ACCOUNTS.staff.email.toLowerCase()) {
    if (cleanPassword !== KNOWN_ACCOUNTS.staff.password) {
      throw new Error('Invalid password. Password for Staff is 9090');
    }
    const user = ROLE_PROFILES.cashier;
    currentUser = user;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    notify();
    return user;
  }

  throw new Error('Unauthorized user. Only registered Admin or Staff can sign in.');
};

export const requestPasswordReset = async (email: string): Promise<string> => {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Please enter your registered email address.');
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin
      });
      if (error) {
        throw new Error(error.message);
      }
      return `Password recovery link sent to ${cleanEmail}. Please check your inbox.`;
    } catch (e: any) {
      if (e.message && !e.message.includes('fetch') && !e.message.includes('Network')) {
        throw e;
      }
    }
  }

  // Known account offline fallback
  if (cleanEmail === KNOWN_ACCOUNTS.admin.email.toLowerCase() || cleanEmail === KNOWN_ACCOUNTS.staff.email.toLowerCase()) {
    const isAdm = cleanEmail === KNOWN_ACCOUNTS.admin.email.toLowerCase();
    return `Account recognized (${isAdm ? 'Administrator' : 'Staff'}). Your password is: ${isAdm ? KNOWN_ACCOUNTS.admin.password : KNOWN_ACCOUNTS.staff.password}`;
  }

  return `If an account exists for ${cleanEmail}, instructions have been sent.`;
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
  const client = supabase;
  client.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      localStorage.removeItem(AUTH_STORAGE_KEY);
      notify();
    } else if (session?.user && (!currentUser || currentUser.id !== session.user.id)) {
      const { data: profile } = await client
        .from('profiles')
        .select('*, user_permissions(*)')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile) {
        const isUserAdmin = profile.email?.toLowerCase() === KNOWN_ACCOUNTS.admin.email.toLowerCase() || profile.role === 'super_admin';
        const role = isUserAdmin ? 'super_admin' : 'cashier';
        const user: AuthUser = {
          ...profile,
          role,
          permissions: profile.user_permissions || (isUserAdmin ? ROLE_PROFILES.super_admin.permissions : ROLE_PROFILES.cashier.permissions)
        };
        currentUser = user;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        notify();
      }
    }
  });
}
