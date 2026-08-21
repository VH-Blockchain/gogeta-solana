'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/** Shared dark-theme styling for the GOGETA admin charts. */
const AXIS = { stroke: '#52525b', fontSize: 11 } as const;
const GRID = 'rgba(255,255,255,0.06)';
const TOOLTIP_STYLE = {
  backgroundColor: '#18181b',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  fontSize: 12,
  color: '#e4e4e7',
} as const;

export const CHART_COLORS = {
  // Kept green: pairs with `rose` as the correct/incorrect semantic, which
  // should not follow the brand colour.
  emerald: '#34d399',
  // Brand series colour — the Gogeta aura cyan (was lime).
  aura: '#22d3ee',
  rose: '#fb7185',
  amber: '#fbbf24',
  violet: '#a78bfa',
  sky: '#38bdf8',
};

/** Won vs lost entries as a donut with a % accuracy center label. */
export function WonLostDonut({ won, lost }: { won: number; lost: number }) {
  const total = won + lost;
  const data = [
    { name: 'Correct', value: won },
    { name: 'Incorrect', value: lost },
  ];
  return (
    <div className="relative h-56">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius="62%"
            outerRadius="85%"
            paddingAngle={3}
            strokeWidth={0}
          >
            <Cell fill={CHART_COLORS.emerald} />
            <Cell fill={CHART_COLORS.rose} />
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(v) => <span className="text-xs text-zinc-400">{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-6">
        <span className="text-2xl font-semibold text-zinc-100">
          {total ? Math.round((won / total) * 100) : 0}%
        </span>
        <span className="text-[11px] uppercase tracking-wide text-zinc-500">correct</span>
      </div>
    </div>
  );
}

/** Reward vs lucky-draw payout split. */
export function PayoutSplitDonut({ reward, lucky }: { reward: number; lucky: number }) {
  const data = [
    { name: 'Rewards', value: reward },
    { name: 'Lucky draw', value: lucky },
  ];
  return (
    <div className="relative h-56">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius="62%"
            outerRadius="85%"
            paddingAngle={3}
            strokeWidth={0}
          >
            <Cell fill={CHART_COLORS.amber} />
            <Cell fill={CHART_COLORS.violet} />
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => Number(v).toLocaleString()} />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(v) => <span className="text-xs text-zinc-400">{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-6">
        <span className="text-xl font-semibold text-zinc-100">{(reward + lucky).toLocaleString()}</span>
        <span className="text-[11px] uppercase tracking-wide text-zinc-500">points paid</span>
      </div>
    </div>
  );
}

/** Correct/incorrect entries per prediction — horizontal stacked bars. */
export function EntriesByPredictionBars({
  data,
}: {
  data: { name: string; correct: number; incorrect: number }[];
}) {
  return (
    <div style={{ height: Math.max(200, data.length * 44) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={160}
            tick={{ ...AXIS, fill: '#a1a1aa' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v) => <span className="text-xs text-zinc-400">{v}</span>}
          />
          <Bar dataKey="correct" name="Correct" stackId="e" fill={CHART_COLORS.emerald} radius={[4, 0, 0, 4]} />
          <Bar dataKey="incorrect" name="Incorrect" stackId="e" fill={CHART_COLORS.rose} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Coins paid out per resolved prediction over time. */
export function PayoutTrendArea({ data }: { data: { date: string; payout: number }[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: 0, right: 16, top: 8 }}>
          <defs>
            <linearGradient id="payoutFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.aura} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART_COLORS.aura} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="date" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={48} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => Number(v).toLocaleString()} />
          <Area
            type="monotone"
            dataKey="payout"
            name="Coins paid"
            stroke={CHART_COLORS.aura}
            strokeWidth={2}
            fill="url(#payoutFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Quiz analytics ─────────────────────────────────────────────────────── */

/**
 * Entries and net points per day.
 *
 * Two series on one canvas because they answer one question together — whether
 * more players cost the platform more or less — and reading that off two
 * separate charts means eyeballing dates across them. Net points gets its own
 * axis since points and player counts are different magnitudes.
 */
export function QuizEntriesTrend({
  data,
}: {
  data: { date: string; entries: number; netPoints: number }[];
}) {
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="quizEntriesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.aura} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART_COLORS.aura} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          {/* Only the day-of-month: a 30-day axis of full ISO dates is unreadable. */}
          <XAxis
            dataKey="date"
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            tickFormatter={(d: string) => d.slice(8)}
            interval="preserveStartEnd"
            minTickGap={18}
          />
          <YAxis yAxisId="left" tick={AXIS} axisLine={false} tickLine={false} width={36} />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => Number(v).toLocaleString()} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="entries"
            name="Entries"
            stroke={CHART_COLORS.aura}
            strokeWidth={2}
            fill="url(#quizEntriesFill)"
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="netPoints"
            name="Net points"
            stroke={CHART_COLORS.amber}
            strokeWidth={2}
            fill="none"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Correct / wrong / unanswered as a donut, with the accuracy in the middle.
 *
 * `accuracy` is passed in rather than derived here on purpose: the segments span
 * every question *served* (including ones nobody answered) while accuracy is
 * measured over questions actually *answered*. Recomputing from the segment
 * totals would silently use the wrong denominator and disagree with the figure
 * the API reports.
 */
export function QuizAccuracyDonut({
  correct,
  wrong,
  unanswered,
  accuracy,
}: {
  correct: number;
  wrong: number;
  unanswered: number;
  /** Percentage correct of those answered, as the server computed it. */
  accuracy: number;
}) {
  const total = correct + wrong + unanswered;
  const data = [
    { name: 'Correct', value: correct, fill: CHART_COLORS.emerald },
    { name: 'Wrong', value: wrong, fill: CHART_COLORS.rose },
    { name: 'Unanswered', value: unanswered, fill: '#52525b' },
  ].filter((d) => d.value > 0);

  if (total === 0) {
    return <p className="py-10 text-center text-sm text-zinc-500">No answers recorded yet.</p>;
  }

  return (
    <div className="relative h-56">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="none">
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => Number(v).toLocaleString()} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
        <span className="text-2xl font-semibold tabular-nums">{accuracy}%</span>
        <span className="text-[11px] text-zinc-500">of answered</span>
      </div>
    </div>
  );
}

/**
 * How often each answer position is chosen.
 *
 * Worth watching: a spike on one letter means the question bank's correct
 * answers cluster there, which players can exploit without knowing anything.
 */
export function QuizOptionSpreadBars({
  data,
}: {
  data: { label: string; count: number; share: number }[];
}) {
  return (
    <div className="h-48">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v, _n, item) => [
              `${Number(v).toLocaleString()} picks (${(item?.payload as { share?: number })?.share ?? 0}%)`,
              'Picks',
            ]}
          />
          <Bar dataKey="count" name="Picks" fill={CHART_COLORS.violet} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Entries per category, with points in and out side by side. */
export function QuizCategoryBars({
  data,
}: {
  data: { categoryLabel: string; entryCollected: number; rewardPaid: number }[];
}) {
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="categoryLabel"
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: string) => (v === 'General Knowledge' ? 'General' : v)}
          />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={44} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => Number(v).toLocaleString()} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="entryCollected" name="Entry collected" fill={CHART_COLORS.aura} radius={[6, 6, 0, 0]} />
          <Bar dataKey="rewardPaid" name="Reward paid" fill={CHART_COLORS.amber} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
