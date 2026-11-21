/**
 * Shared responsive helpers for Bakás.
 *
 * The app is portrait-locked, but devices range from 320 dp phones to 1024 dp
 * tablets (and Android split-screen can resize the window at runtime). These
 * helpers keep text and controls readable on every size without letting tablet
 * fonts explode.
 */
import { PixelRatio, useWindowDimensions } from 'react-native';

/** Smallest dimension that counts as a tablet (dp). */
export const TABLET_BREAKPOINT = 600;

/** Smallest dimension below which we tighten paddings and controls (dp). */
export const SMALL_PHONE_BREAKPOINT = 360;

/**
 * Text scale for a given window width.
 * Phones scale gently between 0.85× and 1.2×; tablets are capped at 1.35×
 * instead of following `width / 375` (which would make tablet text 2×).
 */
export function scaleFor(width: number): number {
  if (width >= TABLET_BREAKPOINT) {
    return Math.min(1.35, 1 + (width - TABLET_BREAKPOINT) / 1400);
  }
  return Math.min(1.2, Math.max(0.85, width / 375));
}

/** Rounds a design size (based on a 375 dp phone) to a device-safe pixel. */
export function normalizeFor(width: number, size: number): number {
  return Math.round(PixelRatio.roundToNearestPixel(size * scaleFor(width)));
}

export type Responsive = {
  width: number;
  height: number;
  isTablet: boolean;
  isSmallPhone: boolean;
  scale: number;
  normalize: (size: number) => number;
};

/** Live window metrics; updates on rotation, split-screen and foldables. */
export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const shortSide = Math.min(width, height);
  return {
    width,
    height,
    isTablet: shortSide >= TABLET_BREAKPOINT,
    isSmallPhone: shortSide < SMALL_PHONE_BREAKPOINT,
    scale: scaleFor(width),
    normalize: (size: number) => normalizeFor(width, size),
  };
}
