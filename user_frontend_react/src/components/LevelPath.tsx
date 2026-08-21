import CheckRounded from '@mui/icons-material/CheckRounded';
import BoltRounded from '@mui/icons-material/BoltRounded';
import LockOutlineRounded from '@mui/icons-material/LockOutlined';
import {
  levelCriteria,
  levelLabel,
  levelProgressTo,
  nextLevel,
  type UserLevel,
} from '@/core/constants/economy';
import { WebTokens, glow, withAlpha } from '@/theme/webTokens';
import { GaugeArc } from './GaugeRing';
import { HScrollArrows } from './HScrollArrows';

/**
 * Level path — connected circular level badges with a glowing, progress-arc
 * ring on the current level. Port of `LevelPath`.
 *
 * The caption under each node is the same requirement text the app's Levels
 * screen roadmap shows (levelCriteria) — deliberately NOT an XP readout,
 * which has no equivalent on the app side and doesn't reflect what actually
 * promotes a user (prediction counts / rank).
 */
export function LevelPath({
  levels,
  current,
  totalPredictions,
  correctPredictions,
}: {
  levels: readonly UserLevel[];
  current: UserLevel;
  totalPredictions: number;
  correctPredictions: number;
}) {
  const currentIndex = levels.indexOf(current);
  const next = nextLevel(current);
  const lp = next == null ? null : levelProgressTo(next, { totalPredictions, correctPredictions });
  const progress = next == null ? 1 : (lp?.ratio ?? 0);

  return (
    <HScrollArrows>
      {levels.map((level, i) => (
        <div key={level} style={{ display: 'flex', alignItems: 'flex-start' }}>
          <LevelNode
            level={level}
            passed={i < currentIndex}
            isCurrent={i === currentIndex}
            progress={i === currentIndex ? progress : 0}
            caption={levelCriteria[level]}
          />
          {i < levels.length - 1 && (
            <div
              style={{
                marginTop: 30,
                width: 46,
                height: 3,
                marginLeft: 2,
                marginRight: 2,
                borderRadius: 2,
                flexShrink: 0,
                background:
                  i < currentIndex ? withAlpha(WebTokens.accent, 0.55) : WebTokens.surfaceAlt,
              }}
            />
          )}
        </div>
      ))}
    </HScrollArrows>
  );
}

function LevelNode({
  level,
  passed,
  isCurrent,
  progress,
  caption,
}: {
  level: UserLevel;
  passed: boolean;
  isCurrent: boolean;
  progress: number;
  caption: string;
}) {
  const size = isCurrent ? 68 : 52;
  const reached = passed || isCurrent;
  const color = reached ? WebTokens.accent : WebTokens.textMuted;
  // The current node's circle is inset by 6px so the progress arc can ring it.
  const circleSize = isCurrent ? size - 12 : size;

  const circle = (
    <div
      style={{
        width: circleSize,
        height: circleSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: reached
          ? `linear-gradient(135deg, ${withAlpha(WebTokens.accent, isCurrent ? 0.26 : 0.16)}, ${withAlpha(WebTokens.accent, 0.04)})`
          : WebTokens.surfaceAlt,
        border: `${isCurrent ? 2.5 : 2}px solid ${withAlpha(color, isCurrent ? 0.7 : 0.35)}`,
        boxShadow: isCurrent ? glow(WebTokens.accent, 0.4) : 'none',
        color,
      }}
    >
      {passed ? (
        <CheckRounded sx={{ fontSize: 22 }} />
      ) : isCurrent ? (
        <BoltRounded sx={{ fontSize: 26 }} />
      ) : (
        <LockOutlineRounded sx={{ fontSize: 18 }} />
      )}
    </div>
  );

  return (
    <div
      style={{
        padding: '0 6px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      {isCurrent ? (
        <div style={{ position: 'relative', width: size, height: size }}>
          <GaugeArc value={progress} color={WebTokens.accent} size={size} strokeWidth={4} />
          <div
            style={{
              position: 'absolute',
              inset: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {circle}
          </div>
        </div>
      ) : (
        circle
      )}

      <div
        className="ellipsis"
        style={{
          marginTop: 8,
          width: 76,
          textAlign: 'center',
          fontSize: 12,
          fontWeight: isCurrent ? 800 : 600,
          color: isCurrent
            ? WebTokens.textPrimary
            : passed
              ? WebTokens.textSecondary
              : WebTokens.textMuted,
        }}
      >
        {levelLabel[level]}
      </div>
      <div
        className="clamp-2"
        style={{
          marginTop: 2,
          width: 76,
          textAlign: 'center',
          color: isCurrent ? WebTokens.accent : WebTokens.textMuted,
          fontSize: 10.5,
          fontWeight: 700,
        }}
      >
        {caption}
      </div>
    </div>
  );
}
