import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  UserCheck,
  Building,
  Printer,
  DollarSign,
  Save,
  CheckCircle2,
  Lock,
  LogOut,
  Sparkles
} from 'lucide-react';
import { getSettings, updateSettings, BusinessSettings } from '../services/settingsService';
import {
  getCurrentUser,
  logout,
  AuthUser,
  KNOWN_ACCOUNTS
} from '../services/authService';

export const SettingsView: React.FC = () => {
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

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-mart-800" />
            <span>Store & System Settings</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure store receipt details, thermal printer layout, and inspect active administrator credentials.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-semibold shadow-xs transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out Session</span>
        </button>
      </div>

      {/* Success Notification */}
      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-orange-950 flex items-center space-x-3 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-orange-600" />
          <span className="text-sm font-semibold">Settings successfully saved and synced with Supabase!</span>
        </div>
      )}

      {/* 1. Active Account Profile Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-mart-900 text-white flex items-center justify-center font-bold text-lg shadow-md">
              {currentUser ? currentUser.full_name.charAt(0) : 'A'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-slate-900">
                  {currentUser ? currentUser.full_name : KNOWN_ACCOUNTS.admin.name}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-900 border border-orange-200">
                  Administrator
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                {currentUser ? currentUser.email : KNOWN_ACCOUNTS.admin.email} &bull; Full Privileges Enabled
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center space-x-1 text-xs text-orange-800 font-semibold bg-orange-50 px-3 py-1.5 rounded-full border border-orange-200">
            <ShieldCheck className="w-4 h-4 text-orange-600" />
            <span>Authenticated Session</span>
          </div>
        </div>
      </div>

      {/* 2. Store Business & Receipt Settings Form */}
      <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <Building className="w-5 h-5 text-mart-800" />
          <h2 className="font-bold text-base text-slate-900">Store Identity & Thermal Receipt Setup</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Mart Business Name *</label>
            <input
              type="text"
              required
              value={settings.business_name}
              onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 font-medium"
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
              className="w-full px-4 py-2.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 font-medium"
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
              className="w-full px-4 py-2.5 rounded-full border border-slate-200 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800"
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
            className="w-full px-4 py-2.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 font-medium"
          />
          <p className="text-[11px] text-slate-400 mt-1">Printed at bottom of thermal slips</p>
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-full bg-mart-900 text-white font-semibold text-xs hover:bg-mart-800 transition-all flex items-center space-x-2 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4 text-mart-200" />
            <span>{saving ? 'Saving...' : 'Save & Sync Settings'}</span>
          </button>
        </div>
      </form>

      {/* 3. System Roles & Access Overview */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <ShieldCheck className="w-5 h-5 text-mart-800" />
          <div>
            <h2 className="font-bold text-base text-slate-900">A-Mart Authorized Role Specifications</h2>
            <p className="text-xs text-slate-500">Access control enforcing role-based boundaries</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          
          {/* Admin */}
          <div className="p-4 rounded-2xl border border-orange-200 bg-orange-50/40 space-y-2">
            <div className="flex items-center justify-between">
              <strong className="text-orange-950 font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-orange-600" />
                <span>Admin ({KNOWN_ACCOUNTS.admin.email})</span>
              </strong>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-600 text-white uppercase">
                All Modules
              </span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Full administrative privileges. Can view and modify all 9 modules: Dashboard analytics, Product Catalog, Stock Receiving (GRN), Stock Adjustments, Movement Ledger, POS Terminal, Suppliers, Shifts, and Store Settings.
            </p>
          </div>

          {/* Staff */}
          <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/40 space-y-2">
            <div className="flex items-center justify-between">
              <strong className="text-blue-950 font-bold flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-700" />
                <span>Staff ({KNOWN_ACCOUNTS.staff.email})</span>
              </strong>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 uppercase">
                Restricted
              </span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Restricted cashier privileges. Strictly limited to Point of Sale (POS) checkouts and read-only Product List lookup. Administrative management, supplier balances, stock receiving, and settings are hidden.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
};
