import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { AuthNavigator } from './AuthNavigator';
import { RoleNavigator } from './RoleNavigator';
import { SuspensionGuard } from '../components/common/SuspensionGuard';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

const Stack = createNativeStackNavigator();

export const AppNavigator: React.FC = () => {
  const { user, isLoading } = useAuth();

  // Show loading while auth state is being restored
  if (isLoading) {
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
          // Not logged in → Login screen
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          // Logged in → Role-based navigator
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