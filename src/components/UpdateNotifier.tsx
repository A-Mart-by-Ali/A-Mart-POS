import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, X, ArrowUpCircle, CheckCircle } from 'lucide-react';
import { subscribeUpdateStatus, checkForUpdates, applyUpdate, SystemStatus } from '../services/updateService';

export const UpdateNotifier: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus>({
    hasUpdate: false,
    pendingCommits: 0,
    message: '',
    isUpdating: false,
    offline: false,
    version: '1.0.0',
    mode: 'web',
    lastChecked: null
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeUpdateStatus(setStatus);
    // Initial check on mount
    checkForUpdates();
    return () => unsubscribe();
  }, []);

  if (!status.hasUpdate || dismissed) {
    return null;
  }

  const handleUpdate = async () => {
    await applyUpdate();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 p-4 transition-all duration-300 animate-slide-up">
      <div className="flex items-start justify-between gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-orange-400">
              Update Available
            </h4>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
              v{status.version}
            </span>
          </div>
          
          <p className="text-xs text-slate-200 mt-1 line-clamp-2">
            {status.message || 'A new version of A-Mart POS is ready to install.'}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleUpdate}
              disabled={status.isUpdating}
              className="flex-1 py-1.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {status.isUpdating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Installing...</span>
                </>
              ) : (
                <>
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                  <span>Update & Reload</span>
                </>
              )}
            </button>

            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
