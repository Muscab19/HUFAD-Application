import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { TenantProvider } from './src/context/TenantContext';
import { BranchProvider } from './src/context/BranchContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
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