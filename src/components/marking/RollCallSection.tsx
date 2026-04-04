'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Database } from '@/types/database';

type Delegate = Database['public']['Tables']['delegates']['Row'];
type RollCallStatus = 'present' | 'present_and_voting' | 'absent';

const STATUS_COLOR: Record<RollCallStatus, string> = {
  absent:             '#555',
  present:            '#52c97c',
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
  const [expanded, setExpanded] = useState(true); // open by default
  const [pending, setPending]   = useState<Set<string>>(new Set());

  const presentCount = delegates.filter((d) => d.roll_call_status === 'present').length;
  const pavCount     = delegates.filter((d) => d.roll_call_status === 'present_and_voting').length;
  const absentCount  = delegates.filter((d) => d.roll_call_status === 'absent' || !d.roll_call_status).length;
  const total        = delegates.length;
  const attending    = presentCount + pavCount;
  const quorumNeeded = Math.ceil(total * quorumFraction);
  const quorumMet    = attending >= quorumNeeded;

  const handleStatus = useCallback(async (delegateId: string, status: RollCallStatus) => {
    if (isLocked) return;
    setPending((p) => new Set(p).add(delegateId));
    await onUpdate(delegateId, { roll_call_status: status });
    setPending((p) => { const n = new Set(p); n.delete(delegateId); return n; });
  }, [isLocked, onUpdate]);

  async function bulkSet(status: RollCallStatus) {
    if (isLocked) return;
    await Promise.all(delegates.map((d) => onUpdate(d.id, { roll_call_status: status })));
  }

  return (
    <div style={styles.root}>
      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded((e) => !e)}
        style={styles.header}
        aria-expanded={expanded}
      >
        <span style={styles.headerLabel}>ROLL CALL</span>
        <div style={styles.headerCounts}>
          <span style={{ ...styles.countChip, color: '#52c97c' }}>{attending} PRESENT</span>
          <span style={{ ...styles.countChip, color: '#e0a952' }}>{pavCount} P&amp;V</span>
          <span style={{ ...styles.countChip, color: '#666' }}>{absentCount} ABSENT</span>
          <span style={{
            ...styles.quorumBadge,
            color: quorumMet ? '#52c97c' : '#e05252',
            borderColor: quorumMet ? '#52c97c44' : '#e0525244',
          }}>
            {quorumMet ? '✓ QUORUM' : `NO QUORUM (need ${quorumNeeded})`}
          </span>
        </div>
        <span style={styles.chevron}>{expanded ? '▲' : '▼'}</span>
      </button>

      {/* ── Expanded body ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={styles.body}>
              {/* Bulk actions */}
              {!isLocked && (
                <div style={styles.bulkRow}>
                  <span style={styles.bulkLabel}>ALL:</span>
                  <button style={styles.bulkBtn} onClick={() => bulkSet('present')}>PRESENT</button>
                  <button style={{ ...styles.bulkBtn, color: '#e0a952' }} onClick={() => bulkSet('present_and_voting')}>P&amp;V</button>
                  <button style={{ ...styles.bulkBtn, color: '#e05252' }} onClick={() => bulkSet('absent')}>ABSENT</button>
                </div>
              )}

              {/* Delegate list */}
              <div style={styles.list} role="list">
                {delegates.map((d) => {
                  const status = (d.roll_call_status as RollCallStatus) ?? 'absent';
                  const busy   = pending.has(d.id);
                  return (
                    <div
                      key={d.id}
                      role="listitem"
                      style={{
                        ...styles.row,
                        opacity: busy ? 0.6 : 1,
                        borderLeft: `3px solid ${STATUS_COLOR[status]}`,
                      }}
                    >
                      {/* Name */}
                      <span style={styles.delegateName} title={d.name}>
                        {d.name}
                      </span>
                      {d.country && (
                        <span style={styles.delegateCountry}>{d.country}</span>
                      )}

                      {/* Status buttons */}
                      <div style={styles.btnGroup} role="group" aria-label={`${d.name} roll call`}>
                        {([
                          ['present',            'P',   '#52c97c'],
                          ['present_and_voting', 'PV',  '#e0a952'],
                          ['absent',             'A',   '#555'],
                        ] as [RollCallStatus, string, string][]).map(([s, label, color]) => (
                          <button
                            key={s}
                            onClick={() => handleStatus(d.id, s)}
                            disabled={isLocked || busy}
                            aria-pressed={status === s}
                            aria-label={`Mark ${d.name} as ${s}`}
                            style={{
                              ...styles.statusBtn,
                              color:            status === s ? '#080808' : color,
                              background:       status === s ? color     : 'transparent',
                              borderColor:      color,
                              fontWeight:       status === s ? 700       : 400,
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quorum stats */}
              <div style={styles.statsRow}>
                {[
                  { label: 'SIMPLE MAJORITY',  value: Math.ceil(attending * 0.5) },
                  { label: '2/3 MAJORITY',     value: Math.ceil(attending * (2/3)) },
                  { label: '3/4 MAJORITY',     value: Math.ceil(attending * 0.75) },
                ].map(({ label, value }) => (
                  <div key={label} style={styles.statBox}>
                    <span style={styles.statBoxLabel}>{label}</span>
                    <span style={styles.statBoxValue}>{value}</span>
                  </div>
                ))}

                {/* Quorum fraction editor */}
                {onQuorumFractionChange && (
                  <div style={styles.statBox}>
                    <span style={styles.statBoxLabel}>QUORUM FRACTION</span>
                    <input
                      type="text" inputMode="decimal"
                      defaultValue={quorumFraction}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v > 0 && v <= 1) onQuorumFractionChange(v);
                      }}
                      onFocus={(e) => e.currentTarget.select()}
                      style={styles.quorumInput}
                      aria-label="Quorum fraction"
                    />
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

const styles: Record<string, React.CSSProperties> = {
  root: {
    borderBottom: '2px solid #111',
    flexShrink: 0,
    background: '#0a0a0a',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
    width: '100%', padding: '0.6rem 1.25rem',
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
    minHeight: '44px',
  },
  headerLabel: {
    fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
    color: '#888', letterSpacing: '0.14em', flexShrink: 0,
  },
  headerCounts: {
    display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, flexWrap: 'wrap',
  },
  countChip: {
    fontFamily: 'var(--font-mono)', fontSize: '0.62rem', fontWeight: 500, letterSpacing: '0.06em',
  },
  quorumBadge: {
    fontFamily: 'var(--font-mono)', fontSize: '0.58rem',
    border: '1px solid', padding: '2px 8px', letterSpacing: '0.06em',
  },
  chevron: { fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: '#444', flexShrink: 0 },

  body: {
    padding: '0.5rem 1.25rem 1rem',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },

  bulkRow: {
    display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap',
    padding: '0.25rem 0',
  },
  bulkLabel: {
    fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: '#555', letterSpacing: '0.1em',
  },
  bulkBtn: {
    fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.06em',
    color: '#888', background: 'transparent',
    border: '1px solid #222', padding: '0.2rem 0.6rem', cursor: 'pointer',
    minHeight: '32px',
  },

  list: {
    display: 'flex', flexDirection: 'column', gap: '2px',
    maxHeight: '340px', overflowY: 'auto',
  },
  row: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '0 0.75rem',
    background: '#0d0d0d',
    minHeight: '48px',
    transition: 'border-color 0.15s',
    flexWrap: 'wrap',
  },
  delegateName: {
    fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 600,
    color: '#c8c4bc', flex: 1, minWidth: '80px',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  delegateCountry: {
    fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: '#555',
    flexShrink: 0,
  },
  btnGroup: {
    display: 'flex', gap: '4px', flexShrink: 0,
  },
  statusBtn: {
    fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.06em',
    border: '1px solid', padding: '0 12px',
    cursor: 'pointer', minHeight: '36px', minWidth: '36px',
    transition: 'background 0.1s, color 0.1s',
  },

  statsRow: {
    display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.25rem',
  },
  statBox: {
    padding: '0.4rem 0.75rem', border: '1px solid #1a1a1a',
    display: 'flex', flexDirection: 'column', gap: '0.1rem', flex: '1 0 100px',
  },
  statBoxLabel: {
    fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#555', letterSpacing: '0.08em',
  },
  statBoxValue: {
    fontFamily: 'var(--font-mono)', fontSize: '1rem', color: '#c8c4bc', fontWeight: 500,
  },
  quorumInput: {
    background: 'transparent', border: 'none', borderBottom: '1px solid #2a2a2a',
    color: '#c8c4bc', fontFamily: 'var(--font-mono)', fontSize: '1rem',
    width: '60px', padding: '0', outline: 'none',
  },
};
