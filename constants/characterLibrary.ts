/**
 * Single source of truth for every traceable character (A–Z and 0–9).
 *
 * Geometry (path / points / segments) comes from `traceableData.ts`.
 * Words, images and sounds are layered on top as optional assets — only the
 * characters that actually have files in `assets/` get them, so the tracing
 * screens must treat image/audio as optional.
 */
import { ANCHOR_WORDS, TRACEABLE_DATA, type TraceCharacter } from './traceableData';

export type CharacterEntry = TraceCharacter & {
  /** Anchor word shown on the reward card (e.g. "Atis" for A). */
  word: string;
  /** Optional artwork — only A and B ship with images today. */
  image?: number;
  /** Optional letter-sound loop. */
  phoneticSound?: number;
  /** Optional success sound for the anchor word. */
  wordSound?: number;
};

type CharacterAssets = Pick<CharacterEntry, 'image' | 'phoneticSound' | 'wordSound'>;

const CHARACTER_ASSETS: Record<string, CharacterAssets> = {
  A: {
    image: require('../assets/images/Atis.png'),
    phoneticSound: require('../assets/sounds/Atis.mp3'),
    wordSound: require('../assets/sounds/Atis_suc.mp3'),
  },
  B: {
    image: require('../assets/images/Bahay.png'),
    phoneticSound: require('../assets/sounds/Bahay.mp3'),
    wordSound: require('../assets/sounds/Bahay_suc.mp3'),
  },
};

export const CHARACTER_LIBRARY: Record<string, CharacterEntry> = Object.fromEntries(
  Object.entries(TRACEABLE_DATA).map(([character, geometry]) => [
    character,
    {
      word: ANCHOR_WORDS[character] ?? character,
      ...geometry,
      ...(CHARACTER_ASSETS[character] ?? {}),
    },
  ])
);

/** Letters in teaching order. */
export const LETTERS: string[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Digits in teaching order. */
export const NUMBERS: string[] = '0123456789'.split('');

/** Every character that has tracing geometry, letters first. */
export const ALL_CHARACTERS: string[] = [...LETTERS, ...NUMBERS];

export function getCharacter(character?: string | null): CharacterEntry {
  return CHARACTER_LIBRARY[character ?? ''] ?? CHARACTER_LIBRARY.A;
}
