import React, { useRef, useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  PanResponder, 
  TouchableOpacity, 
  Text, 
  Image, 
  Animated, 
  Dimensions, 
  PixelRatio, 
  ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';
import Svg, { Path, Circle } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../_layout';
import { getCharacter } from '../../constants/characterLibrary';
import {
  ENDPOINT_TOLERANCE,
  MIN_MOVES,
  REQUIRED_COVERAGE,
  TRACE_TOLERANCE,
  analyseStrokes,
  dotTolerance,
  fitTracingCanvas,
  markCoveredSegments,
  requiredHits,
} from '../../lib/tracing';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 375;
const normalize = (size: number) => Math.round(PixelRatio.roundToNearestPixel(size * scale));
const isTablet = SCREEN_WIDTH > 550;

// Keep the drawing area at the character's 2:3 aspect ratio so touches map 1:1.
const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = fitTracingCanvas(
  SCREEN_WIDTH * 0.9,
  SCREEN_HEIGHT * 0.55
);

export default function SandboxScreen() {
  const router = useRouter();
  const { lang } = useLanguage();
  const params = useLocalSearchParams();
  
  const selectedChar = (params.selectedChar as string) || 'A';
  const studentName = (params.studentName as string) || (params.nickname as string) || 'mae';
  const activeAvatar = ((params.activeAvatar as string) || (params.avatar as string) || 'tiger').toLowerCase();
  
  const charData = getCharacter(selectedChar);

  const [paths, setPaths] = useState<string[]>([]);
  const [isOnPath, setIsOnPath] = useState<boolean>(true);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [accuracy, setAccuracy] = useState<number>(100); 
  
  const [earnedStars, setEarnedStars] = useState<number>(3);
  
  const hitPoints = useRef<number[]>([]);
  const totalPointsCount = charData.points.length;
  const hitsNeeded = requiredHits(totalPointsCount);
  const [hitIds, setHitIds] = useState<number[]>([]);
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [cardScale] = useState(() => new Animated.Value(0.86));
  const [starAnims] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));
  const [rewardReady, setRewardReady] = useState(false);
  const rewardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalMoves = useRef<number>(0);
  const errorMoves = useRef<number>(0);
  const finishedRef = useRef<boolean>(false);
  const coveredSegments = useRef<Set<number>>(new Set());
  /** Raw points of every stroke drawn in this attempt — powers undo. */
  const strokePoints = useRef<{ x: number; y: number }[][]>([]);

  // Haptics: the tactile "texture" of the stroke is a core part of the game.
  const lastHapticPoint = useRef<{ x: number; y: number } | null>(null);
  const lastHapticTime = useRef<number>(0);
  const lastWarnTime = useRef<number>(0);

  const phoneticPlayerRef = useRef<any>(null);
  const successPlayerRef = useRef<any>(null);
  const errorPlayerRef = useRef<any>(null);
  const lastErrorSoundTime = useRef<number>(0);

  /** Light tick every few centimetres so the child can feel the stroke. */
  const pulseHaptic = (x: number, y: number) => {
    const now = Date.now();
    const last = lastHapticPoint.current;
    const moved = last ? Math.hypot(x - last.x, y - last.y) : Number.POSITIVE_INFINITY;
    if (moved < 38 || now - lastHapticTime.current < 45) return;
    lastHapticPoint.current = { x, y };
    lastHapticTime.current = now;
    Haptics.selectionAsync();
  };

  /** Warn at most a few times per second so the phone does not buzz nonstop. */
  const warnHaptic = () => {
    const now = Date.now();
    if (now - lastWarnTime.current < 350) return;
    lastWarnTime.current = now;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  /** Recomputes dots/coverage/accuracy from the strokes still on screen. */
  const rebuildProgress = () => {
    const analysis = analyseStrokes(
      strokePoints.current,
      charData.points,
      charData.segments,
      TRACE_TOLERANCE,
      ENDPOINT_TOLERANCE
    );
    hitPoints.current = analysis.hits;
    coveredSegments.current = analysis.covered;
    totalMoves.current = analysis.moves;
    errorMoves.current = analysis.offPath;
    setHitIds(analysis.hits);
  };

  const handleReset = () => {
    setPaths([]);
    setIsOnPath(true);
    setIsFinished(false);
    hitPoints.current = [];
    setHitIds([]);
    totalMoves.current = 0;
    errorMoves.current = 0;
    finishedRef.current = false;
    coveredSegments.current.clear();
    strokePoints.current = [];
    lastHapticPoint.current = null;
    lastHapticTime.current = 0;
    lastWarnTime.current = 0;
    fadeAnim.setValue(0);
    cardScale.setValue(0.86);
    starAnims.forEach((anim) => anim.setValue(0));
    if (rewardTimer.current) clearTimeout(rewardTimer.current);
    rewardTimer.current = null;
    setRewardReady(false);
    setAccuracy(100);
  };

  /** Removes the last stroke and rebuilds the progress from what remains. */
  const handleUndo = () => {
    if (finishedRef.current || strokePoints.current.length === 0) return;
    strokePoints.current.pop();
    setPaths((prev) => prev.slice(0, -1));
    rebuildProgress();
    lastHapticPoint.current = null;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleExitOrContinue = () => {
    router.replace('/parent-dashboard' as any);
  };

  useEffect(() => {
    try {
      if (phoneticPlayerRef.current) {
        phoneticPlayerRef.current.remove();
        phoneticPlayerRef.current = null;
      }
      if (successPlayerRef.current) {
        successPlayerRef.current.remove();
        successPlayerRef.current = null;
      }

      if (charData.phoneticSound) {
        const pPlayer = createAudioPlayer(charData.phoneticSound);
        pPlayer.loop = true;
        pPlayer.volume = 0.7;
        phoneticPlayerRef.current = pPlayer;
      }

      if (charData.wordSound) {
        successPlayerRef.current = createAudioPlayer(charData.wordSound);
      }
    } catch (e) {
      console.log("Error initializing character audio players:", e);
    }

    // Resetting tracing state on character change is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleReset(); 

    return () => {
      try {
        if (phoneticPlayerRef.current) phoneticPlayerRef.current.remove();
        if (successPlayerRef.current) successPlayerRef.current.remove();
      } catch {}
    };
    // handleReset only touches stable setters/refs, so it is intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChar, charData.phoneticSound, charData.wordSound]);

  useEffect(() => {
    try {
      errorPlayerRef.current = createAudioPlayer(require('../../assets/sounds/error.mp3'));
    } catch (e) {
      console.log("Error initializing static audio players:", e);
    }

    return () => {
      try {
        if (errorPlayerRef.current) errorPlayerRef.current.remove();
      } catch {}
    };
  }, []);

  // Clear any pending reward timer if the screen closes mid-reveal.
  useEffect(() => {
    return () => {
      if (rewardTimer.current) clearTimeout(rewardTimer.current);
    };
  }, []);

  const saveLocalHomePractice = async (finalAccuracy: number) => {
    setSaving(true);
    try {
      const practiceRecord = {
        nickname: studentName,
        avatar: activeAvatar,
        accuracy: `${finalAccuracy}%`,
        duration: "30s",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        school: "Home Sandbox Practice"
      };

      const existingHistory = await AsyncStorage.getItem('@parent_sync_history');
      let historyArray = existingHistory ? JSON.parse(existingHistory) : [];
      historyArray.unshift(practiceRecord);

      await AsyncStorage.setItem('@parent_sync_history', JSON.stringify(historyArray));
    } catch {
      console.log("Saved practice locally.");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Forgiving completion: most guide dots reached, most of the line traced,
   * and real movement (not a single tap). Runs on every touch and on release.
   */
  const tryFinish = () => {
    if (finishedRef.current) return;

    const dotsHit = new Set(hitPoints.current).size;
    const totalSegments = charData.segments.length;
    const coverage = totalSegments > 0 ? coveredSegments.current.size / totalSegments : 0;
    if (
      dotsHit < hitsNeeded ||
      coverage < REQUIRED_COVERAGE ||
      totalMoves.current < MIN_MOVES
    ) {
      return;
    }

    finishedRef.current = true;

    const calculatedScore = Math.max(50, Math.round(((totalMoves.current - errorMoves.current) / totalMoves.current) * 100));

    let stars = 1;
    if (calculatedScore >= 90) stars = 3;
    else if (calculatedScore >= 75) stars = 2;

    setAccuracy(calculatedScore);
    setEarnedStars(stars);
    setIsFinished(true);
    setIsOnPath(true);

    if (phoneticPlayerRef.current) {
      try { phoneticPlayerRef.current.pause(); } catch {}
    }

    if (successPlayerRef.current) {
      try {
        successPlayerRef.current.seekTo(0);
        successPlayerRef.current.play();
      } catch {}
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    saveLocalHomePractice(calculatedScore);

    // Reward reveal: a short pause lets the finished letter register first,
    // then the card eases in and the stars pop one by one.
    fadeAnim.setValue(0);
    cardScale.setValue(0.86);
    starAnims.forEach((anim) => anim.setValue(0));

    // Keep the card non-interactive until it is actually visible.
    setRewardReady(false);
    if (rewardTimer.current) clearTimeout(rewardTimer.current);
    rewardTimer.current = setTimeout(() => setRewardReady(true), 400);

    Animated.parallel([
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(400),
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }),
      ]),
      ...starAnims.map((anim, index) =>
        Animated.sequence([
          Animated.delay(760 + index * 140),
          Animated.spring(anim, {
            toValue: 1,
            friction: 5,
            tension: 110,
            useNativeDriver: true,
          }),
        ])
      ),
    ]).start();
  };

  const registerTouch = (x: number, y: number) => {
    if (finishedRef.current) return;
    totalMoves.current += 1;

    // 1. Mark every guide dot the finger reached. Endpoint dots are more
    // forgiving, so a child who starts slightly off still gets credit.
    let gainedDot = false;
    charData.points.forEach((point: any) => {
      if (hitPoints.current.includes(point.id)) return;
      if (Math.hypot(x - point.x, y - point.y) <= dotTolerance(point)) {
        hitPoints.current.push(point.id);
        gainedDot = true;
      }
    });
    if (gainedDot) {
      setHitIds([...hitPoints.current]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // 2. Track coverage + check the finger is still inside the writing lane.
    const distance = markCoveredSegments(
      x,
      y,
      charData.segments,
      TRACE_TOLERANCE,
      coveredSegments.current
    );

    if (distance <= TRACE_TOLERANCE) {
      setIsOnPath(true);
      // Continuous light ticks let the child feel the stroke under their finger.
      pulseHaptic(x, y);
    } else {
      setIsOnPath(false);
      errorMoves.current += 1;
      warnHaptic();

      const now = Date.now();
      if (now - lastErrorSoundTime.current > 1200 && errorPlayerRef.current) {
        lastErrorSoundTime.current = now;
        try {
          errorPlayerRef.current.seekTo(0);
          errorPlayerRef.current.play();
        } catch {}
      }
    }

    // 3. Reward as soon as the shape is done — no need to lift the finger first.
    tryFinish();
  };

  // PanResponder callbacks run in gesture handlers, not during render; refs are safe here.
  // eslint-disable-next-line react-hooks/refs
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !finishedRef.current,
      onMoveShouldSetPanResponder: () => !finishedRef.current,
      
      onPanResponderGrant: (evt) => {
        if (finishedRef.current) return;
        const { locationX, locationY } = evt.nativeEvent;
        const svgX = (locationX / CANVAS_WIDTH) * 400;
        const svgY = (locationY / CANVAS_HEIGHT) * 600;
        strokePoints.current.push([{ x: svgX, y: svgY }]);
        lastHapticPoint.current = { x: svgX, y: svgY };
        lastHapticTime.current = Date.now();
        setPaths((prev) => [...prev, `M${svgX.toFixed(1)},${svgY.toFixed(1)}`]);
        registerTouch(svgX, svgY);

        if (phoneticPlayerRef.current) {
          try { phoneticPlayerRef.current.play(); } catch {}
        }
      },

      onPanResponderMove: (evt) => {
        if (finishedRef.current) return;
        const { locationX, locationY } = evt.nativeEvent;
        const svgX = (locationX / CANVAS_WIDTH) * 400;
        const svgY = (locationY / CANVAS_HEIGHT) * 600;

        const currentStroke = strokePoints.current[strokePoints.current.length - 1];
        if (currentStroke) currentStroke.push({ x: svgX, y: svgY });

        setPaths((prev) => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          updated[updated.length - 1] = `${updated[updated.length - 1]} L${svgX.toFixed(1)},${svgY.toFixed(1)}`;
          return updated;
        });
        registerTouch(svgX, svgY);
      },

      onPanResponderRelease: () => {
        if (phoneticPlayerRef.current) {
          try { phoneticPlayerRef.current.pause(); } catch {}
        }
        tryFinish();
      },

      // Android can steal the gesture (notification, parent scroll). Without this
      // a finished shape would never unlock the reward.
      onPanResponderTerminate: () => {
        if (phoneticPlayerRef.current) {
          try { phoneticPlayerRef.current.pause(); } catch {}
        }
        tryFinish();
      },
    })
  );

  return (
    <SafeAreaProvider>
      <View style={[styles.container, !isOnPath && styles.errorBg]}>
        
        <SafeAreaView edges={['top']} style={styles.overlay}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.backBtn} onPress={handleExitOrContinue}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>

            <View style={[styles.statusBadge, { backgroundColor: isFinished ? '#DCFCE7' : (isOnPath ? '#FEF3C7' : '#FEE2E2') }]}>
              <Text style={styles.statusText}>
                {isFinished 
                  ? (lang === 'ph' ? `ANG GALING, ${studentName.toUpperCase()}!` : `GREAT JOB, ${studentName.toUpperCase()}!`) 
                  : !isOnPath
                    ? (lang === 'ph' ? 'LUMAMPAS!' : 'OOPS!')
                    : hitIds.length >= hitsNeeded
                      ? (lang === 'ph' ? 'TAPUSIN NA!' : 'FINISH IT!')
                      : (lang === 'ph' ? 'BAKASIN MO' : 'TRACE ME')}
              </Text>
            </View>

            <View style={styles.topActions}>
              <TouchableOpacity
                style={[styles.backBtn, (paths.length === 0 || isFinished) && styles.backBtnDisabled]}
                onPress={handleUndo}
                disabled={paths.length === 0 || isFinished}
                accessibilityLabel={lang === 'ph' ? 'I-undo ang huling guhit' : 'Undo last stroke'}
              >
                <Ionicons name="arrow-undo" size={22} color="#333" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backBtn}
                onPress={handleReset}
                accessibilityLabel={lang === 'ph' ? 'Ulitin mula sa simula' : 'Start over'}
              >
                <Ionicons name="refresh" size={22} color="#333" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Live progress so the child can see how much is left */}
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, Math.round((hitIds.length / hitsNeeded) * 100))}%` },
                ]}
              />
            </View>
            <Text style={styles.progressLabel}>
              {`${Math.min(hitIds.length, totalPointsCount)}/${totalPointsCount}`}
            </Text>
          </View>
        </SafeAreaView>

        <View style={styles.svgWrapper} {...panResponder.panHandlers}>
          <Svg height={CANVAS_HEIGHT} width={CANVAS_WIDTH} viewBox="0 0 400 600" style={styles.svgBorderContainer}>
            <Path d={charData.path} fill="none" stroke="#EAEAEA" strokeWidth={isTablet ? 95 : 80} strokeLinecap="round" strokeLinejoin="round" />
            <Path 
              d={charData.path} 
              fill="none" 
              stroke={isFinished ? "#4ADE80" : (isOnPath ? "#FED7AA" : "#FCA5A5")} 
              strokeWidth={isTablet ? 80 : 65} 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            {paths.map((strokePath, index) => (
              <Path 
                key={index}
                d={strokePath} 
                fill="none" 
                stroke={isOnPath ? "#F77F67" : "#EF4444"} 
                strokeWidth={isTablet ? 16 : 12} 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            ))}
            {!isFinished && charData.points.map((pt: any, index: number) => {
              const isHit = hitIds.includes(pt.id);
              const isStart = index === 0 && hitIds.length === 0;
              return (
                <Circle
                  key={pt.id}
                  cx={pt.x}
                  cy={pt.y}
                  r={isHit ? (isTablet ? 12 : 9) : (isStart ? (isTablet ? 20 : 16) : (isTablet ? 14 : 11))}
                  fill={isHit ? '#22C55E' : (isStart ? '#2563EB' : '#EF4444')}
                  opacity={isHit ? 0.45 : 1}
                />
              );
            })}
          </Svg>
        </View>

        {isFinished && (
          <Animated.View
            pointerEvents={rewardReady ? 'auto' : 'none'}
            style={[
              styles.successContent,
              { opacity: fadeAnim, transform: [{ scale: cardScale }] },
            ]}
          >
            <View style={styles.rewardBadgeRow}>
              <Ionicons name="trophy" size={normalize(16)} color="#B45309" />
              <Text style={styles.rewardBadgeText}>
                {lang === 'ph' ? 'BAGONG STICKER!' : 'NEW STICKER!'}
              </Text>
            </View>

            <View style={styles.rewardHeaderRow}>
              <Text style={styles.rewardTitle}>
                {lang === 'ph'
                  ? `NAKUMBIDA MO ANG TITIK ${selectedChar}, ${studentName.toUpperCase()}!`
                  : `YOU TRACED THE LETTER ${selectedChar}, ${studentName.toUpperCase()}!`}
              </Text>
              <Text style={styles.rewardSubtitle}>
                {lang === 'ph'
                  ? `Ang galing! Narito ang sticker mo para sa "${charData.word}".`
                  : `Great job! Here is your sticker for "${charData.word}".`}
              </Text>
            </View>

            <View style={styles.starsRewardRow}>
              {starAnims.map((anim, index) => (
                <Animated.View key={index} style={{ transform: [{ scale: anim }] }}>
                  <Ionicons
                    name="star"
                    size={normalize(index === 1 ? 34 : 26)}
                    color={earnedStars > index ? '#FBBF24' : '#E5E7EB'}
                    style={index === 1 ? { marginTop: -6 } : undefined}
                  />
                </Animated.View>
              ))}
            </View>

            <View style={styles.stickerEmblemFrameBox}>
              {charData.image ? (
                <Image source={charData.image} style={styles.anchorImage} resizeMode="contain" />
              ) : (
                <View style={styles.anchorImageFallback}>
                  <Text style={styles.anchorImageFallbackText}>{selectedChar}</Text>
                </View>
              )}
              <Text style={styles.stickerBadgePillLabel}>
                {selectedChar} - {charData.word}
              </Text>
            </View>

            <Text style={styles.anchorTextDescription}>
              {lang === 'ph'
                ? 'Ligtas na na-save ang sticker sa offline book.'
                : 'Your sticker has been saved to your offline book.'}
            </Text>

            <Text style={styles.accuracyPillTextBadge}>
              {lang === 'ph' ? `Katumpakan: ${accuracy}%` : `Accuracy: ${accuracy}%`}
            </Text>

            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={handleReset}>
                <Ionicons name="refresh" size={18} color="#555" style={{ marginRight: 4 }} />
                <Text style={styles.modalBtnTextSec}>{lang === 'ph' ? 'Ulitin' : 'Retry'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalBtn} onPress={handleExitOrContinue} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.modalBtnText}>{lang === 'ph' ? 'Ipagpatuloy' : 'Continue'}</Text>
                    <Ionicons name="arrow-forward" size={18} color="white" style={{ marginLeft: 4 }} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEB', justifyContent: 'center', alignItems: 'center' },
  errorBg: { backgroundColor: '#FFF0F0' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: '6%', paddingTop: 10, zIndex: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 3 },
  backBtnDisabled: { opacity: 0.35 },
  statusBadge: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20, elevation: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, width: '100%' },
  progressTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#FDE68A', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: '#F77F67' },
  progressLabel: { marginLeft: 10, fontSize: normalize(11), fontWeight: '900', color: '#92400E' },
  statusText: { fontWeight: '900', fontSize: normalize(12), color: '#333', letterSpacing: 0.5 },
  svgWrapper: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  svgBorderContainer: { backgroundColor: 'white', borderRadius: 30, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
  
  successContent: { position: 'absolute', backgroundColor: 'white', padding: 25, paddingTop: 22, borderRadius: 35, borderWidth: 3, borderColor: '#FDE68A', alignItems: 'center', elevation: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, width: isTablet ? 450 : '88%', zIndex: 30 },
  rewardTitle: { fontSize: normalize(16), fontWeight: '900', color: '#F77F67', textAlign: 'center', letterSpacing: 0.3 },
  rewardSubtitle: { fontSize: normalize(11), color: '#666', textAlign: 'center', marginTop: 6, paddingHorizontal: 10, lineHeight: 15 },
  rewardBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, marginBottom: 10 },
  rewardBadgeText: { fontSize: normalize(10), fontWeight: '900', color: '#B45309', letterSpacing: 0.8 },
  rewardHeaderRow: { alignItems: 'center', width: '100%' },
  starsRewardRow: { flexDirection: 'row', gap: 6, marginVertical: 10, justifyContent: 'center', alignItems: 'center' },
  stickerEmblemFrameBox: { backgroundColor: '#F0FDF4', borderWidth: 3, borderColor: '#4ADE80', borderRadius: 25, padding: 15, marginVertical: 10, alignItems: 'center', width: '90%' },
  anchorImage: { width: isTablet ? 180 : 130, height: isTablet ? 180 : 130, marginBottom: 8 },
  anchorImageFallback: { width: isTablet ? 180 : 130, height: isTablet ? 180 : 130, marginBottom: 8, borderRadius: 24, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  anchorImageFallbackText: { fontSize: normalize(64), fontWeight: '900', color: '#16A34A' },
  stickerBadgePillLabel: { backgroundColor: '#4ADE80', color: '#141414', fontWeight: '900', fontSize: normalize(9), paddingHorizontal: 12, paddingVertical: 3, borderRadius: 10, textTransform: 'uppercase' },
  anchorTextDescription: { fontSize: normalize(11), fontWeight: '700', color: '#4B5563', marginBottom: 12, textAlign: 'center', paddingHorizontal: 5, lineHeight: 16 },
  accuracyPillTextBadge: { fontSize: normalize(11), color: '#16A34A', fontWeight: '900', backgroundColor: '#DCFCE7', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, alignSelf: 'center', marginBottom: 18 },

  btnRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 10 },
  modalBtn: { flex: 1, backgroundColor: '#F77F67', paddingVertical: 14, borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 2, flexDirection: 'row' },
  modalBtnSecondary: { backgroundColor: '#F3F4F6' },
  modalBtnText: { color: 'white', fontWeight: '900', fontSize: normalize(12) },
  modalBtnTextSec: { color: '#555', fontWeight: '900', fontSize: normalize(12) }
});