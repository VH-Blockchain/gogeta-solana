import { useCallback, useEffect, useMemo, useState } from 'react';
import CloseRounded from '@mui/icons-material/CloseRounded';
import AccountBalanceWalletRounded from '@mui/icons-material/AccountBalanceWalletRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import HourglassTopRounded from '@mui/icons-material/HourglassTopRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import { isApiException } from '@/core/network/apiException';
import { PointsRepository, type PurchaseConfig } from '@/data/api/pointsRepository';
import { explorerTxUrl, shortenAddress } from '@/core/web3/solanaConfig';
import { usePointsStore } from '@/store/pointsStore';
import { useUserStore } from '@/store/userStore';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import { ConfettiBurst } from '@/components/Confetti';
import { GlowButton } from '@/components/GlowButton';
import { DialogCard, Modal } from '@/components/Modal';
import { useSolanaWallet, walletErrorMessage } from './useSolanaWallet';

/**
 * Buy Points (§5, §27).
 *
 * The flow is a small state machine because each step can fail on its own and
 * the user needs to know which one did: quote → wallet payment → backend
 * verification → credited.
 *
 * Nothing here decides how many points are awarded. The server quotes them at
 * intent time and re-derives them from the chain at confirmation; this dialog
 * only displays what it is told.
 */
type Step = 'form' | 'paying' | 'verifying' | 'done' | 'failed';

const CONFETTI_COLORS = [WebTokens.accent, WebTokens.gold, WebTokens.violet];

/** How long to keep retrying verification while the chain confirms. */
const VERIFY_ATTEMPTS = 10;
const VERIFY_DELAY_MS = 3000;

export function BuyPointsDialog({
  open,
  onClose,
  config,
}: {
  open: boolean;
  onClose: () => void;
  config: PurchaseConfig | null;
}) {
  const wallet = useSolanaWallet();
  const coins = useUserStore((s) => s.user.coins);
  const refreshBalance = usePointsStore((s) => s.refreshBalance);
  const loadHistory = usePointsStore((s) => s.loadHistory);

  const [amount, setAmount] = useState('10');
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [creditedPoints, setCreditedPoints] = useState(0);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);

  const rate = config?.rate.usdcToPoints ?? 100;
  const minUsdc = config?.rate.minUsdc ?? 1;
  const maxUsdc = config?.rate.maxUsdc ?? 1000;
  const decimals = config?.network.usdcDecimals ?? 6;

  // Reset whenever the dialog is reopened, so a previous success or failure
  // never greets the next purchase.
  useEffect(() => {
    if (!open) return;
    setStep('form');
    setError(null);
    setNote(null);
    setTxSignature(null);
    setExplorerUrl(null);
    setCreditedPoints(0);
  }, [open]);

  /** Local validation mirroring the server's, purely so the button can explain itself. */
  const validation = useMemo(() => {
    const text = amount.trim();
    if (text === '') return { ok: false as const, reason: null };
    if (!/^\d+(\.\d+)?$/.test(text)) {
      return { ok: false as const, reason: 'Enter a number, e.g. 10 or 2.50.' };
    }
    if ((text.split('.')[1]?.length ?? 0) > decimals) {
      return { ok: false as const, reason: `USDC supports at most ${decimals} decimal places.` };
    }
    const value = Number(text);
    if (!(value > 0)) return { ok: false as const, reason: 'Enter an amount greater than zero.' };
    if (value < minUsdc) return { ok: false as const, reason: `The minimum purchase is ${minUsdc} USDC.` };
    if (value > maxUsdc) return { ok: false as const, reason: `The maximum purchase is ${maxUsdc} USDC.` };
    return { ok: true as const, reason: null };
  }, [amount, decimals, minUsdc, maxUsdc]);

  /**
   * Points preview. Integer maths on the smallest unit and floored, matching the
   * server's calculation exactly — a preview that disagreed with the quote would
   * be worse than none.
   */
  const previewPoints = useMemo(() => {
    if (!validation.ok) return 0;
    const [whole, frac = ''] = amount.trim().split('.');
    const raw = BigInt(whole + frac.padEnd(decimals, '0').slice(0, decimals));
    return Number((raw * BigInt(rate)) / 10n ** BigInt(decimals));
  }, [amount, validation.ok, rate, decimals]);

  /**
   * True once this attempt's payment has left the wallet — either in flight, or
   * already signed and awaiting verification.
   *
   * `step` is the authority here rather than a separate flag, so the two can
   * never disagree about whether money has moved. A pre-payment failure
   * (rejected in the wallet, quote refused) leaves `txSignature` null and is
   * deliberately NOT counted, so the pre-flight check below is still available
   * on the retry screen — where the balance really is unchanged.
   */
  const paymentSubmitted = step === 'paying' || step === 'verifying' || txSignature != null;

  /**
   * Pre-flight balance check, meaningful only *before* paying.
   *
   * `payUsdc` refetches the wallet balance the moment the transfer confirms, so
   * a user who paid 30 of their 40 USDC now holds 10 while the amount field
   * still reads 30. Ungated, that lights up "Insufficient USDC balance" for the
   * entire verification window — seconds before the success screen — about a
   * payment that went through exactly as asked. The balance dropping is the
   * point of the transaction, not a problem with it.
   */
  const insufficientUsdc =
    !paymentSubmitted &&
    wallet.usdcBalance != null &&
    validation.ok &&
    Number(wallet.usdcBalance) < Number(amount.trim());

  const buy = useCallback(async () => {
    if (!config || !wallet.address) return;
    setError(null);
    setNote(null);
    // "Try again" is a fresh attempt, so the previous one's signature must not
    // carry over — it gates both the pre-flight check above and the
    // orphan-intent cleanup below.
    setTxSignature(null);

    let purchaseId: string | null = null;
    // Tracked locally as well as in state: the catch block below runs in this
    // closure, where `txSignature` would still be whatever the last render saw
    // rather than what this attempt actually produced.
    let signature: string | null = null;
    try {
      // 1. Server-side quote, before the wallet is asked for anything.
      const intent = await PointsRepository.createIntent(wallet.address, amount.trim());
      purchaseId = intent.purchaseId;

      // 2. The wallet signs and submits.
      setStep('paying');
      const hash = await wallet.payUsdc({
        tokenMint: intent.tokenMint,
        receiverAddress: intent.receiverAddress,
        amountRaw: intent.usdcAmountRaw,
        tokenDecimals: intent.tokenDecimals,
      });
      signature = hash;
      setTxSignature(hash);

      // 3. The backend verifies against the chain. A freshly-submitted payment
      //    usually needs a moment to be mined, so a pending answer is retried
      //    rather than surfaced as a failure.
      setStep('verifying');
      for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt += 1) {
        try {
          const result = await PointsRepository.confirm(purchaseId, hash);
          setCreditedPoints(result.points);
          setExplorerUrl(result.explorerUrl);
          setStep('done');
          void refreshBalance();
          void loadHistory();
          void wallet.refetchBalance();
          return;
        } catch (e) {
          const pending =
            isApiException(e) &&
            (e.data?.pending === true ||
              e.code === 'TX_PENDING' ||
              e.code === 'INSUFFICIENT_CONFIRMATIONS' ||
              e.code === 'RPC_ERROR');
          if (!pending) throw e;
          setNote('Transaction is still being confirmed…');
          await new Promise((r) => setTimeout(r, VERIFY_DELAY_MS));
        }
      }
      // Out of attempts: the payment is real and on-chain, so this is not a
      // failure the user should read as "money lost".
      setNote(null);
      setError(
        'Your payment is taking longer than usual to confirm. It will be credited automatically — check Purchase history in a few minutes.',
      );
      setStep('failed');
    } catch (e) {
      setNote(null);
      setError(isApiException(e) ? e.message : walletErrorMessage(e));
      setStep('failed');
      // A quote the user never paid should not linger as pending.
      if (purchaseId && !signature) {
        void PointsRepository.cancel(purchaseId).catch(() => {});
      }
    }
  }, [config, wallet, amount, refreshBalance, loadHistory]);

  const busy = step === 'paying' || step === 'verifying';

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} dismissible={!busy} labelledBy="buy-points-title">
      <DialogCard maxWidth={460}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <h2 id="buy-points-title" className="t-title-large" style={{ flex: 1, fontSize: 20 }}>
            {step === 'done' ? 'Payment successful' : 'Buy Points'}
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

        {/* ── Success ─────────────────────────────────────────────────── */}
        {step === 'done' ? (
          <div style={{ position: 'relative', paddingTop: 8 }}>
            <ConfettiBurst colors={CONFETTI_COLORS} />
            <div style={{ position: 'relative', textAlign: 'center', paddingTop: 8 }}>
              <span style={{ color: WebTokens.accent, display: 'inline-flex' }}>
                <CheckCircleRounded style={{ fontSize: 46 }} />
              </span>
              <p className="t-title-medium" style={{ marginTop: 12 }}>
                {creditedPoints.toLocaleString()} Points have been added to your account.
              </p>
              <p
                className="f-opensans"
                style={{ marginTop: 10, color: WebTokens.textSecondary, fontSize: 13 }}
              >
                New balance: {coins.toLocaleString()} points
              </p>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    marginTop: 14,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    color: WebTokens.accent,
                    fontSize: 12.5,
                  }}
                >
                  View transaction <OpenInNewRounded style={{ fontSize: 14 }} />
                </a>
              )}
              <div style={{ marginTop: 20 }}>
                <GlowButton label="Done" fullWidth height={46} onClick={onClose} />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ── Wallet state ──────────────────────────────────────── */}
            <WalletPanel wallet={wallet} />

            {/* ── Amount ────────────────────────────────────────────── */}
            <div style={{ marginTop: 16 }}>
              <label
                htmlFor="usdc-amount"
                style={{
                  display: 'block',
                  marginBottom: 6,
                  color: WebTokens.textSecondary,
                  fontSize: 12.5,
                }}
              >
                USDC amount
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="usdc-amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={busy}
                  inputMode="decimal"
                  placeholder="10.00"
                  className="f-opensans"
                  style={{
                    width: '100%',
                    padding: '14px 62px 14px 14px',
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
                <span
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: WebTokens.textMuted,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  USDC
                </span>
              </div>
              {validation.reason && (
                <p style={{ marginTop: 6, color: WebTokens.danger, fontSize: 12 }}>
                  {validation.reason}
                </p>
              )}
              {!validation.reason && (
                <p style={{ marginTop: 6, color: WebTokens.textMuted, fontSize: 12 }}>
                  {minUsdc}–{maxUsdc} USDC per purchase
                  {wallet.usdcBalance != null && ` · you hold ${wallet.usdcBalance} USDC`}
                </p>
              )}
            </div>

            {/* ── Live quote ────────────────────────────────────────── */}
            <div
              style={{
                marginTop: 14,
                padding: 14,
                background: withAlpha(WebTokens.accent, 0.07),
                border: `1px solid ${withAlpha(WebTokens.accent, 0.25)}`,
                borderRadius: WebTokens.radiusControl,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: WebTokens.textSecondary, fontSize: 12.5 }}>You will receive</span>
                <span
                  className="f-opensans"
                  style={{ color: WebTokens.accent, fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                >
                  {previewPoints.toLocaleString()} Points
                </span>
              </div>
              <div style={{ marginTop: 6, color: WebTokens.textMuted, fontSize: 11.5 }}>
                Rate: 1 USDC = {rate} points
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <MetaRow label="Network" value={config?.network.networkName ?? 'Solana Devnet'} />
              <MetaRow
                label="Pay to"
                value={shortenAddress(config?.network.receiverAddress) || '—'}
              />
            </div>

            {/* ── Progress / errors ─────────────────────────────────── */}
            {(note || error || busy) && (
              <div
                style={{
                  marginTop: 14,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 9,
                  padding: '11px 13px',
                  background: error
                    ? withAlpha(WebTokens.danger, 0.09)
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${
                    error ? withAlpha(WebTokens.danger, 0.3) : WebTokens.glassStroke
                  }`,
                  borderRadius: WebTokens.radiusControl,
                }}
              >
                <span
                  style={{
                    color: error ? WebTokens.danger : WebTokens.accent,
                    display: 'inline-flex',
                    flexShrink: 0,
                  }}
                >
                  {error ? (
                    <ErrorOutlineRounded style={{ fontSize: 17 }} />
                  ) : (
                    <HourglassTopRounded style={{ fontSize: 17 }} />
                  )}
                </span>
                <span
                  style={{
                    color: error ? WebTokens.danger : WebTokens.textSecondary,
                    fontSize: 12.5,
                    lineHeight: 1.5,
                  }}
                >
                  {error ??
                    note ??
                    (step === 'paying'
                      ? 'Confirm the payment in your wallet…'
                      : 'Verifying your payment on Solana Devnet…')}
                </span>
              </div>
            )}

            {txSignature && step !== 'form' && (
              <a
                href={explorerTxUrl(txSignature)}
                target="_blank"
                rel="noreferrer"
                style={{
                  marginTop: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: WebTokens.accent,
                  fontSize: 12,
                }}
              >
                View transaction <OpenInNewRounded style={{ fontSize: 13 }} />
              </a>
            )}

            {insufficientUsdc && !error && (
              <p style={{ marginTop: 12, color: WebTokens.danger, fontSize: 12.5 }}>
                Insufficient USDC balance.
              </p>
            )}

            {/* ── Actions ───────────────────────────────────────────── */}
            <div
              style={{
                marginTop: 18,
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
                step={step}
                busy={busy}
                canBuy={validation.ok && !insufficientUsdc && config?.enabled === true}
                onBuy={buy}
              />
            </div>
          </>
        )}
      </DialogCard>
    </Modal>
  );
}

/**
 * The primary button changes job with the wallet's state, so the user always has
 * exactly one obvious next action (§19, §27).
 */
function PrimaryAction({
  wallet,
  step,
  busy,
  canBuy,
  onBuy,
}: {
  wallet: ReturnType<typeof useSolanaWallet>;
  step: Step;
  busy: boolean;
  canBuy: boolean;
  onBuy: () => void;
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
        onClick={() => wallet.connect()}
      />
    );
  }
  return (
    <GlowButton
      label={step === 'failed' ? 'Try again' : 'Buy Points'}
      height={46}
      busy={busy}
      onClick={canBuy ? onBuy : null}
    />
  );
}

/** Connection status: address, network warning, disconnect. */
function WalletPanel({ wallet }: { wallet: ReturnType<typeof useSolanaWallet> }) {
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
        No Solana wallet was detected. Install Phantom or Solflare to buy points.
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
          Please connect your wallet to continue.
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 8,
            height: 8,
            flexShrink: 0,
            borderRadius: '50%',
            background: WebTokens.accent,
          }}
        />
        <span className="f-opensans" style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600 }}>
          {shortenAddress(wallet.address)}
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
          }}
        >
          Disconnect
        </button>
      </div>
      {/* The balance is the thing a user actually needs before paying, so it is
          shown as soon as the wallet connects rather than only after a purchase. */}
      <p style={{ marginTop: 8, color: WebTokens.textMuted, fontSize: 12 }}>
        {wallet.balanceError
          ? wallet.balanceError
          : wallet.loadingBalance && wallet.usdcBalance == null
            ? 'Reading your USDC balance…'
            : wallet.usdcBalance != null
              ? `${wallet.usdcBalance} USDC on ${wallet.networkName}`
              : wallet.networkName}
      </p>
      {wallet.hasTokenAccount === false && (
        <p style={{ marginTop: 6, color: WebTokens.gold, fontSize: 12 }}>
          This wallet holds no USDC on {wallet.networkName} yet.
        </p>
      )}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: WebTokens.textMuted, fontSize: 12 }}>{label}</span>
      <span className="f-opensans" style={{ color: WebTokens.textSecondary, fontSize: 12.5 }}>
        {value}
      </span>
    </div>
  );
}
