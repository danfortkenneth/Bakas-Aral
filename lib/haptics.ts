/**
 * Central haptic language for the tracing game.
 *
 * Patterns give every stroke a begin / checkpoint / end rhythm so the child
 * builds muscle memory. Parents can choose the intensity (Pahina / Normal /
 * Malakas / Off) from the Teacher Dashboard.
 */
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { strokeLength } from './tracing';

export type HapticLevel = 'off' | 'weak' | 'normal' | 'strong';

const LEVEL_KEY = '@bakas_haptics_level';
const LEGACY_KEY = '@bakas_haptics_enabled';
const LEVEL_ORDER: HapticLevel[] = ['off', 'weak', 'normal', 'strong'];
const canVibrate = Platform.OS !== 'web';

let level: HapticLevel = 'strong';
let enabled = true;
let lastOffPath = 0;
let lastBackOnPath = 0;
let lastTickPoint: { x: number; y: number } | null = null;
let lastTickDirection: { x: number; y: number } | null = null;
let lastTickTime = 0;
let replayTimers: ReturnType<typeof setTimeout>[] = [];

function applyLevel(next: HapticLevel) {
  level = next;
  enabled = next !== 'off';
  if (!enabled) {
    replayTimers.forEach(clearTimeout);
    replayTimers = [];
  }
}

/** Load the saved intensity once at startup. */
export async function loadHapticsSetting(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(LEVEL_KEY);
    if (saved && LEVEL_ORDER.includes(saved as HapticLevel)) {
      applyLevel(saved as HapticLevel);
      return;
    }
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    applyLevel(legacy === 'false' ? 'off' : 'strong');
  } catch {
    applyLevel('strong');
  }
}

export function areHapticsEnabled(): boolean {
  return enabled;
}

export function getHapticsLevel(): HapticLevel {
  return level;
}

export async function setHapticsLevel(next: HapticLevel): Promise<void> {
  applyLevel(next);
  try {
    await AsyncStorage.setItem(LEVEL_KEY, next);
    await AsyncStorage.setItem(LEGACY_KEY, next === 'off' ? 'false' : 'true');
  } catch {
    // Keep the in-memory value even if storage is unavailable.
  }
}

/** Used by the old on/off toggle; kept for compatibility. */
export async function setHapticsEnabled(value: boolean): Promise<void> {
  await setHapticsLevel(value ? 'strong' : 'off');
}

/** Cycle the setting from the UI: Off → Pahina → Normal → Malakas → Off. */
export async function cycleHapticsLevel(): Promise<HapticLevel> {
  const index = LEVEL_ORDER.indexOf(level);
  const next = LEVEL_ORDER[(index + 1) % LEVEL_ORDER.length];
  await setHapticsLevel(next);
  return next;
}

const later = (delay: number, action: () => void) =>
  setTimeout(() => {
    if (enabled && canVibrate) action();
  }, delay);

const impact = (style: Haptics.ImpactFeedbackStyle) => {
  if (enabled && canVibrate) Haptics.impactAsync(style);
};

const selection = () => {
  if (enabled && canVibrate) Haptics.selectionAsync();
};

export const haptics = {
  /** Finger touched down: a firm "this is where you start". */
  startStroke() {
    if (!enabled || !canVibrate) return;
    lastTickPoint = null;
    lastTickDirection = null;
    lastTickTime = Date.now();
    impact(
      level === 'strong'
        ? Haptics.ImpactFeedbackStyle.Heavy
        : level === 'weak'
          ? Haptics.ImpactFeedbackStyle.Light
          : Haptics.ImpactFeedbackStyle.Medium
    );
  },

  /** A checkpoint dot reached: hit plus a level-dependent double tick. */
  checkpoint() {
    if (!enabled || !canVibrate) return;
    impact(level === 'weak' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    if (level === 'weak') later(120, selection);
    else if (level === 'normal') later(80, selection);
    else {
      later(60, selection);
      later(120, selection);
      later(180, selection);
    }
  },

  /** A stroke was completed: a distinct "done" pattern. */
  strokeDone() {
    if (!enabled || !canVibrate) return;
    selection();
    if (level === 'weak') later(110, selection);
    else if (level === 'normal') later(95, selection);
    else {
      impact(Haptics.ImpactFeedbackStyle.Medium);
      later(90, selection);
      later(170, selection);
      later(250, selection);
    }
  },

  /** Left the writing lane: warning, throttled by level. */
  offPath() {
    if (!enabled || !canVibrate) return;
    const now = Date.now();
    const throttle = level === 'strong' ? 250 : level === 'weak' ? 500 : 350;
    if (now - lastOffPath < throttle) return;
    lastOffPath = now;
    if (level === 'weak') impact(Haptics.ImpactFeedbackStyle.Light);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },

  /** Came back into the lane: a soft, encouraging confirmation. */
  backOnPath() {
    if (!enabled || !canVibrate || level === 'weak') return;
    const now = Date.now();
    if (now - lastBackOnPath < 300) return;
    lastBackOnPath = now;
    impact(level === 'strong' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  },

  /** Continuous texture: denser ticks on curves, capped by level. */
  textureTick(x: number, y: number) {
    if (!enabled || !canVibrate) return;
    const now = Date.now();
    const timeGap = level === 'strong' ? 55 : level === 'weak' ? 180 : 100;
    if (now - lastTickTime < timeGap) return;

    const last = lastTickPoint;
    const moved = last ? Math.hypot(x - last.x, y - last.y) : Number.POSITIVE_INFINITY;
    const dx = last ? x - last.x : 0;
    const dy = last ? y - last.y : 0;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const direction = { x: dx / distance, y: dy / distance };

    const baseSpacing = level === 'strong' ? 25 : level === 'weak' ? 50 : 38;
    let spacing = baseSpacing;
    if (last && lastTickDirection) {
      const turn = 1 - Math.max(-1, Math.min(1, direction.x * lastTickDirection.x + direction.y * lastTickDirection.y));
      spacing = baseSpacing - Math.min(baseSpacing * 0.45, turn * 45);
    }
    if (moved < spacing) return;

    lastTickPoint = { x, y };
    lastTickDirection = direction;
    lastTickTime = now;
    selection();
  },

  /** Replays the rhythm of the strokes the child just drew. */
  replayStrokes(strokes: { x: number; y: number }[][]) {
    replayTimers.forEach(clearTimeout);
    replayTimers = [];
    if (!enabled || !canVibrate || strokes.length === 0) return;

    let at = 450;
    for (const stroke of strokes) {
      if (strokeLength(stroke) < 60) continue;
      const base = Math.max(2, Math.min(7, Math.round(strokeLength(stroke) / 80)));
      const count = level === 'strong' ? base + 2 : level === 'weak' ? Math.max(1, base - 2) : base;
      replayTimers.push(later(at, () => impact(Haptics.ImpactFeedbackStyle.Light)));
      for (let i = 1; i <= count; i++) {
        replayTimers.push(later(at + i * 110, selection));
      }
      at += count * 110 + 170;
    }
  },

  undo() {
    if (!enabled || !canVibrate) return;
    impact(Haptics.ImpactFeedbackStyle.Light);
  },

  finished() {
    if (!enabled || !canVibrate) return;
    if (level === 'weak') impact(Haptics.ImpactFeedbackStyle.Light);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },

  /** Plays a sample of every cue — used by the "Test Haptic" button. */
  test() {
    replayTimers.forEach(clearTimeout);
    replayTimers = [];
    if (!enabled || !canVibrate) return;
    impact(Haptics.ImpactFeedbackStyle.Heavy);
    replayTimers.push(later(180, () => impact(Haptics.ImpactFeedbackStyle.Medium)));
    [320, 400, 480].forEach((at) => replayTimers.push(later(at, selection)));
    replayTimers.push(later(620, () =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    ));
  },

  /** True when a recorded stroke is long enough to count as a real trace. */
  isRealStroke(points: { x: number; y: number }[]): boolean {
    return points.length >= 6 && strokeLength(points) >= 20;
  },
};
