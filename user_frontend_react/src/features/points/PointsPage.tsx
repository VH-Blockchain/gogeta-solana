import { useEffect } from 'react';
import AccountBalanceWalletRounded from '@mui/icons-material/AccountBalanceWalletRounded';
import AddCircleOutlineRounded from '@mui/icons-material/AddCircleOutlineRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import HourglassTopRounded from '@mui/icons-material/HourglassTopRounded';
import BlockRounded from '@mui/icons-material/BlockRounded';
import WifiOff from '@mui/icons-material/WifiOff';
import type { PointPurchase, PointPurchaseStatus } from '@/data/api/pointsRepository';
import { shortenAddress } from '@/core/web3/solanaConfig';
import { usePointsStore } from '@/store/pointsStore';
import { useUserStore } from '@/store/userStore';
import { WebTokens, cardShadow, withAlpha } from '@/theme/webTokens';
import { GlowButton } from '@/components/GlowButton';
import { HeroBackgroundArt } from '@/components/HeroArt';
import { HeroStat } from '@/components/HeroStat';
import { EmptyState, pagePadding } from '@/components/Primitives';
import { Reveal } from '@/components/Reveal';
import { SkeletonCard } from '@/components/Skeleton';
import { WebCard } from '@/components/WebCard';
import { useElementWidth } from '@/hooks/useElementWidth';
import { useWindowWidth } from '@/hooks/useWindowWidth';
import { useSolanaWallet } from './useSolanaWallet';

/**
 * Points & wallet (§5, §12): the balance, the Buy Points entry point, and the
 * user's purchase history.
 */
export function PointsPage() {
  const width = useWindowWidth();
  const [hostRef, hostWidth] = useElementWidth();
  const wallet = useSolanaWallet();

  const coins = useUserStore((s) => s.user.coins);
  const config = usePointsStore((s) => s.config);
  const configLoading = usePointsStore((s) => s.configLoading);
  const configError = usePointsStore((s) => s.configError);
  const purchases = usePointsStore((s) => s.purchases);
  const purchasedPoints = usePointsStore((s) => s.purchasedPoints);
  const usdcSpent = usePointsStore((s) => s.usdcSpent);
  const historyLoading = usePointsStore((s) => s.historyLoading);
  const historyError = usePointsStore((s) => s.historyError);
  const loadConfig = usePointsStore((s) => s.loadConfig);
  const loadHistory = usePointsStore((s) => s.loadHistory);
  const refreshBalance = usePointsStore((s) => s.refreshBalance);
  // The dialog itself is mounted by the topbar (its Buy button lives there), so
  // this page opens that one instance rather than rendering a second.
  const openBuy = usePointsStore((s) => s.openBuy);

  useEffect(() => {
    void loadConfig();
    void loadHistory();
    void refreshBalance();
  }, [loadConfig, loadHistory, refreshBalance]);

  const padding = pagePadding(width);
  const narrow = hostWidth > 0 && hostWidth < WebTokens.bpTablet;
  const purchaseUnavailable = config != null && !config.enabled;

  return (
    <div style={{ padding }} ref={hostRef}>
      <Reveal duration={350} y={0.05}>
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            padding: narrow ? '22px 20px' : '28px 32px',
            background: `linear-gradient(135deg, ${withAlpha(WebTokens.gold, 0.14)}, ${withAlpha(WebTokens.accent, 0.07)})`,
            border: `${WebTokens.borderWidth}px solid ${WebTokens.glassStroke}`,
            borderRadius: WebTokens.radiusCard,
            boxShadow: cardShadow,
          }}
        >
          <HeroBackgroundArt icon={<AccountBalanceWalletRounded sx={{ fontSize: 340 }} />} />
          <div style={{ position: 'relative' }}>
            <p style={{ color: WebTokens.textMuted, fontSize: 12, letterSpacing: 0.4 }}>
              POINTS BALANCE
            </p>
            <div
              className="f-opensans"
              style={{
                marginTop: 8,
                fontSize: narrow ? 38 : 46,
                fontWeight: 700,
                lineHeight: 1.05,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {coins.toLocaleString()}
              <span style={{ marginLeft: 10, color: WebTokens.textMuted, fontSize: 16, fontWeight: 500 }}>
                Points
              </span>
            </div>

            <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <HeroStat
                icon={<AddCircleOutlineRounded />}
                value={purchasedPoints.toLocaleString()}
                label="bought"
                tint={WebTokens.gold}
              />
              <HeroStat
                icon={<ReceiptLongRounded />}
                value={`${usdcSpent} USDC`}
                label="spent"
                tint={WebTokens.accent}
              />
              {config && (
                <HeroStat
                  icon={<AccountBalanceWalletRounded />}
                  value={`1 : ${config.rate.usdcToPoints}`}
                  label="USDC to points"
                  tint={WebTokens.violet}
                />
              )}
            </div>

            <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
              <GlowButton
                label="Buy Points"
                height={48}
                icon={<AddCircleOutlineRounded style={{ fontSize: 18 }} />}
                onClick={purchaseUnavailable || configLoading ? null : openBuy}
              />
              {wallet.isConnected && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '9px 13px',
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${WebTokens.glassStroke}`,
                    borderRadius: 999,
                    fontSize: 12.5,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: WebTokens.accent,
                    }}
                  />
                  <span className="f-opensans">{shortenAddress(wallet.address)}</span>
                  <button
                    type="button"
                    onClick={() => wallet.disconnect()}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: WebTokens.textMuted,
                      fontSize: 11,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Disconnect
                  </button>
                </span>
              )}
            </div>

            {purchaseUnavailable && config?.unavailableReason && (
              <p style={{ marginTop: 14, color: WebTokens.gold, fontSize: 12.5, maxWidth: 520 }}>
                {config.unavailableReason}
              </p>
            )}
            {configError && (
              <p style={{ marginTop: 14, color: WebTokens.danger, fontSize: 12.5 }}>{configError}</p>
            )}
          </div>
        </div>
      </Reveal>

      <div style={{ height: 26 }} />

      <h2 className="t-title-large">Points purchase history</h2>
      <p style={{ marginTop: 6, color: WebTokens.textSecondary, fontSize: 13 }}>
        Every purchase, with its on-chain transaction.
      </p>

      <div style={{ height: 16 }} />

      {historyError ? (
        <WebCard>
          <EmptyState
            icon={<WifiOff />}
            title="Could not load your purchases"
            subtitle={historyError}
            action={<GlowButton label="Try again" height={46} onClick={() => void loadHistory()} />}
          />
        </WebCard>
      ) : historyLoading && purchases.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Array.from({ length: 2 }, (_, i) => (
            <SkeletonCard key={i} height={78} />
          ))}
        </div>
      ) : purchases.length === 0 ? (
        <WebCard>
          <EmptyState
            icon={<ReceiptLongRounded />}
            title="No purchases yet"
            subtitle="Points you buy with USDC will appear here."
            action={
              <GlowButton
                label="Buy Points"
                height={46}
                onClick={purchaseUnavailable ? null : openBuy}
              />
            }
          />
        </WebCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {purchases.map((p) => (
            <PurchaseRow key={p.id} purchase={p} narrow={hostWidth > 0 && hostWidth < 620} />
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_STYLE: Record<
  PointPurchaseStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  CONFIRMED: { label: 'Confirmed', color: WebTokens.accent, icon: <CheckCircleRounded style={{ fontSize: 13 }} /> },
  PENDING: { label: 'Pending', color: WebTokens.gold, icon: <HourglassTopRounded style={{ fontSize: 13 }} /> },
  FAILED: { label: 'Failed', color: WebTokens.danger, icon: <ErrorOutlineRounded style={{ fontSize: 13 }} /> },
  EXPIRED: { label: 'Expired', color: WebTokens.textMuted, icon: <BlockRounded style={{ fontSize: 13 }} /> },
  CANCELLED: { label: 'Cancelled', color: WebTokens.textMuted, icon: <BlockRounded style={{ fontSize: 13 }} /> },
};

function PurchaseRow({ purchase: p, narrow }: { purchase: PointPurchase; narrow: boolean }) {
  const s = STATUS_STYLE[p.status];
  const confirmed = p.status === 'CONFIRMED';

  return (
    <WebCard padding={narrow ? 16 : '18px 20px'}>
      <div
        style={{
          display: 'flex',
          flexDirection: narrow ? 'column' : 'row',
          alignItems: narrow ? 'stretch' : 'center',
          gap: narrow ? 12 : 18,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span className="f-opensans" style={{ fontSize: 16, fontWeight: 600 }}>
              {p.usdcAmount} USDC
            </span>
            <span
              className="f-opensans"
              style={{
                color: confirmed ? WebTokens.accent : WebTokens.textMuted,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {confirmed ? '+' : ''}
              {p.points.toLocaleString()} Points
            </span>
          </div>
          <div style={{ marginTop: 4, color: WebTokens.textMuted, fontSize: 12 }}>
            {formatDate(p.createdAtMs)} · 1 : {p.exchangeRate} · {p.networkName}
          </div>
          <div style={{ marginTop: 3, color: WebTokens.textMuted, fontSize: 11.5 }}>
            {shortenAddress(p.walletAddress)}
            {p.transactionSignature && (
              <>
                {' · '}
                <a
                  href={p.explorerUrl ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: WebTokens.accent, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                >
                  {shortenAddress(p.transactionSignature)}
                  <OpenInNewRounded style={{ fontSize: 12 }} />
                </a>
              </>
            )}
          </div>
          {p.failureReason && (
            <div style={{ marginTop: 6, color: WebTokens.danger, fontSize: 11.5 }}>
              {p.failureReason}
            </div>
          )}
        </div>

        <span
          style={{
            flexShrink: 0,
            alignSelf: narrow ? 'flex-start' : 'center',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 11px',
            background: withAlpha(s.color, 0.12),
            border: `1px solid ${withAlpha(s.color, 0.3)}`,
            borderRadius: 999,
            color: s.color,
            fontSize: 11.5,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {s.icon} {s.label}
        </span>
      </div>
    </WebCard>
  );
}

function formatDate(msValue: number): string {
  if (!msValue) return '—';
  return new Date(msValue).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
