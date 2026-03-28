import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../src/utils/theme';
import { api, Lecture } from '../src/utils/api';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
  }
  return `${m}m ${s}s`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getStatusInfo(status: string) {
  switch (status) {
    case 'recorded':
    case 'uploaded':
      return { label: 'Ready', color: COLORS.warning, bg: COLORS.warningLight, icon: 'time-outline' as const };
    case 'transcribing':
    case 'generating_notes':
      return { label: 'Processing', color: COLORS.primary, bg: COLORS.primaryLight, icon: 'sync-outline' as const };
    case 'completed':
      return { label: 'Done', color: COLORS.success, bg: COLORS.successLight, icon: 'checkmark-circle-outline' as const };
    case 'error':
      return { label: 'Error', color: COLORS.danger, bg: COLORS.dangerLight, icon: 'alert-circle-outline' as const };
    default:
      return { label: status, color: COLORS.textMuted, bg: COLORS.surfaceAlt, icon: 'help-outline' as const };
  }
}

function LectureCard({ lecture, onPress, onDelete }: { lecture: Lecture; onPress: () => void; onDelete: () => void }) {
  const statusInfo = getStatusInfo(lecture.status);

  return (
    <TouchableOpacity
      testID={`lecture-card-${lecture.id}`}
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
          <Text style={styles.cardTitle} numberOfLines={2}>
            {lecture.title}
          </Text>
        </View>
        <TouchableOpacity
          testID={`delete-lecture-${lecture.id}`}
          onPress={onDelete}
          style={styles.deleteBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.metaText}>
            {lecture.duration_seconds > 0 ? formatDuration(lecture.duration_seconds) : 'No duration'}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.metaText}>{formatDate(lecture.created_at)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <Ionicons name={statusInfo.icon} size={12} color={statusInfo.color} />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLectures = useCallback(async () => {
    try {
      const data = await api.listLectures();
      setLectures(data);
    } catch (err) {
      console.error('Failed to fetch lectures:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLectures();
    }, [fetchLectures])
  );

  const handleDelete = (lecture: Lecture) => {
    Alert.alert(
      'Delete Lecture',
      `Delete "${lecture.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteLecture(lecture.id);
              setLectures((prev) => prev.filter((l) => l.id !== lecture.id));
            } catch (err) {
              Alert.alert('Error', 'Failed to delete lecture');
            }
          },
        },
      ]
    );
  };

  const handleLecturePress = (lecture: Lecture) => {
    if (lecture.status === 'completed') {
      router.push(`/notes/${lecture.id}`);
    } else if (lecture.status === 'transcribing' || lecture.status === 'generating_notes') {
      router.push(`/processing/${lecture.id}`);
    } else if (lecture.status === 'uploaded' || lecture.status === 'recorded') {
      router.push(`/processing/${lecture.id}`);
    } else if (lecture.status === 'error') {
      router.push(`/processing/${lecture.id}`);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="mic-outline" size={48} color={COLORS.primaryMuted} />
      </View>
      <Text style={styles.emptyTitle}>No lectures yet</Text>
      <Text style={styles.emptySubtitle}>
        Tap the microphone button to record{'\n'}your first lecture
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Lecture Notes</Text>
          <Text style={styles.headerSubtitle}>
            {lectures.length > 0 ? `${lectures.length} lecture${lectures.length > 1 ? 's' : ''}` : 'AI-powered note taking'}
          </Text>
        </View>
        <TouchableOpacity
          testID="about-button"
          style={styles.headerIcon}
          onPress={() => router.push('/about')}
          activeOpacity={0.7}
        >
          <Ionicons name="information-circle-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Lecture List */}
      <FlatList
        testID="lectures-list"
        data={lectures}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <LectureCard
            lecture={item}
            onPress={() => handleLecturePress(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={lectures.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchLectures();
            }}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Record FAB */}
      <TouchableOpacity
        testID="record-fab-button"
        style={styles.fab}
        onPress={() => router.push('/record')}
        activeOpacity={0.8}
      >
        <Ionicons name="mic" size={28} color={COLORS.textWhite} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.sm,
  },
  cardTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
