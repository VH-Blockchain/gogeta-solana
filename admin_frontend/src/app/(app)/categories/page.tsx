'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { AdminCategory } from '@/lib/types';
import { Badge, Button, Card, Field, MiniStat, Modal, Spinner, inputClass } from '@/components/ui';
import { ImageUpload } from '@/components/ImageUpload';

// Icon names the Flutter app knows how to render (see category_catalog.dart).
// Keep this list in sync with the app's iconByName map.
const ICON_OPTIONS = [
  'sports_basketball', 'currency_bitcoin', 'show_chart', 'movie', 'sports_esports',
  'how_to_vote', 'cloud', 'science', 'music_note', 'public', 'emoji_events', 'star',
  'bolt', 'trending_up', 'casino', 'language', 'pets', 'flight',
];
const ACCENT_OPTIONS = ['predictions', 'rewards', 'leaderboard', 'profile'];
// Mirrors the player app's own AccentFamily colours (see the Flutter/React
// portal's AppPalette) so this swatch previews what users actually see —
// deliberately NOT rebranded to the admin's blue.
const ACCENT_DOT: Record<string, string> = {
  predictions: 'bg-emerald-400',
  rewards: 'bg-amber-400',
  leaderboard: 'bg-violet-400',
  profile: 'bg-sky-400',
};

export default function CategoriesPage() {
  const [cats, setCats] = useState<AdminCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setCats(await api<AdminCategory[]>('/admin/categories'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function toggle(c: AdminCategory) {
    await api(`/admin/categories/${c.id}`, { method: 'PATCH', body: { active: !c.active } }).catch((e) =>
      alert(e instanceof Error ? e.message : 'Failed'),
    );
    load();
  }

  async function del(c: AdminCategory) {
    if (!confirm(`Delete category "${c.label}"?`)) return;
    try {
      await api(`/admin/categories/${c.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function move(index: number, dir: -1 | 1) {
    if (!cats) return;
    const j = index + dir;
    if (j < 0 || j >= cats.length) return;
    const arr = [...cats];
    [arr[index], arr[j]] = [arr[j], arr[index]];
    setCats(arr); // optimistic
    await api('/admin/categories/reorder', { method: 'POST', body: { ids: arr.map((c) => c.id) } }).catch(() => load());
  }

  if (error && !cats) return <p className="mt-4 text-sm text-rose-400">{error}</p>;
  if (!cats) {
    return (
      <div className="mt-10 flex justify-center">
        <Spinner />
      </div>
    );
  }

  const active = cats.filter((c) => c.active).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="mt-1 text-sm text-zinc-500">Manage the prediction categories shown in the app. Drag order via the arrows.</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ New category</Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <MiniStat label="Categories" value={cats.length} icon="◧" accent="azure" />
        <MiniStat label="Active" value={active} icon="●" accent="aura" />
        <MiniStat label="Hidden" value={cats.length - active} icon="○" accent="teal" />
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="w-16 px-4 py-3">Order</th>
              <th className="px-4 py-3">Category</th>
              <th className="w-28 px-4 py-3">Status</th>
              <th className="w-64 px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cats.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-zinc-500">No categories yet.</td>
              </tr>
            )}
            {cats.map((c, i) => (
              <tr key={c.id} className="border-b border-zinc-800/60 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="flex flex-col leading-none">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="text-zinc-500 transition hover:text-zinc-200 disabled:opacity-20"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === cats.length - 1}
                      className="text-zinc-500 transition hover:text-zinc-200 disabled:opacity-20"
                    >
                      ▼
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ACCENT_DOT[c.accent] ?? 'bg-zinc-500'}`} />
                    <span className="font-medium">{c.label}</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    <span className="font-mono">{c.key}</span> · {c.icon} · {c.accent}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge color={c.active ? 'green' : 'zinc'}>{c.active ? 'Active' : 'Hidden'}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="ghost" onClick={() => setEditing(c)}>Edit</Button>
                    <Button variant="ghost" onClick={() => toggle(c)}>{c.active ? 'Hide' : 'Show'}</Button>
                    <Button variant="danger" onClick={() => del(c)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>

      {(creating || editing) && (
        <CategoryModal
          category={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onDone={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function CategoryModal({
  category,
  onClose,
  onDone,
}: {
  category: AdminCategory | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const isEdit = !!category;
  const [key, setKey] = useState(category?.key ?? '');
  const [label, setLabel] = useState(category?.label ?? '');
  const [icon, setIcon] = useState(category?.icon ?? ICON_OPTIONS[0]);
  const [imageUrl, setImageUrl] = useState<string | null>(category?.imageUrl ?? null);
  const [iconImageUrl, setIconImageUrl] = useState<string | null>(category?.iconImageUrl ?? null);
  // Media uploads stay hidden until asked for (or when already set), so the
  // default flow nudges admins toward the app's consistent built-in icons.
  const [showMedia, setShowMedia] = useState(!!(category?.iconImageUrl || category?.imageUrl));
  const [accent, setAccent] = useState(category?.accent ?? 'predictions');
  const [active, setActive] = useState(category?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ key?: string; label?: string }>({});

  async function submit() {
    setFieldErrors({});
    if (!key.trim() || !label.trim()) {
      setFieldErrors({
        key: !key.trim() ? 'Key is required.' : undefined,
        label: !label.trim() ? 'Label is required.' : undefined,
      });
      setErr('Key and label are required.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (isEdit) {
        await api(`/admin/categories/${category!.id}`, {
          method: 'PATCH',
          body: { key: key.trim(), label: label.trim(), icon, imageUrl: imageUrl || null, iconImageUrl: iconImageUrl || null, accent, active },
        });
      } else {
        await api('/admin/categories', {
          method: 'POST',
          body: { key: key.trim().toLowerCase(), label: label.trim(), icon, imageUrl: imageUrl || undefined, iconImageUrl: iconImageUrl || undefined, accent },
        });
      }
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
      setBusy(false);
    }
  }

  return (
    <Modal title={isEdit ? `Edit ${category!.label}` : 'New category'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Key (lowercase, unique — used by the app)" error={fieldErrors.key}>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="music" className={inputClass} />
        </Field>
        <Field label="Label" error={fieldErrors.label}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Music" className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Icon">
            <select value={icon} onChange={(e) => setIcon(e.target.value)} className={inputClass}>
              {ICON_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>
          <Field label="Accent">
            <select value={accent} onChange={(e) => setAccent(e.target.value)} className={inputClass}>
              {ACCENT_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>
        </div>
        {!showMedia ? (
          <button
            type="button"
            onClick={() => setShowMedia(true)}
            className="text-sm text-cyan-300 hover:text-cyan-200"
          >
            + Custom images (optional)
          </button>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Custom icon — optional (SVG/PNG). Replaces the icon above beside the label in the app">
                <ImageUpload value={iconImageUrl} onChange={setIconImageUrl} label="Icon" />
              </Field>
              <Field label="Cover image — optional (photo). Chip background & fallback banner in the app">
                <ImageUpload value={imageUrl} onChange={setImageUrl} label="Cover" />
              </Field>
            </div>
            <p className="text-xs text-zinc-500">
              Both images are optional — leave them empty to keep the app&apos;s built-in icon set for
              a consistent look. Remove an uploaded image any time to revert.
            </p>
          </>
        )}
        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active (visible in app)
          </label>
        )}
        {err && <p className="text-sm text-rose-400">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  );
}
