/**
 * Recorded Filipino voice lines and anchor artwork per active character.
 *
 * Flow: LETRA <X> at the first touch → MAHUSAY! at the halfway point →
 * the character's anchor word on finish → anchor image reveal.
 */
export const PRAISE_SOUND = require('../assets/sounds/voice/MAHUSAY!.m4a');

export type VoiceLine = {
  start?: number;
  finish?: number;
  image?: number;
};

export const VOICE_LINES: Record<string, VoiceLine> = {
  A: {
    start: require('../assets/sounds/voice/LETRA A.m4a'),
    finish: require('../assets/sounds/voice/ARAW.m4a'),
    image: require('../assets/images/araw.png'),
  },
  B: {
    start: require('../assets/sounds/voice/LETRA B.m4a'),
    finish: require('../assets/sounds/voice/BASO.m4a'),
    image: require('../assets/images/baso.png'),
  },
};
