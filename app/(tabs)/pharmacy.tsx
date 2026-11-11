import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Navigation, LocateFixed, Phone, ShieldCheck, ArrowRight } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Location from 'expo-location';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../../constants/theme';

// ── Data ──────────────────────────────────────────────────────────────────────
type OnlinePharmacy = {
  name: string;
  tagline: string;
  emoji: string;
  url: string;
  tint: string;   // icon circle background
  accent: string; // "Visit" text color
  pill: string;   // "Visit" pill background
};

const ONLINE_PHARMACIES: OnlinePharmacy[] = [
  { name: 'Apollo Pharmacy', tagline: '24/7 delivery', emoji: '💊', url: 'https://www.apollopharmacy.in', tint: '#E0F2FE', accent: '#0369A1', pill: '#E0F2FE' },
  { name: 'MedPlus', tagline: 'Home delivery', emoji: '🏥', url: 'https://www.medplusmart.com', tint: '#FEE2E2', accent: '#DC2626', pill: '#FEE2E2' },
  { name: 'Netmeds', tagline: 'Online pharmacy', emoji: '💉', url: 'https://www.netmeds.com', tint: '#CCFBF1', accent: '#0F766E', pill: '#CCFBF1' },
  { name: '1mg (Tata)', tagline: 'Meds + Lab tests', emoji: '🧬', url: 'https://www.1mg.com', tint: '#FFE4E6', accent: '#E11D48', pill: '#FFE4E6' },
  { name: 'PharmEasy', tagline: 'Fast delivery', emoji: '🚚', url: 'https://pharmeasy.in', tint: '#F3E8FF', accent: '#7E22CE', pill: '#F3E8FF' },
  { name: 'Healthkart', tagline: 'Health & Wellness', emoji: '🛒', url: 'https://www.healthkart.com', tint: '#DBEAFE', accent: '#1D4ED8', pill: '#DBEAFE' },
];

type Helpline = { number: string; dial: string; title: string; subtitle: string; color: string; bg: string };

const HELPLINES: Helpline[] = [
  { number: '108', dial: '108', title: 'Medical Emergency', subtitle: 'Ambulance dispatch', color: '#DC2626', bg: '#FEE2E2' },
  { number: '102', dial: '102', title: 'National Ambulance', subtitle: 'Free govt. ambulance', color: '#DC2626', bg: '#FEE2E2' },
  { number: '1800-11-6117', dial: '18001116117', title: 'Poison Control', subtitle: 'AIIMS helpline', color: '#7E22CE', bg: '#F3E8FF' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function openUrl(url: string) {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  Linking.openURL(url).catch(e => console.warn('Could not open', url, e));
}

function openPharmacyMap(coords: { latitude: number; longitude: number } | null) {
  const webUrl = coords
    ? `https://www.google.com/maps/search/pharmacy/@${coords.latitude},${coords.longitude},15z`
    : 'https://www.google.com/maps/search/pharmacy+near+me';

  if (Platform.OS === 'android') {
    const geo = coords
      ? `geo:${coords.latitude},${coords.longitude}?q=pharmacy`
      : 'geo:0,0?q=pharmacy+near+me';
    Linking.openURL(geo).catch(() => Linking.openURL(webUrl));
  } else if (Platform.OS === 'ios') {
    const gmaps = coords
      ? `comgooglemaps://?q=pharmacy&center=${coords.latitude},${coords.longitude}&zoom=15`
      : 'comgooglemaps://?q=pharmacy+near+me';
    Linking.canOpenURL(gmaps)
      .then(ok => Linking.openURL(ok ? gmaps : webUrl))
      .catch(() => Linking.openURL(webUrl));
  } else {
    openUrl(webUrl);
  }
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function PharmacyScreen() {
  const { width } = useWindowDimensions();
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [opened, setOpened] = useState(false);

  // Fit the grid to the screen: 3 columns normally, 2 on very narrow phones.
  const columns = width < 340 ? 2 : 3;

  const handleFindPharmacies = async () => {
    let here = coords;
    if (!here) {
      setLocating(true);
      setLocationError(false);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          here = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setCoords(here);
        } else {
          setLocationError(true);
        }
      } catch (e) {
        console.log('Location unavailable:', e);
        setLocationError(true);
      } finally {
        setLocating(false);
      }
    }
    openPharmacyMap(here);
    setOpened(true);
  };

  const call = (dial: string) => {
    const url = `tel:${dial}`;
    if (Platform.OS === 'web') window.location.href = url;
    else Linking.openURL(url).catch(e => console.warn('Could not call', e));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)}>
          <Text style={styles.title}>Find a Pharmacy</Text>
          <Text style={styles.subtitle}>Locate nearby or order medicine online</Text>
          {coords && (
            <View style={styles.locationChip}>
              <Navigation size={12} color={Colors.success} />
              <Text style={styles.locationChipText} numberOfLines={1}>
                {coords.latitude.toFixed(4)}°, {coords.longitude.toFixed(4)}° • Location detected
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Nearby pharmacies hero */}
        <Animated.View entering={FadeInDown.delay(80).duration(380)}>
          <LinearGradient
            colors={['#0F9B8E', '#0D7F74']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroBlob} />
            <View style={styles.heroIcon}>
              <MapPin size={30} color={Colors.white} />
            </View>
            <Text style={styles.heroTitle}>Pharmacies Near You</Text>
            <Text style={styles.heroText}>
              Tap below to share your location and instantly see all nearby pharmacies on Google Maps.
            </Text>
            <TouchableOpacity
              style={styles.heroButton}
              onPress={handleFindPharmacies}
              activeOpacity={0.85}
              disabled={locating}
            >
              {locating ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <LocateFixed size={18} color={Colors.primary} />
              )}
              <Text style={styles.heroButtonText}>
                {locating ? 'Getting location…' : opened ? 'Open Maps Again' : 'Find Nearby Pharmacies'}
              </Text>
            </TouchableOpacity>
            <View style={styles.heroFooter}>
              <View style={[styles.dot, { backgroundColor: coords ? '#4ADE80' : 'rgba(255,255,255,0.5)' }]} />
              <Text style={styles.heroFooterText}>
                {coords
                  ? 'GPS locked · Opens Google Maps directly'
                  : locationError
                  ? 'Location off · Searching "pharmacy near me"'
                  : 'Opens Google Maps directly'}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Order online */}
        <Animated.View entering={FadeInDown.delay(160).duration(380)}>
          <Text style={styles.sectionTitle}>Order Online · Home Delivery</Text>
          <Text style={styles.sectionSub}>Trusted platforms with genuine medicines</Text>
          <View style={styles.grid}>
            {ONLINE_PHARMACIES.map(p => (
              <TouchableOpacity
                key={p.name}
                style={[styles.shopCard, { width: `${100 / columns}%` as any }]}
                onPress={() => openUrl(p.url)}
                activeOpacity={0.8}
              >
                <View style={styles.shopCardInner}>
                  <View style={[styles.shopIcon, { backgroundColor: p.tint }]}>
                    <Text style={styles.shopEmoji}>{p.emoji}</Text>
                  </View>
                  <Text style={styles.shopName} numberOfLines={2}>
                    {p.name}
                  </Text>
                  <Text style={styles.shopTagline} numberOfLines={1}>{p.tagline}</Text>
                  <View style={[styles.visitPill, { backgroundColor: p.pill }]}>
                    <Text style={[styles.visitText, { color: p.accent }]}>Visit</Text>
                    <ArrowRight size={11} color={p.accent} strokeWidth={2.5} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Emergency helplines */}
        <Animated.View entering={FadeInDown.delay(240).duration(380)}>
          <Text style={[styles.sectionTitle, { color: Colors.danger }]}>🚨 Emergency Helplines</Text>
          <Text style={styles.sectionSub}>Tap to call instantly — available 24/7</Text>
          {HELPLINES.map(h => (
            <TouchableOpacity
              key={h.number}
              style={styles.helpCard}
              onPress={() => call(h.dial)}
              activeOpacity={0.8}
            >
              <View style={[styles.helpNumber, { backgroundColor: h.bg }]}>
                <Text
                  style={[styles.helpNumberText, { color: h.color }, h.number.length > 5 && styles.helpNumberLong]}
                  numberOfLines={1}
                >
                  {h.number}
                </Text>
              </View>
              <View style={styles.helpBody}>
                <Text style={styles.helpTitle} numberOfLines={2}>{h.title}</Text>
                <Text style={styles.helpSub} numberOfLines={1}>{h.subtitle}</Text>
              </View>
              <View style={[styles.callPill, { backgroundColor: h.bg }]}>
                <Phone size={13} color={h.color} />
                <Text style={[styles.callText, { color: h.color }]}>Call</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Safety tip */}
        <Animated.View entering={FadeInDown.delay(300).duration(380)} style={styles.tip}>
          <ShieldCheck size={18} color={Colors.primary} />
          <Text style={styles.tipText}>
            <Text style={styles.tipBold}>Safety tip: </Text>
            Always verify your prescription with a licensed pharmacist before purchasing any medication.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.xxxl },

  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSize.md, color: Colors.textTertiary, marginTop: 2 },
  locationChip: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6,
    marginTop: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: 6,
    backgroundColor: Colors.successLight, borderRadius: BorderRadius.full, maxWidth: '100%',
  },
  locationChipText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.success, flexShrink: 1 },

  // Hero
  hero: {
    marginTop: Spacing.lg, borderRadius: BorderRadius.xxl, overflow: 'hidden',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xxl, alignItems: 'center', ...Shadow.md,
  },
  heroBlob: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    right: -80, top: -90, backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heroIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: Colors.white, textAlign: 'center' },
  heroText: {
    fontSize: FontSize.md, color: 'rgba(255,255,255,0.88)', textAlign: 'center',
    lineHeight: 22, marginTop: Spacing.sm, maxWidth: 340,
  },
  heroButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, paddingVertical: 14,
    alignSelf: 'stretch', marginTop: Spacing.xl,
  },
  heroButtonText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  heroFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
  heroFooterText: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.9)', flexShrink: 1, textAlign: 'center' },

  // Sections
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary, marginTop: Spacing.xxl },
  sectionSub: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: 2, marginBottom: Spacing.md },

  // Online pharmacy grid (cards use percentage widths + inner padding as gutters)
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  shopCard: { padding: 5 },
  shopCardInner: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md,
    paddingHorizontal: 6, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight, ...Shadow.sm,
  },
  shopIcon: {
    width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  shopEmoji: { fontSize: 22 },
  // Two-line slot so long names wrap instead of truncating, and all cards stay equal height
  shopName: {
    fontSize: FontSize.sm, lineHeight: 17, minHeight: 34, fontWeight: '700', color: Colors.textPrimary,
    textAlign: 'center', alignSelf: 'stretch', textAlignVertical: 'center',
  },
  shopTagline: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, textAlign: 'center', alignSelf: 'stretch' },
  visitPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.full,
  },
  visitText: { fontSize: FontSize.xs, fontWeight: '700' },

  // Helplines
  helpCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md, ...Shadow.sm,
  },
  helpNumber: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, minWidth: 56, alignItems: 'center' },
  helpNumberText: { fontSize: FontSize.lg, fontWeight: '800' },
  helpNumberLong: { fontSize: FontSize.md },
  helpBody: { flex: 1, minWidth: 0 },
  helpTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  helpSub: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 1 },
  callPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.full,
  },
  callText: { fontSize: FontSize.sm, fontWeight: '700' },

  // Safety tip
  tip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: Spacing.xl,
    padding: Spacing.lg, borderRadius: BorderRadius.lg, backgroundColor: Colors.primaryLight,
    borderWidth: 1, borderColor: '#99F6E4',
  },
  tipText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  tipBold: { fontWeight: '700', color: Colors.textPrimary },
});
