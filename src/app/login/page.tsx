'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

type Mode = 'choose' | 'signin' | 'guest';

/** Reads search params inside a Suspense boundary (Next.js App Router requirement). */
function SessionExpiredDetector({
  onExpired,
  onGuestMode,
}: {
  onExpired: () => void;
  onGuestMode: () => void;
}) {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams?.get('expired') === '1') {
      onExpired();
      if (searchParams.get('redirect')?.startsWith('/committee/')) {
        onGuestMode();
      }
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
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      // Never reveal whether email exists
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

    // Normalize access code to uppercase
    const code = accessCode.trim().toUpperCase();

    try {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_code: code, guest_name: guestName.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Invalid access code.');
        setLoading(false);
        return;
      }

      router.push(`/committee/${data.committee_id}`);
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main style={styles.main}>
      {/* Reads ?expired=1 from URL inside a Suspense boundary */}
      <Suspense fallback={null}>
        <SessionExpiredDetector
          onExpired={() => setSessionExpired(true)}
          onGuestMode={() => setMode('guest')}
        />
      </Suspense>

      {/* Session expired banner */}
      <AnimatePresence>
        {sessionExpired && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={styles.expiredBanner}
            role="alert"
          >
            <span style={styles.expiredIcon}>⚠</span>
            <span>SESSION EXPIRED — please enter the access code again to rejoin</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {mode === 'choose' && (
          <motion.div
            key="choose"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            style={styles.chooseContainer}
          >
            <p style={styles.wordmark}>MARKZO</p>

            <nav style={styles.nav} aria-label="Login options">
              <motion.button
                onClick={() => setMode('signin')}
                style={styles.navItem}
                whileHover={{ x: 6 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                aria-label="Sign in with email and password"
              >
                SIGN IN
              </motion.button>

              <motion.button
                onClick={() => setMode('guest')}
                style={styles.navItem}
                whileHover={{ x: 6 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                aria-label="Enter a committee as a guest with access code"
              >
                ENTER AS GUEST
              </motion.button>
            </nav>

            <p style={styles.signupLink}>
              no account?{' '}
              <Link href="/signup" style={styles.link}>
                JOIN MARKZO
              </Link>
            </p>
          </motion.div>
        )}

        {mode === 'signin' && (
          <motion.div
            key="signin"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.35 }}
            style={styles.formContainer}
          >
            <button
              onClick={() => { setMode('choose'); setError(''); }}
              style={styles.back}
              aria-label="Go back"
            >
              ← BACK
            </button>

            <h1 style={styles.heading}>SIGN IN</h1>

            <form onSubmit={handleSignIn} style={styles.form} noValidate>
              <div style={styles.field}>
                <label htmlFor="email" style={styles.label}>EMAIL</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={255}
                  autoComplete="email"
                  style={styles.input}
                  aria-required="true"
                />
              </div>

              <div style={styles.field}>
                <label htmlFor="password" style={styles.label}>PASSWORD</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  maxLength={128}
                  autoComplete="current-password"
                  style={styles.input}
                  aria-required="true"
                />
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={styles.error}
                  role="alert"
                >
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{ ...styles.button, opacity: loading ? 0.5 : 1 }}
              >
                {loading ? <span className="loading-text">SIGNING IN</span> : 'SIGN IN →'}
              </button>
            </form>
          </motion.div>
        )}

        {mode === 'guest' && (
          <motion.div
            key="guest"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.35 }}
            style={styles.formContainer}
          >
            <button
              onClick={() => { setMode('choose'); setError(''); }}
              style={styles.back}
              aria-label="Go back"
            >
              ← BACK
            </button>

            <h1 style={styles.heading}>ENTER AS GUEST</h1>
            <p style={styles.hint}>you need a committee access code from your chair</p>

            <form onSubmit={handleGuestAccess} style={styles.form} noValidate>
              <div style={styles.field}>
                <label htmlFor="guest_name" style={styles.label}>YOUR NAME</label>
                <input
                  id="guest_name"
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  required
                  maxLength={100}
                  autoComplete="name"
                  style={styles.input}
                  aria-required="true"
                />
              </div>

              <div style={styles.field}>
                <label htmlFor="access_code" style={styles.label}>ACCESS CODE</label>
                <input
                  id="access_code"
                  type="text"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  required
                  maxLength={8}
                  autoComplete="off"
                  placeholder="8-CHARACTER CODE"
                  style={{ ...styles.input, letterSpacing: '0.2em', textTransform: 'uppercase' }}
                  aria-required="true"
                  aria-describedby="code-hint"
                />
                <span id="code-hint" style={styles.hintText}>
                  8 characters, uppercase letters and numbers
                </span>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={styles.error}
                  role="alert"
                >
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{ ...styles.button, opacity: loading ? 0.5 : 1 }}
              >
                {loading ? <span className="loading-text">VERIFYING</span> : 'ENTER COMMITTEE →'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <footer style={styles.footer}>
        <span>markzo.sandnco.lol</span>
        <br />
        <span>©2025 sandnco. don&apos;t steal our shkt.</span>
      </footer>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    background: 'var(--black)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  chooseContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.5rem',
    width: '100%',
    maxWidth: '420px',
  },
  wordmark: {
    fontFamily: 'var(--font-wordmark)',
    fontSize: '1.5rem',
    color: 'var(--secondary)',
    marginBottom: '1.5rem',
    letterSpacing: '0.05em',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  navItem: {
    fontFamily: 'var(--font-heading)',
    fontSize: '2.5rem',
    color: 'var(--off-white)',
    background: 'none',
    border: 'none',
    padding: '0.1rem 0',
    textAlign: 'left',
    lineHeight: 1.2,
    letterSpacing: '0.02em',
  },
  formContainer: {
    width: '100%',
    maxWidth: '420px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  back: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--secondary)',
    background: 'none',
    border: 'none',
    padding: '0',
    marginBottom: '1.5rem',
    letterSpacing: '0.05em',
    textAlign: 'left',
  },
  heading: {
    fontFamily: 'var(--font-heading)',
    fontSize: '2rem',
    color: 'var(--off-white)',
    marginBottom: '0.25rem',
  },
  hint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: 'var(--secondary)',
    marginBottom: '1.5rem',
  },
  hintText: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.7rem',
    color: 'var(--muted)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  label: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--secondary)',
    letterSpacing: '0.1em',
  },
  input: {
    background: 'transparent',
    border: '1px solid var(--border-emphasis)',
    borderRadius: '0',
    padding: '0.6rem 0.75rem',
    color: 'var(--off-white)',
    fontSize: '0.95rem',
    fontFamily: 'var(--font-body)',
    width: '100%',
  },
  error: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: 'var(--off-white)',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-emphasis)',
    padding: '0.6rem 0.75rem',
  },
  button: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    letterSpacing: '0.08em',
    color: 'var(--off-white)',
    background: 'transparent',
    border: '1px solid var(--off-white)',
    padding: '0.75rem 1.5rem',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  signupLink: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: 'var(--secondary)',
    marginTop: '2rem',
  },
  link: {
    color: 'var(--off-white)',
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
  },
  expiredBanner: {
    position: 'fixed',
    top: '1rem',
    left: '50%',
    transform: 'translateX(-50%)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    color: 'var(--secondary)',
    background: 'rgba(8,8,8,0.95)',
    border: '1px solid var(--border-emphasis)',
    padding: '0.6rem 1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    whiteSpace: 'nowrap',
    letterSpacing: '0.04em',
    zIndex: 200,
  },
  expiredIcon: {
    color: 'var(--secondary)',
    fontSize: '0.8rem',
  },
  footer: {
    position: 'fixed',
    bottom: '1.5rem',
    left: '50%',
    transform: 'translateX(-50%)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.65rem',
    color: 'var(--muted)',
    textAlign: 'center',
    lineHeight: '1.6',
    whiteSpace: 'nowrap',
  },
};
