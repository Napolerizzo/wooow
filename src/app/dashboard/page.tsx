'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
    conferences: { id: string; name: string } | null;
  } | null;
}

// Seeded deterministic card position/rotation from committee id
function cardStyle(id: string, index: number) {
  // simple hash from id chars
  let h = index * 2654435761;
  for (let i = 0; i < Math.min(id.length, 8); i++) h ^= id.charCodeAt(i) * (i + 1);
  h = Math.abs(h);
  const rot  = ((h % 200) - 100) / 10;         // -10 to +10 deg
  const offX = ((h >> 4) % 60) - 30;            // -30 to +30 px
  const offY = ((h >> 8) % 40) - 20;            // -20 to +20 px
  return { rot, offX, offY };
}

export default function DashboardPage() {
  const router = useRouter();
  const [committees, setCommittees] = useState<CommitteeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }

    const res = await fetch('/api/committee', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) setCommittees((await res.json()).committees ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div style={styles.root}>
      {/* Heading — top-left, dominant */}
      <motion.h1
        style={styles.heading}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        YOUR<br />COMMITTEES
      </motion.h1>

      {/* Cards scatter area */}
      <div style={styles.cardsArea}>
        {loading ? (
          <p className="loading-text" style={styles.loadingText}>LOADING</p>
        ) : committees.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            style={styles.emptyState}
          >
            <p style={styles.emptyHeading}>NOTHING HERE.</p>
            <p style={styles.emptySub}>your delegates are waiting.</p>
          </motion.div>
        ) : (
          committees.map((c, i) => {
            if (!c.committees) return null;
            const cm = c.committees;
            const { rot, offX, offY } = cardStyle(cm.id, i);
            const isHovered = hoveredId === cm.id;
            return (
              <motion.div
                key={cm.id}
                style={{
                  ...styles.card,
                  transform: isHovered
                    ? 'rotate(0deg) scale(1.04)'
                    : `rotate(${rot}deg) translate(${offX}px,${offY}px)`,
                  transition: 'transform 0.25s ease, border-color 0.2s',
                  borderColor: isHovered ? '#333' : '#1e1e1e',
                }}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                onMouseEnter={() => setHoveredId(cm.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => router.push(`/committee/${cm.id}`)}
                role="button"
                tabIndex={0}
                aria-label={`Open committee ${cm.name}`}
                onKeyDown={e => e.key === 'Enter' && router.push(`/committee/${cm.id}`)}
              >
                <p style={{
                  ...styles.cardName,
                  ...(isHovered ? {
                    textShadow: '-2px 0 rgba(255,0,0,0.4), 2px 0 rgba(0,255,255,0.4)',
                  } : {}),
                }}>
                  {cm.name}
                </p>
                {cm.conferences?.name && (
                  <p style={styles.cardConf}>{cm.conferences.name}</p>
                )}
                <div style={styles.cardMeta}>
                  <span style={styles.cardRole}>{c.role}</span>
                  {cm.is_locked && <span style={styles.cardLocked}>LOCKED</span>}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* New committee CTA */}
      {!loading && (
        <motion.button
          onClick={() => setShowModal(true)}
          style={styles.newBtn}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          whileHover={{ x: 4 }}
          aria-label="Create a new committee"
          className="link-underline"
        >
          + NEW COMMITTEE
        </motion.button>
      )}

      {/* New committee modal */}
      <AnimatePresence>
        {showModal && (
          <NewCommitteeModal
            onClose={() => setShowModal(false)}
            onCreated={(id) => { setShowModal(false); router.push(`/committee/${id}`); loadData(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    padding: '80px 48px 100px',
    position: 'relative',
    zIndex: 10,
  },
  heading: {
    fontFamily: 'var(--font-wordmark)',
    fontSize: 'clamp(48px, 7vw, 72px)',
    color: '#f0ece4',
    lineHeight: 0.95,
    marginBottom: '64px',
    letterSpacing: '-0.01em',
  },
  cardsArea: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    position: 'relative',
    minHeight: '200px',
  },
  loadingText: {
    fontFamily: 'var(--font-body)',
    fontSize: '14px',
    color: '#444',
    letterSpacing: '0.1em',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingTop: '16px',
  },
  emptyHeading: {
    fontFamily: 'var(--font-heading)',
    fontSize: '56px',
    color: '#222',
    lineHeight: 1,
  },
  emptySub: {
    fontFamily: 'var(--font-caveat)',
    fontSize: '18px',
    color: '#1e1e1e',
    fontStyle: 'italic',
  },
  card: {
    width: '200px',
    background: '#0d0d0d',
    border: '1px solid #1e1e1e',
    padding: '16px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    userSelect: 'none',
  },
  cardName: {
    fontFamily: 'var(--font-heading)',
    fontSize: '20px',
    color: '#f0ece4',
    lineHeight: 1.2,
    transition: 'text-shadow 0.2s',
  },
  cardConf: {
    fontFamily: 'var(--font-body)',
    fontSize: '12px',
    color: '#555',
  },
  cardMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '4px',
  },
  cardRole: {
    fontFamily: 'var(--font-body)',
    fontSize: '11px',
    color: '#444',
    letterSpacing: '0.04em',
  },
  cardLocked: {
    fontFamily: 'var(--font-body)',
    fontSize: '10px',
    color: '#333',
    letterSpacing: '0.08em',
    border: '1px solid #2a2a2a',
    padding: '1px 4px',
  },
  newBtn: {
    fontFamily: 'var(--font-heading)',
    fontSize: '18px',
    color: '#444',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    marginTop: '48px',
    letterSpacing: '0.04em',
    display: 'block',
    transition: 'color 0.2s',
  },
};
