import { useCallback, useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import WifiOff from '@mui/icons-material/WifiOff';
import Refresh from '@mui/icons-material/Refresh';
import { isApiException } from '@/core/network/apiException';
import { ConfigRepository, type CmsContent } from '@/data/api/configRepository';
import { Routes } from '@/router/routes';
import { WebTokens } from '@/theme/webTokens';
import { EmptyState } from '@/components/Primitives';
import { SkeletonCard } from '@/components/Skeleton';
import { WebCard } from '@/components/WebCard';
import { LegalPageScaffold } from './LegalPageScaffold';
import './CmsPage.css';

/**
 * Shared body for the admin-editable legal pages, fetched live from
 * `GET /cms/{slug}` — the same CMS system + slugs the mobile app's CmsScreen
 * uses, so content changes made in the admin panel show up here too without a
 * new deploy.
 *
 * The HTML is sanitized before injection (the Flutter build rendered it through
 * flutter_widget_from_html, which never executed scripts; `innerHTML` would, so
 * sanitizing keeps the same security posture).
 */
export function CmsPage({
  slug,
  fallbackTitle,
  crossLinkLabel,
  crossLinkRoute,
}: {
  slug: string;
  fallbackTitle: string;
  crossLinkLabel: string;
  crossLinkRoute: string;
}) {
  const [page, setPage] = useState<CmsContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPage(await ConfigRepository.cmsPage(slug));
    } catch (e) {
      setError(isApiException(e) ? e.message : 'Could not load this page.');
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <LegalPageScaffold
      title={page?.title ?? fallbackTitle}
      crossLinkLabel={crossLinkLabel}
      crossLinkRoute={crossLinkRoute}
    >
      {error != null ? (
        <WebCard>
          <EmptyState
            icon={<WifiOff sx={{ fontSize: 30 }} />}
            title="Couldn't load this page"
            subtitle={error}
            action={
              <button type="button" className="btn-outlined" onClick={() => void load()}>
                <Refresh sx={{ fontSize: 18 }} />
                Retry
              </button>
            }
          />
        </WebCard>
      ) : page == null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SkeletonCard height={56} />
          <SkeletonCard height={120} />
        </div>
      ) : (
        <div
          className="cms-body f-inter"
          style={{ color: WebTokens.textSecondary, fontSize: 14, lineHeight: 1.6 }}
          // Sanitized above — see the doc comment.
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.content) }}
        />
      )}
    </LegalPageScaffold>
  );
}

/** Privacy Policy — admin-editable, fetched live from `GET /cms/privacy`. */
export function PrivacyPage() {
  return (
    <CmsPage
      slug="privacy"
      fallbackTitle="Privacy Policy"
      crossLinkLabel="Terms"
      crossLinkRoute={Routes.terms}
    />
  );
}

/** Terms of Use — admin-editable, fetched live from `GET /cms/terms`. */
export function TermsPage() {
  return (
    <CmsPage
      slug="terms"
      fallbackTitle="Terms of Use"
      crossLinkLabel="Privacy"
      crossLinkRoute={Routes.privacy}
    />
  );
}
