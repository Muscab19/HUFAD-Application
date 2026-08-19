import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { api } from '../../api/client';
import { Ionicons } from '@expo/vector-icons';

interface DashboardStats {
  totalStudents: number;
  activeTeachers: number;
  totalHalaqaat: number;
  attendanceRate: string;
  studentChange: string;
  teacherChange: string;
  halaqahChange: string;
}

// Define the API response type
interface DashboardResponse {
  success?: boolean;
  totalStudents: number;
  activeTeachers: number;
  totalHalaqaat: number;
  attendanceRate: string;
  studentChange: string;
  teacherChange: string;
  halaqahChange: string;
}

export const AdminDashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const { currentBranch } = useBranch();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    try {
      const response = await api.get<DashboardResponse>('/api/admin/dashboard/stats');
      // The response might be wrapped in a data property or be the object itself
      const data = response as DashboardStats;
      setStats(data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [currentBranch]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Welcome Header */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>
            Welcome back, {user?.firstName || user?.username || 'Admin'}!
          </Text>
          <Text style={styles.welcomeSubtitle}>
            {currentBranch ? `${currentBranch.name} Branch` : 'All Branches'}
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {/* Total Students */}
          <View style={[styles.statCard, styles.statCardHalf]}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Students</Text>
              <View style={[styles.statIcon, styles.emeraldIcon]}>
                <Ionicons name="people" size={20} color="#10b981" />
              </View>
            </View>
            <Text style={styles.statValue}>
              {stats?.totalStudents || 0}
            </Text>
            <Text style={[
              styles.statChange,
              stats?.studentChange?.startsWith('+') ? styles.statChangePositive : styles.statChangeNeutral
            ]}>
              {stats?.studentChange || '0%'}
            </Text>
          </View>

          {/* Teachers */}
          <View style={[styles.statCard, styles.statCardHalf]}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Teachers</Text>
              <View style={[styles.statIcon, styles.blueIcon]}>
                <Ionicons name="school" size={20} color="#3b82f6" />
              </View>
            </View>
            <Text style={styles.statValue}>
              {stats?.activeTeachers || 0}
            </Text>
            <Text style={[
              styles.statChange,
              stats?.teacherChange?.startsWith('+') ? styles.statChangePositive : styles.statChangeNeutral
            ]}>
              {stats?.teacherChange || '0'}
            </Text>
          </View>

          {/* Halaqaat */}
          <View style={[styles.statCard, styles.statCardHalf]}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Halaqaat</Text>
              <View style={[styles.statIcon, styles.purpleIcon]}>
                <Ionicons name="book" size={20} color="#8b5cf6" />
              </View>
            </View>
            <Text style={styles.statValue}>
              {stats?.totalHalaqaat || 0}
            </Text>
            <Text style={[
              styles.statChange,
              stats?.halaqahChange?.startsWith('+') ? styles.statChangePositive : styles.statChangeNeutral
            ]}>
              {stats?.halaqahChange || '0'}
            </Text>
          </View>

          {/* Attendance */}
          <View style={[styles.statCard, styles.statCardHalf]}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Attendance</Text>
              <View style={[styles.statIcon, styles.orangeIcon]}>
                <Ionicons name="calendar" size={20} color="#f59e0b" />
              </View>
            </View>
            <Text style={styles.statValue}>
              {stats?.attendanceRate || '0%'}
            </Text>
            <Text style={styles.statSubtext}>Last 30 days</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={[styles.actionCard, styles.actionCardThird]}>
              <View style={[styles.actionIconContainer, styles.actionEmerald]}>
                <Ionicons name="person-add" size={24} color="#10b981" />
              </View>
              <Text style={styles.actionText}>Add Student</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionCard, styles.actionCardThird]}>
              <View style={[styles.actionIconContainer, styles.actionBlue]}>
                <Ionicons name="calendar" size={24} color="#3b82f6" />
              </View>
              <Text style={styles.actionText}>Take Attendance</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionCard, styles.actionCardThird]}>
              <View style={[styles.actionIconContainer, styles.actionPurple]}>
                <Ionicons name="book" size={24} color="#8b5cf6" />
              </View>
              <Text style={styles.actionText}>Add Halaqah</Text>
            </TouchableOpacity>
          </View>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  welcomeContainer: {
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  welcomeSubtitle: {
    color: '#6b7280',
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  statCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginHorizontal: 8,
    marginBottom: 16,
  },
  statCardHalf: {
    width: '50%',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 14,
  },
  statIcon: {
    padding: 8,
    borderRadius: 999,
  },
  emeraldIcon: {
    backgroundColor: '#d1fae5',
  },
  blueIcon: {
    backgroundColor: '#dbeafe',
  },
  purpleIcon: {
    backgroundColor: '#ede9fe',
  },
  orangeIcon: {
    backgroundColor: '#fef3c7',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 8,
  },
  statChange: {
    fontSize: 12,
  },
  statChangePositive: {
    color: '#059669',
  },
  statChangeNeutral: {
    color: '#9ca3af',
  },
  statSubtext: {
    color: '#9ca3af',
    fontSize: 12,
  },
  actionsContainer: {
    marginTop: 16,
  },
  sectionTitle: {
    color: '#374151',
    fontWeight: '600',
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  actionCard: {
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  actionCardThird: {
    width: '33.33%',
  },
  actionIconContainer: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionEmerald: {
    backgroundColor: '#ecfdf5',
    borderColor: '#d1fae5',
  },
  actionBlue: {
    backgroundColor: '#eff6ff',
    borderColor: '#dbeafe',
  },
  actionPurple: {
    backgroundColor: '#f5f3ff',
    borderColor: '#ede9fe',
  },
  actionText: {
    color: '#059669',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});