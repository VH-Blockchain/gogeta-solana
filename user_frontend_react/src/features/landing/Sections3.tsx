import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Android from '@mui/icons-material/Android';
import Apple from '@mui/icons-material/Apple';
import Smartphone from '@mui/icons-material/Smartphone';
import ArrowForward from '@mui/icons-material/ArrowForward';
import Facebook from '@mui/icons-material/Facebook';
import AlternateEmail from '@mui/icons-material/AlternateEmail';
import CameraAltOutlined from '@mui/icons-material/CameraAltOutlined';
import PublicIcon from '@mui/icons-material/Public';
import { Routes } from '@/router/routes';
import { useConfigStore } from '@/store/configStore';
import { WebTokens, brandGradient, glow, withAlpha } from '@/theme/webTokens';
import { GlowButton } from '@/components/GlowButton';
import { Divider } from '@/components/Primitives';
import { WebCard } from '@/components/WebCard';
import { useElementWidth } from '@/hooks/useElementWidth';
import { BrandMark } from './BrandMark';
import { CenteredBlock } from './Section';

// ---------------------------------------------------------------------------
// Mobile app cross-sell
// ---------------------------------------------------------------------------

export function MobileAppSection() {
  const [ref, width] = useElementWidth();
  const wide = width >= 720;

  const copy = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: wide ? 'flex-start' : 'center',
      }}
    >
      <h2 className="t-headline-medium" style={{ textAlign: wide ? 'left' : 'center' }}>
        Take GOGETA in your pocket
      </h2>
      <p
        className="f-inter"
        style={{
          marginTop: 10,
          textAlign: wide ? 'left' : 'center',
          color: WebTokens.textSecondary,
          fontSize: 14.5,
          lineHeight: 1.55,
        }}
      >
        The full experience — predictions, daily draws, ranks and badges — is also a native mobile
        app for Android and iOS.
      </p>

      <div
        style={{
          marginTop: 22,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: wide ? 'flex-start' : 'center',
        }}
      >
        <StoreBadge
          icon={<Android sx={{ fontSize: 22 }} />}
          store="Google Play"
          url="https://play.google.com/store/apps/details?id=com.iki.app"
        />
        <StoreBadge
          icon={<Apple sx={{ fontSize: 22 }} />}
          store="App Store"
          url="https://apps.apple.com/in/app/yes-iki/id6786754741"
        />
      </div>
    </div>
  );

  const art = (
    <div
      aria-hidden="true"
      style={{
        width: 150,
        height: 150,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: brandGradient,
        borderRadius: 38,
        boxShadow: glow(WebTokens.accent, 0.4),
        color: WebTokens.onAccent,
      }}
    >
      <Smartphone sx={{ fontSize: 64 }} />
    </div>
  );

  return (
    <CenteredBlock>
      <WebCard padding={40}>
        <div
          ref={ref}
          style={{
            display: 'flex',
            flexDirection: wide ? 'row' : 'column',
            alignItems: 'center',
            gap: wide ? 40 : 28,
          }}
        >
          {wide ? (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>{copy}</div>
              {art}
            </>
          ) : (
            <>
              {art}
              {copy}
            </>
          )}
        </div>
      </WebCard>
    </CenteredBlock>
  );
}

function StoreBadge({ icon, store, url }: { icon: ReactNode; store: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 18px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: WebTokens.radiusControl,
        border: `1px solid ${WebTokens.glassStrokeStrong}`,
      }}
    >
      <span style={{ display: 'inline-flex', color: WebTokens.textPrimary }}>{icon}</span>
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ color: WebTokens.textMuted, fontSize: 10.5 }}>Get it on</span>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{store}</span>
      </span>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Final CTA + footer
// ---------------------------------------------------------------------------

export function FinalCta() {
  const navigate = useNavigate();
  return (
    <CenteredBlock maxWidth={860}>
      <WebCard glow={WebTokens.accent} padding="56px 32px">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2
            className="t-display-small"
            style={{ textAlign: 'center', lineHeight: 1.1, whiteSpace: 'pre-line' }}
          >
            {'Your first prediction\nis waiting.'}
          </h2>
          <p
            style={{
              marginTop: 14,
              textAlign: 'center',
              color: WebTokens.textSecondary,
              fontSize: 15,
            }}
          >
            Join now and make your first prediction in under a minute.
          </p>
          <div style={{ marginTop: 30 }}>
            <GlowButton
              label="Create free account"
              icon={<ArrowForward />}
              large
              onClick={() => navigate(Routes.register)}
            />
          </div>
        </div>
      </WebCard>
    </CenteredBlock>
  );
}

export function Footer() {
  const config = useConfigStore((s) => s.config);
  const siteName = config.siteName || 'GOGETA';
  const tagline = config.siteTagline || 'Predict. Compete. Prove';
  const email = config.siteContactEmail || 'hello@yesiki.com';
  const social = config.siteSocial;

  const hasSocial =
    social.facebook.length > 0 ||
    social.twitter.length > 0 ||
    social.instagram.length > 0 ||
    social.website.length > 0;

  return (
    <div style={{ padding: '70px 24px 34px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Divider />

        <div style={{ height: 26 }} />

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            rowGap: 10,
          }}
        >
          <BrandMark />
          <span style={{ color: WebTokens.textMuted }}>·</span>
          <span style={{ color: WebTokens.textSecondary, fontSize: 13 }}>{tagline}</span>
          <span style={{ color: WebTokens.textMuted }}>·</span>
          <span style={{ color: WebTokens.textMuted, fontSize: 13 }}>
            © {new Date().getFullYear()} {siteName} — {email}
          </span>
        </div>

        {/* Only rendered when a URL is actually configured (Settings -> Site &
            branding), so an unset link never shows a dead icon. */}
        {hasSocial && (
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 16,
            }}
          >
            {social.facebook.length > 0 && (
              <SocialIcon icon={<Facebook sx={{ fontSize: 16 }} />} url={social.facebook} label="Facebook" />
            )}
            {social.twitter.length > 0 && (
              <SocialIcon
                icon={<AlternateEmail sx={{ fontSize: 16 }} />}
                url={social.twitter}
                label="X / Twitter"
              />
            )}
            {social.instagram.length > 0 && (
              <SocialIcon
                icon={<CameraAltOutlined sx={{ fontSize: 16 }} />}
                url={social.instagram}
                label="Instagram"
              />
            )}
            {social.website.length > 0 && (
              <SocialIcon icon={<PublicIcon sx={{ fontSize: 16 }} />} url={social.website} label="Website" />
            )}
          </div>
        )}

        <div
          style={{
            marginTop: 16,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 20,
          }}
        >
          <FooterLink label="Privacy Policy" to={Routes.privacy} />
          <FooterLink label="Terms of Use" to={Routes.terms} />
          <FooterLink label="Contact Us" to={Routes.contact} />
        </div>
      </div>
    </div>
  );
}

function SocialIcon({ icon, url, label }: { icon: ReactNode; url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      title={label}
      style={{
        width: 34,
        height: 34,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        border: `1px solid ${withAlpha('#FFFFFF', 0.1)}`,
        color: WebTokens.textSecondary,
      }}
    >
      {icon}
    </a>
  );
}

function FooterLink({ label, to }: { label: string; to: string }) {
  return (
    <Link
      to={to}
      style={{
        color: WebTokens.textSecondary,
        fontSize: 12.5,
        fontWeight: 600,
        textDecoration: 'underline',
        textDecorationColor: WebTokens.textMuted,
      }}
    >
      {label}
    </Link>
  );
}
