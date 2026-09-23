// src/navigation/ParentNavigator.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ParentDashboardScreen } from '../screens/parent/ParentDashboardScreen';
import { ParentProgressScreen } from '../screens/parent/ParentProgressScreen';
import { ParentExaminationsScreen } from '../screens/parent/ParentExaminationsScreen';
import { ParentAttendanceScreen } from '../screens/parent/ParentAttendanceScreen';
import { ProfileScreen } from '../screens/common/ProfileScreen';
import { NotificationsScreen } from '../components/common/NotificationsScreen';

// ============================================================
// TYPES
// ============================================================
export type ParentStackParamList = {
  Tabs: undefined;
  ParentProgress: undefined;
  ParentExaminations: undefined;
  ParentAttendance: undefined;
};

export type ParentTabParamList = {
  Dashboard: undefined;
  Profile: undefined;
  Notifications: undefined;
};

const Tab = createBottomTabNavigator<ParentTabParamList>();
const Stack = createNativeStackNavigator<ParentStackParamList>();

// ============================================================
// TAB NAVIGATOR (inner)
// ============================================================
const ParentTabs: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'Notifications') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#7C3AED',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
        tabBarStyle: styles.tabBar,
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={ParentDashboardScreen}
        options={{ title: t('tabs.dashboard') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t('tabs.profile') }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: t('notifications.title') }}
      />
    </Tab.Navigator>
  );
};

// ============================================================
// ROOT STACK NAVIGATOR
// ============================================================
export const ParentNavigator: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Tabs" component={ParentTabs} />

      <Stack.Screen
        name="ParentProgress"
        component={ParentProgressScreen}
        options={{ title: t('parent.nav.progress') }}
      />
      <Stack.Screen
        name="ParentExaminations"
        component={ParentExaminationsScreen}
        options={{ title: t('parent.nav.examinations') }}
      />
      <Stack.Screen
        name="ParentAttendance"
        component={ParentAttendanceScreen}
        options={{ title: t('parent.nav.attendance') }}
      />
    </Stack.Navigator>
  );
};

export default ParentNavigator;

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    height: 60,
    paddingBottom: 8,
  },
});