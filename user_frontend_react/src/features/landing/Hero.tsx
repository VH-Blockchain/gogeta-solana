import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Bolt from '@mui/icons-material/Bolt';
import SportsSoccer from '@mui/icons-material/SportsSoccer';
import BoltRounded from '@mui/icons-material/BoltRounded';
import PeopleOutline from '@mui/icons-material/PeopleOutline';
import LocalFireDepartment from '@mui/icons-material/LocalFireDepartment';
import ArrowForward from '@mui/icons-material/ArrowForward';
import { Routes } from '@/router/routes';
import { WebTokens, cardShadow, glassGradient, glow, withAlpha } from '@/theme/webTokens';
import { GlowButton } from '@/components/GlowButton';
import { Reveal } from '@/components/Reveal';
import { StatusChip } from '@/components/Primitives';
import { WebCard } from '@/components/WebCard';
import { useWindowWidth } from '@/hooks/useWindowWidth';
import { PreviewOption } from './PreviewOption';
import './Hero.css';

/** Typography-first hero with a kinetic accent line over the aurora backdrop. */
export function Hero() {
  const width = useWindowWidth();
  const navigate = useNavigate();
  const split = width >= WebTokens.bpDesktop;
  const headlineSize = split ? 62 : width >= WebTokens.bpTablet ? 50 : 38;

  const copy = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: split ? 'flex-start' : 'center',
      }}
    >
      {/* Announcement pill */}
      <Reveal duration={500} y={0.4}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: glassGradient,
            borderRadius: 999,
            border: `1px solid ${withAlpha(WebTokens.accent, 0.35)}`,
          }}
        >
          <span style={{ fontSize: 13 }}>✨</span>
          <span
            style={{
              color: withAlpha(WebTokens.accent, 0.95),
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Daily prediction challenges are live
          </span>
          <ArrowForward sx={{ fontSize: 13 }} style={{ color: WebTokens.accent }} />
        </span>
      </Reveal>

      <div style={{ height: 30 }} />

      {/* Headline with kinetic accent line */}
      <Reveal delay={120} duration={500} y={0.25}>
        <h1
          className="t-display-large"
          style={{
            fontSize: headlineSize,
            lineHeight: 1.02,
            textAlign: split ? 'left' : 'center',
          }}
        >
          Predict the future.
        </h1>
      </Reveal>

      <Reveal delay={260} duration={500} y={0.25} style={{ width: split ? '100%' : undefined }}>
        <KineticWord fontSize={headlineSize} alignLeft={split} />
      </Reveal>

      <div style={{ height: 24 }} />

      <Reveal delay={400} duration={500} y={0}>
        <p
          className="t-title-medium f-inter"
          style={{
            maxWidth: 540,
            color: WebTokens.textSecondary,
            lineHeight: 1.55,
            textAlign: split ? 'left' : 'center',
          }}
        >
          Make your calls on daily prediction challenges — sports, crypto, entertainment and more.
          Correct calls earn points, badges and a place on the leaderboard.
        </p>
      </Reveal>

      <div style={{ height: 36 }} />

      <Reveal delay={550} duration={500} y={0.3}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            justifyContent: split ? 'flex-start' : 'center',
          }}
        >
          <GlowButton
            label="Get started — free"
            icon={<Bolt />}
            large
            onClick={() => navigate(Routes.register)}
          />
          <Link to={Routes.login} className="btn-outlined" style={{ minHeight: 58 }}>
            Sign in
          </Link>
        </div>
      </Reveal>

      <div style={{ height: 24 }} />

      <Reveal delay={700} duration={500} y={0}>
        <span style={{ color: WebTokens.textMuted, fontSize: 13 }}>
          Free to play Game · New Challenges Daily · Maintain Streak
        </span>
      </Reveal>
    </div>
  );

  const preview = (
    <Reveal delay={350} duration={600} y={0} x={0.15}>
      <HeroPreviewCard />
    </Reveal>
  );

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          width: '100%',
          maxWidth: 1180,
          padding: `${split ? 90 : 64}px 24px 70px`,
        }}
      >
        {split ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
            <div style={{ flex: 11, minWidth: 0 }}>{copy}</div>
            <div style={{ flex: 9, minWidth: 0 }}>{preview}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {copy}
            <div style={{ height: 56 }} />
            <div style={{ width: '100%', maxWidth: 460 }}>{preview}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * "Product perspective" hero visual — a floating live-style prediction card
 * with a coin-reward chip, gently bobbing. Port of `_HeroPreviewCard`.
 */
function HeroPreviewCard() {
  const navigate = useNavigate();

  return (
    <div className="hero-preview">
      <div style={{ position: 'relative' }}>
        <WebCard glow={WebTokens.violet} padding={24}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <SportsSoccer sx={{ fontSize: 16 }} style={{ color: WebTokens.accent }} />
            <span
              style={{ color: WebTokens.textSecondary, fontSize: 12.5, fontWeight: 600 }}
            >
              Sports
            </span>
            <span style={{ flex: 1 }} />
            <StatusChip label="Closes in 3h" color={WebTokens.gold} />
          </div>

          <h3 className="t-title-large" style={{ marginTop: 16, fontSize: 20 }}>
            Who takes tonight&apos;s derby?
          </h3>

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <PreviewOption label="Home win" percent={58} hot />
            <PreviewOption label="Draw" percent={17} />
            <PreviewOption label="Away win" percent={25} />
          </div>

          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 4 }}>
            <PeopleOutline sx={{ fontSize: 14 }} style={{ color: WebTokens.textMuted }} />
            <span style={{ color: WebTokens.textMuted, fontSize: 12 }}>12.4k predicting</span>
            <span style={{ flex: 1 }} />
            <GlowButton label="Lock in (−50)" onClick={() => navigate(Routes.register)} />
          </div>
        </WebCard>

        {/* Floating reward chip */}
        <span
          style={{
            position: 'absolute',
            top: -18,
            right: -12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 14px',
            background: `linear-gradient(135deg, ${WebTokens.gold}, ${WebTokens.goldDeep})`,
            borderRadius: 999,
            boxShadow: glow(WebTokens.gold, 0.5),
            color: WebTokens.onAccent,
            fontWeight: 700,
            fontSize: 13,
            whiteSpace: 'nowrap',
          }}
        >
          <BoltRounded sx={{ fontSize: 16 }} />
          +100 if correct
        </span>

        {/* Floating rank chip */}
        <span
          style={{
            position: 'absolute',
            bottom: -14,
            left: -10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '8px 12px',
            background: WebTokens.surfaceAlt,
            borderRadius: 999,
            border: `1px solid ${withAlpha(WebTokens.coral, 0.5)}`,
            boxShadow: cardShadow,
            color: WebTokens.textPrimary,
            fontWeight: 700,
            fontSize: 12.5,
            whiteSpace: 'nowrap',
          }}
        >
          <LocalFireDepartment sx={{ fontSize: 15 }} style={{ color: WebTokens.coral }} />
          Rank #7 this week
        </span>
      </div>
    </div>
  );
}

const WORDS = ['Earn rewards.', 'Climb the ranks.', 'Collect badges.', 'Beat the crowd.'];
const WORD_COLORS = [WebTokens.accent, WebTokens.violet, WebTokens.gold, WebTokens.blue];

/** The rotating gradient headline line. Port of `_KineticWord`. */
function KineticWord({ fontSize, alignLeft }: { fontSize: number; alignLeft: boolean }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setI((v) => (v + 1) % WORDS.length), 2400);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        height: fontSize * 1.15,
        width: alignLeft ? '100%' : undefined,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <h2
        key={i}
        className="t-display-large kinetic-word"
        style={{
          fontSize,
          lineHeight: 1.02,
          textAlign: alignLeft ? 'left' : 'center',
          backgroundImage: `linear-gradient(to right, ${WORD_COLORS[i]}, ${WORD_COLORS[(i + 1) % WORD_COLORS.length]})`,
        }}
      >
        {WORDS[i]}
      </h2>
    </div>
  );
}
