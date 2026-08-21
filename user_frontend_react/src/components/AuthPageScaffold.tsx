import type { ReactNode } from 'react';
import { WebTokens, cardShadow, glassGradient } from '@/theme/webTokens';
import { AuroraBackdrop } from './AuroraBackdrop';

/** Centered glass card over the aurora backdrop — shared by all auth pages. */
export function AuthPageScaffold({
  children,
  width = 430,
}: {
  children: ReactNode;
  width?: number;
}) {
  return (
    <AuroraBackdrop>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: width,
            padding: 34,
            background: glassGradient,
            borderRadius: WebTokens.radiusCard,
            border: `${WebTokens.borderWidth}px solid ${WebTokens.glassStroke}`,
            boxShadow: cardShadow,
          }}
        >
          {children}
        </div>
      </div>
    </AuroraBackdrop>
  );
}
