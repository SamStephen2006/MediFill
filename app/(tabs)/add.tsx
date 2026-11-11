import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  Camera,
  Calendar,
  Clock,
  Pill,
  Package,
  ScanLine,
  Plus,
  X,
  FileText,
  ChevronRight,
} from 'lucide-react-native';
import { useMedicineContext } from '../../context/MedicineContext';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '../../components/DateTimePicker';
import TimePickerModal from '../../components/TimePickerModal';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../../constants/theme';
import {
  validateName,
  normalizeName,
  checkDuplicate,
  validateTotalQuantity,
  validateCurrentQuantity,
  digitsOnly,
  validateExpiry,
  parseLocalDate,
  maxExpiryDate,
} from '../../utils/medicineValidation';

// ── Constants ─────────────────────────────────────────────────────────────────
const FREQUENCY_OPTIONS = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'Every other day',
  'Once a week',
  'As needed',
];

// ── Section header helper ─────────────────────────────────────────────────────
function SectionCard({
  title,
  icon,
  delay = 0,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)} style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconWrap}>{icon}</View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </Animated.View>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({
  label,
  required,
  error,
  errorMsg,
  warning,
  style,
  children,
}: {
  label: string;
  required?: boolean;
  error?: boolean;
  errorMsg?: string;
  warning?: string;
  style?: any;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      {children}
      {error && errorMsg ? <Text style={styles.errorText}>⚠ {errorMsg}</Text> : null}
      {!error && warning ? <Text style={styles.warningText}>ⓘ {warning}</Text> : null}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AddMedicineScreen() {
  const { addMedicine, medicines } = useMedicineContext();
  const params = useLocalSearchParams<{
    ocrName?: string;
    ocrDosage?: string;
    ocrExpiry?: string;
    ocrQuantity?: string;
    ocrRawText?: string;
  }>();

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [timesToTake, setTimesToTake] = useState<string[]>(['08:00']);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
  // Errors show once a field has been touched, or for every field after Submit.
  type FieldKey = 'name' | 'dosage' | 'frequency' | 'totalQuantity' | 'currentQuantity' | 'expiry';
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({
    name: false, dosage: false, frequency: false, totalQuantity: false, currentQuantity: false, expiry: false,
  });
  const [submitted, setSubmitted] = useState(false);
  // Has the user typed in "Current Qty" themselves? Until then it mirrors the total.
  const [currentEdited, setCurrentEdited] = useState(false);
  const touch = (k: FieldKey) => setTouched(t => (t[k] ? t : { ...t, [k]: true }));

  // ── Live validation (recomputed as the user types) ────────────────────────
  const duplicate = checkDuplicate(name, dosage, medicines);
  const expiryCheck = validateExpiry(expiryDate);
  const fieldErrors: Record<FieldKey, string> = {
    name: validateName(name) || duplicate.error,
    dosage: dosage.trim() ? '' : 'Enter the dosage (e.g. 500mg)',
    frequency: frequency ? '' : 'Please select a frequency',
    totalQuantity: validateTotalQuantity(totalQuantity),
    currentQuantity: validateCurrentQuantity(currentQuantity, totalQuantity),
    expiry: expiryCheck.error,
  };
  const shown = (k: FieldKey) => (touched[k] || submitted ? fieldErrors[k] : '');
  const errors = {
    name: !!shown('name'),
    dosage: !!shown('dosage'),
    frequency: !!shown('frequency'),
    totalQuantity: !!shown('totalQuantity'),
    // "More than the total" shows as soon as both boxes have a value.
    currentQuantity:
      !!shown('currentQuantity') ||
      (!!currentQuantity && !!totalQuantity && !!fieldErrors.currentQuantity),
    // A picked date that's already passed is flagged immediately.
    expiry: !!shown('expiry') || (!!expiryDate && !!fieldErrors.expiry),
  };
  const errorCount = Object.values(fieldErrors).filter(Boolean).length;

  // Typing a total fills "current" too, until the user edits current themselves.
  const handleTotalChange = (text: string) => {
    const v = digitsOnly(text);
    setTotalQuantity(v);
    if (!currentEdited) setCurrentQuantity(v);
  };

  // ── Apply OCR params (unchanged) ──────────────────────────────────────────
  useEffect(() => {
    // Scanned values can be wrong, so show their validation straight away.
    if (params.ocrName) { setName(params.ocrName); touch('name'); }
    if (params.ocrDosage) { setDosage(params.ocrDosage); touch('dosage'); }
    if (params.ocrQuantity) {
      setTotalQuantity(digitsOnly(params.ocrQuantity));
      setCurrentQuantity(digitsOnly(params.ocrQuantity));
      touch('totalQuantity');
    }
    if (params.ocrExpiry) {
      const date = parseLocalDate(params.ocrExpiry);
      if (date) { setExpiryDate(date); touch('expiry'); }
    }
    if (params.ocrRawText) {
      setNotes(`Scanned text:\n${params.ocrRawText}`);
    }
  }, [params.ocrName, params.ocrDosage, params.ocrQuantity, params.ocrExpiry]);

  // ── Scan / image handlers (unchanged) ─────────────────────────────────────
  const handleScanMedicine = () => router.push('/camera');


  const validateForm = () => {
    setSubmitted(true);
    return errorCount === 0;
  };

  // ── Time helpers (unchanged) ───────────────────────────────────────────────
  const handleAddTimeToTake = () => setTimesToTake([...timesToTake, '12:00']);
  const handleRemoveTimeToTake = (index: number) => {
    const t = [...timesToTake];
    t.splice(index, 1);
    setTimesToTake(t);
  };
  const handleTimeChange = (index: number, time: string) => {
    const t = [...timesToTake];
    t[index] = time;
    setTimesToTake(t);
  };
  const handleTimePickerOpen = (index: number) => {
    setCurrentTimeIndex(index);
    setShowTimePicker(true);
  };
  // handleTimePickerChange is now handled by TimePickerModal's onConfirm

  // ── Submit (unchanged) ─────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!validateForm()) return;
    const newMedicine = {
      id: Date.now().toString(),
      name: normalizeName(name),
      dosage: dosage.trim(),
      frequency,
      totalQuantity: Number(totalQuantity),
      currentQuantity: Number(currentQuantity),
      expiryDate: (expiryDate as Date).toISOString(),
      notes,
      timeToTake: timesToTake,
      createdAt: new Date().toISOString(),
    };
    addMedicine(newMedicine);
    if (Platform.OS === 'web') {
      alert('Medicine added successfully!');
    } else {
      Alert.alert('Success', 'Medicine added successfully!', [
        { text: 'OK', onPress: () => router.navigate('/') },
      ]);
    }
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setDosage('');
    setFrequency('');
    setTotalQuantity('');
    setCurrentQuantity('');
    setExpiryDate(null);
    setNotes('');
    setTimesToTake(['08:00']);
    setTouched({ name: false, dosage: false, frequency: false, totalQuantity: false, currentQuantity: false, expiry: false });
    setSubmitted(false);
    setCurrentEdited(false);
  };

  // ── Progress indicator ─────────────────────────────────────────────────────
  const filledCount = [name, dosage, frequency, totalQuantity, currentQuantity, expiryDate].filter(Boolean).length;
  const progress = filledCount / 6;

  // ── Format HH:MM → "H:MM AM/PM" for display ───────────────────────────────
  const formatDisplayTime = (t: string) => {
    if (!t || !t.includes(':')) return t;
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return t;
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
          <View>
            <Text style={styles.title}>Add Medicine</Text>
            <Text style={styles.subtitle}>Scan a label or enter details manually</Text>
          </View>
          {/* Form completion indicator */}
          <View style={styles.progressWrap}>
            <Text style={styles.progressLabel}>{Math.round(progress * 100)}%</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
            </View>
          </View>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Scan banner ── */}
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <TouchableOpacity style={styles.scanCard} onPress={handleScanMedicine} activeOpacity={0.85}>
              <View style={styles.scanLeft}>
                <View style={styles.scanIconBg}>
                  <ScanLine size={26} color={Colors.white} />
                </View>
                <View>
                  <Text style={styles.scanTitle}>Scan Medicine Label</Text>
                  <Text style={styles.scanSub}>Auto-fill details with your camera</Text>
                </View>
              </View>
              <View style={styles.scanArrow}>
                <Camera size={16} color={Colors.white} />
                <ChevronRight size={16} color={Colors.white} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Divider */}
          <Animated.View entering={FadeInDown.delay(120).duration(300)} style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or fill in manually</Text>
            <View style={styles.orLine} />
          </Animated.View>

          {/* ── Section 1: Basic Info ── */}
          <SectionCard
            title="Basic Information"
            icon={<Pill size={16} color={Colors.primary} />}
            delay={160}
          >
            <Field
              label="Medicine Name"
              required
              error={errors.name}
              errorMsg={fieldErrors.name}
              warning={name.trim() ? duplicate.warning : ''}
            >
              <View style={[styles.inputRow, errors.name && styles.inputRowError]}>
                <Pill size={16} color={errors.name ? Colors.danger : Colors.textTertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Paracetamol, Amoxicillin"
                  placeholderTextColor={Colors.textMuted}
                  value={name}
                  onChangeText={t => { setName(t); if (t.trim().length >= 2) touch('name'); }}
                  onBlur={() => { touch('name'); setName(n => normalizeName(n)); }}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={80}
                />
              </View>
            </Field>

            <Field label="Dosage" required error={errors.dosage} errorMsg={fieldErrors.dosage}>
              <View style={[styles.inputRow, errors.dosage && styles.inputRowError]}>
                <TextInput
                  style={[styles.input, { paddingLeft: 0 }]}
                  placeholder="e.g., 500mg, 5ml, 10mcg"
                  placeholderTextColor={Colors.textMuted}
                  value={dosage}
                  onChangeText={setDosage}
                  onBlur={() => touch('dosage')}
                  maxLength={30}
                />
              </View>
            </Field>
          </SectionCard>

          {/* ── Section 2: Schedule ── */}
          <SectionCard
            title="Schedule"
            icon={<Clock size={16} color={Colors.primary} />}
            delay={220}
          >
            {/* Frequency pills */}
            <Field label="Frequency" required error={errors.frequency} errorMsg={fieldErrors.frequency}>
              <View style={styles.pillGrid}>
                {FREQUENCY_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.freqPill, frequency === opt && styles.freqPillActive]}
                    onPress={() => { setFrequency(opt); touch('frequency'); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.freqPillText, frequency === opt && styles.freqPillTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>

            {/* Time chips */}
            <Field label="Times to Take">
              <View style={styles.timeChipsWrap}>
                {timesToTake.map((time, index) => (
                  <View key={`t-${index}`} style={styles.timeChip}>
                    <TouchableOpacity
                      style={styles.timeChipInner}
                      onPress={() => handleTimePickerOpen(index)}
                    >
                      <Clock size={13} color={Colors.primary} />
                      <Text style={styles.timeChipText}>
                        {formatDisplayTime(time)}
                      </Text>
                    </TouchableOpacity>
                    {timesToTake.length > 1 && (
                      <TouchableOpacity
                        style={styles.timeChipRemove}
                        onPress={() => handleRemoveTimeToTake(index)}
                      >
                        <X size={12} color={Colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity style={styles.addTimeChip} onPress={handleAddTimeToTake}>
                  <Plus size={14} color={Colors.primary} />
                  <Text style={styles.addTimeChipText}>Add</Text>
                </TouchableOpacity>
              </View>
            </Field>
          </SectionCard>

          {/* ── Section 3: Quantity & Expiry ── */}
          <SectionCard
            title="Quantity & Expiry"
            icon={<Package size={16} color={Colors.primary} />}
            delay={280}
          >
            <View style={styles.qtyRow}>
              <Field
                label="Total Qty"
                required
                error={errors.totalQuantity}
                errorMsg={fieldErrors.totalQuantity}
                style={styles.qtyField}
              >
                <View style={[styles.inputRow, errors.totalQuantity && styles.inputRowError]}>
                  <Package size={16} color={errors.totalQuantity ? Colors.danger : Colors.textTertiary} />
                  <TextInput
                    style={styles.input}
                    placeholder="30"
                    placeholderTextColor={Colors.textMuted}
                    value={totalQuantity}
                    onChangeText={handleTotalChange}
                    onBlur={() => touch('totalQuantity')}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
              </Field>
              <View style={styles.qtyDivider} />
              <Field
                label="Current Qty"
                required
                error={errors.currentQuantity}
                errorMsg={fieldErrors.currentQuantity}
                style={styles.qtyField}
              >
                <View style={[styles.inputRow, errors.currentQuantity && styles.inputRowError]}>
                  <Package size={16} color={errors.currentQuantity ? Colors.danger : Colors.textTertiary} />
                  <TextInput
                    style={styles.input}
                    placeholder="28"
                    placeholderTextColor={Colors.textMuted}
                    value={currentQuantity}
                    onChangeText={t => { setCurrentQuantity(digitsOnly(t)); setCurrentEdited(true); touch('currentQuantity'); }}
                    onBlur={() => touch('currentQuantity')}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
              </Field>
            </View>

            {/* Stock bar preview */}
            {!fieldErrors.totalQuantity && !fieldErrors.currentQuantity && (
              <View style={styles.stockPreview}>
                <Text style={styles.stockPreviewLabel}>
                  Stock level: {Math.round((Number(currentQuantity) / Number(totalQuantity)) * 100)}%
                </Text>
                <View style={styles.stockTrack}>
                  <View
                    style={[
                      styles.stockFill,
                      {
                        width: `${Math.min(100, (Number(currentQuantity) / Number(totalQuantity)) * 100)}%` as any,
                        backgroundColor:
                          Number(currentQuantity) / Number(totalQuantity) <= 0.2
                            ? Colors.danger
                            : Number(currentQuantity) / Number(totalQuantity) <= 0.5
                            ? Colors.warning
                            : Colors.success,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            <Field
              label="Expiry Date"
              required
              error={errors.expiry}
              errorMsg={fieldErrors.expiry}
              warning={expiryCheck.warning}
            >
              <TouchableOpacity
                style={[styles.inputRow, errors.expiry && styles.inputRowError]}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar size={16} color={errors.expiry ? Colors.danger : Colors.primary} />
                <Text
                  style={[
                    styles.input,
                    { paddingVertical: Spacing.md, color: expiryDate ? Colors.textPrimary : Colors.textMuted },
                  ]}
                >
                  {expiryDate
                    ? expiryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                    : 'Select expiry date (printed on the pack)'}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={expiryDate ?? new Date()}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  maximumDate={maxExpiryDate()}
                  onChange={(_event, selectedDate) => {
                    setShowDatePicker(false);
                    touch('expiry');
                    if (selectedDate) setExpiryDate(selectedDate);
                  }}
                />
              )}
            </Field>
          </SectionCard>

          {/* ── Section 4: Notes ── */}
          <SectionCard
            title="Notes"
            icon={<FileText size={16} color={Colors.primary} />}
            delay={340}
          >
            <TextInput
              style={styles.textArea}
              placeholder="Side effects, special instructions, or doctor's notes…"
              placeholderTextColor={Colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </SectionCard>

          {/* ── Submit ── */}
          <Animated.View entering={FadeInUp.delay(400).duration(400)} style={styles.submitWrap}>
            {submitted && errorCount > 0 && (
              <Text style={styles.submitError}>
                ⚠ Fix {errorCount} highlighted field{errorCount > 1 ? 's' : ''} above before adding.
              </Text>
            )}
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} activeOpacity={0.85}>
              <Pill size={20} color={Colors.white} />
              <Text style={styles.submitText}>Add Medicine</Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Custom Time Picker Modal ── */}
      <TimePickerModal
        visible={showTimePicker}
        initialTime={timesToTake[currentTimeIndex] ?? '08:00'}
        onConfirm={(time) => {
          handleTimeChange(currentTimeIndex, time);
          setShowTimePicker(false);
        }}
        onCancel={() => setShowTimePicker(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F7F6' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xxl, paddingBottom: 20 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.4 },
  subtitle: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },

  // Progress
  progressWrap: { alignItems: 'flex-end', gap: 4 },
  progressLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  progressTrack: { width: 56, height: 5, borderRadius: 3, backgroundColor: Colors.border },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: Colors.primary },

  // Scan card
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.md,
  },
  scanLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  scanIconBg: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  scanTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  scanSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  scanArrow: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  // Or divider
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md, gap: Spacing.md },
  orLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  orText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '500' },

  // Section card
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sectionIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },

  // Field
  field: { marginBottom: Spacing.lg },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textTertiary, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  required: { color: Colors.danger },
  errorText: { fontSize: FontSize.xs, color: Colors.danger, marginTop: 4, lineHeight: 16 },
  warningText: { fontSize: FontSize.xs, color: Colors.warning, marginTop: 4, lineHeight: 16 },

  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    minHeight: 50,
    gap: Spacing.sm,
  },
  inputRowError: { borderColor: Colors.danger },
  input: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, paddingVertical: Spacing.md },

  // Frequency pills
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  freqPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  freqPillActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  freqPillText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textTertiary },
  freqPillTextActive: { color: Colors.primary },

  // Time chips
  timeChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'center' },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    overflow: 'hidden',
  },
  timeChipInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 8, gap: 6 },
  timeChipText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  timeChipRemove: { paddingHorizontal: Spacing.sm, paddingVertical: 8, borderLeftWidth: 1, borderLeftColor: Colors.primary },
  addTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    gap: 4,
  },
  addTimeChipText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  // Quantity row
  qtyRow: { flexDirection: 'row', gap: Spacing.md },
  qtyDivider: { width: 1, backgroundColor: Colors.borderLight, marginTop: 22 },
  // Each half takes equal width and lets long error messages wrap inside it
  qtyField: { flex: 1, minWidth: 0 },

  // Stock preview
  stockPreview: { marginBottom: Spacing.lg },
  stockPreviewLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '500', marginBottom: 6 },
  stockTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.borderLight },
  stockFill: { height: 6, borderRadius: 3 },

  // Text area
  textArea: {
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    minHeight: 100,
  },

  // Submit
  submitWrap: { marginTop: Spacing.sm },
  submitError: {
    fontSize: FontSize.sm, fontWeight: '600', color: Colors.danger,
    textAlign: 'center', marginBottom: Spacing.md,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadow.md,
  },
  submitText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700', letterSpacing: 0.3 },
});