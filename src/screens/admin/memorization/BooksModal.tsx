// src/screens/admin/memorization/BooksModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, api } from './_shared';
import {
  FeedbackModal,
  FeedbackTone,
  FeedbackButton,
} from './_shared/pickers';

interface Book {
  _id: string;
  name: string;
  author?: string;
  bookType?: 'pages' | 'lines' | 'verses';
  totalPages?: number;
}

interface BooksModalProps {
  visible: boolean;
  books: Book[];
  onClose: () => void;
  onChange: (books: Book[]) => void;
  branchId?: string;
  tenantId?: string;
}

const BOOK_TYPES = ['pages', 'lines', 'verses'] as const;

export const BooksModal: React.FC<BooksModalProps> = ({
  visible,
  books,
  onClose,
  onChange,
  branchId,
  tenantId,
}) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '',
    author: '',
    totalPages: '',
    bookType: 'pages' as 'pages' | 'lines' | 'verses',
  });
  const [saving, setSaving] = useState(false);

  // ============================================================
  // FEEDBACK POPUP (replaces Alert.alert)
  // ============================================================
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

  const handleAdd = async () => {
    if (!form.name.trim()) {
      notify(
        'warning',
        t('memorization.book_name_required') || 'Book name required'
      );
      return;
    }
    if (!branchId) {
      notify(
        'warning',
        t('memorization.select_branch_first') || 'Select branch first'
      );
      return;
    }
    setSaving(true);
    try {
      const created = await api.createBook({
        name: form.name.trim(),
        author: form.author.trim(),
        category: 'other',
        totalPages: parseInt(form.totalPages, 10) || 0,
        bookType: form.bookType,
        branchId,
        ...(tenantId ? { tenantId } : {}),
      });
      if (created?._id || created?.id) {
        onChange([...books, created]);
      }
      setForm({ name: '', author: '', totalPages: '', bookType: 'pages' });
      notify(
        'success',
        t('memorization.book_added') || 'Book added',
        form.name.trim()
      );
    } catch (e: any) {
      notify(
        'error',
        t('memorization.failed_to_add_book') || 'Failed to add book',
        e?.message || ''
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    const book = books.find((b) => b._id === id);
    notify(
      'warning',
      t('memorization.delete_book_confirm') || 'Delete this book?',
      book?.name || '',
      [
        { text: t('memorization.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('memorization.delete') || 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteBook(id);
              onChange(books.filter((b) => b._id !== id));
              notify(
                'success',
                t('memorization.book_deleted') || 'Book deleted'
              );
            } catch (e: any) {
              notify(
                'error',
                t('memorization.failed_to_delete_book') || 'Delete failed',
                e?.message || ''
              );
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {t('memorization.books_management') || 'Books Management'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
            <View style={styles.addBox}>
              <Text style={styles.addTitle}>
                {t('memorization.add_book') || 'Add Book'}
              </Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
                placeholder={t('memorization.book_name') || 'Book name'}
                placeholderTextColor="#A0AAA5"
              />
              <TextInput
                style={styles.input}
                value={form.author}
                onChangeText={(v) => setForm((p) => ({ ...p, author: v }))}
                placeholder={t('memorization.author') || 'Author'}
                placeholderTextColor="#A0AAA5"
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={form.totalPages}
                  onChangeText={(v) =>
                    setForm((p) => ({
                      ...p,
                      totalPages: v.replace(/[^0-9]/g, ''),
                    }))
                  }
                  placeholder={t('memorization.total_pages') || 'Total pages'}
                  keyboardType="numeric"
                  placeholderTextColor="#A0AAA5"
                />
                <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
                  {BOOK_TYPES.map((bt) => {
                    const active = form.bookType === bt;
                    return (
                      <TouchableOpacity
                        key={bt}
                        style={[styles.typeBtn, active && styles.typeBtnActive]}
                        onPress={() => setForm((p) => ({ ...p, bookType: bt }))}
                      >
                        <Text
                          style={[
                            styles.typeBtnText,
                            active && styles.typeBtnTextActive,
                          ]}
                        >
                          {t(`memorization.${bt}`) || bt}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <TouchableOpacity
                style={[styles.addBtn, saving && { opacity: 0.6 }]}
                onPress={handleAdd}
                disabled={saving}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addBtnText}>
                  {t('memorization.add_book') || 'Add Book'}
                </Text>
              </TouchableOpacity>
            </View>

            {books.length === 0 ? (
              <Text style={styles.emptyText}>
                {t('memorization.no_books') || 'No books yet'}
              </Text>
            ) : (
              books.map((b) => (
                <View key={b._id} style={styles.bookRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookName}>{b.name}</Text>
                    <Text style={styles.bookMeta}>
                      {b.author || '—'} ·{' '}
                      {t(`memorization.${b.bookType || 'pages'}`)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(b._id)}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={COLORS.red}
                    />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </View>

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
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  addBox: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  addTitle: { fontSize: 13, fontWeight: '800', color: COLORS.slate },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.slate,
    backgroundColor: COLORS.white,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.slateMuted },
  typeBtnTextActive: { color: '#fff' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    marginTop: 4,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  bookName: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  bookMeta: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.redLight,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.slateMuted,
    paddingVertical: 20,
    fontSize: 13,
  },
});