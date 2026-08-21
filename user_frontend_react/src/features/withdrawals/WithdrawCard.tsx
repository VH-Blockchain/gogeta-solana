import { useCallback, useEffect, useState } from 'react';
import AccountBalanceWalletRounded from '@mui/icons-material/AccountBalanceWalletRounded';
import CallMadeRounded from '@mui/icons-material/CallMadeRounded';
import LockClockRounded from '@mui/icons-material/LockClockRounded';
import PaidRounded from '@mui/icons-material/PaidRounded';
import SavingsRounded from '@mui/icons-material/SavingsRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import { isApiException } from '@/core/network/apiException';
import { shortenAddress } from '@/core/web3/solanaConfig';
import {
  WithdrawalsRepository,
  type WithdrawalAvailability,
  type WithdrawalRequest,
  type WithdrawalStatus,
} from '@/data/api/withdrawalsRepository';
import { usePointsStore } from '@/store/pointsStore';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import { GlowButton } from '@/components/GlowButton';
import { AlertDialogCard, Modal } from '@/components/Modal';
import { EmptyState, SectionHeader, StatusChip } from '@/components/Primitives';
import { SkeletonList } from '@/components/Skeleton';
import { StatTile } from '@/components/StatTile';
import { WebCard } from '@/components/WebCard';
import { columnWidth } from '@/hooks/useElementWidth';
import { toast } from '@/hooks/useToast';
import { WithdrawDialog } from './WithdrawDialog';

/**
 * The profile's points-and-withdrawal block (§1, §28).
 *
 * All four figures come from `/withdrawals/available` rather than being derived
 * here — the server owns what "withdrawable" means, and a second definition in
 * the client would eventually disagree with it.
 */
export function WithdrawCard({ contentWidth }: { contentWidth: number }) {
  const [avail, setAvail] = useState<WithdrawalAvailability | null>(null);
  const [history, setHistory] = useState<WithdrawalRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState<WithdrawalRequest | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  const openBuy = usePointsStore((s) => s.openBuy);

  const load = useCallback(async () => {
    try {
      const [a, h] = await Promise.all([
        WithdrawalsRepository.available(),
        WithdrawalsRepository.history({ take: 10 }),
      ]);
      setAvail(a);
      setHistory(h.items);
      setError(null);
    } catch (e) {
      setError(isApiException(e) ? e.message : 'Could not load your withdrawal details.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = useCallback(async () => {
    if (!cancelling) return;
    setCancelBusy(true);
    try {
      await WithdrawalsRepository.cancel(cancelling.id);
      toast('Withdrawal request cancelled. Your points are available again.');
      setCancelling(null);
      await load();
    } catch (e) {
      toast(isApiException(e) ? e.message : 'Could not cancel that request.');
    } finally {
      setCancelBusy(false);
    }
  }, [cancelling, load]);

  const cols = contentWidth >= 860 ? 4 : contentWidth >= 520 ? 2 : 1;
  const tileWidth = columnWidth(contentWidth, cols);
  const belowMinimum =
    avail != null && avail.availableToWithdraw < avail.minimumWithdrawal;

  return (
    <>
      <SectionHeader
        title="Points & withdrawals"
        trailing={
          avail != null ? (
            <span style={{ color: WebTokens.textMuted, fontSize: 13 }}>
              {avail.pointsPerToken} points = 1 {avail.network.tokenSymbol}
            </span>
          ) : undefined
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ width: tileWidth > 0 ? tileWidth : '100%' }}>
          <StatTile
            icon={<PaidRounded />}
            label="Total points"
            value={(avail?.totalPoints ?? 0).toLocaleString()}
            accent={WebTokens.gold}
          />
        </div>
        <div style={{ width: tileWidth > 0 ? tileWidth : '100%' }}>
          <StatTile
            icon={<SavingsRounded />}
            label="Withdrawable points"
            value={(avail?.withdrawablePoints ?? 0).toLocaleString()}
            accent={WebTokens.accent}
          />
        </div>
        <div style={{ width: tileWidth > 0 ? tileWidth : '100%' }}>
          <StatTile
            icon={<LockClockRounded />}
            label="Reserved for withdrawal"
            value={(avail?.reservedPoints ?? 0).toLocaleString()}
            accent={WebTokens.violet}
          />
        </div>
        <div style={{ width: tileWidth > 0 ? tileWidth : '100%' }}>
          <StatTile
            icon={<CallMadeRounded />}
            label="Available to withdraw"
            value={(avail?.availableToWithdraw ?? 0).toLocaleString()}
            accent={WebTokens.blue}
          />
        </div>
      </div>

      <div style={{ height: 16 }} />

      <WebCard>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {avail == null
                ? // Not "loading" once a load has failed — that would sit
                  // contradicting the error message right beneath it.
                  error != null
                  ? 'Withdrawal details unavailable'
                  : 'Loading your withdrawal details…'
                : !avail.enabled || avail.unavailableReason != null
                  ? 'Withdrawals are unavailable'
                  : belowMinimum
                    ? `You need at least ${avail.minimumWithdrawal.toLocaleString()} withdrawable points.`
                    : `Cash out up to ${avail.previewAmount} ${avail.network.tokenSymbol}.`}
            </div>
            <div
              style={{
                marginTop: 5,
                color: WebTokens.textMuted,
                fontSize: 12.5,
                lineHeight: 1.55,
              }}
            >
              {error ??
                avail?.unavailableReason ??
                'Purchased points and points earned from predictions and quizzes can be cashed out. Signup and bonus points cannot.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <button type="button" className="btn-outlined" onClick={openBuy}>
              <AccountBalanceWalletRounded sx={{ fontSize: 16 }} />
              Buy Points
            </button>
            <GlowButton
              label="Withdraw"
              height={44}
              icon={<CallMadeRounded style={{ fontSize: 17 }} />}
              // Disabled rather than hidden: the message above explains why, so
              // a user who cannot withdraw still learns what would let them.
              onClick={
                avail != null && avail.canWithdraw ? () => setDialogOpen(true) : null
              }
            />
          </div>
        </div>
      </WebCard>

      <div style={{ height: 24 }} />

      <SectionHeader title="Withdrawal history" />
      {history == null && error != null ? (
        // "No withdrawals yet" would be a claim this failed fetch cannot make.
        <WebCard>
          <EmptyState
            icon={<ReceiptLongOutlined sx={{ fontSize: 30 }} />}
            title="History unavailable"
            subtitle={error}
          />
        </WebCard>
      ) : history == null ? (
        <SkeletonList count={2} height={64} />
      ) : history.length === 0 ? (
        <WebCard>
          <EmptyState
            icon={<ReceiptLongOutlined sx={{ fontSize: 30 }} />}
            title="No withdrawals yet"
            subtitle="Your requests and their status will appear here."
          />
        </WebCard>
      ) : (
        <WebCard padding={0}>
          {history.map((r, i) => (
            <div key={r.id}>
              {i > 0 && <div className="divider" />}
              <WithdrawalRow
                request={r}
                narrow={contentWidth < 620}
                onCancel={() => setCancelling(r)}
              />
            </div>
          ))}
        </WebCard>
      )}

      <WithdrawDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        availability={avail}
        onRequested={() => void load()}
      />

      <Modal open={cancelling != null} onClose={() => setCancelling(null)}>
        <AlertDialogCard
          title="Cancel this request?"
          actions={
            <>
              <button
                type="button"
                className="btn-text"
                disabled={cancelBusy}
                onClick={() => setCancelling(null)}
              >
                Keep it
              </button>
              <button
                type="button"
                className="btn-filled"
                disabled={cancelBusy}
                onClick={() => void cancel()}
              >
                {cancelBusy ? 'Cancelling…' : 'Cancel request'}
              </button>
            </>
          }
        >
          <p style={{ color: WebTokens.textSecondary, fontSize: 14, lineHeight: 1.6 }}>
            {cancelling != null
              ? `${cancelling.points.toLocaleString()} points will be released back to your available balance.`
              : ''}
          </p>
        </AlertDialogCard>
      </Modal>
    </>
  );
}

/** Colour and label per status (§14). */
const STATUS_STYLE: Record<WithdrawalStatus, { label: string; color: string }> = {
  PENDING: { label: 'PENDING', color: WebTokens.gold },
  APPROVED: { label: 'APPROVED', color: WebTokens.blue },
  PROCESSING: { label: 'PROCESSING', color: WebTokens.violet },
  COMPLETED: { label: 'COMPLETED', color: WebTokens.accent },
  REJECTED: { label: 'REJECTED', color: WebTokens.danger },
  FAILED: { label: 'FAILED', color: WebTokens.danger },
  CANCELLED: { label: 'CANCELLED', color: WebTokens.textMuted },
};

function WithdrawalRow({
  request,
  narrow,
  onCancel,
}: {
  request: WithdrawalRequest;
  narrow: boolean;
  onCancel: () => void;
}) {
  const style = STATUS_STYLE[request.status];
  const when = new Date(request.createdAtMs).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div style={{ padding: '14px 18px' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: narrow ? 'column' : 'row',
          alignItems: narrow ? 'flex-start' : 'center',
          gap: narrow ? 8 : 14,
        }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            background: withAlpha(style.color, 0.12),
            color: style.color,
          }}
        >
          <CallMadeRounded style={{ fontSize: 17 }} />
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="f-opensans" style={{ fontSize: 14, fontWeight: 700 }}>
            {request.points.toLocaleString()} Points → {request.amount}{' '}
            {request.tokenSymbol}
          </div>
          <div style={{ marginTop: 3, color: WebTokens.textMuted, fontSize: 12 }}>
            {when} · {shortenAddress(request.walletAddress)} · {request.exchangeRate}{' '}
            pts/{request.tokenSymbol}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
            flexWrap: 'wrap',
          }}
        >
          <StatusChip label={style.label} color={style.color} />
          {request.explorerUrl && (
            <a
              href={request.explorerUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                color: WebTokens.accent,
                fontSize: 12,
              }}
            >
              Receipt <OpenInNewRounded style={{ fontSize: 13 }} />
            </a>
          )}
          {request.status === 'PENDING' && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                background: 'transparent',
                border: 'none',
                color: WebTokens.textMuted,
                fontSize: 12,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* The admin's reason matters most when the answer was no (§23). */}
      {request.adminNote != null && request.adminNote !== '' && (
        <div
          style={{
            marginTop: 10,
            marginLeft: narrow ? 0 : 48,
            padding: '9px 12px',
            background: withAlpha(style.color, 0.07),
            border: `1px solid ${withAlpha(style.color, 0.22)}`,
            borderRadius: WebTokens.radiusControl,
            color: WebTokens.textSecondary,
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
        >
          {request.adminNote}
        </div>
      )}
    </div>
  );
}
