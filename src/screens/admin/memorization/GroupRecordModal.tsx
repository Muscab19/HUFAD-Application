// src/screens/admin/memorization/GroupRecordModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  COLORS,
  Student,
  SubacGroup,
  Achievement,
  TASHIIH_TOPICS,
  READING_WRITING_TOPICS,
  getMaxAyah,
  getSurahName,
  getTopicLabel,
  api,
} from './_shared';
import {
  SurahPicker,
  CommentBox,
  JuzPicker,
  QuarterPicker,
  FeedbackModal,
  FeedbackTone,
  FeedbackButton,
} from './_shared/pickers';

// ============================================================
// Types
// ============================================================
interface DotWeights {
  fathi: number;
  lahni: number;
  tajwid: number;
  ada: number;
  behavior: number;
}

interface Book {
  _id: string;
  name: string;
  author?: string;
  bookType?: 'pages' | 'lines' | 'verses';
  totalPages?: number;
}

interface GroupRecordModalProps {
  visible: boolean;
  group: SubacGroup | null;
  students: Student[];
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
  branchId?: string;
  tenantId?: string;
  userName?: string;
  /** Optional: pass books in from parent so we don't refetch on every open. */
  books?: Book[];
}

type DotField = keyof DotWeights;

const DOT_FIELDS: DotField[] = ['fathi', 'lahni', 'tajwid', 'ada', 'behavior'];

// ============================================================
// Inline TopicPicker (dropdown)
// ============================================================
interface TopicPickerProps {
  value: string;
  topics: string[];
  mode: 'tashiih' | 'rw';
  onChange: (topic: string) => void;
  disabled?: boolean;
}

const TopicPicker: React.FC<TopicPickerProps> = ({
  value,
  topics,
  mode,
  onChange,
  disabled,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const label = value
    ? getTopicLabel(value, t, mode)
    : t('memorization.select_topic') || 'Select topic';

  return (
    <>
      <TouchableOpacity
        style={[styles.dropdownBtn, disabled && { opacity: 0.5 }]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.dropdownText,
            !value && { color: '#A0AAA5', fontWeight: '600' },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Ionicons name="chevron-down" size={16} color={COLORS.slateMuted} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('memorization.topic') || 'Topic'}
              </Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={topics}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const active = item === value;
                return (
                  <TouchableOpacity
                    style={[styles.modalRow, active && styles.modalRowActive]}
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalRowText,
                        active && styles.modalRowTextActive,
                      ]}
                    >
                      {getTopicLabel(item, t, mode)}
                    </Text>
                    {active && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={COLORS.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

// ============================================================
// Inline BookPicker (dropdown)
// ============================================================
interface BookPickerProps {
  value: string; // bookId
  books: Book[];
  onChange: (bookId: string) => void;
  disabled?: boolean;
}

const BookPicker: React.FC<BookPickerProps> = ({
  value,
  books,
  onChange,
  disabled,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const selected = books.find((b) => b._id === value);
  const label = selected
    ? selected.name
    : t('memorization.select_book') || 'Select book';

  return (
    <>
      <TouchableOpacity
        style={[styles.dropdownBtn, disabled && { opacity: 0.5 }]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.dropdownText,
            !selected && { color: '#A0AAA5', fontWeight: '600' },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Ionicons name="chevron-down" size={16} color={COLORS.slateMuted} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('memorization.select_book') || 'Select book'}
              </Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>
            {books.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {t('memorization.no_books') || 'No books yet'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={books}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => {
                  const active = item._id === value;
                  return (
                    <TouchableOpacity
                      style={[styles.modalRow, active && styles.modalRowActive]}
                      onPress={() => {
                        onChange(item._id);
                        setOpen(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.modalRowText,
                            active && styles.modalRowTextActive,
                          ]}
                        >
                          {item.name}
                        </Text>
                        <Text style={styles.modalRowSub}>
                          {item.author || '—'} ·{' '}
                          {t(`memorization.${item.bookType || 'pages'}`)}
                        </Text>
                      </View>
                      {active && (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={COLORS.primary}
                        />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

// ============================================================
// Component
// ============================================================
export const GroupRecordModal: React.FC<GroupRecordModalProps> = ({
  visible,
  group,
  students,
  defaultDate,
  onClose,
  onSaved,
  branchId,
  tenantId,
  userName,
  books: booksProp,
}) => {
  const { t } = useTranslation();

  const [loadingLast, setLoadingLast] = useState(false);
  const [saving, setSaving] = useState(false);

  // Common
  const [participants, setParticipants] = useState<string[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [totalMarks, setTotalMarks] = useState(100);

  // Subac
  const [weights, setWeights] = useState<DotWeights>({
    fathi: 1,
    lahni: 1,
    tajwid: 1,
    ada: 1,
    behavior: 1,
  });
  const [dots, setDots] = useState<Record<DotField, Record<string, number>>>({
    fathi: {},
    lahni: {},
    tajwid: {},
    ada: {},
    behavior: {},
  });
  const [leader, setLeader] = useState<Record<string, boolean>>({});
  const [externalLeader, setExternalLeader] = useState('');
  const [groupCycle, setGroupCycle] = useState(1);
  const [rangeType, setRangeType] = useState<'surah' | 'juz'>('surah');
  const [fromSurah, setFromSurah] = useState(1);
  const [fromAyah, setFromAyah] = useState(1);
  const [toSurah, setToSurah] = useState(1);
  const [toAyah, setToAyah] = useState(1);
  const [fromJuz, setFromJuz] = useState(1);
  const [fromQuarter, setFromQuarter] = useState(1);
  const [toJuz, setToJuz] = useState(1);
  const [toQuarter, setToQuarter] = useState(8);

  // Tashiih / RW
  const [topics, setTopics] = useState<Record<string, string>>({});
  const [customTopics, setCustomTopics] = useState<Record<string, string>>({});

  // Comment box
  const [commentBox, setCommentBox] = useState<{
    visible: boolean;
    target: string;
    field: 'comments' | 'topicComments';
    initial: string;
  }>({ visible: false, target: '', field: 'comments', initial: '' });
  const [topicComments, setTopicComments] = useState<Record<string, string>>({});

  // Range per member (regular)
  const [fromSurahData, setFromSurahData] = useState<Record<string, number>>({});
  const [fromAyahData, setFromAyahData] = useState<Record<string, number>>({});
  const [toSurahData, setToSurahData] = useState<Record<string, number>>({});
  const [toAyahData, setToAyahData] = useState<Record<string, number>>({});

  // Book review
  const [books, setBooks] = useState<Book[]>(booksProp || []);
  const [bookMode, setBookMode] = useState<'same' | 'different'>('same');
  const [sharedBookId, setSharedBookId] = useState('');
  const [sharedFromPage, setSharedFromPage] = useState(1);
  const [sharedToPage, setSharedToPage] = useState(1);
  const [bookIdData, setBookIdData] = useState<Record<string, string>>({});
  const [fromBookPageData, setFromBookPageData] = useState<
    Record<string, number>
  >({});
  const [toBookPageData, setToBookPageData] = useState<Record<string, number>>(
    {}
  );

  // Last book-review record info (for display)
  const [lastBookInfo, setLastBookInfo] = useState<
    Record<string, { bookName?: string; from?: number; to?: number }>
  >({});
  const [lastSharedBookInfo, setLastSharedBookInfo] = useState<{
    bookName?: string;
    from?: number;
    to?: number;
  } | null>(null);

  // Professional feedback popup
  const [feedback, setFeedback] = useState<{
    visible: boolean;
    tone: FeedbackTone;
    title: string;
    message?: string;
    buttons?: FeedbackButton[];
  }>({ visible: false, tone: 'info', title: '' });

  const notify = (
    tone: FeedbackTone,
    title: string,
    message?: string,
    buttons?: FeedbackButton[]
  ) => setFeedback({ visible: true, tone, title, message, buttons });

  // Load books if not provided
  useEffect(() => {
    if (!visible) return;
    if (booksProp && booksProp.length) {
      setBooks(booksProp);
      return;
    }
    (async () => {
      try {
        const list = await api.getBooks();
        setBooks(Array.isArray(list) ? list : []);
      } catch (e) {
        console.warn('Failed to load books', e);
      }
    })();
  }, [visible, booksProp]);

  // ============================================================
  // INIT
  // ============================================================
  useEffect(() => {
    if (!visible || !group) return;

    // Auto-mark all members as participants
    setParticipants([...group.members]);

    setComments({});
    setTopicComments({});
    setAttempts({});
    setScores({});
    setDots({ fathi: {}, lahni: {}, tajwid: {}, ada: {}, behavior: {} });
    setLeader({});
    setExternalLeader('');
    setGroupCycle(1);
    setTopics({});
    setCustomTopics({});
    setFromSurahData({});
    setFromAyahData({});
    setToSurahData({});
    setToAyahData({});
    setBookIdData({});
    setFromBookPageData({});
    setToBookPageData({});
    setBookMode('same');
    setSharedBookId('');
    setSharedFromPage(1);
    setSharedToPage(1);
    setLastBookInfo({});
    setLastSharedBookInfo(null);

    if (group.type === 'subac') {
      setTotalMarks(100);
      setRangeType(group.lastRange?.rangeType || 'surah');
      setFromSurah(group.lastRange?.fromSurah || 1);
      setFromAyah(group.lastRange?.fromAyah || 1);
      setToSurah(group.lastRange?.toSurah || 1);
      setToAyah(group.lastRange?.toAyah || 1);
      setFromJuz(group.lastRange?.fromJuz || 1);
      setFromQuarter(group.lastRange?.fromQuarter || 1);
      setToJuz(group.lastRange?.toJuz || 1);
      setToQuarter(group.lastRange?.toQuarter || 8);
    } else if (group.type === 'tashiih' || group.type === 'reading_writing') {
      setTotalMarks(10);
    } else if (group.type === 'book_review') {
      setTotalMarks(10);
    } else {
      setTotalMarks(10);
      setAttempts(Object.fromEntries(group.members.map((id) => [id, 1])));
    }

    (async () => {
      setLoadingLast(true);
      try {
        const map = await api.getLastAchievements(group.members);
        const nextFromS: Record<string, number> = {};
        const nextFromA: Record<string, number> = {};
        const nextToS: Record<string, number> = {};
        const nextToA: Record<string, number> = {};
        const nextScores: Record<string, number> = {};
        const nextAttempts: Record<string, number> = {};
        const nextTopics: Record<string, string> = {};
        const nextCustomTopics: Record<string, string> = {};
        const nextBookIds: Record<string, string> = {};
        const nextFromPages: Record<string, number> = {};
        const nextToPages: Record<string, number> = {};
        const nextLastBookInfo: Record<
          string,
          { bookName?: string; from?: number; to?: number }
        > = {};

        group.members.forEach((id) => {
          const last: Achievement | undefined = map[id];
          nextScores[id] = 8;
          nextAttempts[id] = 1;

          const isRegular =
            group.type !== 'subac' &&
            group.type !== 'tashiih' &&
            group.type !== 'reading_writing' &&
            group.type !== 'book_review';

          if (last && isRegular) {
            let nextS = last.toSurah || 1;
            let nextA = (last.toAyah || 1) + 1;
            if (nextA > getMaxAyah(nextS)) {
              nextS = Math.min(114, nextS + 1);
              nextA = 1;
            }
            nextFromS[id] = last.toSurah || 1;
            nextFromA[id] = last.toAyah || 1;
            nextToS[id] = nextS;
            nextToA[id] = nextA;
            if (last.score != null) nextScores[id] = last.score;
            if (last.attempt) nextAttempts[id] = last.attempt + 1;
          } else if (isRegular) {
            nextFromS[id] = 1;
            nextFromA[id] = 1;
            nextToS[id] = 1;
            nextToA[id] = 2;
          }

          if (
            (group.type === 'tashiih' || group.type === 'reading_writing') &&
            last
          ) {
            const predefined =
              group.type === 'tashiih' ? TASHIIH_TOPICS : READING_WRITING_TOPICS;
            const lastTopic = last.topic || '';
            const isPredefined = predefined.includes(lastTopic);
            nextTopics[id] = isPredefined ? lastTopic : lastTopic ? 'Other' : '';
            if (!isPredefined && lastTopic) nextCustomTopics[id] = lastTopic;
            if (last.score != null) nextScores[id] = last.score;
          }

          if (group.type === 'book_review' && last) {
            if (last.bookId) nextBookIds[id] = last.bookId;
            if (last.fromBookPage != null) nextFromPages[id] = last.fromBookPage;
            if (last.toBookPage != null) nextToPages[id] = last.toBookPage;
            if (last.score != null) nextScores[id] = last.score;

            // Display info for the "last record" line
            nextLastBookInfo[id] = {
              bookName: last.bookName,
              from: last.fromBookPage,
              to: last.toBookPage,
            };
          }
        });

        setFromSurahData(nextFromS);
        setFromAyahData(nextFromA);
        setToSurahData(nextToS);
        setToAyahData(nextToA);
        setScores(nextScores);
        setAttempts(nextAttempts);
        setTopics(nextTopics);
        setCustomTopics(nextCustomTopics);
        setBookIdData(nextBookIds);
        setFromBookPageData(nextFromPages);
        setToBookPageData(nextToPages);
        setLastBookInfo(nextLastBookInfo);

        // If all members share the same book name, surface a shared last book
        if (group.type === 'book_review') {
          const names = Object.values(nextLastBookInfo)
            .map((x) => x.bookName)
            .filter(Boolean) as string[];
          const uniqueNames = Array.from(new Set(names));
          if (uniqueNames.length === 1 && names.length > 0) {
            const first = Object.values(nextLastBookInfo)[0];
            setLastSharedBookInfo({
              bookName: uniqueNames[0],
              from: first?.from,
              to: first?.to,
            });
            // Pre-select the shared book by matching name
            const matchedBook = (booksProp || books).find(
              (b) => b.name === uniqueNames[0]
            );
            if (matchedBook) {
              setBookMode('same');
              setSharedBookId(matchedBook._id);
              if (first?.from != null) setSharedFromPage(first.from);
              if (first?.to != null) setSharedToPage(first.to);
            }
          }
        }
      } catch (e) {
        console.warn('Load last achievements failed', e);
      } finally {
        setLoadingLast(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, group]);

  // ============================================================
  // Helpers
  // ============================================================
  const topicList = useMemo(
    () =>
      group?.type === 'reading_writing'
        ? READING_WRITING_TOPICS
        : TASHIIH_TOPICS,
    [group?.type]
  );

  const memberName = (id: string) =>
    students.find((s) => s._id === id)?.name || 'Unknown';

  const calcSubacScore = (id: string) => {
    const f = (dots.fathi[id] || 0) * weights.fathi;
    const l = (dots.lahni[id] || 0) * weights.lahni;
    const tj = (dots.tajwid[id] || 0) * weights.tajwid;
    const a = (dots.ada[id] || 0) * weights.ada;
    const b = (dots.behavior[id] || 0) * weights.behavior;
    const deduction = f + l + tj + a + b;
    return Math.max(0, Math.min(totalMarks, totalMarks - deduction));
  };

  const addDot = (id: string, field: DotField) => {
    setDots((prev) => ({
      ...prev,
      [field]: { ...prev[field], [id]: (prev[field][id] || 0) + 1 },
    }));
  };
  const removeDot = (id: string, field: DotField) => {
    setDots((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [id]: Math.max(0, (prev[field][id] || 0) - 1),
      },
    }));
  };

  const toggleLeader = (id: string) => {
    setLeader((prev) => {
      const isCurrently = prev[id];
      const next: Record<string, boolean> = {};
      group?.members.forEach((mid) => {
        next[mid] = !isCurrently ? mid === id : mid === id ? false : !!prev[mid];
      });
      return next;
    });
  };

  const toggleParticipant = (id: string) => {
    setParticipants((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (!group) return;
    if (participants.length === group.members.length) setParticipants([]);
    else setParticipants([...group.members]);
  };

  const getBookById = (id: string) => books.find((b) => b._id === id);
  const getBookUnit = (bookId: string): 'pages' | 'lines' | 'verses' => {
    const b = getBookById(bookId);
    return b?.bookType || 'pages';
  };
  const getBookUnitLabel = (bookId: string) => {
    const unit = getBookUnit(bookId);
    return t(`memorization.${unit}`) || unit;
  };

  // ============================================================
  // Save
  // ============================================================
  const handleSave = async () => {
    if (!group) return;
    if (!participants.length) {
      notify('warning', t('memorization.select_participants'));
      return;
    }
    if (!branchId) {
      notify('warning', t('memorization.select_branch_first'));
      return;
    }
    if (
      group.type === 'book_review' &&
      bookMode === 'same' &&
      !sharedBookId
    ) {
      notify(
        'warning',
        t('memorization.select_book') || 'Select book',
        t('memorization.please_select_shared_book') ||
          'Please select the shared book.'
      );
      return;
    }

    setSaving(true);
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const savedAt = new Date().toISOString();

    let saved = 0;
    let errors = 0;

    try {
      for (const id of participants) {
        const student = students.find((s) => s._id === id);
        if (!student) continue;

        const isSubac = group.type === 'subac';
        const isTashiih = group.type === 'tashiih';
        const isRW = group.type === 'reading_writing';
        const isBookReview = group.type === 'book_review';

        let score: number;
        if (isSubac) score = calcSubacScore(id);
        else score = scores[id] ?? 8;

        const payload: any = {
          studentId: id,
          studentName: student.name,
          halaqahId:
            typeof student.halaqah === 'object'
              ? student.halaqah?._id
              : student.halaqah,
          halaqahName:
            typeof student.halaqah === 'object'
              ? student.halaqah?.name
              : student.halaqahName,
          date: defaultDate,
          type: group.type,
          score,
          comment: comments[id] || '',
          teacher: userName || 'Unknown',
          isBulk: true,
          groupId: group.id,
          groupName: group.name,
          totalMarks: isSubac ? totalMarks : 10,
          batchId,
          savedAt,
          branchId,
          ...(tenantId ? { tenantId } : {}),
        };

        if (isSubac) {
          Object.assign(payload, {
            rangeType,
            ...(rangeType === 'surah'
              ? { fromSurah, fromAyah, toSurah, toAyah }
              : { fromJuz, fromQuarter, toJuz, toQuarter }),
            fathi: Array.from({ length: dots.fathi[id] || 0 }),
            lahni: Array.from({ length: dots.lahni[id] || 0 }),
            tajwid: Array.from({ length: dots.tajwid[id] || 0 }),
            ada: Array.from({ length: dots.ada[id] || 0 }),
            behavior: Array.from({ length: dots.behavior[id] || 0 }),
            cycle: groupCycle,
            leader: !!leader[id],
            externalLeader,
          });
        } else if (isTashiih || isRW) {
          let topic = topics[id] || '';
          if (topic === 'Other') topic = customTopics[id] || 'Other';
          payload.topic = topic;
          if (isRW) {
            payload.comment = topicComments[id] || '';
            payload.rwNote = '';
          } else {
            payload.topicComment = topicComments[id] || '';
          }
        } else if (isBookReview) {
          const bid =
            bookMode === 'same' ? sharedBookId : bookIdData[id] || '';
          const book = getBookById(bid);
          payload.bookId = bid;
          payload.bookName = book?.name || '';
          payload.bookType = book?.bookType || 'pages';
          payload.fromBookPage =
            bookMode === 'same' ? sharedFromPage : fromBookPageData[id] || 1;
          payload.toBookPage =
            bookMode === 'same' ? sharedToPage : toBookPageData[id] || 1;
        } else {
          // Regular (memorization, minor_review, major_review, ijazah)
          payload.rangeType = 'surah';
          payload.fromSurah = fromSurahData[id] || 1;
          payload.fromAyah = fromAyahData[id] || 1;
          payload.toSurah = toSurahData[id] || 1;
          payload.toAyah = toAyahData[id] || 1;
          payload.attempt = attempts[id] || 1;
        }

        try {
          await api.createAchievement(payload);
          saved++;
        } catch (e) {
          console.error('Save achievement failed', e);
          errors++;
        }
      }

      if (errors > 0) {
        notify(
          'warning',
          t('memorization.partial_save') || 'Partially saved',
          `${saved} ${t('memorization.saved')}, ${errors} ${t('memorization.failed')}`,
          [
            {
              text: t('memorization.ok') || 'OK',
              onPress: () => {
                onSaved();
                onClose();
              },
            },
          ]
        );
      } else {
        notify(
          'success',
          t('memorization.saved') || 'Saved',
          `${saved} ${t('memorization.records_saved') || 'records saved'}`,
          [
            {
              text: t('memorization.ok') || 'OK',
              onPress: () => {
                onSaved();
                onClose();
              },
            },
          ]
        );
      }
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================
  if (!group) return null;

  const isSubac = group.type === 'subac';
  const isTashiih = group.type === 'tashiih';
  const isRW = group.type === 'reading_writing';
  const isBookReview = group.type === 'book_review';
  const isRegular = !isSubac && !isTashiih && !isRW && !isBookReview;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {group.name}
              </Text>
              <Text style={styles.subtitle}>
                {t(`memorization.types.${group.type}`)} ·{' '}
                {group.members.length} {t('memorization.members')}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          {loadingLast ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: '78%' }}
              contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {/* ============================================================
                  SHARED SUBAC SETTINGS
              ============================================================ */}
              {isSubac && (
                <View style={styles.sharedCard}>
                  <View style={styles.sharedHeader}>
                    <View style={styles.sharedHeaderIcon}>
                      <Ionicons
                        name="options-outline"
                        size={16}
                        color={COLORS.primary}
                      />
                    </View>
                    <Text style={styles.sharedTitle}>
                      {t('memorization.shared_settings')}
                    </Text>
                  </View>

                  {/* Range Type segmented */}
                  <Text style={styles.blockLabel}>
                    {t('memorization.range_type')}
                  </Text>
                  <View style={styles.segmentRow}>
                    {(['surah', 'juz'] as const).map((rt) => {
                      const active = rangeType === rt;
                      return (
                        <TouchableOpacity
                          key={rt}
                          style={[styles.segment, active && styles.segmentActive]}
                          onPress={() => setRangeType(rt)}
                          activeOpacity={0.85}
                        >
                          <Ionicons
                            name={
                              rt === 'surah' ? 'book-outline' : 'layers-outline'
                            }
                            size={15}
                            color={active ? '#fff' : COLORS.slateMuted}
                          />
                          <Text
                            style={[
                              styles.segmentText,
                              active && styles.segmentTextActive,
                            ]}
                          >
                            {rt === 'surah'
                              ? t('memorization.surah')
                              : t('memorization.juz')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* SURAH MODE */}
                  {rangeType === 'surah' && (
                    <View style={styles.rangeBlock}>
                      <View style={styles.compactRow}>
                        <View style={[styles.rangeBadge, styles.rangeBadgeStart]}>
                          <Ionicons name="play" size={11} color={COLORS.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.compactLabel}>
                            {t('memorization.from_surah')}
                          </Text>
                          <View style={styles.compactInputs}>
                            <View style={{ flex: 1 }}>
                              <SurahPicker
                                value={fromSurah}
                                onChange={setFromSurah}
                                label=""
                                compact
                              />
                            </View>
                            <View style={styles.ayahBox}>
                              <Text style={styles.ayahBoxLabel}>
                                {t('memorization.modal.ayahLabel')}
                              </Text>
                              <TextInput
                                style={styles.ayahInput}
                                value={String(fromAyah)}
                                onChangeText={(v) =>
                                  setFromAyah(
                                    Math.max(
                                      1,
                                      Math.min(
                                        getMaxAyah(fromSurah),
                                        parseInt(v, 10) || 1
                                      )
                                    )
                                  )
                                }
                                keyboardType="numeric"
                              />
                            </View>
                          </View>
                        </View>
                      </View>

                      <View style={styles.rangeDivider} />

                      <View style={styles.compactRow}>
                        <View style={[styles.rangeBadge, styles.rangeBadgeEnd]}>
                          <Ionicons name="flag" size={11} color={COLORS.teal} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.compactLabel}>
                            {t('memorization.to_surah')}
                          </Text>
                          <View style={styles.compactInputs}>
                            <View style={{ flex: 1 }}>
                              <SurahPicker
                                value={toSurah}
                                onChange={setToSurah}
                                label=""
                                compact
                              />
                            </View>
                            <View style={styles.ayahBox}>
                              <Text style={styles.ayahBoxLabel}>
                                {t('memorization.modal.ayahLabel')}
                              </Text>
                              <TextInput
                                style={styles.ayahInput}
                                value={String(toAyah)}
                                onChangeText={(v) =>
                                  setToAyah(
                                    Math.max(
                                      1,
                                      Math.min(
                                        getMaxAyah(toSurah),
                                        parseInt(v, 10) || 1
                                      )
                                    )
                                  )
                                }
                                keyboardType="numeric"
                              />
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* JUZ MODE */}
                  {rangeType === 'juz' && (
                    <View style={styles.rangeBlock}>
                      <View style={styles.compactRow}>
                        <View style={[styles.rangeBadge, styles.rangeBadgeStart]}>
                          <Ionicons name="play" size={11} color={COLORS.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.compactLabel}>
                            {t('memorization.from_juz')}
                          </Text>
                          <View style={styles.juzRangeStack}>
                            <JuzPicker
                              value={fromJuz}
                              onChange={setFromJuz}
                              label=""
                            />
                            <QuarterPicker
                              value={fromQuarter}
                              onChange={setFromQuarter}
                              compact
                              hideLabel={false}
                            />
                          </View>
                        </View>
                      </View>

                      <View style={styles.rangeDivider} />

                      <View style={styles.compactRow}>
                        <View style={[styles.rangeBadge, styles.rangeBadgeEnd]}>
                          <Ionicons name="flag" size={11} color={COLORS.teal} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.compactLabel}>
                            {t('memorization.to_juz')}
                          </Text>
                          <View style={styles.juzRangeStack}>
                            <JuzPicker
                              value={toJuz}
                              onChange={setToJuz}
                              label=""
                            />
                            <QuarterPicker
                              value={toQuarter}
                              onChange={setToQuarter}
                              compact
                              hideLabel={false}
                            />
                          </View>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Total Marks + Cycle */}
                  <View style={styles.twoCol}>
                    <View style={styles.fieldGroup}>
                      <View style={styles.fieldHeader}>
                        <Ionicons
                          name="ribbon-outline"
                          size={13}
                          color={COLORS.slateMuted}
                        />
                        <Text style={styles.miniLabel}>
                          {t('memorization.total_marks')}
                        </Text>
                      </View>
                      <View style={styles.stepper}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => setTotalMarks((m) => Math.max(1, m - 1))}
                        >
                          <Ionicons
                            name="remove"
                            size={16}
                            color={COLORS.slate}
                          />
                        </TouchableOpacity>
                        <View style={styles.stepValueWrap}>
                          <Text style={styles.stepValue}>{totalMarks}</Text>
                          <Text style={styles.stepSub}>/ 100</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() =>
                            setTotalMarks((m) => Math.min(100, m + 1))
                          }
                        >
                          <Ionicons name="add" size={16} color={COLORS.slate} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.fieldGroup}>
                      <View style={styles.fieldHeader}>
                        <Ionicons
                          name="repeat-outline"
                          size={13}
                          color={COLORS.slateMuted}
                        />
                        <Text style={styles.miniLabel}>
                          {t('memorization.cycle')}
                        </Text>
                      </View>
                      <View style={styles.stepper}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => setGroupCycle((c) => Math.max(1, c - 1))}
                        >
                          <Ionicons
                            name="remove"
                            size={16}
                            color={COLORS.slate}
                          />
                        </TouchableOpacity>
                        <View style={styles.stepValueWrap}>
                          <Text style={styles.stepValue}>{groupCycle}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => setGroupCycle((c) => c + 1)}
                        >
                          <Ionicons name="add" size={16} color={COLORS.slate} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* External Leader */}
                  <View style={styles.fieldGroup}>
                    <View style={styles.fieldHeader}>
                      <Ionicons
                        name="person-outline"
                        size={13}
                        color={COLORS.slateMuted}
                      />
                      <Text style={styles.miniLabel}>
                        {t('memorization.external_leader')}
                      </Text>
                    </View>
                    <View style={styles.inputWithIcon}>
                      <Ionicons
                        name="person-circle-outline"
                        size={18}
                        color={COLORS.slateMuted}
                      />
                      <TextInput
                        style={styles.inputFlex}
                        value={externalLeader}
                        onChangeText={setExternalLeader}
                        placeholder={t('memorization.enter_leader_name')}
                        placeholderTextColor="#A0AAA5"
                      />
                      {externalLeader.length > 0 && (
                        <TouchableOpacity onPress={() => setExternalLeader('')}>
                          <Ionicons
                            name="close-circle"
                            size={16}
                            color={COLORS.slateMuted}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Weights */}
                  <View style={styles.fieldGroup}>
                    <View style={styles.fieldHeader}>
                      <Ionicons
                        name="scale-outline"
                        size={13}
                        color={COLORS.slateMuted}
                      />
                      <Text style={styles.miniLabel}>
                        {t('memorization.weight_per_dot')}
                      </Text>
                    </View>
                    <View style={styles.weightGrid}>
                      {DOT_FIELDS.map((f) => (
                        <View key={f} style={styles.weightItem}>
                          <Text style={styles.weightLabel}>
                            {t(`memorization.${f}`)}
                          </Text>
                          <TextInput
                            style={styles.weightInput}
                            value={String(weights[f])}
                            onChangeText={(v) =>
                              setWeights((p) => ({
                                ...p,
                                [f]: parseFloat(v) || 0,
                              }))
                            }
                            keyboardType="numeric"
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {/* ============================================================
                  SHARED BOOK REVIEW SETTINGS (Change 1 + 2)
              ============================================================ */}
              {isBookReview && (
                <View style={styles.sharedCard}>
                  <View style={styles.sharedHeader}>
                    <View style={styles.sharedHeaderIcon}>
                      <Ionicons
                        name="library-outline"
                        size={16}
                        color={COLORS.primary}
                      />
                    </View>
                    <Text style={styles.sharedTitle}>
                      {t('memorization.book_review_settings') ||
                        'Book Review Settings'}
                    </Text>
                  </View>

                  {/* Mode toggle: same vs different */}
                  <Text style={styles.blockLabel}>
                    {t('memorization.book_mode') || 'Book Selection'}
                  </Text>
                  <View style={styles.segmentRow}>
                    {(['same', 'different'] as const).map((m) => {
                      const active = bookMode === m;
                      return (
                        <TouchableOpacity
                          key={m}
                          style={[styles.segment, active && styles.segmentActive]}
                          onPress={() => setBookMode(m)}
                          activeOpacity={0.85}
                        >
                          <Ionicons
                            name={
                              m === 'same'
                                ? 'copy-outline'
                                : 'git-branch-outline'
                            }
                            size={15}
                            color={active ? '#fff' : COLORS.slateMuted}
                          />
                          <Text
                            style={[
                              styles.segmentText,
                              active && styles.segmentTextActive,
                            ]}
                          >
                            {m === 'same'
                              ? t('memorization.same_book') || 'Same Book'
                              : t('memorization.different_books') ||
                                'Different Books'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {bookMode === 'same' && (
                    <View style={styles.rangeBlock}>
                      {lastSharedBookInfo?.bookName ? (
                        <View style={styles.lastRecordLine}>
                          <Ionicons
                            name="time-outline"
                            size={12}
                            color={COLORS.slateMuted}
                          />
                          <Text
                            style={styles.lastRecordText}
                            numberOfLines={1}
                          >
                            {t('memorization.last') || 'Last'}:{' '}
                            {lastSharedBookInfo.bookName}
                            {lastSharedBookInfo.from != null
                              ? ` (${lastSharedBookInfo.from}-${
                                  lastSharedBookInfo.to ?? ''
                                })`
                              : ''}
                          </Text>
                        </View>
                      ) : null}

                      <Text style={styles.compactLabel}>
                        {t('memorization.book') || 'Book'}
                      </Text>
                      <BookPicker
                        value={sharedBookId}
                        books={books}
                        onChange={setSharedBookId}
                      />

                      {sharedBookId ? (
                        <View style={styles.compactInputs}>
                          <View style={styles.bookRangeField}>
                            <Text style={styles.rangeDisplayLabel}>
                              {t('memorization.from') || 'From'}
                            </Text>
                            <TextInput
                              style={styles.bookRangeInput}
                              value={String(sharedFromPage)}
                              onChangeText={(v) =>
                                setSharedFromPage(
                                  Math.max(1, parseInt(v, 10) || 1)
                                )
                              }
                              keyboardType="numeric"
                              placeholder={getBookUnitLabel(sharedBookId)}
                              placeholderTextColor="#A0AAA5"
                            />
                          </View>
                          <View style={styles.bookRangeField}>
                            <Text style={styles.rangeDisplayLabel}>
                              {t('memorization.to') || 'To'}
                            </Text>
                            <TextInput
                              style={styles.bookRangeInput}
                              value={String(sharedToPage)}
                              onChangeText={(v) =>
                                setSharedToPage(
                                  Math.max(1, parseInt(v, 10) || 1)
                                )
                              }
                              keyboardType="numeric"
                              placeholder={getBookUnitLabel(sharedBookId)}
                              placeholderTextColor="#A0AAA5"
                            />
                          </View>
                        </View>
                      ) : (
                        <Text style={styles.helperText}>
                          {t('memorization.select_book_to_see_range') ||
                            'Select a book to enter the range'}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* ============================================================
                  MEMBERS HEADER
              ============================================================ */}
              <View style={styles.membersHeader}>
                <Text style={styles.membersTitle}>
                  {t('memorization.members')} ({participants.length}/
                  {group.members.length})
                </Text>
                <TouchableOpacity onPress={selectAll} style={styles.selectAllBtn}>
                  <Ionicons
                    name={
                      participants.length === group.members.length
                        ? 'checkbox'
                        : 'square-outline'
                    }
                    size={16}
                    color={COLORS.primary}
                  />
                  <Text style={styles.selectAllText}>
                    {participants.length === group.members.length
                      ? t('memorization.clear_all')
                      : t('memorization.select_all')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ============================================================
                  MEMBER CARDS
              ============================================================ */}
              {group.members.map((id, idx) => {
                const isP = participants.includes(id);
                const subacScore = isSubac ? calcSubacScore(id) : 0;
                const score = isSubac ? subacScore : scores[id] ?? 8;
                const hasComment =
                  (comments[id] || '').length > 0 ||
                  (topicComments[id] || '').length > 0;

                return (
                  <View
                    key={id}
                    style={[
                      styles.memberCard,
                      isP ? styles.memberCardActive : styles.memberCardInactive,
                    ]}
                  >
                    <View style={styles.memberCardHeader}>
                      <TouchableOpacity
                        onPress={() => toggleParticipant(id)}
                        style={[styles.checkbox, isP && styles.checkboxActive]}
                      >
                        {isP && (
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        )}
                      </TouchableOpacity>

                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text
                          style={[
                            styles.memberName,
                            !isP && { color: '#9CA3AF' },
                          ]}
                          numberOfLines={1}
                        >
                          {idx + 1}. {memberName(id)}
                        </Text>
                      </View>

                      {isSubac && (
                        <TouchableOpacity
                          style={styles.leaderBtn}
                          onPress={() => toggleLeader(id)}
                          disabled={!isP}
                        >
                          <Ionicons
                            name={leader[id] ? 'star' : 'star-outline'}
                            size={20}
                            color={leader[id] ? COLORS.gold : COLORS.gray}
                          />
                        </TouchableOpacity>
                      )}

                      <View
                        style={[
                          styles.scoreBadge,
                          isP && styles.scoreBadgeActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.scoreBadgeText,
                            isP && styles.scoreBadgeTextActive,
                          ]}
                        >
                          {score}
                          <Text style={styles.scoreBadgeMax}>
                            /{isSubac ? totalMarks : 10}
                          </Text>
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.commentBtn,
                          hasComment && styles.commentBtnActive,
                        ]}
                        onPress={() => {
                          if (!isP) return;
                          const field =
                            isTashiih || isRW ? 'topicComments' : 'comments';
                          const initial =
                            field === 'topicComments'
                              ? topicComments[id] || ''
                              : comments[id] || '';
                          setCommentBox({
                            visible: true,
                            target: id,
                            field,
                            initial,
                          });
                        }}
                        disabled={!isP}
                      >
                        <Ionicons
                          name={
                            hasComment
                              ? 'chatbox-ellipses'
                              : 'chatbox-outline'
                          }
                          size={16}
                          color={hasComment ? COLORS.gold : COLORS.blue}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* ============ REGULAR MEMBER BODY ============ */}
                    {isRegular && (
                      <View style={styles.memberBody}>
                        {/* FROM */}
                        <View>
                          <Text style={styles.bodyLabel}>
                            {t('memorization.from_surah')}
                          </Text>
                          <View style={styles.compactInputs}>
                            <View style={{ flex: 1 }}>
                              <SurahPicker
                                value={fromSurahData[id] ?? 1}
                                onChange={(s) => {
                                  setFromSurahData((p) => ({ ...p, [id]: s }));
                                  setFromAyahData((p) => {
                                    const cur = p[id] ?? 1;
                                    const max = getMaxAyah(s);
                                    return {
                                      ...p,
                                      [id]: Math.max(1, Math.min(max, cur)),
                                    };
                                  });
                                }}
                                label=""
                                compact
                              />
                            </View>
                            <View style={styles.ayahBox}>
                              <Text style={styles.ayahBoxLabel}>
                                {t('memorization.modal.ayahLabel')}
                              </Text>
                              <TextInput
                                style={styles.ayahInput}
                                value={String(fromAyahData[id] ?? 1)}
                                onChangeText={(v) => {
                                  const s = fromSurahData[id] ?? 1;
                                  setFromAyahData((p) => ({
                                    ...p,
                                    [id]: Math.max(
                                      1,
                                      Math.min(
                                        getMaxAyah(s),
                                        parseInt(v, 10) || 1
                                      )
                                    ),
                                  }));
                                }}
                                keyboardType="numeric"
                                editable={isP}
                              />
                            </View>
                          </View>
                        </View>

                        {/* TO */}
                        <View>
                          <Text style={styles.bodyLabel}>
                            {t('memorization.to_surah')}
                          </Text>
                          <View style={styles.compactInputs}>
                            <View style={{ flex: 1 }}>
                              <SurahPicker
                                value={toSurahData[id] ?? 1}
                                onChange={(s) => {
                                  setToSurahData((p) => ({ ...p, [id]: s }));
                                  setToAyahData((p) => {
                                    const cur = p[id] ?? 1;
                                    const max = getMaxAyah(s);
                                    return {
                                      ...p,
                                      [id]: Math.max(1, Math.min(max, cur)),
                                    };
                                  });
                                }}
                                label=""
                                compact
                              />
                            </View>
                            <View style={styles.ayahBox}>
                              <Text style={styles.ayahBoxLabel}>
                                {t('memorization.modal.ayahLabel')}
                              </Text>
                              <TextInput
                                style={styles.ayahInput}
                                value={String(toAyahData[id] ?? 1)}
                                onChangeText={(v) => {
                                  const s = toSurahData[id] ?? 1;
                                  setToAyahData((p) => ({
                                    ...p,
                                    [id]: Math.max(
                                      1,
                                      Math.min(
                                        getMaxAyah(s),
                                        parseInt(v, 10) || 1
                                      )
                                    ),
                                  }));
                                }}
                                keyboardType="numeric"
                                editable={isP}
                              />
                            </View>
                          </View>
                        </View>

                        {/* Attempt + Score */}
                        <View style={styles.inlineRow}>
                          <Text style={styles.inlineLabel}>
                            {t('memorization.attempt')}
                          </Text>
                          <View style={styles.stepperSmall}>
                            <TouchableOpacity
                              style={styles.stepBtnSmall}
                              onPress={() =>
                                setAttempts((p) => ({
                                  ...p,
                                  [id]: Math.max(1, (p[id] || 1) - 1),
                                }))
                              }
                              disabled={!isP}
                            >
                              <Ionicons
                                name="remove"
                                size={14}
                                color={COLORS.slate}
                              />
                            </TouchableOpacity>
                            <Text style={styles.stepValueSmall}>
                              {attempts[id] || 1}
                            </Text>
                            <TouchableOpacity
                              style={styles.stepBtnSmall}
                              onPress={() =>
                                setAttempts((p) => ({
                                  ...p,
                                  [id]: (p[id] || 1) + 1,
                                }))
                              }
                              disabled={!isP}
                            >
                              <Ionicons
                                name="add"
                                size={14}
                                color={COLORS.slate}
                              />
                            </TouchableOpacity>
                          </View>

                          <Text style={[styles.inlineLabel, { marginLeft: 16 }]}>
                            {t('memorization.score')}
                          </Text>
                          <TextInput
                            style={styles.scoreInput}
                            value={String(scores[id] ?? 8)}
                            onChangeText={(v) =>
                              setScores((p) => ({
                                ...p,
                                [id]: Math.max(
                                  0,
                                  Math.min(10, parseInt(v, 10) || 0)
                                ),
                              }))
                            }
                            keyboardType="numeric"
                            editable={isP}
                          />
                        </View>
                      </View>
                    )}

                    {/* ============ TASHIIH / RW BODY ============ */}
                    {(isTashiih || isRW) && (
                      <View style={styles.memberBody}>
                        <Text style={styles.bodyLabel}>
                          {t('memorization.topic')}
                        </Text>

                        <TopicPicker
                          value={topics[id] || ''}
                          topics={topicList}
                          mode={isRW ? 'rw' : 'tashiih'}
                          onChange={(tp) =>
                            setTopics((p) => ({ ...p, [id]: tp }))
                          }
                          disabled={!isP}
                        />

                        {topics[id] === 'Other' && (
                          <TextInput
                            style={styles.smallInput}
                            value={customTopics[id] || ''}
                            onChangeText={(v) =>
                              setCustomTopics((p) => ({ ...p, [id]: v }))
                            }
                            placeholder={t('memorization.enter_custom_topic')}
                            placeholderTextColor="#A0AAA5"
                            editable={isP}
                          />
                        )}

                        <View style={styles.inlineRow}>
                          <Text style={styles.inlineLabel}>
                            {t('memorization.score')}
                          </Text>
                          <TextInput
                            style={styles.scoreInput}
                            value={String(scores[id] ?? 8)}
                            onChangeText={(v) =>
                              setScores((p) => ({
                                ...p,
                                [id]: Math.max(
                                  0,
                                  Math.min(10, parseInt(v, 10) || 0)
                                ),
                              }))
                            }
                            keyboardType="numeric"
                            editable={isP}
                          />
                        </View>
                      </View>
                    )}

                    {/* ============ BOOK REVIEW BODY (Change 1 + 2) ============ */}
                    {isBookReview && (
                      <View style={styles.memberBody}>
                        {bookMode === 'different' ? (
                          <>
                            <Text style={styles.bodyLabel}>
                              {t('memorization.book') || 'Book'}
                            </Text>
                            <BookPicker
                              value={bookIdData[id] || ''}
                              books={books}
                              onChange={(bid) =>
                                setBookIdData((p) => ({ ...p, [id]: bid }))
                              }
                              disabled={!isP}
                            />

                            {bookIdData[id] ? (
                              <View style={styles.compactInputs}>
                                <View style={styles.bookRangeField}>
                                  <Text style={styles.rangeDisplayLabel}>
                                    {t('memorization.from') || 'From'}
                                  </Text>
                                  <TextInput
                                    style={styles.bookRangeInput}
                                    value={String(fromBookPageData[id] ?? 1)}
                                    onChangeText={(v) =>
                                      setFromBookPageData((p) => ({
                                        ...p,
                                        [id]: Math.max(
                                          1,
                                          parseInt(v, 10) || 1
                                        ),
                                      }))
                                    }
                                    keyboardType="numeric"
                                    editable={isP}
                                    placeholder={getBookUnitLabel(
                                      bookIdData[id]
                                    )}
                                    placeholderTextColor="#A0AAA5"
                                  />
                                </View>

                                <View style={styles.bookRangeField}>
                                  <Text style={styles.rangeDisplayLabel}>
                                    {t('memorization.to') || 'To'}
                                  </Text>
                                  <TextInput
                                    style={styles.bookRangeInput}
                                    value={String(toBookPageData[id] ?? 1)}
                                    onChangeText={(v) =>
                                      setToBookPageData((p) => ({
                                        ...p,
                                        [id]: Math.max(
                                          1,
                                          parseInt(v, 10) || 1
                                        ),
                                      }))
                                    }
                                    keyboardType="numeric"
                                    editable={isP}
                                    placeholder={getBookUnitLabel(
                                      bookIdData[id]
                                    )}
                                    placeholderTextColor="#A0AAA5"
                                  />
                                </View>
                              </View>
                            ) : (
                              <Text style={styles.helperText}>
                                {t('memorization.select_book_to_see_range') ||
                                  'Select a book to enter the range'}
                              </Text>
                            )}
                          </>
                        ) : lastBookInfo[id]?.bookName ? (
                          // SAME BOOK: show last record line
                          <View style={styles.lastRecordLine}>
                            <Ionicons
                              name="time-outline"
                              size={12}
                              color={COLORS.slateMuted}
                            />
                            <Text
                              style={styles.lastRecordText}
                              numberOfLines={1}
                            >
                              {t('memorization.last') || 'Last'}:{' '}
                              {lastBookInfo[id].bookName}
                              {lastBookInfo[id].from != null
                                ? ` (${lastBookInfo[id].from}-${
                                    lastBookInfo[id].to ?? ''
                                  })`
                                : ''}
                            </Text>
                          </View>
                        ) : (
                          <Text style={styles.helperText}>
                            {t('memorization.uses_shared_book') ||
                              'Uses the shared book & range above'}
                          </Text>
                        )}

                        <View style={styles.inlineRow}>
                          <Text style={styles.inlineLabel}>
                            {t('memorization.score')}
                          </Text>
                          <TextInput
                            style={styles.scoreInput}
                            value={String(scores[id] ?? 8)}
                            onChangeText={(v) =>
                              setScores((p) => ({
                                ...p,
                                [id]: Math.max(
                                  0,
                                  Math.min(10, parseInt(v, 10) || 0)
                                ),
                              }))
                            }
                            keyboardType="numeric"
                            editable={isP}
                          />
                        </View>
                      </View>
                    )}

                    {/* ============ SUBAC BODY ============ */}
                    {isSubac && (
                      <View style={styles.memberBody}>
                        <View style={styles.dotsGrid}>
                          {DOT_FIELDS.map((f) => (
                            <View key={f} style={styles.dotItem}>
                              <Text style={styles.dotLabel}>
                                {t(`memorization.${f}`)}
                              </Text>
                              <View style={styles.dotControl}>
                                <TouchableOpacity
                                  style={styles.dotBtn}
                                  onPress={() => addDot(id, f)}
                                  disabled={!isP}
                                >
                                  <Ionicons
                                    name="add"
                                    size={14}
                                    color={COLORS.slate}
                                  />
                                </TouchableOpacity>
                                <View style={styles.dotValueWrap}>
                                  <Text style={styles.dotValue}>
                                    {dots[f][id] || 0}
                                  </Text>
                                </View>
                                <TouchableOpacity
                                  style={styles.dotBtn}
                                  onPress={() => removeDot(id, f)}
                                  disabled={!isP}
                                >
                                  <Ionicons
                                    name="remove"
                                    size={14}
                                    color={COLORS.slate}
                                  />
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {hasComment && (
                      <View style={styles.commentPreview}>
                        <Ionicons
                          name="chatbox-ellipses"
                          size={12}
                          color={COLORS.gold}
                        />
                        <Text
                          style={styles.commentPreviewText}
                          numberOfLines={2}
                        >
                          {isTashiih || isRW
                            ? topicComments[id] || comments[id]
                            : comments[id]}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.cancelText}>{t('memorization.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.saveText}>
                    {t('memorization.record_achievement')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <CommentBox
            visible={commentBox.visible}
            initial={commentBox.initial}
            onClose={() => setCommentBox((p) => ({ ...p, visible: false }))}
            onSave={(text) => {
              if (commentBox.field === 'topicComments') {
                setTopicComments((p) => ({ ...p, [commentBox.target]: text }));
              } else {
                setComments((p) => ({ ...p, [commentBox.target]: text }));
              }
            }}
          />

          {/* Professional feedback popup (replaces Alert.alert) */}
          <FeedbackModal
            visible={feedback.visible}
            tone={feedback.tone}
            title={feedback.title}
            message={feedback.message}
            buttons={feedback.buttons}
            onClose={() => setFeedback((p) => ({ ...p, visible: false }))}
          />
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '96%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
    backgroundColor: COLORS.white,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.slate },
  subtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 3 },

  // Shared settings card
  sharedCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
  },
  sharedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sharedHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  blockLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Segment
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  segmentActive: { backgroundColor: COLORS.primary },
  segmentText: { fontSize: 13, fontWeight: '700', color: COLORS.slateMuted },
  segmentTextActive: { color: '#fff' },

  // Range block
  rangeBlock: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  rangeDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 2,
  },
  compactRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  rangeBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  rangeBadgeStart: { backgroundColor: COLORS.primaryLight + '33' },
  rangeBadgeEnd: { backgroundColor: COLORS.tealLight + '66' },
  compactLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  compactInputs: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },

  // Ayah box
  ayahBox: {
    width: 68,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: COLORS.background,
  },
  ayahBoxLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 2,
  },
  ayahInput: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.slate,
    textAlign: 'center',
    padding: 0,
  },

  juzRangeStack: {
    gap: 8,
  },

  // Field group
  twoCol: { flexDirection: 'row', gap: 12 },
  fieldGroup: { flex: 1, gap: 6 },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  miniLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Stepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
  },
  stepBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValueWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  stepValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.slate,
    lineHeight: 18,
  },
  stepSub: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.slateMuted,
    marginTop: 1,
  },

  // Inputs
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.white,
  },
  inputFlex: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.slate,
  },
  smallInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.slate,
    backgroundColor: COLORS.white,
  },

  // Weights
  weightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weightItem: {
    flexBasis: '30%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 8,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    gap: 4,
  },
  weightLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  weightInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    color: COLORS.slate,
    backgroundColor: COLORS.background,
  },

  // Members header
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  membersTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight + '22',
  },
  selectAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Member card
  memberCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
    backgroundColor: COLORS.white,
  },
  memberCardActive: {
    borderColor: COLORS.primaryLight,
    backgroundColor: COLORS.primaryLight + '0A',
  },
  memberCardInactive: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    opacity: 0.7,
  },
  memberCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  checkboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slate,
  },
  leaderBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: COLORS.background,
  },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 52,
    alignItems: 'center',
  },
  scoreBadgeActive: {
    backgroundColor: COLORS.tealLight,
    borderColor: COLORS.teal,
  },
  scoreBadgeText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.slateMuted,
  },
  scoreBadgeTextActive: { color: COLORS.teal },
  scoreBadgeMax: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.slateMuted,
  },
  commentBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  commentBtnActive: {
    backgroundColor: '#FFF8E7',
    borderColor: COLORS.gold + '55',
  },

  // Member body
  memberBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  bodyLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  rangeDisplayLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inlineLabel: { fontSize: 12, fontWeight: '700', color: COLORS.slateMuted },

  stepperSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
  },
  stepBtnSmall: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValueSmall: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate,
    minWidth: 28,
  },

  scoreInput: {
    width: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    color: COLORS.slate,
    backgroundColor: COLORS.white,
  },

  // Book review
  bookRangeField: {
    flex: 1,
  },
  bookRangeInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate,
    backgroundColor: COLORS.white,
    textAlign: 'center',
  },
  helperText: {
    fontSize: 12,
    color: COLORS.slateMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },

  // Last record line (book review)
  lastRecordLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  lastRecordText: {
    flex: 1,
    fontSize: 11.5,
    color: COLORS.slateMuted,
    fontWeight: '600',
  },

  // Subac dots grid
  dotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dotItem: {
    flexBasis: '30%',
    flexGrow: 1,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 6,
  },
  dotLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dotControl: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dotBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dotValueWrap: { minWidth: 28, alignItems: 'center' },
  dotValue: { fontSize: 15, fontWeight: '800', color: COLORS.slate },

  // Comment preview
  commentPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    padding: 8,
    backgroundColor: '#FFF8E7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gold + '33',
  },
  commentPreviewText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.slate,
    fontStyle: 'italic',
    lineHeight: 15,
  },

  // Dropdown (TopicPicker + BookPicker)
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    gap: 8,
  },
  dropdownText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate,
  },

  // Modal shell (for pickers)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  modalRowActive: { backgroundColor: COLORS.primaryLight },
  modalRowText: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  modalRowTextActive: { color: COLORS.primary },
  modalRowSub: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: COLORS.slateMuted, fontSize: 13 },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: COLORS.slate },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});