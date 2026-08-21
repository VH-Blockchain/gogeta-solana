import MailOutline from '@mui/icons-material/MailOutline';
import { Routes } from '@/router/routes';
import { useConfigStore } from '@/store/configStore';
import { WebTokens } from '@/theme/webTokens';
import { LegalPageScaffold } from './LegalPageScaffold';

const FALLBACK_EMAIL = 'hello@yesiki.com';

/**
 * Support/contact page — the Support URL end users (and the app stores) can
 * reach for help. The content/layout is static, no CMS dependency, so the PAGE
 * can never fail to load the way a backend-fetched page could — but the email
 * itself comes from the already-loaded config (Settings -> Site & branding ->
 * Contact email), no extra network fetch on this page.
 * Port of `WebContactPage`.
 */
export function ContactPage() {
  const configured = useConfigStore((s) => s.config.siteContactEmail);
  const email = configured.length > 0 ? configured : FALLBACK_EMAIL;

  return (
    <LegalPageScaffold
      title="Support"
      crossLinkLabel="Privacy"
      crossLinkRoute={Routes.privacy}
    >
      <div
        className="f-inter"
        style={{ color: WebTokens.textSecondary, fontSize: 14, lineHeight: 1.6 }}
      >
        <p>
          Need help with GOGETA, have feedback, or a question about your account? Reach out and
          we&apos;ll get back to you.
        </p>

        <div style={{ height: 20 }} />

        <a
          className="btn-outlined"
          href={`mailto:${email}?subject=GOGETA%20Support`}
          style={{ display: 'inline-flex' }}
        >
          <MailOutline sx={{ fontSize: 18 }} />
          {email}
        </a>
      </div>
    </LegalPageScaffold>
  );
}
