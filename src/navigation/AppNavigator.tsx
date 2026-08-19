import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { AuthNavigator } from './AuthNavigator';
import { RoleNavigator } from './RoleNavigator';
import { TenantSelectionScreen } from '../screens/auth/TenantSelectionScreen';
import { SuspensionGuard } from '../components/common/SuspensionGuard';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

const Stack = createNativeStackNavigator();

export const AppNavigator: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { tenant, isLoading: tenantLoading } = useTenant();

  // Show loading screen while checking auth and tenant
  if (authLoading || tenantLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {!user ? (
          // Not logged in
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : !tenant ? (
          // Logged in but no tenant selected
          <Stack.Screen name="TenantSelection" component={TenantSelectionScreen} />
        ) : (
          // Logged in and tenant selected
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