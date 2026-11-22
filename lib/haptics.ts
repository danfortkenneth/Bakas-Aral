/**
 * Central haptic language for the tracing game.
 *
 * The patterns give every stroke a begin / checkpoint / end rhythm so the
 * child builds muscle memory, while off-path and back-on-path buzzes teach
 * correction without punishing the learner. All patterns are no-ops when the
 * parent has disabled haptics.
 */
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { strokeLength } from './tracing';

const STORAGE_KEY = '@bakas_haptics_enabled';
let enabled = true;
let lastOffPath = 0;
let lastBackOnPath = 0;
let lastTickPoint: { x: number; y: number } | null = null;
let lastTickDirection: { x: number; y: number } | null = null;
let lastTickTime = 0;
let replayTimers: ReturnType<typeof setTimeout>[] = [];

/** Load the parent's saved choice once at startup. */
export async function loadHapticsSetting(): Promise<void> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    enabled = value !== 'false';
  } catch {
    enabled = true;
  }
}

export function areHapticsEnabled(): boolean {
  return enabled;
}

export async function setHapticsEnabled(value: boolean): Promise<void> {
  enabled = value;
  if (!value) {
    replayTimers.forEach(clearTimeout);
    replayTimers = [];
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    // Keep the in-memory value even if storage is unavailable.
  }
}

const later = (delay: number, action: () => void) =>
  setTimeout(() => {
    if (enabled) action();
  }, delay);

export const haptics = {
  /** Finger touched down: a firm "this is where you start". */
  startStroke() {
    if (!enabled) return;
    lastTickPoint = null;
    lastTickDirection = null;
    lastTickTime = Date.now();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },

  /** A checkpoint dot reached: medium hit plus a quick double tick. */
  checkpoint() {
    if (!enabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    later(70, () => Haptics.selectionAsync());
    later(150, () => Haptics.selectionAsync());
  },

  /** A stroke was completed: a distinct two-pulse "done" pattern. */
  strokeDone() {
    if (!enabled) return;
    Haptics.selectionAsync();
    later(95, () => Haptics.selectionAsync());
  },

  /** Left the writing lane: warning, but never more than ~3 per second. */
  offPath() {
    if (!enabled) return;
    const now = Date.now();
    if (now - lastOffPath < 350) return;
    lastOffPath = now;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },

  /** Came back into the lane: a soft, encouraging confirmation. */
  backOnPath() {
    if (!enabled) return;
    const now = Date.now();
    if (now - lastBackOnPath < 300) return;
    lastBackOnPath = now;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  /** Continuous texture: denser ticks on curves, capped at ~10/second. */
  textureTick(x: number, y: number) {
    if (!enabled) return;
    const now = Date.now();
    if (now - lastTickTime < 100) return;

    const last = lastTickPoint;
    const moved = last ? Math.hypot(x - last.x, y - last.y) : Number.POSITIVE_INFINITY;
    const dx = last ? x - last.x : 0;
    const dy = last ? y - last.y : 0;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const direction = { x: dx / distance, y: dy / distance };

    let spacing = 38;
    if (last && lastTickDirection) {
      const turn = 1 - Math.max(-1, Math.min(1, direction.x * lastTickDirection.x + direction.y * lastTickDirection.y));
      spacing = 38 - Math.min(18, turn * 45);
    }
    if (moved < spacing) return;

    lastTickPoint = { x, y };
    lastTickDirection = direction;
    lastTickTime = now;
    Haptics.selectionAsync();
  },

  /**
   * Replays the rhythm of the strokes the child just drew, so the finished
   * letter can be remembered through touch as well as sight.
   */
  replayStrokes(strokes: { x: number; y: number }[][]) {
    replayTimers.forEach(clearTimeout);
    replayTimers = [];
    if (!enabled || strokes.length === 0) return;

    let at = 450;
    for (const stroke of strokes) {
      if (strokeLength(stroke) < 60) continue;
      const count = Math.max(2, Math.min(7, Math.round(strokeLength(stroke) / 80)));
      replayTimers.push(later(at, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)));
      for (let i = 1; i <= count; i++) {
        replayTimers.push(later(at + i * 110, () => Haptics.selectionAsync()));
      }
      at += count * 110 + 170;
    }
  },

  /** Undo: a light acknowledgement. */
  undo() {
    if (!enabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  /** Character finished: success celebration. */
  finished() {
    if (!enabled) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },

  /** True when a recorded stroke is long enough to count as a real trace. */
  isRealStroke(points: { x: number; y: number }[]): boolean {
    return points.length >= 6 && strokeLength(points) >= 60;
  },
};
