import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  Layout,
  SlideOutLeft,
} from 'react-native-reanimated';
import {
  Pill,
  CircleAlert as AlertCircle,
  Calendar,
  Trash2,
  Edit3,
  X,
  Save,
  Clock,
  TrendingDown,
  Package,
  Plus,
} from 'lucide-react-native';
import { Medicine, useMedicineContext } from '../context/MedicineContext';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../constants/theme';
import {
  validateName,
  normalizeName,
  checkDuplicate,
  validateTotalQuantity,
  validateCurrentQuantity,
  digitsOnly,
  daysUntilExpiry as daysUntil,
  validateExpiry,
  maxExpiryDate,
} from '../utils/medicineValidation';
import DateTimePicker from './DateTimePicker';
import TimePickerModal from './TimePickerModal';

// ── Constants ─────────────────────────────────────────────────────────────────
const FREQUENCY_OPTIONS = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'Every other day',
  'Weekly',
  'As needed',
];

interface MedicineCardProps {
  medicine: Medicine;
}

const MedicineCard: React.FC<MedicineCardProps> = ({ medicine }) => {
  const { deleteMedicine, updateMedicine, medicines } = useMedicineContext();
  const [isEditing, setIsEditing] = useState(false);

  // Full edit state — all fields
  const [editName, setEditName]               = useState(medicine.name);
  const [editDosage, setEditDosage]           = useState(medicine.dosage);
  const [editFrequency, setEditFrequency]     = useState(medicine.frequency);
  const [editTotalQty, setEditTotalQty]       = useState(String(medicine.totalQuantity));
  const [editCurrentQty, setEditCurrentQty]   = useState(String(medicine.currentQuantity));
  const [editExpiry, setEditExpiry]           = useState(new Date(medicine.expiryDate));
  const [editNotes, setEditNotes]             = useState(medicine.notes || '');
  const [editTimes, setEditTimes]             = useState<string[]>(medicine.timeToTake ?? []);
  const [showDatePicker, setShowDatePicker]   = useState(false);
  const [showTimePicker, setShowTimePicker]   = useState(false);
  const [editingTimeIdx, setEditingTimeIdx]   = useState(0);

  // Reset all fields when opening the modal
  const openEdit = () => {
    setEditName(medicine.name);
    setEditDosage(medicine.dosage);
    setEditFrequency(medicine.frequency);
    setEditTotalQty(String(medicine.totalQuantity));
    setEditCurrentQty(String(medicine.currentQuantity));
    setEditExpiry(new Date(medicine.expiryDate));
    setEditNotes(medicine.notes || '');
    setEditTimes(medicine.timeToTake ?? []);
    setIsEditing(true);
  };

  // ── Computed values ───────────────────────────────────────────────────────
  const daysUntilExpiry = () => daysUntil(medicine.expiryDate);

  const pctRemaining = () =>
    (medicine.currentQuantity / medicine.totalQuantity) * 100;

  const isExpired      = daysUntilExpiry() < 0;
  const isExpiringSoon = daysUntilExpiry() <= 30 && daysUntilExpiry() >= 0;
  const isRunningLow   = pctRemaining() <= 20;
  const hasInteractions = medicine.interactions && medicine.interactions.length > 0;

  const getStockColor = () => {
    const p = pctRemaining();
    if (p <= 10) return Colors.danger;
    if (p <= 20) return Colors.warning;
    return Colors.success;
  };

  const getExpiryColor = () => {
    if (isExpired) return Colors.danger;
    if (isExpiringSoon) return Colors.warning;
    return Colors.success;
  };

  const formatTime = (t: string) => {
    if (!t || !t.includes(':')) return '--:--';
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '--:--';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleDelete = () => {
    Alert.alert(
      'Delete Medicine',
      `Are you sure you want to delete ${medicine.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', onPress: () => deleteMedicine(medicine.id), style: 'destructive' },
      ]
    );
  };

  // Same rules as the Add form, shown inline (Alert.alert does nothing on web).
  const editDuplicate = checkDuplicate(editName, editDosage, medicines, medicine.id);
  const editErrors = {
    name: validateName(editName) || editDuplicate.error,
    dosage: editDosage.trim() ? '' : 'Enter the dosage (e.g. 500mg)',
    total: validateTotalQuantity(editTotalQty),
    current: validateCurrentQuantity(editCurrentQty, editTotalQty),
  };
  const expiryChanged = daysUntil(editExpiry) !== daysUntil(medicine.expiryDate);
  const editExpiryCheck = validateExpiry(editExpiry);
  const editExpiryError = expiryChanged ? editExpiryCheck.error : '';
  const editHasErrors = Object.values(editErrors).some(Boolean) || !!editExpiryError;

  const handleSaveEdit = () => {
    if (editHasErrors) return;
    const total   = Number(editTotalQty);
    const current = Number(editCurrentQty);
    updateMedicine({
      ...medicine,
      name:            normalizeName(editName),
      dosage:          editDosage.trim(),
      frequency:       editFrequency,
      totalQuantity:   total,
      currentQuantity: current,
      expiryDate:      editExpiry.toISOString(),
      notes:           editNotes,
      timeToTake:      editTimes,
    });
    setIsEditing(false);
  };

  const handleAddTime = () => {
    setEditTimes(prev => [...prev, '08:00']);
    setEditingTimeIdx(editTimes.length);
    setShowTimePicker(true);
  };

  const handleRemoveTime = (idx: number) => {
    setEditTimes(prev => prev.filter((_, i) => i !== idx));
  };

  const hasWarning = isExpired || isExpiringSoon || isRunningLow || hasInteractions;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={SlideOutLeft.duration(300)}
      layout={Layout.springify()}
    >
      <View style={[styles.card, isExpired && styles.cardExpired]}>

        {/* ── Card header ── */}
        <View style={styles.header}>
          <View style={[styles.iconWrap, isExpired && styles.iconWrapExpired]}>
            <Pill size={20} color={isExpired ? Colors.danger : Colors.primary} />
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.name} numberOfLines={1}>{medicine.name}</Text>
            <Text style={styles.dosage}>{medicine.dosage}</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
              <Edit3 size={15} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Trash2 size={15} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Stock bar ── */}
        <View style={styles.stockRow}>
          <View style={styles.stockTrack}>
            <View style={[styles.stockFill, { width: `${Math.min(pctRemaining(), 100)}%` as any, backgroundColor: getStockColor() }]} />
          </View>
          <Text style={[styles.stockPct, { color: getStockColor() }]}>
            {Math.round(pctRemaining())}%
          </Text>
        </View>

        {/* ── Info chips ── */}
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Pill size={11} color={Colors.textTertiary} />
            <Text style={styles.chipText}>{medicine.frequency}</Text>
          </View>
          <View style={[styles.chip, { borderColor: getStockColor() + '44' }]}>
            <Package size={11} color={getStockColor()} />
            <Text style={[styles.chipText, { color: getStockColor() }]}>
              {medicine.currentQuantity}/{medicine.totalQuantity}
            </Text>
          </View>
          <View style={[styles.chip, { borderColor: getExpiryColor() + '44' }]}>
            <Calendar size={11} color={getExpiryColor()} />
            <Text style={[styles.chipText, { color: getExpiryColor() }]}>
              {isExpired ? 'Expired' : daysUntilExpiry() === 0 ? 'Expires today' : `${daysUntilExpiry()}d left`}
            </Text>
          </View>
        </View>

        {/* ── Schedule times ── */}
        {medicine.timeToTake && medicine.timeToTake.length > 0 && (
          <View style={styles.timesRow}>
            <Clock size={12} color={Colors.primary} />
            <View style={styles.timeChips}>
              {medicine.timeToTake.map(t => (
                <View key={t} style={styles.timeChip}>
                  <Text style={styles.timeChipText}>{formatTime(t)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Warning banners ── */}
        {hasWarning && (
          <View style={styles.warnings}>
            {isExpired && (
              <View style={[styles.warn, styles.warnDanger]}>
                <Calendar size={12} color={Colors.danger} />
                <Text style={styles.warnTextDanger}>Expired — update expiry date or delete</Text>
              </View>
            )}
            {isExpiringSoon && !isExpired && (
              <View style={[styles.warn, styles.warnYellow]}>
                <Calendar size={12} color={Colors.warning} />
                <Text style={styles.warnTextYellow}>
                  {daysUntilExpiry() === 0
                    ? 'Expires today'
                    : `Expires in ${daysUntilExpiry()} day${daysUntilExpiry() === 1 ? '' : 's'}`}
                </Text>
              </View>
            )}
            {isRunningLow && (
              <View style={[styles.warn, styles.warnDanger]}>
                <TrendingDown size={12} color={Colors.danger} />
                <Text style={styles.warnTextDanger}>Low stock ({Math.round(pctRemaining())}%)</Text>
              </View>
            )}
            {hasInteractions && (
              <View style={[styles.warn, styles.warnDanger]}>
                <AlertCircle size={12} color={Colors.danger} />
                <Text style={styles.warnTextDanger} numberOfLines={1}>
                  Interacts with: {medicine.interactions?.join(', ')}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ══════════════════════════════════════════════════════════════════════
          FULL EDIT MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={isEditing} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Medicine</Text>
                <Text style={styles.modalSub}>Update all details below</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={() => setIsEditing(false)}>
                <X size={20} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* ── Name ── */}
              <Text style={styles.label}>Medicine Name *</Text>
              <TextInput
                style={[styles.input, !!editErrors.name && styles.inputError]}
                value={editName}
                onChangeText={setEditName}
                onBlur={() => setEditName(n => normalizeName(n))}
                placeholder="e.g. Paracetamol"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={80}
              />
              {editErrors.name ? (
                <Text style={styles.fieldError}>⚠ {editErrors.name}</Text>
              ) : editDuplicate.warning ? (
                <Text style={styles.fieldWarn}>ⓘ {editDuplicate.warning}</Text>
              ) : null}

              {/* ── Dosage ── */}
              <Text style={styles.label}>Dosage *</Text>
              <TextInput
                style={[styles.input, !!editErrors.dosage && styles.inputError]}
                value={editDosage}
                onChangeText={setEditDosage}
                placeholder="e.g. 500mg"
                placeholderTextColor={Colors.textMuted}
                maxLength={30}
              />
              {editErrors.dosage ? <Text style={styles.fieldError}>⚠ {editErrors.dosage}</Text> : null}

              {/* ── Frequency ── */}
              <Text style={styles.label}>Frequency</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.lg }}>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, paddingRight: Spacing.lg }}>
                  {FREQUENCY_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.freqPill, editFrequency === opt && styles.freqPillActive]}
                      onPress={() => setEditFrequency(opt)}
                    >
                      <Text style={[styles.freqText, editFrequency === opt && styles.freqTextActive]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* ── Quantity row ── */}
              <View style={styles.qtyRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.label}>Total Qty *</Text>
                  <TextInput
                    style={[styles.input, !!editErrors.total && styles.inputError]}
                    value={editTotalQty}
                    onChangeText={t => setEditTotalQty(digitsOnly(t))}
                    keyboardType="number-pad"
                    maxLength={5}
                    placeholder="30"
                    placeholderTextColor={Colors.textMuted}
                  />
                  {editErrors.total ? <Text style={styles.fieldError}>⚠ {editErrors.total}</Text> : null}
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.label}>Current Qty *</Text>
                  <TextInput
                    style={[styles.input, !!editErrors.current && styles.inputError]}
                    value={editCurrentQty}
                    onChangeText={t => setEditCurrentQty(digitsOnly(t))}
                    keyboardType="number-pad"
                    maxLength={5}
                    placeholder="25"
                    placeholderTextColor={Colors.textMuted}
                  />
                  {editErrors.current ? <Text style={styles.fieldError}>⚠ {editErrors.current}</Text> : null}
                </View>
              </View>

              {/* ── Expiry Date ── */}
              <Text style={styles.label}>Expiry Date</Text>
              <TouchableOpacity
                style={[styles.input, styles.dateBtn, !!editExpiryError && styles.inputError]}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar size={15} color={Colors.primary} />
                <Text style={styles.dateBtnText}>
                  {editExpiry.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
              </TouchableOpacity>
              {editExpiryError ? (
                <Text style={styles.fieldError}>⚠ {editExpiryError}</Text>
              ) : !expiryChanged && daysUntil(medicine.expiryDate) < 0 ? (
                <Text style={styles.fieldError}>⚠ This medicine has expired — pick the new pack's expiry date</Text>
              ) : editExpiryCheck.warning ? (
                <Text style={styles.fieldWarn}>ⓘ {editExpiryCheck.warning}</Text>
              ) : null}
              {showDatePicker && (
                <DateTimePicker
                  value={editExpiry}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  maximumDate={maxExpiryDate()}
                  onChange={(_e, d) => {
                    setShowDatePicker(false);
                    if (d) setEditExpiry(d);
                  }}
                />
              )}

              {/* ── Reminder Times ── */}
              <Text style={styles.label}>Reminder Times</Text>
              <View style={styles.timesWrap}>
                {editTimes.map((t, idx) => (
                  <View key={idx} style={styles.timeTag}>
                    <TouchableOpacity
                      style={styles.timeTagInner}
                      onPress={() => { setEditingTimeIdx(idx); setShowTimePicker(true); }}
                    >
                      <Clock size={12} color={Colors.primary} />
                      <Text style={styles.timeTagText}>{formatTime(t)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.timeTagRemove} onPress={() => handleRemoveTime(idx)}>
                      <X size={11} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addTimeBtn} onPress={handleAddTime}>
                  <Plus size={13} color={Colors.primary} />
                  <Text style={styles.addTimeBtnText}>Add time</Text>
                </TouchableOpacity>
              </View>

              {/* ── Notes ── */}
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editNotes}
                onChangeText={setEditNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholder="Side effects, instructions…"
                placeholderTextColor={Colors.textMuted}
              />

              {/* ── Save ── */}
              <TouchableOpacity
                style={[styles.saveBtn, editHasErrors && { opacity: 0.45 }]}
                onPress={handleSaveEdit}
                disabled={editHasErrors}
              >
                <Save size={18} color={Colors.white} />
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>

              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Time picker modal */}
      <TimePickerModal
        visible={showTimePicker}
        initialTime={editTimes[editingTimeIdx] ?? '08:00'}
        onConfirm={(time) => {
          setEditTimes(prev => {
            const next = [...prev];
            next[editingTimeIdx] = time;
            return next;
          });
          setShowTimePicker(false);
        }}
        onCancel={() => setShowTimePicker(false)}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  inputError: { borderColor: Colors.danger },
  fieldError: { fontSize: 11, color: Colors.danger, marginTop: -8, marginBottom: 12, lineHeight: 16 },
  fieldWarn: { fontSize: 11, color: Colors.warning, marginTop: -8, marginBottom: 12, lineHeight: 16 },
  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadow.sm,
  },
  cardExpired: {
    borderColor: Colors.danger + '55',
    backgroundColor: '#FFF8F8',
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  iconWrap: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginRight: Spacing.md,
  },
  iconWrapExpired: { backgroundColor: Colors.dangerLight },
  titleBlock: { flex: 1 },
  name: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  dosage: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  editBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.dangerLight,
    justifyContent: 'center', alignItems: 'center',
  },

  // Stock bar
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  stockTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.borderLight, overflow: 'hidden' },
  stockFill: { height: 6, borderRadius: 3 },
  stockPct: { fontSize: FontSize.xs, fontWeight: '700', minWidth: 32, textAlign: 'right' },

  // Chips
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  chipText: { fontSize: 11, fontWeight: '600', color: Colors.textTertiary },

  // Times
  timesRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
  timeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  timeChip: {
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  timeChipText: { fontSize: 11, fontWeight: '700', color: Colors.primary },

  // Warnings
  warnings: { marginTop: Spacing.sm, gap: 5 },
  warn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.sm, paddingVertical: 5,
    borderRadius: BorderRadius.sm,
  },
  warnDanger: { backgroundColor: Colors.dangerLight },
  warnYellow: { backgroundColor: Colors.warningLight },
  warnTextDanger: { fontSize: 11, color: Colors.dangerDark, fontWeight: '500', flex: 1 },
  warnTextYellow: { fontSize: 11, color: Colors.warning, fontWeight: '500', flex: 1 },

  // ── Modal ─────────────────────────────────────────────────────────────────
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.xl,
    paddingBottom: Spacing.lg,
    maxHeight: '92%',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: Spacing.xl,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  modalSub: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: 2 },
  modalClose: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center',
  },

  label: {
    fontSize: FontSize.xs, fontWeight: '700', color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md, color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  textArea: { minHeight: 80 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  dateBtnText: { fontSize: FontSize.md, color: Colors.textPrimary },

  qtyRow: { flexDirection: 'row', marginBottom: 0 },

  // Frequency pills
  freqPill: {
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  freqPillActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  freqText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textTertiary },
  freqTextActive: { color: Colors.primary },

  // Time tags
  timesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  timeTag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.primary,
    overflow: 'hidden',
  },
  timeTagInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 8, gap: 5 },
  timeTagText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  timeTagRemove: { paddingHorizontal: Spacing.sm, paddingVertical: 8, borderLeftWidth: 1, borderLeftColor: Colors.primary + '55' },
  addTimeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5, borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  addTimeBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  // Save button
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 14, paddingVertical: Spacing.lg,
    gap: Spacing.sm, marginTop: Spacing.sm, ...Shadow.md,
  },
  saveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
});

export default MedicineCard;