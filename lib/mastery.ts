/** Mastery levels used across the home grid, sticker album and dashboards. */
export type MasteryLevel = 0 | 1 | 2 | 3;

export type Stat = { accuracy: number; count: number };

export function masteryLevel(stat?: Stat | null): MasteryLevel {
  if (!stat || stat.count <= 0) return 0;
  if (stat.count >= 3 && stat.accuracy >= 85) return 3;
  if (stat.count >= 2 || stat.accuracy >= 75) return 2;
  return 1;
}

export const MASTERY_LABELS: Record<'en' | 'ph', string[]> = {
  en: ['New', 'Learning', 'Practiced', 'Mastered'],
  ph: ['Bago', 'Natututo', 'Sanay', 'Marunong'],
};

export const MASTERY_ICONS = ['⚪', '🌱', '🌿', '🌸'];
