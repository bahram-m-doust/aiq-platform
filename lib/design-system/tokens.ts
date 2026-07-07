/**
 * AIQ STUDIO Design System — Token Constants
 *
 * Single source of truth for spacing, radius, shadow, motion.
 * Use these instead of inline values to ensure consistency across the app.
 *
 * For colors, use CSS variables (`var(--bv-*)`) directly in styles.
 */

export const ds = {
  radius: {
    xs: 8,
    sm: 12,
    md: 14,
    lg: 20,
    xl: 28,
    full: 9999,
  },
  shadow: {
    card: "var(--bv-shadow-card)",
    cardHover: "var(--bv-shadow-card-hover)",
    hub: "var(--bv-shadow-hub)",
    panel: "var(--bv-shadow-panel)",
    glow: "var(--bv-brand-glow-shadow)",
  },
  motion: {
    ease: "var(--bv-ease)",
    fast: "180ms",
    medium: "320ms",
    slow: "600ms",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    "2xl": 32,
  },
  zIndex: {
    sidebar: 40,
    modal: 50,
    toast: 60,
  },
} as const;

export type DSTokens = typeof ds;
