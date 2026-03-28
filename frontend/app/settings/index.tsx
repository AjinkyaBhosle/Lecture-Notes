import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/theme';

const LANG_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'mr', label: 'Marathi' },
  { code: 'auto', label: 'Auto-detect' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const [defaultLang, setDefaultLang] = useState('en');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="settings-back" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Default Language */}
        <Text style={styles.sectionLabel}>Default Language</Text>
        <View style={styles.card}>
          {LANG_OPTIONS.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              testID={`setting-lang-${lang.code}`}
              style={styles.optionRow}
              onPress={() => setDefaultLang(lang.code)}
            >
              <Text style={styles.optionText}>{lang.label}</Text>
              <View style={[styles.radio, defaultLang === lang.code && styles.radioActive]}>
                {defaultLang === lang.code && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Links */}
        <Text style={styles.sectionLabel}>App</Text>
        <View style={styles.card}>
          <TouchableOpacity
            testID="settings-about"
            style={styles.linkRow}
            onPress={() => router.push('/about')}
          >
            <Ionicons name="information-circle-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.linkText}>About & Help</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="settings-rate"
            style={[styles.linkRow, styles.linkRowLast]}
            onPress={() => Alert.alert('Rate Us', 'Thank you for using AI Lecture Companion!')}
          >
            <Ionicons name="star-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.linkText}>Rate this App</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Version */}
        <View style={styles.versionWrap}>
          <Text style={styles.versionText}>AI Lecture Companion v1.0.0</Text>
          <Text style={styles.versionSub}>Built with AI for students</Text>
        </View>
      </ScrollView>
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
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 40 },
  sectionLabel: {
    fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginTop: SPACING.xl, marginBottom: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  card: {
    backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  optionText: { fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  radioActive: { borderColor: COLORS.primary },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  linkRowLast: { borderBottomWidth: 0 },
  linkText: { fontSize: FONT_SIZES.md, color: COLORS.textPrimary, flex: 1 },
  versionWrap: { alignItems: 'center', paddingVertical: SPACING.xxxl },
  versionText: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted },
  versionSub: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginTop: SPACING.xs },
});
