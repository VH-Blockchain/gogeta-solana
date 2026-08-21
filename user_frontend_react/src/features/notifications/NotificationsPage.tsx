import { useEffect, useState, type ReactNode } from 'react';
import AppsRounded from '@mui/icons-material/AppsRounded';
import DoneAll from '@mui/icons-material/DoneAll';
import MarkEmailUnreadRounded from '@mui/icons-material/MarkEmailUnreadRounded';
import InboxRounded from '@mui/icons-material/InboxRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import WifiOff from '@mui/icons-material/WifiOff';
import Refresh from '@mui/icons-material/Refresh';
import NotificationsNone from '@mui/icons-material/NotificationsNone';
import FilterAltOffOutlined from '@mui/icons-material/FilterAltOffOutlined';
import {
  notificationKindIconName,
  type NotificationItem,
  type NotificationKind,
} from '@/data/models';
import { unreadCount, useNotificationsStore } from '@/store/notificationsStore';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import { HScrollArrows } from '@/components/HScrollArrows';
import { Icon } from '@/components/Icon';
import { EmptyState, HeaderStat, PageHeader, pagePadding } from '@/components/Primitives';
import { Reveal } from '@/components/Reveal';
import { SkeletonList } from '@/components/Skeleton';
import { WebCard } from '@/components/WebCard';
import { useWindowWidth } from '@/hooks/useWindowWidth';

const KIND_ORDER: NotificationKind[] = [
  'lucky',
  'result',
  'badge',
  'leaderboard',
  'system',
  'reminder',
];

/** Display label per kind — a UI-only concern, so it lives here, not on the model. */
const kindLabel: Record<NotificationKind, string> = {
  lucky: 'Daily draw',
  result: 'Results',
  badge: 'Badges',
  leaderboard: 'Leaderboard',
  system: 'System',
  reminder: 'Reminders',
};

/**
 * Notifications feed (results, lucky draws, badges, system notices). Reached
 * from the topbar bell; clicking a row marks it read.
 * Port of `WebNotificationsPage`.
 */
export function NotificationsPage() {
  const [filter, setFilter] = useState<NotificationKind | null>(null);

  const items = useNotificationsStore((s) => s.items);
  const loading = useNotificationsStore((s) => s.loading);
  const error = useNotificationsStore((s) => s.error);
  const unread = useNotificationsStore(unreadCount);
  const load = useNotificationsStore((s) => s.load);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);

  const width = useWindowWidth();
  const padding = pagePadding(width);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered =
    items == null ? null : filter == null ? items : items.filter((i) => i.kind === filter);

  const stats =
    items == null
      ? null
      : [
          <HeaderStat
            key="unread"
            icon={<MarkEmailUnreadRounded sx={{ fontSize: 15 }} />}
            value={`${unread}`}
            label="unread"
            tint={WebTokens.accent}
          />,
          <HeaderStat
            key="total"
            icon={<InboxRounded sx={{ fontSize: 15 }} />}
            value={`${items.length}`}
            label="total"
            tint={WebTokens.violet}
          />,
          ...(items.some((i) => i.kind === 'lucky')
            ? [
                <HeaderStat
                  key="draws"
                  icon={<AutoAwesomeRounded sx={{ fontSize: 15 }} />}
                  value={`${items.filter((i) => i.kind === 'lucky').length}`}
                  label="daily draws"
                  tint={WebTokens.gold}
                />,
              ]
            : []),
        ];

  return (
    <div style={{ padding }}>
      <PageHeader
        title="Notifications"
        subtitle="Results, daily draws and badge unlocks land here."
        narrow={width < WebTokens.bpTablet}
        stats={stats}
        trailing={
          unread > 0 ? (
            <button type="button" className="btn-outlined" onClick={() => void markAllRead()}>
              <DoneAll sx={{ fontSize: 18 }} />
              Mark all read ({unread})
            </button>
          ) : undefined
        }
      />

      <div style={{ height: 20 }} />

      {/* Six notification kinds existed with no way to narrow the feed — a
          horizontal-scroll pill row (the same pattern as the Predictions
          category filter) so the type distinction is actually usable. */}
      {items != null && items.length > 0 && (
        <>
          <Reveal duration={300} y={0.05}>
            <KindFilterRow
              selected={filter}
              present={new Set(items.map((i) => i.kind))}
              onChange={setFilter}
            />
          </Reveal>
          <div style={{ height: 20 }} />
        </>
      )}

      <div
        key={`${loading}-${error}-${filtered?.length}-${filter}`}
        className="reveal"
        style={{ ['--reveal-y' as string]: '2%', ['--reveal-duration' as string]: '260ms' }}
      >
        {loading ? (
          <SkeletonList count={3} height={72} />
        ) : error != null && (items == null || items.length === 0) ? (
          <WebCard>
            <EmptyState
              icon={<WifiOff sx={{ fontSize: 30 }} />}
              title="Couldn't load notifications"
              subtitle={error}
              action={
                <button type="button" className="btn-outlined" onClick={() => void load()}>
                  <Refresh sx={{ fontSize: 18 }} />
                  Retry
                </button>
              }
            />
          </WebCard>
        ) : items == null || items.length === 0 ? (
          <WebCard>
            <EmptyState
              icon={<NotificationsNone sx={{ fontSize: 30 }} />}
              title="Nothing yet"
              subtitle="Make a prediction — results and rewards will show up here."
            />
          </WebCard>
        ) : filtered!.length === 0 ? (
          <WebCard>
            <EmptyState
              icon={<FilterAltOffOutlined sx={{ fontSize: 30 }} />}
              title={`No ${kindLabel[filter!].toLowerCase()} yet`}
              subtitle="Try a different filter."
            />
          </WebCard>
        ) : (
          <WebCard padding={0}>
            {filtered!.map((item, i) => (
              <div key={item.id}>
                {i > 0 && <div className="divider" />}
                <Reveal delay={40 * i} duration={260} y={0.05}>
                  <NotificationRow item={item} />
                </Reveal>
              </div>
            ))}
          </WebCard>
        )}
      </div>
    </div>
  );
}

/**
 * Horizontal-scroll kind filter — only shows chips for kinds actually present
 * in the feed (no empty categories cluttering the row).
 */
function KindFilterRow({
  selected,
  present,
  onChange,
}: {
  selected: NotificationKind | null;
  present: Set<NotificationKind>;
  onChange: (k: NotificationKind | null) => void;
}) {
  const kinds = KIND_ORDER.filter((k) => present.has(k));
  return (
    <HScrollArrows>
      <KindPill
        label="All"
        icon={<AppsRounded sx={{ fontSize: 15 }} />}
        active={selected == null}
        onClick={() => onChange(null)}
      />
      {kinds.map((k) => (
        <KindPill
          key={k}
          label={kindLabel[k]}
          icon={<Icon name={notificationKindIconName[k]} size={15} />}
          active={selected === k}
          onClick={() => onChange(k)}
        />
      ))}
    </HScrollArrows>
  );
}

function KindPill({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginRight: 8,
        padding: '9px 14px',
        flexShrink: 0,
        background: active ? withAlpha(WebTokens.accent, 0.14) : 'rgba(255,255,255,0.04)',
        borderRadius: 999,
        border: `1px solid ${active ? withAlpha(WebTokens.accent, 0.55) : WebTokens.border}`,
        color: active ? WebTokens.accent : WebTokens.textSecondary,
        fontSize: 12.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        transition: 'background 150ms ease, border-color 150ms ease, color 150ms ease',
      }}
    >
      <span style={{ display: 'inline-flex', color: active ? WebTokens.accent : WebTokens.textMuted }}>
        {icon}
      </span>
      {label}
    </button>
  );
}

function kindTint(kind: NotificationKind): string {
  switch (kind) {
    case 'lucky':
      return WebTokens.gold;
    case 'result':
      return WebTokens.accent;
    case 'badge':
      return WebTokens.gold;
    case 'leaderboard':
      return WebTokens.violet;
    case 'reminder':
      return WebTokens.accent;
    case 'system':
    default:
      return WebTokens.textSecondary;
  }
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const markRead = useNotificationsStore((s) => s.markRead);
  const tint = kindTint(item.kind);

  return (
    <button
      type="button"
      onClick={item.unread ? () => void markRead(item) : undefined}
      disabled={!item.unread}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        width: '100%',
        padding: '16px 20px',
        textAlign: 'left',
        // Unread rows carry a soft background tint too — the status isn't
        // signaled by color alone (the dot) or weight alone (the title);
        // together they read clearly even for colorblind users.
        background: item.unread ? withAlpha(WebTokens.accent, 0.05) : 'transparent',
        cursor: item.unread ? 'pointer' : 'default',
      }}
    >
      <span
        style={{
          width: 38,
          height: 38,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: withAlpha(tint, 0.12),
          borderRadius: 12,
        }}
      >
        <Icon name={notificationKindIconName[item.kind]} size={19} color={tint} />
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontWeight: item.unread ? 700 : 600,
            fontSize: 14,
            color: WebTokens.textPrimary,
          }}
        >
          {item.title}
        </span>
        {item.body.length > 0 && (
          <span
            className="f-inter"
            style={{
              marginTop: 3,
              display: 'block',
              color: WebTokens.textSecondary,
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            {item.body}
          </span>
        )}
      </span>

      <span
        style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 8,
        }}
      >
        <span style={{ color: WebTokens.textMuted, fontSize: 12 }}>{item.timeAgo}</span>
        {item.unread && (
          // A text badge, not just a color dot — reads clearly regardless of
          // color perception.
          <span
            style={{
              padding: '3px 7px',
              background: withAlpha(WebTokens.accent, 0.16),
              borderRadius: 999,
              color: WebTokens.accent,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 0.4,
            }}
          >
            NEW
          </span>
        )}
      </span>
    </button>
  );
}
