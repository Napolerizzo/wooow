'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface DelegateRanking {
  rank: number;
  delegate_id: string;
  name: string;
  country: string | null;
  total_score: number;
  award_tier: string | null;
  breakdown: { field_id: string; field_name: string; score: number }[];
}

interface AwardAssignment {
  delegate_id: string;
  award_tier: string;
  rank: number;
}

export default function ComputePage() {
  const params = useParams();
  const router = useRouter();
  const committeeId = params?.id as string;

  const [phase, setPhase] = useState<'idle' | 'glitching' | 'results' | 'locked'>('idle');
  const [rankings, setRankings] = useState<DelegateRanking[]>([]);
  const [awardAssignments, setAwardAssignments] = useState<AwardAssignment[]>([]);
  const [error, setError] = useState('');
  const [locking, setLocking] = useState(false);

  const handleCompute = useCallback(async () => {
    setError('');
    setPhase('glitching');

    // Glitch animation for 0.6s
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/committee/${committeeId}/compute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'compute' }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? 'Computation failed');
          setPhase('idle');
          return;
        }

        setRankings(data.rankings ?? []);
        setAwardAssignments(data.award_assignments ?? []);
        setPhase('results');
      } catch {
        setError('Network error. Please try again.');
        setPhase('idle');
      }
    }, 700);
  }, [committeeId]);

  async function handleLock() {
    setLocking(true);
    setError('');

    const res = await fetch(`/api/committee/${committeeId}/compute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lock', award_assignments: awardAssignments }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? 'Failed to lock');
      setLocking(false);
      return;
    }

    setPhase('locked');
    setLocking(false);
  }

  return (
    <div style={styles.root}>
      <AnimatePresence mode="wait">
        {phase === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={styles.center}
          >
            <h1 style={styles.heading}>COMPUTE FINAL MARKSHEET</h1>
            <p style={styles.subheading}>
              This will calculate rankings based on all marks entered.
              <br />
              You can review the results before locking.
            </p>
            {error && <p style={styles.error} role="alert">{error}</p>}
            <button onClick={handleCompute} style={styles.computeBtn}>
              COMPUTE →
            </button>
          </motion.div>
        )}

        {phase === 'glitching' && (
          <motion.div
            key="glitch"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={styles.glitchScreen}
          >
            <div className="glitch-anim" style={styles.glitchContent}>
              <p style={styles.glitchText}>COMPUTING</p>
            </div>
          </motion.div>
        )}

        {(phase === 'results' || phase === 'locked') && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={styles.resultsWrap}
          >
            <div style={styles.resultsHeader}>
              <h1 style={styles.resultsTitle}>
                {phase === 'locked' ? 'MARKSHEET LOCKED ✓' : 'COMPUTED RESULTS'}
              </h1>
              {phase === 'locked' && (
                <p style={styles.lockedNote}>
                  The committee is now locked. Post-lock edits will be logged.
                </p>
              )}
            </div>

            {/* Rankings table */}
            <div style={styles.tableWrap}>
              <table style={styles.table} aria-label="Final rankings">
                <thead>
                  <tr>
                    <th style={styles.th}>RANK</th>
                    <th style={styles.th}>NAME</th>
                    <th style={styles.th}>SCORE</th>
                    <th style={styles.th}>AWARD</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((r, i) => (
                    <motion.tr
                      key={r.delegate_id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.35 }}
                      style={{
                        ...styles.tr,
                        background: r.award_tier ? 'rgba(240,236,228,0.03)' : 'transparent',
                      }}
                    >
                      <td style={styles.td}>
                        <span style={styles.rankCell}>{r.rank}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.nameCell}>{r.name}</span>
                        {r.country && <span style={styles.countryCell}> · {r.country}</span>}
                      </td>
                      <td style={styles.td}>
                        <span style={styles.scoreCell}>{r.total_score.toFixed(1)}</span>
                      </td>
                      <td style={styles.td}>
                        {r.award_tier && (
                          <span style={styles.awardBadge}>{r.award_tier}</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            {phase === 'results' && (
              <div style={styles.actions}>
                <button
                  onClick={() => setPhase('idle')}
                  style={styles.editBtn}
                  aria-label="Go back and edit marks"
                >
                  ← EDIT BEFORE LOCKING
                </button>

                <button
                  onClick={handleLock}
                  disabled={locking}
                  style={{ ...styles.lockBtn, opacity: locking ? 0.5 : 1 }}
                  aria-label="Lock the marksheet permanently"
                >
                  {locking
                    ? <span className="loading-text">LOCKING</span>
                    : 'LOCK MARKSHEET →'
                  }
                </button>
              </div>
            )}

            {phase === 'locked' && (
              <div style={styles.actions}>
                <button
                  onClick={() => router.push(`/committee/${committeeId}/export`)}
                  style={styles.exportBtn}
                >
                  EXPORT PDFs →
                </button>
                <button
                  onClick={() => router.push(`/committee/${committeeId}/marking`)}
                  style={styles.editBtn}
                >
                  VIEW MARKS
                </button>
              </div>
            )}

            {error && <p style={styles.error} role="alert">{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
  },
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.5rem',
    padding: '3rem 2rem',
    textAlign: 'center',
  },
  heading: {
    fontFamily: 'var(--font-wordmark)',
    fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
    color: 'var(--off-white)',
  },
  subheading: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    color: 'var(--secondary)',
    lineHeight: 1.6,
    maxWidth: '480px',
  },
  computeBtn: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.5rem',
    color: 'var(--off-white)',
    background: 'transparent',
    border: '1px solid var(--off-white)',
    padding: '0.75rem 2.5rem',
    cursor: 'pointer',
    letterSpacing: '0.05em',
    marginTop: '1rem',
  },
  glitchScreen: {
    position: 'fixed',
    inset: 0,
    background: 'var(--black)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 500,
  },
  glitchContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glitchText: {
    fontFamily: 'var(--font-wordmark)',
    fontSize: 'clamp(2rem, 6vw, 5rem)',
    color: 'var(--off-white)',
    letterSpacing: '0.1em',
  },
  resultsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    padding: '2rem 1.5rem',
    maxWidth: '900px',
    margin: '0 auto',
    width: '100%',
  },
  resultsHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  resultsTitle: {
    fontFamily: 'var(--font-wordmark)',
    fontSize: 'clamp(1.4rem, 3vw, 2rem)',
    color: 'var(--off-white)',
  },
  lockedNote: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: 'var(--secondary)',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.65rem',
    color: 'var(--muted)',
    letterSpacing: '0.1em',
    padding: '0.5rem 0.75rem',
    borderBottom: '1px solid var(--border-subtle)',
    textAlign: 'left',
  },
  tr: {
    borderBottom: '1px solid var(--border-subtle)',
  },
  td: {
    padding: '0.6rem 0.75rem',
    verticalAlign: 'middle',
  },
  rankCell: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--muted)',
  },
  nameCell: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    color: 'var(--off-white)',
  },
  countryCell: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--secondary)',
  },
  scoreCell: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.1rem',
    color: 'var(--off-white)',
  },
  awardBadge: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.62rem',
    color: 'var(--secondary)',
    border: '1px solid var(--border-subtle)',
    padding: '0.15rem 0.4rem',
    letterSpacing: '0.06em',
  },
  actions: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingTop: '0.5rem',
    borderTop: '1px solid var(--border-subtle)',
  },
  editBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    color: 'var(--secondary)',
    background: 'transparent',
    border: '1px solid var(--border-subtle)',
    padding: '0.65rem 1.25rem',
    cursor: 'pointer',
    letterSpacing: '0.06em',
  },
  lockBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: 'var(--black)',
    background: 'var(--off-white)',
    border: '1px solid var(--off-white)',
    padding: '0.65rem 1.5rem',
    cursor: 'pointer',
    letterSpacing: '0.06em',
  },
  exportBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    color: 'var(--off-white)',
    background: 'transparent',
    border: '1px solid var(--off-white)',
    padding: '0.65rem 1.25rem',
    cursor: 'pointer',
    letterSpacing: '0.06em',
  },
  error: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: 'var(--off-white)',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-emphasis)',
    padding: '0.5rem 0.75rem',
  },
};
