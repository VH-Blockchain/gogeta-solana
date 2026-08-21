import type { ReactNode } from 'react';
import { WebTokens, glassGradient, withAlpha } from '@/theme/webTokens';

/**
 * Section scaffold — the eyebrow pill + centered headline + content column
 * every landing section shares. Port of `_Section`.
 */
export function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1100, padding: '0 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span
            style={{
              padding: '7px 14px',
              background: glassGradient,
              borderRadius: 999,
              border: `1px solid ${withAlpha(WebTokens.accent, 0.3)}`,
              color: WebTokens.accent,
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: 2.5,
            }}
          >
            {eyebrow}
          </span>

          <h2
            className="t-headline-large"
            style={{
              marginTop: 18,
              textAlign: 'center',
              lineHeight: 1.12,
              whiteSpace: 'pre-line',
            }}
          >
            {title}
          </h2>

          <div style={{ height: 44 }} />

          <div style={{ width: '100%' }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

/** A centered max-width column for sections that don't use the eyebrow header. */
export function CenteredBlock({
  children,
  maxWidth = 1100,
}: {
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth, padding: '0 24px' }}>{children}</div>
    </div>
  );
}
