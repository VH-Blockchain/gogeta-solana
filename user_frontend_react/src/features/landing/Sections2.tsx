import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import SentimentDissatisfiedOutlined from '@mui/icons-material/SentimentDissatisfiedOutlined';
import VerifiedOutlined from '@mui/icons-material/VerifiedOutlined';
import CasinoOutlined from '@mui/icons-material/CasinoOutlined';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import DashboardCustomizeOutlined from '@mui/icons-material/DashboardCustomizeOutlined';
import PieChartOutline from '@mui/icons-material/PieChartOutline';
import WorkspacePremiumOutlined from '@mui/icons-material/WorkspacePremiumOutlined';
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined';
import ArrowForward from '@mui/icons-material/ArrowForward';
import StarRounded from '@mui/icons-material/StarRounded';
import AddIcon from '@mui/icons-material/Add';
import { Routes } from '@/router/routes';
import { WebTokens, cardShadow, glow, withAlpha } from '@/theme/webTokens';
import { GlowButton } from '@/components/GlowButton';
import { Reveal } from '@/components/Reveal';
import { WebAvatar } from '@/components/Primitives';
import { WebCard } from '@/components/WebCard';
import { columnWidth, useElementWidth } from '@/hooks/useElementWidth';
import { Section } from './Section';
import mockupPredictions from '@/assets/web/mockup_predictions.png';

// ---------------------------------------------------------------------------
// Problem & Solution — zigzag storytelling
// ---------------------------------------------------------------------------

const ROWS: [solution: boolean, icon: ReactNode, title: string, body: string][] = [
  [
    false,
    <SentimentDissatisfiedOutlined sx={{ fontSize: 20 }} />,
    'Being right goes unnoticed',
    'Your best predictions disappear into chats.\nNo proof. No recognition. No reward.',
  ],
  [
    true,
    <VerifiedOutlined sx={{ fontSize: 20 }} />,
    'Every call is on the record',
    "GOGETA locks your prediction, settles it against the real outcome and earns you points when you're right. Your accuracy becomes your reputation.",
  ],
  [
    false,
    <CasinoOutlined sx={{ fontSize: 20 }} />,
    'Real-money apps feel risky',
    'Betting apps put your wallet on the line and turn fun into stress.',
  ],
  [
    true,
    <FavoriteBorder sx={{ fontSize: 20 }} />,
    '100% points, 100% free',
    'GOGETA runs on points only — nothing to deposit, nothing to lose. All of the thrill, none of the risk.',
  ],
];

export function ProblemSolution() {
  const [ref, width] = useElementWidth();
  const wide = width >= 860;

  return (
    <Section eyebrow="WHY GOGETA" title={'The fun of being right,\nwithout the downside'}>
      <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {ROWS.map(([solution, icon, title, body], i) => (
          <div
            key={title}
            style={{
              display: 'flex',
              justifyContent: !wide ? 'center' : i % 2 === 0 ? 'flex-start' : 'flex-end',
            }}
          >
            <Reveal
              delay={120 * i}
              duration={320}
              y={0}
              x={!wide ? 0 : i % 2 === 0 ? -0.06 : 0.06}
              style={{ width: '100%', maxWidth: wide ? width * 0.62 : 640 }}
            >
              <ZigzagCard solution={solution} icon={icon} title={title} body={body} />
            </Reveal>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ZigzagCard({
  solution,
  icon,
  title,
  body,
}: {
  solution: boolean;
  icon: ReactNode;
  title: string;
  body: string;
}) {
  const tint = solution ? WebTokens.accent : WebTokens.danger;
  return (
    <WebCard
      accentBorder={withAlpha(tint, 0.35)}
      glow={solution ? WebTokens.accent : undefined}
      padding={24}
    >
      <span
        style={{
          display: 'inline-flex',
          padding: '6px 12px',
          background: withAlpha(tint, 0.12),
          borderRadius: 999,
          border: `1px solid ${withAlpha(tint, 0.4)}`,
          color: tint,
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: 1.5,
        }}
      >
        {solution ? 'THE GOGETA WAY' : 'THE PROBLEM'}
      </span>

      <div style={{ marginTop: 16, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <span
          style={{
            padding: 10,
            flexShrink: 0,
            display: 'inline-flex',
            background: `linear-gradient(135deg, ${withAlpha(tint, 0.22)}, ${withAlpha(tint, 0.06)})`,
            borderRadius: 12,
            border: `1px solid ${withAlpha(tint, 0.3)}`,
            color: tint,
          }}
        >
          {icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="t-title-large">{title}</h3>
          <p
            className="f-inter"
            style={{
              marginTop: 6,
              color: WebTokens.textSecondary,
              fontSize: 14,
              lineHeight: 1.55,
              whiteSpace: 'pre-line',
            }}
          >
            {body}
          </p>
        </div>
      </div>
    </WebCard>
  );
}

// ---------------------------------------------------------------------------
// Inside the app — phone mockup + value props
// ---------------------------------------------------------------------------

const POINTS: [icon: ReactNode, title: string, body: string][] = [
  [
    <DashboardCustomizeOutlined sx={{ fontSize: 18 }} />,
    'A live board of daily questions',
    'Sports, crypto, entertainment, weather — refreshed every day by our editors.',
  ],
  [
    <PieChartOutline sx={{ fontSize: 18 }} />,
    'See what the crowd thinks',
    'Every option shows live pick percentages, so every call is a read on the crowd.',
  ],
  [
    <WorkspacePremiumOutlined sx={{ fontSize: 18 }} />,
    'Progress you can show off',
    'Points, badges, levels and a global rank that updates with every result.',
  ],
  [
    <NotificationsActiveOutlined sx={{ fontSize: 18 }} />,
    'Never miss a result',
    'Results, lucky-draw wins and rank changes land straight in your notifications.',
  ],
];

export function InsideTheApp() {
  const navigate = useNavigate();
  const [ref, width] = useElementWidth();
  const wide = width >= 860;

  const bullets = (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {POINTS.map(([icon, title, body], i) => (
        <div key={title} style={{ marginBottom: i === POINTS.length - 1 ? 0 : 22 }}>
          <Reveal delay={110 * i} duration={320} y={0} x={0.05}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <span
                style={{
                  padding: 9,
                  flexShrink: 0,
                  display: 'inline-flex',
                  background: `linear-gradient(135deg, ${withAlpha(WebTokens.accent, 0.2)}, ${withAlpha(WebTokens.accent, 0.06)})`,
                  borderRadius: 11,
                  border: `1px solid ${withAlpha(WebTokens.accent, 0.3)}`,
                  color: WebTokens.accent,
                }}
              >
                {icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>{title}</div>
                <p
                  className="f-inter"
                  style={{
                    marginTop: 4,
                    color: WebTokens.textSecondary,
                    fontSize: 13.5,
                    lineHeight: 1.5,
                  }}
                >
                  {body}
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      ))}

      <div style={{ height: 30 }} />

      <div style={{ display: 'flex' }}>
        <GlowButton
          label="Start predicting free"
          icon={<ArrowForward />}
          onClick={() => navigate(Routes.register)}
        />
      </div>
    </div>
  );

  return (
    <Section eyebrow="INSIDE THE APP" title={'Designed like a Game.\nScored like a Sport.'}>
      <div
        ref={ref}
        style={{
          display: 'flex',
          flexDirection: wide ? 'row' : 'column',
          alignItems: 'center',
          gap: wide ? 56 : 44,
        }}
      >
        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>{wide ? bullets : <PhoneMockup />}</div>
        {wide ? <PhoneMockup /> : <div style={{ width: '100%' }}>{bullets}</div>}
      </div>
    </Section>
  );
}

/**
 * A real device-style bezel (aluminium-edge frame, side buttons, camera cutout)
 * wrapped around the actual, full, uncropped app screenshot — the height is
 * fixed so this never grows taller than its slot next to the bullet list; the
 * width follows the screenshot's real device aspect ratio.
 * Port of `_PhoneMockup`.
 */
function PhoneMockup() {
  const HEIGHT = 460;
  const BEZEL = 14;
  const RADIUS = 46;
  const SCREENSHOT_ASPECT = 1080 / 2340; // width / height

  const innerHeight = HEIGHT - BEZEL * 2;
  const innerWidth = innerHeight * SCREENSHOT_ASPECT;
  const width = innerWidth + BEZEL * 2;

  return (
    <div
      style={{
        position: 'relative',
        // Room for the side buttons to sit outside the bezel.
        width: width + 6,
        height: HEIGHT,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 3,
          top: 0,
          width,
          height: HEIGHT,
          padding: BEZEL,
          background: 'linear-gradient(135deg, #2A2A38, #121218)',
          borderRadius: RADIUS,
          border: '1px solid #3C3C4A',
          boxShadow: `${cardShadow}, ${glow(WebTokens.violet, 0.22)}`,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: innerWidth,
            height: innerHeight,
            borderRadius: RADIUS - BEZEL,
            overflow: 'hidden',
          }}
        >
          <img
            src={mockupPredictions}
            alt="The GOGETA app's predictions screen"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          {/* Camera cutout */}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 7,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#0A0A0E',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          />
        </div>
      </div>

      {/* Side buttons — reads as a real device, not a screenshot in a box. */}
      <SideButton height={34} style={{ left: 0, top: HEIGHT * 0.22 }} />
      <SideButton height={22} style={{ right: 0, top: HEIGHT * 0.16 }} />
      <SideButton height={34} style={{ right: 0, top: HEIGHT * 0.24 }} />
    </div>
  );
}

function SideButton({ height, style }: { height: number; style: React.CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        width: 3,
        height,
        background: '#232330',
        borderRadius: 2,
        border: '0.6px solid #3C3C4A',
        ...style,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Feature bento
// ---------------------------------------------------------------------------

interface FeatureSpec {
  icon: ReactNode;
  accent: string;
  title: string;
  body: string;
  highlight?: boolean;
}

export function FeatureBento() {
  const [ref, width] = useElementWidth();
  const wide = width >= 900;
  const third = (width - 40) / 3;
  const half = (width - 20) / 2;

  const luckyDraw: FeatureSpec = {
    icon: <StarRounded sx={{ fontSize: 22 }} />,
    accent: WebTokens.gold,
    title: 'Lucky Draw',
    body: 'See who tops the board each day from all correct predictors — transparent and auditable.',
    highlight: true,
  };

  const cards: FeatureSpec[] = [
    {
      icon: <DashboardCustomizeOutlined sx={{ fontSize: 22 }} />,
      accent: WebTokens.accent,
      title: 'Daily predictions',
      body: 'Fresh questions across sports, crypto, entertainment and more — with live crowd percentages.',
    },
    {
      icon: <WorkspacePremiumOutlined sx={{ fontSize: 22 }} />,
      accent: WebTokens.violet,
      title: 'Leaderboards',
      body: 'Daily, weekly and monthly rankings with accuracy and score — climb them all.',
    },
    {
      icon: <VerifiedOutlined sx={{ fontSize: 22 }} />,
      accent: WebTokens.coral,
      title: 'Badges & levels',
      body: 'From Beginner to Legend — earn achievement badges and level up your predictor rank.',
    },
    {
      icon: <PieChartOutline sx={{ fontSize: 22 }} />,
      accent: WebTokens.blue,
      title: 'Points economy',
      body: 'A transparent ledger of every point — entries, wins, bonuses. Always know where you stand.',
    },
  ];

  return (
    <Section eyebrow="EVERYTHING IN THE GAME" title={'Built to keep every day\nworth predicting'}>
      <div ref={ref}>
        {!wide ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[luckyDraw, ...cards].map((c) => (
              <FeatureCard key={c.title} {...c} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 20 }}>
              <div style={{ width: half, display: 'flex' }}>
                <FeatureCard {...luckyDraw} />
              </div>
              <div style={{ width: half - 20, display: 'flex' }}>
                <FeatureCard {...cards[0]} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 20 }}>
              {cards.slice(1).map((c) => (
                <div key={c.title} style={{ width: third, display: 'flex' }}>
                  <FeatureCard {...c} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

function FeatureCard({ icon, accent, title, body, highlight = false }: FeatureSpec) {
  return (
    <WebCard
      hoverLift
      glow={highlight ? accent : undefined}
      accentBorder={highlight ? withAlpha(accent, 0.4) : undefined}
      padding={26}
      style={{ display: 'flex', height: '100%' }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: '100%',
          width: '100%',
        }}
      >
        <span
          style={{
            padding: 11,
            alignSelf: 'flex-start',
            display: 'inline-flex',
            background: `linear-gradient(135deg, ${withAlpha(accent, 0.25)}, ${withAlpha(accent, 0.08)})`,
            borderRadius: 13,
            border: `1px solid ${withAlpha(accent, 0.3)}`,
            boxShadow: highlight ? glow(accent, 0.3) : 'none',
            color: accent,
          }}
        >
          {icon}
        </span>

        <h3 className="t-title-large" style={{ marginTop: 18 }}>
          {title}
        </h3>
        <p
          className="f-inter"
          style={{
            marginTop: 8,
            color: WebTokens.textSecondary,
            fontSize: 14,
            lineHeight: 1.55,
          }}
        >
          {body}
        </p>
      </div>
    </WebCard>
  );
}

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------

const QUOTES: [initials: string, name: string, role: string, quote: string, seed: number][] = [
  [
    'RS',
    'Rohan S.',
    'Prediction enthusiast',
    'Making a prediction takes ten seconds, but chasing the top spot on the leaderboard keeps me coming back every single day.',
    0,
  ],
  [
    'PK',
    'Priya K.',
    'Weekend predictor',
    'I love that every correct prediction bumps my rank. Comparing leaderboard spots with friends has become our favorite ritual.',
    1,
  ],
  [
    'AD',
    'Arjun D.',
    'Daily player',
    'Climbed into the top ranks last week and unlocked a badge for it. Seeing my name near the top of the leaderboard felt amazing.',
    2,
  ],
];

export function Testimonials() {
  const [ref, width] = useElementWidth();
  const cols = width >= 900 ? 3 : 1;
  const w = columnWidth(width, cols, 20);

  return (
    <Section
      eyebrow="WHAT PLAYERS SAY"
      title={'Bragging rights, earned.\nSimple. Powerful. Premium.'}
    >
      <div ref={ref} style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        {QUOTES.map(([initials, name, role, quote, seed], i) => (
          <div key={name} style={{ width: w > 0 ? w : '100%' }}>
            <Reveal delay={130 * i} duration={320} y={0.12}>
              <WebCard hoverLift padding={24}>
                <div style={{ display: 'flex', gap: 0 }}>
                  {Array.from({ length: 5 }, (_, s) => (
                    <StarRounded key={s} sx={{ fontSize: 16 }} style={{ color: WebTokens.gold }} />
                  ))}
                </div>

                <p
                  className="f-inter"
                  style={{
                    marginTop: 14,
                    color: WebTokens.textSecondary,
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  &ldquo;{quote}&rdquo;
                </p>

                <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <WebAvatar initials={initials} seed={seed} radius={17} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{name}</div>
                    <div style={{ color: WebTokens.textMuted, fontSize: 11.5 }}>{role}</div>
                  </div>
                </div>
              </WebCard>
            </Reveal>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

const FAQ_ITEMS: [question: string, answer: string][] = [
  [
    'Is GOGETA real-money gambling?',
    "No. GOGETA runs entirely on points — you can't deposit, buy or withdraw money. It's a free prediction game about being right, not about betting.",
  ],
  [
    'How do I earn points?',
    'Every correct prediction earns you points, and the top daily predictors pick up a bonus. Your accuracy is what climbs the leaderboard.',
  ],
  [
    'What does a prediction cost?',
    'Predictions are free to play. Some may use points to enter — always shown before you confirm — and are final once submitted, exactly like calling it in real life.',
  ],
  [
    'How do leaderboards work?',
    'Daily, weekly and monthly boards rank players by points earned and accuracy. Top finishes earn exclusive badges like Daily Hero and Monthly Champion.',
  ],
  [
    'Is there a mobile app?',
    'Yes — GOGETA is also a native Android and iOS app, launching on Google Play and the App Store. The web and mobile apps share one account.',
  ],
];

export function Faq() {
  return (
    <Section eyebrow="GOOD TO KNOW" title="Questions, answered">
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            width: '100%',
            maxWidth: 760,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {FAQ_ITEMS.map(([question, answer], i) => (
            <Reveal key={question} delay={90 * i} duration={320} y={0}>
              <FaqTile question={question} answer={answer} />
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}

function FaqTile({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <WebCard padding={0} accentBorder={open ? withAlpha(WebTokens.accent, 0.35) : undefined}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'block',
          width: '100%',
          padding: '18px 22px',
          textAlign: 'left',
          borderRadius: WebTokens.radiusCard,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 15 }}>{question}</span>
          <AddIcon
            sx={{ fontSize: 20 }}
            style={{
              color: open ? WebTokens.accent : WebTokens.textMuted,
              transform: open ? 'rotate(45deg)' : 'none',
              transition: 'transform 180ms ease, color 180ms ease',
            }}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateRows: open ? '1fr' : '0fr',
            transition: 'grid-template-rows 200ms cubic-bezier(0.33,1,0.68,1)',
          }}
        >
          <div style={{ overflow: 'hidden' }}>
            <p
              className="f-inter"
              style={{
                paddingTop: 12,
                paddingRight: 26,
                color: WebTokens.textSecondary,
                fontSize: 13.5,
                lineHeight: 1.6,
              }}
            >
              {answer}
            </p>
          </div>
        </div>
      </button>
    </WebCard>
  );
}
