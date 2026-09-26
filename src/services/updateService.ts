// A-Mart Update & System Synchronization Service

export interface SystemStatus {
  hasUpdate: boolean;
  pendingCommits: number;
  message: string;
  isUpdating: boolean;
  offline: boolean;
  version: string;
  mode: 'desktop' | 'web';
  lastChecked: Date | null;
}

type UpdateListener = (status: SystemStatus) => void;
const listeners = new Set<UpdateListener>();

let status: SystemStatus = {
  hasUpdate: false,
  pendingCommits: 0,
  message: '',
  isUpdating: false,
  offline: !navigator.onLine,
  version: '1.0.0',
  mode: 'web',
  lastChecked: null
};

// Listen to browser online/offline events
window.addEventListener('online', () => {
  status.offline = false;
  notify();
  checkForUpdates();
});

window.addEventListener('offline', () => {
  status.offline = true;
  notify();
});

const notify = () => {
  listeners.forEach(fn => fn({ ...status }));
};

export const subscribeUpdateStatus = (listener: UpdateListener) => {
  listeners.add(listener);
  listener({ ...status });
  return () => {
    listeners.delete(listener);
  };
};

export const getUpdateStatus = (): SystemStatus => ({ ...status });

export const checkForUpdates = async (): Promise<SystemStatus> => {
  status.lastChecked = new Date();

  // 1. Check local desktop server endpoint if available
  try {
    const res = await fetch('/api/system/check-update', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(3500)
    });

    if (res.ok) {
      const data = await res.json();
      status.mode = 'desktop';
      if (data.offline) {
        status.offline = true;
      } else {
        status.offline = false;
        status.hasUpdate = Boolean(data.hasUpdate);
        status.pendingCommits = data.pendingCommits || 0;
        status.message = data.latestMessage || (data.hasUpdate ? 'New update available' : 'System is up to date');
      }
      notify();
      return { ...status };
    }
  } catch (e) {
    // Not running via local desktop server or endpoint not reachable
  }

  // 2. Check Service Worker PWA update if running in browser/PWA
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        if (reg.waiting) {
          status.hasUpdate = true;
          status.message = 'New POS version ready to activate';
          notify();
          return { ...status };
        }
      }
    } catch (_) {}
  }

  status.offline = !navigator.onLine;
  notify();
  return { ...status };
};

export const applyUpdate = async (): Promise<boolean> => {
  status.isUpdating = true;
  notify();

  // If running via desktop server
  if (status.mode === 'desktop') {
    try {
      const res = await fetch('/api/system/apply-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      const data = await res.json();
      if (data.success) {
        // Wait 1 second and reload window
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        return true;
      }
    } catch (e) {
      console.error('Failed to apply update via server:', e);
    }
  }

  // Service worker reload
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg && reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  setTimeout(() => {
    window.location.reload();
  }, 800);
  return true;
};
