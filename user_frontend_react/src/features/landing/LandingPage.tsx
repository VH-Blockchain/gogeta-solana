import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Routes } from '@/router/routes';
import { WebTokens, glow, withAlpha } from '@/theme/webTokens';
import { AuroraBackdrop } from '@/components/AuroraBackdrop';
import { GlowButton } from '@/components/GlowButton';
import { useWindowWidth } from '@/hooks/useWindowWidth';
import { BrandMark } from './BrandMark';
import { Hero } from './Hero';
import { HowItWorks, Showcase, StatsStrip } from './Sections1';
import { Faq, FeatureBento, InsideTheApp, ProblemSolution, Testimonials } from './Sections2';
import { FinalCta, Footer, MobileAppSection } from './Sections3';

/**
 * Public landing page (SOW: Public Screens — Landing Page).
 * Typography-first hero with kinetic words over the aurora backdrop, count-up
 * stats strip, how-it-works, showcase, problem/solution, inside-the-app,
 * feature bento, testimonials, FAQ, mobile cross-sell, final CTA + footer.
 * Port of `LandingPage`.
 */
export function LandingPage() {
  // The landing page scrolls the document, not a shell pane.
  useEffect(() => {
    document.body.classList.add('scroll-page');
    return () => document.body.classList.remove('scroll-page');
  }, []);

  return (
    <AuroraBackdrop>
      <GlassNav />
      <Hero />
      <StatsStrip />
      <div style={{ height: 90 }} />
      <HowItWorks />
      <div style={{ height: 90 }} />
      <Showcase />
      <div style={{ height: 90 }} />
      <ProblemSolution />
      <div style={{ height: 90 }} />
      <InsideTheApp />
      <div style={{ height: 90 }} />
      <FeatureBento />
      <div style={{ height: 90 }} />
      <Testimonials />
      <div style={{ height: 90 }} />
      <Faq />
      <div style={{ height: 90 }} />
      <MobileAppSection />
      <div style={{ height: 100 }} />
      <FinalCta />
      <Footer />
    </AuroraBackdrop>
  );
}

/** Blurred glass top nav. Port of `_GlassNav`. */
function GlassNav() {
  const width = useWindowWidth();
  const compact = width < WebTokens.bpTablet;
  const navigate = useNavigate();

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: WebTokens.topBarHeight,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 24px',
        background: withAlpha(WebTokens.bg, 0.55),
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${WebTokens.glassStroke}`,
      }}
    >
      <Link to={Routes.landing} aria-label="GOGETA home" style={{ display: 'inline-flex' }}>
        <BrandMark />
      </Link>

      {!compact && (
        <>
          <span
            style={{
              marginLeft: 4,
              color: WebTokens.textPrimary,
              fontWeight: 700,
              fontSize: 15,
              whiteSpace: 'nowrap',
            }}
          >
            GOGETA
          </span>
          <BetaChip />
        </>
      )}

      <span style={{ flex: 1 }} />

      {!compact && (
        <Link
          to={Routes.login}
          className="btn-text"
          style={{ color: WebTokens.textSecondary, fontWeight: 400 }}
        >
          Sign in
        </Link>
      )}

      <GlowButton
        label={compact ? 'Sign in' : 'Get started'}
        onClick={() => navigate(compact ? Routes.login : Routes.register)}
      />
    </header>
  );
}

/**
 * "Beta" tag — the same gold pill treatment as the hero preview card's
 * "+100 if correct" reward chip (gold-to-amber gradient, fully rounded).
 */
function BetaChip() {
  return (
    <span
      style={{
        marginLeft: 4,
        padding: '4px 10px',
        background: `linear-gradient(135deg, ${WebTokens.gold}, ${WebTokens.goldDeep})`,
        borderRadius: 999,
        boxShadow: glow(WebTokens.gold, 0.35),
        color: WebTokens.onAccent,
        fontWeight: 700,
        fontSize: 11,
      }}
    >
      BETA
    </span>
  );
}
