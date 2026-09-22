import React, { useState } from 'react';
import {
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle2,
  Store,
  ShoppingBag,
  TrendingUp,
  BarChart3,
  Sparkles
} from 'lucide-react';
import { loginWithEmail, requestPasswordReset, AuthUser } from '../services/authService';
import { isSupabaseConfigured } from '../services/supabase';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (!password.trim()) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const user = await loginWithEmail(email, password);
      onLoginSuccess(user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const message = await requestPasswordReset(email);
      setSuccessMsg(message);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to process recovery request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#eef2f6] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      
      {/* Split Card Container (Matched to user reference design) */}
      <div className="w-full max-w-4xl min-h-[540px] sm:min-h-[600px] bg-white rounded-[32px] sm:rounded-[44px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)] overflow-hidden grid grid-cols-1 md:grid-cols-2 relative z-10 border border-slate-200/60 my-auto">
        
        {/* ================= LEFT SIDE: WHITE LOGO & ILLUSTRATION PANEL ================= */}
        <div className="bg-white p-8 sm:p-12 flex flex-col justify-between items-center text-center relative overflow-hidden order-2 md:order-1">
          
          {/* Top: Designated Logo Placeholder (ready for user logo) */}
          <div className="w-full flex items-center justify-start space-x-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-orange-600/30 tracking-tighter">
              A
            </div>
            <div className="text-left">
              <span className="font-extrabold text-lg text-slate-900 tracking-tight block leading-tight">
                A-Mart
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-orange-600">
                Retail & POS Platform
              </span>
            </div>
          </div>

          {/* Center Illustration Area (Dashboard & Retail Graphic) */}
          <div className="my-auto py-6 flex flex-col items-center justify-center w-full max-w-xs">
            <div className="relative w-64 h-64 flex items-center justify-center">
              {/* Background ambient circular shapes */}
              <div className="w-48 h-48 rounded-full bg-orange-50/80 absolute -top-4 -left-4"></div>
              <div className="w-40 h-40 rounded-full bg-slate-100 absolute -bottom-4 -right-4"></div>

              {/* Graphic Composition */}
              <svg viewBox="0 0 240 240" className="w-full h-full relative z-10 drop-shadow-sm" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Dashboard Card Behind */}
                <rect x="35" y="30" width="130" height="150" rx="14" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="2" />
                <rect x="47" y="44" width="60" height="8" rx="4" fill="#CBD5E1" />
                <rect x="47" y="60" width="105" height="6" rx="3" fill="#E2E8F0" />
                <rect x="47" y="74" width="90" height="6" rx="3" fill="#E2E8F0" />
                
                {/* Mini Graph bars in background */}
                <rect x="47" y="100" width="18" height="55" rx="4" fill="#EA580C" fillOpacity="0.2" />
                <rect x="73" y="115" width="18" height="40" rx="4" fill="#EA580C" fillOpacity="0.4" />
                <rect x="99" y="85" width="18" height="70" rx="4" fill="#EA580C" />
                <rect x="125" y="105" width="18" height="50" rx="4" fill="#FED7AA" />

                {/* Overlapping Foreground Mobile Card */}
                <rect x="110" y="70" width="95" height="135" rx="16" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
                <rect x="135" y="78" width="45" height="5" rx="2.5" fill="#94A3B8" />
                
                {/* Shopping Bag Icon in Mobile Card */}
                <circle cx="157" cy="115" r="22" fill="#FFF7ED" stroke="#EA580C" strokeWidth="2" />
                <path d="M151 113h12v12h-12z" stroke="#EA580C" strokeWidth="2" strokeLinejoin="round" />
                <path d="M154 113v-3a3 3 0 016 0v3" stroke="#EA580C" strokeWidth="1.8" strokeLinecap="round" />

                {/* Success metric pill */}
                <rect x="125" y="152" width="65" height="16" rx="8" fill="#F0FDF4" stroke="#BBF7D0" strokeWidth="1.5" />
                <circle cx="134" cy="160" r="3" fill="#16A34A" />
                <rect x="142" y="157" width="40" height="5" rx="2" fill="#16A34A" />

                {/* Decorative floating dots/leaves */}
                <circle cx="28" cy="110" r="5" fill="#FED7AA" />
                <circle cx="195" cy="45" r="7" fill="#EA580C" fillOpacity="0.3" />
                <circle cx="210" cy="170" r="4" fill="#CBD5E1" />
              </svg>
            </div>

            <p className="text-xs text-slate-500 mt-2 font-medium">
              Enterprise Retail & Point of Sale Management
            </p>
          </div>

          {/* Bottom helper text */}
          <div className="w-full text-left text-[11px] text-slate-400">
            A-Mart Supermarket &bull; Authorized Access
          </div>

        </div>

        {/* ================= RIGHT SIDE: VIBRANT ORANGE LOGIN FORM ================= */}
        <div className="bg-orange-600 p-8 sm:p-12 flex flex-col justify-between text-white relative order-1 md:order-2">
          
          <div>
            {!isForgotPassword ? (
              /* --- SIGN IN FORM --- */
              <div>
                <h1 className="text-3xl sm:text-4xl font-normal text-white tracking-tight mb-2">
                  Sign In
                </h1>
                <p className="text-white/80 text-xs sm:text-sm font-normal mb-8">
                  Sign In to continue to our application.
                </p>

                {/* Error Banner */}
                {errorMsg && (
                  <div className="mb-4 p-3 rounded-2xl bg-white/15 border border-white/30 text-white text-xs font-medium flex items-center space-x-2 animate-fade-in">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-white" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {/* Email Input (Solid White Pill Capsule) */}
                  <div className="relative">
                    <input
                      type="email"
                      required
                      autoFocus
                      placeholder="tskeyan@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-6 pr-12 py-3.5 sm:py-4 rounded-full bg-white text-slate-800 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-black/15 shadow-sm transition-all"
                    />
                    <Mail className="w-5 h-5 text-orange-500 absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[1.8]" />
                  </div>

                  {/* Password Input (Translucent Outlined Pill Capsule) */}
                  <div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-6 pr-12 py-3.5 sm:py-4 rounded-full border border-white/60 bg-white/10 hover:bg-white/15 focus:bg-white/20 focus:border-white text-white placeholder-white/70 text-sm font-medium focus:outline-none transition-all shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                        className="w-8 h-8 rounded-full absolute right-3.5 top-1/2 -translate-y-1/2 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Forgot Password Link */}
                    <div className="text-right mt-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setErrorMsg('');
                          setSuccessMsg('');
                        }}
                        className="text-white/85 hover:text-white text-xs transition-colors cursor-pointer inline-block"
                      >
                        I can't remember my password
                      </button>
                    </div>
                  </div>

                  {/* Sign In Button (Deep Dark Orange Capsule with Arrow) */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-full bg-orange-800/90 hover:bg-orange-800 active:scale-[0.99] text-white font-medium text-sm shadow-lg shadow-orange-950/25 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 mt-6 tracking-wide"
                  >
                    <span>{loading ? 'Signing In...' : 'Sign In'}</span>
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>
              </div>
            ) : (
              /* --- RESET PASSWORD FORM --- */
              <div>
                <h1 className="text-3xl sm:text-4xl font-normal text-white tracking-tight mb-2">
                  Recovery
                </h1>
                <p className="text-white/80 text-xs sm:text-sm font-normal mb-8">
                  Enter your email to recover your credentials.
                </p>

                {/* Success Message */}
                {successMsg && (
                  <div className="mb-4 p-3.5 rounded-2xl bg-white/20 border border-white/40 text-white text-xs font-medium flex items-start space-x-2 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-white mt-0.5 flex-shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Error Message */}
                {errorMsg && (
                  <div className="mb-4 p-3 rounded-2xl bg-white/15 border border-white/30 text-white text-xs font-medium flex items-center space-x-2 animate-fade-in">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-white" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleResetSubmit} className="space-y-4">
                  <div className="relative">
                    <input
                      type="email"
                      required
                      autoFocus
                      placeholder="name@a-mart.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-6 pr-12 py-3.5 sm:py-4 rounded-full bg-white text-slate-800 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-black/15 shadow-sm transition-all"
                    />
                    <Mail className="w-5 h-5 text-orange-500 absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[1.8]" />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-full bg-orange-800/90 hover:bg-orange-800 active:scale-[0.99] text-white font-medium text-sm shadow-lg shadow-orange-950/25 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 mt-6 tracking-wide"
                  >
                    <span>{loading ? 'Sending Instructions...' : 'Send Recovery Link'}</span>
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>

                  <div className="text-center mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(false);
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="text-white/85 hover:text-white text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Sign In</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Footer note matching reference style */}
          <div className="text-center text-xs text-white/80 mt-8">
            <span>Secured POS Terminal &bull; </span>
            <span className="font-bold text-white">A-Mart Retail</span>
          </div>

        </div>

      </div>

    </div>
  );
};

export default LoginPage;
