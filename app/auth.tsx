import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import {
  Pill,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ChevronLeft,
  KeyRound,
  ShieldCheck,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../constants/theme';

type Mode = 'login' | 'signup' | 'reset';

// ── Password Rules ────────────────────────────────────────────────────────────
const PASSWORD_RULES = [
  { label: 'At least 8 characters',         test: (p: string) => p.length >= 8 },
  { label: 'At least one uppercase letter',  test: (p: string) => /[A-Z]/.test(p) },
  { label: 'At least one lowercase letter',  test: (p: string) => /[a-z]/.test(p) },
  { label: 'At least one number',            test: (p: string) => /[0-9]/.test(p) },
  { label: 'At least one special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const validatePassword = (p: string): string | null => {
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(p)) return rule.label + ' is required.';
  }
  return null;
};

const getStrength = (p: string): number =>
  PASSWORD_RULES.filter(r => r.test(p)).length;

const strengthLabel = (s: number) =>
  s <= 1 ? 'Very weak' : s === 2 ? 'Weak' : s === 3 ? 'Fair' : s === 4 ? 'Strong' : 'Very strong';

const strengthColor = (s: number) =>
  s <= 1 ? '#EF4444' : s === 2 ? '#F97316' : s === 3 ? '#EAB308' : s === 4 ? '#84CC16' : '#22C55E';

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

// ── Focused Input wrapper ─────────────────────────────────────────────────────
function InputField({
  icon,
  rightSlot,
  containerStyle,
  ...inputProps
}: {
  icon: React.ReactNode;
  rightSlot?: React.ReactNode;
  containerStyle?: object;
} & TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.inputContainer,
        focused && styles.inputContainerFocused,
        containerStyle,
      ]}
    >
      <View style={styles.inputIconWrap}>{icon}</View>
      <TextInput
        style={styles.input}
        placeholderTextColor={Colors.textMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...inputProps}
      />
      {rightSlot}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AuthScreen() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const switchMode = (next: Mode) => {
    setErrorMessage('');
    setResetSent(false);
    setPassword('');
    setConfirmPassword('');
    setMode(next);
  };

  const handleSubmit = async () => {
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!email.trim().toLowerCase().endsWith('@gmail.com')) {
      setErrorMessage('Only Gmail accounts (@gmail.com) are allowed.');
      return;
    }

    // ── Reset flow ────────────────────────────────────────────────────────────
    if (mode === 'reset') {
      setLoading(true);
      try {
        await resetPassword(email);
        setResetSent(true);
      } catch (e: any) {
        setErrorMessage(e?.message ?? 'Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Password checks ───────────────────────────────────────────────────────
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }
    if (mode === 'signup') {
      const pwdError = validatePassword(password);
      if (pwdError) { setErrorMessage(pwdError); return; }
      if (!displayName.trim()) { setErrorMessage('Please enter your name.'); return; }
      if (password !== confirmPassword) { setErrorMessage('Passwords do not match.'); return; }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName);
      }
    } catch (e: any) {
      setErrorMessage(e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const strength = getStrength(password);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header strip ── */}
          <Animated.View entering={FadeIn.duration(600)} style={styles.headerStrip}>
            <View style={styles.logoRing}>
              <View style={styles.logoInner}>
                <Pill size={30} color={Colors.white} />
              </View>
            </View>
            <Text style={styles.appName}>MediFill</Text>
            <Text style={styles.tagline}>Smart medicine management</Text>
          </Animated.View>

          {/* ── Card ── */}
          <Animated.View
            entering={FadeInDown.delay(180).duration(500)}
            style={styles.card}
          >
            {/* Back button (signup / reset) */}
            {mode !== 'login' && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => switchMode('login')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ChevronLeft size={18} color={Colors.primary} />
                <Text style={styles.backText}>Back to Sign In</Text>
              </TouchableOpacity>
            )}

            {/* Mode icon badge */}
            <View style={styles.modeBadge}>
              {mode === 'login' ? (
                <ShieldCheck size={22} color={Colors.primary} />
              ) : mode === 'signup' ? (
                <User size={22} color={Colors.primary} />
              ) : (
                <KeyRound size={22} color={Colors.primary} />
              )}
            </View>

            <Text style={styles.cardTitle}>
              {mode === 'login'
                ? 'Welcome back 👋'
                : mode === 'signup'
                ? 'Create your account'
                : 'Forgot password?'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {mode === 'login'
                ? 'Sign in to manage your medications'
                : mode === 'signup'
                ? 'Join MediFill and take control of your health'
                : 'Enter your email and we\'ll send a reset link'}
            </Text>

            {/* Error box */}
            {errorMessage ? (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.errorBox}>
                <Text style={styles.errorText}>⚠ {errorMessage}</Text>
              </Animated.View>
            ) : null}

            {/* ── Reset-sent state ── */}
            {mode === 'reset' && resetSent ? (
              <Animated.View entering={FadeInDown.duration(400)} style={styles.successBox}>
                <Text style={styles.successTitle}>📬 Check your inbox!</Text>
                <Text style={styles.successBody}>
                  A password reset link has been sent to{'\n'}
                  <Text style={{ fontWeight: '700' }}>{email}</Text>
                </Text>
                <TouchableOpacity
                  style={styles.successAction}
                  onPress={() => switchMode('login')}
                >
                  <Text style={styles.successActionText}>Back to Sign In</Text>
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <>
                {/* Full name — signup only */}
                {mode === 'signup' && (
                  <InputField
                    icon={<User size={16} color={Colors.textTertiary} />}
                    placeholder="Full name"
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                  />
                )}

                {/* Email */}
                <InputField
                  icon={<Mail size={16} color={Colors.textTertiary} />}
                  placeholder="Email address"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {/* Password */}
                {mode !== 'reset' && (
                  <InputField
                    icon={<Lock size={16} color={Colors.textTertiary} />}
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    rightSlot={
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => setShowPassword(v => !v)}
                      >
                        {showPassword
                          ? <EyeOff size={16} color={Colors.textTertiary} />
                          : <Eye size={16} color={Colors.textTertiary} />}
                      </TouchableOpacity>
                    }
                  />
                )}

                {/* Strength meter + rules (signup) */}
                {mode === 'signup' && password.length > 0 && (
                  <Animated.View entering={FadeInDown.duration(300)} style={styles.strengthWrap}>
                    <View style={styles.strengthRow}>
                      <View style={styles.strengthBars}>
                        {[1, 2, 3, 4, 5].map(lvl => (
                          <View
                            key={lvl}
                            style={[
                              styles.strengthBar,
                              {
                                backgroundColor:
                                  strength >= lvl ? strengthColor(strength) : Colors.borderLight,
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <Text style={[styles.strengthLabel, { color: strengthColor(strength) }]}>
                        {strengthLabel(strength)}
                      </Text>
                    </View>
                    <View style={styles.rulesGrid}>
                      {PASSWORD_RULES.map(rule => {
                        const ok = rule.test(password);
                        return (
                          <Text
                            key={rule.label}
                            style={[styles.ruleItem, { color: ok ? '#22C55E' : Colors.textMuted }]}
                          >
                            {ok ? '✓' : '○'} {rule.label}
                          </Text>
                        );
                      })}
                    </View>
                  </Animated.View>
                )}

                {/* Confirm password (signup) */}
                {mode === 'signup' && (
                  <InputField
                    icon={<Lock size={16} color={Colors.textTertiary} />}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    rightSlot={
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => setShowConfirmPassword(v => !v)}
                      >
                        {showConfirmPassword
                          ? <EyeOff size={16} color={Colors.textTertiary} />
                          : <Eye size={16} color={Colors.textTertiary} />}
                      </TouchableOpacity>
                    }
                  />
                )}

                {/* Forgot password link (login only) */}
                {mode === 'login' && (
                  <TouchableOpacity
                    style={styles.forgotWrap}
                    onPress={() => switchMode('reset')}
                  >
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </TouchableOpacity>
                )}

                {/* Submit */}
                <TouchableOpacity
                  style={[styles.submitButton, loading && { opacity: 0.7 }]}
                  onPress={handleSubmit}
                  disabled={loading}
                  activeOpacity={0.82}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <View style={styles.submitContent}>
                      <Text style={styles.submitText}>
                        {mode === 'login'
                          ? 'Sign In'
                          : mode === 'signup'
                          ? 'Create Account'
                          : 'Send Reset Link'}
                      </Text>
                      <ArrowRight size={18} color={Colors.white} />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Toggle Sign In / Sign Up */}
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>
                    {mode === 'login' || mode === 'reset'
                      ? "Don't have an account?"
                      : 'Already have an account?'}
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      switchMode(mode === 'login' || mode === 'reset' ? 'signup' : 'login')
                    }
                  >
                    <Text style={styles.toggleAction}>
                      {mode === 'login' || mode === 'reset' ? 'Sign Up' : 'Sign In'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF7F6' },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.xxxxl,
  },

  // Header strip
  headerStrip: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  logoRing: {
    width: 92,
    height: 92,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadow.lg,
  },
  logoInner: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: -0.6,
  },
  tagline: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginTop: 4,
    letterSpacing: 0.2,
  },

  // Card
  card: {
    backgroundColor: Colors.white,
    borderRadius: 28,
    padding: Spacing.xxl,
    ...Shadow.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: Spacing.lg,
    gap: 2,
  },
  backText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  modeBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },

  // Inputs
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    height: 54,
  },
  inputContainerFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  inputIconWrap: {
    width: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  eyeButton: {
    padding: Spacing.sm,
  },

  // Forgot
  forgotWrap: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.lg,
    marginTop: -4,
  },
  forgotText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },

  // Submit
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.md,
  },
  submitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  submitText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
    gap: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  dividerText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '500',
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  toggleLabel: { fontSize: FontSize.sm, color: Colors.textTertiary },
  toggleAction: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '700' },

  // Error
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
  },
  errorText: {
    color: Colors.danger,
    fontSize: FontSize.sm,
    fontWeight: '500',
    lineHeight: 18,
  },

  // Reset-sent success
  successBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  successTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  successBody: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
  successAction: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxxl,
  },
  successActionText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: FontSize.md,
  },

  // Strength
  strengthWrap: {
    marginTop: -4,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  strengthBars: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  strengthBar: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  strengthLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    minWidth: 60,
    textAlign: 'right',
  },
  rulesGrid: {
    gap: 3,
  },
  ruleItem: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
});
