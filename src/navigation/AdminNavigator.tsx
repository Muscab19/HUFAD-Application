// src/navigation/AdminNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../context/AuthContext';
import { hasPermission, PageKey } from '../utils/permissions';

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
import { ReportsScreen } from '../screens/admin/reports/ReportsScreen';
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
// ACCESS DENIED (rendered when a restricted admin somehow lands
// on a screen they are not permitted to see — e.g. via deep link)
// ============================================================
const AccessDeniedScreen: React.FC<{ route: any; navigation: any }> = ({
  navigation,
}) => (
  <View style={styles.deniedWrap}>
    <Ionicons name="lock-closed" size={48} color="#DC2626" />
    <Text style={styles.deniedTitle}>Access restricted</Text>
    <Text style={styles.deniedText}>
      Your account doesn't have permission to open this page. Contact your
      school administrator if you believe this is a mistake.
    </Text>
    <TouchableOpacity
      style={styles.deniedBtn}
      onPress={() => navigation.goBack()}
    >
      <Text style={styles.deniedBtnText}>Go back</Text>
    </TouchableOpacity>
  </View>
);

// ============================================================
// GUARD WRAPPER — registers a screen only if the user has the
// permission; otherwise registers the AccessDenied fallback so the
// route name still exists (deep links / stray navigations don't crash).
// ============================================================
const GuardedScreen = ({
  page,
  component: Component,
}: {
  page: PageKey;
  component: React.ComponentType<any>;
}) => {
  const { user } = useAuth();
  if (hasPermission(user, page)) return <Component />;
  // We can't call useNavigation here at top-level safely; the fallback
  // component itself uses it. So return the fallback component.
  return <AccessDeniedScreen route={{}} navigation={undefined} />;
};

// ============================================================
// DASHBOARD STACK
// ============================================================
const DashboardStack: React.FC = () => {
  const { user } = useAuth();

  // Helper: only render <Stack.Screen> when the user is allowed.
  // We use a plain function because <Stack.Screen> can't be conditionally
  // composed via a component wrapper (React Navigation requires direct
  // children of Stack.Navigator to be Stack.Screen elements).
  const allow = (p: PageKey) => hasPermission(user, p);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />

      {allow('students') && (
        <Stack.Screen name="Students" component={StudentsManagementScreen} />
      )}
      {allow('teachers') && (
        <Stack.Screen name="Teachers" component={TeachersManagementScreen} />
      )}
      {allow('parents') && (
        <Stack.Screen name="Parents" component={ParentsManagementScreen} />
      )}
      {allow('employees') && (
        <Stack.Screen name="Employees" component={EmployeesManagementScreen} />
      )}
      {allow('halaqaat') && (
        <Stack.Screen name="Halaqaat" component={HalaqaatManagementScreen} />
      )}
      {allow('attendance') && (
        <Stack.Screen name="Attendance" component={AttendanceManagementScreen} />
      )}
      {allow('memorization') && (
        <Stack.Screen
          name="Memorization"
          component={MemorizationManagementScreen}
        />
      )}
      {allow('examinations') && (
        <Stack.Screen
          name="Examinations"
          component={ExaminationsManagementScreen}
        />
      )}
      {allow('behavior') && (
        <Stack.Screen name="Behavior" component={BehaviorManagementScreen} />
      )}
      {allow('goal-setting') && (
        <Stack.Screen name="Goal Setting" component={GoalSettingScreen} />
      )}
      {allow('financial') && (
        <Stack.Screen name="Financial" component={FinancialManagementScreen} />
      )}
      {allow('reports') && (
        <Stack.Screen name="Reports" component={ReportsScreen} />
      )}
      {allow('golden-register') && (
        <Stack.Screen name="Golden Register" component={GoldenRegisterScreen} />
      )}
      {allow('branches') && (
        <Stack.Screen name="Branches" component={BranchesManagementScreen} />
      )}
      {allow('users') && (
        <Stack.Screen name="Users" component={UserManagementScreen} />
      )}
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
  deniedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F7FAF8',
  },
  deniedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#18392D',
    marginTop: 14,
  },
  deniedText: {
    fontSize: 13,
    color: '#718079',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  deniedBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#0A8E5A',
  },
  deniedBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});