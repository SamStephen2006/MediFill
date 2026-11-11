import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert as RNAlert,
  ActivityIndicator,
  Modal,
  Animated as RNAnimated,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn, Layout, SlideInDown, SlideOutUp } from 'react-native-reanimated';
import {
  Search,
  Bell,
  BellOff,
  CircleAlert as AlertCircle,
  Pill,
  Calendar,
  Package,
  Clock,
  X,
  Plus,
  ChevronRight,
  Sparkles,
  Check,
} from 'lucide-react-native';
import { useMedicineContext } from '../../context/MedicineContext';
import { useAuth } from '../../context/AuthContext';
import MedicineCard from '../../components/MedicineCard';
import { daysUntilExpiry } from '../../utils/medicineValidation';
import { router } from 'expo-router';
import {
  Colors,
  Spacing,
  FontSize,
  BorderRadius,
  Shadow,
} from '../../constants/theme';

// ── Alert Drawer ─────────────────────────────────────────────────────────────
function AlertDrawer({
  visible,
  alerts,
  unreadCount,
  onClose,
  onDismiss,
  onDismissAll,
}: {
  visible: boolean;
  alerts: any[];
  unreadCount: number;
  onClose: () => void;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}) {
  const slideAnim = useRef(new RNAnimated.Value(-500)).current;
  const bgAnim    = useRef(new RNAnimated.Value(0)).current;

  // Stay mounted until the close animation has finished, then unmount.
  // (Previously this read the private `slideAnim._value`, which isn't part of the
  // Animated API and isn't updated in JS when useNativeDriver is on.)
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      RNAnimated.parallel([
        RNAnimated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }),
        RNAnimated.timing(bgAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      RNAnimated.parallel([
        RNAnimated.timing(slideAnim, { toValue: -500, duration: 220, useNativeDriver: true }),
        RNAnimated.timing(bgAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  const getAlertAccent = (type: string, id: string) => {
    if (id.startsWith('empty-') || id.startsWith('expired-')) return Colors.danger;
    if (type === 'stock') return Colors.warning;
    if (type === 'reminder') return Colors.primary;
    return Colors.danger;
  };

  const getAlertBg = (type: string, id: string) => {
    if (id.startsWith('empty-') || id.startsWith('expired-')) return Colors.dangerLight;
    if (type === 'stock') return Colors.warningLight;
    if (type === 'reminder') return Colors.primaryLight;
    return Colors.dangerLight;
  };

  const getAlertIcon = (type: string, id: string) => {
    const color = getAlertAccent(type, id);
    if (type === 'expiry') return <Calendar size={18} color={color} />;
    if (type === 'stock') return <Package size={18} color={color} />;
    if (type === 'reminder') return <Clock size={18} color={color} />;
    return <AlertCircle size={18} color={color} />;
  };

  if (!visible && !mounted) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <RNAnimated.View
        style={[StyleSheet.absoluteFill, {
          backgroundColor: 'rgba(0,0,0,0.4)',
          opacity: bgAnim,
        }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </RNAnimated.View>

      {/* Drawer panel */}
      <RNAnimated.View
        style={[drawerStyles.panel, { transform: [{ translateY: slideAnim }] }]}
        pointerEvents="box-none"
      >
        {/* Handle */}
        <View style={drawerStyles.handle} />

        {/* Header */}
        <View style={drawerStyles.header}>
          <View style={drawerStyles.headerLeft}>
            <Bell size={18} color={Colors.primary} />
            <Text style={drawerStyles.title}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={drawerStyles.countPill}>
                <Text style={drawerStyles.countText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <View style={drawerStyles.headerRight}>
            {unreadCount > 0 && (
              <TouchableOpacity style={drawerStyles.clearBtn} onPress={onDismissAll}>
                <Check size={13} color={Colors.primary} />
                <Text style={drawerStyles.clearBtnText}>Mark all read</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={drawerStyles.closeBtn} onPress={onClose}>
              <X size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Alert list */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={drawerStyles.list}
        >
          {alerts.length === 0 ? (
            <View style={drawerStyles.empty}>
              <BellOff size={40} color={Colors.textMuted} />
              <Text style={drawerStyles.emptyTitle}>All caught up!</Text>
              <Text style={drawerStyles.emptyDesc}>No new notifications right now.</Text>
            </View>
          ) : (
            alerts.map((alert, idx) => (
              <View
                key={alert.id}
                style={[
                  drawerStyles.alertCard,
                  alert.read && drawerStyles.alertCardRead,
                  { borderLeftColor: getAlertAccent(alert.type, alert.id) },
                ]}
              >
                <View style={[drawerStyles.alertIconWrap, { backgroundColor: getAlertBg(alert.type, alert.id) }]}>
                  {getAlertIcon(alert.type, alert.id)}
                </View>
                <View style={drawerStyles.alertBody}>
                  <Text
                    style={[drawerStyles.alertTitle, { color: getAlertAccent(alert.type, alert.id) }]}
                    numberOfLines={1}
                  >
                    {alert.title}
                  </Text>
                  <Text style={drawerStyles.alertDesc} numberOfLines={3}>
                    {alert.description}
                  </Text>
                </View>
                <TouchableOpacity
                  style={drawerStyles.dismissBtn}
                  onPress={() => onDismiss(alert.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </RNAnimated.View>
    </Modal>
  );
}

const drawerStyles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    maxHeight: '75%',
    paddingTop: 52, // safe area top offset
    ...Shadow.lg,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  countPill: {
    backgroundColor: Colors.danger,
    borderRadius: BorderRadius.full,
    minWidth: 22, height: 22,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 6,
  },
  countText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
  },
  clearBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center',
  },
  list: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
  alertCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.borderLight,
    borderLeftWidth: 4,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  alertCardRead: { opacity: 0.5 },
  alertIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  alertBody: { flex: 1 },
  alertTitle: { fontSize: FontSize.sm, fontWeight: '700', marginBottom: 3 },
  alertDesc: { fontSize: FontSize.xs, color: Colors.textTertiary, lineHeight: 17 },
  dismissBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  empty: { alignItems: 'center', paddingVertical: 48, gap: Spacing.md },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  emptyDesc: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { medicines, alerts, loadMedicines, dismissAlert, markAllAlertsAsRead, activeUser } =
    useMedicineContext();
  const { profile } = useAuth();
  const [refreshing, setRefreshing]       = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [filteredMedicines, setFilteredMedicines] = useState(medicines);
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [isLoading, setIsLoading]         = useState(true);

  useEffect(() => {
    (async () => {
      await loadMedicines();
      setIsLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredMedicines(medicines);
    } else {
      setFilteredMedicines(
        medicines.filter((m) =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
  }, [searchQuery, medicines]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMedicines();
    setRefreshing(false);
  };

  const unreadAlerts = alerts.filter((a) => !a.read);

  // X removes the alert; "Mark all read" clears the unread badge in one update.
  const handleDismiss = (alertId: string) => dismissAlert(alertId);
  const handleDismissAll = () => markAllAlertsAsRead();

  // Quick stats
  const totalMeds = medicines.length;
  const expiringCount = medicines.filter((m) => {
    const d = daysUntilExpiry(m.expiryDate);
    return d >= 0 && d <= 30;
  }).length;
  const lowStockCount = medicines.filter(
    (m) => m.currentQuantity / m.totalQuantity <= 0.2
  ).length;
  const todayMeds = medicines.filter((m) => m.timeToTake && m.timeToTake.length > 0);

  const userName = activeUser?.name || profile?.displayName || 'there';
  const greeting = getTimeOfDay();

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading medicines…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* ── Hero ── */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroGreeting}>Good {greeting} 👋</Text>
              <Text style={styles.heroName}>{userName}</Text>
              {totalMeds > 0 && (
                <Text style={styles.heroSub}>
                  You have{' '}
                  <Text style={styles.heroSubAccent}>{totalMeds} medicine{totalMeds !== 1 ? 's' : ''}</Text>
                  {' '}tracked
                </Text>
              )}
            </View>

            {/* Bell — opens drawer */}
            <TouchableOpacity
              style={[styles.bellBtn, drawerOpen && styles.bellBtnActive]}
              onPress={() => setDrawerOpen(true)}
            >
              <Bell size={20} color={drawerOpen ? Colors.white : Colors.primary} />
              {unreadAlerts.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadAlerts.length > 9 ? '9+' : unreadAlerts.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Stat strip */}
          {totalMeds > 0 && (
            <Animated.View entering={FadeInDown.delay(120).duration(380)} style={styles.statStrip}>
              <View style={styles.statCell}>
                <View style={[styles.statIcon, { backgroundColor: Colors.primaryLight }]}>
                  <Pill size={15} color={Colors.primary} />
                </View>
                <Text style={[styles.statNum, { color: Colors.primary }]}>{totalMeds}</Text>
                <Text style={styles.statLbl}>Total</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <View style={[styles.statIcon, { backgroundColor: expiringCount > 0 ? Colors.warningLight : Colors.accentLight }]}>
                  <Calendar size={15} color={expiringCount > 0 ? Colors.warning : Colors.accent} />
                </View>
                <Text style={[styles.statNum, { color: expiringCount > 0 ? Colors.warning : Colors.accent }]}>
                  {expiringCount}
                </Text>
                <Text style={styles.statLbl}>Expiring</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <View style={[styles.statIcon, { backgroundColor: lowStockCount > 0 ? Colors.dangerLight : Colors.successLight }]}>
                  <Package size={15} color={lowStockCount > 0 ? Colors.danger : Colors.success} />
                </View>
                <Text style={[styles.statNum, { color: lowStockCount > 0 ? Colors.danger : Colors.success }]}>
                  {lowStockCount}
                </Text>
                <Text style={styles.statLbl}>Low Stock</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <View style={[styles.statIcon, { backgroundColor: Colors.accentLight }]}>
                  <Clock size={15} color={Colors.accent} />
                </View>
                <Text style={[styles.statNum, { color: Colors.accent }]}>{todayMeds.length}</Text>
                <Text style={styles.statLbl}>Scheduled</Text>
              </View>
            </Animated.View>
          )}
        </Animated.View>

        {/* ── Search ── */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.searchWrap}>
          <View style={styles.searchBox}>
            <Search size={17} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search medicines…"
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* ── Medicines Section ── */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                {activeUser?.name ? `${activeUser.name}'s Medicines` : 'My Medicines'}
              </Text>
              {medicines.length > 0 && (
                <Text style={styles.sectionSub}>
                  {filteredMedicines.length} of {medicines.length} shown
                </Text>
              )}
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(tabs)/add')}>
              <Plus size={16} color={Colors.white} />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {medicines.length === 0 ? (
            <Animated.View entering={FadeIn.duration(500)} style={styles.empty}>
              <View style={styles.emptyIconRing}>
                <View style={styles.emptyIconInner}>
                  <Pill size={40} color={Colors.primary} />
                </View>
              </View>
              <Text style={styles.emptyTitle}>No medicines yet</Text>
              <Text style={styles.emptyDesc}>
                Add your first medicine by scanning a label or entering details manually.
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/add')}>
                <Sparkles size={16} color={Colors.white} />
                <Text style={styles.emptyBtnText}>Get Started</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : filteredMedicines.length === 0 ? (
            <View style={styles.noResults}>
              <Search size={32} color={Colors.textTertiary} />
              <Text style={styles.noResultsTitle}>No results</Text>
              <Text style={styles.noResultsDesc}>No medicines match "{searchQuery}"</Text>
            </View>
          ) : (
            <Animated.View layout={Layout.springify()} style={styles.list}>
              {filteredMedicines.map((medicine, idx) => (
                <Animated.View
                  key={medicine.id}
                  entering={FadeInDown.delay(idx * 70).duration(350)}
                >
                  <MedicineCard medicine={medicine} />
                </Animated.View>
              ))}
            </Animated.View>
          )}
        </Animated.View>
      </ScrollView>

      {/* ── Alert Drawer ── */}
      <AlertDrawer
        visible={drawerOpen}
        alerts={alerts}
        unreadCount={unreadAlerts.length}
        onClose={() => setDrawerOpen(false)}
        onDismiss={handleDismiss}
        onDismissAll={handleDismissAll}
      />
    </SafeAreaView>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F7F6' },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: Spacing.md, fontSize: FontSize.md, color: Colors.textTertiary },

  // Hero
  hero: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.xxl,
    marginTop: Spacing.lg,
    borderRadius: 24,
    padding: Spacing.xl,
    ...Shadow.md,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLeft: { flex: 1, paddingRight: Spacing.md },
  heroGreeting: { fontSize: FontSize.sm, color: Colors.textTertiary, fontWeight: '500', marginBottom: 4 },
  heroName: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  heroSub: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: 6 },
  heroSubAccent: { color: Colors.primary, fontWeight: '700' },

  bellBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  bellBtnActive: { backgroundColor: Colors.primary },
  badge: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: Colors.danger, borderRadius: 8,
    minWidth: 16, height: 16,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: Colors.white,
  },
  badgeText: { color: Colors.white, fontSize: 9, fontWeight: '800' },

  // Stat strip
  statStrip: {
    flexDirection: 'row',
    marginTop: Spacing.xl,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 16,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 5 },
  statIcon: { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  statNum: { fontSize: FontSize.lg, fontWeight: '800' },
  statLbl: { fontSize: 10, color: Colors.textTertiary, fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 6 },

  // Search
  searchWrap: { paddingHorizontal: Spacing.xxl, marginTop: Spacing.lg },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14, paddingHorizontal: Spacing.lg,
    height: 48, gap: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.border,
    ...Shadow.sm,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary },

  // Medicines section
  section: { paddingHorizontal: Spacing.xxl, marginTop: Spacing.xl },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    marginBottom: Spacing.lg,
  },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },
  sectionSub: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '500', marginTop: 3 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderRadius: BorderRadius.full,
    ...Shadow.sm,
  },
  addBtnText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '700' },
  list: { gap: Spacing.md },

  // Empty
  empty: { alignItems: 'center', paddingVertical: Spacing.xxxxl, paddingHorizontal: Spacing.xl },
  emptyIconRing: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  emptyIconInner: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: Colors.white,
    justifyContent: 'center', alignItems: 'center',
    ...Shadow.sm,
  },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.sm },
  emptyDesc: { fontSize: FontSize.md, color: Colors.textTertiary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.full,
    ...Shadow.md,
  },
  emptyBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },

  // No results
  noResults: { alignItems: 'center', paddingVertical: Spacing.xxxxl, gap: Spacing.sm },
  noResultsTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  noResultsDesc: { fontSize: FontSize.md, color: Colors.textTertiary, textAlign: 'center' },
});