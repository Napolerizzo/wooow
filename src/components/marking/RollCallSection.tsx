'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Database } from '@/types/database';

type Delegate = Database['public']['Tables']['delegates']['Row'];
type RollCallStatus = 'present' | 'present_and_voting' | 'absent';

interface Props {
  delegates: Delegate[];
  isLocked: boolean;
  onUpdate: (id: string, updates: { roll_call_status: RollCallStatus }) => Promise<void>;
}

export default function RollCallSection({ delegates, isLocked, onUpdate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const present = delegates.filter((d) => d.roll_call_status === 'present').length;
  const pav = delegates.filter((d) => d.roll_call_status === 'present_and_voting').length;
  const absent = delegates.filter((d) => d.roll_call_status === 'absent').length;
  const total = delegates.length;

  async function handleStatus(delegateId: string, status: RollCallStatus) {
    if (isLocked) return;
    setPending((p) => new Set(p).add(delegateId));
    await onUpdate(delegateId, { roll_call_status: status });
    setPending((p) => {
      const next = new Set(p);
      next.delete(delegateId);
      return next;
    });
  }

  return (
    <div style={styles.root}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={styles.header}
        aria-expanded={expanded}
        aria-controls="roll-call-body"
      >
        <span style={styles.headerLabel}>ROLL CALL</span>
        <span style={styles.summary}>
          {present + pav}/{total} present
          {pav > 0 && ` · ${pav} P&V`}
          {absent > 0 && ` · ${absent} absent`}
        </span>
        <span style={styles.chevron}>{expanded ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            id="roll-call-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={styles.grid}>
              {delegates.map((d) => (
                <div key={d.id} style={styles.delegateRow}>
                  <span style={styles.delegateName}>{d.name}</span>
                  <div style={styles.statusBtns} role="group" aria-label={`Roll call for ${d.name}`}>
                    {(['present', 'present_and_voting', 'absent'] as RollCallStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatus(d.id, status)}
                        disabled={isLocked || pending.has(d.id)}
                        style={{
                          ...styles.statusBtn,
                          ...(d.roll_call_status === status ? styles.statusBtnActive : {}),
                          opacity: pending.has(d.id) ? 0.5 : 1,
                        }}
                        aria-pressed={d.roll_call_status === status}
                      >
                        {status === 'present' ? 'P' : status === 'present_and_voting' ? 'P&V' : 'A'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    width: '100%',
    padding: '0.6rem 1.5rem',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  headerLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.68rem',
    color: 'var(--secondary)',
    letterSpacing: '0.12em',
    flexShrink: 0,
  },
  summary: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.68rem',
    color: 'var(--muted)',
    flex: 1,
  },
  chevron: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.6rem',
    color: 'var(--muted)',
    flexShrink: 0,
  },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
    padding: '0.75rem 1.5rem 1rem',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  delegateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    minWidth: '200px',
    flex: '1 0 200px',
  },
  delegateName: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--off-white)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  statusBtns: {
    display: 'flex',
    gap: '0',
    flexShrink: 0,
  },
  statusBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.6rem',
    color: 'var(--muted)',
    background: 'transparent',
    border: '1px solid var(--border-subtle)',
    padding: '0.2rem 0.4rem',
    cursor: 'pointer',
    letterSpacing: '0.04em',
    lineHeight: 1,
  },
  statusBtnActive: {
    color: 'var(--off-white)',
    background: 'rgba(240,236,228,0.1)',
    border: '1px solid var(--border-emphasis)',
  },
};
