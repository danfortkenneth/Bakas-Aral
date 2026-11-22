/**
 * The tracing play area (upgraded).
 *
 * Same props and same game rules as before — the screen decides everything,
 * this component only draws. The character body uses `LETTER_COLORS` (blue A,
 * red B, yellow C) with a white sticker outline, matching the reference art.
 * New in this version:
 *  - the NEXT dot pulses, reached dots pop with sparkles
 *  - the bee springs smoothly to the finger, floats + flaps when idle, and
 *    bounces every time a dot is reached
 *  - an idle hint hand glides from the bee to the next dot
 *  - confetti + a bee dance when the letter is finished
 *
 * Uses only React Native's built-in Animated with the native driver, so there
 * are no extra dependencies and the motion stays smooth on low-end phones.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, Pattern, Rect } from 'react-native-svg';
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
  /** Finger position in viewBox coordinates — the bee rides here. */
  beePos: { x: number; y: number };
  /** Base colour of the character. */
  color?: string;
  /** Incremented on the child's first touch — stops the auto-demo bee. */
  demoToken?: number;
  panHandlers: any;
};

const r = (n: number) => Math.round(n * 10) / 10;

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
  panHandlers,
}: TraceCanvasProps) {
  const sx = width / VIEW_W;
  const sy = height / VIEW_H;
  const toPx = (p: { x: number; y: number }) => ({ x: p.x * sx, y: p.y * sy });
  const dotScale = Math.max(1, Math.min(sx, 1.6));

  // The first dot still waiting to be reached tells us which stroke the child
  // is on; the hive waits at that stroke's last checkpoint.
  const nextPoint = points.find((point) => !hitIds.includes(point.id));
  const hivePoint = nextPoint
    ? [...points].reverse().find((point) => point.strokeId === nextPoint.strokeId) ?? nextPoint
    : points[points.length - 1];

  const bee = toPx(beePos);

  // Auto-demo: before the child starts, a bee shows the whole route once.
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
    outputRange: demoPoints.map((point) => point.x * sx - 20),
    extrapolate: 'clamp',
  });
  const demoY = demoProgress.interpolate({
    inputRange: demoIndices,
    outputRange: demoPoints.map((point) => point.y * sy - 22),
    extrapolate: 'clamp',
  });

  /* ---- bee: spring follow, idle float, hit bounce, finish dance ---- */
  const [beeXY] = useState(() => new Animated.ValueXY({ x: bee.x - 20, y: bee.y - 22 }));
  const [float] = useState(() => new Animated.Value(0));
  const [flap] = useState(() => new Animated.Value(0));
  const [bounce] = useState(() => new Animated.Value(1));
  const [dance] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(beeXY, {
      toValue: { x: bee.x - 20, y: bee.y - 22 },
      stiffness: 260,
      damping: 20,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bee.x, bee.y]);

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const flapLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flap, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(flap, { toValue: 0, duration: 90, useNativeDriver: true }),
      ])
    );
    floatLoop.start();
    flapLoop.start();
    return () => {
      floatLoop.stop();
      flapLoop.stop();
    };
  }, [float, flap]);

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

  useEffect(() => {
    if (!isFinished) {
      dance.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dance, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(dance, { toValue: -1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(dance, { toValue: 0, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isFinished, dance]);

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
  const handFrom = bee;

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

        {/* Beehive: the little reward waiting at the end of the stroke */}
        {!isFinished && hivePoint && (
          <G transform={`translate(${r(hivePoint.x)}, ${r(hivePoint.y)})`}>
            <Ellipse cx="0" cy="6" rx="19" ry="13" fill="#F2A93B" stroke="#8A5A16" strokeWidth={3} />
            <Path d="M-16,1 Q0,-7 16,1" fill="none" stroke="#C47A1A" strokeWidth={3} />
            <Ellipse cx="0" cy="-7" rx="15" ry="11" fill="#FFD166" stroke="#8A5A16" strokeWidth={3} />
            <Path d="M-12,-10 Q0,-17 12,-10" fill="none" stroke="#C47A1A" strokeWidth={2.5} />
            <Ellipse cx="0" cy="-20" rx="11" ry="8" fill="#FFD166" stroke="#8A5A16" strokeWidth={3} />
            <Circle cx="0" cy="-29" r="3" fill="#8A5A16" />
          </G>
        )}

        {/* Gentle red rim if the finger leaves the writing lane */}
        {!isOnPath && !isFinished && (
          <Rect x={4} y={4} width={VIEW_W - 8} height={VIEW_H - 8} rx={26} fill="none" stroke="#EF4444" strokeWidth={8} opacity={0.45} />
        )}
      </Svg>

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

      {/* Hint hand: glides from the bee to the next dot when the child is idle */}
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

      {/* Auto-demo bee: shows the whole route once before the child starts */}
      {demoActive && (
        <Animated.View
          pointerEvents="none"
          style={[styles.bee, { transform: [{ translateX: demoX }, { translateY: demoY }] }]}
        >
          <Text style={styles.beeEmoji}>🐝</Text>
        </Animated.View>
      )}

      {/* Bee buddy — takes over as soon as the demo ends */}
      {!demoActive && (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.bee,
          {
            transform: [
              { translateX: beeXY.x },
              { translateY: beeXY.y },
              { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
              { scale: bounce },
              { rotate: dance.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-18deg', '0deg', '18deg'] }) },
            ],
          },
        ]}
      >
        <Animated.Text
          style={[
            styles.beeEmoji,
            { transform: [{ scaleX: flap.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) }] },
          ]}
        >
          🐝
        </Animated.Text>
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
  abs: { position: 'absolute' },
  spark: { position: 'absolute', width: 8, height: 8, borderRadius: 4, marginLeft: -4, marginTop: -4 },
  hand: { fontSize: 38 },
  bee: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beeEmoji: { fontSize: 34, lineHeight: 40, textAlign: 'center' },
});
