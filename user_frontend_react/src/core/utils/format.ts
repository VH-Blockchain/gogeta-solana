/** Shared formatting helpers. Port of lib/core/utils/format.dart. */
export const Fmt = {
  /** Short duration label from a millisecond span: 2d / 3h / 45m / — */
  durationShort(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds <= 0) return '—';
    const hours = Math.floor(seconds / 3600);
    if (hours >= 24) return `${Math.floor(hours / 24)}d`;
    if (hours >= 1) return `${hours}h`;
    return `${Math.floor(seconds / 60)}m`;
  },

  /** 1,234 / 12.3k / 1.2M */
  compactNumber(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 10_000) return `${(v / 1000).toFixed(1)}k`;
    return Math.trunc(v)
      .toString()
      .replace(/(\d)(?=(\d{3})+$)/g, '$1,');
  },
};
