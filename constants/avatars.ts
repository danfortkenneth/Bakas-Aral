export const ANIMAL_AVATARS = [
  { id: 'lion', emoji: '🦁' },
  { id: 'bear', emoji: '🐻' },
  { id: 'rabbit', emoji: '🐰' },
  { id: 'tiger', emoji: '🐯' },
  { id: 'koala', emoji: '🐨' },
  { id: 'panda', emoji: '🐼' },
  { id: 'monkey', emoji: '🐵' },
  { id: 'fox', emoji: '🦊' },
  { id: 'cat', emoji: '🐱' },
  { id: 'dog', emoji: '🐶' },
  { id: 'pig', emoji: '🐷' },
  { id: 'mouse', emoji: '🐭' },
] as const;

export function avatarEmoji(id?: string | null) {
  if (!id) return '🧒';
  return ANIMAL_AVATARS.find((item) => item.id === id)?.emoji || '🧒';
}
