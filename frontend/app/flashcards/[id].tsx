import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/theme';
import { api, Flashcard } from '../../src/utils/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function FlashcardsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;

  const flipCard = () => {
    const toValue = flipped ? 0 : 1;
    Animated.spring(flipAnim, {
      toValue,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
    setFlipped(!flipped);
  };

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontAnimStyle = { transform: [{ rotateY: frontInterpolate }] };
  const backAnimStyle = { transform: [{ rotateY: backInterpolate }] };

  useEffect(() => {
    if (id) loadFlashcards();
  }, [id]);

  const loadFlashcards = async () => {
    try {
      // First check if flashcards already exist
      const lecture = await api.getLecture(id!);
      if (lecture.flashcards && lecture.flashcards.length > 0) {
        setFlashcards(lecture.flashcards);
        setLoading(false);
        return;
      }
      // Generate new flashcards
      const result = await api.generateFlashcards(id!);
      setFlashcards(result.flashcards);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to generate flashcards');
    } finally {
      setLoading(false);
    }
  };

  const nextCard = () => {
    setFlipped(false);
    // Reset flip animation immediately before switching card
    flipAnim.setValue(0);
    setCurrentIdx((prev) => Math.min(prev + 1, flashcards.length - 1));
  };

  const prevCard = () => {
    setFlipped(false);
    flipAnim.setValue(0);
    setCurrentIdx((prev) => Math.max(prev - 1, 0));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity testID="flashcards-back" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Flashcards</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Generating flashcards with AI...</Text>
          <Text style={styles.loadingSubtext}>This may take a moment</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (flashcards.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity testID="flashcards-back" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Flashcards</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>No flashcards available</Text>
        </View>
      </SafeAreaView>
    );
  }

  const card = flashcards[currentIdx];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity testID="flashcards-back" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Flashcards</Text>
        <Text style={styles.counter}>{currentIdx + 1}/{flashcards.length}</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((currentIdx + 1) / flashcards.length) * 100}%` }]} />
      </View>

      {/* Card with 3D flip animation */}
      <View style={styles.cardSection}>
        <TouchableOpacity
          testID="flashcard-tap"
          onPress={flipCard}
          activeOpacity={1}
          style={styles.cardTouchable}
        >
          {/* Front face */}
          <Animated.View style={[styles.card, frontAnimStyle]}>
            <Text style={styles.cardLabel}>QUESTION</Text>
            <Text style={styles.cardText}>{card.front}</Text>
            <Text style={styles.tapHint}>Tap to reveal answer</Text>
          </Animated.View>
          {/* Back face */}
          <Animated.View style={[styles.card, styles.cardFlipped, styles.cardBack, backAnimStyle]}>
            <Text style={[styles.cardLabel, { color: COLORS.success }]}>ANSWER</Text>
            <Text style={[styles.cardText, styles.cardTextFlipped]}>{card.back}</Text>
            <Text style={styles.tapHint}>Tap to see question</Text>
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Navigation */}
      <View style={styles.navRow}>
        <TouchableOpacity
          testID="flashcard-prev"
          style={[styles.navBtn, currentIdx === 0 && styles.navBtnDisabled]}
          onPress={prevCard}
          disabled={currentIdx === 0}
        >
          <Ionicons name="chevron-back" size={24} color={currentIdx === 0 ? COLORS.textMuted : COLORS.textPrimary} />
          <Text style={[styles.navBtnText, currentIdx === 0 && styles.navBtnTextDisabled]}>Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="flashcard-next"
          style={[styles.navBtn, currentIdx === flashcards.length - 1 && styles.navBtnDisabled]}
          onPress={nextCard}
          disabled={currentIdx === flashcards.length - 1}
        >
          <Text style={[styles.navBtnText, currentIdx === flashcards.length - 1 && styles.navBtnTextDisabled]}>Next</Text>
          <Ionicons name="chevron-forward" size={24} color={currentIdx === flashcards.length - 1 ? COLORS.textMuted : COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.textPrimary },
  counter: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.primary, minWidth: 44, textAlign: 'right' },
  progressBar: {
    height: 4, backgroundColor: COLORS.borderLight, marginHorizontal: SPACING.xl,
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 2 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.md },
  loadingText: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.textPrimary },
  loadingSubtext: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted },
  cardSection: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.xl },
  cardTouchable: {
    // Container for both card faces stacked
    height: 300,
  },
  card: {
    backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xxl, minHeight: 280,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.primary,
    elevation: 4, shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12,
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cardFlipped: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.success },
  cardLabel: {
    fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.primary,
    textTransform: 'uppercase', letterSpacing: 2, marginBottom: SPACING.lg,
    position: 'absolute', top: SPACING.lg,
  },
  cardText: {
    fontSize: FONT_SIZES.xl, fontWeight: '600', color: COLORS.textPrimary,
    textAlign: 'center', lineHeight: 30,
  },
  cardTextFlipped: { fontSize: FONT_SIZES.lg, fontWeight: '400', lineHeight: 26 },
  tapHint: {
    fontSize: FONT_SIZES.xs, color: COLORS.textMuted,
    position: 'absolute', bottom: SPACING.lg,
  },
  navRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.xl,
  },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.textPrimary },
  navBtnTextDisabled: { color: COLORS.textMuted },
});
