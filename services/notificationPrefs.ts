import AsyncStorage from '@react-native-async-storage/async-storage';

/** User's choices from Profile → Notifications. Stored per device. */
export interface NotificationPrefs {
  doseReminders: boolean;
  expiryAlerts: boolean;
  lowStockAlerts: boolean;
  interactionWarnings: boolean;
  dndEnabled: boolean;
  dndStart: string; // "HH:MM" 24h
  dndEnd: string;   // "HH:MM" 24h
}

export const DEFAULT_PREFS: NotificationPrefs = {
  doseReminders: true,
  expiryAlerts: true,
  lowStockAlerts: true,
  interactionWarnings: true,
  dndEnabled: false,
  dndStart: '22:00',
  dndEnd: '07:00',
};

const KEY = 'notificationPrefs';

export async function loadPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePrefs(prefs: NotificationPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('Could not save notification settings:', e);
  }
}

const toMinutes = (t: string) => {
  const [h, m] = (t || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
};

/**
 * Is a clock time inside the Do Not Disturb window? Handles windows that cross
 * midnight (22:00 → 07:00). Start is inclusive, end is exclusive.
 */
export function isQuietTime(time: string, prefs: Pick<NotificationPrefs, 'dndEnabled' | 'dndStart' | 'dndEnd'>): boolean {
  if (!prefs.dndEnabled) return false;
  const x = toMinutes(time), s = toMinutes(prefs.dndStart), e = toMinutes(prefs.dndEnd);
  if ([x, s, e].some(Number.isNaN) || s === e) return false;
  return s < e ? x >= s && x < e : x >= s || x < e;
}

export function isQuietNow(prefs: NotificationPrefs, now: Date = new Date()): boolean {
  const t = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return isQuietTime(t, prefs);
}

/** Which setting controls each in-app alert type. */
export function alertTypeEnabled(type: string, prefs: NotificationPrefs): boolean {
  switch (type) {
    case 'reminder': return prefs.doseReminders;
    case 'expiry': return prefs.expiryAlerts;
    case 'stock': return prefs.lowStockAlerts;
    case 'interaction': return prefs.interactionWarnings;
    default: return true;
  }
}
