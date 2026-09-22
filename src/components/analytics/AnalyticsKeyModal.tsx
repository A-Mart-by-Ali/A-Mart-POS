import React, { useState, useEffect, useRef } from 'react';
import {
  KeyRound,
  ShieldAlert,
  Unlock,
  Eye,
  EyeOff
} from 'lucide-react';
import { unlockAnalyticsWithKey } from '../../services/analyticsService';
import { Modal } from '../common/Modal';

interface AnalyticsKeyModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export const AnalyticsKeyModal: React.FC<AnalyticsKeyModalProps> = ({
  isOpen,
  onSuccess,
  onCancel
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setKeyInput('');
      setErrorMsg('');
      setShowKey(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) {
      setErrorMsg('Please enter the security access key.');
      return;
    }

    const verified = unlockAnalyticsWithKey(keyInput);
    if (verified) {
      setErrorMsg('');
      onSuccess();
    } else {
      setErrorMsg('Invalid Security Key. Access Denied.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      size="md"
      centeredHeader
      icon={<KeyRound className="w-7 h-7 text-mart-900" />}
      title="Security Key Required"
      subtitle="Access to Sales & Financial Analytics is protected. Please enter your authorization key to proceed."
      className={shake ? 'animate-bounce' : ''}
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center space-x-2 animate-fade-in">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-5">
          <div>
            <label className="font-bold text-slate-700 block mb-1.5 text-xs text-center uppercase tracking-wider">
              Authorization Key
            </label>
            <div className="relative max-w-xs mx-auto">
              <input
                ref={inputRef}
                type={showKey ? 'text' : 'password'}
                required
                placeholder="••••"
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                className="w-full px-4 py-3 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 font-mono text-center text-xl tracking-[0.3em] font-bold text-slate-900 bg-slate-50/70 transition-all"
                maxLength={12}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1.5 rounded-full cursor-pointer transition-colors"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-full bg-mart-900 hover:bg-mart-800 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer hover:shadow-mart"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Unlock Analytics</span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
