import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../constants/theme';
import { localDateKey } from '../services/notificationService';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type DayStatus = 'none' | 'upcoming' | 'done' | 'partial' | 'missed';

const STATUS_COLOR: Record<Exclude<DayStatus, 'none'>, string> = {
  done: Colors.success,
  partial: Colors.warning,
  missed: Colors.danger,
  upcoming: Colors.primary,
};

interface Props {
  visible: boolean;
  selectedDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
  /** Dose keys ("<medId>|<HH:MM>") due on a date — expired medicines excluded. */
  getDoseKeys: (date: Date) => string[];
  loadTakenForDate: (date: Date) => Promise<Record<string, string>>;
}

/** 6×7 grid of dates for the month, starting on the Sunday on/before the 1st. */
function buildGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export default function MonthCalendar({
  visible, selectedDate, onSelect, onClose, getDoseKeys, loadTakenForDate,
}: Props) {
  const [view, setView] = useState({ y: selectedDate.getFullYear(), m: selectedDate.getMonth() });
  const [status, setStatus] = useState<Record<string, DayStatus>>({});
  const todayKey = localDateKey();

  // Open on the selected date's month
  useEffect(() => {
    if (visible) setView({ y: selectedDate.getFullYear(), m: selectedDate.getMonth() });
  }, [visible]);

  const grid = useMemo(() => buildGrid(view.y, view.m), [view.y, view.m]);

  // Work out each day's dot: all taken / some / missed / upcoming
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, DayStatus> = {};
      await Promise.all(
        grid.map(async d => {
          const key = localDateKey(d);
          const doses = getDoseKeys(d);
          if (doses.length === 0) { next[key] = 'none'; return; }
          if (key > todayKey) { next[key] = 'upcoming'; return; }
          const taken = await loadTakenForDate(d);
          const n = doses.filter(k => !!taken[k]).length;
          if (n === doses.length) next[key] = 'done';
          else if (n > 0) next[key] = 'partial';
          else next[key] = key === todayKey ? 'upcoming' : 'missed';
        })
      );
      if (!cancelled) setStatus(next);
    })();
    return () => { cancelled = true; };
  }, [visible, grid, getDoseKeys]);

  const shiftMonth = (dir: -1 | 1) =>
    setView(v => {
      const d = new Date(v.y, v.m + dir, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const pick = (d: Date) => { onSelect(d); onClose(); };
  const selectedKey = localDateKey(selectedDate);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* Inner Pressable stops taps on the card from closing it */}
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.navBtn} onPress={() => shiftMonth(-1)} accessibilityLabel="Previous month">
              <ChevronLeft size={18} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{MONTHS[view.m]} {view.y}</Text>
            <TouchableOpacity style={styles.navBtn} onPress={() => shiftMonth(1)} accessibilityLabel="Next month">
              <ChevronRight size={18} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close calendar">
              <X size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={styles.weekday}>{w}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {grid.map(d => {
              const key = localDateKey(d);
              const inMonth = d.getMonth() === view.m;
              const isSel = key === selectedKey;
              const isToday = key === todayKey;
              const st = status[key] ?? 'none';
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.cell}
                  onPress={() => pick(d)}
                  accessibilityLabel={d.toDateString()}
                >
                  <View style={[styles.dayCircle, isToday && styles.todayRing, isSel && styles.selected]}>
                    <Text
                      style={[
                        styles.dayText,
                        !inMonth && styles.dayTextOut,
                        isToday && styles.dayTextToday,
                        isSel && styles.dayTextSel,
                      ]}
                    >
                      {d.getDate()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.dot,
                      st === 'none' ? { opacity: 0 } : { backgroundColor: STATUS_COLOR[st] },
                      st === 'upcoming' && styles.dotUpcoming,
                      !inMonth && { opacity: st === 'none' ? 0 : 0.35 },
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.legend}>
            {([
              ['done', 'All taken'],
              ['partial', 'Some taken'],
              ['missed', 'Missed'],
              ['upcoming', 'Scheduled'],
            ] as const).map(([st, label]) => (
              <View key={st} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: STATUS_COLOR[st] }, st === 'upcoming' && styles.dotUpcoming]} />
                <Text style={styles.legendText}>{label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.todayBtn} onPress={() => pick(new Date())}>
            <Text style={styles.todayBtnText}>Go to Today</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.lg,
  },
  card: {
    width: '100%', maxWidth: 380, backgroundColor: Colors.white,
    borderRadius: BorderRadius.xxl, padding: Spacing.lg, ...Shadow.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.sm },
  navBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  monthTitle: { flex: 1, textAlign: 'center', fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center', marginLeft: Spacing.xs,
  },
  row: { flexDirection: 'row' },
  weekday: {
    width: `${100 / 7}%`, textAlign: 'center', fontSize: FontSize.xs,
    fontWeight: '700', color: Colors.textMuted, paddingVertical: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  todayRing: { borderWidth: 1.5, borderColor: Colors.primary },
  selected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  dayTextOut: { color: Colors.textMuted, fontWeight: '400' },
  dayTextToday: { color: Colors.primary, fontWeight: '800' },
  dayTextSel: { color: Colors.white, fontWeight: '800' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  dotUpcoming: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  legend: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: Spacing.md, marginTop: Spacing.md, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '600' },
  todayBtn: {
    marginTop: Spacing.md, alignSelf: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, backgroundColor: Colors.primaryLight,
  },
  todayBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
});
