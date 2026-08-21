'use client';

import { ButtonHTMLAttributes, ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/* ── Accent palette (blue-forward — the Gogeta aura) ──────────────────
   `aura` and `azure` are the two brand accents (they replaced the old
   lime/emerald pair). The palette stays deliberately blue-heavy for the
   same reason the original was green-heavy: it's the identity colour. */
export type Accent = 'aura' | 'azure' | 'teal' | 'sky' | 'amber' | 'rose' | 'violet';
export const ACCENT: Record<Accent, { from: string; to: string; text: string; glow: string }> = {
  aura: { from: 'from-cyan-300', to: 'to-blue-500', text: 'text-cyan-300', glow: 'shadow-cyan-400/30' },
  azure: { from: 'from-blue-400', to: 'to-indigo-600', text: 'text-blue-300', glow: 'shadow-blue-500/30' },
  teal: { from: 'from-teal-300', to: 'to-cyan-600', text: 'text-teal-300', glow: 'shadow-teal-500/30' },
  sky: { from: 'from-sky-400', to: 'to-blue-500', text: 'text-sky-300', glow: 'shadow-sky-500/30' },
  amber: { from: 'from-amber-300', to: 'to-orange-500', text: 'text-amber-300', glow: 'shadow-amber-500/30' },
  rose: { from: 'from-rose-400', to: 'to-pink-500', text: 'text-rose-300', glow: 'shadow-rose-500/30' },
  violet: { from: 'from-violet-400', to: 'to-fuchsia-500', text: 'text-violet-300', glow: 'shadow-violet-500/30' },
};

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`panel rounded-2xl shadow-xl shadow-black/30 ${className}`}>{children}</div>;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger'; size?: 'sm' | 'md' }) {
  const styles = {
    primary:
      'bg-gradient-to-r from-cyan-300 to-blue-600 text-zinc-950 font-semibold shadow-lg shadow-cyan-500/25 hover:brightness-110',
    ghost: 'border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10',
    danger:
      'bg-gradient-to-r from-rose-500 to-red-600 text-white font-semibold shadow-lg shadow-rose-500/25 hover:brightness-110',
  }[variant];
  const sizes = { md: 'px-4 py-2 text-sm', sm: 'px-2.5 py-1 text-xs' }[size];
  return (
    <button
      className={`rounded-xl transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${sizes} ${styles} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Badge({ children, color = 'zinc' }: { children: ReactNode; color?: string }) {
  const map: Record<string, string> = {
    zinc: 'bg-white/5 text-zinc-300 border border-white/10',
    green: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    amber: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    red: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
    blue: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
    violet: 'bg-violet-500/15 text-violet-300 border border-violet-500/30',
    teal: 'bg-teal-500/15 text-teal-300 border border-teal-500/30',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${map[color] ?? map.zinc}`}>
      {children}
    </span>
  );
}

/* Stat card with icon chip + corner ↗ arrow (reference style). */
export function StatCard({
  label,
  value,
  sub,
  icon,
  accent = 'azure',
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon: ReactNode;
  accent?: Accent;
}) {
  const a = ACCENT[accent];
  return (
    <Card className="group relative overflow-hidden p-5">
      <div className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${a.from} ${a.to} opacity-[0.18] blur-2xl`} />
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${a.from} ${a.to} text-zinc-950 shadow-lg ${a.glow}`}>
          {icon}
        </div>
        <span className="text-zinc-600 transition group-hover:text-zinc-300">↗</span>
      </div>
      <div className="mt-4 text-sm text-zinc-400">{label}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </Card>
  );
}

/* Radial gauge (270° arc) with a green gradient — gamified score display. */
export function Gauge({
  value,
  fraction,
  label,
  sub,
}: {
  value: string;
  fraction: number;
  label: string;
  sub?: string;
}) {
  const r = 42;
  const C = 2 * Math.PI * r;
  const arc = 0.75 * C; // 270°
  const f = Math.max(0, Math.min(1, fraction));
  const id = `g-${label.replace(/\W/g, '')}`;
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-40 w-40">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-[0deg]">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a3e635" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${arc} ${C}`}
            transform="rotate(135 50 50)"
          />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={`url(#${id})`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${arc * f} ${C}`}
            transform="rotate(135 50 50)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
          {sub && <div className="mt-0.5 text-[11px] text-zinc-500">{sub}</div>}
        </div>
      </div>
      <div className="mt-1 text-sm text-zinc-400">{label}</div>
    </div>
  );
}

/* Compact KPI tile — a smaller [StatCard] for per-tab summary strips. */
export function MiniStat({
  label,
  value,
  sub,
  icon,
  accent = 'azure',
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon?: ReactNode;
  accent?: Accent;
}) {
  const a = ACCENT[accent];
  return (
    <Card className="flex items-center gap-3 p-4">
      {icon != null && (
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${a.from} ${a.to} text-base text-zinc-950 shadow-md ${a.glow}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        <div className="truncate text-xs text-zinc-500">
          {label}
          {sub ? ` · ${sub}` : ''}
        </div>
      </div>
    </Card>
  );
}

/* Thin gradient progress bar (0…max). */
export function ProgressBar({
  value,
  max = 1,
  accent = 'azure',
  className = '',
}: {
  value: number;
  max?: number;
  accent?: Accent;
  className?: string;
}) {
  const a = ACCENT[accent];
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0;
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-white/5 ${className}`}>
      <div className={`h-full rounded-full bg-gradient-to-r ${a.from} ${a.to}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* A single bar split into proportional segments — e.g. vote share per option. */
export function SplitBar({ segments, className = '' }: { segments: { value: number; accent?: Accent }[]; className?: string }) {
  const sum = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div className={`flex h-2 w-full overflow-hidden rounded-full bg-white/5 ${className}`}>
      {sum > 0 &&
        segments.map((s, i) => {
          const a = ACCENT[s.accent ?? 'azure'];
          return <div key={i} className={`h-full bg-gradient-to-r ${a.from} ${a.to}`} style={{ width: `${(s.value / sum) * 100}%` }} />;
        })}
    </div>
  );
}

/* Labelled horizontal-bar breakdown (count + share per row). */
export function Distribution({ items, total }: { items: { label: string; value: number; accent?: Accent }[]; total?: number }) {
  const sum = total ?? items.reduce((s, i) => s + i.value, 0);
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <div key={it.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-zinc-400">{it.label}</span>
            <span className="tabular-nums text-zinc-500">
              {it.value}
              {sum > 0 ? ` · ${Math.round((it.value / sum) * 100)}%` : ''}
            </span>
          </div>
          <ProgressBar value={it.value} max={sum || 1} accent={it.accent ?? 'azure'} />
        </div>
      ))}
    </div>
  );
}

export function Spinner() {
  return <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-cyan-400" />;
}

export function Modal({
  title,
  onClose,
  children,
  maxWidth = 'max-w-md',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Tailwind max-w-* class — override for content that needs more room
   *  (a wide table, long date values) than the default confirm/form dialog. */
  maxWidth?: string;
}) {
  const [mounted, setMounted] = useState(false);
  // Render into document.body via a portal so the overlay is positioned against
  // the viewport, not a transformed/backdrop-filtered ancestor (which would
  // otherwise anchor `position: fixed` to the tab content). Also locks page
  // scroll while open.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`panel flex max-h-[90vh] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl shadow-2xl shadow-black/50`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-zinc-500 transition hover:text-zinc-200">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-zinc-400">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none transition focus:border-cyan-400/70 focus:bg-black/40';

/** Same box as inputClass, normalized for native <select> (see .select-field
 * in globals.css — a plain <select> renders shorter than a sibling input
 * using identical padding). */
export const selectClass = inputClass + ' select-field';
