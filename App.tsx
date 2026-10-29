// App.tsx
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';

import { AuthProvider } from './src/context/AuthContext';
import { TenantProvider } from './src/context/TenantContext';
import { BranchProvider } from './src/context/BranchContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { initI18n } from './src/i18n';
import { sessionExit } from './src/utils/sessionExit';
import { useAutoSync } from './src/hooks/useAutoSync';
import { initOfflineDb } from './src/utils/offlineDb';

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);

  // Silent background auto-sync — no UI, no button.
  // Guarded internally by module-level flags so it is safe to call here.
  useAutoSync();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await initI18n();
      } catch (err) {
        console.warn('i18n init failed:', err);
      } finally {
        if (mounted) setI18nReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Prepare the SQLite queue once at boot.
  useEffect(() => {
    (async () => {
      try {
        await initOfflineDb();
      } catch (err) {
        console.warn('initOfflineDb failed:', err);
      }
    })();
  }, []);

  // Mark this run as a cold start and attach the AppState listener
  useEffect(() => {
    (async () => {
      await sessionExit.markColdStart();
    })();
    const detach = sessionExit.attachListener();
    return () => detach();
  }, []);

  if (!i18nReady) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color="#0A8E5A" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {Platform.OS === 'android' && <NavigationBar hidden />}
      <AuthProvider>
        <TenantProvider>
          <BranchProvider>
            <AppNavigator />
          </BranchProvider>
        </TenantProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7FAF8',
  },
});