/** Bakás preschool design tokens — shared across child and adult screens. */
export const COLORS = {
  cream: '#FFFBEB',
  primary: '#F77F67',
  primarySoft: '#F7A072',
  mint: '#4ADE80',
  mintSoft: '#DCFCE7',
  sunny: '#FBBF24',
  sunnySoft: '#FEF3C7',
  sky: '#38BDF8',
  skySoft: '#E0F2FE',
  navy: '#1E293B',
  ink: '#1F2937',
  muted: '#6B7280',
  purple: '#7C3AED',
  purpleSoft: '#DDD6FE',
  white: '#FFFFFF',
  border: '#E5E7EB',
  error: '#B91C1C',
  success: '#15803D',
} as const;

export const RADIUS = {
  sm: 12,
  md: 20,
  lg: 28,
  pill: 999,
} as const;

export const BUTTON_HEIGHT = 52;
export const CARD_RADIUS = RADIUS.lg;

export const SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 10,
  elevation: 4,
} as const;
