// App.tsx
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from './src/context/AuthContext';
import { TenantProvider } from './src/context/TenantContext';
import { BranchProvider } from './src/context/BranchContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { initI18n } from './src/i18n';

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);

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