'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import NewCommitteeModal from '@/components/dashboard/NewCommitteeModal';

interface CommitteeCard {
  committee_id: string;
  role: string;
  is_owner: boolean;
  committees: {
    id: string;
    name: string;
    is_locked: boolean;
    created_at: string;
    conferences: {
      id: string;
      name: string;
    } | null;
  } | null;
}

// Deterministic card positions — seeded by index so they don't jump on re-render
function getCardTransform(index: number) {
  const rotations = [-3, 2, -1, 4, -2, 3, -4, 1, -2, 3];
  const offsetsX = [-2, 1, -3, 2, -1, 3, -2, 1, -3, 2];
  const offsetsY = [1, -2, 3, -1, 2, -3, 1, -2, 3, -1];
  const rot = rotations[index % rotations.length];
  const ox = offsetsX[index % offsetsX.length];
  const oy = offsetsY[index % offsetsY.length];
  return { rot, ox, oy };
}

export default function DashboardPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [committees, setCommittees] = useState<CommitteeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    // Load profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single();

    if (profile) setDisplayName(profile.display_name);

    // Load committees via API (server validates auth)
    const res = await fetch('/api/committee');
    if (res.ok) {
      const data = await res.json();
      setCommittees(data.committees ?? []);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div style={styles.root}>
      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <header style={styles.topBar}>
        <Link href="/" style={styles.topBarLogo}>MARKZO</Link>
        <div style={styles.topBarRight}>
          <Link href="/profile" style={styles.topBarUser}>{displayName}</Link>
          <button onClick={handleSignOut} style={styles.signOut}>
            SIGN OUT
          </button>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main style={styles.main}>
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={styles.headingRow}
        >
          <h1 style={styles.heading}>YOUR COMMITTEES</h1>
          <button
            onClick={() => setShowModal(true)}
            style={styles.newButton}
            aria-label="Create a new committee"
          >
            + NEW COMMITTEE
          </button>
        </motion.div>

        {/* Committee Cards */}
        {loading ? (
          <p style={styles.loadingText} className="loading-text">LOADING</p>
        ) : committees.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={styles.emptyState}
          >
            <p style={styles.emptyText}>NO COMMITTEES YET.</p>
            <p style={styles.emptySubText}>START ONE.</p>
            <button onClick={() => setShowModal(true)} style={styles.emptyButton}>
              + NEW COMMITTEE
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            style={styles.cardsCanvas}
          >
            {committees.map((item, i) => {
              const committee = item.committees;
              if (!committee) return null;
              const { rot, ox, oy } = getCardTransform(i);
              const isHovered = hoveredId === committee.id;

              return (
                <motion.div
                  key={committee.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  style={{
                    ...styles.card,
                    transform: isHovered
                      ? 'rotate(0deg) scale(1.03)'
                      : `rotate(${rot}deg) translate(${ox}px, ${oy}px)`,
                    transition: 'transform 0.25s ease, border-color 0.15s',
                    borderColor: isHovered ? 'var(--border-emphasis)' : 'var(--border-subtle)',
                  }}
                  onMouseEnter={() => setHoveredId(committee.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => router.push(`/committee/${committee.id}`)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open committee ${committee.name}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      router.push(`/committee/${committee.id}`);
                    }
                  }}
                >
                  {/* Committee name */}
                  <p
                    style={{
                      ...styles.cardName,
                      ...(isHovered ? chromaStyle : {}),
                    }}
                  >
                    {committee.name}
                  </p>

                  {/* Conference name */}
                  {committee.conferences && (
                    <p style={styles.cardConference}>
                      {committee.conferences.name}
                    </p>
                  )}

                  {/* Role */}
                  <p style={styles.cardRole}>{item.role}</p>

                  {/* Lock status */}
                  {committee.is_locked && (
                    <div style={styles.lockBadge} aria-label="Committee is locked">
                      <LockIcon />
                      <span>LOCKED</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </main>

      {/* ── New Committee Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <NewCommitteeModal
            onClose={() => setShowModal(false)}
            onCreated={() => {
              setShowModal(false);
              loadData();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// CSS-drawn lock icon
function LockIcon() {
  return (
    <svg
      width="10"
      height="12"
      viewBox="0 0 10 12"
      fill="none"
      aria-hidden="true"
      style={{ display: 'inline-block' }}
    >
      <rect x="1" y="5" width="8" height="7" stroke="var(--secondary)" strokeWidth="1" />
      <path
        d="M3 5V3.5C3 2.12 3.9 1 5 1C6.1 1 7 2.12 7 3.5V5"
        stroke="var(--secondary)"
        strokeWidth="1"
      />
    </svg>
  );
}

const chromaStyle: React.CSSProperties = {
  textShadow: '-2px 0 rgba(255,0,0,0.4), 2px 0 rgba(0,255,255,0.4)',
};

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
  topBarLogo: {
    fontFamily: 'var(--font-wordmark)',
    fontSize: '20px',
    color: 'var(--off-white)',
    textDecoration: 'none',
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
  },
  topBarUser: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: 'var(--secondary)',
    textDecoration: 'none',
    letterSpacing: '0.04em',
  },
  signOut: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--muted)',
    background: 'none',
    border: 'none',
    letterSpacing: '0.06em',
    cursor: 'pointer',
  },
  main: {
    paddingTop: '80px',
    padding: '80px 1.5rem 3rem',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
  },
  headingRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: '2.5rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  heading: {
    fontFamily: 'var(--font-wordmark)',
    fontSize: 'clamp(1.8rem, 4vw, 3rem)',
    color: 'var(--off-white)',
  },
  newButton: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1rem',
    color: 'var(--off-white)',
    background: 'transparent',
    border: '1px solid var(--border-emphasis)',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    letterSpacing: '0.04em',
    flexShrink: 0,
  },
  loadingText: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: 'var(--secondary)',
    letterSpacing: '0.1em',
    marginTop: '3rem',
    textAlign: 'center',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '8rem',
    gap: '0.25rem',
  },
  emptyText: {
    fontFamily: 'var(--font-heading)',
    fontSize: '2rem',
    color: 'var(--secondary)',
  },
  emptySubText: {
    fontFamily: 'var(--font-heading)',
    fontSize: '2rem',
    color: 'var(--muted)',
    marginBottom: '1.5rem',
  },
  emptyButton: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1rem',
    color: 'var(--off-white)',
    background: 'transparent',
    border: '1px solid var(--border-emphasis)',
    padding: '0.6rem 1.2rem',
    cursor: 'pointer',
  },
  cardsCanvas: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1.5rem',
    padding: '1rem 0',
  },
  card: {
    width: '220px',
    minHeight: '160px',
    background: '#0d0d0d',
    border: '1px solid var(--border-subtle)',
    padding: '1.25rem',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    position: 'relative',
  },
  cardName: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.2rem',
    color: 'var(--off-white)',
    lineHeight: 1.2,
    wordBreak: 'break-word',
  },
  cardConference: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--secondary)',
    letterSpacing: '0.04em',
  },
  cardRole: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.7rem',
    color: 'var(--muted)',
    letterSpacing: '0.06em',
    marginTop: 'auto',
  },
  lockBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontFamily: 'var(--font-body)',
    fontSize: '0.65rem',
    color: 'var(--secondary)',
    letterSpacing: '0.08em',
    position: 'absolute',
    top: '0.75rem',
    right: '0.75rem',
  },
};
