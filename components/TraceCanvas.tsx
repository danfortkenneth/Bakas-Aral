/**
 * The tracing play area (upgraded).
 *
 * Same props and same game rules as before — the screen decides everything,
 * this component only draws. The character body uses `LETTER_COLORS` (blue A,
 * red B, yellow C) with a white sticker outline, matching the reference art.
 * New in this version:
 *  - the NEXT dot pulses, reached dots pop with sparkles
 *  - a glowing cursor follows the finger instead of a mascot
 *  - a ghost light traces the whole route before the child starts
 *  - an idle hint hand glides to the next checkpoint when the child pauses
 *  - confetti + a star reward when the letter is finished
 *
 * Uses only React Native's built-in Animated with the native driver, so there
 * are no extra dependencies and the motion stays smooth on low-end phones.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, Pattern, Rect } from 'react-native-svg';
import type { HitPoint } from '../constants/traceableData';
import { samplePolyline } from '../lib/tracing';

const VIEW_W = 400;
const VIEW_H = 600;
const LETTER_WIDTH = 88;
/** Traced colour is slimmer than the letter so it reads as a finger trail. */
const FILL_WIDTH = 60;
/** Seconds of no progress before the hint hand appears. */
const IDLE_MS = 2200;

export type TraceCanvasProps = {
  width: number;
  height: number;
  path: string;
  points: HitPoint[];
  /** Each entry is a smooth SVG path along the guide line that has been covered. */
  fillPaths: string[];
  hitIds: number[];
  isFinished: boolean;
  isOnPath: boolean;
  /** Finger position in viewBox coordinates — the glowing cursor follows it. */
  beePos: { x: number; y: number };
  /** Base colour of the character. */
  color?: string;
  /** Incremented on the child's first touch — stops the auto ghost demo. */
  demoToken?: number;
  /** Incremented after the finish voice ends — starts the anchor image reveal. */
  revealSignal?: number;
  /** Anchor artwork revealed one-by-one at the old dot positions after finishing. */
  anchorImage?: number;
  panHandlers: any;
};

/* ----------------------------- sparkle burst ----------------------------- */

const BURST_COLORS = ['#FFD166', '#FFFFFF', '#F77F67', '#A78BFA', '#4ADE80', '#38BDF8'];

function Burst({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const [p] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(p, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => onDone());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View pointerEvents="none" style={[styles.abs, { left: x, top: y }]}>
      {BURST_COLORS.map((color, i) => {
        const angle = (i / BURST_COLORS.length) * Math.PI * 2;
        return (
          <Animated.View
            key={i}
            style={[
              styles.spark,
              {
                backgroundColor: color,
                opacity: p.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
                transform: [
                  { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * 34] }) },
                  { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * 34] }) },
                  { scale: p.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.2, 0.3] }) },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

/* -------------------------------- confetti -------------------------------- */

const CONFETTI_COLORS = ['#F77F67', '#FBBF24', '#4ADE80', '#38BDF8', '#A78BFA', '#F472B6'];

function Confetti({ width, height }: { width: number; height: number }) {
  const pieces = useState(() =>
    Array.from({ length: 28 }, (_, i) => ({
      left: Math.random() * width,
      drift: (Math.random() - 0.5) * 120,
      delay: Math.random() * 500,
      duration: 1500 + Math.random() * 1000,
      size: 8 + Math.random() * 6,
      spin: 2 + Math.random() * 3,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      progress: new Animated.Value(0),
    }))
  )[0];

  useEffect(() => {
    const anims = pieces.map((piece) =>
      Animated.timing(piece.progress, {
        toValue: 1,
        delay: piece.delay,
        duration: piece.duration,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      })
    );
    Animated.parallel(anims).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: piece.left,
            top: -20,
            width: piece.size,
            height: piece.size * 0.6,
            backgroundColor: piece.color,
            borderRadius: 2,
            opacity: piece.progress.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: piece.progress.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
              { translateX: piece.progress.interpolate({ inputRange: [0, 1], outputRange: [0, piece.drift] }) },
              { rotate: piece.progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${piece.spin * 360}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

/* ---------------------------- pulsing next-dot ---------------------------- */

function PulseRing({ x, y, size }: { x: number; y: number; size: number }) {
  const [p] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(p, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [p]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.abs,
        {
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: '#FFFFFF',
          opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
          transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.8, 2] }) }],
        },
      ]}
    />
  );
}

/* --------------------------------- screen --------------------------------- */

export default function TraceCanvas({
  width,
  height,
  path,
  points,
  fillPaths,
  hitIds,
  isFinished,
  isOnPath,
  beePos,
  color = '#0E5C5C',
  demoToken = 0,
  revealSignal = 0,
  anchorImage,
  panHandlers,
}: TraceCanvasProps) {
  const sx = width / VIEW_W;
  const sy = height / VIEW_H;
  const toPx = (p: { x: number; y: number }) => ({ x: p.x * sx, y: p.y * sy });
  const dotScale = Math.max(1, Math.min(sx, 1.6));

  // The first dot still waiting to be reached tells us which stroke the child
  // is on; its first and last checkpoints get the 1 / ✓ markers.
  const nextPoint = points.find((point) => !hitIds.includes(point.id));
  const activeStrokeId = nextPoint?.strokeId ?? points[0]?.strokeId;
  const startPoint = points.find((point) => point.strokeId === activeStrokeId) ?? points[0];
  const endPoint = nextPoint
    ? [...points].reverse().find((point) => point.strokeId === nextPoint.strokeId) ?? nextPoint
    : points[points.length - 1];

  const cursorPoint = toPx(beePos);

  // Auto-demo: before the child starts, a ghost light traces the whole route.
  const demoPoints = useMemo(() => {
    const pairs: { x: number; y: number }[] = [];
    const pattern = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(path))) pairs.push({ x: Number(match[1]), y: Number(match[2]) });
    const sampled = pairs.length >= 2 ? samplePolyline(pairs, 6) : pairs;
    if (sampled.length === 0) return [{ x: 200, y: 300 }, { x: 200, y: 300 }];
    if (sampled.length === 1) return [sampled[0], sampled[0]];
    return sampled;
  }, [path]);

  const [demoProgress] = useState(() => new Animated.Value(0));
  const demoActive = demoToken === 0 && !isFinished;
  useEffect(() => {
    if (!demoActive) return;
    demoProgress.setValue(0);
    const animation = Animated.timing(demoProgress, {
      toValue: demoPoints.length - 1,
      duration: 3200,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [demoActive, demoPoints.length, demoProgress]);

  const demoIndices = demoPoints.map((_, index) => index);
  const demoX = demoProgress.interpolate({
    inputRange: demoIndices,
    outputRange: demoPoints.map((point) => point.x * sx - 12),
    extrapolate: 'clamp',
  });
  const demoY = demoProgress.interpolate({
    inputRange: demoIndices,
    outputRange: demoPoints.map((point) => point.y * sy - 12),
    extrapolate: 'clamp',
  });

  /* ---- anchor reveal: dots turn into the anchor word image, one by one ---- */
  const [anchorAnims] = useState(() => points.map(() => new Animated.Value(0)));
  useEffect(() => {
    if (!isFinished || !anchorImage || revealSignal === 0) {
      anchorAnims.forEach((value) => value.setValue(0));
      return;
    }
    const sequence = Animated.parallel(
      anchorAnims.map((value, index) =>
        Animated.sequence([
          Animated.delay(index * 110),
          Animated.spring(value, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        ])
      )
    );
    sequence.start();
    return () => sequence.stop();
  }, [isFinished, anchorImage, revealSignal, anchorAnims]);

  /* ---- glowing cursor: follows the finger, breathes, pulses on a dot ---- */
  const [cursorXY] = useState(() => new Animated.ValueXY({ x: cursorPoint.x - 12, y: cursorPoint.y - 12 }));
  const [float] = useState(() => new Animated.Value(0));
  const [bounce] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.spring(cursorXY, {
      toValue: { x: cursorPoint.x - 12, y: cursorPoint.y - 12 },
      stiffness: 260,
      damping: 20,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorPoint.x, cursorPoint.y]);

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    floatLoop.start();
    return () => floatLoop.stop();
  }, [float]);

  // Bounce each time a new dot is reached.
  const lastHitCount = useRef(hitIds.length);
  const [bursts, setBursts] = useState<{ key: number; x: number; y: number }[]>([]);
  const burstKey = useRef(0);
  const seenHits = useRef<Set<number>>(new Set(hitIds));

  useEffect(() => {
    if (hitIds.length < lastHitCount.current) {
      // undo / reset
      seenHits.current = new Set(hitIds);
      setBursts([]);
    } else if (hitIds.length > lastHitCount.current) {
      const fresh = hitIds.filter((id) => !seenHits.current.has(id));
      fresh.forEach((id) => seenHits.current.add(id));
      const added = fresh
        .map((id) => points.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => ({ key: ++burstKey.current, x: p!.x * sx, y: p!.y * sy }));
      if (added.length) setBursts((prev) => [...prev, ...added]);
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1.35, duration: 110, useNativeDriver: true }),
        Animated.spring(bounce, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
      ]).start();
    }
    lastHitCount.current = hitIds.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hitIds.length]);

  /* ---- idle hint hand ---- */
  // A token that only becomes true for the latest activity. No synchronous
  // setState inside the effect: the timer is the sole writer.
  const activityKey = `${beePos.x},${beePos.y},${hitIds.length}`;
  const [idleKey, setIdleKey] = useState<string | null>(null);
  useEffect(() => {
    if (isFinished) return;
    const key = activityKey;
    const timer = setTimeout(() => setIdleKey(key), IDLE_MS);
    return () => clearTimeout(timer);
  }, [activityKey, isFinished]);

  const [handProgress] = useState(() => new Animated.Value(0));
  const showHand = idleKey === activityKey && !isFinished && !demoActive && !!nextPoint;
  useEffect(() => {
    if (!showHand) return;
    handProgress.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(handProgress, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(350),
        Animated.timing(handProgress, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(250),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [showHand, nextPoint?.id, handProgress]);

  const nextPx = nextPoint ? toPx(nextPoint) : null;
  const handFrom = cursorPoint;

  return (
    <View style={[{ width, height }, styles.wrapper]} {...panHandlers}>
      <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={styles.svg}>
        <Defs>
          <Pattern id="traceSwirl" width={30} height={30} patternUnits="userSpaceOnUse">
            <Rect width={30} height={30} fill="#4B32C3" />
            <Circle cx={15} cy={15} r={8} fill="none" stroke="#7660E5" strokeWidth={4} />
            <Circle cx={0} cy={0} r={3} fill="#7660E5" />
            <Circle cx={30} cy={30} r={3} fill="#7660E5" />
          </Pattern>
        </Defs>

        {/* Soft park backdrop */}
        <Rect width={VIEW_W} height={VIEW_H} fill="#A8E3F7" />
        <Ellipse cx="60" cy="660" rx="270" ry="150" fill="#9BD97C" />
        <Ellipse cx="350" cy="680" rx="260" ry="170" fill="#7FCC66" />
        <Ellipse cx="200" cy="720" rx="320" ry="140" fill="#B9E88F" opacity={0.55} />

        {/* Character: flat solid body, matching the reference artwork */}
        <Path
          d={path}
          fill="none"
          stroke={isFinished ? '#1F8A5B' : color}
          strokeWidth={LETTER_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Faint centreline guide: shows the route, fades as the child fills it */}
        {!isFinished && (
          <Path
            d={path}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray="4 16"
            opacity={fillPaths.length > 0 ? 0.18 : 0.5}
          />
        )}

        {/* Traced area: solid purple base + swirl pattern + soft highlight */}
        {fillPaths.map((fillPath, index) => (
          <React.Fragment key={index}>
            <Path d={fillPath} fill="none" stroke="#4B32C3" strokeWidth={FILL_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={fillPath} fill="none" stroke="url(#traceSwirl)" strokeWidth={FILL_WIDTH} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
            <Path d={fillPath} fill="none" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" opacity={0.14} />
          </React.Fragment>
        ))}

        {/* All remaining checkpoints stay visible; the next one is highlighted */}
        {!isFinished &&
          points.map((point) => {
            if (hitIds.includes(point.id)) return null;
            const isNext = point.id === nextPoint?.id;
            return (
              <Circle
                key={point.id}
                cx={point.x}
                cy={point.y}
                r={isNext ? 12 : 10}
                fill="#FFFFFF"
                stroke={isNext ? '#FBBF24' : color}
                strokeWidth={isNext ? 4 : 3}
              />
            );
          })}

        {/* Gentle red rim if the finger leaves the writing lane */}
        {!isOnPath && !isFinished && (
          <Rect x={4} y={4} width={VIEW_W - 8} height={VIEW_H - 8} rx={26} fill="none" stroke="#EF4444" strokeWidth={8} opacity={0.45} />
        )}
      </Svg>

      {/* Anchor images replace the dots one by one after the finish line */}
      {isFinished && anchorImage && points.map((point, index) => (
        <Animated.View
          key={`anchor-${point.id}`}
          pointerEvents="none"
          style={[
            styles.anchorImage,
            {
              left: point.x * sx - 13,
              top: point.y * sy - 13,
              opacity: anchorAnims[index],
              transform: [{ scale: anchorAnims[index] }],
            },
          ]}
        >
          <Image source={anchorImage} style={styles.anchorImageArt} resizeMode="contain" />
        </Animated.View>
      ))}

      {/* Start / end markers for the active stroke (1 → ✓) */}
      {!isFinished && startPoint && (
        <View
          pointerEvents="none"
          style={[styles.marker, styles.markerStart, { left: startPoint.x * sx - 11, top: startPoint.y * sy - 11 }]}
        >
          <Text style={styles.markerText}>1</Text>
        </View>
      )}
      {!isFinished && endPoint && (
        <View
          pointerEvents="none"
          style={[styles.marker, styles.markerEnd, { left: endPoint.x * sx - 11, top: endPoint.y * sy - 11 }]}
        >
          <Text style={styles.markerText}>✓</Text>
        </View>
      )}

      {/* Pulse ring on the next dot */}
      {!isFinished && nextPx && <PulseRing key={nextPoint!.id} x={nextPx.x} y={nextPx.y} size={22 * dotScale} />}

      {/* Sparkle bursts on reached dots */}
      {bursts.map((b) => (
        <Burst
          key={b.key}
          x={b.x}
          y={b.y}
          onDone={() => setBursts((prev) => prev.filter((item) => item.key !== b.key))}
        />
      ))}

      {/* Hint hand: glides from the cursor to the next dot when the child is idle */}
      {showHand && nextPx && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.abs,
            {
              left: 0,
              top: 0,
              opacity: handProgress.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: handProgress.interpolate({ inputRange: [0, 1], outputRange: [handFrom.x - 6, nextPx.x - 6] }) },
                { translateY: handProgress.interpolate({ inputRange: [0, 1], outputRange: [handFrom.y + 4, nextPx.y + 4] }) },
              ],
            },
          ]}
        >
          <Text style={styles.hand}>👆</Text>
        </Animated.View>
      )}

      {/* Ghost demo: a soft light traces the whole route once before writing */}
      {demoActive && (
        <Animated.View
          pointerEvents="none"
          style={[styles.ghostDot, { transform: [{ translateX: demoX }, { translateY: demoY }] }]}
        />
      )}

      {/* Glowing cursor: follows the finger, breathes, pulses on a dot */}
      {!demoActive && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.cursor,
            {
              transform: [
                { translateX: cursorXY.x },
                { translateY: cursorXY.y },
                { scale: bounce },
              ],
              opacity: float.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }),
            },
          ]}
        >
          <View style={styles.cursorCore} />
        </Animated.View>
      )}

      {isFinished && <Confetti width={width} height={height} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#A8E3F7',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  svg: { backgroundColor: 'transparent' },
  anchorImage: { position: 'absolute', width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  anchorImageArt: { width: 26, height: 26 },
  abs: { position: 'absolute' },
  spark: { position: 'absolute', width: 8, height: 8, borderRadius: 4, marginLeft: -4, marginTop: -4 },
  hand: { fontSize: 38 },
  ghostDot: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#FBBF24',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 6,
  },
  cursor: { position: 'absolute', left: 0, top: 0, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  cursorCore: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FBBF24',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 5,
  },
  marker: { position: 'absolute', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4 },
  markerStart: { backgroundColor: '#1E3A8A' },
  markerEnd: { backgroundColor: '#16A34A' },
  markerText: { color: 'white', fontWeight: '900', fontSize: 12 },
});
