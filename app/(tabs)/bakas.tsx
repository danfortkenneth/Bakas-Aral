import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, PanResponder, TouchableOpacity, Text, Image, Animated, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createAudioPlayer } from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { normalizeFor, useResponsive } from '../../lib/responsive';
import { haptics } from '../../lib/haptics';
import TraceCanvas from '../../components/TraceCanvas';
import SpeakingAvatar, { type AvatarLine } from '../../components/SpeakingAvatar';
import { db } from '../../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useLanguage } from '../_layout';
import { FINISH_PHRASES, LETTER_COLORS, PHONETIC_PHRASES, getCharacter } from '../../constants/characterLibrary';
import {
  ENDPOINT_TOLERANCE,
  MIN_MOVES,
  REQUIRED_COVERAGE,
  TRACE_TOLERANCE,
  allStrokesTraced,
  analyseStrokes,
  dotTolerance,
  fitTracingCanvas,
  markCoveredSegments,
  markStrokeCoverage,
  requiredHits,
} from '../../lib/tracing';

// Initial metrics for the static stylesheet. The live canvas below uses
// useResponsive() so split-screen / foldable resizes still map touches 1:1.
const INITIAL_WIDTH = Dimensions.get('window').width;
const INITIAL_HEIGHT = Dimensions.get('window').height;
const normalize = (size: number) => normalizeFor(INITIAL_WIDTH, size);
const isTablet = Math.min(INITIAL_WIDTH, INITIAL_HEIGHT) >= 600;

/** Header content height below the top safe-area inset. */
const HEADER_SPACE = 88;
/** Clearance for the floating tab bar that overlays this tab screen. */
const TAB_BAR_SPACE = 112;
const r = (value: number) => Math.round(value * 10) / 10;

export default function BakasScreen() {
  const router = useRouter();
  const { lang } = useLanguage();
  const params = useLocalSearchParams();

  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight, isTablet: isTabletDevice } = useResponsive();

  // The canvas fills the space under the header and above the floating tab bar,
  // kept at the character's 2:3 ratio so touches map 1:1 to the 400×600 viewBox
  // on every device.
  const canvas = fitTracingCanvas(
    windowWidth * 0.92,
    Math.max(160, windowHeight - insets.top - HEADER_SPACE - TAB_BAR_SPACE)
  );
  const canvasRef = useRef(canvas);
  useEffect(() => {
    canvasRef.current = { width: canvas.width, height: canvas.height };
  }, [canvas.width, canvas.height]);
  
  const selectedChar = (params.selectedChar as string) || 'A';
  const studentId = (params.currentStudentId as string) || null;
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
  /** Covered portions of the guide line, drawn as the purple traced fill. */
  const [fillPaths, setFillPaths] = useState<string[]>([]);
  /** Bee position in viewBox coordinates. */
  const [beePos, setBeePos] = useState<{ x: number; y: number }>(() => {
    const first = charData.points[0];
    return first ? { x: first.x, y: first.y } : { x: 200, y: 300 };
  });
  /** What the side avatar says and when to say it again. */
  const [avatarLine, setAvatarLine] = useState<AvatarLine>(() => ({
    ph: `Sundan ang mga puting tuldok para mabuo ang ${selectedChar}. Simulan sa bee!`,
    en: `Follow the white dots to make ${selectedChar}. Start at the bee!`,
  }));
  const [avatarTrigger, setAvatarTrigger] = useState(0);

  /** Lines are rebuilt from the current character so the avatar stays in sync. */
  const instructionLine = (): AvatarLine => ({
    ph: `Sundan ang mga puting tuldok para mabuo ang ${selectedChar}. Simulan sa bee!`,
    en: `Follow the white dots to make ${selectedChar}. Start at the bee!`,
  });
  const successLine = (): AvatarLine => ({
    ph: `Ang galing! Tapos na ang ${selectedChar}. Narito ang sticker mo!`,
    en: `Great job! You finished ${selectedChar}. Here is your sticker!`,
  });
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [cardScale] = useState(() => new Animated.Value(0.86));
  const [starAnims] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));
  const [rewardReady, setRewardReady] = useState(false);
  const rewardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalMoves = useRef<number>(0);
  const errorMoves = useRef<number>(0);
  const finishedRef = useRef<boolean>(false);
  const coveredSegments = useRef<Set<number>>(new Set());
  /** Only segments of the stroke under the finger — drives the violet fill. */
  const fillSegments = useRef<Set<number>>(new Set());
  /** Raw points of every stroke drawn in this attempt — powers undo. */
  const strokePoints = useRef<{ x: number; y: number }[][]>([]);

  /**
   * Builds SVG sub-paths out of the covered guide segments so the purple fill
   * always follows the letter exactly, even when a child's finger wanders a
   * little inside the generous tracing tolerance.
   */
  const computeFillPaths = () => {
    const covered = fillSegments.current;
    const segments = charData.segments;
    const result: string[] = [];
    let current = '';
    let previousEnd: { x: number; y: number } | null = null;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (!covered.has(i)) {
        if (current) result.push(current);
        current = '';
        previousEnd = null;
        continue;
      }

      const breaksStroke =
        !current ||
        !previousEnd ||
        Math.hypot(segment.x1 - previousEnd.x, segment.y1 - previousEnd.y) > 1;

      if (breaksStroke) {
        if (current) result.push(current);
        current = `M${r(segment.x1)},${r(segment.y1)}`;
      }
      current += ` L${r(segment.x2)},${r(segment.y2)}`;
      previousEnd = { x: segment.x2, y: segment.y2 };
    }
    if (current) result.push(current);
    setFillPaths(result);
  };

  // Haptics: the tactile "texture" of the stroke is a core part of the game.
  const lastHapticPoint = useRef<{ x: number; y: number } | null>(null);
  const lastHapticTime = useRef<number>(0);
  const lastWarnTime = useRef<number>(0);

  const successPlayerRef = useRef<any>(null);
  const errorPlayerRef = useRef<any>(null);
  const lastErrorSoundTime = useRef<number>(0);
  const onPathRef = useRef(true);

  /** Light tick every few centimetres so the child can feel the stroke. */
  const pulseHaptic = (x: number, y: number) => {
    const now = Date.now();
    const last = lastHapticPoint.current;
    const moved = last ? Math.hypot(x - last.x, y - last.y) : Number.POSITIVE_INFINITY;
    if (moved < 38 || now - lastHapticTime.current < 45) return;
    lastHapticPoint.current = { x, y };
    lastHapticTime.current = now;
    haptics.tick();
  };

  /** Warn at most a few times per second so the phone does not buzz nonstop. */
  const warnHaptic = () => {
    const now = Date.now();
    if (now - lastWarnTime.current < 350) return;
    lastWarnTime.current = now;
    haptics.offPath();
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
  fillSegments.current = analysis.fillCovered;
    totalMoves.current = analysis.moves;
    errorMoves.current = analysis.offPath;
    setHitIds(analysis.hits);
    computeFillPaths();
    const next = charData.points.find((point: any) => !analysis.hits.includes(point.id));
    setBeePos(next ? { x: next.x, y: next.y } : { x: 200, y: 300 });
  };

  // Plain function: every dependency here is a stable setter or ref, so a fresh
  // identity each render is harmless and keeps the React Compiler happy.
  const handleReset = () => {
    setPaths([]);
    setIsOnPath(true);
    onPathRef.current = true;
    setIsFinished(false);
    hitPoints.current = [];
    setHitIds([]);
    totalMoves.current = 0;
    errorMoves.current = 0;
    finishedRef.current = false;
    coveredSegments.current.clear();
  fillSegments.current.clear();
    strokePoints.current = [];
    setFillPaths([]);
    const first = charData.points[0];
    setBeePos(first ? { x: first.x, y: first.y } : { x: 200, y: 300 });
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
    setAvatarLine(instructionLine());
    setAvatarTrigger((value) => value + 1);
  };

  /** Removes the last stroke and rebuilds the progress from what remains. */
  const handleUndo = () => {
    if (finishedRef.current || strokePoints.current.length === 0) return;
    strokePoints.current.pop();
    setPaths((prev) => prev.slice(0, -1));
    rebuildProgress();
    setIsOnPath(true);
    lastHapticPoint.current = null;
    haptics.undo();
  };

  useEffect(() => {
    try {
      if (successPlayerRef.current) {
        successPlayerRef.current.remove();
        successPlayerRef.current = null;
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
        if (successPlayerRef.current) successPlayerRef.current.remove();
      } catch {}
    };
    // handleReset only touches stable setters/refs, so it is safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChar, charData.wordSound]);

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

  const saveSessionToDatabase = async (finalAccuracy: number) => {
    if (!studentId) return;
    setSaving(true);
    try {
      // Offline, Firestore queues the write and addDoc only resolves once back
      // online, which would leave the Continue button stuck on a spinner.
      // So stop waiting after 3s; the write still syncs later.
      await Promise.race([
        addDoc(collection(db, "sessions"), {
          userId: studentId,
          letterOrNumber: selectedChar,
          accuracy: finalAccuracy,
          timestamp: new Date().toISOString(),
          unlockedSticker: selectedChar,
          starsEarned: finalAccuracy >= 90 ? 3 : (finalAccuracy >= 75 ? 2 : 1)
        }),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch (error) {
      console.error("Error saving tracing session history:", error);
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

    // Replay the strokes from scratch: isolated dot taps are ignored here, so
    // they cannot satisfy the dots/coverage rules.
    const analysis = analyseStrokes(
      strokePoints.current,
      charData.points,
      charData.segments,
      TRACE_TOLERANCE,
      ENDPOINT_TOLERANCE
    );
    hitPoints.current = analysis.hits;
    coveredSegments.current = analysis.covered;
    fillSegments.current = analysis.fillCovered;
    setHitIds(analysis.hits);
    computeFillPaths();

    const dotsHit = analysis.hits.length;
    const totalSegments = charData.segments.length;
    const coverage = totalSegments > 0 ? analysis.covered.size / totalSegments : 0;
    if (
      dotsHit < hitsNeeded ||
      coverage < REQUIRED_COVERAGE ||
      analysis.moves < MIN_MOVES ||
      !allStrokesTraced(charData.segments, analysis.fillCovered)
    ) {
      return;
    }

    finishedRef.current = true;

    const calculatedScore = Math.max(50, Math.round(((analysis.moves - analysis.offPath) / analysis.moves) * 100));

    let stars = 1;
    if (calculatedScore >= 90) stars = 3;
    else if (calculatedScore >= 75) stars = 2;

    setAccuracy(calculatedScore);
    setEarnedStars(stars);
    setIsFinished(true);
    setIsOnPath(true);
    setAvatarLine(FINISH_PHRASES[selectedChar] ?? successLine());
    setAvatarTrigger((value) => value + 1);

    if (successPlayerRef.current) {
      try {
        successPlayerRef.current.seekTo(0);
        successPlayerRef.current.play();
      } catch {}
    }

    haptics.finished();
    saveSessionToDatabase(calculatedScore);

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
      haptics.checkpoint();
    }

    // 2. Track coverage + check the finger is still inside the writing lane.
    const distance = markCoveredSegments(
      x,
      y,
      charData.segments,
      TRACE_TOLERANCE,
      coveredSegments.current
    );
    const fillBefore = fillSegments.current.size;
    markStrokeCoverage(x, y, charData.segments, TRACE_TOLERANCE, fillSegments.current);
    if (fillSegments.current.size !== fillBefore) computeFillPaths();
    setBeePos({ x, y });

    if (distance <= TRACE_TOLERANCE) {
      if (!onPathRef.current) haptics.backOnPath();
      onPathRef.current = true;
      setIsOnPath(true);
      // Continuous light ticks let the child feel the stroke under their finger.
      pulseHaptic(x, y);
    } else {
      onPathRef.current = false;
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

  /** The avatar says the character's sound twice when a new trace starts. */
  const announcePhonetic = () => {
    const phrase = PHONETIC_PHRASES[selectedChar] ?? {
      ph: `${selectedChar}, ${selectedChar}!`,
      en: `${selectedChar}, ${selectedChar}!`,
    };
    setAvatarLine(phrase);
    setAvatarTrigger((value) => value + 1);
  };

  // PanResponder is created once, so it must call the *latest* handlers
  // (otherwise it keeps using the first character's data after selectedChar changes).
  const handlersRef = useRef({ registerTouch, tryFinish, announcePhonetic });
  useEffect(() => {
    handlersRef.current = { registerTouch, tryFinish, announcePhonetic };
  });

  // PanResponder callbacks run in gesture handlers, not during render; refs are safe here.
  // eslint-disable-next-line react-hooks/refs
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !finishedRef.current,
      onMoveShouldSetPanResponder: () => !finishedRef.current,
      
      onPanResponderGrant: (evt) => {
        if (finishedRef.current) return;
        const { locationX, locationY } = evt.nativeEvent;
        const svgX = (locationX / canvasRef.current.width) * 400;
        const svgY = (locationY / canvasRef.current.height) * 600;
        if (strokePoints.current.length === 0) handlersRef.current.announcePhonetic();
        strokePoints.current.push([{ x: svgX, y: svgY }]);
        haptics.startStroke();
        lastHapticPoint.current = { x: svgX, y: svgY };
        lastHapticTime.current = Date.now();
        setPaths((prev) => [...prev, `M${svgX.toFixed(1)},${svgY.toFixed(1)}`]);
        handlersRef.current.registerTouch(svgX, svgY);
      },

      onPanResponderMove: (evt) => {
        if (finishedRef.current) return;
        const { locationX, locationY } = evt.nativeEvent;
        const svgX = (locationX / canvasRef.current.width) * 400;
        const svgY = (locationY / canvasRef.current.height) * 600;

        const currentStroke = strokePoints.current[strokePoints.current.length - 1];
        if (currentStroke) currentStroke.push({ x: svgX, y: svgY });

        setPaths((prev) => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          updated[updated.length - 1] = `${updated[updated.length - 1]} L${svgX.toFixed(1)},${svgY.toFixed(1)}`;
          return updated;
        });
        handlersRef.current.registerTouch(svgX, svgY);
      },

      onPanResponderRelease: () => {
        const lastStroke = strokePoints.current[strokePoints.current.length - 1];
        if (!finishedRef.current && lastStroke && haptics.isRealStroke(lastStroke)) haptics.strokeDone();
        setIsOnPath(true);
        handlersRef.current.tryFinish();
      },

      // Android can steal the gesture (notification, parent scroll). Without this
      // a finished shape would never unlock the reward.
      onPanResponderTerminate: () => {
        const lastStroke = strokePoints.current[strokePoints.current.length - 1];
        if (!finishedRef.current && lastStroke && haptics.isRealStroke(lastStroke)) haptics.strokeDone();
        setIsOnPath(true);
        handlersRef.current.tryFinish();
      },
    })
  );

  return (
    <View style={[styles.container, !isOnPath && styles.errorBg]}>
        
        <SafeAreaView edges={['top']} style={styles.overlay}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>

            <View style={[styles.statusBadge, { backgroundColor: isFinished ? '#DCFCE7' : (isOnPath ? '#FEF3C7' : '#FEE2E2') }]}>
              <Text
                style={styles.statusText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {isFinished
                  ? (lang === 'ph' ? 'ANG GALING!' : 'GREAT JOB!')
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

        <View style={[styles.canvasArea, { paddingBottom: TAB_BAR_SPACE }]}>
          <TraceCanvas
            width={canvas.width}
            height={canvas.height}
            path={charData.path}
            points={charData.points}
            fillPaths={fillPaths}
            hitIds={hitIds}
            isFinished={isFinished}
            isOnPath={isOnPath}
            beePos={beePos}
            color={LETTER_COLORS[selectedChar] ?? '#0E5C5C'}
            panHandlers={panResponder.panHandlers}
          />
          <SpeakingAvatar
            line={avatarLine}
            lang={lang}
            trigger={avatarTrigger}
            size={isTabletDevice ? 96 : 56}
            style={styles.avatarSide}
          />
        </View>

        {isFinished && (
          <View style={[styles.rewardOverlay, { paddingBottom: TAB_BAR_SPACE }]} pointerEvents="box-none">
            <View style={styles.compactStickerWrap}>
              <Animated.View
                pointerEvents={rewardReady ? 'auto' : 'none'}
                style={[styles.compactSticker, { opacity: fadeAnim, transform: [{ scale: cardScale }] }]}
              >
                {charData.image ? (
                  <Image source={charData.image} style={styles.compactStickerImage} resizeMode="contain" />
                ) : (
                  <View style={styles.compactStickerFallback}>
                    <Text style={styles.compactStickerChar}>{selectedChar}</Text>
                  </View>
                )}
                <View style={styles.compactStickerInfo}>
                  <Text style={styles.compactStickerTitle} numberOfLines={1}>
                    {selectedChar} - {charData.word}
                  </Text>
                  <Text style={styles.compactStickerAccuracy}>
                    {lang === 'ph' ? `Katumpakan: ${accuracy}%` : `Accuracy: ${accuracy}%`}
                  </Text>
                  <View style={styles.compactStarsRow}>
                    {starAnims.map((anim, index) => (
                      <Animated.View key={index} style={{ transform: [{ scale: anim }] }}>
                        <Ionicons
                          name="star"
                          size={16}
                          color={earnedStars > index ? '#FBBF24' : '#E5E7EB'}
                        />
                      </Animated.View>
                    ))}
                  </View>
                </View>
              </Animated.View>
            </View>

            <Animated.View
              pointerEvents={rewardReady ? 'box-none' : 'none'}
              style={[styles.compactActions, { opacity: fadeAnim }]}
            >
              <TouchableOpacity
                style={[styles.compactBtn, styles.compactBtnSecondary]}
                onPress={handleReset}
              >
                <Ionicons name="refresh" size={18} color="#555" style={{ marginRight: 4 }} />
                <Text style={styles.compactBtnTextSecondary}>
                  {lang === 'ph' ? 'Ulitin' : 'Retry'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.compactBtn} onPress={() => router.back()} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.compactBtnText}>
                      {lang === 'ph' ? 'Ipagpatuloy' : 'Continue'}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="white" style={{ marginLeft: 4 }} />
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEB' },
  errorBg: { backgroundColor: '#FFF0F0' },
  overlay: { paddingHorizontal: '6%', paddingTop: 10, paddingBottom: 6, zIndex: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 3 },
  backBtnDisabled: { opacity: 0.35 },
  statusBadge: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20, elevation: 2, flexShrink: 1, marginHorizontal: 8 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, width: '100%' },
  progressTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#FDE68A', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: '#F77F67' },
  progressLabel: { marginLeft: 10, fontSize: normalize(11), fontWeight: '900', color: '#92400E' },
  statusText: { fontWeight: '900', fontSize: normalize(12), color: '#333', letterSpacing: 0.5, textAlign: 'center' },
  canvasArea: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: '4%', paddingVertical: 6 },
  avatarSide: { left: -2, bottom: '12%' },
  compactStickerWrap: { position: 'absolute', top: 130, left: 0, right: 0, alignItems: 'center' },
  compactSticker: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'white', borderRadius: 22, borderWidth: 2, borderColor: '#FDE68A', paddingHorizontal: 12, paddingVertical: 8, maxWidth: '86%', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 },
  compactStickerImage: { width: 48, height: 48, borderRadius: 12 },
  compactStickerFallback: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  compactStickerChar: { fontSize: 24, fontWeight: '900', color: '#16A34A' },
  compactStickerInfo: { flexShrink: 1 },
  compactStickerTitle: { fontSize: normalize(12), fontWeight: '900', color: '#7C4A03' },
  compactStickerAccuracy: { fontSize: normalize(10), color: '#15803D', fontWeight: '800', marginTop: 2 },
  compactStarsRow: { flexDirection: 'row', gap: 4, marginTop: 3 },
  compactActions: { position: 'absolute', left: '5%', right: '5%', bottom: 8, flexDirection: 'row', gap: 10 },
  compactBtn: { flex: 1, backgroundColor: '#F77F67', height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  compactBtnSecondary: { backgroundColor: '#F3F4F6' },
  compactBtnText: { color: 'white', fontWeight: '900', fontSize: normalize(12) },
  compactBtnTextSecondary: { color: '#555', fontWeight: '900', fontSize: normalize(12) },
  
  rewardOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 30 },
  successContent: { backgroundColor: 'white', padding: 25, paddingTop: 22, borderRadius: 35, borderWidth: 3, borderColor: '#FDE68A', alignItems: 'center', elevation: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, width: isTablet ? 450 : '88%', maxHeight: '88%', flexShrink: 1 },
  rewardScroll: { width: '100%' },
  rewardScrollContent: { alignItems: 'center' },
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