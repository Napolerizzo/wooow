'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface CommitteeInfo {
  id: string;
  name: string;
  is_locked: boolean;
  conferences: { name: string } | null;
}

const NAV_ITEMS = [
  { label: 'MARKING', path: '' },
  { label: 'SETUP',   path: '/setup' },
  { label: 'SCORES',  path: '/scoreboard' },
  { label: 'COMPUTE', path: '/compute' },
  { label: 'EXPORT',  path: '/export' },
  { label: 'AUDIT',   path: '/audit' },
] as const;

export default function CommitteeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const committeeId = params?.id as string;

  const [committee, setCommittee] = useState<CommitteeInfo | null>(null);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // guests won't have a user but can still view via guest cookie

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();
      if (profile) setDisplayName(profile.display_name);

      const { data: committeeData } = await supabase
        .from('committees')
        .select('id, name, is_locked')
        .eq('id', committeeId)
        .single();

      if (committeeData) {
        setCommittee({
          id: committeeData.id,
          name: committeeData.name,
          is_locked: committeeData.is_locked,
          conferences: null, // loaded separately if needed
        });

        // Load conference name separately
        const { data: confData } = await supabase
          .from('conferences')
          .select('name')
          .eq('id', committeeId); // use a subquery approach below

        void confData; // will fetch via committee's conference_id
      }
    }
    if (committeeId) load();
  }, [committeeId]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/login');
  }

  const basePath = `/committee/${committeeId}`;

  return (
    <div style={styles.root}>
      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <header style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <Link href="/dashboard" style={styles.logo}>MARKZO</Link>
          {committee && (
            <>
              <span style={styles.separator}>/</span>
              <span style={styles.committeeName}>
                {committee.conferences?.name && (
                  <span style={styles.conferenceName}>{committee.conferences.name} · </span>
                )}
                {committee.name}
              </span>
              {committee.is_locked && (
                <span style={styles.lockedBadge} title="Committee is locked">
                  🔒
                </span>
              )}
            </>
          )}
        </div>

        <div style={styles.topBarRight}>
          {displayName && (
            <Link href="/profile" style={styles.userLink}>{displayName}</Link>
          )}
          <button onClick={handleSignOut} style={styles.signOutBtn}>
            SIGN OUT
          </button>
        </div>
      </header>

      {/* ── Sub Nav ───────────────────────────────────────────────────────── */}
      <nav style={styles.subNav} aria-label="Committee sections">
        {NAV_ITEMS.map((item) => {
          const href = `${basePath}${item.path}`;
          const isActive = item.path === ''
            ? pathname === basePath
            : pathname.startsWith(href);

          return (
            <Link
              key={item.label}
              href={href}
              style={{
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* ── Page Content ─────────────────────────────────────────────────── */}
      <main style={styles.main}>
        {children}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: 'var(--black)',
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '48px',
    background: '#0d0d0d',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.5rem',
    zIndex: 100,
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    overflow: 'hidden',
    minWidth: 0,
  },
  logo: {
    fontFamily: 'var(--font-wordmark)',
    fontSize: '18px',
    color: 'var(--off-white)',
    textDecoration: 'none',
    flexShrink: 0,
  },
  separator: {
    color: 'var(--muted)',
    fontSize: '0.9rem',
    flexShrink: 0,
  },
  committeeName: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: 'var(--off-white)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  conferenceName: {
    color: 'var(--secondary)',
  },
  lockedBadge: {
    fontSize: '12px',
    flexShrink: 0,
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexShrink: 0,
  },
  userLink: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--secondary)',
    textDecoration: 'none',
  },
  signOutBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.7rem',
    color: 'var(--muted)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    letterSpacing: '0.06em',
  },
  subNav: {
    position: 'fixed',
    top: '48px',
    left: 0,
    right: 0,
    height: '40px',
    background: 'var(--black)',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 1.5rem',
    gap: '0',
    zIndex: 99,
    overflowX: 'auto',
  },
  navItem: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.7rem',
    color: 'var(--secondary)',
    textDecoration: 'none',
    letterSpacing: '0.1em',
    padding: '0 1rem',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    borderBottom: '2px solid transparent',
    whiteSpace: 'nowrap',
  },
  navItemActive: {
    color: 'var(--off-white)',
    borderBottom: '2px solid var(--off-white)',
  },
  main: {
    paddingTop: '88px', // 48px topbar + 40px subnav
    flex: 1,
  },
};
