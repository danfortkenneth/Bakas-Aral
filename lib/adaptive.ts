import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@bakas_attempts';

/** How many guide dots to show: 0 = all, 1 = every other, 2 = every third. */
export type HintLevel = 0 | 1 | 2;

async function readAll(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function loadAttempts(character: string): Promise<number> {
  const all = await readAll();
  return typeof all[character] === 'number' ? all[character] : 0;
}

export async function recordAttempt(character: string): Promise<void> {
  try {
    const all = await readAll();
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...all, [character]: (all[character] ?? 0) + 1 }));
  } catch {
    // Ignore — completion still saves to Firestore.
  }
}

export function hintLevelFor(attempts: number): HintLevel {
  if (attempts >= 4) return 2;
  if (attempts >= 2) return 1;
  return 0;
}
