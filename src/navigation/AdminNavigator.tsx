// src/navigation/AdminNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

// Dashboard
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';

// Common
import { ProfileScreen } from '../screens/common/ProfileScreen';
import { NotificationsScreen } from '../components/common/NotificationsScreen';

// Admin Pages
import { StudentsManagementScreen } from '../screens/admin/StudentsManagementScreen';
import { TeachersManagementScreen } from '../screens/admin/TeachersManagementScreen';
import { ParentsManagementScreen } from '../screens/admin/ParentsManagementScreen';
import { EmployeesManagementScreen } from '../screens/admin/EmployeesManagementScreen';
import { HalaqaatManagementScreen } from '../screens/admin/HalaqaatManagementScreen';
import { AttendanceManagementScreen } from '../screens/admin/AttendanceManagementScreen';
import { MemorizationManagementScreen } from '../screens/admin/memorization/MemorizationManagementScreen';
import { ExaminationsManagementScreen } from '../screens/admin/examinations/ExaminationsManagementScreen';
import { BehaviorManagementScreen } from '../screens/admin/BehaviorManagementScreen';
import { GoalSettingScreen } from '../screens/admin/GoalSettingScreen';
import { FinancialManagementScreen } from '../screens/admin/FinancialManagementScreen';
import { ReportsScreen } from '../screens/admin/ReportsScreen';
import { GoldenRegisterScreen } from '../screens/admin/GoldenRegisterScreen';
import { BranchesManagementScreen } from '../screens/admin/BranchesManagementScreen';
import { UserManagementScreen } from '../screens/admin/UsersManagementScreen';

// ============================================================
// TYPES
// ============================================================
export type AdminTabParamList = {
  Dashboard: undefined;
  Profile: undefined;
  Notifications: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();
const Stack = createNativeStackNavigator();

// ============================================================
// PLACEHOLDER (kept for future routes)
// ============================================================
const PlaceholderScreen = ({ route }: any) => (
  <View
    style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#F7FAF8',
    }}
  >
    <Text style={{ fontSize: 18, fontWeight: '700', color: '#18392D' }}>
      {route.name}
    </Text>
    <Text style={{ fontSize: 14, color: '#94A3B8', marginTop: 8 }}>
      Coming soon
    </Text>
  </View>
);

// ============================================================
// DASHBOARD STACK
// ============================================================
const DashboardStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />

      {/* Real Pages */}
      <Stack.Screen name="Students" component={StudentsManagementScreen} />
      <Stack.Screen name="Teachers" component={TeachersManagementScreen} />
      <Stack.Screen name="Parents" component={ParentsManagementScreen} />
      <Stack.Screen name="Employees" component={EmployeesManagementScreen} />
      <Stack.Screen name="Halaqaat" component={HalaqaatManagementScreen} />
      <Stack.Screen name="Attendance" component={AttendanceManagementScreen} />
      <Stack.Screen name="Memorization" component={MemorizationManagementScreen} />
      <Stack.Screen name="Examinations" component={ExaminationsManagementScreen} />
      <Stack.Screen name="Behavior" component={BehaviorManagementScreen} />
      <Stack.Screen name="Goal Setting" component={GoalSettingScreen} />
      <Stack.Screen name="Financial" component={FinancialManagementScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="Golden Register" component={GoldenRegisterScreen} />
      <Stack.Screen name="Branches" component={BranchesManagementScreen} />
      <Stack.Screen name="Users" component={UserManagementScreen} />
    </Stack.Navigator>
  );
};

// ============================================================
// MAIN NAVIGATOR
// ============================================================
export const AdminNavigator: React.FC = () => {
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
        tabBarActiveTintColor: '#0A8E5A',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
        tabBarStyle: styles.tabBar,
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardStack}
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