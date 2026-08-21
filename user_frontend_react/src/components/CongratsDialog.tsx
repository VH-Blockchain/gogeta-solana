import CloseIcon from '@mui/icons-material/Close';
import EmojiEventsRounded from '@mui/icons-material/EmojiEventsRounded';
import BoltRounded from '@mui/icons-material/BoltRounded';
import { useUserStore } from '@/store/userStore';
import { WebTokens, glow, panelFill, withAlpha } from '@/theme/webTokens';
import { ConfettiBurst } from './Confetti';
import { GlowButton } from './GlowButton';
import { Modal } from './Modal';
import { StatusChip } from './Primitives';
import { WebCard } from './WebCard';

export interface CongratsPayload {
  count: number;
  totalFee: number;
  totalReward: number;
}

const CONFETTI_COLORS = [WebTokens.accent, WebTokens.gold, WebTokens.violet];

/**
 * Post-submit celebration — the web equivalent of the app's pushed
 * ResultScreen (confetti, badge, "Congratulations!", score chips), shown as a
 * modal since the portal's submit flow is already dialog-based. Celebrates
 * picks being locked in (not an outcome reveal — the same "picks submitted"
 * framing the app's screen uses). Port of `WebCongratsDialog`.
 */
export function CongratsDialog({
  payload,
  onClose,
}: {
  payload: CongratsPayload | null;
  onClose: () => void;
}) {
  const user = useUserStore((s) => s.user);

  return (
    <Modal open={payload != null} onClose={onClose}>
      {payload && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 460,
            maxHeight: 'calc(100vh - 48px)',
            overflow: 'hidden',
            borderRadius: WebTokens.radiusCard,
            border: `1px solid ${WebTokens.glassStroke}`,
            background: panelFill,
          }}
        >
          <ConfettiBurst colors={CONFETTI_COLORS} />

          <div
            style={{
              position: 'relative',
              padding: '20px 24px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              maxHeight: 'calc(100vh - 48px)',
              overflowY: 'auto',
            }}
          >
            <div style={{ alignSelf: 'flex-end' }}>
              <button
                type="button"
                title="Close"
                aria-label="Close"
                onClick={onClose}
                style={{ color: WebTokens.textMuted, padding: 8, display: 'inline-flex' }}
              >
                <CloseIcon />
              </button>
            </div>

            <div
              style={{
                width: 108,
                height: 108,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${WebTokens.accent}, ${WebTokens.accentDeep})`,
                border: `2px solid ${withAlpha('#FFFFFF', 0.25)}`,
                boxShadow: glow(WebTokens.accent, 0.5),
                color: WebTokens.onAccent,
              }}
            >
              <EmojiEventsRounded sx={{ fontSize: 52 }} />
            </div>

            <h2
              className="f-poppins"
              style={{
                marginTop: 20,
                textAlign: 'center',
                fontSize: 24,
                fontWeight: 700,
                color: WebTokens.textPrimary,
              }}
            >
              Congratulations!
            </h2>

            <p
              className="f-inter"
              style={{
                marginTop: 8,
                textAlign: 'center',
                color: WebTokens.textSecondary,
                fontSize: 13.5,
                lineHeight: 1.4,
              }}
            >
              {payload.count === 1
                ? "Your pick is locked in. The crowd blinked — you didn't."
                : `${payload.count} picks locked in. The crowd blinked — you didn't.`}
            </p>

            <div style={{ marginTop: 20, width: '100%' }}>
              <WebCard glow={WebTokens.gold}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <StatusChip label="Awaiting result" color={WebTokens.gold} />
                  <StatusChip label={`Rank #${user.globalRank}`} color={WebTokens.blue} />
                  <StatusChip label={`Streak ${user.currentStreak}`} color={WebTokens.coral} />
                </div>
              </WebCard>
            </div>

            <div style={{ marginTop: 20, width: '100%' }}>
              <GlowButton
                label="Keep predicting"
                icon={<BoltRounded />}
                fullWidth
                onClick={onClose}
              />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
