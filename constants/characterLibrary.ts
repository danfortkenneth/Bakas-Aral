/**
 * Single source of truth for the characters currently in the game.
 *
 * Geometry (path / points / segments) comes from `traceableData.ts`.
 * Words, images and sounds are layered on top as optional assets — only the
 * characters that actually have files in `assets/` get them, so the tracing
 * screens must treat image/audio as optional.
 *
 * For the current focus build only A, B, C and the numbers 1 and 2 are enabled.
 * To bring back the full alphabet, restore the lists in `LETTERS` / `NUMBERS`
 * below and the original ranges in `traceableData.ts`.
 */
import { ANCHOR_WORDS, TRACEABLE_DATA, type TraceCharacter } from './traceableData';

export type CharacterEntry = TraceCharacter & {
  /** Anchor word shown on the reward card (e.g. "Atis" for A). */
  word: string;
  /** Optional artwork — only A and B ship with images today. */
  image?: number;
  /** Optional success sound for the anchor word. */
  wordSound?: number;
};

type CharacterAssets = Pick<CharacterEntry, 'image' | 'wordSound'>;

const CHARACTER_ASSETS: Record<string, CharacterAssets> = {
  A: {
    image: require('../assets/images/Atis.png'),
    wordSound: require('../assets/sounds/Atis_suc.mp3'),
  },
  B: {
    image: require('../assets/images/Bahay.png'),
    wordSound: require('../assets/sounds/Bahay_suc.mp3'),
  },
};

/** Letters in teaching order (focus build). */
export const LETTERS: string[] = 'ABC'.split('');

/** Digits in teaching order (focus build). */
export const NUMBERS: string[] = '12'.split('');

/** Every character currently available, letters first. */
export const ALL_CHARACTERS: string[] = [...LETTERS, ...NUMBERS];

/** Only the active characters are exposed to the screens. */
export const CHARACTER_LIBRARY: Record<string, CharacterEntry> = Object.fromEntries(
  Object.entries(TRACEABLE_DATA)
    .filter(([character]) => ALL_CHARACTERS.includes(character))
    .map(([character, geometry]) => [
      character,
      {
        word: ANCHOR_WORDS[character] ?? character,
        ...geometry,
        ...(CHARACTER_ASSETS[character] ?? {}),
      },
    ])
);

/** English equivalents for the "A for Apple" style praise line. */
const ENGLISH_WORDS: Record<string, string> = {
  A: 'Apple',
  B: 'House',
  C: 'Cake',
  '1': 'One',
  '2': 'Two',
};

/** Bold letter colours from the reference artwork. */
export const LETTER_COLORS: Record<string, string> = {
  A: '#1736D6',
  B: '#F21117',
  C: '#FFD400',
};

/** Short sounds used when the child first touches a character. */
const PHONETIC_SOUNDS: Record<string, string> = {
  A: 'Ah',
  B: 'Buh',
  C: 'Kuh',
  '1': 'One',
  '2': 'Two',
};

/** The avatar says the sound twice at the start of a trace. */
export const PHONETIC_PHRASES: Record<string, { ph: string; en: string }> = Object.fromEntries(
  ALL_CHARACTERS.map((character) => {
    const sound = PHONETIC_SOUNDS[character] ?? character;
    const line = `${sound}, ${sound}!`;
    return [character, { ph: line, en: line }];
  })
);

/** What the side avatar says right after a character is finished. */
export const FINISH_PHRASES: Record<string, { ph: string; en: string }> = Object.fromEntries(
  ALL_CHARACTERS.map((character) => [
    character,
    {
      ph: `${character} para sa ${ANCHOR_WORDS[character] ?? character}! Ang galing mo!`,
      en: `${character} for ${ENGLISH_WORDS[character] ?? ANCHOR_WORDS[character] ?? character}! Great job!`,
    },
  ])
);

export function getCharacter(character?: string | null): CharacterEntry {
  return CHARACTER_LIBRARY[character ?? ''] ?? CHARACTER_LIBRARY.A;
}
