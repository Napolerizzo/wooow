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
        body: JSON.stringify({ email, password, display_name: displayName }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); setLoading(false); return; }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) { setError('Account created. Please sign in.'); router.push('/login'); return; }
      router.push('/dashboard');
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main style={styles.root}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={styles.formWrap}
      >
        <h1 style={styles.heading}>START MARKING.</h1>
        <p style={styles.subheading}>create your account</p>

        <form onSubmit={handleSubmit} style={styles.form} noValidate>
          <div style={styles.field}>
            <label htmlFor="display_name" style={styles.label}>DISPLAY NAME</label>
            <input id="display_name" type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
              required maxLength={100} autoComplete="name" className="input-line" aria-required="true" />
          </div>
          <div style={styles.field}>
            <label htmlFor="email" style={styles.label}>EMAIL</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              required maxLength={255} autoComplete="email" className="input-line" aria-required="true" />
          </div>
          <div style={styles.field}>
            <label htmlFor="password" style={styles.label}>PASSWORD</label>
            <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
              required minLength={8} maxLength={128} autoComplete="new-password" className="input-line" aria-required="true" />
            <span style={styles.hint}>minimum 8 characters</span>
          </div>

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.error} role="alert">
              {error}
            </motion.p>
          )}

          <button type="submit" disabled={loading} className="btn-outline" style={{ marginTop: '8px' }}>
            {loading ? <span className="loading-text">CREATING ACCOUNT</span> : 'CREATE ACCOUNT →'}
          </button>
        </form>

        <p style={styles.loginLink}>
          already have an account?&nbsp;
          <Link href="/login" style={styles.loginLinkAnchor} className="link-underline">sign in →</Link>
        </p>
      </motion.div>
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
  formWrap: {
    width: '100%',
    maxWidth: '380px',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  heading: {
    fontFamily: 'var(--font-wordmark)',
    fontSize: 'clamp(40px, 6vw, 64px)',
    color: '#f0ece4',
    lineHeight: 1,
    marginBottom: '6px',
  },
  subheading: {
    fontFamily: 'var(--font-caveat)',
    fontSize: '16px',
    color: '#555',
    fontStyle: 'italic',
    marginBottom: '36px',
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
  loginLink: {
    fontFamily: 'var(--font-body)',
    fontSize: '13px',
    color: '#444',
    marginTop: '28px',
  },
  loginLinkAnchor: {
    color: '#666',
  },
};
