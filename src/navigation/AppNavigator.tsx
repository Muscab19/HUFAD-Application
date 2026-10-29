// src/navigation/AppNavigator.tsx
import React, { useEffect, useCallback } from 'react';
import {
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  View,
  StyleSheet,
  BackHandler,
  Alert,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../context/AuthContext';
import { AuthNavigator } from './AuthNavigator';
import { RoleNavigator } from './RoleNavigator';
import { SuspensionGuard } from '../components/common/SuspensionGuard';

const Stack = createNativeStackNavigator();

const navigationRef =
  React.createRef<NavigationContainerRef<Record<string, object>>>();

export const AppNavigator: React.FC = () => {
  const { user, isLoading, forceLogout } = useAuth();
  const { t } = useTranslation();

  // ------------------------------------------------------------
  // Confirm-exit on root back press
  // ------------------------------------------------------------
  const handleBackPress = useCallback((): boolean => {
    const nav = navigationRef.current;
    const canGoBack = nav?.canGoBack?.() ?? false;

    // If we're not at the root, let the stack handle it
    if (canGoBack) return false;

    // We're at the root — confirm exit
    Alert.alert(
      t('exit.title', 'Exit App?'),
      t(
        'exit.message',
        'You will be signed out and will need to log in again.'
      ),
      [
        { text: t('exit.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('exit.confirm', 'Exit'),
          style: 'destructive',
          onPress: async () => {
            try {
              await forceLogout();
            } catch {}
            if (Platform.OS === 'android') {
              BackHandler.exitApp();
            }
            // iOS: no public API to close the app — the login screen
            // will already be showing at this point.
          },
        },
      ],
      { cancelable: true }
    );
    return true; // prevent default back
  }, [forceLogout, t]);

  useEffect(() => {
    const sub = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress
    );
    return () => sub.remove();
  }, [handleBackPress]);

  // ------------------------------------------------------------
  // Loading state
  // ------------------------------------------------------------
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <Stack.Screen name="Main">
            {() => (
              <SuspensionGuard>
                <RoleNavigator />
              </SuspensionGuard>
            )}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
});