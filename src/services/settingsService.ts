import { supabase, isSupabaseConfigured } from './supabase';
import { Setting } from '../types/database';

export interface BusinessSettings {
  business_name: string;
  business_contact: string;
  receipt_footer: string;
  currency: string;
  receipt_width_mm: number;
}

export const DEFAULT_SETTINGS: BusinessSettings = {
  business_name: 'A-Mart Supermarket',
  business_contact: '+92 300 1234567 | info@a-mart.pk',
  receipt_footer: 'Thank you for shopping with A-Mart!',
  currency: 'PKR',
  receipt_width_mm: 80
};

const SETTINGS_STORAGE_KEY = 'a_mart_business_settings';

let cachedSettings: BusinessSettings = { ...DEFAULT_SETTINGS };

type SettingsListener = (settings: BusinessSettings) => void;
const listeners: Set<SettingsListener> = new Set();
const notify = () => listeners.forEach(l => l(cachedSettings));

export const subscribeSettings = (listener: SettingsListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getSettings = async (): Promise<BusinessSettings> => {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.from('settings').select('*');
      if (data && data.length > 0) {
        const loaded: Partial<BusinessSettings> = {};
        data.forEach((s: Setting) => {
          let val = s.value;
          // Clean quotes if json string
          if (typeof val === 'string' && (val.startsWith('"') && val.endsWith('"'))) {
            try { val = JSON.parse(val); } catch (e) {}
          }
          (loaded as any)[s.key] = val;
        });

        cachedSettings = {
          ...DEFAULT_SETTINGS,
          ...loaded
        };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(cachedSettings));
        return cachedSettings;
      }
    } catch (e) {
      console.warn('Could not load settings from Supabase:', e);
    }
  }

  try {
    const local = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (local) {
      cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
      return cachedSettings;
    }
  } catch (e) {}

  return cachedSettings;
};

export const updateSettings = async (updates: Partial<BusinessSettings>): Promise<BusinessSettings> => {
  cachedSettings = { ...cachedSettings, ...updates };
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(cachedSettings));

  if (isSupabaseConfigured && supabase) {
    for (const [key, value] of Object.entries(updates)) {
      try {
        await supabase
          .from('settings')
          .update({
            value: typeof value === 'string' ? JSON.stringify(value) : value,
            updated_at: new Date().toISOString()
          })
          .eq('key', key);
      } catch (e) {
        console.error(`Failed to sync setting ${key} to Supabase:`, e);
      }
    }
  }

  notify();
  return cachedSettings;
};
