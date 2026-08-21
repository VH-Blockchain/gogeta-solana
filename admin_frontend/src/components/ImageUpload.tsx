'use client';

import { useRef, useState } from 'react';
import { uploadFile } from '@/lib/api';
import { Button } from '@/components/ui';

/**
 * Image picker that uploads to POST /admin/upload and returns the served URL
 * via onChange. Shows a preview + remove control. Used for prediction banners
 * and category images.
 */
export function ImageUpload({
  value,
  onChange,
  label = 'Image',
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const { url } = await uploadFile<{ url: string }>('/admin/upload', file);
      onChange(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="h-14 w-14 rounded-lg border border-white/10 object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-white/15 text-xs text-zinc-500">
            none
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => ref.current?.click()} disabled={busy}>
            {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
          </Button>
          {value && (
            <Button variant="ghost" onClick={() => onChange(null)} disabled={busy}>
              Remove
            </Button>
          )}
        </div>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = '';
        }}
      />
      {err && <p className="text-sm text-red-400">{err}</p>}
    </div>
  );
}
