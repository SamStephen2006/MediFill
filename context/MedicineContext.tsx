import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { findInteractionsForMedicine, MEDICINE_INTERACTIONS } from '../constants/interactions';
import type { UserProfile } from './AuthContext';
import {
  saveMedicineToCloud,
  saveAllMedicinesToCloud,
  deleteMedicineFromCloud,
  subscribeMedicines,
} from '../services/firestoreSync';
import { Platform } from 'react-native';
import {
  syncMedicineReminders,
  primeNotifications,
  sendInstantNotification,
  localDateKey,
  isDoseDay,
  doseKey,
  followUpTimesFor,
  followUpMessage,
  formatTime12,
  FOLLOW_UP_INTERVAL_MIN,
  LOW_STOCK_PERCENT,
  notificationForTake,
} from '../services/notificationService';
import {
  NotificationPrefs,
  DEFAULT_PREFS,
  loadPrefs,
  savePrefs,
  alertTypeEnabled,
} from '../services/notificationPrefs';

export interface Medicine {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  totalQuantity: number;
  currentQuantity: number;
  expiryDate: string;
  notes?: string;
  createdAt: string;
  interactions?: string[];
  timeToTake?: string[];
}

export interface Alert {
  id: string;
  type: 'expiry' | 'stock' | 'interaction' | 'reminder';
  title: string;
  description: string;
  medicineIds: string[];
  createdAt: string;
  read: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isActive: boolean;
}

interface MedicineContextType {
  medicines: Medicine[];
  alerts: Alert[];
  users: User[];
  activeUser: User | null;
  isSyncing: boolean;
  addMedicine: (medicine: Medicine) => Promise<void>;
  updateMedicine: (medicine: Medicine) => Promise<void>;
  deleteMedicine: (id: string) => Promise<void>;
  loadMedicines: () => Promise<void>;
  markAlertAsRead: (id: string) => Promise<void>;
  markAllAlertsAsRead: () => Promise<void>;
  dismissAlert: (id: string) => Promise<void>;
  notificationPrefs: NotificationPrefs;
  /** Doses marked taken today: { "<medicineId>|<HH:MM>": takenAt ISO ('' = un-marked) } */
  takenToday: Record<string, string>;
  loadTakenForDate: (date: Date) => Promise<Record<string, string>>;
  setDoseTaken: (medicine: Medicine, time: string, date: Date, taken: boolean) => Promise<Record<string, string>>;
  updateNotificationPrefs: (changes: Partial<NotificationPrefs>) => Promise<void>;
  getInteractionAlerts: () => Alert[];
  getExpiryAlerts: () => Alert[];
  getStockAlerts: () => Alert[];
  addUser: (user: User) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  setActiveUser: (userId: string) => Promise<void>;
}

const PLACEHOLDER_USERS: User[] = [
  { id: 'auth', name: 'Me', email: '', isActive: true },
];

function profileToUser(profile: UserProfile): User {
  return {
    id: 'auth',
    name: profile.displayName || profile.email?.split('@')[0] || 'Me',
    email: profile.email ?? '',
    avatar: profile.photoURL,
    isActive: true,
  };
}

// ── Per-profile storage keys ───────────────────────────────────────────────────
const medicinesKey = (profileId: string) => `medicines_${profileId}`;
const alertsKey    = (profileId: string) => `alerts_${profileId}`;
const alertIdsKey  = (profileId: string) => `processedAlertIds_${profileId}`;
const takenKey     = (profileId: string, dateKey: string) => `taken_${profileId}_${dateKey}`;

/**
 * Read the taken-doses record for one profile and LOCAL date. Also merges the
 * old Schedule-screen format (`schedule_taken_<date>` with keys
 * "<medId>-<HH:MM>-<date>"), which was keyed by UTC date and not per profile.
 */
async function readTaken(profileId: string, dateKey: string): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  try {
    const legacy = await AsyncStorage.getItem(`schedule_taken_${dateKey}`);
    if (legacy) {
      for (const [k, v] of Object.entries(JSON.parse(legacy) as Record<string, boolean>)) {
        const m = /^(.*)-(\d{1,2}:\d{2})-\d{4}-\d{2}-\d{2}$/.exec(k);
        if (v && m) map[`${m[1]}|${m[2]}`] = 'legacy';
      }
    }
    const stored = await AsyncStorage.getItem(takenKey(profileId, dateKey));
    if (stored) Object.assign(map, JSON.parse(stored));
  } catch (e) {
    console.warn('Could not read taken doses:', e);
  }
  return map;
}

const MedicineContext = createContext<MedicineContextType | undefined>(undefined);

export const useMedicineContext = () => {
  const context = useContext(MedicineContext);
  if (!context) throw new Error('useMedicineContext must be used within a MedicineProvider');
  return context;
};

export const MedicineProvider: React.FC<{
  children: React.ReactNode;
  firebaseUid?: string | null;
  userProfile?: UserProfile | null;
}> = ({ children, firebaseUid, userProfile }) => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [users, setUsers] = useState<User[]>(PLACEHOLDER_USERS);
  const [activeUser, setActiveUserState] = useState<User | null>(PLACEHOLDER_USERS[0]);
  const [processedAlertIds, setProcessedAlertIds] = useState<Set<string>>(new Set());
  // Alerts are only generated once this profile's saved alerts + "already
  // notified" ids have loaded. Generating before that treated every old alert as
  // new and re-sent its notification on each app start / Expo reload.
  const [alertsReadyFor, setAlertsReadyFor] = useState<string | null>(null);
  // A ref, not state: two runs started in the same moment both saw the old
  // `false` state and generated (and pushed) the same alerts twice.
  const generatingRef = useRef(false);
  // Ids already pushed as a notification this session — a last line of defence
  // against sending the same alert twice.
  const pushedIdsRef = useRef<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [takenToday, setTakenToday] = useState<Record<string, string>>({});
  const [takenDate, setTakenDate] = useState(localDateKey());

  // ── Notification settings (Profile → Notifications), saved on this device ──
  useEffect(() => {
    loadPrefs().then(setNotificationPrefs);
  }, []);

  const updateNotificationPrefs = async (changes: Partial<NotificationPrefs>) => {
    const next = { ...notificationPrefs, ...changes };
    setNotificationPrefs(next);
    await savePrefs(next);
    // Turning a category on is a good moment to ask for permission.
    if (Object.entries(changes).some(([k, v]) => v === true && k !== 'dndEnabled')) primeNotifications();
  };

  // ── Active profile ID helper ──────────────────────────────────────────────
  const activeProfileId = activeUser?.id ?? 'auth';

  // ── Load medicines for a specific profile ─────────────────────────────────
  const loadMedicinesForProfile = useCallback(async (profileId: string) => {
    try {
      // Migrate old key on first load for the auth user
      if (profileId === 'auth') {
        const legacy = await AsyncStorage.getItem('medicines');
        if (legacy) {
          const parsed: Medicine[] = JSON.parse(legacy);
          if (parsed.length > 0) {
            await AsyncStorage.setItem(medicinesKey('auth'), legacy);
            await AsyncStorage.removeItem('medicines'); // clean up legacy key
          }
        }
      }
      const stored = await AsyncStorage.getItem(medicinesKey(profileId));
      setMedicines(stored ? JSON.parse(stored) : []);
    } catch (e) {
      console.error('Error loading medicines for profile:', e);
      setMedicines([]);
    }
  }, []);

  const loadAlertsForProfile = useCallback(async (profileId: string) => {
    try {
      const stored = await AsyncStorage.getItem(alertsKey(profileId));
      if (stored) {
        const parsed: Alert[] = JSON.parse(stored);
        const unique = Array.from(new Map(parsed.map(a => [a.id, a])).values());
        setAlerts(unique);
      } else {
        setAlerts([]);
      }
      const storedIds = await AsyncStorage.getItem(alertIdsKey(profileId));
      setProcessedAlertIds(storedIds ? new Set(JSON.parse(storedIds)) : new Set());
    } catch (e) {
      console.error('Error loading alerts for profile:', e);
      setAlerts([]);
      setProcessedAlertIds(new Set());
    }
  }, []);

  // ── Sync real auth user into first slot ───────────────────────────────────
  useEffect(() => {
    if (!userProfile) return;
    const authUser = profileToUser(userProfile);
    setUsers(prev => {
      const rest = prev.filter(u => u.id !== 'auth');
      return [authUser, ...rest];
    });
    setActiveUserState(prev => (prev?.id === 'auth' || prev === null ? authUser : prev));
  }, [userProfile]);

  // ── When activeUser changes, reload their medicines + alerts ──────────────
  useEffect(() => {
    if (!activeUser) return;
    const profileId = activeUser.id;
    setAlertsReadyFor(null);
    const today = localDateKey();
    Promise.all([
      loadMedicinesForProfile(profileId),
      loadAlertsForProfile(profileId),
      readTaken(profileId, today).then(map => { setTakenToday(map); setTakenDate(today); }),
    ]).then(() => setAlertsReadyFor(profileId));
  }, [activeUser?.id]);

  // ── Load users list from storage ──────────────────────────────────────────
  useEffect(() => {
    loadUsers();
  }, []);

  // ── Firestore real-time sync (auth user only) ─────────────────────────────
  useEffect(() => {
    if (!firebaseUid) return;

    (async () => {
      const stored = await AsyncStorage.getItem(medicinesKey('auth'));
      if (stored) {
        const local: Medicine[] = JSON.parse(stored);
        if (local.length > 0) {
          setIsSyncing(true);
          await saveAllMedicinesToCloud(firebaseUid, local);
          setIsSyncing(false);
        }
      }
    })();

    const unsubscribe = subscribeMedicines(
      firebaseUid,
      cloudMedicines => {
        if (cloudMedicines.length > 0 && activeUser?.id === 'auth') {
          setMedicines(cloudMedicines as Medicine[]);
          AsyncStorage.setItem(medicinesKey('auth'), JSON.stringify(cloudMedicines));
        }
      },
      error => console.warn('Firestore sync error:', error)
    );

    return () => unsubscribe();
  }, [firebaseUid]);

  // ── Clock tick: re-check reminders every 30s so they fire on time ─────────
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setClockTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Alert generation whenever medicines change, and as the clock moves ────
  useEffect(() => {
    const today = localDateKey();
    if (today !== takenDate) {
      setTakenDate(today);
      readTaken(activeProfileId, today).then(setTakenToday);
    }
  }, [clockTick]);

  useEffect(() => {
    if (alertsReadyFor === activeProfileId && medicines.length > 0) generateAlerts();
  }, [medicines, clockTick, notificationPrefs, alertsReadyFor, takenToday]);

  // ── Keep the OS notification schedule in line with this profile's medicines
  // (handles add/edit/delete, stock running out, expiry, and fresh installs).
  useEffect(() => {
    syncMedicineReminders(activeProfileId, medicines, notificationPrefs, takenToday);
  }, [medicines, activeProfileId, notificationPrefs, takenToday]);

  // Other family profiles keep their reminders too. They used to be scheduled
  // only while that profile was active, so a settings change (or the one-time
  // reset) never reached them.
  useEffect(() => {
    if (alertsReadyFor !== activeProfileId) return;
    users
      .filter(u => u.id !== activeProfileId)
      .forEach(async u => {
        try {
          const stored = await AsyncStorage.getItem(medicinesKey(u.id));
          const meds: Medicine[] = stored ? JSON.parse(stored) : [];
          syncMedicineReminders(u.id, meds, notificationPrefs, await readTaken(u.id, localDateKey()));
        } catch (e) {
          console.warn('Reminder sync for profile failed:', u.id, e);
        }
      });
  }, [alertsReadyFor, users.length, notificationPrefs]);

  // ── Storage helpers ───────────────────────────────────────────────────────
  const saveMedicines = async (updated: Medicine[]) => {
    await AsyncStorage.setItem(medicinesKey(activeProfileId), JSON.stringify(updated));
  };

  const saveAlerts = async (updated: Alert[]) => {
    const unique = Array.from(new Map(updated.map(a => [a.id, a])).values());
    await AsyncStorage.setItem(alertsKey(activeProfileId), JSON.stringify(unique));
  };

  const saveProcessedAlertIds = async (ids: Set<string>) => {
    await AsyncStorage.setItem(alertIdsKey(activeProfileId), JSON.stringify([...ids]));
  };

  const loadUsers = async () => {
    try {
      const stored = await AsyncStorage.getItem('users');
      if (stored) {
        const parsed: User[] = JSON.parse(stored);
        const extra = parsed.filter(u => u.id !== 'auth' && u.id !== '1' && u.id !== '2' && u.id !== '3');
        if (extra.length > 0) {
          setUsers(prev => {
            const authSlot = prev.find(u => u.id === 'auth');
            return authSlot ? [authSlot, ...extra] : [...PLACEHOLDER_USERS, ...extra];
          });
        }
      }
    } catch (e) {
      console.error('Error loading users:', e);
    }
  };

  const saveUsers = async (updated: User[]) => {
    await AsyncStorage.setItem('users', JSON.stringify(updated));
  };

  // ── Public load (for pull-to-refresh) ────────────────────────────────────
  const loadMedicines = async () => {
    await loadMedicinesForProfile(activeProfileId);
  };

  // ── Medicine CRUD ──────────────────────────────────────────────────────────
  const addMedicine = async (medicine: Medicine) => {
    const existingNames = medicines.map(m => m.name);
    const interactions = findInteractionsForMedicine(medicine.name, existingNames);
    const med = { ...medicine, interactions: interactions.length > 0 ? interactions : undefined };

    const updated = [...medicines, med];
    setMedicines(updated);
    await saveMedicines(updated);

    if (firebaseUid && activeUser?.id === 'auth') {
      saveMedicineToCloud(firebaseUid, med);
    }

    // Ask for notification permission now, while the user is interacting.
    if (medicine.timeToTake?.length) primeNotifications();
  };

  const updateMedicine = async (updatedMedicine: Medicine) => {
    const updated = medicines.map(m => m.id === updatedMedicine.id ? updatedMedicine : m);
    setMedicines(updated);
    await saveMedicines(updated);

    if (firebaseUid && activeUser?.id === 'auth') {
      saveMedicineToCloud(firebaseUid, updatedMedicine);
    }
  };

  const deleteMedicine = async (id: string) => {
    const updated = medicines.filter(m => m.id !== id);
    setMedicines(updated);
    await saveMedicines(updated);

    if (firebaseUid && activeUser?.id === 'auth') {
      deleteMedicineFromCloud(firebaseUid, id);
    }

    const updatedAlerts = alerts.filter(a => !a.medicineIds.includes(id));
    setAlerts(updatedAlerts);
    await saveAlerts(updatedAlerts);

    const newIds = new Set(processedAlertIds);
    [...processedAlertIds].filter(aid => aid.includes(id)).forEach(aid => newIds.delete(aid));
    setProcessedAlertIds(newIds);
    await saveProcessedAlertIds(newIds);
  };

  const markAlertAsRead = async (id: string) => {
    const updated = alerts.map(a => a.id === id ? { ...a, read: true } : a);
    setAlerts(updated);
    await saveAlerts(updated);
  };

  // One update for all alerts. (Calling markAlertAsRead in a loop only kept the
  // last change, because every call started from the same old list.)
  const markAllAlertsAsRead = async () => {
    const updated = alerts.map(a => (a.read ? a : { ...a, read: true }));
    setAlerts(updated);
    await saveAlerts(updated);
  };

  // Remove an alert from the list. Its id stays in processedAlertIds, so the
  // same alert isn't generated again.
  const dismissAlert = async (id: string) => {
    const updated = alerts.filter(a => a.id !== id);
    setAlerts(updated);
    await saveAlerts(updated);
  };

  // ── Taken doses (Schedule → Take) ─────────────────────────────────────────
  const loadTakenForDate = (date: Date) => readTaken(activeProfileId, localDateKey(date));

  /**
   * Mark a dose taken / not taken. Taking uses one unit of stock, un-marking
   * gives it back. For today's doses it also cancels the "did you take it?"
   * follow-ups (via the reminder sync), clears that dose's reminders from the
   * bell, and sends a confirmation notification.
   */
  const setDoseTaken = async (medicine: Medicine, time: string, date: Date, taken: boolean) => {
    const dk = localDateKey(date);
    const isToday = dk === localDateKey();
    const map = await readTaken(activeProfileId, dk);
    const key = doseKey(medicine.id, time);
    if (!!map[key] === taken) return map;

    map[key] = taken ? new Date().toISOString() : '';
    await AsyncStorage.setItem(takenKey(activeProfileId, dk), JSON.stringify(map));
    if (isToday) setTakenToday({ ...map });

    const current = medicines.find(m => m.id === medicine.id) ?? medicine;
    const qty = taken
      ? Math.max(0, current.currentQuantity - 1)
      : Math.min(current.totalQuantity, current.currentQuantity + 1);

    // Taking this dose leaves the stock at or below 20% → send a refill reminder.
    const pctLeft = current.totalQuantity > 0 ? (qty / current.totalQuantity) * 100 : 0;
    const sendRefill = taken && pctLeft <= LOW_STOCK_PERCENT && notificationPrefs.lowStockAlerts;
    if (sendRefill) {
      // The low-stock alert the stock change is about to create still goes in the
      // bell, but its push is covered by the refill reminder below — no duplicate.
      pushedIdsRef.current.add(`stock-${medicine.id}-${Math.round(pctLeft)}`);
      if (qty === 0) pushedIdsRef.current.add(`empty-${medicine.id}`);
    }

    if (qty !== current.currentQuantity) await updateMedicine({ ...current, currentQuantity: qty });

    if (taken) {
      const doseId = `${medicine.id}-${time}-${dk}`;
      const now = new Date();
      const takenAt = formatTime12(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`);
      if (isToday) {
        setAlerts(prev => {
          const next = prev.filter(a => a.id !== `reminder-${doseId}` && !a.id.startsWith(`followup-${doseId}-`));
          saveAlerts(next);
          return next;
        });
      }
      // ≤ 20% left → one notification that confirms the dose AND says to refill
      // (tap opens Pharmacy; same id per medicine so the tray shows only the
      // latest). Otherwise the usual "Dose taken ✓" for today's doses.
      const n = notificationForTake({
        med: medicine, left: qty, total: current.totalQuantity, takenAt, isToday, prefs: notificationPrefs,
      });
      if (n) {
        sendInstantNotification(n.title, n.body, n.kind === 'refill' ? n.tag : `taken-${doseId}`, notificationPrefs, {
          kind: n.kind, medicineId: medicine.id, screen: n.screen,
        });
      }
    }
    return map;
  };

  // ── User management ───────────────────────────────────────────────────────
  const addUser = async (user: User) => {
    const updated = [...users, user];
    setUsers(updated);
    await saveUsers(updated);
  };

  const updateUser = async (updatedUser: User) => {
    const updated = users.map(u => u.id === updatedUser.id ? updatedUser : u);
    setUsers(updated);
    await saveUsers(updated);
    if (activeUser?.id === updatedUser.id) setActiveUserState(updatedUser);
  };

  const deleteUser = async (id: string) => {
    if (users.length <= 1) return;
    // Clean up their medicine storage
    await AsyncStorage.removeItem(medicinesKey(id));
    await AsyncStorage.removeItem(alertsKey(id));
    await AsyncStorage.removeItem(alertIdsKey(id));

    const updated = users.filter(u => u.id !== id);
    setUsers(updated);
    await saveUsers(updated);

    if (activeUser?.id === id) {
      await switchActiveUser(updated[0].id, updated);
    }
  };

  // ── Core profile switch logic ─────────────────────────────────────────────
  const switchActiveUser = async (userId: string, userList: User[] = users) => {
    const target = userList.find(u => u.id === userId);
    if (!target) return;

    const updated = userList.map(u => ({ ...u, isActive: u.id === userId }));
    setUsers(updated);
    setActiveUserState(target);
    await saveUsers(updated);
    await AsyncStorage.setItem('activeUserId', userId);

    // Load medicines + alerts for the new profile
    setAlertsReadyFor(null);
    await loadMedicinesForProfile(userId);
    await loadAlertsForProfile(userId);
    setTakenToday(await readTaken(userId, localDateKey()));
    setTakenDate(localDateKey());
    setAlertsReadyFor(userId);
  };

  const setActiveUser = async (userId: string) => switchActiveUser(userId);

  // ── Alert generation ──────────────────────────────────────────────────────
  const findInteractions = (name: string): string[] =>
    findInteractionsForMedicine(name, medicines.map(m => m.name));

  const generateAlerts = async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;

    try {
      const newAlerts: Alert[] = [];
      const currentProcessedIds = new Set(processedAlertIds);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      medicines.forEach(medicine => {
        const expiryDate = new Date(medicine.expiryDate);
        expiryDate.setHours(0, 0, 0, 0);
        const diffDays = Math.round((expiryDate.getTime() - today.getTime()) / 86400000);

        // ── Already expired alert ──
        if (diffDays < 0) {
          const expiredAlertId = `expired-${medicine.id}`;
          if (!currentProcessedIds.has(expiredAlertId)) {
            newAlerts.push({
              id: expiredAlertId, type: 'expiry',
              title: 'Medicine Expired',
              description: `${medicine.name} expired ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} ago and has been removed from your schedule.`,
              medicineIds: [medicine.id],
              createdAt: new Date().toISOString(), read: false,
            });
            currentProcessedIds.add(expiredAlertId);
          }
          return; // skip all other alerts for expired medicines
        }

        // ── Expiring soon alert (1–30 days) ──
        const expiryAlertId = `expiry-${medicine.id}-${diffDays}`;
        if (!currentProcessedIds.has(expiryAlertId) && diffDays >= 0 && diffDays <= 30) {
          const dailyUsage = calculateDailyUsage(medicine.frequency);
          const daysOfSupply = medicine.currentQuantity / dailyUsage;
          const when = diffDays === 0 ? 'today' : `in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
          const desc = diffDays < daysOfSupply
            ? `${medicine.name} will expire ${when}. ~${Math.round(medicine.currentQuantity - dailyUsage * diffDays)} units will be wasted.`
            : `${medicine.name} will expire ${when}.`;
          const title = diffDays < daysOfSupply ? 'Medicine Will Expire Before Use' : 'Medicine Expiring Soon';

          newAlerts.push({ id: expiryAlertId, type: 'expiry', title, description: desc, medicineIds: [medicine.id], createdAt: new Date().toISOString(), read: false });
          currentProcessedIds.add(expiryAlertId);
        }

        // ── Low stock alert (skip if already zero) ──
        const pct = (medicine.currentQuantity / medicine.totalQuantity) * 100;
        const stockAlertId = `stock-${medicine.id}-${Math.round(pct)}`;
        if (!currentProcessedIds.has(stockAlertId) && pct <= LOW_STOCK_PERCENT && medicine.currentQuantity > 0) {
          newAlerts.push({ id: stockAlertId, type: 'stock', title: 'Medicine Running Low', description: `${medicine.name} is running low (${Math.round(pct)}% remaining).`, medicineIds: [medicine.id], createdAt: new Date().toISOString(), read: false });
          currentProcessedIds.add(stockAlertId);
        }

        // ── Out of stock alert ──
        if (medicine.currentQuantity === 0) {
          const emptyId = `empty-${medicine.id}`;
          if (!currentProcessedIds.has(emptyId)) {
            newAlerts.push({ id: emptyId, type: 'stock', title: 'Medicine Out of Stock', description: `${medicine.name} is out of stock. Please refill your prescription.`, medicineIds: [medicine.id], createdAt: new Date().toISOString(), read: false });
            currentProcessedIds.add(emptyId);
          }
        }
      });

      const checkedPairs = new Set<string>();
      medicines.forEach(m1 => {
        medicines.forEach(m2 => {
          if (m1.id === m2.id) return;
          const pairKey = [m1.id, m2.id].sort().join('-');
          const iid = `interaction-${pairKey}`;
          if (!checkedPairs.has(pairKey) && !currentProcessedIds.has(iid)) {
            checkedPairs.add(pairKey);
            const m1Ints = MEDICINE_INTERACTIONS[m1.name.toLowerCase()] || [];
            if (m1Ints.includes(m2.name.toLowerCase())) {
              newAlerts.push({ id: iid, type: 'interaction', title: 'Medicine Interaction Warning', description: `${m1.name} and ${m2.name} may interact. Please consult your doctor.`, medicineIds: [m1.id, m2.id], createdAt: new Date().toISOString(), read: false });
              currentProcessedIds.add(iid);
            }
          }
        });
      });

      // ── Reminder alerts — only for active (non-expired, in-stock) medicines ──
      const now = new Date();
      const superseded = new Set<string>(); // doses whose older reminder alerts are replaced
      medicines.forEach(medicine => {
        // Skip expired or empty medicines
        const expiry = new Date(medicine.expiryDate);
        expiry.setHours(0, 0, 0, 0);
        if (expiry < today || medicine.currentQuantity <= 0) return;

        if (!isDoseDay(medicine, now)) return;

        medicine.timeToTake?.forEach(time => {
          const [hours, minutes] = time.split(':').map(Number);
          if (isNaN(hours) || isNaN(minutes)) return;
          const reminderTime = new Date();
          reminderTime.setHours(hours, minutes, 0, 0);
          // Already marked taken in Schedule → no reminder, no follow-ups.
          if (takenToday[doseKey(medicine.id, time)]) return;
          // Local date — toISOString() is UTC and would roll over at 5:30 AM in IST
          const dk = localDateKey(now);
          const rid = `reminder-${medicine.id}-${time}-${dk}`;

          // "Did you take it?" — every 5 min after the dose time, up to 1 hour.
          // Only the current one (not a backlog when the app was closed); it
          // replaces the earlier reminder/follow-ups for this dose in the bell.
          const passed = followUpTimesFor(now, time, medicine.timeToTake ?? [])
            .filter(d => d.getTime() <= now.getTime());
          if (passed.length > 0) {
            const k = passed.length;
            const fid = `followup-${medicine.id}-${time}-${dk}-${k}`;
            const fresh = now.getTime() - passed[k - 1].getTime() < FOLLOW_UP_INTERVAL_MIN * 60000;
            if (fresh && !currentProcessedIds.has(fid)) {
              const { title, body } = followUpMessage(medicine, time);
              newAlerts.push({ id: fid, type: 'reminder', title, description: body, medicineIds: [medicine.id], createdAt: new Date().toISOString(), read: false });
              currentProcessedIds.add(fid);
              currentProcessedIds.add(rid); // the first reminder is covered by this one
              superseded.add(`${medicine.id}-${time}-${dk}`);
              return;
            }
          }

          if (!currentProcessedIds.has(rid)) {
            const diff = Math.floor(Math.abs(now.getTime() - reminderTime.getTime()) / 60000);
            if (diff <= 60 && now.getTime() >= reminderTime.getTime()) {
              newAlerts.push({ id: rid, type: 'reminder', title: 'Time to Take Medicine', description: `It's time to take ${medicine.name} (${medicine.dosage}).`, medicineIds: [medicine.id], createdAt: new Date().toISOString(), read: false });
              currentProcessedIds.add(rid);
            }
          }
        });
      });

      // Drop categories the user turned off. Their ids are un-marked as processed,
      // so switching the setting back on brings them back.
      for (let i = newAlerts.length - 1; i >= 0; i--) {
        if (!alertTypeEnabled(newAlerts[i].type, notificationPrefs)) {
          currentProcessedIds.delete(newAlerts[i].id);
          newAlerts.splice(i, 1);
        }
      }

      // Push notifications for new alerts:
      //  - phone: low stock & interactions (dose + expiry are pre-scheduled by
      //    syncMedicineReminders so they arrive even when the app is closed)
      //  - web: everything (browsers have no scheduler)
      newAlerts
        .filter(a => Platform.OS === 'web' || a.type === 'stock' || a.type === 'interaction')
        .filter(a => !pushedIdsRef.current.has(a.id))
        .forEach(a => {
          pushedIdsRef.current.add(a.id);
          const screen = a.type === 'stock' ? '/pharmacy' : a.type === 'reminder' ? '/schedule' : '/';
          sendInstantNotification(a.title, a.description, a.id, notificationPrefs, { screen });
        });

      if (newAlerts.length > 0) {
        const newIds = new Set(newAlerts.map(a => a.id));
        const all = [...alerts, ...newAlerts].filter(a => {
          for (const dose of superseded) {
            if (a.id === `reminder-${dose}`) return false;
            if (a.id.startsWith(`followup-${dose}-`) && !newIds.has(a.id)) return false;
          }
          return true;
        });
        const unique = Array.from(new Map(all.map(a => [a.id, a])).values());
        setAlerts(unique);
        await saveAlerts(unique);
        setProcessedAlertIds(currentProcessedIds);
        await saveProcessedAlertIds(currentProcessedIds);
      }
    } catch (e) {
      console.error('Error generating alerts:', e);
    } finally {
      generatingRef.current = false;
    }
  };

  const calculateDailyUsage = (frequency: string): number => {
    const f = frequency.toLowerCase();
    if (f.includes('twice daily') || f.includes('two times')) return 2;
    if (f.includes('three times')) return 3;
    if (f.includes('four times')) return 4;
    if (f.includes('every other day') || f.includes('alternate day')) return 0.5;
    if (f.includes('weekly') || f.includes('once a week')) return 1 / 7;
    return 1;
  };

  const getInteractionAlerts = () => alerts.filter(a => a.type === 'interaction');
  const getExpiryAlerts = () => alerts.filter(a => a.type === 'expiry');
  const getStockAlerts = () => alerts.filter(a => a.type === 'stock');

  return (
    <MedicineContext.Provider
      value={{
        medicines,
        alerts: alerts.filter(a => alertTypeEnabled(a.type, notificationPrefs)),
        markAllAlertsAsRead,
        dismissAlert,
        notificationPrefs,
        updateNotificationPrefs,
        takenToday,
        loadTakenForDate,
        setDoseTaken,
        users,
        activeUser,
        isSyncing,
        addMedicine,
        updateMedicine,
        deleteMedicine,
        loadMedicines,
        markAlertAsRead,
        getInteractionAlerts,
        getExpiryAlerts,
        getStockAlerts,
        addUser,
        updateUser,
        deleteUser,
        setActiveUser,
      }}
    >
      {children}
    </MedicineContext.Provider>
  );
};