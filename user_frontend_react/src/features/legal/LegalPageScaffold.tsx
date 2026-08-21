import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Routes } from '@/router/routes';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import { Logo } from '@/shell/Logo';

/**
 * Shared layout for the standalone legal pages (Privacy/Terms/Support) — the
 * same content as the separately-hosted static site, rebuilt here so this
 * portal can be deployed to the same URLs without a broken link.
 *
 * No portal shell (sidebar/topbar) — these are public pages reachable
 * pre-login, same as the landing page. Port of `LegalPageScaffold`.
 */
export function LegalPageScaffold({
  title,
  children,
  crossLinkLabel,
  crossLinkRoute,
}: {
  title: string;
  children: ReactNode;
  crossLinkLabel: string;
  crossLinkRoute: string;
}) {
  // These pages scroll the document rather than a shell pane.
  useEffect(() => {
    document.body.classList.add('scroll-page');
    return () => document.body.classList.remove('scroll-page');
  }, []);

  return (
    <div style={{ minHeight: '100%', background: WebTokens.bg }}>
      <Header crossLinkLabel={crossLinkLabel} crossLinkRoute={crossLinkRoute} />

      <Hero title={title} />

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 800, padding: '32px 24px 48px' }}>{children}</div>
      </div>

      <Footer />
    </div>
  );
}

function Header({
  crossLinkLabel,
  crossLinkRoute,
}: {
  crossLinkLabel: string;
  crossLinkRoute: string;
}) {
  return (
    <header
      style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 20px',
        borderBottom: `${WebTokens.borderWidth}px solid ${WebTokens.chromeDivider}`,
      }}
    >
      <Link to={Routes.landing} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <Logo size={34} to={Routes.landing} />
        <span style={{ color: WebTokens.textPrimary, fontWeight: 800, fontSize: 17 }}>GOGETA</span>
      </Link>

      <span style={{ flex: 1 }} />

      <Link to={Routes.landing} className="btn-text">
        Home
      </Link>
      <Link to={crossLinkRoute} className="btn-text">
        {crossLinkLabel}
      </Link>
      <Link to={Routes.contact} className="btn-outlined">
        hello@yesiki.com
      </Link>
    </header>
  );
}

function Hero({ title }: { title: string }) {
  return (
    <div
      style={{
        width: '100%',
        background: `linear-gradient(135deg, ${withAlpha(WebTokens.violet, 0.14)}, ${withAlpha(WebTokens.accent, 0.06)}, ${WebTokens.bg})`,
        borderBottom: `${WebTokens.borderWidth}px solid ${WebTokens.chromeDivider}`,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 800, padding: '48px 24px 40px' }}>
        <h1 className="t-display-small">{title}</h1>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div
      style={{
        padding: '24px',
        borderTop: `${WebTokens.borderWidth}px solid ${WebTokens.chromeDivider}`,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 800,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <span style={{ color: WebTokens.textMuted, fontSize: 12.5 }}>
          © {new Date().getFullYear()} GOGETA · Operated by Yesiki
        </span>
        <span style={{ color: WebTokens.textMuted, fontSize: 12.5 }}>hello@yesiki.com</span>
      </div>
    </div>
  );
}
