'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

type Delegate = Database['public']['Tables']['delegates']['Row'];
type Mark = Database['public']['Tables']['marks']['Row'];
type SchemaField = Database['public']['Tables']['marking_schema']['Row'];

interface AwardTier {
  tier_name: string;
  rank_from: number;
  num_awards: number;
  sort_order: number;
}

interface DelegateScore {
  delegate: Delegate;
  total: number;
  rank: number;
  awardTier?: string;
}

// Compute scores client-side (mirrors server logic)
function computeScores(
  delegates: Delegate[],
  marks: Mark[],
  schema: SchemaField[],
  awardTiers: AwardTier[]
): DelegateScore[] {
  const totals = delegates.map((d) => {
    const total = schema.reduce((sum, field) => {
      const fieldMarks = marks.filter(
        (m) => m.delegate_id === d.id && m.schema_field_id === field.id && m.counts_toward_final
      );
      if (fieldMarks.length === 0) return sum;
      if (field.scoring_mode === 'average') {
        const scores = fieldMarks.map((m) => m.score);
        return sum + scores.reduce((a, b) => a + b, 0) / scores.length;
      }
      return sum + fieldMarks.reduce((s, m) => s + m.score, 0);
    }, 0);
    return { delegate: d, total };
  });

  totals.sort((a, b) => b.total - a.total);

  return totals.map(({ delegate, total }, i) => {
    const rank = i + 1;
    const tier = awardTiers.find(
      (t) => rank >= t.rank_from && rank < t.rank_from + t.num_awards
    );
    return { delegate, total, rank, awardTier: tier?.tier_name };
  });
}

export default function ScoreboardPage() {
  const params = useParams();
  const committeeId = params?.id as string;

  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [schema, setSchema] = useState<SchemaField[]>([]);
  const [awardTiers, setAwardTiers] = useState<AwardTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedScore, setSelectedScore] = useState<DelegateScore | null>(null);
  const [use3D, setUse3D] = useState(false);

  const supabaseRef = useRef(createClient());

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const loadAll = useCallback(async () => {
    const supabase = supabaseRef.current;
    const [delegatesRes, schemaRes, marksRes] = await Promise.all([
      fetch(`/api/committee/${committeeId}/delegates`),
      fetch(`/api/committee/${committeeId}/schema`),
      fetch(`/api/committee/${committeeId}/marks`),
    ]);

    if (delegatesRes.ok) setDelegates((await delegatesRes.json()).delegates ?? []);
    if (schemaRes.ok) setSchema((await schemaRes.json()).schema ?? []);
    if (marksRes.ok) setMarks((await marksRes.json()).marks ?? []);

    const { data: tiers } = await supabase
      .from('award_tiers')
      .select('*')
      .eq('committee_id', committeeId)
      .order('sort_order');

    if (tiers) setAwardTiers(tiers);
    setLoading(false);
  }, [committeeId]);

  // Realtime marks subscription
  useEffect(() => {
    if (!committeeId) return;
    loadAll();

    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`scoreboard:${committeeId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'marks',
        filter: `committee_id=eq.${committeeId}`,
      }, (payload) => {
        if ((payload.new as Mark)?.committee_id !== committeeId &&
            (payload.old as Mark)?.committee_id !== committeeId) return;

        setMarks((prev) => {
          if (payload.eventType === 'INSERT') return [...prev, payload.new as Mark];
          if (payload.eventType === 'UPDATE') {
            return prev.map((m) => m.id === (payload.new as Mark).id ? payload.new as Mark : m);
          }
          return prev.filter((m) => m.id !== (payload.old as { id: string }).id);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [committeeId, loadAll]);

  const scores = computeScores(delegates, marks, schema, awardTiers);

  if (loading) {
    return (
      <div style={styles.loading}>
        <p className="loading-text" style={styles.loadingText}>LOADING SCOREBOARD</p>
      </div>
    );
  }

  if (delegates.length === 0) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyText}>NO DELEGATES YET.</p>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      {/* ── Toggle 3D / 2D ───────────────────────────────────────────── */}
      <div style={styles.toolbar}>
        <span style={styles.toolbarTitle}>LIVE SCOREBOARD</span>
        {!isMobile && (
          <button
            onClick={() => setUse3D((v) => !v)}
            style={styles.toggleBtn}
            aria-label={use3D ? 'Switch to 2D view' : 'Switch to 3D view'}
          >
            {use3D ? '2D VIEW' : '3D VIEW'}
          </button>
        )}
      </div>

      {/* ── Scoreboard ──────────────────────────────────────────────── */}
      <div style={styles.canvasArea}>
        {!isMobile && use3D ? (
          <ThreeDScoreboard
            scores={scores}
            onSelect={(s) => setSelectedScore(s)}
          />
        ) : (
          <TwoDScoreboard
            scores={scores}
            onSelect={(s) => setSelectedScore(selectedScore?.delegate.id === s.delegate.id ? null : s)}
            selectedId={selectedScore?.delegate.id ?? null}
          />
        )}
      </div>

      {/* ── Selected delegate detail panel ────────────────────────── */}
      <AnimatePresence>
        {selectedScore && (
          <motion.div
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 32 }}
            transition={{ duration: 0.25 }}
            style={styles.detailPanel}
          >
            <button
              onClick={() => setSelectedScore(null)}
              style={styles.closeDetail}
              aria-label="Close detail panel"
            >
              ✕
            </button>
            <p style={styles.detailRank}>#{selectedScore.rank}</p>
            <h3 style={styles.detailName}>{selectedScore.delegate.name}</h3>
            {(selectedScore.delegate.country || selectedScore.delegate.portfolio) && (
              <p style={styles.detailSub}>
                {[selectedScore.delegate.country, selectedScore.delegate.portfolio]
                  .filter(Boolean).join(' · ')}
              </p>
            )}
            <p style={styles.detailTotal}>{selectedScore.total.toFixed(1)}</p>
            {selectedScore.awardTier && (
              <p style={styles.detailAward}>{selectedScore.awardTier.toUpperCase()}</p>
            )}

            <div style={styles.detailBreakdown}>
              {schema.map((field) => {
                const fieldMarks = marks.filter(
                  (m) => m.delegate_id === selectedScore.delegate.id &&
                    m.schema_field_id === field.id && m.counts_toward_final
                );
                if (fieldMarks.length === 0) return null;
                const fieldTotal = field.scoring_mode === 'average'
                  ? fieldMarks.reduce((s, m) => s + m.score, 0) / fieldMarks.length
                  : fieldMarks.reduce((s, m) => s + m.score, 0);

                return (
                  <div key={field.id} style={styles.detailRow}>
                    <span style={styles.detailFieldName}>{field.field_name}</span>
                    <span style={styles.detailFieldScore}>{fieldTotal.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── 3D Scoreboard (lazy-loaded to avoid SSR issues) ─────────────────────────
function ThreeDScoreboard({
  scores,
  onSelect,
}: {
  scores: DelegateScore[];
  onSelect: (s: DelegateScore) => void;
}) {
  const [Scene, setScene] = useState<React.ComponentType<{
    scores: DelegateScore[];
    onSelectDelegate: (d: Delegate, score: number, rank: number) => void;
  }> | null>(null);

  useEffect(() => {
    import('@/components/scoreboard/ScoreboardScene').then((mod) => {
      setScene(() => mod.default);
    });
  }, []);

  if (!Scene) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p className="loading-text" style={{ fontFamily: 'var(--font-body)', color: 'var(--secondary)', fontSize: '0.8rem' }}>
          LOADING 3D SCENE
        </p>
      </div>
    );
  }

  return (
    <Scene
      scores={scores}
      onSelectDelegate={(d) => {
        const s = scores.find((s) => s.delegate.id === d.id);
        if (s) onSelect(s);
      }}
    />
  );
}

// ─── 2D Scoreboard (animated list) ───────────────────────────────────────────
function TwoDScoreboard({
  scores,
  onSelect,
  selectedId,
}: {
  scores: DelegateScore[];
  onSelect: (s: DelegateScore) => void;
  selectedId: string | null;
}) {
  return (
    <div style={twoDStyles.list} role="list" aria-label="Delegate rankings">
      <AnimatePresence>
        {scores.map((score, i) => (
          <motion.div
            key={score.delegate.id}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3, layout: { type: 'spring', stiffness: 200, damping: 25 } }}
            style={{
              ...twoDStyles.row,
              background: selectedId === score.delegate.id ? 'rgba(240,236,228,0.06)' : 'transparent',
              borderColor: selectedId === score.delegate.id ? 'var(--border-emphasis)' : 'var(--border-subtle)',
            }}
            onClick={() => onSelect(score)}
            role="listitem"
            tabIndex={0}
            aria-label={`Rank ${score.rank}: ${score.delegate.name}, ${score.total.toFixed(1)} points`}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelect(score); }}
          >
            <span style={twoDStyles.rank}>{score.rank}</span>
            <div style={twoDStyles.nameWrap}>
              <span style={twoDStyles.name}>{score.delegate.name}</span>
              {score.awardTier && (
                <span style={twoDStyles.tier}>{score.awardTier}</span>
              )}
            </div>
            <div style={twoDStyles.bar}>
              <motion.div
                style={twoDStyles.barFill}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: scores[0].total > 0 ? score.total / scores[0].total : 0 }}
                transition={{ delay: 0.3 + i * 0.04, duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <span style={twoDStyles.score}>{score.total.toFixed(1)}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    height: 'calc(100vh - 88px)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  },
  loading: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh',
  },
  loadingText: {
    fontFamily: 'var(--font-body)', color: 'var(--secondary)', fontSize: '0.9rem', letterSpacing: '0.1em',
  },
  empty: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh',
  },
  emptyText: {
    fontFamily: 'var(--font-heading)', fontSize: '2rem', color: 'var(--muted)',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.6rem 1.5rem',
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0,
  },
  toolbarTitle: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.68rem',
    color: 'var(--secondary)',
    letterSpacing: '0.12em',
  },
  toggleBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.68rem',
    color: 'var(--secondary)',
    background: 'none',
    border: '1px solid var(--border-subtle)',
    padding: '0.3rem 0.65rem',
    cursor: 'pointer',
    letterSpacing: '0.08em',
  },
  canvasArea: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  detailPanel: {
    position: 'absolute',
    top: '52px',
    right: '1.5rem',
    width: '280px',
    background: '#0d0d0d',
    border: '1px solid var(--border-emphasis)',
    padding: '1.5rem',
    zIndex: 50,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  closeDetail: {
    position: 'absolute',
    top: '0.75rem',
    right: '0.75rem',
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--muted)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  detailRank: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.65rem',
    color: 'var(--muted)',
    letterSpacing: '0.1em',
  },
  detailName: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.4rem',
    color: 'var(--off-white)',
    lineHeight: 1.1,
  },
  detailSub: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    color: 'var(--secondary)',
  },
  detailTotal: {
    fontFamily: 'var(--font-heading)',
    fontSize: '2rem',
    color: 'var(--off-white)',
    marginTop: '0.25rem',
  },
  detailAward: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.65rem',
    color: 'var(--secondary)',
    letterSpacing: '0.12em',
    border: '1px solid var(--border-subtle)',
    padding: '0.2rem 0.5rem',
    alignSelf: 'flex-start',
  },
  detailBreakdown: {
    marginTop: '0.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: '0.75rem',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  detailFieldName: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    color: 'var(--secondary)',
  },
  detailFieldScore: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: 'var(--off-white)',
  },
};

const twoDStyles: Record<string, React.CSSProperties> = {
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
    padding: '1rem 1.5rem',
    overflowY: 'auto',
    height: '100%',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.6rem 0.75rem',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background 0.15s, border-color 0.15s',
  },
  rank: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.65rem',
    color: 'var(--muted)',
    minWidth: '24px',
    textAlign: 'right',
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  name: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    color: 'var(--off-white)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tier: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.6rem',
    color: 'var(--muted)',
    letterSpacing: '0.06em',
  },
  bar: {
    width: '120px',
    height: '2px',
    background: 'var(--border-subtle)',
    flexShrink: 0,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: 'var(--secondary)',
    transformOrigin: 'left',
  },
  score: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1rem',
    color: 'var(--off-white)',
    minWidth: '48px',
    textAlign: 'right',
    flexShrink: 0,
  },
};
