import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Clock,
  Pill,
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInRight, Layout } from 'react-native-reanimated';
import { useMedicineContext } from '../../context/MedicineContext';
import { doseKey, isDoseDay, localDateKey } from '../../services/notificationService';
import { daysUntilExpiry } from '../../utils/medicineValidation';
import MonthCalendar from '../../components/MonthCalendar';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../../constants/theme';

interface ScheduleItem {
  id: string;
  time: string;
  medicines: { id: string; name: string; dosage: string; taken: boolean; expired: boolean }[];
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Build an array of 7 dates centred on today
function buildWeekDays(anchor: Date): Date[] {
  const days: Date[] = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

// Local calendar dates (toISOString() is UTC, which put doses taken before
// 5:30 AM in India on the previous day).
function isSameDay(a: Date, b: Date) {
  return localDateKey(a) === localDateKey(b);
}

export default function ScheduleScreen() {
  const { medicines, activeUser, takenToday, loadTakenForDate, setDoseTaken } = useMedicineContext();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [takenMap, setTakenMap] = useState<Record<string, string>>({});
  const [showCalendar, setShowCalendar] = useState(false);

  const dateStr = localDateKey(selectedDate);
  const today = new Date();
  const weekDays = buildWeekDays(weekAnchor);

  // ── Taken status ──────────────────────────────────────────────────────────
  // Taken doses live in MedicineContext so reminders can see them (marking a
  // dose taken stops its "did you take it?" follow-ups).
  const loadTakenStatus = useCallback(async () => {
    setTakenMap(await loadTakenForDate(selectedDate));
  }, [dateStr, activeUser?.id]);

  useEffect(() => { loadTakenStatus(); }, [loadTakenStatus]);
  // Today's record can change elsewhere (new day, profile switch).
  useEffect(() => {
    if (dateStr === localDateKey()) setTakenMap(takenToday);
  }, [takenToday]);

  // ── Build schedule ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!medicines.length) { setSchedule([]); return; }

    // Medicines with stock. Expiry is judged against the day being viewed (it
    // used to be today's date for every day): doses on or before the expiry
    // date are normal; after it they're shown crossed out as "Expired".
    const activeMeds = medicines.filter(med => med.currentQuantity > 0);

    if (!activeMeds.length) { setSchedule([]); return; }

    const timeMap = new Map<string, ScheduleItem>();
    activeMeds.forEach(med => {
      // "Every other day" / "Once a week" medicines only on their dose days
      if (!isDoseDay(med, selectedDate)) return;
      med.timeToTake?.forEach(time => {
        if (!timeMap.has(time)) timeMap.set(time, { id: `time-${time}`, time, medicines: [] });
        timeMap.get(time)!.medicines.push({
          id: med.id, name: med.name, dosage: med.dosage,
          taken: !!takenMap[doseKey(med.id, time)],
          expired: daysUntilExpiry(med.expiryDate, selectedDate) < 0,
        });
      });
    });
    const sorted = Array.from(timeMap.values()).sort((a, b) => {
      const [ah, am] = a.time.split(':').map(Number);
      const [bh, bm] = b.time.split(':').map(Number);
      return ah !== bh ? ah - bh : am - bm;
    });
    setSchedule(sorted);
  }, [medicines, takenMap, dateStr]);

  // ── Toggle taken ──────────────────────────────────────────────────────────
  const isFutureDay = dateStr > localDateKey();

  const toggleMedicineTaken = async (medicineId: string, time: string) => {
    if (isFutureDay) return; // can't take tomorrow's dose today
    const med = medicines.find(m => m.id === medicineId);
    if (!med) return;
    if (daysUntilExpiry(med.expiryDate, selectedDate) < 0) return; // expired — don't take
    const taken = !!takenMap[doseKey(medicineId, time)];
    // Optimistic update so the button responds instantly
    setTakenMap(prev => ({ ...prev, [doseKey(medicineId, time)]: taken ? '' : new Date().toISOString() }));
    // Taking uses one unit of stock; un-marking gives it back. Today's doses
    // also send a confirmation and stop that dose's follow-up reminders.
    setTakenMap(await setDoseTaken(med, time, selectedDate, !taken));
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const shiftWeek = (dir: -1 | 1) => {
    const d = new Date(weekAnchor);
    d.setDate(d.getDate() + dir * 7);
    setWeekAnchor(d);
  };

  const selectDay = (date: Date) => setSelectedDate(new Date(date));

  // From the month calendar: select the day and move the week strip to it.
  const jumpToDate = (date: Date) => {
    setSelectedDate(new Date(date));
    setWeekAnchor(new Date(date));
  };

  // Doses due on a date (expired medicines excluded) — used for the calendar dots.
  const getDoseKeys = useCallback(
    (date: Date) =>
      medicines
        .filter(m => m.currentQuantity > 0 && isDoseDay(m, date) && daysUntilExpiry(m.expiryDate, date) >= 0)
        .flatMap(m => (m.timeToTake ?? []).map(t => doseKey(m.id, t))),
    [medicines]
  );

  const formatTime = (time: string) => {
    if (!time || !time.includes(':')) return '--:--';
    const [h, m] = time.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '--:--';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  // Expired doses don't count towards adherence
  const totalDoses = schedule.reduce((a, s) => a + s.medicines.filter(m => !m.expired).length, 0);
  const takenDoses = schedule.reduce((a, s) => a + s.medicines.filter(m => m.taken && !m.expired).length, 0);
  const pct = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;
  const adherenceColor =
    pct === 100 ? Colors.success : pct >= 50 ? Colors.warning : Colors.danger;

  const isToday = isSameDay(selectedDate, today);

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Header ── */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
        <View>
          <Text style={styles.title}>Schedule</Text>
          {activeUser && (
            <Text style={styles.subtitle}>for {activeUser.name}</Text>
          )}
        </View>
        <View style={styles.headerRight}>
          {totalDoses > 0 && (
            <View style={styles.pctBadge}>
              <Text style={[styles.pctBadgeNum, { color: adherenceColor }]}>{pct}%</Text>
              <Text style={styles.pctBadgeLabel}>done</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.calendarBtn}
            onPress={() => setShowCalendar(true)}
            accessibilityLabel="Open calendar"
          >
            <CalendarDays size={20} color={Colors.primary} />
            <Text style={styles.calendarBtnText}>
              {MONTH_LABELS[selectedDate.getMonth()]} {selectedDate.getDate()}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── 7-day strip ── */}
      <Animated.View entering={FadeInDown.delay(80).duration(300)} style={styles.weekStrip}>
        <TouchableOpacity style={styles.weekArrow} onPress={() => shiftWeek(-1)}>
          <ChevronLeft size={18} color={Colors.primary} />
        </TouchableOpacity>

        <View style={styles.weekDays}>
          {weekDays.map((d, i) => {
            const sel = isSameDay(d, selectedDate);
            const tod = isSameDay(d, today);
            return (
              <TouchableOpacity
                key={i}
                style={[styles.dayCell, sel && styles.dayCellActive]}
                onPress={() => selectDay(d)}
              >
                <Text style={[styles.dayLabel, sel && styles.dayLabelActive]}>
                  {DAY_LABELS[d.getDay()]}
                </Text>
                <Text style={[styles.dayNum, sel && styles.dayNumActive]}>
                  {d.getDate()}
                </Text>
                {tod && <View style={[styles.todayDot, sel && styles.todayDotActive]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.weekArrow} onPress={() => shiftWeek(1)}>
          <ChevronRight size={18} color={Colors.primary} />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Date label + adherence bar ── */}
      {totalDoses > 0 && (
        <Animated.View entering={FadeInDown.delay(140).duration(300)} style={styles.adherenceCard}>
          <View style={styles.adherenceRow}>
            <Text style={styles.adherenceTitle}>
              {isToday ? "Today's" : selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + "'s"} adherence
            </Text>
            <Text style={[styles.adherenceValue, { color: adherenceColor }]}>
              {takenDoses}/{totalDoses} doses
            </Text>
          </View>
          <View style={styles.adherenceTrack}>
            <View style={[styles.adherenceFill, { width: `${pct}%` as any, backgroundColor: adherenceColor }]} />
          </View>
        </Animated.View>
      )}

      {/* ── Timeline ── */}
      <ScrollView
        style={styles.timeline}
        contentContainerStyle={styles.timelineContent}
        showsVerticalScrollIndicator={false}
      >
        {schedule.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <CalendarDays size={44} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Nothing scheduled</Text>
            <Text style={styles.emptyDesc}>
              Add medicines with reminder times and they'll appear here.
            </Text>
          </Animated.View>
        ) : (
          schedule.map((item, idx) => (
            <Animated.View
              key={item.id}
              entering={FadeInRight.delay(idx * 70).duration(380)}
              layout={Layout.springify()}
              style={styles.timeBlock}
            >
              {/* Time label */}
              <View style={styles.timeLabelRow}>
                <View style={styles.timeDot} />
                <View style={styles.timePill}>
                  <Clock size={12} color={Colors.primary} />
                  <Text style={styles.timeText}>{formatTime(item.time)}</Text>
                </View>
                <View style={styles.timeLine} />
              </View>

              {/* Medicine cards */}
              <View style={styles.medCards}>
                {item.medicines.map(med => (
                  <Animated.View
                    key={`${med.id}-${item.time}`}
                    layout={Layout.springify()}
                    style={[styles.medCard, med.taken && styles.medCardTaken, med.expired && styles.medCardExpired]}
                  >
                    <View style={[styles.medIcon, med.taken && styles.medIconTaken, med.expired && styles.medIconExpired]}>
                      <Pill size={18} color={med.expired ? Colors.danger : med.taken ? Colors.success : Colors.primary} />
                    </View>
                    <View style={styles.medInfo}>
                      <Text
                        style={[styles.medName, med.taken && styles.medNameTaken, med.expired && styles.medNameExpired]}
                        numberOfLines={1}
                      >
                        {med.name}
                      </Text>
                      <Text style={[styles.medDosage, med.expired && styles.medDosageExpired]}>
                        {med.expired ? `${med.dosage} · expired — don't take` : med.dosage}
                      </Text>
                    </View>
                    {med.expired ? (
                      <View style={styles.expiredPill}>
                        <Text style={styles.expiredPillText}>Expired</Text>
                      </View>
                    ) : (
                    <TouchableOpacity
                      style={[styles.takeBtn, med.taken && styles.takeBtnDone, isFutureDay && styles.takeBtnUpcoming]}
                      onPress={() => toggleMedicineTaken(med.id, item.time)}
                      activeOpacity={0.75}
                      disabled={isFutureDay}
                    >
                      {isFutureDay ? (
                        <Text style={[styles.takeBtnText, { color: Colors.textMuted }]}>Upcoming</Text>
                      ) : med.taken ? (
                        <>
                          <Check size={14} color={Colors.white} />
                          <Text style={styles.takeBtnText}>Taken</Text>
                        </>
                      ) : (
                        <Text style={[styles.takeBtnText, { color: Colors.primary }]}>Take</Text>
                      )}
                    </TouchableOpacity>
                    )}
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <MonthCalendar
        visible={showCalendar}
        selectedDate={selectedDate}
        onSelect={jumpToDate}
        onClose={() => setShowCalendar(false)}
        getDoseKeys={getDoseKeys}
        loadTakenForDate={loadTakenForDate}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  takeBtnUpcoming: { backgroundColor: Colors.surfaceSecondary, borderColor: Colors.border },
  container: { flex: 1, backgroundColor: '#F0F7F6' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: 2 },
  pctBadge: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Shadow.sm,
  },
  pctBadgeNum: { fontSize: FontSize.xl, fontWeight: '800' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  calendarBtn: {
    alignItems: 'center', justifyContent: 'center', gap: 2,
    backgroundColor: Colors.white, borderRadius: 14,
    paddingHorizontal: Spacing.md, paddingVertical: 6, ...Shadow.sm,
  },
  calendarBtnText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  pctBadgeLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '500' },

  // 7-day strip
  weekStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: 18,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    ...Shadow.sm,
  },
  weekArrow: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.primaryLight,
  },
  // Cells share the space evenly and may shrink, so 7 days + arrows fit on 320px phones
  weekDays: { flex: 1, minWidth: 0, flexDirection: 'row', marginHorizontal: 2 },
  dayCell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: 6,
    marginHorizontal: 1,
    borderRadius: 12,
    gap: 3,
  },
  dayCellActive: { backgroundColor: Colors.primary },
  dayLabel: { fontSize: 10, fontWeight: '600', color: Colors.textTertiary },
  dayLabelActive: { color: 'rgba(255,255,255,0.8)' },
  dayNum: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  dayNumActive: { color: Colors.white },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary },
  todayDotActive: { backgroundColor: 'rgba(255,255,255,0.7)' },

  // Adherence card
  adherenceCard: {
    marginHorizontal: Spacing.xxl,
    marginBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  adherenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  adherenceTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  adherenceValue: { fontSize: FontSize.sm, fontWeight: '800' },
  adherenceTrack: { height: 8, backgroundColor: Colors.borderLight, borderRadius: 4, overflow: 'hidden' },
  adherenceFill: { height: 8, borderRadius: 4 },

  // Timeline
  timeline: { flex: 1 },
  timelineContent: { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.sm },

  timeBlock: { marginBottom: Spacing.xl },
  timeLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  timeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, marginRight: Spacing.sm },
  timePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  timeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  timeLine: { flex: 1, height: 1, backgroundColor: Colors.borderLight, marginLeft: Spacing.sm },

  medCards: {
    marginLeft: 5,
    borderLeftWidth: 2,
    borderLeftColor: Colors.borderLight,
    paddingLeft: Spacing.lg,
    gap: Spacing.sm,
  },
  medCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Spacing.md,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  medCardTaken: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  medIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginRight: Spacing.md,
  },
  medIconTaken: { backgroundColor: Colors.successLight },
  medInfo: { flex: 1 },
  medName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  medNameTaken: { textDecorationLine: 'line-through', color: Colors.textTertiary },
  medCardExpired: { backgroundColor: Colors.dangerLight, borderColor: '#FECACA', opacity: 0.85 },
  medIconExpired: { backgroundColor: '#FEE2E2' },
  medNameExpired: { textDecorationLine: 'line-through', color: Colors.danger },
  medDosageExpired: { color: Colors.danger },
  expiredPill: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, backgroundColor: '#FEE2E2',
  },
  expiredPillText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.danger },
  medDosage: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  takeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
  },
  takeBtnDone: { backgroundColor: Colors.success },
  takeBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.white },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: Spacing.xl },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.sm },
  emptyDesc: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center', lineHeight: 22 },
});