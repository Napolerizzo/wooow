'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

type Mode = 'choose' | 'signin' | 'guest';

function SessionExpiredDetector({ onExpired, onGuestMode }: { onExpired: () => void; onGuestMode: () => void; }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams?.get('expired') === '1') {
      onExpired();
      if (searchParams.get('redirect')?.startsWith('/committee/')) onGuestMode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('choose');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [guestName, setGuestName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError('Invalid credentials.');
      setLoading(false);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    router.push(params.get('redirect') ?? '/dashboard');
  }

  async function handleGuestAccess(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_code: accessCode.trim().toUpperCase(), guest_name: guestName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Invalid access code.'); setLoading(false); return; }
      router.push(`/committee/${data.committee_id}`);
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main style={styles.root}>
      <Suspense fallback={null}>
        <SessionExpiredDetector onExpired={() => setSessionExpired(true)} onGuestMode={() => setMode('guest')} />
      </Suspense>

      {/* Session expired banner */}
      <AnimatePresence>
        {sessionExpired && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={styles.expiredBanner} role="alert"
          >
            SESSION EXPIRED — enter your access code to rejoin
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {/* CHOOSE MODE */}
        {mode === 'choose' && (
          <motion.div
            key="choose"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
            style={styles.chooseWrap}
          >
            <nav style={styles.chooseNav} aria-label="Login options">
              {[
                { label: 'SIGN IN', onClick: () => setMode('signin') },
                { label: 'ENTER AS GUEST', onClick: () => setMode('guest') },
              ].map(({ label, onClick }) => (
                <motion.button
                  key={label}
                  onClick={onClick}
                  style={styles.chooseBtn}
                  whileHover={{ x: 8 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  {label}
                </motion.button>
              ))}
            </nav>
            <p style={styles.chooseSubtext}>
              no account?&nbsp;
              <Link href="/signup" style={styles.subtextLink} className="link-underline">start one →</Link>
            </p>
          </motion.div>
        )}

        {/* SIGN IN */}
        {mode === 'signin' && (
          <motion.div
            key="signin"
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3 }}
            style={styles.formWrap}
          >
            <button onClick={() => { setMode('choose'); setError(''); }} style={styles.back}>← BACK</button>
            <h1 style={styles.heading}>SIGN IN</h1>
            <form onSubmit={handleSignIn} style={styles.form} noValidate>
              <div style={styles.field}>
                <label htmlFor="email" style={styles.label}>EMAIL</label>
                <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required maxLength={255} autoComplete="email" className="input-line" aria-required="true" />
              </div>
              <div style={styles.field}>
                <label htmlFor="password" style={styles.label}>PASSWORD</label>
                <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required maxLength={128} autoComplete="current-password" className="input-line" aria-required="true" />
              </div>
              {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.error} role="alert">{error}</motion.p>}
              <button type="submit" disabled={loading} className="btn-outline" style={{ marginTop: '8px' }}>
                {loading ? <span className="loading-text">SIGNING IN</span> : 'SIGN IN →'}
              </button>
            </form>
          </motion.div>
        )}

        {/* GUEST */}
        {mode === 'guest' && (
          <motion.div
            key="guest"
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3 }}
            style={styles.formWrap}
          >
            <button onClick={() => { setMode('choose'); setError(''); }} style={styles.back}>← BACK</button>
            <h1 style={styles.heading}>ENTER AS GUEST</h1>
            <p style={styles.subheading}>you need an access code from your chair.</p>
            <form onSubmit={handleGuestAccess} style={styles.form} noValidate>
              <div style={styles.field}>
                <label htmlFor="guest_name" style={styles.label}>YOUR NAME</label>
                <input id="guest_name" type="text" value={guestName} onChange={e => setGuestName(e.target.value)}
                  required maxLength={100} autoComplete="name" className="input-line" aria-required="true" />
              </div>
              <div style={styles.field}>
                <label htmlFor="access_code" style={styles.label}>ACCESS CODE</label>
                <input id="access_code" type="text" value={accessCode}
                  onChange={e => setAccessCode(e.target.value.toUpperCase())}
                  required maxLength={8} autoComplete="off" placeholder="8-CHARACTER CODE"
                  className="input-line" style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}
                  aria-required="true" aria-describedby="code-hint" />
                <span id="code-hint" style={styles.hint}>8 uppercase letters and numbers</span>
              </div>
              {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.error} role="alert">{error}</motion.p>}
              <button type="submit" disabled={loading} className="btn-outline" style={{ marginTop: '8px' }}>
                {loading ? <span className="loading-text">VERIFYING</span> : 'ENTER COMMITTEE →'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    position: 'relative',
    zIndex: 10,
  },
  expiredBanner: {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontFamily: 'var(--font-body)',
    fontSize: '12px',
    color: '#888',
    background: 'rgba(8,8,8,0.95)',
    border: '1px solid #2a2a2a',
    padding: '8px 16px',
    whiteSpace: 'nowrap',
    letterSpacing: '0.06em',
    zIndex: 210,
  },
  chooseWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '8px',
    width: '100%',
    maxWidth: '440px',
  },
  chooseNav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '24px',
  },
  chooseBtn: {
    fontFamily: 'var(--font-heading)',
    fontSize: 'clamp(32px, 5vw, 52px)',
    color: '#f0ece4',
    background: 'none',
    border: 'none',
    padding: '2px 0',
    textAlign: 'left',
    lineHeight: 1.15,
    letterSpacing: '0.01em',
  },
  chooseSubtext: {
    fontFamily: 'var(--font-body)',
    fontSize: '13px',
    color: '#444',
  },
  subtextLink: {
    color: '#666',
  },
  formWrap: {
    width: '100%',
    maxWidth: '380px',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  back: {
    fontFamily: 'var(--font-body)',
    fontSize: '13px',
    color: '#444',
    background: 'none',
    border: 'none',
    padding: 0,
    marginBottom: '28px',
    letterSpacing: '0.05em',
    textAlign: 'left' as const,
    cursor: 'pointer',
    transition: 'color 0.15s',
  },
  heading: {
    fontFamily: 'var(--font-wordmark)',
    fontSize: 'clamp(36px, 5vw, 52px)',
    color: '#f0ece4',
    marginBottom: '8px',
    lineHeight: 1,
  },
  subheading: {
    fontFamily: 'var(--font-mono)',
    fontSize: '16px',
    color: '#555',
    fontStyle: 'italic',
    marginBottom: '28px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontFamily: 'var(--font-body)',
    fontSize: '11px',
    color: '#555',
    letterSpacing: '0.12em',
  },
  hint: {
    fontFamily: 'var(--font-body)',
    fontSize: '11px',
    color: '#333',
  },
  error: {
    fontFamily: 'var(--font-body)',
    fontSize: '13px',
    color: '#888',
    borderLeft: '2px solid #2a2a2a',
    paddingLeft: '10px',
  },
};
