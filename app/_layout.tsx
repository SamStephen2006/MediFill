import { useEffect, useRef } from 'react';
import { Stack, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MedicineProvider } from '../context/MedicineContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import type { UserProfile } from '../context/AuthContext';
import AuthScreen from './auth';
import { Colors } from '../constants/theme';
import {
  requestNotificationPermissions,
  clearLeftoverTestNotifications,
} from '../services/notificationService';

declare global {
  interface Window {
    frameworkReady?: () => void;
  }
}

/**
 * Tapping a notification opens the screen it names in `data.screen`
 * (refill reminder → Pharmacy, dose reminders → Schedule). Uses the "last
 * response" hook so it also works when the tap launched the app. Phones only;
 * on web the service worker (public/sw.js) handles clicks.
 */
function NotificationTapHandler() {
  const last = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!last) return;
    const id = `${last.notification.request.identifier}@${last.notification.date}`;
    if (handled.current === id) return;
    handled.current = id;
    const screen = (last.notification.request.content.data as any)?.screen;
    if (typeof screen === 'string' && screen.startsWith('/')) {
      // Let the navigator mount first when the tap cold-started the app.
      setTimeout(() => {
        try { router.push(screen as any); } catch (e) { console.warn('Could not open', screen, e); }
      }, 0);
    }
  }, [last]);

  return null;
}

function AppContent() {
  const { user, profile, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (Platform.OS === 'web') {
      window.frameworkReady?.();
    }
    // Request notification permissions on app start
    requestNotificationPermissions();
    // The test-notification button was removed; clear anything it left behind.
    clearLeftoverTestNotifications();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <MedicineProvider firebaseUid={user?.id ?? null} userProfile={profile}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
      </Stack>
      {Platform.OS !== 'web' && <NotificationTapHandler />}
      <StatusBar style="auto" />
    </MedicineProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});