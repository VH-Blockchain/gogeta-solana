import { useCallback, useEffect, useMemo, useState } from 'react';
import CloseRounded from '@mui/icons-material/CloseRounded';
import AccountBalanceWalletRounded from '@mui/icons-material/AccountBalanceWalletRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import { isApiException } from '@/core/network/apiException';
import { shortenAddress } from '@/core/web3/solanaConfig';
import {
  WithdrawalsRepository,
  type WithdrawalAvailability,
} from '@/data/api/withdrawalsRepository';
import { WebTokens, panelFillBottom, withAlpha } from '@/theme/webTokens';
import { GlowButton } from '@/components/GlowButton';
import { DialogCard, Modal } from '@/components/Modal';
import { useSolanaWallet, walletErrorMessage } from '@/features/points/useSolanaWallet';

/**
 * Withdraw Points (§4, §29).
 *
 * Requesting a withdrawal is not a chain transaction — it files a request an
 * admin reviews and pays out. So unlike BuyPointsDialog there is no signing
 * step; the wallet is here only to name the destination, which is why it must be
 * connected and shown plainly before confirmation (§29).
 *
 * The payout shown is a preview. The server recomputes it from its own rate and
 * its own view of the ledger, and that value is the one stored (§25).
 */
export function WithdrawDialog({
  open,
  onClose,
  availability,
  onRequested,
}: {
  open: boolean;
  onClose: () => void;
  availability: WithdrawalAvailability | null;
  /** Fired after a request is filed, so the profile can refresh its numbers. */
  onRequested: () => void;
}) {
  const wallet = useSolanaWallet();

  const [points, setPoints] = useState('');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ points: number; amount: string } | null>(null);

  const available = availability?.availableToWithdraw ?? 0;
  const minimum = availability?.minimumWithdrawal ?? 1000;
  const rate = availability?.pointsPerToken ?? 100;
  const symbol = availability?.network.tokenSymbol ?? 'USDC';
  const decimals = availability?.network.tokenDecimals ?? 6;

  // Reopening always starts clean — a previous success or error must never greet
  // the next request.
  useEffect(() => {
    if (!open) return;
    setPoints(available >= minimum ? String(available) : '');
    setNote('');
    setConfirmed(false);
    setBusy(false);
    setError(null);
    setDone(null);
  }, [open, available, minimum]);

  /** Mirrors the server's validation so the button can explain itself. */
  const validation = useMemo(() => {
    const text = points.trim();
    if (text === '') return { ok: false as const, reason: null };
    if (!/^\d+$/.test(text)) {
      return { ok: false as const, reason: 'Enter a whole number of points.' };
    }
    const value = Number(text);
    if (!(value > 0)) return { ok: false as const, reason: 'Enter more than zero points.' };
    if (value < minimum) {
      return {
        ok: false as const,
        reason: `The minimum withdrawal is ${minimum.toLocaleString()} points.`,
      };
    }
    if (value > available) {
      return {
        ok: false as const,
        reason: `You only have ${available.toLocaleString()} points available to withdraw.`,
      };
    }
    return { ok: true as const, reason: null };
  }, [points, minimum, available]);

  /**
   * Live payout preview. Integer maths on the smallest unit, floored — the exact
   * calculation the server performs, so the preview cannot promise more than the
   * request will be worth.
   */
  const preview = useMemo(() => {
    if (!validation.ok || rate <= 0) return '0';
    const raw = (BigInt(points.trim()) * 10n ** BigInt(decimals)) / BigInt(rate);
    const scale = 10n ** BigInt(decimals);
    const whole = raw / scale;
    const frac = (raw % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : whole.toString();
  }, [points, validation.ok, rate, decimals]);

  const submit = useCallback(async () => {
    if (!wallet.address) return;
    setBusy(true);
    setError(null);
    try {
      const created = await WithdrawalsRepository.create(
        Number(points.trim()),
        wallet.address,
        note.trim() || undefined,
      );
      setDone({ points: created.points, amount: created.amount });
      onRequested();
    } catch (e) {
      setError(isApiException(e) ? e.message : walletErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [wallet.address, points, note, onRequested]);

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      dismissible={!busy}
      labelledBy="withdraw-title"
    >
      <DialogCard maxWidth={460}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <h2 id="withdraw-title" className="t-title-large" style={{ flex: 1, fontSize: 20 }}>
            {done ? 'Withdrawal requested' : 'Withdraw Points'}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={busy ? undefined : onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: WebTokens.textMuted,
              cursor: busy ? 'default' : 'pointer',
              display: 'inline-flex',
              padding: 2,
            }}
          >
            <CloseRounded fontSize="small" />
          </button>
        </div>

        {/* ── Filed ───────────────────────────────────────────────────── */}
        {done ? (
          <div style={{ paddingTop: 10, textAlign: 'center' }}>
            <span style={{ color: WebTokens.accent, display: 'inline-flex' }}>
              <CheckCircleRounded style={{ fontSize: 46 }} />
            </span>
            <p className="t-title-medium" style={{ marginTop: 12 }}>
              {done.points.toLocaleString()} points → {done.amount} {symbol}
            </p>
            <p
              className="f-opensans"
              style={{
                marginTop: 10,
                color: WebTokens.textSecondary,
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              Your request is pending review. These points are reserved until it is
              processed, and your balance is only deducted once the payout is sent.
              You will be notified when the status changes.
            </p>
            <div style={{ marginTop: 20 }}>
              <GlowButton label="Done" fullWidth height={46} onClick={onClose} />
            </div>
          </div>
        ) : (
          <>
            {/* ── What can be withdrawn (§4) ────────────────────────── */}
            <div
              style={{
                marginTop: 14,
                padding: 14,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${WebTokens.glassStroke}`,
                borderRadius: WebTokens.radiusControl,
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
              }}
            >
              <MetaRow
                label="Available to withdraw"
                value={`${available.toLocaleString()} Points`}
                strong
              />
              <MetaRow label="Minimum withdrawal" value={`${minimum.toLocaleString()} Points`} />
              {(availability?.reservedPoints ?? 0) > 0 && (
                <MetaRow
                  label="Already reserved"
                  value={`${(availability?.reservedPoints ?? 0).toLocaleString()} Points`}
                />
              )}
            </div>

            {/* ── Amount ───────────────────────────────────────────── */}
            <div style={{ marginTop: 16 }}>
              <label
                htmlFor="withdraw-points"
                style={{
                  display: 'block',
                  marginBottom: 6,
                  color: WebTokens.textSecondary,
                  fontSize: 12.5,
                }}
              >
                Points to withdraw
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="withdraw-points"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  disabled={busy}
                  inputMode="numeric"
                  placeholder={String(minimum)}
                  className="f-opensans"
                  style={{
                    width: '100%',
                    padding: '14px 118px 14px 14px',
                    background: 'rgba(0,0,0,0.28)',
                    border: `1px solid ${
                      validation.reason ? withAlpha(WebTokens.danger, 0.6) : WebTokens.glassStroke
                    }`,
                    borderRadius: WebTokens.radiusControl,
                    color: WebTokens.textPrimary,
                    fontSize: 17,
                    fontWeight: 600,
                    outline: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setPoints(String(available))}
                    disabled={busy || available < minimum}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color:
                        available < minimum ? WebTokens.textMuted : WebTokens.accent,
                      fontSize: 11.5,
                      fontWeight: 700,
                      letterSpacing: 0.4,
                      cursor: available < minimum ? 'default' : 'pointer',
                    }}
                  >
                    MAX
                  </button>
                  <span
                    style={{ color: WebTokens.textMuted, fontSize: 13, fontWeight: 600 }}
                  >
                    Points
                  </span>
                </div>
              </div>
              {validation.reason && (
                <p style={{ marginTop: 6, color: WebTokens.danger, fontSize: 12 }}>
                  {validation.reason}
                </p>
              )}
            </div>

            {/* ── Live conversion (§4) ─────────────────────────────── */}
            <div
              style={{
                marginTop: 14,
                padding: 14,
                background: withAlpha(WebTokens.accent, 0.07),
                border: `1px solid ${withAlpha(WebTokens.accent, 0.25)}`,
                borderRadius: WebTokens.radiusControl,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span style={{ color: WebTokens.textSecondary, fontSize: 12.5 }}>
                  You will receive
                </span>
                <span
                  className="f-opensans"
                  style={{
                    color: WebTokens.accent,
                    fontSize: 20,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {preview} {symbol}
                </span>
              </div>
              <div style={{ marginTop: 6, color: WebTokens.textMuted, fontSize: 11.5 }}>
                Rate: {rate} points = 1 {symbol} · the same rate points are bought at
              </div>
            </div>

            {/* ── Destination wallet (§29) ─────────────────────────── */}
            <WalletDestination wallet={wallet} />

            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <MetaRow
                label="Network"
                value={availability?.network.networkName ?? 'Solana Devnet'}
              />
            </div>

            <div style={{ marginTop: 14 }}>
              <label
                htmlFor="withdraw-note"
                style={{
                  display: 'block',
                  marginBottom: 6,
                  color: WebTokens.textSecondary,
                  fontSize: 12.5,
                }}
              >
                Note for the reviewer (optional)
              </label>
              <input
                id="withdraw-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={busy}
                maxLength={300}
                placeholder="Anything the admin should know"
                style={{
                  width: '100%',
                  padding: '11px 13px',
                  background: 'rgba(0,0,0,0.28)',
                  border: `1px solid ${WebTokens.glassStroke}`,
                  borderRadius: WebTokens.radiusControl,
                  color: WebTokens.textPrimary,
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>

            {/* Explicit confirmation: §29 forbids a withdrawal quietly going to
                a wallet the user never looked at. */}
            {wallet.isConnected && (
              <label
                style={{
                  marginTop: 14,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 9,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  disabled={busy}
                  style={{ marginTop: 2, accentColor: WebTokens.accent }}
                />
                <span
                  style={{ color: WebTokens.textSecondary, fontSize: 12.5, lineHeight: 1.5 }}
                >
                  I confirm {shortenAddress(wallet.address)} is my destination wallet on{' '}
                  {availability?.network.networkName ?? 'Solana Devnet'}.
                </span>
              </label>
            )}

            {(error || availability?.unavailableReason) && (
              <div
                style={{
                  marginTop: 14,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 9,
                  padding: '11px 13px',
                  background: withAlpha(WebTokens.danger, 0.09),
                  border: `1px solid ${withAlpha(WebTokens.danger, 0.3)}`,
                  borderRadius: WebTokens.radiusControl,
                }}
              >
                <span
                  style={{ color: WebTokens.danger, display: 'inline-flex', flexShrink: 0 }}
                >
                  <ErrorOutlineRounded style={{ fontSize: 17 }} />
                </span>
                <span
                  style={{ color: WebTokens.danger, fontSize: 12.5, lineHeight: 1.5 }}
                >
                  {error ?? availability?.unavailableReason}
                </span>
              </div>
            )}

            {/* ── Actions ──────────────────────────────────────────── */}
            {/* Pinned to the bottom of the card. This dialog is the tallest in
                the portal and overflows a laptop viewport at 100% zoom, so the
                card scrolls — and a primary action that scrolls out of sight is
                the wrong thing to hide in a flow that moves real money. Sticky
                rather than a flex footer so the rest of the body keeps its
                existing single-column flow untouched.
                The negative margins cancel the card's own padding so the bar
                spans the full width and sits flush with the bottom edge; the
                background is opaque rather than the card's gradient, which
                would not line up when re-declared on a child box. */}
            <div
              style={{
                position: 'sticky',
                bottom: -20,
                zIndex: 1,
                marginTop: 18,
                marginLeft: -24,
                marginRight: -24,
                marginBottom: -20,
                padding: '14px 24px 20px',
                background: panelFillBottom,
                borderTop: `1px solid ${WebTokens.glassStroke}`,
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={busy ? undefined : onClose}
                style={{
                  height: 46,
                  padding: '0 18px',
                  background: 'transparent',
                  border: `1px solid ${WebTokens.glassStroke}`,
                  borderRadius: WebTokens.radiusControl,
                  color: WebTokens.textSecondary,
                  fontSize: 14,
                  cursor: busy ? 'default' : 'pointer',
                }}
              >
                Cancel
              </button>
              <PrimaryAction
                wallet={wallet}
                busy={busy}
                canSubmit={
                  validation.ok && confirmed && availability?.unavailableReason == null
                }
                onSubmit={submit}
              />
            </div>
          </>
        )}
      </DialogCard>
    </Modal>
  );
}

/**
 * One obvious next action, the same pattern the purchase dialog uses: connect,
 * then switch network, then request.
 */
function PrimaryAction({
  wallet,
  busy,
  canSubmit,
  onSubmit,
}: {
  wallet: ReturnType<typeof useSolanaWallet>;
  busy: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  if (!wallet.available) {
    return <GlowButton label="Wallet unavailable" height={46} onClick={null} />;
  }
  if (!wallet.isConnected) {
    return (
      <GlowButton
        label="Connect Wallet"
        height={46}
        icon={<AccountBalanceWalletRounded style={{ fontSize: 17 }} />}
        busy={wallet.connecting}
        onClick={wallet.connect}
      />
    );
  }
  return (
    <GlowButton
      label="Request Withdrawal"
      height={46}
      busy={busy}
      onClick={canSubmit ? onSubmit : null}
    />
  );
}

/** The destination wallet, stated plainly rather than assumed (§29). */
function WalletDestination({ wallet }: { wallet: ReturnType<typeof useSolanaWallet> }) {
  if (!wallet.available) {
    return (
      <div
        style={{
          marginTop: 14,
          padding: 13,
          background: withAlpha(WebTokens.danger, 0.08),
          border: `1px solid ${withAlpha(WebTokens.danger, 0.28)}`,
          borderRadius: WebTokens.radiusControl,
          color: WebTokens.danger,
          fontSize: 12.5,
          lineHeight: 1.5,
        }}
      >
        No Solana wallet was detected, so there is nowhere to send a payout. Install Phantom
        or Solflare to withdraw.
      </div>
    );
  }

  if (!wallet.isConnected) {
    return (
      <div
        style={{
          marginTop: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: 13,
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${WebTokens.glassStroke}`,
          borderRadius: WebTokens.radiusControl,
        }}
      >
        <span style={{ color: WebTokens.textMuted, display: 'inline-flex' }}>
          <AccountBalanceWalletRounded style={{ fontSize: 18 }} />
        </span>
        <span style={{ color: WebTokens.textSecondary, fontSize: 12.5 }}>
          Connect your wallet — its address is where the payout is sent.
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 14,
        padding: 13,
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${WebTokens.glassStroke}`,
        borderRadius: WebTokens.radiusControl,
      }}
    >
      <div style={{ color: WebTokens.textMuted, fontSize: 11, letterSpacing: 0.5 }}>
        CONNECTED WALLET
      </div>
      <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 8,
            height: 8,
            flexShrink: 0,
            borderRadius: '50%',
            background: WebTokens.accent,
          }}
        />
        {/* The full address, not a shortened one: this is the last chance to spot
            the wrong wallet. */}
        <span
          className="f-opensans"
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12.5,
            fontWeight: 600,
            wordBreak: 'break-all',
          }}
        >
          {wallet.address}
        </span>
        <button
          type="button"
          onClick={() => wallet.disconnect()}
          style={{
            background: 'transparent',
            border: 'none',
            color: WebTokens.textMuted,
            fontSize: 11.5,
            cursor: 'pointer',
            textDecoration: 'underline',
            flexShrink: 0,
          }}
        >
          Change
        </button>
      </div>
      {/* Names the cluster the payout will be sent on, so the destination is
          never ambiguous (§32). */}
      <p style={{ marginTop: 8, color: WebTokens.textMuted, fontSize: 12 }}>
        {wallet.networkName}
      </p>
    </div>
  );
}

function MetaRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span style={{ color: WebTokens.textMuted, fontSize: 12 }}>{label}</span>
      <span
        className="f-opensans"
        style={{
          color: strong ? WebTokens.textPrimary : WebTokens.textSecondary,
          fontSize: strong ? 14 : 12.5,
          fontWeight: strong ? 700 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}
