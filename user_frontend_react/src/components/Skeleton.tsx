import { WebCard } from './WebCard';
import './Skeleton.css';

/** Pulsing skeleton block (content loading placeholder — no spinners). */
export function Skeleton({
  height = 16,
  width,
  radius = 8,
}: {
  height?: number;
  width?: number | string;
  radius?: number;
}) {
  return (
    <div
      className="skeleton"
      style={{
        height,
        width: width ?? '100%',
        borderRadius: radius,
      }}
    />
  );
}

/**
 * Skeleton stand-in for a card while content loads.
 *
 * The full 3-line + spacer layout needs ~64px minimum — call sites passing a
 * shorter row height (40/56/60 for ledger/list-item skeletons) would overflow
 * by a few px. Compact rows get a simple icon+2-lines layout instead, which
 * fits any height down to ~36px; taller hero/arena skeletons keep the fuller
 * look.
 */
export function SkeletonCard({ height = 120 }: { height?: number }) {
  const compact = height < 90;
  return (
    <WebCard>
      <div style={{ height, display: 'flex', flexDirection: 'column' }}>
        {compact ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: '100%' }}>
            <Skeleton width={36} height={36} radius={10} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skeleton height={12} />
              <Skeleton width={90} height={10} />
            </div>
          </div>
        ) : (
          <>
            <Skeleton width={120} height={14} />
            <div style={{ height: 12 }} />
            <Skeleton width={90} height={26} />
            <div style={{ flex: 1 }} />
            <Skeleton height={12} />
          </>
        )}
      </div>
    </WebCard>
  );
}

/** A vertical run of identical skeleton cards — the most common loading shape. */
export function SkeletonList({ count, height = 60 }: { count: number; height?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} height={height} />
      ))}
    </div>
  );
}
