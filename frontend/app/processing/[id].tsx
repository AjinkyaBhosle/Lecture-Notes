import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/theme';
import { api } from '../../src/utils/api';

type Step = 'uploading' | 'transcribing' | 'generating' | 'done' | 'error';

const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: 'uploading', label: 'Uploading Audio', icon: 'cloud-upload-outline' },
  { key: 'transcribing', label: 'Transcribing Speech', icon: 'ear-outline' },
  { key: 'generating', label: 'Generating Notes', icon: 'sparkles-outline' },
  { key: 'done', label: 'Notes Ready!', icon: 'checkmark-circle-outline' },
];

export default function ProcessingScreen() {
  const params = useLocalSearchParams<{ id: string; language?: string; audioUri?: string; duration?: string }>();
  const id = params.id;
  const language = (params.language as string) || 'en';
  const audioUri = params.audioUri ? decodeURIComponent(params.audioUri as string) : '';
  const duration = params.duration ? parseInt(params.duration as string, 10) : 0;

  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('uploading');
  const [errorMsg, setErrorMsg] = useState('');
  const processStarted = useRef(false);

  useEffect(() => {
    if (id && audioUri && !processStarted.current) {
      processStarted.current = true;
      startProcessing();
    } else if (id && !audioUri && !processStarted.current) {
      // Opened from home screen for a lecture already being processed
      processStarted.current = true;
      checkExistingStatus();
    }
  }, [id]);

  const checkExistingStatus = async () => {
    try {
      const lecture = await api.getLecture(id!);
      if (lecture.status === 'completed') {
        setCurrentStep('done');
      } else if (lecture.status === 'error') {
        setCurrentStep('error');
        setErrorMsg('Processing failed previously.');
      } else {
        setCurrentStep('error');
        setErrorMsg('No audio available for processing.');
      }
    } catch {
      setCurrentStep('error');
      setErrorMsg('Lecture not found.');
    }
  };

  const startProcessing = async () => {
    if (!id || !audioUri) return;

    try {
      // Step 1: Transcribe (sends audio to server, server deletes after)
      setCurrentStep('transcribing');
      const transcript = await api.transcribeAudio(id, audioUri, duration, language);

      // Step 2: Generate notes
      setCurrentStep('generating');
      await api.generateNotes(id, transcript);

      // Done!
      setCurrentStep('done');

      // 🧹 SELF-CLEANING: Delete the temporary audio cache file to save phone space
      if (audioUri) {
        try {
          // Use require to avoid top-level import issues if FileSystem isn't fully initialized
          const FileSystem = require('expo-file-system');
          await FileSystem.deleteAsync(audioUri, { idempotent: true });
          console.log('Cleaned up temporary audio cache');
        } catch (cleanupErr) {
          console.warn('Silent cleanup fail (safe to ignore):', cleanupErr);
        }
      }
    } catch (err: any) {
      setCurrentStep('error');
      setErrorMsg(err?.message || 'Processing failed');
    }
  };

  const retryProcessing = () => {
    if (!audioUri) {
      Alert.alert(
        'Audio Unavailable',
        'The audio file is no longer available (it was deleted after processing to protect your privacy). Please record a new lecture.',
        [
          { text: 'Go Home', onPress: () => router.replace('/') },
          { text: 'Record New', onPress: () => router.replace('/record') },
        ]
      );
      return;
    }
    processStarted.current = false;
    setErrorMsg('');
    setCurrentStep('uploading');
    processStarted.current = true;
    startProcessing();
  };

  const getStepIndex = (step: Step) => {
    const idx = STEPS.findIndex((s) => s.key === step);
    return idx >= 0 ? idx : 0;
  };

  const currentIdx = getStepIndex(currentStep);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          testID="processing-back-button"
          onPress={() => router.replace('/')}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Processing</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.stepsContainer}>
          {STEPS.map((step, idx) => {
            const isActive = currentStep === step.key;
            const isComplete = currentIdx > idx;
            const isError = currentStep === 'error' && idx === currentIdx;

            return (
              <View key={step.key} style={styles.stepRow}>
                <View style={styles.stepIndicatorCol}>
                  <View
                    style={[
                      styles.stepCircle,
                      isComplete && styles.stepCircleComplete,
                      isActive && !isError && styles.stepCircleActive,
                      isError && styles.stepCircleError,
                    ]}
                  >
                    {isComplete ? (
                      <Ionicons name="checkmark" size={18} color={COLORS.textWhite} />
                    ) : isActive && !isError ? (
                      <ActivityIndicator size="small" color={COLORS.textWhite} />
                    ) : isError ? (
                      <Ionicons name="close" size={18} color={COLORS.textWhite} />
                    ) : (
                      <Ionicons name={step.icon as any} size={18} color={COLORS.textMuted} />
                    )}
                  </View>
                  {idx < STEPS.length - 1 && (
                    <View style={[styles.stepLine, isComplete && styles.stepLineComplete]} />
                  )}
                </View>
                <View style={styles.stepContent}>
                  <Text style={[styles.stepLabel, (isActive || isComplete) && styles.stepLabelActive]}>
                    {step.label}
                  </Text>
                  {isActive && step.key === 'transcribing' && (
                    <Text style={styles.stepSubtext}>Converting speech to text using AI...</Text>
                  )}
                  {isActive && step.key === 'generating' && (
                    <Text style={styles.stepSubtext}>Creating structured notes with headings and key points...</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {currentStep === 'error' && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={24} color={COLORS.danger} />
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity testID="retry-processing-button" style={styles.retryBtn} onPress={retryProcessing}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {currentStep === 'done' && (
          <TouchableOpacity
            testID="view-notes-button"
            style={styles.viewNotesBtn}
            onPress={() => router.replace(`/notes/${id}`)}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text" size={20} color={COLORS.textWhite} />
            <Text style={styles.viewNotesBtnText}>View Notes</Text>
          </TouchableOpacity>
        )}
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
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.xxxl },
  stepsContainer: { gap: 0 },
  stepRow: { flexDirection: 'row', minHeight: 72 },
  stepIndicatorCol: { alignItems: 'center', width: 40 },
  stepCircle: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.border,
  },
  stepCircleComplete: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  stepCircleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepCircleError: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  stepLine: { width: 2, flex: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  stepLineComplete: { backgroundColor: COLORS.success },
  stepContent: { flex: 1, paddingLeft: SPACING.md, paddingTop: SPACING.sm },
  stepLabel: { fontSize: FONT_SIZES.md, color: COLORS.textMuted, fontWeight: '500' },
  stepLabelActive: { color: COLORS.textPrimary, fontWeight: '600' },
  stepSubtext: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted, marginTop: 4 },
  errorBox: {
    backgroundColor: COLORS.dangerLight, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl, alignItems: 'center', gap: SPACING.md, marginTop: SPACING.xxxl,
  },
  errorText: { fontSize: FONT_SIZES.md, color: COLORS.danger, textAlign: 'center' },
  retryBtn: {
    backgroundColor: COLORS.danger, paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md,
  },
  retryBtnText: { color: COLORS.textWhite, fontWeight: '600', fontSize: FONT_SIZES.md },
  viewNotesBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primary, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.xl,
    marginTop: SPACING.xxxl, elevation: 4, shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8,
  },
  viewNotesBtnText: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.textWhite },
});
