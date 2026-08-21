import { useCallback, useEffect, useState } from 'react';
import BoltRounded from '@mui/icons-material/BoltRounded';
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded';
import CalendarTodayOutlined from '@mui/icons-material/CalendarTodayOutlined';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import WifiOff from '@mui/icons-material/WifiOff';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import { Fmt } from '@/core/utils/format';
import { RewardsRepository, type RewardsSummary } from '@/data/api/rewardsRepository';
import { rewardKindIconName, type RewardTxn } from '@/data/models';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import { rewardKindColor } from '@/components/ActivityRow';
import { CoinBalanceCard } from '@/components/CoinBalanceCard';
import { Icon } from '@/components/Icon';
import {
  CoinAmount,
  EmptyState,
  HeaderStat,
  PageHeader,
  SectionHeader,
  pagePadding,
} from '@/components/Primitives';
import { Reveal } from '@/components/Reveal';
import { SkeletonCard, SkeletonList } from '@/components/Skeleton';
import { WebCard } from '@/components/WebCard';
import { useWindowWidth } from '@/hooks/useWindowWidth';

const FILTERS: [key: string, label: string][] = [
  ['all', 'All'],
  ['earned', 'Earned'],
  ['spent', 'Spent'],
];

/**
 * Rewards module (SOW: coin earnings, bonus rewards, lucky winner info).
 * Port of `WebRewardsPage`.
 */
export function RewardsPage() {
  const [summary, setSummary] = useState<RewardsSummary | null>(null);
  const [txns, setTxns] = useState<RewardTxn[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  const width = useWindowWidth();
  const padding = pagePadding(width);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await RewardsRepository.summary());
    } catch {
      setError('Could not load rewards.');
    }
  }, []);

  const loadTxns = useCallback(async (f: string) => {
    setTxns(null);
    try {
      setTxns(await RewardsRepository.transactions(f));
    } catch {
      setTxns([]);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadTxns(filter);
  }, [filter, loadTxns]);

  // All 4 headline numbers live in the header — the balance card below used to
  // repeat "earned all-time" and "lucky wins" in its own side stat column.
  const stats =
    summary == null
      ? null
      : [
          <HeaderStat
            key="balance"
            icon={<BoltRounded sx={{ fontSize: 15 }} />}
            value={Fmt.compactNumber(summary.balance)}
            label="balance"
            tint={WebTokens.gold}
          />,
          <HeaderStat
            key="earned"
            icon={<TrendingUpRounded sx={{ fontSize: 15 }} />}
            value={Fmt.compactNumber(summary.earnedTotal)}
            label="earned all-time"
            tint={WebTokens.accent}
          />,
          <HeaderStat
            key="week"
            icon={<CalendarTodayOutlined sx={{ fontSize: 15 }} />}
            value={Fmt.compactNumber(summary.thisWeek)}
            label="this week"
            tint={WebTokens.violet}
          />,
          <HeaderStat
            key="lucky"
            icon={<AutoAwesomeRounded sx={{ fontSize: 15 }} />}
            value={`${summary.luckyWins}`}
            label="lucky wins"
            tint={WebTokens.coral}
          />,
        ];

  return (
    <div style={{ padding }}>
      <PageHeader
        title="Rewards"
        subtitle="Your points history at a glance."
        narrow={width < WebTokens.bpTablet}
        stats={stats}
      />

      <div style={{ height: 24 }} />

      {error != null ? (
        <WebCard>
          <EmptyState
            icon={<WifiOff sx={{ fontSize: 30 }} />}
            title={error}
            action={
              <button
                type="button"
                className="btn-outlined"
                onClick={() => {
                  setError(null);
                  void loadSummary();
                  void loadTxns(filter);
                }}
              >
                Retry
              </button>
            }
          />
        </WebCard>
      ) : (
        <>
          {/* Coin balance hero — real "my points" content: balance, this-week
              delta, earned-all-time. No quick-action row (those just repeated
              the sidebar's own nav). */}
          {summary == null ? (
            <SkeletonCard height={210} />
          ) : (
            <Reveal duration={340} y={0.05}>
              <CoinBalanceCard
                balance={summary.balance}
                thisWeekDelta={summary.thisWeek}
                earnedTotal={summary.earnedTotal}
              />
            </Reveal>
          )}

          <div style={{ height: 28 }} />

          {/* Ledger */}
          <SectionHeader
            title="Points history"
            trailing={<FilterTabs value={filter} onChange={setFilter} />}
          />

          <div
            key={`${txns == null}-${txns?.length}`}
            className="reveal"
            style={{ ['--reveal-y' as string]: '2%', ['--reveal-duration' as string]: '240ms' }}
          >
            {txns == null ? (
              <SkeletonList count={2} height={40} />
            ) : txns.length === 0 ? (
              <WebCard>
                <EmptyState
                  icon={<ReceiptLongOutlined sx={{ fontSize: 30 }} />}
                  title="No transactions yet"
                  subtitle="Points activity shows up here."
                />
              </WebCard>
            ) : (
              <WebCard padding={0}>
                {txns.map((t, i) => (
                  <div key={t.id}>
                    <TxnRow txn={t} />
                    {i < txns.length - 1 && <div className="divider" />}
                  </div>
                ))}
              </WebCard>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * All/Earned/Spent filter for the ledger — the backend endpoint already
 * supported this, it was just never exposed in the web UI.
 */
function FilterTabs({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 3,
        background: WebTokens.surfaceAlt,
        borderRadius: 999,
        border: `1px solid ${WebTokens.border}`,
      }}
    >
      {FILTERS.map(([key, label]) => (
        <FilterTab
          key={key}
          label={label}
          selected={value === key}
          onClick={() => onChange(key)}
        />
      ))}
    </div>
  );
}

function FilterTab({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-pressed={selected}
      style={{
        padding: '7px 14px',
        borderRadius: 999,
        background: selected
          ? withAlpha(WebTokens.accent, 0.16)
          : hover
            ? 'rgba(255,255,255,0.05)'
            : 'transparent',
        color: selected ? WebTokens.accent : WebTokens.textSecondary,
        fontSize: 12.5,
        fontWeight: selected ? 700 : 500,
        transition: 'background 140ms ease, color 140ms ease',
      }}
    >
      {label}
    </button>
  );
}

function TxnRow({ txn }: { txn: RewardTxn }) {
  const color = rewardKindColor(txn.kind);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px' }}>
      <span
        style={{
          padding: 8,
          flexShrink: 0,
          display: 'inline-flex',
          background: withAlpha(color, 0.12),
          borderRadius: 10,
        }}
      >
        <Icon name={rewardKindIconName[txn.kind]} size={16} color={color} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ellipsis" style={{ fontWeight: 600 }}>
          {txn.title}
        </div>
        <div style={{ color: WebTokens.textMuted, fontSize: 12 }}>{txn.timeAgo}</div>
      </div>
      <CoinAmount amount={txn.amount} />
    </div>
  );
}
