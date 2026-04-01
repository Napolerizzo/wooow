'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

export default function ProfilePage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [currentName, setCurrentName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('id', user.id)
        .single();

      if (profile) {
        setDisplayName(profile.display_name);
        setCurrentName(profile.display_name);
        setEmail(profile.email);
      }
      setLoading(false);
    }
    loadProfile();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    setError('');

    const trimmed = displayName.trim();
    if (!trimmed || trimmed.length > 100) {
      setError('Display name must be 1–100 characters.');
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', user.id);

    if (updateError) {
      setError('Failed to update. Please try again.');
    } else {
      setCurrentName(trimmed);
      setMessage('SAVED.');
    }
    setSaving(false);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/login');
  }

  if (loading) {
    return (
      <main style={styles.main}>
        <p style={styles.loading} className="loading-text">LOADING</p>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={styles.container}
      >
        <h1 style={styles.heading}>PROFILE</h1>
        <p style={styles.email}>{email}</p>

        <form onSubmit={handleSave} style={styles.form} noValidate>
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
              style={styles.input}
              aria-required="true"
            />
          </div>

          {error && (
            <p style={styles.error} role="alert">{error}</p>
          )}
          {message && (
            <p style={styles.success} role="status">{message}</p>
          )}

          <button
            type="submit"
            disabled={saving || displayName.trim() === currentName}
            style={{
              ...styles.button,
              opacity: (saving || displayName.trim() === currentName) ? 0.4 : 1,
            }}
          >
            {saving ? <span className="loading-text">SAVING</span> : 'SAVE CHANGES'}
          </button>
        </form>

        <div style={styles.divider} />

        <button onClick={handleSignOut} style={styles.signOut}>
          SIGN OUT
        </button>
      </motion.div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  loading: {
    fontFamily: 'var(--font-body)',
    color: 'var(--secondary)',
    fontSize: '0.9rem',
    letterSpacing: '0.1em',
  },
  container: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  heading: {
    fontFamily: 'var(--font-heading)',
    fontSize: '2rem',
    color: 'var(--off-white)',
    marginBottom: '0.25rem',
  },
  email: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: 'var(--secondary)',
    marginBottom: '2rem',
    letterSpacing: '0.03em',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
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
    padding: '0.5rem 0.75rem',
  },
  success: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: 'var(--secondary)',
    letterSpacing: '0.1em',
  },
  button: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    letterSpacing: '0.08em',
    color: 'var(--off-white)',
    background: 'transparent',
    border: '1px solid var(--off-white)',
    padding: '0.7rem 1.25rem',
    cursor: 'pointer',
  },
  divider: {
    borderTop: '1px solid var(--border-subtle)',
    margin: '2rem 0',
  },
  signOut: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    letterSpacing: '0.08em',
    color: 'var(--secondary)',
    background: 'transparent',
    border: '1px solid var(--border-subtle)',
    padding: '0.6rem 1rem',
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
};
