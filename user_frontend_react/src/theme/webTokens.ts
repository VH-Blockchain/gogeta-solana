import { AppPalette } from './palette';

/**
 * Design tokens for the web portal — glassmorphism 2.0 + soft-neo depth
 * over an animated aurora backdrop. 1:1 port of `WebTokens` in
 * lib/web/theme/web_theme.dart. Only the brand palette (AppPalette) is
 * shared with the mobile app; everything else is web-specific.
 *
 * Flutter's ARGB hex literals (0x28FFFFFF = ~16% white) are expressed here
 * as rgba() so they keep their exact alpha.
 */
export const WebTokens = {
  // ---- Base surfaces (dark-first) — exact app AppPalette dark values ----
  bg: AppPalette.darkBg, // #04070E
  surface: AppPalette.darkSurface, // #0B1220
  surfaceAlt: AppPalette.darkSurfaceAlt, // #131C2E
  surfaceHover: AppPalette.darkElevated, // #1B2740

  // ---- Glass ----
  // Barely-there edges: depth comes from the fill gradient + shadow, not a
  // visibly outlined border.
  glassFillTop: 'rgba(255,255,255,0.157)', // 0x28FFFFFF — ~16% white
  glassFillBottom: 'rgba(255,255,255,0.078)', // 0x14FFFFFF — ~8% white
  glassStroke: 'rgba(255,255,255,0.086)', // 0x16FFFFFF — ~9% white
  glassStrokeStrong: 'rgba(255,255,255,0.149)', // 0x26FFFFFF — ~15% white
  glassHighlight: 'rgba(255,255,255,0.188)', // 0x30FFFFFF — top-edge shine

  border: 'rgba(255,255,255,0.078)', // ~8% white
  borderStrong: 'rgba(255,255,255,0.133)', // ~13% white

  /** Hairline chrome divider (sidebar/topbar/right-rail). */
  chromeDivider: 'rgba(255,255,255,0.051)', // 0x0DFFFFFF

  /** Standard glass border thickness. */
  borderWidth: 1,
  borderWidthStrong: 1.4,

  // ---- Text ----
  textPrimary: '#F4F7FC',
  textSecondary: '#A9B2C5',
  textMuted: '#667089',

  // ---- Brand accents (shared with the app) ----
  accent: AppPalette.aura,
  accentDeep: AppPalette.auraDeep,
  gold: AppPalette.gold,
  goldDeep: AppPalette.goldDeep,
  violet: AppPalette.violet,
  blue: AppPalette.indigo,
  coral: '#FF8A65',
  danger: AppPalette.danger, // #FF5A6E

  onAccent: '#04070E',

  // ---- Light-mode surfaces/text ----
  lightBg: AppPalette.lightBg, // #F4F6FB
  lightSurface: AppPalette.lightSurface, // #FFFFFF
  lightSurfaceAlt: AppPalette.lightSurfaceAlt, // #EDEFF6
  lightTextPrimary: '#111726',
  lightTextSecondary: '#566077',
  lightTextMuted: '#98A0B3',
  lightBorder: 'rgba(16,24,40,0.078)', // 0x14101828

  // ---- Layout ----
  sidebarWidth: 248,
  sidebarRailWidth: 76,
  rightRailWidth: 296,
  topBarHeight: 70,
  contentMaxWidth: 1280,

  /** Breakpoints: >=1024 sidebar, 640..1024 collapsed rail, <640 mobile. */
  bpDesktop: 1024,
  bpTablet: 640,
  /** The right activity rail is supplementary — only wide desktop gets it. */
  bpWideRail: 1280,

  // ---- Shape ----
  radiusCard: 22,
  radiusControl: 13,
} as const;

/** Layered card depth (not flat elevation) — WebTokens.cardShadow. */
export const cardShadow =
  '0 14px 30px -12px rgba(0,0,0,0.35), 0 3px 8px -4px rgba(0,0,0,0.22)';

/**
 * Punchier, tighter glow — matches the reference's selected-cell/CTA glow,
 * used only on interactive/selected/CTA elements, never as an ambient effect.
 */
export function glow(color: string, strength = 0.48): string {
  return `0 0 24px -6px ${withAlpha(color, strength)}`;
}

// ---- Gradients ----
export const accentGradient = `linear-gradient(135deg, ${AppPalette.aura}, ${AppPalette.auraDeep})`;
export const brandGradient = `linear-gradient(135deg, ${AppPalette.aura}, ${AppPalette.violet})`;
/** Gold CTA fill — the points/rewards counterpart to accentGradient. */
export const goldGradient = `linear-gradient(135deg, ${AppPalette.gold}, ${AppPalette.goldDeep})`;
export const glassGradient = `linear-gradient(to bottom, ${WebTokens.glassFillTop}, ${WebTokens.glassFillBottom})`;

/** WebCard's two-tone dark fill (resting / hover-lifted) — navy, not neutral. */
export const cardFill = 'linear-gradient(to bottom, #101A2B, #0A1120)';
export const cardFillHover = 'linear-gradient(to bottom, #152134, #0C1422)';
/** Dialog/detail-panel fill. */
export const panelFill = 'linear-gradient(to bottom, #111B2C, #080E1A)';

/**
 * Flutter's `Color.withValues(alpha:)` — accepts a #rrggbb hex or an
 * existing rgb()/rgba() string and returns rgba() at the given alpha.
 */
export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const nums = color.match(/[\d.]+/g);
  if (nums && nums.length >= 3) {
    return `rgba(${nums[0]}, ${nums[1]}, ${nums[2]}, ${alpha})`;
  }
  return color;
}

/**
 * Flutter's `Color.alphaBlend(foreground, background)` — composites a
 * translucent color over an opaque one and returns the opaque result.
 * Used by the leaderboard podium pillars.
 */
export function alphaBlend(fgColor: string, fgAlpha: number, bgHex: string): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  };
  const [fr, fg, fb] = parse(fgColor);
  const [br, bg, bb] = parse(bgHex);
  const mix = (f: number, b: number) => Math.round(f * fgAlpha + b * (1 - fgAlpha));
  return `rgb(${mix(fr, br)}, ${mix(fg, bg)}, ${mix(fb, bb)})`;
}
