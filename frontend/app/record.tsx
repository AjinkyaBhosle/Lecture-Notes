import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, RecordingPresets, AudioModule } from 'expo-audio';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../src/utils/theme';
import { api } from '../src/utils/api';

type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

const LANGUAGES = [
  { code: 'en', label: 'English', desc: 'Also handles Hinglish & En+Mar' },
  { code: 'hi', label: 'Hindi', desc: 'Devanagari output' },
  { code: 'mr', label: 'Marathi', desc: 'Devanagari output' },
  { code: 'auto', label: 'Auto (experimental)', desc: 'Let AI detect language' },
];

export default function RecordScreen() {
  const router = useRouter();
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en');
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const permissionGranted = useRef(false);

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission Required', 'Microphone access is needed to record lectures.');
      } else {
        permissionGranted.current = true;
      }
    })();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (totalSecs: number) => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      if (!permissionGranted.current) {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) {
          Alert.alert('Permission Required', 'Microphone access is needed.');
          return;
        }
        permissionGranted.current = true;
      }

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setState('recording');
      setDuration(0);
      startTimer();
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const pauseRecording = async () => {
    try {
      audioRecorder.pause();
      setState('paused');
      stopTimer();
    } catch (err) {
      console.error('Failed to pause:', err);
    }
  };

  const resumeRecording = async () => {
    try {
      audioRecorder.record();
      setState('recording');
      startTimer();
    } catch (err) {
      console.error('Failed to resume:', err);
    }
  };

  const stopRecording = async () => {
    try {
      stopTimer();
      await audioRecorder.stop();
      setState('stopped');
    } catch (err) {
      console.error('Failed to stop:', err);
    }
  };

  const saveAndProcess = async () => {
    const uri = audioRecorder.uri;
    if (!uri) {
      Alert.alert('Error', 'No recording found');
      return;
    }

    setUploading(true);
    try {
      // Create lecture
      const lecture = await api.createLecture('Untitled Lecture');

      // Upload audio
      await api.uploadAudio(lecture.id, uri, duration);

      // Navigate to processing with language param
      router.replace(`/processing/${lecture.id}?language=${selectedLang}`);
    } catch (err: any) {
      console.error('Save failed:', err);
      Alert.alert('Upload Failed', err?.message || 'Could not upload the recording. Please try again.');
      setUploading(false);
    }
  };

  const discardRecording = () => {
    Alert.alert(
      'Discard Recording',
      'Are you sure you want to discard this recording?',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setState('idle');
            setDuration(0);
            router.back();
          },
        },
      ]
    );
  };

  const isRecording = state === 'recording';
  const isPaused = state === 'paused';
  const isStopped = state === 'stopped';
  const isIdle = state === 'idle';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="record-back-button"
          onPress={() => {
            if (isRecording || isPaused) {
              discardRecording();
            } else {
              router.back();
            }
          }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isIdle ? 'New Recording' : isStopped ? 'Recording Complete' : 'Recording'}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Timer Display */}
      <View style={styles.timerSection}>
        {isRecording && (
          <View style={styles.pulseOuter}>
            <View style={styles.pulseInner} />
          </View>
        )}
        <View style={styles.timerCircle}>
          <Ionicons
            name={isRecording ? 'mic' : isPaused ? 'pause' : 'mic-outline'}
            size={32}
            color={isRecording ? COLORS.danger : COLORS.primary}
          />
        </View>
        <Text style={styles.timerText}>{formatTime(duration)}</Text>
        <Text style={styles.timerLabel}>
          {isIdle
            ? 'Ready to record'
            : isRecording
            ? 'Recording in progress...'
            : isPaused
            ? 'Recording paused'
            : 'Recording saved'}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controlsSection}>
        {isIdle && (
          <TouchableOpacity
            testID="start-recording-button"
            style={styles.recordButton}
            onPress={startRecording}
            activeOpacity={0.8}
          >
            <Ionicons name="mic" size={32} color={COLORS.textWhite} />
            <Text style={styles.recordBtnText}>Start Recording</Text>
          </TouchableOpacity>
        )}

        {isRecording && (
          <View style={styles.controlRow}>
            <TouchableOpacity
              testID="pause-recording-button"
              style={styles.controlBtn}
              onPress={pauseRecording}
              activeOpacity={0.7}
            >
              <Ionicons name="pause" size={28} color={COLORS.primary} />
              <Text style={styles.controlLabel}>Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="stop-recording-button"
              style={styles.stopButton}
              onPress={stopRecording}
              activeOpacity={0.8}
            >
              <View style={styles.stopIcon} />
            </TouchableOpacity>
            <View style={{ width: 70, alignItems: 'center' }}>
              <Text style={styles.controlLabel}> </Text>
            </View>
          </View>
        )}

        {isPaused && (
          <View style={styles.controlRow}>
            <TouchableOpacity
              testID="resume-recording-button"
              style={styles.controlBtn}
              onPress={resumeRecording}
              activeOpacity={0.7}
            >
              <Ionicons name="play" size={28} color={COLORS.success} />
              <Text style={styles.controlLabel}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="stop-recording-button-paused"
              style={styles.stopButton}
              onPress={stopRecording}
              activeOpacity={0.8}
            >
              <View style={styles.stopIcon} />
            </TouchableOpacity>
            <View style={{ width: 70, alignItems: 'center' }}>
              <Text style={styles.controlLabel}> </Text>
            </View>
          </View>
        )}

        {isStopped && (
          <View style={styles.stoppedControls}>
            <TouchableOpacity
              testID="save-and-process-button"
              style={styles.processButton}
              onPress={saveAndProcess}
              activeOpacity={0.8}
              disabled={uploading}
            >
              {uploading ? (
                <Text style={styles.processBtnText}>Uploading...</Text>
              ) : (
                <>
                  <Ionicons name="sparkles" size={20} color={COLORS.textWhite} />
                  <Text style={styles.processBtnText}>Generate Notes</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              testID="discard-recording-button"
              style={styles.discardButton}
              onPress={discardRecording}
              activeOpacity={0.7}
            >
              <Text style={styles.discardBtnText}>Discard</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Language Selector + Tips */}
      {isIdle && (
        <View style={styles.tipsSection}>
          <Text style={styles.tipsTitle}>Lecture Language</Text>
          <View style={styles.langGrid}>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                testID={`lang-${lang.code}`}
                style={[
                  styles.langChip,
                  selectedLang === lang.code && styles.langChipActive,
                ]}
                onPress={() => setSelectedLang(lang.code)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.langChipText,
                    selectedLang === lang.code && styles.langChipTextActive,
                  ]}
                >
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.langDesc}>
            {LANGUAGES.find((l) => l.code === selectedLang)?.desc}
          </Text>

          <View style={styles.tipsDivider} />
          <Text style={styles.tipsTitle}>Tips for best results</Text>
          <View style={styles.tipItem}>
            <Ionicons name="volume-medium-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.tipText}>Place phone near the speaker</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="wifi-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.tipText}>Internet needed for AI processing</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="language-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.tipText}>Supports English, Hindi, Marathi & Hinglish</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  timerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  pulseOuter: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  timerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    marginBottom: SPACING.xl,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  timerText: {
    fontSize: FONT_SIZES.timer,
    fontWeight: '200',
    color: COLORS.textPrimary,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },
  controlsSection: {
    paddingHorizontal: SPACING.xxxl,
    paddingBottom: SPACING.xxxl,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  recordBtnText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textWhite,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.xxxl,
  },
  controlBtn: {
    width: 70,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  controlLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  stopButton: {
    width: 72,
    height: 72,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  stopIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: COLORS.textWhite,
  },
  stoppedControls: {
    gap: SPACING.md,
  },
  processButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  processBtnText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textWhite,
  },
  discardButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  discardBtnText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  tipsSection: {
    paddingHorizontal: SPACING.xxxl,
    paddingBottom: SPACING.xxxl,
    gap: SPACING.md,
  },
  tipsTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  langChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  langChipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  langChipText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  langChipTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  langDesc: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  tipsDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  tipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
});
