import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PREFS, NotificationPrefs, isQuietTime, isQuietNow } from './notificationPrefs';

/** Minimal shape of a medicine needed to schedule its reminders. */
export interface ReminderMedicine {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  timeToTake?: string[];
  expiryDate: string;
  currentQuantity: number;
  createdAt?: string;
}

const ANDROID_CHANNEL_ID = 'medicine-reminders';
// Used during Do Not Disturb: still delivered, but no sound / vibration / pop-up.
const ANDROID_QUIET_CHANNEL_ID = 'medicine-reminders-quiet';
const EXPIRY_NOTIFY_TIME = '09:00';
/** Days before expiry to send a reminder (0 = on the expiry day, -1 = the day after). */
const EXPIRY_NOTIFY_DAYS = [30, 7, 1, 0, -1];
/** "Every other day" reminders are scheduled this far ahead and re-synced on each app start.
 *  Kept short because iOS only allows 64 pending notifications per app. */
const ALTERNATE_DAY_HORIZON = 14;
/** If a dose isn't marked as taken, nudge every FOLLOW_UP_INTERVAL_MIN minutes,
 *  FOLLOW_UP_COUNT times (stopping early at that medicine's next dose time). */
export const FOLLOW_UP_INTERVAL_MIN = 5;
// 1 hour of reminders. iOS only keeps 64 pending notifications per app, so
// iPhones get 30 minutes (6) to leave room for dose and expiry reminders.
export const FOLLOW_UP_COUNT = Platform.OS === 'ios' ? 6 : 12;

/** Key for a dose in the taken-doses record: "<medicineId>|<HH:MM>". */
export const doseKey = (medicineId: string, time: string) => `${medicineId}|${time}`;

/** "20:05" → "8:05 PM" */
export function formatTime12(time: string): string {
  const t = parseTime(time);
  if (!t) return time;
  return `${t.hour % 12 || 12}:${String(t.minute).padStart(2, '0')} ${t.hour >= 12 ? 'PM' : 'AM'}`;
}

/**
 * The follow-up times for one dose on one day: every 5 min after the dose
 * time, FOLLOW_UP_COUNT times, but never at or after the same medicine's next
 * dose time that day (that dose gets its own reminder).
 */
export function followUpTimesFor(day: Date, time: string, allTimesOfMed: string[]): Date[] {
  const t = parseTime(time);
  if (!t) return [];
  const due = new Date(day);
  due.setHours(t.hour, t.minute, 0, 0);
  const later = allTimesOfMed
    .map(parseTime)
    .filter((x): x is { hour: number; minute: number } => !!x)
    .map(x => x.hour * 60 + x.minute)
    .filter(m => m > t.hour * 60 + t.minute)
    .sort((a, b) => a - b);
  const nextDoseMin = later.length ? later[0] : Infinity;
  const out: Date[] = [];
  for (let k = 1; k <= FOLLOW_UP_COUNT; k++) {
    const at = new Date(due.getTime() + k * FOLLOW_UP_INTERVAL_MIN * 60000);
    const atMin = t.hour * 60 + t.minute + k * FOLLOW_UP_INTERVAL_MIN;
    if (atMin >= nextDoseMin) break;
    out.push(at);
  }
  return out;
}

export function followUpMessage(med: Pick<ReminderMedicine, 'name' | 'dosage'>, time: string) {
  return {
    title: 'Did you take your medicine?',
    body: `${med.name} (${med.dosage}) was due at ${formatTime12(time)}. Open Schedule and tap Take to stop these reminders.`,
  };
}

const isWeb = Platform.OS === 'web';

if (!isWeb) {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const quiet = (n.request.content.data as any)?.quiet === true;
      return { shouldShowAlert: true, shouldPlaySound: !quiet, shouldSetBadge: false };
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function parseTime(time: string): { hour: number; minute: number } | null {
  const [hourStr, minuteStr] = (time ?? '').split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** Local calendar date as YYYY-MM-DD (toISOString() would give the UTC date). */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

type Cadence = 'daily' | 'alternate' | 'weekly' | 'none';

function cadenceOf(frequency: string): Cadence {
  const f = (frequency || '').toLowerCase();
  if (f.includes('as needed')) return 'none';
  if (f.includes('every other day') || f.includes('alternate')) return 'alternate';
  if (f.includes('once a week') || f.includes('weekly')) return 'weekly';
  return 'daily';
}

/** Is `date` a day on which this medicine should be taken? */
export function isDoseDay(med: Pick<ReminderMedicine, 'frequency' | 'createdAt'>, date: Date): boolean {
  const cadence = cadenceOf(med.frequency);
  if (cadence === 'none') return false;
  if (cadence === 'daily') return true;
  const anchor = startOfDay(med.createdAt ? new Date(med.createdAt) : new Date());
  const days = Math.round((startOfDay(date).getTime() - anchor.getTime()) / 86400000);
  if (cadence === 'alternate') return ((days % 2) + 2) % 2 === 0;
  return ((days % 7) + 7) % 7 === 0; // weekly, same weekday it was added
}

/** Not expired (the expiry date itself is still usable) and still in stock. */
export function isActiveMedicine(med: Pick<ReminderMedicine, 'expiryDate' | 'currentQuantity'>): boolean {
  const expiry = startOfDay(new Date(med.expiryDate));
  return expiry >= startOfDay(new Date()) && med.currentQuantity > 0;
}

// ── Permissions ───────────────────────────────────────────────────────────────
let channelsReady = false;
async function ensureAndroidChannels() {
  if (Platform.OS !== 'android' || channelsReady) return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Medicine reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
  await Notifications.setNotificationChannelAsync(ANDROID_QUIET_CHANNEL_ID, {
    name: 'Reminders during Do Not Disturb',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    enableVibrate: false,
  });
  channelsReady = true;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (isWeb) {
    getServiceWorker();
    return requestWebPermission();
  }

  await ensureAndroidChannels();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

// ── Native scheduling ─────────────────────────────────────────────────────────
// Every scheduled notification carries { kind: 'dose' | 'expiry', profileId } so a
// sync can replace exactly one profile's notifications without touching others.
let syncQueue: Promise<void> = Promise.resolve();

// ── One-time cleanup ──────────────────────────────────────────────────────────
// Earlier versions of the app (including the removed test button) could leave
// notifications scheduled on the phone that later code no longer recognises.
// On the first start after an update that bumps this number, cancel EVERY
// scheduled notification and clear the tray; the normal sync that follows then
// schedules only the correct reminders again. It is queued before any sync, so
// it can never cancel freshly scheduled reminders.
export const NOTIFICATION_RESET_VERSION = 2;
const RESET_KEY = 'notificationResetVersion';

async function oneTimeReset(): Promise<void> {
  try {
    const done = Number(await AsyncStorage.getItem(RESET_KEY));
    if (done >= NOTIFICATION_RESET_VERSION) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
    await AsyncStorage.setItem(RESET_KEY, String(NOTIFICATION_RESET_VERSION));
  } catch (e) {
    console.warn('Notification reset failed:', e);
  }
}

if (!isWeb) syncQueue = syncQueue.then(oneTimeReset);

/**
 * Make the OS schedule match the given medicines and settings for this profile:
 * cancel the profile's existing reminders, then schedule
 *  - dose reminders (if "Dose Reminders" is on) for every active medicine, and
 *  - expiry reminders (if "Expiry Alerts" is on): 30, 7 and 1 day before, on the
 *    day, and the day after, at 09:00.
 * Anything falling inside Do Not Disturb is delivered silently.
 * Calls are serialized so overlapping edits can't race.
 */
export function syncMedicineReminders(
  profileId: string,
  medicines: ReminderMedicine[],
  prefs: NotificationPrefs = DEFAULT_PREFS,
  takenToday: Record<string, string> = {}
): Promise<void> {
  if (isWeb) return Promise.resolve(); // web reminders come from the in-app alert loop
  syncQueue = syncQueue
    .then(() => doSync(profileId, medicines, prefs, takenToday))
    .catch(e => console.warn('Reminder sync failed:', e));
  return syncQueue;
}

function channelFor(quiet: boolean) {
  if (Platform.OS !== 'android') return {};
  return { channelId: quiet ? ANDROID_QUIET_CHANNEL_ID : ANDROID_CHANNEL_ID };
}

async function doSync(
  profileId: string,
  medicines: ReminderMedicine[],
  prefs: NotificationPrefs,
  takenToday: Record<string, string>
) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    const data = n.content.data as Record<string, unknown> | undefined;
    const ours =
      (data?.kind === 'dose' || data?.kind === 'expiry' || data?.kind === 'followup') &&
      data?.profileId === profileId;
    // Legacy reminders (scheduled before this change) have medicineId but no kind.
    const legacy = data?.medicineId && !data?.kind;
    if (ours || legacy) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  const doseMeds = prefs.doseReminders
    ? medicines.filter(m => m.timeToTake?.length && isActiveMedicine(m))
    : [];
  const expiryMeds = prefs.expiryAlerts ? medicines.filter(m => m.currentQuantity > 0) : [];
  if (doseMeds.length === 0 && expiryMeds.length === 0) return;
  if (!(await requestNotificationPermissions())) return;

  // ── Dose reminders ──
  for (const med of doseMeds) {
    const cadence = cadenceOf(med.frequency);
    if (cadence === 'none') continue;

    for (const time of med.timeToTake ?? []) {
      const t = parseTime(time);
      if (!t) continue;
      const quiet = isQuietTime(time, prefs);
      const content = {
        title: 'Medicine Reminder',
        body: `Time to take ${med.name} (${med.dosage})`,
        sound: quiet ? false : ('default' as const),
        data: { kind: 'dose', profileId, medicineId: med.id, reminderTime: time, quiet, screen: '/schedule' },
      };

      if (cadence === 'daily') {
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: t.hour, minute: t.minute, ...channelFor(quiet) },
        });
      } else if (cadence === 'weekly') {
        const anchor = med.createdAt ? new Date(med.createdAt) : new Date();
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: anchor.getDay() + 1, // expo: 1 = Sunday
            hour: t.hour,
            minute: t.minute,
            ...channelFor(quiet),
          },
        });
      } else {
        // Every other day: no repeating trigger exists, so schedule upcoming dose
        // days as one-off reminders. Re-synced on every app start/change.
        for (let i = 0; i < ALTERNATE_DAY_HORIZON; i++) {
          const day = new Date();
          day.setDate(day.getDate() + i);
          day.setHours(t.hour, t.minute, 0, 0);
          if (day.getTime() <= Date.now() || !isDoseDay(med, day)) continue;
          await Notifications.scheduleNotificationAsync({
            content,
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: day, ...channelFor(quiet) },
          });
        }
      }
    }
  }

  // ── "Did you take it?" follow-ups ──
  // For each dose, schedule the follow-ups of its next occurrence that isn't
  // already marked taken. Marking a dose taken re-runs this sync, which cancels
  // them. Only one occurrence ahead, to stay inside iOS's 64-notification limit;
  // later days are scheduled on the next app start.
  for (const med of doseMeds) {
    if (cadenceOf(med.frequency) === 'none') continue;
    const times = med.timeToTake ?? [];
    for (const time of times) {
      if (!parseTime(time)) continue;
      for (let offset = 0; offset < 8; offset++) {
        const day = startOfDay(new Date());
        day.setDate(day.getDate() + offset);
        if (!isDoseDay(med, day)) continue;
        if (offset === 0 && takenToday[doseKey(med.id, time)]) continue;
        const upcoming = followUpTimesFor(day, time, times).filter(d => d.getTime() > Date.now());
        if (upcoming.length === 0) continue;
        const { title, body } = followUpMessage(med, time);
        for (const at of upcoming) {
          const hhmm = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
          const quiet = isQuietTime(hhmm, prefs);
          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              sound: quiet ? false : 'default',
              data: { kind: 'followup', profileId, medicineId: med.id, reminderTime: time, date: localDateKey(day), quiet, screen: '/schedule' },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, ...channelFor(quiet) },
          });
        }
        break; // only the next occurrence
      }
    }
  }

  // ── Expiry reminders ──
  const et = parseTime(EXPIRY_NOTIFY_TIME)!;
  const quietExpiry = isQuietTime(EXPIRY_NOTIFY_TIME, prefs);
  for (const med of expiryMeds) {
    const expiry = startOfDay(new Date(med.expiryDate));
    for (const daysBefore of EXPIRY_NOTIFY_DAYS) {
      const when = new Date(expiry);
      when.setDate(when.getDate() - daysBefore);
      when.setHours(et.hour, et.minute, 0, 0);
      if (when.getTime() <= Date.now()) continue;
      const { title, body } = expiryMessage(med, daysBefore);
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: quietExpiry ? false : 'default',
          data: { kind: 'expiry', profileId, medicineId: med.id, daysBefore, quiet: quietExpiry },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, ...channelFor(quietExpiry) },
      });
    }
  }
}

export function expiryMessage(med: Pick<ReminderMedicine, 'name' | 'dosage'>, daysBefore: number) {
  const label = `${med.name} (${med.dosage})`;
  if (daysBefore < 0) return { title: 'Medicine Expired', body: `${label} expired yesterday. Don't take it — replace the pack.` };
  if (daysBefore === 0) return { title: 'Medicine Expires Today', body: `${label} expires today. Plan a refill.` };
  if (daysBefore === 1) return { title: 'Medicine Expires Tomorrow', body: `${label} expires tomorrow.` };
  return { title: 'Medicine Expiring Soon', body: `${label} expires in ${daysBefore} days.` };
}

/**
 * Remove notifications left over from the old "Send Test Notification" button:
 * cancel any still scheduled and clear any still showing. Safe to call on every
 * app start; does nothing on web.
 */
export async function clearLeftoverTestNotifications(): Promise<number> {
  if (isWeb) return 0;
  const isTest = (content: Notifications.NotificationContent) =>
    (content.data as any)?.kind === 'test' || content.title === 'MediFill test notification';
  let removed = 0;
  try {
    for (const n of await Notifications.getAllScheduledNotificationsAsync()) {
      if (isTest(n.content)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
        removed++;
      }
    }
    for (const n of await Notifications.getPresentedNotificationsAsync()) {
      if (isTest(n.request.content)) {
        await Notifications.dismissNotificationAsync(n.request.identifier);
        removed++;
      }
    }
  } catch (e) {
    console.warn('Could not clear test notifications:', e);
  }
  return removed;
}

// ── Web notifications ─────────────────────────────────────────────────────────
// Browsers only allow notifications on secure origins (https:// or localhost),
// and only deliver them while the page is open. Mobile Chrome also requires
// going through a service worker rather than `new Notification()`.
let swRegistration: Promise<ServiceWorkerRegistration | null> | null = null;

function getServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (swRegistration) return swRegistration;
  swRegistration =
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator && window.isSecureContext
      ? navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).catch(() => null)
      : Promise.resolve(null);
  return swRegistration;
}

function webNotificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext;
}

async function requestWebPermission(): Promise<boolean> {
  if (!webNotificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/** Ask for permission early (e.g. after the user adds a medicine). Safe on all platforms. */
export function primeNotifications() {
  if (isWeb) {
    getServiceWorker();
    requestWebPermission();
  } else {
    requestNotificationPermissions();
  }
}

/**
 * Show a notification right now. Used for alerts that can't be scheduled ahead
 * (low stock, interactions) and, on web, for every alert type.
 * During Do Not Disturb it's delivered silently.
 */
export async function sendInstantNotification(
  title: string,
  body: string,
  tag?: string,
  prefs: NotificationPrefs = DEFAULT_PREFS,
  /** Extra data; `screen` (e.g. '/pharmacy') is opened when the notification is tapped. */
  extraData: { screen?: string; [key: string]: unknown } = {}
): Promise<void> {
  const quiet = isQuietNow(prefs);

  if (isWeb) {
    if (!webNotificationsSupported() || Notification.permission !== 'granted') return;
    const options: NotificationOptions = {
      body, tag, icon: '/favicon.ico', silent: quiet,
      data: { url: extraData.screen ?? '/' }, // read by sw.js on click
    };
    const reg = await getServiceWorker();
    try {
      if (reg) await reg.showNotification(title, options);
      else new Notification(title, options);
    } catch (e) {
      console.warn('Web notification failed:', e);
    }
    return;
  }

  if (!(await requestNotificationPermissions())) return;
  await Notifications.scheduleNotificationAsync({
    // Same identifier replaces the earlier one in the tray (e.g. one refill
    // notice per medicine that updates, instead of a pile of them).
    ...(tag ? { identifier: tag } : {}),
    content: { title, body, sound: quiet ? false : 'default', data: { kind: 'instant', quiet, ...extraData } },
    trigger: Platform.OS === 'android' ? channelFor(quiet) as { channelId: string } : null,
  });
}

/** Low-stock threshold used for alerts and refill reminders (percent left). */
export const LOW_STOCK_PERCENT = 20;

/**
 * Which notification to send when a dose is marked taken:
 *  - stock left ≤ 20% (and Low Stock Alerts on) → refill reminder, any day
 *  - otherwise, for today's doses (and Dose Reminders on) → "Dose taken ✓"
 *  - otherwise nothing
 */
export function notificationForTake(opts: {
  med: Pick<ReminderMedicine, 'id' | 'name' | 'dosage'>;
  left: number;
  total: number;
  takenAt: string;
  isToday: boolean;
  prefs: Pick<NotificationPrefs, 'lowStockAlerts' | 'doseReminders'>;
}): { kind: 'refill' | 'taken'; title: string; body: string; screen: string; tag: string } | null {
  const { med, left, total, takenAt, isToday, prefs } = opts;
  const pctLeft = total > 0 ? (left / total) * 100 : 0;
  if (pctLeft <= LOW_STOCK_PERCENT && prefs.lowStockAlerts) {
    return { kind: 'refill', ...refillMessage(med, left, total, takenAt), screen: '/pharmacy', tag: `refill-${med.id}` };
  }
  if (isToday && prefs.doseReminders) {
    return {
      kind: 'taken',
      title: 'Dose taken ✓',
      body: `${med.name} (${med.dosage}) marked as taken at ${takenAt}. ${left} left.`,
      screen: '/schedule',
      tag: `taken-${med.id}`,
    };
  }
  return null;
}

/**
 * The refill reminder sent when a dose is marked taken and the stock left is at
 * or below LOW_STOCK_PERCENT. Also confirms the dose, so it replaces "Dose taken".
 */
export function refillMessage(
  med: Pick<ReminderMedicine, 'name' | 'dosage'>,
  left: number,
  total: number,
  takenAt: string
) {
  const pct = total > 0 ? Math.round((left / total) * 100) : 0;
  if (left <= 0) {
    return {
      title: `Out of ${med.name} — refill now`,
      body: `Dose marked as taken at ${takenAt}. That was your last one. Refill ${med.name} (${med.dosage}) now — tap to order.`,
    };
  }
  return {
    title: `Running low on ${med.name} — time to refill`,
    body: `Dose marked as taken at ${takenAt}. Only ${left} of ${total} left (${pct}%). Tap to order a refill.`,
  };
}
