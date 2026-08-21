import MilitaryTech from '@mui/icons-material/MilitaryTech';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { badgeLabel, badgeRequirement } from '@/core/constants/economy';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import type { BadgeInfo } from '@/data/models';

/**
 * Circular achievement medallion — earned badges glow gold, locked ones sit
 * dim and pewter. A glossy 3D read: domed radial gradient (light source
 * upper-left) + a minted double-ring edge + a soft specular highlight blob,
 * rather than a flat tinted circle. Port of `BadgeMedallion`.
 */
export function BadgeMedallion({ badge }: { badge: BadgeInfo }) {
  const earned = badge.earned;
  const mutedColor = earned ? WebTokens.gold : WebTokens.textMuted;

  return (
    <div
      title={badgeRequirement[badge.type]}
      style={{
        paddingRight: 22,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        {/* Drop shadow so the medallion reads as sitting above the surface. */}
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: 3,
            width: 58,
            height: 58,
            borderRadius: '50%',
            boxShadow: `0 5px 14px ${withAlpha(earned ? WebTokens.gold : '#000000', earned ? 0.35 : 0.4)}`,
          }}
        />
        {/* Domed base — a radial gradient standing in for a curved metallic
            surface, darkest at the rim. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: earned
              ? 'radial-gradient(circle 95% at 32.5% 30%, #FFE9A8 0%, #FFC042 55%, #8A5A12 100%)'
              : `radial-gradient(circle 95% at 32.5% 30%, ${withAlpha(WebTokens.textMuted, 0.55)} 0%, ${WebTokens.surfaceAlt} 55%, #0C1422 100%)`,
          }}
        />
        {/* Minted double-ring edge. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid ${withAlpha(earned ? '#6B4408' : '#000000', 0.55)}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 2.5,
            left: 2.5,
            width: 59,
            height: 59,
            borderRadius: '50%',
            border: `1px solid ${withAlpha(earned ? WebTokens.gold : WebTokens.textMuted, 0.5)}`,
          }}
        />
        {/* Specular highlight — the glossy "light reflection" blob that sells
            the 3D read. */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 14,
            width: 26,
            height: 16,
            borderRadius: 20,
            background: `linear-gradient(to bottom, ${withAlpha('#FFFFFF', earned ? 0.55 : 0.28)}, ${withAlpha('#FFFFFF', 0)})`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: earned ? '#5C3B0A' : mutedColor,
          }}
        >
          {earned ? <MilitaryTech sx={{ fontSize: 26 }} /> : <LockOutlined sx={{ fontSize: 26 }} />}
        </div>
      </div>

      <div
        className="clamp-2"
        style={{
          marginTop: 8,
          width: 82,
          textAlign: 'center',
          fontSize: 11.5,
          fontWeight: 600,
          color: earned ? WebTokens.textSecondary : WebTokens.textMuted,
        }}
      >
        {badgeLabel[badge.type]}
      </div>

      {!earned && badge.progress > 0 && (
        <div
          style={{
            marginTop: 6,
            width: 60,
            height: 3,
            borderRadius: 3,
            background: WebTokens.surfaceHover,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.min(Math.max(badge.progress, 0), 1) * 100}%`,
              height: '100%',
              background: WebTokens.violet,
            }}
          />
        </div>
      )}
    </div>
  );
}
