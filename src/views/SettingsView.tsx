import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  UserCheck,
  Building,
  Printer,
  DollarSign,
  Save,
  CheckCircle2,
  Lock,
  Unlock,
  Users,
  LogOut,
  LogIn,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { getSettings, updateSettings, BusinessSettings } from '../services/settingsService';
import {
  getCurrentUser,
  loginAsRole,
  logout,
  AuthUser,
  ROLE_PROFILES
} from '../services/authService';
import { AppRole } from '../types/database';

interface SettingsViewProps {
  onOpenLoginModal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenLoginModal }) => {
  const [settings, setSettings] = useState<BusinessSettings>({
    business_name: '',
    business_contact: '',
    receipt_footer: '',
    currency: 'PKR',
    receipt_width_mm: 80
  });

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(getCurrentUser());
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings(settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleSwitch = (role: AppRole) => {
    const user = loginAsRole(role);
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-mart-800" />
            <span>A-Mart System Settings & Role Management</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure store receipt details, inspect role-based access control (RBAC), and manage user sessions.
          </p>
        </div>

        {currentUser ? (
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-semibold shadow-xs transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Session</span>
          </button>
        ) : (
          <button
            onClick={onOpenLoginModal}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-mart-900 text-white hover:bg-mart-800 text-xs font-semibold shadow-sm transition-all"
          >
            <LogIn className="w-4 h-4 text-mart-200" />
            <span>Sign In to Account</span>
          </button>
        )}
      </div>

      {/* Success Notification */}
      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center space-x-3 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-semibold">Settings successfully saved and synced with Supabase!</span>
        </div>
      )}

      {/* 1. Active Account Profile Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-mart-900 text-white flex items-center justify-center font-bold text-lg shadow-md">
              {currentUser ? currentUser.full_name.charAt(0) : '?'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-slate-900">
                  {currentUser ? currentUser.full_name : 'No Active Session (Guest)'}
                </h3>
                {currentUser && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {currentUser.role.replace('_', ' ')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentUser ? `${currentUser.email} • Code: ${currentUser.employee_code || 'EMP-001'}` : 'Sign in to access protected management features'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Role Switcher */}
        <div className="pt-4 border-t border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
            Switch Active Role (Testing & Simulation)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {(['super_admin', 'admin_manager', 'cashier', 'inventory_staff'] as AppRole[]).map((r) => {
              const profile = ROLE_PROFILES[r];
              const isCurrent = currentUser?.role === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleSwitch(r)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isCurrent
                      ? 'border-mart-800 bg-mart-50/80 text-mart-950 ring-2 ring-mart-800/10 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold capitalize">{r.replace('_', ' ')}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">{profile.full_name}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Store Business & Receipt Settings Form */}
      <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <Building className="w-5 h-5 text-mart-800" />
          <h2 className="font-bold text-base text-slate-900">Store Identity & Receipt Details</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Mart Business Name *</label>
            <input
              type="text"
              required
              value={settings.business_name}
              onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 font-medium"
            />
            <p className="text-[11px] text-slate-400 mt-1">Printed at top of customer receipts</p>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Contact Details & Address *</label>
            <input
              type="text"
              required
              value={settings.business_contact}
              onChange={(e) => setSettings({ ...settings, business_contact: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 font-medium"
            />
            <p className="text-[11px] text-slate-400 mt-1">Store phone number, address, or NTN</p>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Currency Code *</label>
            <input
              type="text"
              required
              value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800"
            />
            <p className="text-[11px] text-slate-400 mt-1">e.g. PKR, USD, EUR</p>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Receipt Width (Thermal Printer)</label>
            <div className="flex items-center space-x-4 pt-1.5">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="receipt_width"
                  checked={settings.receipt_width_mm === 80}
                  onChange={() => setSettings({ ...settings, receipt_width_mm: 80 })}
                  className="text-mart-800 focus:ring-mart-800"
                />
                <span className="font-semibold text-slate-700">80mm (Standard POS)</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="receipt_width"
                  checked={settings.receipt_width_mm === 58}
                  onChange={() => setSettings({ ...settings, receipt_width_mm: 58 })}
                  className="text-mart-800 focus:ring-mart-800"
                />
                <span className="font-semibold text-slate-700">58mm (Compact Mobile)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="text-xs">
          <label className="font-semibold text-slate-700 block mb-1">Thermal Receipt Footer Message</label>
          <input
            type="text"
            value={settings.receipt_footer}
            onChange={(e) => setSettings({ ...settings, receipt_footer: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 font-medium"
          />
          <p className="text-[11px] text-slate-400 mt-1">Printed at bottom of thermal slips</p>
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-mart-900 text-white font-semibold text-xs hover:bg-mart-800 transition-all flex items-center space-x-2 shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-mart-200" />
            <span>{saving ? 'Saving...' : 'Save & Sync Settings'}</span>
          </button>
        </div>
      </form>

      {/* 3. System Roles & Security Architecture (Schema Analysis) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <Shield className="w-5 h-5 text-mart-800" />
          <div>
            <h2 className="font-bold text-base text-slate-900">System Roles & RBAC Matrix</h2>
            <p className="text-xs text-slate-500">Defined in PostgreSQL enum `public.app_role` and `user_permissions`</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          
          {/* super_admin */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <strong className="text-slate-900 font-bold">1. Super Admin (super_admin)</strong>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-800 uppercase">Root</span>
            </div>
            <p className="text-slate-600 text-[11px]">
              Full authorization. Can change staff roles, modify database settings, view all financial audit logs, and oversee all branches.
            </p>
          </div>

          {/* admin_manager */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <strong className="text-slate-900 font-bold">2. Admin Manager (admin_manager)</strong>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800 uppercase">Manager</span>
            </div>
            <p className="text-slate-600 text-[11px]">
              Store manager with full catalog access, profit analytics, wholesale cost visibility, stock adjustment approvals, and expense logging.
            </p>
          </div>

          {/* cashier */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <strong className="text-slate-900 font-bold">3. Cashier (cashier)</strong>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 uppercase">POS Terminal</span>
            </div>
            <p className="text-slate-600 text-[11px]">
              Dedicated checkout operator. Operates shift sessions, scans items, issues receipts. Wholesale costs and gross margins are strictly hidden.
            </p>
          </div>

          {/* inventory_staff */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <strong className="text-slate-900 font-bold">4. Inventory Staff (inventory_staff)</strong>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 uppercase">Warehouse</span>
            </div>
            <p className="text-slate-600 text-[11px]">
              Receives purchase consignments, logs damaged and expired write-offs, performs cycle counts, and updates supplier delivery notes.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
};
