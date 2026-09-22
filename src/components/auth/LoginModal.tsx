import React, { useState } from 'react';
import {
  LogIn,
  X,
  Shield,
  User,
  KeyRound,
  CheckCircle2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import {
  loginWithEmail,
  loginAsRole,
  ROLE_PROFILES,
  AuthUser
} from '../../services/authService';
import { AppRole } from '../../types/database';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const user = await loginWithEmail(email, password);
      onSuccess(user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickRole = (role: AppRole) => {
    const user = loginAsRole(role);
    onSuccess(user);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
        
        {/* Header with Dark Green Theme */}
        <div className="p-6 bg-mart-900 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-mart-200 hover:text-white hover:bg-mart-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 rounded-2xl bg-white text-mart-900 font-extrabold text-2xl flex items-center justify-center shadow-md mb-3">
            A
          </div>
          <h2 className="text-xl font-bold tracking-tight">Sign in to A-Mart</h2>
          <p className="text-xs text-mart-200 mt-0.5">
            Select an operational role or authenticate with your account
          </p>
        </div>

        <div className="p-6 space-y-5 text-xs">
          
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium text-xs">
              {errorMsg}
            </div>
          )}

          {/* Quick Demo Role Selector */}
          <div>
            <span className="font-bold text-slate-700 uppercase tracking-wider block mb-2 text-[11px]">
              Instant Role Sign-In (Simulation)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(['super_admin', 'admin_manager', 'cashier', 'inventory_staff'] as AppRole[]).map(role => {
                const p = ROLE_PROFILES[role];
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleQuickRole(role)}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-mart-800 hover:bg-mart-50 text-left transition-all group cursor-pointer"
                  >
                    <div className="font-bold text-slate-800 group-hover:text-mart-900 capitalize text-xs">
                      {role.replace('_', ' ')}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {p.full_name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-2 text-slate-300">
            <div className="flex-1 h-px bg-slate-200"></div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Or Email Sign In</span>
            <div className="flex-1 h-px bg-slate-200"></div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Email Address *</label>
              <input
                type="email"
                required
                placeholder="e.g. admin@a-mart.pk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-mart-900 text-white font-bold text-xs hover:bg-mart-800 transition-all shadow-sm flex items-center justify-center space-x-1.5 disabled:opacity-50 mt-2"
            >
              <span>{submitting ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};
