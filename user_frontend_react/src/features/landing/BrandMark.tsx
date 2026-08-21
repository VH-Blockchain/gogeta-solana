import { useState } from 'react';
import { useConfigStore } from '@/store/configStore';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import logoPng from '@/assets/logo.png';

/**
 * The GOGETA brand mark — the same logo as the portal shell (see shell/Logo.tsx),
 * just non-interactive: the landing page wraps it in its own link.
 *
 * Uses the admin-set `site.logoUrl` when configured, same as the shell.
 */
export function BrandMark({ size = 40 }: { size?: number }) {
  const logoUrl = useConfigStore((s) => s.config.siteLogoUrl);
  const [remoteFailed, setRemoteFailed] = useState(false);
  const showRemote = logoUrl.length > 0 && !remoteFailed;

  return (
    <span
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
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
    </span>
  );
}
