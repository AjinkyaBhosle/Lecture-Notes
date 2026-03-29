import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/theme';
import { api, Lecture, TranscriptSegment } from '../../src/utils/api';

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeSegIdx, setActiveSegIdx] = useState(-1);
  const scrollRef = useRef<ScrollView>(null);

  const audioUri = lecture?.audio_uri || '';
  const player = useAudioPlayer(audioUri);

  useEffect(() => {
    if (id) loadLecture();
  }, [id]);

  useEffect(() => {
    if (!player) return;
    const playSub = player.addListener('playingChange', (e: { isPlaying: boolean }) => setIsPlaying(e.isPlaying));
    return () => playSub.remove();
  }, [player]);

  // Poll current time for subtitle sync
  useEffect(() => {
    if (!player || !isPlaying) return;
    const interval = setInterval(() => {
      if (player.currentTime !== undefined) {
        setCurrentTime(player.currentTime);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [player, isPlaying]);

  // Find active segment based on current time
  useEffect(() => {
    if (!lecture?.segments) return;
    const idx = lecture.segments.findIndex(
      (seg) => currentTime >= seg.start && currentTime < seg.end
    );
    if (idx !== activeSegIdx && idx >= 0) {
      setActiveSegIdx(idx);
    }
  }, [currentTime, lecture?.segments]);

  const loadLecture = async () => {
    try {
      const data = await api.getLecture(id!);
      setLecture(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = () => {
    if (!player) return;
    if (isPlaying) player.pause();
    else player.play();
  };

  const seekToSegment = (seg: TranscriptSegment) => {
    if (!player) return;
    player.seekTo(seg.start);
    if (!isPlaying) player.play();
  };

  const skipForward = () => {
    if (!player) return;
    player.seekTo(Math.min(currentTime + 10, lecture?.duration_seconds || 0));
  };

  const skipBack = () => {
    if (!player) return;
    player.seekTo(Math.max(currentTime - 10, 0));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!lecture || !lecture.audio_uri) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity testID="player-back" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Player</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingWrap}>
          <Ionicons name="musical-notes-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.noAudioText}>No audio recording available</Text>
        </View>
      </SafeAreaView>
    );
  }

  const segments = lecture.segments || [];
  const progress = lecture.duration_seconds > 0 ? (currentTime / lecture.duration_seconds) * 100 : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity testID="player-back" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{lecture.title}</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Subtitle Area */}
      <ScrollView
        ref={scrollRef}
        style={styles.subtitleScroll}
        contentContainerStyle={styles.subtitleContent}
        showsVerticalScrollIndicator={false}
      >
        {segments.length > 0 ? (
          segments.map((seg, idx) => (
            <TouchableOpacity
              key={idx}
              testID={`segment-${idx}`}
              style={[styles.segmentRow, idx === activeSegIdx && styles.segmentActive]}
              onPress={() => seekToSegment(seg)}
              activeOpacity={0.7}
            >
              <Text style={styles.segmentTime}>{formatTime(seg.start)}</Text>
              <Text style={[styles.segmentText, idx === activeSegIdx && styles.segmentTextActive]}>
                {seg.text}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.noSegments}>
            <Text style={styles.noSegText}>No timestamped segments available</Text>
            {lecture.transcript && <Text style={styles.fallbackTranscript}>{lecture.transcript}</Text>}
          </View>
        )}
      </ScrollView>

      {/* Progress Bar */}
      <View style={styles.progressWrap}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <Text style={styles.timeText}>{formatTime(lecture.duration_seconds)}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity testID="skip-back" onPress={skipBack} style={styles.skipBtn}>
          <Ionicons name="play-back" size={24} color={COLORS.textSecondary} />
          <Text style={styles.skipLabel}>10s</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="play-pause" onPress={togglePlay} style={styles.playBtn} activeOpacity={0.8}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color={COLORS.textWhite} />
        </TouchableOpacity>
        <TouchableOpacity testID="skip-forward" onPress={skipForward} style={styles.skipBtn}>
          <Ionicons name="play-forward" size={24} color={COLORS.textSecondary} />
          <Text style={styles.skipLabel}>10s</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.md },
  noAudioText: { fontSize: FONT_SIZES.md, color: COLORS.textMuted },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary, flex: 1, textAlign: 'center', marginHorizontal: SPACING.sm },
  subtitleScroll: { flex: 1 },
  subtitleContent: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md },
  segmentRow: {
    flexDirection: 'row', paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md, marginBottom: 2, gap: SPACING.md,
  },
  segmentActive: { backgroundColor: COLORS.primaryLight },
  segmentTime: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, width: 42, fontVariant: ['tabular-nums'] },
  segmentText: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, flex: 1, lineHeight: 22 },
  segmentTextActive: { color: COLORS.textPrimary, fontWeight: '600' },
  noSegments: { padding: SPACING.xl, alignItems: 'center' },
  noSegText: { fontSize: FONT_SIZES.md, color: COLORS.textMuted },
  fallbackTranscript: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: SPACING.lg, lineHeight: 20 },
  progressWrap: { paddingHorizontal: SPACING.xl },
  progressBar: { height: 4, backgroundColor: COLORS.borderLight, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 2 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.xs },
  timeText: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xxxl, paddingVertical: SPACING.xl,
  },
  skipBtn: { alignItems: 'center', gap: 2 },
  skipLabel: { fontSize: 10, color: COLORS.textMuted },
  playBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    elevation: 4, shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8,
  },
});
