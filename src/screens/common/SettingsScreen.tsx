import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useBranch } from '../../context/BranchContext';
import { Ionicons } from '@expo/vector-icons';

export const SettingsScreen: React.FC = () => {
  const { logout } = useAuth();
  const { clearTenant } = useTenant();
  const { clearBranch } = useBranch();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const handleSwitchSchool = async () => {
    Alert.alert(
      'Switch School',
      'You will need to select a school again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            await clearTenant();
            await clearBranch();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Settings</Text>

        {/* Preferences */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="notifications-outline" size={20} color="#6b7280" />
              <Text style={styles.rowText}>Push Notifications</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#d1d5db', true: '#10b981' }}
            />
          </View>
          <View style={[styles.row, styles.noBorder]}>
            <View style={styles.rowLeft}>
              <Ionicons name="moon-outline" size={20} color="#6b7280" />
              <Text style={styles.rowText}>Dark Mode</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#d1d5db', true: '#10b981' }}
            />
          </View>
        </View>

        {/* Language */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="language-outline" size={20} color="#6b7280" />
              <Text style={styles.rowText}>Language</Text>
            </View>
            <Text style={styles.rowValue}>English</Text>
          </View>
        </View>

        {/* Account */}
        <View style={styles.card}>
          <TouchableOpacity 
            style={[styles.row, styles.touchableRow]}
            onPress={handleSwitchSchool}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="school-outline" size={20} color="#6b7280" />
              <Text style={styles.rowText}>Switch School</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.row, styles.touchableRow, styles.noBorder]}
            onPress={handleLogout}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
              <Text style={[styles.rowText, styles.logoutText]}>Logout</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>HUFAD App v1.0.0</Text>
          <Text style={[styles.footerText, styles.footerSubText]}>
            {new Date().getFullYear()} © HUFAD Qur'an School System
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 24,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowText: {
    color: '#1f2937',
    marginLeft: 12,
  },
  rowValue: {
    color: '#6b7280',
  },
  logoutText: {
    color: '#ef4444',
  },
  touchableRow: {
    // Additional touchable styling if needed
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  footerSubText: {
    fontSize: 12,
    marginTop: 4,
  },
});