import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfigStore } from '@/store/configStore';
import { Routes } from '@/router/routes';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import logoPng from '@/assets/logo.png';

/**
 * GOGETA mark — the project logo, matching the admin panel so both surfaces read
 * as one product.
 *
 * An admin-set `site.logoUrl` (Settings -> Site & branding) still wins when
 * configured; the bundled asset is the fallback for when it is unset or fails to
 * load. Bundled rather than served from /public so Vite fingerprints it and a
 * missing file becomes a build error instead of a broken image at runtime.
 */
export function Logo({ size = 44, to = Routes.dashboard }: { size?: number; to?: string }) {
  const logoUrl = useConfigStore((s) => s.config.siteLogoUrl);
  const [remoteFailed, setRemoteFailed] = useState(false);
  const navigate = useNavigate();

  const showRemote = logoUrl.length > 0 && !remoteFailed;

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      aria-label="GOGETA home"
      style={{
        // No chip, border or glow: the artwork has its own silhouette and a
        // transparent background, so boxing it made a logo look like a favicon
        // thumbnail. A faint drop shadow is enough to lift it off the surface.
        width: size,
        height: size,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
      }}
    >
      <img
        src={showRemote ? logoUrl : logoPng}
        alt="GOGETA"
        onError={() => setRemoteFailed(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: `drop-shadow(0 2px 6px ${withAlpha(WebTokens.gold, 0.35)})`,
        }}
      />
    </button>
  );
}
