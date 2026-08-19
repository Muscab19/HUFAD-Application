import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export const ParentDashboardScreen: React.FC = () => {
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Welcome Header */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>
            Welcome, {user?.firstName || user?.username || 'Parent'}!
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Track your children's progress
          </Text>
        </View>

        {/* Children List */}
        <View style={styles.childrenContainer}>
          <Text style={styles.sectionTitle}>My Children</Text>
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>
              No children registered yet
            </Text>
          </View>
        </View>

        {/* Coming Soon */}
        <View style={styles.comingSoonCard}>
          <Text style={styles.comingSoonTitle}>📱 Coming Soon</Text>
          <Text style={styles.comingSoonText}>
            Track your children's memorization progress and attendance.
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
  childrenContainer: {
    marginTop: 16,
  },
  sectionTitle: {
    color: '#374151',
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  emptyText: {
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
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