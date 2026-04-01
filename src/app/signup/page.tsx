'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          display_name: displayName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.');
        setLoading(false);
        return;
      }

      // Sign in client-side after successful signup
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError('Account created. Please sign in.');
        router.push('/login');
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main style={styles.main}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={styles.card}
      >
        <h1 style={styles.wordmark}>JOIN MARKZO</h1>
        <p style={styles.subtitle}>create your account</p>

        <form onSubmit={handleSubmit} style={styles.form} noValidate>
          <div style={styles.field}>
            <label htmlFor="display_name" style={styles.label}>
              DISPLAY NAME
            </label>
            <input
              id="display_name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={100}
              autoComplete="name"
              style={styles.input}
              aria-required="true"
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="email" style={styles.label}>
              EMAIL
            </label>
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
            <label htmlFor="password" style={styles.label}>
              PASSWORD
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              style={styles.input}
              aria-required="true"
            />
            <span style={styles.hint}>minimum 8 characters</span>
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
            style={{
              ...styles.button,
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? (
              <span className="loading-text">CREATING ACCOUNT</span>
            ) : (
              'CREATE ACCOUNT →'
            )}
          </button>
        </form>

        <p style={styles.loginLink}>
          already have an account?{' '}
          <Link href="/login" style={styles.link}>
            SIGN IN
          </Link>
        </p>
      </motion.div>

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
  card: {
    width: '100%',
    maxWidth: '420px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  wordmark: {
    fontFamily: 'var(--font-wordmark)',
    fontSize: '2.5rem',
    color: 'var(--off-white)',
    marginBottom: '0.25rem',
    letterSpacing: '-0.01em',
  },
  subtitle: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    color: 'var(--secondary)',
    marginBottom: '2.5rem',
    letterSpacing: '0.05em',
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
  hint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.7rem',
    color: 'var(--muted)',
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
    transition: 'background 0.15s, color 0.15s',
  },
  loginLink: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: 'var(--secondary)',
    marginTop: '1.5rem',
  },
  link: {
    color: 'var(--off-white)',
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
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
