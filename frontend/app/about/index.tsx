import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/theme';

const SECTIONS = [
  {
    icon: 'information-circle-outline' as const,
    title: 'What is AI Lecture Companion?',
    content:
      'An AI-powered app that records your lectures and converts them into clean, structured notes automatically. Record in class, get notes in minutes — no manual typing needed.',
  },
  {
    icon: 'mic-outline' as const,
    title: 'How to Use',
    steps: [
      'Tap the mic button on the home screen',
      'Select your lecture language (English, Hindi, Marathi, or Auto)',
      'Tap "Start Recording" and place your phone near the speaker',
      'When the lecture ends, tap Stop → "Generate Notes"',
      'Wait 5-10 minutes while AI processes your lecture',
      'View your structured notes with headings, bullet points & key concepts',
      'Export as PDF or share via WhatsApp',
    ],
  },
  {
    icon: 'language-outline' as const,
    title: 'Supported Languages',
    table: [
      { lang: 'English', quality: 'Excellent', best: 'English-only lectures' },
      { lang: 'Hindi', quality: 'Very Good', best: 'Hindi-primary lectures (Devanagari output)' },
      { lang: 'Marathi', quality: 'Good', best: 'Marathi-primary lectures (Devanagari output)' },
      { lang: 'Hinglish (En+Hi)', quality: 'Good', best: 'Select "English" — Hindi words in Roman script' },
      { lang: 'English + Marathi', quality: 'Good', best: 'Select "English" — Marathi words in Roman script' },
      { lang: 'Auto-detect', quality: 'Variable', best: 'Supports 97+ languages, best for long recordings' },
    ],
  },
  {
    icon: 'time-outline' as const,
    title: 'Processing Time',
    table2: [
      { label: 'Recording', value: 'Up to 90 minutes', icon: 'mic' as const },
      { label: 'Upload', value: '1-3 min (depends on internet)', icon: 'cloud-upload' as const },
      { label: 'Transcription', value: '3-5 min for 90 min lecture', icon: 'ear' as const },
      { label: 'Note Generation', value: '1-2 min', icon: 'sparkles' as const },
      { label: 'Total', value: '~5-10 min for a full lecture', icon: 'checkmark-circle' as const },
    ],
  },
  {
    icon: 'star-outline' as const,
    title: 'Features',
    bullets: [
      'Record lectures up to 90 minutes',
      'AI transcription powered by OpenAI Whisper',
      'Smart notes with headings, bullet points & key concepts',
      'Multi-language support (English, Hindi, Marathi, Hinglish)',
      'Audio playback — listen to recordings anytime',
      'Export notes as PDF',
      'Share notes via WhatsApp or any app',
      'Edit lecture titles',
      'View raw transcript alongside notes',
      'Delete old lectures to save space',
    ],
  },
  {
    icon: 'alert-circle-outline' as const,
    title: 'Limitations',
    bullets: [
      'Internet required for AI processing (recording works offline)',
      'Very noisy environments may reduce transcription quality',
      'Auto language detection can be inaccurate for short recordings (<1 min)',
      'Mixed-language lectures may have some words transcribed phonetically',
      'Processing time increases with lecture length',
      'Large files (90 min) need a stable internet connection for upload',
    ],
  },
  {
    icon: 'bulb-outline' as const,
    title: 'Tips for Best Results',
    bullets: [
      'Place your phone close to the speaker/professor',
      'Avoid covering the microphone with your hand or bag',
      'Select the correct language before recording',
      'For mixed En+Hindi/Marathi lectures, select "English"',
      'Longer recordings give better AI context = better notes',
      'Use a quiet corner if possible to reduce background noise',
      'Keep your phone charged — long recordings use battery',
    ],
  },
  {
    icon: 'help-circle-outline' as const,
    title: 'FAQ',
    faqs: [
      { q: 'Does it work offline?', a: 'Recording works offline. AI processing needs internet. Notes are saved locally for offline viewing.' },
      { q: 'How long can I record?', a: 'Up to 90 minutes per lecture. The app splits long audio into chunks for processing.' },
      { q: 'What if the transcription is wrong?', a: 'Try selecting the specific language instead of Auto-detect. Place phone closer to the speaker.' },
      { q: 'Can I record in Tamil/Telugu/Bengali?', a: 'Yes! Use "Auto-detect" mode. Whisper supports 97+ languages.' },
      { q: 'Where are my recordings stored?', a: 'Audio files and notes are stored on the server. You can access them anytime from the home screen.' },
      { q: 'Can I edit the generated notes?', a: 'You can edit the title by tapping on it. Full note editing coming soon.' },
    ],
  },
];

export default function AboutScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          testID="about-back-button"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* App Header */}
        <View style={styles.appHeader}>
          <View style={styles.appIconWrap}>
            <Ionicons name="book" size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.appName}>AI Lecture Companion</Text>
          <Text style={styles.appTagline}>Record lectures. Get smart notes. Ace exams.</Text>
        </View>

        {/* Sections */}
        {SECTIONS.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={section.icon} size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>

            {section.content && (
              <Text style={styles.sectionText}>{section.content}</Text>
            )}

            {section.steps && (
              <View style={styles.stepsContainer}>
                {section.steps.map((step, sIdx) => (
                  <View key={sIdx} style={styles.stepItem}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{sIdx + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            )}

            {section.table && (
              <View style={styles.tableContainer}>
                {section.table.map((row, rIdx) => (
                  <View key={rIdx} style={styles.tableRow}>
                    <View style={styles.tableLeft}>
                      <Text style={styles.tableLang}>{row.lang}</Text>
                      <Text style={styles.tableQuality}>{row.quality}</Text>
                    </View>
                    <Text style={styles.tableBest}>{row.best}</Text>
                  </View>
                ))}
              </View>
            )}

            {section.table2 && (
              <View style={styles.timeContainer}>
                {section.table2.map((row, rIdx) => (
                  <View
                    key={rIdx}
                    style={[
                      styles.timeRow,
                      rIdx === (section.table2?.length ?? 0) - 1 && styles.timeRowLast,
                    ]}
                  >
                    <View style={styles.timeIconWrap}>
                      <Ionicons name={row.icon as any} size={16} color={COLORS.primary} />
                    </View>
                    <Text style={styles.timeLabel}>{row.label}</Text>
                    <Text style={styles.timeValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            )}

            {section.bullets && (
              <View style={styles.bulletsContainer}>
                {section.bullets.map((bullet, bIdx) => (
                  <View key={bIdx} style={styles.bulletItem}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>
            )}

            {section.faqs && (
              <View style={styles.faqContainer}>
                {section.faqs.map((faq, fIdx) => (
                  <View key={fIdx} style={styles.faqItem}>
                    <Text style={styles.faqQ}>{faq.q}</Text>
                    <Text style={styles.faqA}>{faq.a}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Built with AI for students, by students</Text>
          <Text style={styles.footerVersion}>v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.textPrimary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 40 },
  appHeader: { alignItems: 'center', paddingVertical: SPACING.xxl },
  appIconWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.md,
  },
  appName: { fontSize: FONT_SIZES.xxl, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.5 },
  appTagline: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted, marginTop: SPACING.xs, textAlign: 'center' },
  section: {
    backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  sectionTitle: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.textPrimary },
  sectionText: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, lineHeight: 22 },
  stepsContainer: { gap: SPACING.md },
  stepItem: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  stepNumText: { fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.textWhite },
  stepText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, flex: 1, lineHeight: 20, paddingTop: 2 },
  tableContainer: { gap: SPACING.sm },
  tableRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  tableLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  tableLang: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textPrimary, minWidth: 100 },
  tableQuality: {
    fontSize: FONT_SIZES.xs, fontWeight: '500', color: COLORS.primary,
    backgroundColor: COLORS.primaryLight, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm, overflow: 'hidden',
  },
  tableBest: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, flex: 1, textAlign: 'right', marginLeft: SPACING.sm },
  timeContainer: { gap: 0 },
  timeRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  timeRowLast: {
    borderBottomWidth: 0, backgroundColor: COLORS.primaryLight,
    marginHorizontal: -SPACING.lg, marginBottom: -SPACING.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomLeftRadius: BORDER_RADIUS.lg, borderBottomRightRadius: BORDER_RADIUS.lg,
  },
  timeIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  timeLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, flex: 1 },
  timeValue: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textPrimary },
  bulletsContainer: { gap: SPACING.sm },
  bulletItem: { flexDirection: 'row', alignItems: 'flex-start' },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary, marginTop: 6, marginRight: SPACING.md },
  bulletText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, flex: 1, lineHeight: 20 },
  faqContainer: { gap: SPACING.md },
  faqItem: { gap: SPACING.xs },
  faqQ: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textPrimary },
  faqA: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted, lineHeight: 20 },
  footer: { alignItems: 'center', paddingVertical: SPACING.xxl },
  footerText: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted },
  footerVersion: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginTop: SPACING.xs },
});
