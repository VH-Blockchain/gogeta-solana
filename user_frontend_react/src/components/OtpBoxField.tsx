import { useRef } from 'react';
import { WebTokens } from '@/theme/webTokens';

/**
 * Segmented OTP/reset-code input — a row of digit boxes driven by a single
 * hidden text field, so the visible boxes fill/highlight as the user types
 * without juggling N separate focus targets. Port of `OtpBoxField`.
 *
 * Length defaults to 4: the backend issues 4-digit codes for both OTP
 * purposes (auth.service.ts's issueOtp()).
 */
export function OtpBoxField({
  value,
  onChange,
  length = 4,
  autoFocus = true,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  onSubmit?: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      style={{ position: 'relative', height: 54, cursor: 'text' }}
      onMouseDown={(e) => {
        e.preventDefault();
        inputRef.current?.focus();
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', height: '100%' }}>
        {Array.from({ length }, (_, i) => (
          <OtpBox key={i} char={i < value.length ? value[i] : ''} active={i === value.length} />
        ))}
      </div>
      <input
        ref={inputRef}
        // Visually hidden but still the real focus target and IME surface.
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          border: 'none',
          background: 'transparent',
          outline: 'none',
        }}
        value={value}
        autoFocus={autoFocus}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit?.(value);
        }}
        aria-label={`Enter the ${length}-digit code`}
      />
    </div>
  );
}

function OtpBox({ char, active }: { char: string; active: boolean }) {
  return (
    <div
      style={{
        width: 44,
        height: 54,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: WebTokens.surfaceAlt,
        borderRadius: WebTokens.radiusControl,
        border: `${active ? WebTokens.borderWidthStrong : WebTokens.borderWidth}px solid ${
          active ? WebTokens.accent : WebTokens.border
        }`,
        fontSize: 20,
        fontWeight: 700,
        color: WebTokens.textPrimary,
        transition: 'border-color 140ms ease',
      }}
    >
      {char}
    </div>
  );
}
