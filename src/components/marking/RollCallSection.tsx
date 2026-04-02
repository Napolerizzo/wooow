'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Database } from '@/types/database';

type Delegate = Database['public']['Tables']['delegates']['Row'];
type RollCallStatus = 'present' | 'present_and_voting' | 'absent';

const STATUS_CYCLE: RollCallStatus[] = ['absent', 'present', 'present_and_voting'];
const STATUS_LABEL: Record<RollCallStatus, string> = {
  absent: 'ABSENT',
  present: 'PRESENT',
  present_and_voting: 'P&V',
};
const STATUS_COLOR: Record<RollCallStatus, string> = {
  absent: '#444',
  present: '#52c97c',
  present_and_voting: '#e0a952',
};

interface Props {
  delegates: Delegate[];
  isLocked: boolean;
  quorumFraction?: number;
  onUpdate: (id: string, updates: { roll_call_status: RollCallStatus }) => Promise<void>;
  onQuorumFractionChange?: (v: number) => void;
}

export default function RollCallSection({
  delegates, isLocked,
  quorumFraction = 0.25,
  onUpdate, onQuorumFractionChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending]   = useState<Set<string>>(new Set());

  const presentCount = delegates.filter((d) => d.roll_call_status === 'present').length;
  const pavCount     = delegates.filter((d) => d.roll_call_status === 'present_and_voting').length;
  const absentCount  = delegates.filter((d) => d.roll_call_status === 'absent').length;
  const total        = delegates.length;
  const attending    = presentCount + pavCount; // present + P&V

  // Quorum stats
  const quorumNeeded     = Math.ceil(total * quorumFraction);
  const simpleMajority   = Math.ceil(attending * 0.5);
  const specialMajority  = Math.ceil(attending * (2 / 3));
  const quorumMet        = attending >= quorumNeeded;

  const handleStatus = useCallback(async (delegateId: string, status: RollCallStatus) => {
    if (isLocked) return;
    setPending((p) => new Set(p).add(delegateId));
    await onUpdate(delegateId, { roll_call_status: status });
    setPending((p) => { const n = new Set(p); n.delete(delegateId); return n; });
  }, [isLocked, onUpdate]);

  function cycleStatus(delegate: Delegate) {
    const current = delegate.roll_call_status as RollCallStatus ?? 'absent';
    const idx = STATUS_CYCLE.indexOf(current);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    handleStatus(delegate.id, next);
  }

  async function bulkSet(status: RollCallStatus) {
    if (isLocked) return;
    await Promise.all(delegates.map((d) => onUpdate(d.id, { roll_call_status: status })));
  }

  async function bulkClear() {
    if (isLocked) return;
    await Promise.all(delegates.map((d) => onUpdate(d.id, { roll_call_status: 'absent' })));
  }

  return (
    <div style={styles.root}>
      {/* ── Collapsed header ───────────────────────────────────────── */}
      <button
        onClick={() => setExpanded((e) => !e)}
        style={styles.header}
        aria-expanded={expanded}
        aria-controls="roll-call-body"
      >
        <span style={styles.headerLabel}>ROLL CALL</span>

        <div style={styles.headerStats}>
          <Stat label="PRESENT" value={attending} color="#52c97c" />
          <Stat label="P&V"     value={pavCount}  color="#e0a952" />
          <Stat label="ABSENT"  value={absentCount} color="#555" />
          <span style={{ ...styles.statSep }}>·</span>
          <span style={{
            ...styles.quorumBadge,
            color: quorumMet ? '#52c97c' : '#e05252',
            borderColor: quorumMet ? '#52c97c33' : '#e0525233',
          }}>
            {quorumMet ? 'QUORUM MET' : `QUORUM ${attending}/${quorumNeeded}`}
          </span>
        </div>

        <span style={styles.chevron}>{expanded ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            id="roll-call-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={styles.body}>
              {/* ── Bulk actions ─────────────────────────────────── */}
              <div style={styles.bulkRow}>
                <span style={styles.bulkLabel}>BULK:</span>
                {!isLocked && (
                  <>
                    <button style={styles.bulkBtn} onClick={() => bulkSet('present')}>
                      SET ALL PRESENT
                    </button>
                    <button style={styles.bulkBtn} onClick={() => bulkSet('present_and_voting')}>
                      SET ALL P&amp;V
                    </button>
                    <button style={{ ...styles.bulkBtn, color: '#e05252' }} onClick={bulkClear}>
                      CLEAR ALL
                    </button>
                  </>
                )}
              </div>

              {/* ── Delegate pills ───────────────────────────────── */}
              <div style={styles.pillGrid}>
                {delegates.map((d) => {
                  const status = (d.roll_call_status as RollCallStatus) ?? 'absent';
                  return (
                    <button
                      key={d.id}
                      onClick={() => cycleStatus(d)}
                      disabled={isLocked || pending.has(d.id)}
                      style={{
                        ...styles.pill,
                        borderColor: STATUS_COLOR[status] + '55',
                        opacity: pending.has(d.id) ? 0.5 : 1,
                        cursor: isLocked ? 'default' : 'pointer',
                      }}
                      aria-label={`${d.name}: ${STATUS_LABEL[status]}. Click to cycle.`}
                      title="Click to cycle: ABSENT → PRESENT → P&V"
                    >
                      <span style={styles.pillName}>{d.name}</span>
                      <span style={{ ...styles.pillStatus, color: STATUS_COLOR[status] }}>
                        {STATUS_LABEL[status]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* ── Committee statistics ─────────────────────────── */}
              <div style={styles.statsBlock}>
                <div style={styles.statsRow}>
                  <StatBox label="QUORUM" value={`${attending} / ${quorumNeeded}`}
                    sub={`${Math.round(quorumFraction * 100)}% of total`}
                    ok={quorumMet} />
                  <StatBox label="SIMPLE MAJORITY" value={String(simpleMajority)}
                    sub="50%+1 of attending" ok={attending > 0} />
                  <StatBox label="2/3 MAJORITY" value={String(specialMajority)}
                    sub="⅔ of attending" ok={attending > 0} />
                  <StatBox label="SPECIAL MAJORITY" value={String(Math.ceil(attending * 0.75))}
                    sub="¾ of attending" ok={attending > 0} />
                </div>

                {/* Quorum fraction editor */}
                {onQuorumFractionChange && (
                  <div style={styles.quorumEditor}>
                    <label style={styles.quorumLabel}>QUORUM FRACTION</label>
                    <input
                      type="text" inputMode="numeric"
                      value={quorumFraction}
                      onChange={(e) => {
                        if (!/^[\d.]*$/.test(e.target.value)) return;
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v > 0 && v <= 1) onQuorumFractionChange(v);
                      }}
                      onFocus={(e) => e.currentTarget.select()}
                      style={styles.quorumInput}
                      aria-label="Quorum fraction"
                    />
                    <span style={styles.quorumHint}>
                      = {quorumNeeded} delegates of {total} total
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color, fontWeight: 500 }}>
        {value}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: '#444', letterSpacing: '0.06em' }}>
        {label}
      </span>
    </span>
  );
}

function StatBox({ label, value, sub, ok }: { label: string; value: string; sub: string; ok: boolean }) {
  return (
    <div style={{
      padding: '0.6rem 0.9rem',
      border: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: '1 0 120px',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: '#555', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: ok ? '#f0ece4' : '#555', fontWeight: 500 }}>
        {value}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.56rem', color: '#333' }}>{sub}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0,
    background: 'var(--color-surface)',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: '1rem',
    width: '100%', padding: '0.55rem 1.5rem',
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
  },
  headerLabel: {
    fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
    color: 'var(--secondary)', letterSpacing: '0.12em', flexShrink: 0,
  },
  headerStats: {
    display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, flexWrap: 'wrap',
  },
  statSep: {
    fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#333',
  },
  quorumBadge: {
    fontFamily: 'var(--font-mono)', fontSize: '0.6rem',
    border: '1px solid', padding: '0.1rem 0.4rem', letterSpacing: '0.06em',
  },
  chevron: { fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--muted)', flexShrink: 0 },
  body: { padding: '0.75rem 1.5rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' },
  bulkRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  bulkLabel: { fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#444', letterSpacing: '0.1em' },
  bulkBtn: {
    fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.06em',
    color: 'var(--secondary)', background: 'transparent',
    border: '1px solid var(--color-border)', padding: '0.25rem 0.65rem', cursor: 'pointer',
  },
  pillGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' },
  pill: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: 'transparent', border: '1px solid',
    padding: '0.25rem 0.6rem', flexShrink: 0,
    transition: 'border-color 0.15s',
  },
  pillName: {
    fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--off-white)',
    maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  pillStatus: {
    fontFamily: 'var(--font-mono)', fontSize: '0.58rem', fontWeight: 500, letterSpacing: '0.06em',
  },
  statsBlock: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  statsRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  quorumEditor: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
  quorumLabel: { fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#444', letterSpacing: '0.08em' },
  quorumInput: {
    background: 'transparent', border: '1px solid var(--color-border)',
    color: 'var(--off-white)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
    padding: '0.2rem 0.4rem', width: '70px', borderRadius: 0,
  },
  quorumHint: { fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#444' },
};
