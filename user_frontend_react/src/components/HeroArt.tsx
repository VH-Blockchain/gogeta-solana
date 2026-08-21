import type { ReactNode } from 'react';
import { WebTokens, glow } from '@/theme/webTokens';
import trophyHero from '@/assets/web/trophy_hero.png';

/**
 * Hero background art — a large, softly-faded brand icon bleeding from an
 * edge. Generated entirely from the design system (no external/stock imagery)
 * so it stays on-brand and project-specific. Port of `HeroBackgroundArt`.
 */
export function HeroBackgroundArt({
  icon,
  align = 'right',
  size = 340,
}: {
  icon: ReactNode;
  align?: 'left' | 'right';
  size?: number;
}) {
  const fromRight = align === 'right';
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: fromRight ? 'flex-end' : 'flex-start',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          fontSize: size,
          lineHeight: 1,
          color: WebTokens.textPrimary,
          opacity: 0.1,
          display: 'inline-flex',
          // ShaderMask(BlendMode.dstIn) with a white->transparent ramp from
          // the near edge inward, starting its fade 15% in.
          maskImage: `linear-gradient(to ${fromRight ? 'left' : 'right'}, #fff 15%, transparent 100%)`,
          WebkitMaskImage: `linear-gradient(to ${fromRight ? 'left' : 'right'}, #fff 15%, transparent 100%)`,
        }}
      >
        {icon}
      </span>
    </div>
  );
}

/**
 * Victory-cup artwork that bleeds above a hero card's top-right edge — the
 * same layered, "popping out" depth as the reference's character artwork over
 * its promo card. Wrap a hero card in a `position: relative` parent and drop
 * this in after it. Port of `TrophyPopArt`.
 */
export function TrophyPopArt({
  width = 300,
  top = -64,
  right = 30,
}: {
  width?: number;
  top?: number;
  right?: number;
}) {
  return (
    <img
      src={trophyHero}
      alt=""
      aria-hidden="true"
      style={{
        position: 'absolute',
        top,
        right,
        width,
        objectFit: 'contain',
        pointerEvents: 'none',
        filter: `drop-shadow(${glow(WebTokens.gold, 0.4).replace('0 0 24px -6px ', '0 0 40px ')})`,
      }}
    />
  );
}
