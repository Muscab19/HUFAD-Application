// src/screens/parent/ParentDashboardScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { api } from '../../api/client';

const { width } = Dimensions.get('window');

// ============================================================
// BRAND
// ============================================================
const COLORS = {
  primary: '#0A8E5A',
  primaryDark: '#063D2C',
  primaryLight: '#E9F8F0',
  gold: '#C9A227',
  goldLight: '#FFF7DF',
  blue: '#2878D0',
  blueLight: '#EAF3FF',
  purple: '#7C3AED',
  purpleLight: '#F3EFFF',
  red: '#DC2626',
  redLight: '#FEE9E9',
  amber: '#D97706',
  amberLight: '#FEF3C7',
  teal: '#0D9488',
  tealLight: '#CCFBF1',
  pink: '#DB2777',
  pinkLight: '#FCE7F3',
  cyan: '#0891B2',
  cyanLight: '#E0F7FA',
  white: '#FFFFFF',
  slate: '#18392D',
  slateMuted: '#718079',
  border: '#E4EBE7',
  background: '#F7FAF8',
  gray: '#8A9891',
};

// ============================================================
// TYPES
// ============================================================
interface ParentStats {
  childrenCount: number;
  attendanceRate: number;
  averageScore: number;
  recentAchievements: number;
}

// ============================================================
// HELPERS
// ============================================================
const unwrapData = (res: any): any => {
  if (res && typeof res === 'object' && 'data' in res) return res.data;
  return res;
};

const initials = (name?: string) => {
  const s = (name || '').trim();
  if (!s) return '?';
  const parts = s.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.substring(0, 2).toUpperCase();
};

// ============================================================
// PARENT PAGES CONFIG
// ============================================================
const PARENT_PAGES: {
  key: string;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  background: string;
}[] = [
  {
    key: 'ParentProgress',
    labelKey: 'parent.dashboard.pages.progress',
    icon: 'trending-up-outline',
    iconColor: COLORS.primary,
    background: COLORS.primaryLight,
  },
  {
    key: 'ParentExaminations',
    labelKey: 'parent.dashboard.pages.examinations',
    icon: 'document-text-outline',
    iconColor: COLORS.purple,
    background: COLORS.purpleLight,
  },
  {
    key: 'ParentAttendance',
    labelKey: 'parent.dashboard.pages.attendance',
    icon: 'calendar-outline',
    iconColor: COLORS.blue,
    background: COLORS.blueLight,
  },
];

// ============================================================
// SCREEN
// ============================================================
export const ParentDashboardScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { currentBranch } = useBranch();

  const [stats, setStats] = useState<ParentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // ============================================================
  // LOAD DASHBOARD
  // ============================================================
  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let statsData: ParentStats | null = null;

      // Try the dedicated endpoint first
      try {
        const res: any = await api.get('/parent/dashboard/stats');
        const data = unwrapData(res);
        if (data && typeof data === 'object') {
          statsData = {
            childrenCount: Number(data.childrenCount ?? data.children) || 0,
            attendanceRate: Number(data.attendanceRate) || 0,
            averageScore: Number(data.averageScore) || 0,
            recentAchievements: Number(data.recentAchievements) || 0,
          };
        }
      } catch (e) {
        console.warn('Parent stats endpoint failed, using fallback');
      }

      // Fallback: derive from children endpoint
      if (!statsData) {
        let childrenList: any[] = [];
        try {
          const res: any = await api.get('/parent/children');
          const data = unwrapData(res);
          childrenList = Array.isArray(data)
            ? data
            : data?.children || [];
        } catch (e) {
          childrenList = [];
        }

        statsData = {
          childrenCount: childrenList.length,
          attendanceRate: 0,
          averageScore: 0,
          recentAchievements: 0,
        };
      }

      setStats(statsData);
      setError('');
    } catch (err: any) {
      console.error('Parent dashboard load error:', err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load dashboard'
      );
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, currentBranch]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard(true);
  };

  const handlePagePress = (pageKey: string) => {
    try {
      navigation.navigate(pageKey);
    } catch (err) {
      console.warn(`Navigate to: ${pageKey} not registered`);
    }
  };

  // ============================================================
  // DERIVED
  // ============================================================
  const firstName =
    (user as any)?.firstName ||
    (user as any)?.associatedName ||
    (user as any)?.name ||
    (user as any)?.username ||
    t('parent.dashboard.welcomeFallback');

  const branchLabel = currentBranch
    ? (currentBranch as any).name || t('parent.dashboard.allBranches')
    : t('parent.dashboard.allBranches');

  // ============================================================
  // LOADING
  // ============================================================
  if (loading && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingLogoWrap}>
          <Image
            source={require('../../../assets/hufad-icon.jpeg')}
            style={styles.loadingLogoImage}
            resizeMode="cover"
          />
        </View>
        <Text style={styles.loadingBrand}>HUFAD</Text>
        <ActivityIndicator
          size="small"
          color={COLORS.purple}
          style={{ marginTop: 18 }}
        />
      </View>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.purple}
            colors={[COLORS.purple]}
          />
        }
      >
        {/* HERO */}
        <View style={styles.hero}>
          <View style={styles.heroGlowTop} />
          <View style={styles.heroGlowBottom} />

          <View style={styles.heroTopRow}>
            <View style={styles.brandWrap}>
              <View style={styles.brandLogo}>
                <Image
                  source={require('../../../assets/hufad-icon.jpeg')}
                  style={styles.brandLogoImage}
                  resizeMode="cover"
                />
              </View>
              <View>
                <Text style={styles.brandName}>HUFAD</Text>
                <Text style={styles.brandArabic}>نظام حفاظ</Text>
              </View>
            </View>

            <View style={styles.heroActions}>
              <TouchableOpacity style={styles.heroIconBtn} activeOpacity={0.7}>
                <Ionicons
                  name="notifications-outline"
                  size={17}
                  color={COLORS.white}
                />
                <View style={styles.notificationDot} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.heroProfile} activeOpacity={0.7}>
                <Text style={styles.heroProfileText}>{initials(firstName)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroWelcomeBlock}>
            <Text style={styles.heroSalaam}>
              {t('parent.dashboard.greeting')}
            </Text>
            <Text style={styles.heroWelcome} numberOfLines={1}>
              {firstName}
            </Text>

            <View style={styles.heroChips}>
              <View style={styles.heroChip}>
                <Ionicons
                  name="location-outline"
                  size={11}
                  color="rgba(255,255,255,0.9)"
                />
                <Text style={styles.heroChipText} numberOfLines={1}>
                  {branchLabel}
                </Text>
              </View>
              <View style={styles.heroChip}>
                <Ionicons
                  name="people-outline"
                  size={11}
                  color={COLORS.gold}
                />
                <Text style={styles.heroChipText}>
                  {t('parent.dashboard.roleBadge')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* OVERVIEW */}
        <View style={styles.overviewGrid}>
          <OverviewCard
            label={t('parent.dashboard.overview.children')}
            value={stats?.childrenCount ?? 0}
            caption={t('parent.dashboard.overview.childrenCaption')}
            icon="people-outline"
            accent={COLORS.purple}
            accentBg={COLORS.purpleLight}
          />
          <OverviewCard
            label={t('parent.dashboard.overview.attendance')}
            value={`${stats?.attendanceRate ?? 0}%`}
            caption={t('parent.dashboard.overview.attendanceCaption')}
            icon="calendar-outline"
            accent={COLORS.blue}
            accentBg={COLORS.blueLight}
          />
          <OverviewCard
            label={t('parent.dashboard.overview.avgScore')}
            value={`${stats?.averageScore ?? 0}%`}
            caption={t('parent.dashboard.overview.avgScoreCaption')}
            icon="bar-chart-outline"
            accent={COLORS.primary}
            accentBg={COLORS.primaryLight}
          />
          <OverviewCard
            label={t('parent.dashboard.overview.achievements')}
            value={stats?.recentAchievements ?? 0}
            caption={t('parent.dashboard.overview.achievementsCaption')}
            icon="trending-up-outline"
            accent={COLORS.teal}
            accentBg={COLORS.tealLight}
          />
        </View>

        {/* ERROR BANNER */}
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={COLORS.red} />
            <Text style={styles.errorText} numberOfLines={2}>
              {error}
            </Text>
            <TouchableOpacity onPress={() => setError('')}>
              <Ionicons name="close" size={14} color={COLORS.red} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* MANAGE */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              {t('parent.dashboard.manage.title')}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {t('parent.dashboard.manage.subtitle')}
            </Text>
          </View>
          <Text style={styles.pageCountText}>
            {t('parent.dashboard.manage.modulesCount', {
              count: PARENT_PAGES.length,
            })}
          </Text>
        </View>

        <View style={styles.pagesGrid}>
          {PARENT_PAGES.map((page) => (
            <ToolButton
              key={page.key}
              icon={page.icon}
              label={t(page.labelKey)}
              iconColor={page.iconColor}
              background={page.background}
              onPress={() => handlePagePress(page.key)}
            />
          ))}
        </View>

        {/* QUOTE */}
        <View style={styles.quoteCard}>
          <View style={styles.quoteBook}>
            <Ionicons name="book" size={26} color={COLORS.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.quoteArabic}>
              {t('parent.dashboard.quote.arabic')}
            </Text>
            <Text style={styles.quoteText}>
              {t('parent.dashboard.quote.text')}
            </Text>
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ============================================================
// TOOL BUTTON
// ============================================================
interface ToolButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  iconColor: string;
  background: string;
  onPress: () => void;
}

const ToolButton: React.FC<ToolButtonProps> = ({
  icon,
  label,
  iconColor,
  background,
  onPress,
}) => (
  <TouchableOpacity
    activeOpacity={0.7}
    style={styles.toolButton}
    onPress={onPress}
  >
    <View style={[styles.toolIcon, { backgroundColor: background }]}>
      <Ionicons name={icon} size={26} color={iconColor} />
    </View>
    <Text style={styles.toolLabel} numberOfLines={2}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ============================================================
// OVERVIEW CARD
// ============================================================
interface OverviewCardProps {
  label: string;
  value: number | string;
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  accentBg: string;
}

const OverviewCard: React.FC<OverviewCardProps> = ({
  label,
  value,
  caption,
  icon,
  accent,
  accentBg,
}) => (
  <View style={styles.overviewCard}>
    <View style={[styles.overviewRail, { backgroundColor: accent }]} />

    <View style={styles.overviewTop}>
      <View style={[styles.overviewIconWrap, { backgroundColor: accentBg }]}>
        <Ionicons name={icon} size={16} color={accent} />
      </View>
      <Text style={styles.overviewLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>

    <Text style={styles.overviewValue} numberOfLines={1}>
      {value}
    </Text>

    <Text
      style={[styles.overviewCaption, { color: accent }]}
      numberOfLines={1}
    >
      {caption}
    </Text>
  </View>
);

export default ParentDashboardScreen;

// ============================================================
// STYLES (mirrors admin / teacher dashboards)
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogoWrap: {
    width: 90,
    height: 90,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: COLORS.primaryDark,
  },
  loadingLogoImage: { width: '100%', height: '100%' },
  loadingBrand: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primaryDark,
    letterSpacing: 1,
  },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 10 },

  // HERO
  hero: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    overflow: 'hidden',
  },
  heroGlowTop: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    right: -120,
    top: -140,
    backgroundColor: 'rgba(201,162,39,0.10)',
  },
  heroGlowBottom: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    left: -100,
    bottom: -120,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  brandWrap: { flexDirection: 'row', alignItems: 'center' },
  brandLogo: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
    overflow: 'hidden',
  },
  brandLogoImage: { width: '100%', height: '100%' },
  brandName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 1.2,
  },
  brandArabic: {
    fontSize: 8.5,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 1,
  },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.gold,
    top: 7,
    right: 7,
  },
  heroProfile: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroProfileText: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  heroWelcomeBlock: { marginBottom: 2 },
  heroSalaam: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  heroWelcome: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 2,
    letterSpacing: -0.3,
  },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxWidth: '65%',
  },
  heroChipText: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '600',
  },

  // OVERVIEW
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  overviewCard: {
    width: (width - 32 - 10) / 2,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    paddingLeft: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  overviewRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  overviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  overviewIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slateMuted,
    letterSpacing: 0.2,
    flex: 1,
  },
  overviewValue: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.slate,
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  overviewCaption: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  // ERROR
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    padding: 10,
    backgroundColor: COLORS.redLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F6C8C8',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.red,
    fontWeight: '600',
  },

  // SECTION HEADER
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.slate,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 10.5,
    color: COLORS.slateMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  pageCountText: { fontSize: 11, color: COLORS.gray, fontWeight: '600' },

  // TOOLS GRID (3 wide)
  pagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  toolButton: {
    width: (width - 32 - 40) / 3,
    alignItems: 'center',
    marginBottom: 16,
  },
  toolIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toolLabel: {
    fontSize: 11,
    color: '#41554C',
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 14,
  },

  // QUOTE
  quoteCard: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  quoteBook: {
    width: 47,
    height: 47,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quoteArabic: {
    color: '#F0D46D',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  quoteText: { color: '#D3E5DC', fontSize: 9, lineHeight: 14 },
});