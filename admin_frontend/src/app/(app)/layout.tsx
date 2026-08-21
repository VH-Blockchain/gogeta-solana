'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { Button, Field, inputClass, Modal, Spinner } from '@/components/ui';
import { SolanaWalletProvider } from '@/components/SolanaWallet';

const NAV = [
  { href: '/', label: 'Dashboard', icon: '▦' },
  { href: '/users', label: 'Users', icon: '⊚' },
  { href: '/predictions', label: 'Predictions', icon: '◎' },
  { href: '/quiz', label: 'Quiz', icon: '◈' },
  { href: '/categories', label: 'Categories', icon: '◧' },
  { href: '/points', label: 'Points', icon: '$' },
  { href: '/withdrawals', label: 'Withdrawals', icon: '↥' },
  { href: '/leaderboard', label: 'Leaderboard', icon: '♛' },
  { href: '/lucky-winners', label: 'Lucky winners', icon: '✦' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    // Wraps the authenticated shell rather than the root layout: the login page
    // has no use for a wallet, and mounting the provider opens an RPC
    // connection. Sitting here also means a connection survives navigation
    // between admin pages instead of dropping on every route change.
    <SolanaWalletProvider>
    <div className="flex h-screen overflow-hidden p-3 gap-3">
      <aside className="panel flex w-60 shrink-0 flex-col overflow-y-auto rounded-2xl p-4">
        <div className="mb-7 flex items-center gap-2.5 px-2">
          {/* Bare mark, no chip: the artwork has its own silhouette and a
              transparent background, so a bordered box made it read as a
              favicon thumbnail rather than a logo. */}
          <Image
            src="/logo.png"
            alt=""
            width={40}
            height={40}
            className="h-9 w-9 shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(255,192,66,0.35)]"
            priority
          />
          <span className="font-semibold tracking-tight">GOGETA</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition ${
                  active ? 'bg-cyan-500/10 text-white ring-1 ring-cyan-500/30' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs ${
                    active
                      ? 'bg-gradient-to-br from-cyan-300 to-blue-600 text-zinc-950 shadow shadow-cyan-500/40'
                      : 'bg-white/5 text-zinc-400'
                  }`}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Change Password sits as its own labeled row (matching the nav
            items' icon-chip + label style) rather than a bare icon crammed
            next to Sign out below — two unlabeled icon buttons side by side
            invited mis-clicking Sign out by accident. */}
        <button
          onClick={() => setShowChangePassword(true)}
          className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-xs">🔑</span>
          Change Password
        </button>

        {/* User profile + Live status, relocated here from the old top
            header bar — that bar was otherwise near-empty (nothing sat left
            of these two widgets), so moving them into the sidebar footer
            lets `main` reclaim that vertical space instead of leaving it
            blank on every page. */}
        <div className="mt-2 flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-600 text-xs font-bold text-zinc-950">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-xs font-medium">{user.name}</div>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" /> Admin · Live
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              router.replace('/login');
            }}
            className="shrink-0 text-zinc-500 transition hover:text-zinc-200"
            title="Sign out"
          >
            ⏻
          </button>
        </div>
      </aside>

      <main className="panel flex-1 overflow-y-auto rounded-2xl p-8">{children}</main>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </div>
    </SolanaWalletProvider>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!currentPassword) return setError('Enter your current password.');
    if (newPassword.length < 6) return setError('New password must be at least 6 characters.');
    if (newPassword !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await api('/users/me/password', { method: 'PATCH', body: { currentPassword, newPassword } });
      setSuccess(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <Modal title="Change Password" onClose={onClose}>
        <p className="text-sm text-emerald-400">✓ Password updated successfully.</p>
        <Button className="mt-4 w-full" onClick={onClose}>Done</Button>
      </Modal>
    );
  }

  return (
    <Modal title="Change Password" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Current Password">
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} />
        </Field>
        <Field label="New Password">
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Confirm New Password">
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        </Field>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <Button className="w-full" disabled={busy} onClick={submit}>
          {busy ? 'Updating…' : 'Update Password'}
        </Button>
      </div>
    </Modal>
  );
}
