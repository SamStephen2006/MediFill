import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronUp, ChevronDown, Check, X } from 'lucide-react-native';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../constants/theme';

interface TimePickerModalProps {
  visible: boolean;
  initialTime: string; // "HH:MM" 24-hour
  onConfirm: (time: string) => void;
  onCancel: () => void;
}

const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function TimePickerModal({
  visible,
  initialTime,
  onConfirm,
  onCancel,
}: TimePickerModalProps) {
  // Parse initial "HH:MM"
  const parseTime = (t: string) => {
    const parts = t?.split(':');
    const h = parseInt(parts?.[0] ?? '8', 10);
    const m = parseInt(parts?.[1] ?? '0', 10);
    return {
      hour12: h === 0 ? 12 : h > 12 ? h - 12 : h,
      minute: MINUTE_STEPS.includes(m) ? m : 0,
      isPM: h >= 12,
    };
  };

  const init = parseTime(initialTime);
  const [hour12, setHour12] = useState(init.hour12);
  const [minute, setMinute] = useState(init.minute);
  const [isPM, setIsPM] = useState(init.isPM);

  // Keep state in sync when modal opens with a new initialTime
  React.useEffect(() => {
    if (visible) {
      const p = parseTime(initialTime);
      setHour12(p.hour12);
      setMinute(p.minute);
      setIsPM(p.isPM);
    }
  }, [visible, initialTime]);

  const incrementHour = () => setHour12(h => (h % 12) + 1);
  const decrementHour = () => setHour12(h => h === 1 ? 12 : h - 1);

  // Functional updates so quick repeated taps each count (they used to read a
  // stale minute and two fast taps only moved one step).
  const stepMinute = (dir: 1 | -1) =>
    setMinute(m => {
      const i = Math.max(0, MINUTE_STEPS.indexOf(m));
      return MINUTE_STEPS[(i + dir + MINUTE_STEPS.length) % MINUTE_STEPS.length];
    });
  const incrementMinute = () => stepMinute(1);
  const decrementMinute = () => stepMinute(-1);

  const handleConfirm = () => {
    // Convert back to 24-hour HH:MM
    let h24 = hour12 % 12; // 12 → 0
    if (isPM) h24 += 12;   // add 12 for PM; 12 PM → 12
    onConfirm(`${pad(h24)}:${pad(minute)}`);
  };

  const displayTime = `${pad(hour12)}:${pad(minute)} ${isPM ? 'PM' : 'AM'}`;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Animated.View entering={FadeInDown.duration(280)} style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Set Time</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onCancel}>
              <X size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* Preview */}
          <Text style={styles.preview}>{displayTime}</Text>

          {/* Picker row */}
          <View style={styles.pickerRow}>

            {/* Hour */}
            <View style={styles.spinnerCol}>
              <Text style={styles.spinnerLabel}>Hour</Text>
              <TouchableOpacity style={styles.arrowBtn} onPress={incrementHour}>
                <ChevronUp size={22} color={Colors.primary} />
              </TouchableOpacity>
              <View style={styles.valueBox}>
                <Text style={styles.valueText}>{pad(hour12)}</Text>
              </View>
              <TouchableOpacity style={styles.arrowBtn} onPress={decrementHour}>
                <ChevronDown size={22} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.colon}>:</Text>

            {/* Minute */}
            <View style={styles.spinnerCol}>
              <Text style={styles.spinnerLabel}>Min</Text>
              <TouchableOpacity style={styles.arrowBtn} onPress={incrementMinute}>
                <ChevronUp size={22} color={Colors.primary} />
              </TouchableOpacity>
              <View style={styles.valueBox}>
                <Text style={styles.valueText}>{pad(minute)}</Text>
              </View>
              <TouchableOpacity style={styles.arrowBtn} onPress={decrementMinute}>
                <ChevronDown size={22} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            {/* AM / PM toggle */}
            <View style={styles.ampmCol}>
              <Text style={styles.spinnerLabel}>Period</Text>
              <TouchableOpacity
                style={[styles.ampmBtn, !isPM && styles.ampmBtnActive]}
                onPress={() => setIsPM(false)}
              >
                <Text style={[styles.ampmText, !isPM && styles.ampmTextActive]}>AM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ampmBtn, isPM && styles.ampmBtnActive]}
                onPress={() => setIsPM(true)}
              >
                <Text style={[styles.ampmText, isPM && styles.ampmTextActive]}>PM</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Minute quick-select */}
          <View style={styles.minuteQuick}>
            {[0, 15, 30, 45].map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.quickBtn, minute === m && styles.quickBtnActive]}
                onPress={() => setMinute(m)}
              >
                <Text style={[styles.quickText, minute === m && styles.quickTextActive]}>
                  :{pad(m)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Check size={16} color={Colors.white} />
              <Text style={styles.confirmText}>Set Time</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: Spacing.xxl,
    width: '100%',
    maxWidth: 340,
    ...Shadow.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center',
  },

  // Preview
  preview: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.primary,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: Spacing.xl,
  },

  // Spinner
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  spinnerCol: { alignItems: 'center', gap: 4 },
  spinnerLabel: {
    fontSize: FontSize.xs, fontWeight: '600',
    color: Colors.textTertiary, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 4,
  },
  arrowBtn: {
    width: 44, height: 36, borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  valueBox: {
    width: 64, height: 52,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.primary,
    marginVertical: 4,
  },
  valueText: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  colon: {
    fontSize: 32, fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 36, // align with value boxes
  },

  // AM/PM
  ampmCol: { alignItems: 'center', gap: 6, marginTop: 36 },
  ampmBtn: {
    width: 56, height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
  },
  ampmBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  ampmText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textTertiary },
  ampmTextActive: { color: Colors.white },

  // Quick minute select
  minuteQuick: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  quickBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1, borderColor: Colors.border,
  },
  quickBtnActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  quickText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textTertiary },
  quickTextActive: { color: Colors.primary },

  // Actions
  actions: { flexDirection: 'row', gap: Spacing.md },
  cancelBtn: {
    flex: 1, paddingVertical: Spacing.md,
    borderRadius: 12, backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
  },
  cancelText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textTertiary },
  confirmBtn: {
    flex: 2, paddingVertical: Spacing.md,
    borderRadius: 12, backgroundColor: Colors.primary,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: Spacing.sm,
    ...Shadow.sm,
  },
  confirmText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
});
