// src/screens/admin/memorization/MemorizationManagementScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS } from './_shared';
import { RecordAchievements } from './RecordAchievements';
import { ViewAchievements } from './ViewAchievements';

const MemorizationMenu: React.FC<{ onSelect: (mode: 'record' | 'view') => void }> = ({ onSelect }) => {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('memorization.menu.title')}</Text>
        <Text style={styles.headerSubtitle}>
          {t('memorization.menu.subtitle')}
        </Text>
      </View>

      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => onSelect('record')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIcon, { backgroundColor: COLORS.blueLight }]}>
            <Ionicons name="add-circle" size={32} color={COLORS.blue} />
          </View>
          <Text style={styles.menuTitle}>
            {t('memorization.menu.recordTitle')}
          </Text>
          <Text style={styles.menuText}>
            {t('memorization.menu.recordText')}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={20}
            color={COLORS.blue}
            style={styles.menuArrow}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => onSelect('view')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIcon, { backgroundColor: COLORS.primaryLight }]}>
            <Ionicons name="stats-chart" size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.menuTitle}>
            {t('memorization.menu.viewTitle')}
          </Text>
          <Text style={styles.menuText}>
            {t('memorization.menu.viewText')}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={20}
            color={COLORS.primary}
            style={styles.menuArrow}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export const MemorizationManagementScreen: React.FC = () => {
  const [mode, setMode] = useState<'menu' | 'record' | 'view'>('menu');

  if (mode === 'record') return <RecordAchievements onBack={() => setMode('menu')} />;
  if (mode === 'view') return <ViewAchievements onBack={() => setMode('menu')} />;
  return <MemorizationMenu onSelect={setMode} />;
};

export default MemorizationManagementScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.slate },
  headerSubtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },
  menuContainer: { padding: 16, gap: 12 },
  menuCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  menuTitle: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  menuText: { fontSize: 13, color: COLORS.slateMuted, marginTop: 4, lineHeight: 20 },
  menuArrow: { position: 'absolute', right: 20, top: 20 },
});