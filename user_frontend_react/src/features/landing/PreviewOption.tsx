import TrendingUp from '@mui/icons-material/TrendingUp';
import { WebTokens, withAlpha } from '@/theme/webTokens';

/**
 * A sample option row with a crowd-share fill — used by the hero preview card
 * and the showcase sample cards. Port of `_PreviewOption`.
 */
export function PreviewOption({
  label,
  percent,
  hot = false,
}: {
  label: string;
  percent: number;
  hot?: boolean;
}) {
  return (
    <div style={{ position: 'relative', borderRadius: 9, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.04)' }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: `${percent}%`,
          background: withAlpha(WebTokens.accent, hot ? 0.28 : 0.12),
        }}
      />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '9px 12px',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        {hot && <TrendingUp sx={{ fontSize: 13 }} style={{ color: WebTokens.accent }} />}
        <span style={{ flex: 1 }} />
        <span style={{ color: WebTokens.textSecondary, fontSize: 12.5, fontWeight: 700 }}>
          {percent}%
        </span>
      </div>
    </div>
  );
}
