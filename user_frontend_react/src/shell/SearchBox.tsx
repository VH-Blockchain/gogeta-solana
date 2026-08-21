import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchRounded from '@mui/icons-material/SearchRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { Routes } from '@/router/routes';
import { WebTokens } from '@/theme/webTokens';

/**
 * Portal search box — a real feature: submits to the Predict page filtered by
 * title. Shared by the sidebar and the topbar (the Flutter source had two
 * near-identical copies, `_SidebarSearch` and `_TopSearch`).
 *
 * `navigateOnClear` covers the sidebar's behaviour: backspacing the query down
 * to empty doesn't fire a submit, so without it the Predict page kept showing
 * the last search's stale results — clearing has to behave the same regardless
 * of how the field became empty.
 */
export function SearchBox({
  fontSize = 12,
  showClear = true,
  navigateOnClear = false,
  onNavigate,
}: {
  fontSize?: number;
  showClear?: boolean;
  navigateOnClear?: boolean;
  onNavigate?: () => void;
}) {
  const [value, setValue] = useState('');
  const navigate = useNavigate();
  const wasEmpty = useRef(true);

  const submit = (raw: string) => {
    const q = raw.trim();
    onNavigate?.();
    // Always navigate, even when cleared — a bare early-return here left the
    // Predict page showing whatever the *previous* search matched, with no way
    // back to the unfiltered list short of a manual reload.
    navigate(
      q.length === 0 ? Routes.predictions : `${Routes.predictions}?q=${encodeURIComponent(q)}`,
    );
  };

  useEffect(() => {
    if (!navigateOnClear) return;
    const isEmpty = value.length === 0;
    if (isEmpty && !wasEmpty.current) submit('');
    wasEmpty.current = isEmpty;
    // `submit` is stable enough for this effect's purpose (it only closes over
    // navigate/onNavigate); re-running on every keystroke is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, navigateOnClear]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 40,
        padding: `0 ${fontSize >= 13 ? 14 : 12}px`,
        background: WebTokens.surfaceAlt,
        // Full pill, not a softly-rounded rectangle.
        borderRadius: 999,
        border: `1px solid ${WebTokens.border}`,
      }}
    >
      <SearchRounded sx={{ fontSize: 17 }} style={{ color: WebTokens.textMuted }} />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit(value);
        }}
        placeholder="Search predictions…"
        aria-label="Search predictions"
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontSize,
          fontWeight: 500,
          color: WebTokens.textPrimary,
        }}
      />
      {showClear && value.length > 0 && (
        <button
          type="button"
          aria-label="Clear search"
          // The empty-transition effect above handles navigation-on-clear, so
          // submitting here too would just double-navigate.
          onClick={() => setValue('')}
          style={{ color: WebTokens.textMuted, display: 'inline-flex' }}
        >
          <CloseRounded sx={{ fontSize: 15 }} />
        </button>
      )}
    </div>
  );
}
