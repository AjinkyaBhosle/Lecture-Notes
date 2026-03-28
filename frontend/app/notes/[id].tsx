import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAudioPlayer } from 'expo-audio';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/theme';
import { api, Lecture, StructuredNotes } from '../../src/utils/api';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
  }
  return `${m} min`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function generateNotesText(notes: StructuredNotes): string {
  let text = `${notes.title}\n${'='.repeat(notes.title.length)}\n\n`;
  text += `Summary: ${notes.summary}\n\n`;
  
  for (const section of notes.sections) {
    text += `## ${section.heading}\n`;
    for (const point of section.points) {
      text += `  • ${point}\n`;
    }
    if (section.key_concepts.length > 0) {
      text += `  Key concepts: ${section.key_concepts.join(', ')}\n`;
    }
    text += '\n';
  }
  
  if (notes.key_takeaways.length > 0) {
    text += `Key Takeaways:\n`;
    for (const t of notes.key_takeaways) {
      text += `  ★ ${t}\n`;
    }
  }
  return text;
}

function generateNotesHtml(notes: StructuredNotes): string {
  let html = `
    <html><head><style>
      body { font-family: -apple-system, sans-serif; padding: 20px; color: #1e293b; line-height: 1.6; }
      h1 { color: #4F46E5; border-bottom: 2px solid #4F46E5; padding-bottom: 8px; }
      h2 { color: #334155; margin-top: 24px; }
      .summary { background: #EEF2FF; padding: 16px; border-radius: 8px; margin: 16px 0; }
      ul { padding-left: 20px; }
      li { margin-bottom: 6px; }
      .concepts { color: #4F46E5; font-weight: 500; }
      .takeaways { background: #F0FDF4; padding: 16px; border-radius: 8px; margin-top: 24px; }
      .takeaway-item { margin-bottom: 8px; }
    </style></head><body>
    <h1>${notes.title}</h1>
    <div class="summary"><strong>Summary:</strong> ${notes.summary}</div>`;

  for (const section of notes.sections) {
    html += `<h2>${section.heading}</h2><ul>`;
    for (const point of section.points) {
      html += `<li>${point}</li>`;
    }
    html += '</ul>';
    if (section.key_concepts.length > 0) {
      html += `<p class="concepts">Key concepts: ${section.key_concepts.join(', ')}</p>`;
    }
  }

  if (notes.key_takeaways.length > 0) {
    html += '<div class="takeaways"><h2>Key Takeaways</h2>';
    for (const t of notes.key_takeaways) {
      html += `<div class="takeaway-item">★ ${t}</div>`;
    }
    html += '</div>';
  }

  html += '</body></html>';
  return html;
}

export default function NotesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioUrl = id ? api.getAudioUrl(id) : '';
  const player = useAudioPlayer(audioUrl);

  useEffect(() => {
    if (player) {
      const sub = player.addListener('playingChange', (event: { isPlaying: boolean }) => {
        setIsPlaying(event.isPlaying);
      });
      return () => sub.remove();
    }
  }, [player]);

  const togglePlayback = () => {
    if (!player) return;
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  useEffect(() => {
    if (id) fetchLecture();
  }, [id]);

  const fetchLecture = async () => {
    try {
      const data = await api.getLecture(id!);
      setLecture(data);
      setTitleValue(data.title);
    } catch (err) {
      Alert.alert('Error', 'Failed to load lecture');
    } finally {
      setLoading(false);
    }
  };

  const saveTitle = async () => {
    if (!id || !titleValue.trim()) return;
    try {
      await api.updateLecture(id, titleValue.trim());
      setLecture((prev) => prev ? { ...prev, title: titleValue.trim() } : prev);
    } catch (err) {
      console.error('Failed to update title');
    }
    setEditingTitle(false);
  };

  const handleShare = async () => {
    if (!lecture?.structured_notes) return;
    try {
      const text = generateNotesText(lecture.structured_notes);
      await Share.share({
        message: text,
        title: lecture.title,
      });
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  const handleExportPdf = async () => {
    if (!lecture?.structured_notes) return;
    try {
      const html = generateNotesHtml(lecture.structured_notes);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `${lecture.title} - Notes`,
        });
      } else {
        Alert.alert('PDF Created', 'PDF saved successfully');
      }
    } catch (err) {
      console.error('PDF export failed:', err);
      Alert.alert('Error', 'Failed to export PDF');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!lecture || !lecture.structured_notes) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity testID="notes-back-button" onPress={() => router.replace('/')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingWrap}>
          <Text style={styles.errorText}>Notes not available</Text>
        </View>
      </SafeAreaView>
    );
  }

  const notes = lecture.structured_notes;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="notes-back-button"
          onPress={() => router.replace('/')}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            testID="share-notes-button"
            onPress={handleShare}
            style={styles.headerActionBtn}
          >
            <Ionicons name="share-outline" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="export-pdf-button"
            onPress={handleExportPdf}
            style={styles.headerActionBtn}
          >
            <Ionicons name="document-outline" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        {editingTitle ? (
          <View style={styles.titleEditRow}>
            <TextInput
              testID="edit-title-input"
              style={styles.titleInput}
              value={titleValue}
              onChangeText={setTitleValue}
              onBlur={saveTitle}
              onSubmitEditing={saveTitle}
              autoFocus
            />
          </View>
        ) : (
          <TouchableOpacity testID="edit-title-button" onPress={() => setEditingTitle(true)}>
            <Text style={styles.title}>{lecture.title}</Text>
          </TouchableOpacity>
        )}

        {/* Meta */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.metaText}>{formatDate(lecture.created_at)}</Text>
          </View>
          {lecture.duration_seconds > 0 && (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={COLORS.textMuted} />
              <Text style={styles.metaText}>{formatDuration(lecture.duration_seconds)}</Text>
            </View>
          )}
        </View>

        {/* Audio Playback */}
        <TouchableOpacity
          testID="play-audio-button"
          style={styles.audioPlayer}
          onPress={togglePlayback}
          activeOpacity={0.7}
        >
          <View style={styles.playIconWrap}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={20}
              color={COLORS.primary}
            />
          </View>
          <View style={styles.audioInfo}>
            <Text style={styles.audioLabel}>Lecture Recording</Text>
            <Text style={styles.audioSubLabel}>
              {isPlaying ? 'Playing...' : 'Tap to play'}
            </Text>
          </View>
          <Ionicons name="musical-notes-outline" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        {/* Summary */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Summary</Text>
          <Text style={styles.summaryText}>{notes.summary}</Text>
        </View>

        {/* Sections */}
        {notes.sections.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            {section.points.map((point, pIdx) => (
              <View key={pIdx} style={styles.bulletItem}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{point}</Text>
              </View>
            ))}
            {section.key_concepts.length > 0 && (
              <View style={styles.conceptsRow}>
                {section.key_concepts.map((concept, cIdx) => (
                  <View key={cIdx} style={styles.conceptChip}>
                    <Text style={styles.conceptChipText}>{concept}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Key Takeaways */}
        {notes.key_takeaways.length > 0 && (
          <View style={styles.takeawaysBox}>
            <Text style={styles.takeawaysTitle}>Key Takeaways</Text>
            {notes.key_takeaways.map((item, idx) => (
              <View key={idx} style={styles.takeawayItem}>
                <Ionicons name="star" size={14} color={COLORS.warning} />
                <Text style={styles.takeawayText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Transcript Toggle */}
        {lecture.transcript && (
          <View style={styles.transcriptSection}>
            <TouchableOpacity
              testID="toggle-transcript-button"
              style={styles.transcriptToggle}
              onPress={() => setShowTranscript(!showTranscript)}
            >
              <Text style={styles.transcriptToggleText}>
                {showTranscript ? 'Hide Transcript' : 'Show Raw Transcript'}
              </Text>
              <Ionicons
                name={showTranscript ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={COLORS.primary}
              />
            </TouchableOpacity>
            {showTranscript && (
              <View style={styles.transcriptBox}>
                <Text style={styles.transcriptText}>{lecture.transcript}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          testID="bottom-share-button"
          style={styles.bottomBtn}
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <Ionicons name="share-social" size={20} color={COLORS.primary} />
          <Text style={styles.bottomBtnText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="bottom-export-pdf-button"
          style={styles.bottomBtnPrimary}
          onPress={handleExportPdf}
          activeOpacity={0.8}
        >
          <Ionicons name="download-outline" size={20} color={COLORS.textWhite} />
          <Text style={styles.bottomBtnPrimaryText}>Export PDF</Text>
        </TouchableOpacity>
      </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 100,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: SPACING.sm,
  },
  titleEditRow: {
    marginBottom: SPACING.sm,
  },
  titleInput: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    paddingBottom: SPACING.xs,
  },
  metaRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  playIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioInfo: {
    flex: 1,
  },
  audioLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  audioSubLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  summaryBox: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  summaryText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionHeading: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
    paddingRight: SPACING.md,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginTop: 7,
    marginRight: SPACING.md,
  },
  bulletText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
    flex: 1,
  },
  conceptsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  conceptChip: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  conceptChipText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  takeawaysBox: {
    backgroundColor: COLORS.successLight,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  takeawaysTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  takeawayItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  takeawayText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
    flex: 1,
  },
  transcriptSection: {
    marginTop: SPACING.md,
  },
  transcriptToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  transcriptToggleText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  transcriptBox: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginTop: SPACING.sm,
  },
  transcriptText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  errorText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textMuted,
  },
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  bottomBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryLight,
  },
  bottomBtnText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
  },
  bottomBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  bottomBtnPrimaryText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textWhite,
  },
});
