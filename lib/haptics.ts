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
  try {
    await AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    // Keep the in-memory value even if storage is unavailable.
  }
}

const later = (delay: number, action: () => void) => {
  setTimeout(() => {
    if (enabled) action();
  }, delay);
};

export const haptics = {
  /** Finger touched down: a firm "this is where you start". */
  startStroke() {
    if (!enabled) return;
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

  /** Continuous light tick while the finger follows the line. */
  tick() {
    if (!enabled) return;
    Haptics.selectionAsync();
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
