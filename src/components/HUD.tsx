'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useSaveStatus } from '@/lib/save-status';

const CYCLE_FONTS = [
  '"DM Mono", monospace',
  '"Courier New", monospace',
  '"Arial Black", sans-serif',
  '"Impact", sans-serif',
  '"Georgia", serif',
  '"Trebuchet MS", sans-serif',
  '"Lucida Console", monospace',
  '"Syne", sans-serif',
];

const COMMITTEE_NAV = [
  { label: 'MARKING',    path: '',         icon: '⊞' },
  { label: 'SETUP',      path: '/setup',   icon: '⊟' },
  { label: 'SCORES',     path: '/scoreboard', icon: '≡' },
  { label: 'COMPUTE',    path: '/compute', icon: '∑' },
  { label: 'EXPORT',     path: '/export',  icon: '↗' },
  { label: 'AUDIT',      path: '/audit',   icon: '◎' },
];

export default function HUD() {
  const pathname = usePathname();
  const router = useRouter();
  const { status: saveStatus } = useSaveStatus();

  const [displayName, setDisplayName]   = useState<string | null>(null);
  const [fontIdx, setFontIdx]           = useState(CYCLE_FONTS.length - 1);
  const [wordmarkOpacity, setWordmarkOpacity] = useState(1);
  const [hovering, setHovering]         = useState(false);
  const [menuOpen, setMenuOpen]         = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('display_name').eq('id', user.id).single()
        .then(({ data }) => { if (data) setDisplayName(data.display_name); });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) setDisplayName(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!hovering) {
      setFontIdx(CYCLE_FONTS.length - 1);
      setWordmarkOpacity(1);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setWordmarkOpacity(0);
      setTimeout(() => {
        setFontIdx(i => (i + 1) % CYCLE_FONTS.length);
        setWordmarkOpacity(1);
      }, 80);
    }, 180);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [hovering]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  const committeeMatch = pathname?.match(/^\/committee\/([^/]+)(\/.*)?$/);
  const committeeId    = committeeMatch?.[1] ?? null;
  const committeeSuffix = committeeMatch?.[2] ?? '';

  return (
    <>
      <div aria-label="HUD navigation" style={styles.root}>

        {/* TOP-LEFT — MARKZO wordmark */}
        <Link
          href="/"
          className="aberration-always-sm"
          style={{
            ...styles.wordmark,
            fontFamily: CYCLE_FONTS[fontIdx],
            opacity: wordmarkOpacity,
            transition: wordmarkOpacity === 0 ? 'none' : 'opacity 0.06s',
          }}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          aria-label="Markzo home"
        >
          MARKZO
        </Link>

        {/* SAVE DOT */}
        {committeeId && (
          <div
            aria-label={`Save status: ${saveStatus}`}
            style={{
              ...styles.saveDot,
              background: saveStatus === 'pending' ? '#e0a952'
                : saveStatus === 'saved'   ? '#52c97c'
                : saveStatus === 'error'   ? '#e05252'
                : '#252525',
              boxShadow: saveStatus === 'idle' ? 'none'
                : `0 0 6px ${saveStatus === 'pending' ? '#e0a952' : saveStatus === 'saved' ? '#52c97c' : '#e05252'}88`,
              transition: 'background 0.3s, box-shadow 0.3s',
            }}
          />
        )}

        {/* TOP-CENTER cross */}
        <div style={styles.crossWrap} aria-hidden="true">
          <CrossIcon />
        </div>

        {/* TOP-RIGHT — Desktop auth */}
        <div style={styles.topRight}>
          {displayName ? (
            <>
              <Link href="/profile" style={styles.userName}>{displayName}</Link>
              <button onClick={handleSignOut} style={styles.authBtn}>SIGN OUT</button>
            </>
          ) : (
            <Link href="/login" style={styles.authBtn}>SIGN IN</Link>
          )}
          {/* Mobile hamburger (only on committee pages) */}
          {committeeId && (
            <button
              onClick={() => setMenuOpen(v => !v)}
              style={styles.hamburger}
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          )}
        </div>

        {/* BOTTOM-LEFT — Attribution (desktop only) */}
        <div style={styles.bottomLeft}>
          <span style={styles.domain}>markzo.sandnco.lol</span>
          <span style={styles.copy}>©2025 sandnco</span>
        </div>

        {/* BOTTOM-RIGHT — Committee nav (desktop only, hidden on mobile) */}
        {committeeId && (
          <nav style={styles.committeeNav} aria-label="Committee navigation">
            {COMMITTEE_NAV.map(item => {
              const href = `/committee/${committeeId}${item.path}`;
              const isActive = item.path === ''
                ? committeeSuffix === '' || committeeSuffix === '/'
                : committeeSuffix.startsWith(item.path);
              return (
                <Link
                  key={item.label}
                  href={href}
                  style={{ ...styles.navItem, color: isActive ? '#f0ece4' : '#666666' }}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Mobile dropdown menu */}
        {menuOpen && committeeId && (
          <div style={styles.mobileMenu} role="menu">
            {COMMITTEE_NAV.map(item => {
              const href = `/committee/${committeeId}${item.path}`;
              const isActive = item.path === ''
                ? committeeSuffix === '' || committeeSuffix === '/'
                : committeeSuffix.startsWith(item.path);
              return (
                <Link
                  key={item.label}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    ...styles.mobileMenuItem,
                    color: isActive ? '#f0ece4' : '#888',
                    background: isActive ? 'rgba(240,236,228,0.05)' : 'transparent',
                  }}
                  role="menuitem"
                >
                  <span style={{ fontSize: '16px' }}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
            {displayName && (
              <button onClick={() => { handleSignOut(); setMenuOpen(false); }} style={styles.mobileSignOut}>
                SIGN OUT
              </button>
            )}
          </div>
        )}
      </div>

      {/* MOBILE BOTTOM NAV — only on committee pages */}
      {committeeId && (
        <nav className="mobile-bottom-nav" aria-label="Committee navigation mobile">
          {COMMITTEE_NAV.map(item => {
            const href = `/committee/${committeeId}${item.path}`;
            const isActive = item.path === ''
              ? committeeSuffix === '' || committeeSuffix === '/'
              : committeeSuffix.startsWith(item.path);
            return (
              <Link
                key={item.label}
                href={href}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 4px',
                  gap: '3px',
                  color: isActive ? '#f0ece4' : '#444444',
                  textDecoration: 'none',
                  minHeight: '52px',
                }}
                aria-current={isActive ? 'page' : undefined}
              >
                <span style={{ fontSize: '18px', lineHeight: 1 }}>{item.icon}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.06em' }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}

function CrossIcon() {
  const [fast, setFast] = useState(false);
  return (
    <svg
      width="28" height="28" viewBox="0 0 28 28" fill="none"
      style={{
        animation: fast
          ? 'hud-cross-rotate 1.5s linear infinite, hud-cross-scale 3s ease-in-out infinite alternate'
          : 'hud-cross-rotate 9s linear infinite, hud-cross-scale 3s ease-in-out infinite alternate',
        opacity: fast ? 1 : 0.65, cursor: 'default', transition: 'opacity 0.2s',
      }}
      onMouseEnter={() => setFast(true)}
      onMouseLeave={() => setFast(false)}
    >
      <line x1="14" y1="3"  x2="14" y2="25" stroke="#f0ece4" strokeWidth="1.5"/>
      <line x1="3"  y1="14" x2="25" y2="14" stroke="#f0ece4" strokeWidth="1.5"/>
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none',
  },
  wordmark: {
    position: 'absolute', top: '18px', left: '20px',
    fontSize: '15px', fontFamily: '"Syne", sans-serif', fontWeight: 800,
    color: '#f0ece4', textDecoration: 'none',
    letterSpacing: '0.04em', pointerEvents: 'auto', lineHeight: 1,
  },
  saveDot: {
    position: 'absolute', top: '22px', left: '82px',
    width: '6px', height: '6px', borderRadius: '50%', pointerEvents: 'none',
  },
  crossWrap: {
    position: 'absolute', top: '10px', left: '50%',
    transform: 'translateX(-50%)', width: '28px', height: '28px',
  },
  topRight: {
    position: 'absolute', top: '16px', right: '20px',
    display: 'flex', alignItems: 'center', gap: '16px', pointerEvents: 'auto',
  },
  userName: {
    fontFamily: 'var(--font-mono)', fontSize: '13px',
    color: '#888888', textDecoration: 'none',
  },
  authBtn: {
    fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#666666',
    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
    textDecoration: 'none', transition: 'color 0.15s',
    // Hide on mobile — handled via hamburger
    display: 'var(--auth-btn-display, block)' as string,
  },
  hamburger: {
    fontFamily: 'var(--font-mono)', fontSize: '18px', color: '#888',
    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
    display: 'none', // shown via media query in component
    lineHeight: 1, minHeight: '44px', minWidth: '44px',
    alignItems: 'center', justifyContent: 'center',
    // We show it via @media in globals — but inline style needs JS detection
    // Handled below with a different approach
  } as React.CSSProperties,
  bottomLeft: {
    position: 'absolute', bottom: '18px', left: '20px',
    display: 'flex', flexDirection: 'column', gap: '2px',
  },
  domain: {
    fontFamily: 'var(--font-mono)', fontSize: '11px',
    color: '#444', letterSpacing: '0.03em',
  },
  copy: {
    fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#333',
  },
  committeeNav: {
    position: 'absolute', bottom: '18px', right: '20px',
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
    gap: '6px', pointerEvents: 'auto',
  },
  navItem: {
    fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '15px',
    textDecoration: 'none', letterSpacing: '0.04em',
    transition: 'color 0.15s', lineHeight: 1,
  },
  mobileMenu: {
    position: 'absolute', top: '48px', right: '20px',
    background: '#0f0f0f', border: '1px solid #2a2a2a',
    display: 'flex', flexDirection: 'column',
    minWidth: '200px', zIndex: 300, pointerEvents: 'auto',
  },
  mobileMenuItem: {
    fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '14px',
    letterSpacing: '0.06em', padding: '14px 20px',
    textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px',
    borderBottom: '1px solid #1e1e1e', transition: 'color 0.15s',
    minHeight: '48px',
  },
  mobileSignOut: {
    fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.1em',
    color: '#555', background: 'none', border: 'none', cursor: 'pointer',
    padding: '14px 20px', textAlign: 'left', minHeight: '48px',
  },
};
