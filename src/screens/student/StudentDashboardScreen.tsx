import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export const StudentDashboardScreen: React.FC = () => {
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Welcome Header */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>
            Welcome, {user?.firstName || user?.username || 'Student'}!
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Track your memorization progress
          </Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Memorized</Text>
              <View style={[styles.statIcon, styles.emeraldIcon]}>
                <Ionicons name="book" size={20} color="#10b981" />
              </View>
            </View>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statSubtext}>Juz</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Attendance</Text>
              <View style={[styles.statIcon, styles.blueIcon]}>
                <Ionicons name="calendar" size={20} color="#3b82f6" />
              </View>
            </View>
            <Text style={styles.statValue}>0%</Text>
            <Text style={styles.statSubtext}>This month</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.progressContainer}>
          <Text style={styles.sectionTitle}>My Progress</Text>
          <View style={styles.progressCard}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Current Halaqah</Text>
              <Text style={styles.progressValue}>Not assigned</Text>
            </View>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Memorization Status</Text>
              <Text style={[styles.progressValue, styles.statusInProgress]}>In Progress</Text>
            </View>
            <View style={[styles.progressRow, styles.lastProgressRow]}>
              <Text style={styles.progressLabel}>Next Exam</Text>
              <Text style={styles.progressValue}>Not scheduled</Text>
            </View>
          </View>
        </View>

        {/* Coming Soon */}
        <View style={styles.comingSoonCard}>
          <Text style={styles.comingSoonTitle}>📱 Coming Soon</Text>
          <Text style={styles.comingSoonText}>
            More features are being added to help you track your Quran memorization journey.
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
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  statCard: {
    width: '50%',
    paddingHorizontal: 8,
    marginBottom: 16,
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
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 8,
  },
  statSubtext: {
    color: '#9ca3af',
    fontSize: 12,
  },
  progressContainer: {
    marginTop: 16,
  },
  sectionTitle: {
    color: '#374151',
    fontWeight: '600',
    marginBottom: 12,
  },
  progressCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  lastProgressRow: {
    borderBottomWidth: 0,
  },
  progressLabel: {
    color: '#6b7280',
  },
  progressValue: {
    color: '#1f2937',
    fontWeight: '500',
  },
  statusInProgress: {
    color: '#d97706',
  },
  comingSoonCard: {
    marginTop: 24,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  comingSoonTitle: {
    color: '#1f2937',
    fontWeight: '600',
  },
  comingSoonText: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 4,
  },
});