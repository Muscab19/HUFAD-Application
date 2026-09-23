// src/screens/common/NotificationsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Alert,
  SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import {
  notificationsService,
  AppNotification,
} from '../../api/services/notificationsService';

// ============================================================
// BRAND
// ============================================================
const COLORS = {
  primary: '#0A8E5A',
  primaryLight: '#E9F8F0',
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
interface NotifStyle {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}

// ============================================================
// HELPERS
// ============================================================
const getNotifStyle = (type: AppNotification['type']): NotifStyle => {
  switch (type) {
    case 'success':
      return { icon: 'checkmark-circle', color: COLORS.primary, bg: COLORS.primaryLight };
    case 'warning':
      return { icon: 'alert-circle', color: COLORS.amber, bg: COLORS.amberLight };
    case 'error':
      return { icon: 'close-circle', color: COLORS.red, bg: COLORS.redLight };
    case 'goal':
      return { icon: 'flag', color: COLORS.purple, bg: COLORS.purpleLight };
    case 'attendance':
      return { icon: 'calendar', color: COLORS.blue, bg: COLORS.blueLight };
    case 'exam':
      return { icon: 'document-text', color: COLORS.red, bg: COLORS.redLight };
    case 'memorization':
      return { icon: 'book', color: COLORS.primary, bg: COLORS.primaryLight };
    case 'user':
      return { icon: 'person', color: COLORS.blue, bg: COLORS.blueLight };
    case 'message':
      return { icon: 'chatbubble', color: COLORS.teal, bg: COLORS.tealLight };
    case 'announcement':
      return { icon: 'megaphone', color: COLORS.pink, bg: COLORS.pinkLight };
    case 'info':
    default:
      return { icon: 'information-circle', color: COLORS.blue, bg: COLORS.blueLight };
  }
};

const timeAgo = (iso: string, t: (k: string, o?: any) => string): string => {
  try {
    const then = new Date(iso).getTime();
    const diffMs = Date.now() - then;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return t('notifications.justNow');
    if (mins < 60) return t('notifications.minutesAgo', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('notifications.hoursAgo', { count: hours });
    const days = Math.floor(hours / 24);
    return t('notifications.daysAgo', { count: days });
  } catch {
    return '';
  }
};

const sectionKeyFor = (
  iso: string,
  t: (k: string) => string
): string => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOfWeek = startOfToday - 6 * 86400000;

    const ts = d.getTime();
    if (ts >= startOfToday) return t('notifications.today');
    if (ts >= startOfYesterday) return t('notifications.yesterday');
    if (ts >= startOfWeek) return t('notifications.thisWeek');
    return t('notifications.older');
  } catch {
    return t('notifications.older');
  }
};

// ============================================================
// SCREEN
// ============================================================
export const NotificationsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // ============================================================
  // LOAD
  // ============================================================
  const load = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      try {
        const data = await notificationsService.list({ limit: 50 });
        setItems(data);
        setError('');
      } catch (err: any) {
        console.error('Load notifications error:', err);
        setError(err?.message || t('notifications.error'));
      } finally {
        if (showSpinner) setLoading(false);
        setRefreshing(false);
      }
    },
    [t]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
  };

  // ============================================================
  // ACTIONS
  // ============================================================
  const unreadCount = useMemo(
    () => items.filter((n) => !n.read).length,
    [items]
  );

  const handleTap = async (n: AppNotification) => {
    // Mark as read locally first (optimistic)
    if (!n.read) {
      setItems((prev) =>
        prev.map((x) => (x._id === n._id ? { ...x, read: true } : x))
      );
      try {
        await notificationsService.markRead(n._id);
      } catch {
        // ignore
      }
    }
    // Deep-link if provided
    if (n.route) {
      try {
        navigation.navigate(n.route, n.meta || {});
      } catch {
        // Route not registered — ignore
      }
    }
  };

  const handleDismiss = async (n: AppNotification) => {
    setItems((prev) => prev.filter((x) => x._id !== n._id));
    try {
      await notificationsService.dismiss(n._id);
    } catch {
      // silently restore? For now just ignore
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    try {
      await notificationsService.markAllRead();
    } catch {
      // ignore — will re-sync on next refresh
    }
  };

  const handleClearAll = () => {
    if (items.length === 0) return;
    Alert.alert(
      t('notifications.clearAllConfirmTitle'),
      t('notifications.clearAllConfirmMsg'),
      [
        { text: t('notifications.cancel'), style: 'cancel' },
        {
          text: t('notifications.clear'),
          style: 'destructive',
          onPress: async () => {
            setItems([]);
            try {
              await notificationsService.clearAll();
            } catch {
              // ignore
            }
          },
        },
      ]
    );
  };

  // ============================================================
  // SECTIONS
  // ============================================================
  const sections = useMemo(() => {
    const groups: Record<string, AppNotification[]> = {};
    const order: string[] = [];
    const today = t('notifications.today');
    const yesterday = t('notifications.yesterday');
    const thisWeek = t('notifications.thisWeek');
    const older = t('notifications.older');

    items.forEach((n) => {
      const key = sectionKeyFor(n.createdAt, t);
      if (!groups[key]) {
        groups[key] = [];
        order.push(key);
      }
      groups[key].push(n);
    });

    // Ensure stable section order
    const canonicalOrder = [today, yesterday, thisWeek, older];
    const sortedKeys = canonicalOrder.filter((k) => groups[k]);

    return sortedKeys.map((key) => ({
      title: key,
      data: groups[key],
    }));
  }, [items, t]);

  // ============================================================
  // RENDER ITEM
  // ============================================================
  const renderItem = (n: AppNotification) => {
    const style = getNotifStyle(n.type);
    const unread = !n.read;

    return (
      <TouchableOpacity
        key={n._id}
        style={[styles.card, unread && styles.cardUnread]}
        activeOpacity={0.85}
        onPress={() => handleTap(n)}
        onLongPress={() => handleDismiss(n)}
      >
        <View style={[styles.iconWrap, { backgroundColor: style.bg }]}>
          <Ionicons name={style.icon} size={20} color={style.color} />
          {unread && <View style={styles.unreadDot} />}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {n.title}
            </Text>
            <Text style={styles.time}>{timeAgo(n.createdAt, t)}</Text>
          </View>

          {!!n.body && (
            <Text style={styles.body} numberOfLines={2}>
              {n.body}
            </Text>
          )}

          <View style={styles.footerRow}>
            <View style={styles.typePill}>
              <Text style={styles.typePillText}>
                {t(`notifications.types.${n.type}`)}
              </Text>
            </View>
            {!!n.route && (
              <View style={styles.actionPill}>
                <Text style={styles.actionPillText}>
                  {t('notifications.actions.open')}
                </Text>
                <Ionicons name="chevron-forward" size={12} color={COLORS.blue} />
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.dismissBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={(e) => {
            e.stopPropagation?.();
            handleDismiss(n);
          }}
        >
          <Ionicons name="close" size={16} color={COLORS.gray} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // ============================================================
  // LOADING / RENDER
  // ============================================================
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('notifications.subtitle')}
          </Text>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.headerAction}
            onPress={handleMarkAllRead}
          >
            <Ionicons name="checkmark-done" size={16} color={COLORS.primary} />
            <Text style={styles.headerActionText}>
              {t('notifications.markAllRead')}
            </Text>
          </TouchableOpacity>
        )}

        {items.length > 0 && (
          <TouchableOpacity
            style={[styles.headerAction, { marginLeft: 6 }]}
            onPress={handleClearAll}
          >
            <Ionicons name="trash-outline" size={16} color={COLORS.red} />
          </TouchableOpacity>
        )}
      </View>

      {/* LOADING */}
      {loading && items.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('notifications.loading')}
          </Text>
        </View>
      ) : error && items.length === 0 ? (
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => load(true)}
          >
            <Text style={styles.retryBtnText}>
              {t('notifications.retry')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconCircle}>
            <Ionicons
              name="notifications-off-outline"
              size={40}
              color={COLORS.gray}
            />
          </View>
          <Text style={styles.emptyTitle}>
            {t('notifications.empty.title')}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t('notifications.empty.subtitle')}
          </Text>
          <Text style={styles.emptyHint}>
            {t('notifications.empty.hint')}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => renderItem(item)}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>
                {section.title}
              </Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

export default NotificationsScreen;

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // HEADER
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 6,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.slate },
  headerSubtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
  },
  headerActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // LIST
  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },

  // SECTION HEADER
  sectionHeader: {
    paddingTop: 10,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // CARD
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 8,
  },
  cardUnread: {
    borderColor: COLORS.primary,
    backgroundColor: '#FAFDFB',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.red,
    borderWidth: 2,
    borderColor: COLORS.white,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate,
  },
  time: {
    fontSize: 11,
    color: COLORS.gray,
    fontWeight: '600',
  },

  body: {
    fontSize: 12.5,
    color: COLORS.slateMuted,
    marginTop: 4,
    lineHeight: 18,
  },

  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slateMuted,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: COLORS.blueLight,
    borderRadius: 8,
  },
  actionPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.blue,
  },

  dismissBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    marginLeft: 6,
  },

  // LOADING
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.slateMuted,
    fontWeight: '600',
  },

  // ERROR
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.red,
    textAlign: 'center',
    fontWeight: '600',
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // EMPTY
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.slate,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.slateMuted,
    textAlign: 'center',
    marginTop: 6,
  },
  emptyHint: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
});