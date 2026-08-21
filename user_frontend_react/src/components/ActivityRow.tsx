import { WebTokens, withAlpha } from '@/theme/webTokens';
import { rewardKindIconName, type RewardTxn } from '@/data/models';
import { Icon } from './Icon';
import { CoinAmount } from './Primitives';

/** Tint per reward kind — shared by the right rail, Rewards ledger and Profile. */
export function rewardKindColor(kind: RewardTxn['kind']): string {
  switch (kind) {
    case 'signup':
      return WebTokens.gold;
    case 'entry':
      return WebTokens.violet;
    case 'correct':
      return WebTokens.accent;
    case 'lucky':
      return WebTokens.coral;
    case 'bonus':
    default:
      return WebTokens.blue;
  }
}

/**
 * One coin-ledger entry — icon+tint by kind, title, time, signed amount.
 * Shared by the portal's global right-rail activity feed, the Rewards page
 * ledger and the Profile activity card. Port of `ActivityRow`.
 */
export function ActivityRow({ txn }: { txn: RewardTxn }) {
  const color = rewardKindColor(txn.kind);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 4px',
      }}
    >
      <span
        style={{
          padding: 8,
          display: 'inline-flex',
          background: withAlpha(color, 0.12),
          borderRadius: 10,
        }}
      >
        <Icon name={rewardKindIconName[txn.kind]} size={15} color={color} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ellipsis" style={{ fontWeight: 600, fontSize: 12.5 }}>
          {txn.title}
        </div>
        <div style={{ color: WebTokens.textMuted, fontSize: 11 }}>{txn.timeAgo}</div>
      </div>
      {/* A free prediction submission (amount 0) has no coin impact to show —
          "+0" would read as if 0 coins were earned/spent. */}
      {txn.amount !== 0 && <CoinAmount amount={txn.amount} fontSize={12.5} />}
    </div>
  );
}
