import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import PersonAddAlt1Outlined from '@mui/icons-material/PersonAddAlt1Outlined';
import BoltOutlined from '@mui/icons-material/BoltOutlined';
import EmojiEventsOutlined from '@mui/icons-material/EmojiEventsOutlined';
import GridViewRounded from '@mui/icons-material/GridViewRounded';
import SportsBasketball from '@mui/icons-material/SportsBasketball';
import CurrencyBitcoin from '@mui/icons-material/CurrencyBitcoin';
import MovieOutlined from '@mui/icons-material/MovieOutlined';
import SportsEsports from '@mui/icons-material/SportsEsports';
import CloudOutlined from '@mui/icons-material/CloudOutlined';
import SportsCricket from '@mui/icons-material/SportsCricket';
import PeopleOutline from '@mui/icons-material/PeopleOutline';
import { Routes } from '@/router/routes';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import { Reveal } from '@/components/Reveal';
import { StatusChip } from '@/components/Primitives';
import { WebCard } from '@/components/WebCard';
import { useCountUp } from '@/hooks/useCountUp';
import { columnWidth, useElementWidth } from '@/hooks/useElementWidth';
import { PreviewOption } from './PreviewOption';
import { CenteredBlock, Section } from './Section';

// ---------------------------------------------------------------------------
// Stats strip — count-up numbers
// ---------------------------------------------------------------------------

const STATS: [value: number, suffix: string, label: string, color: string][] = [
  [1000, '+', 'Welcome points on signup', WebTokens.gold],
  [100, '+', 'Points per correct call', WebTokens.accent],
  [10, '', 'Top predictors every day', WebTokens.violet],
  [500, '+', 'Bonus points per daily win', WebTokens.blue],
];

export function StatsStrip() {
  const [ref, width] = useElementWidth();
  const cols = width >= 860 ? 4 : 2;
  const w = columnWidth(width, cols);

  return (
    <CenteredBlock>
      <div ref={ref} style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {STATS.map(([value, suffix, label, color], i) => (
          <div key={label} style={{ width: w > 0 ? w : '100%' }}>
            <Reveal delay={150 * i} duration={320} y={0.2}>
              <WebCard padding="26px 18px">
                <div
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <CountUpNumber
                    value={value}
                    suffix={suffix}
                    color={color}
                    durationMs={1100 + i * 150}
                  />
                  <span
                    style={{
                      marginTop: 6,
                      textAlign: 'center',
                      color: WebTokens.textSecondary,
                      fontSize: 13,
                    }}
                  >
                    {label}
                  </span>
                </div>
              </WebCard>
            </Reveal>
          </div>
        ))}
      </div>
    </CenteredBlock>
  );
}

function CountUpNumber({
  value,
  suffix,
  color,
  durationMs,
}: {
  value: number;
  suffix: string;
  color: string;
  durationMs: number;
}) {
  const v = useCountUp(value, durationMs);
  return (
    <span className="t-display-small" style={{ color, fontWeight: 800 }}>
      {Math.round(v)}
      {suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// How it works
// ---------------------------------------------------------------------------

const STEPS: [
  number: string,
  icon: ReactNode,
  title: string,
  body: string,
  color: string,
][] = [
  [
    '01',
    <PersonAddAlt1Outlined sx={{ fontSize: 22 }} />,
    'Create your account',
    'Sign up in seconds and start with your Welcome badge.',
    WebTokens.accent,
  ],
  [
    '02',
    <BoltOutlined sx={{ fontSize: 22 }} />,
    'Back your predictions',
    'Browse daily questions, read the crowd percentages and lock in your call.',
    WebTokens.violet,
  ],
  [
    '03',
    <EmojiEventsOutlined sx={{ fontSize: 22 }} />,
    'Earn, rank & collect',
    'Correct calls earn you points, push you up the daily / weekly / monthly ranks and unlock badges.',
    WebTokens.gold,
  ],
];

export function HowItWorks() {
  const [ref, width] = useElementWidth();
  const wide = width >= 900;
  const w = wide ? (width - 2 * 20) / 3 : width;

  return (
    <Section eyebrow="HOW IT WORKS" title={'From signup to the podium\nin three steps'}>
      <div
        ref={ref}
        style={{
          display: 'flex',
          flexDirection: wide ? 'row' : 'column',
          alignItems: 'stretch',
          gap: 20,
        }}
      >
        {STEPS.map(([number, icon, title, body, color], i) => (
          <div key={number} style={{ width: w > 0 ? w : '100%', display: 'flex' }}>
            <Reveal delay={140 * i} duration={320} y={0.15} style={{ width: '100%', display: 'flex' }}>
              <WebCard hoverLift padding={26} style={{ display: 'flex', height: '100%' }}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    width: '100%',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span
                      style={{
                        padding: 11,
                        display: 'inline-flex',
                        background: `linear-gradient(135deg, ${withAlpha(color, 0.25)}, ${withAlpha(color, 0.08)})`,
                        borderRadius: 13,
                        border: `1px solid ${withAlpha(color, 0.3)}`,
                        color,
                      }}
                    >
                      {icon}
                    </span>
                    <span style={{ flex: 1 }} />
                    <span
                      className="t-headline-medium"
                      style={{ color: 'rgba(255,255,255,0.08)', fontWeight: 800 }}
                    >
                      {number}
                    </span>
                  </div>

                  <h3 className="t-title-large" style={{ marginTop: 20 }}>
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
            </Reveal>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Showcase — "today's arena" sample prediction cards (product perspective)
// ---------------------------------------------------------------------------

const CATS: [icon: ReactNode, label: string][] = [
  [<GridViewRounded sx={{ fontSize: 14 }} />, 'All'],
  [<SportsBasketball sx={{ fontSize: 14 }} />, 'Sports'],
  [<CurrencyBitcoin sx={{ fontSize: 14 }} />, 'Crypto'],
  [<MovieOutlined sx={{ fontSize: 14 }} />, 'Entertainment'],
  [<SportsEsports sx={{ fontSize: 14 }} />, 'Esports'],
  [<CloudOutlined sx={{ fontSize: 14 }} />, 'Weather'],
];

const SAMPLES: {
  icon: ReactNode;
  category: string;
  title: string;
  options: [label: string, percent: number][];
  players: string;
  tint: string;
}[] = [
  {
    icon: <SportsCricket sx={{ fontSize: 15 }} />,
    category: 'Sports',
    title: 'Will India lift the series decider?',
    options: [
      ['Yes', 64],
      ['No', 36],
    ],
    players: '8.1k predicting',
    tint: WebTokens.accent,
  },
  {
    icon: <CurrencyBitcoin sx={{ fontSize: 15 }} />,
    category: 'Crypto',
    title: 'BTC above $120k by Friday close?',
    options: [
      ['Above', 41],
      ['Below', 59],
    ],
    players: '5.6k predicting',
    tint: WebTokens.gold,
  },
  {
    icon: <MovieOutlined sx={{ fontSize: 15 }} />,
    category: 'Entertainment',
    title: 'Does the new release cross ₹100Cr weekend?',
    options: [
      ['Crosses', 72],
      ['Falls short', 28],
    ],
    players: '3.2k predicting',
    tint: WebTokens.violet,
  },
];

export function Showcase() {
  const navigate = useNavigate();
  const [ref, width] = useElementWidth();
  const cols = width >= 900 ? 3 : 1;
  const w = columnWidth(width, cols, 20);

  return (
    <Section eyebrow="TODAY'S ARENA" title={'Real questions.\nReal bragging rights.'}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Category pills */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {CATS.map(([icon, label], i) => (
            <span
              key={label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 14px',
                background: i === 0 ? withAlpha(WebTokens.accent, 0.14) : 'rgba(255,255,255,0.04)',
                borderRadius: 999,
                border: `1px solid ${i === 0 ? withAlpha(WebTokens.accent, 0.45) : WebTokens.glassStroke}`,
                color: i === 0 ? WebTokens.accent : WebTokens.textSecondary,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  color: i === 0 ? WebTokens.accent : WebTokens.textSecondary,
                }}
              >
                {icon}
              </span>
              {label}
            </span>
          ))}
        </div>

        <div style={{ height: 34 }} />

        <div ref={ref} style={{ display: 'flex', flexWrap: 'wrap', gap: 20, width: '100%' }}>
          {SAMPLES.map((s, i) => (
            <div key={s.title} style={{ width: w > 0 ? w : '100%' }}>
              <Reveal delay={130 * i} duration={320} y={0.15}>
                <WebCard hoverLift padding={22} onClick={() => navigate(Routes.register)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-flex', color: s.tint }}>{s.icon}</span>
                    <span
                      style={{
                        color: WebTokens.textSecondary,
                        fontSize: 12.5,
                        fontWeight: 600,
                      }}
                    >
                      {s.category}
                    </span>
                    <span style={{ flex: 1 }} />
                    <StatusChip label="LIVE" color={WebTokens.accent} />
                  </div>

                  <h3
                    className="clamp-2"
                    style={{ marginTop: 14, fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}
                  >
                    {s.title}
                  </h3>

                  <div
                    style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    {s.options.map(([label, percent]) => (
                      <PreviewOption
                        key={label}
                        label={label}
                        percent={percent}
                        hot={percent >= 50}
                      />
                    ))}
                  </div>

                  <div
                    style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <PeopleOutline sx={{ fontSize: 14 }} style={{ color: WebTokens.textMuted }} />
                    <span style={{ color: WebTokens.textMuted, fontSize: 12 }}>{s.players}</span>
                    <span style={{ flex: 1 }} />
                    <span
                      style={{
                        color: WebTokens.textSecondary,
                        fontSize: 12.5,
                        fontWeight: 700,
                      }}
                    >
                      −50 / +100
                    </span>
                  </div>
                </WebCard>
              </Reveal>
            </div>
          ))}
        </div>

        <div style={{ height: 26 }} />

        <span style={{ color: WebTokens.textMuted, fontSize: 13, textAlign: 'center' }}>
          Live questions refresh daily — sign up to play the real board.
        </span>
      </div>
    </Section>
  );
}
