// src/navigation/TeacherNavigator.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { TeacherDashboardScreen } from '../screens/teacher/TeacherDashboardScreen';
import { TeacherAttendanceScreen } from '../screens/teacher/TeacherAttendanceScreen';
import { TeacherMemorizationScreen } from '../screens/teacher/TeacherMemorizationScreen';
import { TeacherGoalSettingScreen } from '../screens/teacher/TeacherGoalSettingScreen';
import { ProfileScreen } from '../screens/common/ProfileScreen';
import { NotificationsScreen } from '../components/common/NotificationsScreen';

// ============================================================
// TYPES
// ============================================================
export type TeacherStackParamList = {
  Tabs: undefined;
  TeacherAttendance: undefined;
  TeacherMemorization: undefined;
  TeacherGoalSetting: undefined;
};

export type TeacherTabParamList = {
  Dashboard: undefined;
  Profile: undefined;
  Notifications: undefined;
};

const Tab = createBottomTabNavigator<TeacherTabParamList>();
const Stack = createNativeStackNavigator<TeacherStackParamList>();

// ============================================================
// TAB NAVIGATOR (inner)
// ============================================================
const TeacherTabs: React.FC = () => {
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
        tabBarActiveTintColor: '#10b981',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
        tabBarStyle: styles.tabBar,
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={TeacherDashboardScreen}
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
export const TeacherNavigator: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Tabs" component={TeacherTabs} />

      <Stack.Screen
        name="TeacherAttendance"
        component={TeacherAttendanceScreen}
        options={{ title: t('teacher.nav.attendance') }}
      />
      <Stack.Screen
        name="TeacherMemorization"
        component={TeacherMemorizationScreen}
        options={{ title: t('teacher.nav.memorization') }}
      />
      <Stack.Screen
        name="TeacherGoalSetting"
        component={TeacherGoalSettingScreen}
        options={{ title: t('teacher.nav.goalSetting') }}
      />
    </Stack.Navigator>
  );
};

export default TeacherNavigator;

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