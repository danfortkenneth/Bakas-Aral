import AsyncStorage from '@react-native-async-storage/async-storage';
import { PARENT_QR_FLAG } from './classroom';

export const PARENT_STORAGE = {
  active: '@parent_active_child',
  history: '@parent_sync_history',
  stickers: '@collected_stickers',
};

export type ParentProgress = {
  nickname: string;
  avatar: string;
  accuracy: string;
  duration: string;
  timestamp: string;
  school: string;
  traces?: number;
  letters?: { char: string; accuracy: number }[];
  unlockedStickers?: string[];
  starsEarned?: number;
  studentId?: string;
};

export function parseParentQR(rawData: string): ParentProgress {
  const parsed = JSON.parse(rawData);
  if (parsed.appIdentifier !== PARENT_QR_FLAG) {
    throw new Error('INVALID_QR');
  }

  return {
    nickname: parsed.nickname || 'Unknown',
    avatar: parsed.avatar || 'lion',
    accuracy: parsed.accuracy || '0%',
    duration: parsed.duration || '0m',
    timestamp: parsed.timestamp || new Date().toLocaleString(),
    school: parsed.school || 'NEU Pre-K Division',
    traces: parsed.traces || 0,
    letters: parsed.letters || [],
    unlockedStickers: parsed.unlockedStickers || [],
    starsEarned: parsed.starsEarned || 0,
    studentId: parsed.studentId,
  };
}

export async function loadParentSync() {
  const [activeRaw, historyRaw, stickersRaw] = await Promise.all([
    AsyncStorage.getItem(PARENT_STORAGE.active),
    AsyncStorage.getItem(PARENT_STORAGE.history),
    AsyncStorage.getItem(PARENT_STORAGE.stickers),
  ]);

  return {
    active: activeRaw ? (JSON.parse(activeRaw) as ParentProgress) : null,
    history: historyRaw ? (JSON.parse(historyRaw) as ParentProgress[]) : [],
    stickers: stickersRaw ? (JSON.parse(stickersRaw) as string[]) : [],
  };
}

export async function saveParentQRPayload(record: ParentProgress) {
  const current = await loadParentSync();
  const history = [record, ...current.history].slice(0, 30);
  const stickerSet = new Set(current.stickers);

  (record.unlockedStickers || []).forEach((item) => {
    stickerSet.add(`✍️ Titik ${item}`);
  });
  if (record.nickname) {
    stickerSet.add(`${record.avatar || 'lion'} ${record.nickname}`);
  }

  const stickers = Array.from(stickerSet);
  await AsyncStorage.multiSet([
    [PARENT_STORAGE.active, JSON.stringify(record)],
    [PARENT_STORAGE.history, JSON.stringify(history)],
    [PARENT_STORAGE.stickers, JSON.stringify(stickers)],
  ]);

  return { active: record, history, stickers };
}
