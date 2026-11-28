import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@collected_stickers';

/** Load the locally unlocked anchor stickers. */
export async function loadStickers(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/** Unlock one character's anchor sticker (idempotent). */
export async function unlockSticker(character: string): Promise<void> {
  try {
    const current = await loadStickers();
    if (current.includes(character)) return;
    await AsyncStorage.setItem(KEY, JSON.stringify([...current, character]));
  } catch {
    // Ignore storage failures — the session still saves to Firestore.
  }
}
