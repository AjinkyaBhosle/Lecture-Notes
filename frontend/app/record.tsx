import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, RecordingPresets, AudioModule } from 'expo-audio';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../src/utils/theme';
import { api } from '../src/utils/api';
import * as FileSystem from 'expo-file-system';

type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

const LANGUAGES = [
  { code: 'en', label: 'English', desc: 'Standard English' },
  { code: 'hi', label: 'Hindi', desc: 'Standard Hindi' },
  { code: 'mr', label: 'Marathi', desc: 'Marathi' },
  { code: 'auto', label: 'Auto-detect', desc: 'Auto-detect language' },
];

export default function RecordScreen() {
  const router = useRouter();
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en');
  const [lectureTitle, setLectureTitle] = useState('');
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const permissionGranted = useRef(false);

  // Animation values
  const pulseAnim1 = useRef(new Animated.Value(1)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      permissionGranted.current = status.status === 'granted';
    })();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (state === 'recording') {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim1, { toValue: 1.5, duration: 1500, useNativeDriver: true }),
            Animated.timing(pulseAnim1, { toValue: 1, duration: 0, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.delay(750),
            Animated.timing(pulseAnim2, { toValue: 1.5, duration: 1500, useNativeDriver: true }),
            Animated.timing(pulseAnim2, { toValue: 1, duration: 0, useNativeDriver: true }),
          ]),
        ])
      ).start();
    } else {
      pulseAnim1.setValue(1);
      pulseAnim2.setValue(1);
    }
  }, [state]);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startRecording = async () => {
    if (!permissionGranted.current) {
      Alert.alert('Permission Denied', 'Please enable microphone access in settings.');
      return;
    }

    try {
      // Ensure any previous session is cleared
      if (audioRecorder.isRecording) {
        await audioRecorder.stop();
      }
      
      const config = {
        ...RecordingPresets.HIGH_QUALITY,
      };
      
      await audioRecorder.prepareToRecordAsync(config);
      audioRecorder.record();
      setState('recording');
      startTimer();
    } catch (err: any) {
      console.error('Recording start failed:', err);
      Alert.alert('Recording Error', 'The microphone is currently unavailable. Please try restarting the app or checking your permissions.');
    }
  };

  const pauseRecording = async () => {
    try {
      audioRecorder.pause();
      setState('paused');
      stopTimer();
    } catch (err) {
      Alert.alert('Error', 'Failed to pause recording');
    }
  };

  const resumeRecording = async () => {
    try {
      audioRecorder.record();
      setState('recording');
      startTimer();
    } catch (err) {
      Alert.alert('Error', 'Failed to resume recording');
    }
  };

  const stopRecording = async () => {
    try {
      await audioRecorder.stop();
      setState('stopped');
      stopTimer();
    } catch (err) {
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const discardRecording = () => {
    Alert.alert('Discard Recording', 'Are you sure you want to delete this recording?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          setDuration(0);
          setState('idle');
        },
      },
    ]);
  };

  const saveAndProcess = async () => {
    const uri = audioRecorder.uri;
    if (!uri) {
      Alert.alert('Error', 'No recording found. Please try recording again.');
      setUploading(false);
      return;
    }

    setUploading(true);
    try {
      const finalTitle = lectureTitle.trim() || 'Untitled Lecture';
      const lecture = await api.createLecture(finalTitle);
      
      const fileUri = (FileSystem as any).cacheDirectory + `${lecture.id}.m4a`;
      
      try {
        await (FileSystem as any).copyAsync({
          from: uri,
          to: fileUri
        });
      } catch (copyErr) {
        console.error('File copy failed, using original URI:', copyErr);
      }

      router.replace(`/processing/${lecture.id}?language=${selectedLang}&audioUri=${encodeURIComponent(fileUri || uri)}&duration=${duration}`);
    } catch (err: any) {
      console.error('Save lecture failed:', err);
      setUploading(false);
      Alert.alert('Error', 'Failed to save lecture info. Please try again.');
    }
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const isRecording = state === 'recording';
  const isPaused = state === 'paused';
  const isStopped = state === 'stopped';
  const isIdle = state === 'idle';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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

        {/* Title Input */}
        <View style={styles.titleSection}>
          <TextInput
            style={styles.titleInput}
            placeholder="Enter lecture title..."
            placeholderTextColor={COLORS.textMuted}
            value={lectureTitle}
            onChangeText={setLectureTitle}
            editable={!uploading}
          />
        </View>

        {/* Timer Display */}
        <View style={styles.timerSection}>
          {isRecording && (
            <>
              <Animated.View
                style={[
                  styles.pulseOuter,
                  { transform: [{ scale: pulseAnim1 }], opacity: pulseAnim1.interpolate({ inputRange: [1, 1.5], outputRange: [0.4, 0] }) },
                ]}
              />
              <Animated.View
                style={[
                  styles.pulseOuter,
                  { transform: [{ scale: pulseAnim2 }], opacity: pulseAnim2.interpolate({ inputRange: [1, 1.5], outputRange: [0.25, 0] }) },
                ]}
              />
            </>
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
        <View style={styles.tipsSection}>
          {isIdle && (
            <>
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
              <View style={styles.tipsDivider} />
            </>
          )}
          
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
            <Text style={styles.tipText}>English, Hindi, Marathi & Auto-detect (Multilingual, quality may vary)</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: SPACING.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  titleSection: {
    paddingHorizontal: SPACING.xxxl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.background,
    zIndex: 10,
  },
  titleInput: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: SPACING.sm,
    textAlign: 'center',
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
    paddingTop: 60,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: SPACING.lg,
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
