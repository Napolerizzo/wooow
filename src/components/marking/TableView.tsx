'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Database } from '@/types/database';

type Delegate = Database['public']['Tables']['delegates']['Row'];
type SchemaField = Database['public']['Tables']['marking_schema']['Row'];
type Mark = Database['public']['Tables']['marks']['Row'];

interface Props {
  delegates: Delegate[];
  schema: SchemaField[];
  marks: Mark[];
  isLocked: boolean;
  committeeId: string;
  onSaveMark: (
    delegateId: string,
    fieldId: string,
    itemIndex: number,
    score: number,
    subCriterion?: string | null,
    countsTowardFinal?: boolean
  ) => Promise<void>;
  onDelegateClick: (idx: number) => void;
}

function getMark(marks: Mark[], delegateId: string, fieldId: string, itemIndex = 1, subCriterion: string | null = null) {
  return marks.find(
    (m) =>
      m.delegate_id === delegateId &&
      m.schema_field_id === fieldId &&
      m.item_index === itemIndex &&
      m.sub_criterion === subCriterion
  );
}

function getDelegateFieldTotal(marks: Mark[], delegate: Delegate, field: SchemaField): number | null {
  const fieldMarks = marks.filter(
    (m) => m.delegate_id === delegate.id && m.schema_field_id === field.id
  );
  if (fieldMarks.length === 0) return null;

  if (field.scoring_mode === 'average') {
    const scores = fieldMarks.filter((m) => m.counts_toward_final).map((m) => m.score);
    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  const activeMarks = fieldMarks.filter((m) => m.counts_toward_final);
  return activeMarks.reduce((sum, m) => sum + m.score, 0);
}

function getDelegateTotal(marks: Mark[], delegate: Delegate, schema: SchemaField[]): number {
  return schema.reduce((sum, field) => {
    const total = getDelegateFieldTotal(marks, delegate, field);
    return sum + (total ?? 0);
  }, 0);
}

export default function TableView({
  delegates,
  schema,
  marks,
  isLocked,
  onSaveMark,
  onDelegateClick,
}: Props) {
  const [flashCells, setFlashCells] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const flashCell = useCallback((cellKey: string) => {
    setFlashCells((prev) => new Set(prev).add(cellKey));
    setTimeout(() => {
      setFlashCells((prev) => {
        const next = new Set(prev);
        next.delete(cellKey);
        return next;
      });
    }, 600);
  }, []);

  async function handleCellSave(
    delegateId: string,
    fieldId: string,
    itemIndex: number,
    value: string,
    subCriterion: string | null = null
  ) {
    const score = parseFloat(value);
    if (isNaN(score) || score < 0) return;

    const cellKey = `${delegateId}-${fieldId}-${itemIndex}-${subCriterion}`;
    setEditingCell(null);
    await onSaveMark(delegateId, fieldId, itemIndex, score, subCriterion);
    flashCell(cellKey);
  }

  // Sort delegates by total score descending for display
  const sortedDelegates = [...delegates].sort(
    (a, b) => getDelegateTotal(marks, b, schema) - getDelegateTotal(marks, a, schema)
  );

  if (delegates.length === 0) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyText}>NO DELEGATES IN THIS COMMITTEE.</p>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <div style={styles.tableWrap}>
        <table style={styles.table} role="grid" aria-label="Delegate marks table">
          <thead>
            <tr>
              <th style={{ ...styles.th, ...styles.stickyCol, zIndex: 3 }}>
                <span style={styles.thText}>DELEGATE</span>
              </th>
              {schema.map((field) => (
                <th key={field.id} style={styles.th}>
                  <span style={styles.thText}>{field.field_name}</span>
                  <span style={styles.thType}>{field.field_type}</span>
                </th>
              ))}
              <th style={styles.th}>
                <span style={styles.thText}>TOTAL</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {sortedDelegates.map((delegate, di) => {
              const total = getDelegateTotal(marks, delegate, schema);

              return (
                <tr key={delegate.id} style={styles.tr}>
                  {/* Delegate name (sticky) */}
                  <td style={{ ...styles.td, ...styles.stickyCol }}>
                    <button
                      onClick={() => onDelegateClick(delegates.indexOf(delegate))}
                      style={styles.delegateBtn}
                      aria-label={`Open delegate view for ${delegate.name}`}
                    >
                      <span style={styles.delegateRank}>{di + 1}</span>
                      <span style={styles.delegateName}>{delegate.name}</span>
                    </button>
                  </td>

                  {/* Score cells per field */}
                  {schema.map((field) => {
                    const mark = getMark(marks, delegate.id, field.id);
                    const fieldTotal = getDelegateFieldTotal(marks, delegate, field);
                    const cellKey = `${delegate.id}-${field.id}-1-null`;
                    const isFlashing = flashCells.has(cellKey);
                    const isEditing = editingCell === cellKey;

                    return (
                      <td key={field.id} style={styles.td}>
                        <AnimatePresence>
                          {isFlashing && (
                            <motion.div
                              key="flash"
                              initial={{ opacity: 0.4 }}
                              animate={{ opacity: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.5 }}
                              style={styles.flashOverlay}
                            />
                          )}
                        </AnimatePresence>

                        {isEditing || !isLocked ? (
                          <CellInput
                            defaultValue={mark?.score ?? ''}
                            disabled={isLocked && !isEditing}
                            onSave={(v) => handleCellSave(delegate.id, field.id, 1, v)}
                            onFocus={() => setEditingCell(cellKey)}
                            onBlur={() => setEditingCell(null)}
                            inputRef={(el) => {
                              if (el) inputRefs.current.set(cellKey, el);
                              else inputRefs.current.delete(cellKey);
                            }}
                          />
                        ) : (
                          <span style={styles.cellScore}>
                            {fieldTotal !== null ? fieldTotal.toFixed(1) : '—'}
                          </span>
                        )}
                      </td>
                    );
                  })}

                  {/* Total */}
                  <td style={{ ...styles.td, ...styles.totalCell }}>
                    <span style={styles.totalScore}>
                      {total > 0 ? total.toFixed(1) : '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CellInput({
  defaultValue,
  disabled,
  onSave,
  onFocus,
  onBlur,
  inputRef,
}: {
  defaultValue: number | string;
  disabled: boolean;
  onSave: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  const [value, setValue] = useState(String(defaultValue));

  // Sync when defaultValue changes (realtime update)
  // (We don't setState unconditionally to avoid clobbering active edits)

  return (
    <input
      ref={inputRef}
      type="number"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={onFocus}
      onBlur={() => {
        onBlur();
        onSave(value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
          setValue(String(defaultValue));
          e.currentTarget.blur();
        }
      }}
      disabled={disabled}
      min={0}
      step={0.5}
      style={{
        ...styles.cellInput,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'default' : 'text',
      }}
      aria-label="Score"
    />
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  tableWrap: {
    flex: 1,
    overflowX: 'auto',
    overflowY: 'auto',
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
    minWidth: '600px',
  },
  th: {
    padding: '0.6rem 0.75rem',
    borderBottom: '1px solid var(--border-subtle)',
    borderRight: '1px solid var(--border-subtle)',
    background: '#080808',
    textAlign: 'left',
    verticalAlign: 'bottom',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    zIndex: 2,
  },
  thText: {
    display: 'block',
    fontFamily: 'var(--font-body)',
    fontSize: '0.68rem',
    color: 'var(--off-white)',
    letterSpacing: '0.08em',
  },
  thType: {
    display: 'block',
    fontFamily: 'var(--font-body)',
    fontSize: '0.58rem',
    color: 'var(--muted)',
    letterSpacing: '0.06em',
    marginTop: '1px',
  },
  tr: {
    borderBottom: '1px solid var(--border-subtle)',
  },
  td: {
    padding: '0.35rem 0.6rem',
    borderRight: '1px solid var(--border-subtle)',
    position: 'relative',
    verticalAlign: 'middle',
    background: 'var(--black)',
    minWidth: '80px',
  },
  stickyCol: {
    position: 'sticky',
    left: 0,
    background: 'var(--color-surface)',
    zIndex: 1,
    minWidth: '140px',
    maxWidth: '200px',
  },
  delegateBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    textAlign: 'left',
    padding: '0.15rem 0',
  },
  delegateRank: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.6rem',
    color: 'var(--muted)',
    minWidth: '16px',
    flexShrink: 0,
  },
  delegateName: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    color: 'var(--off-white)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cellInput: {
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border-subtle)',
    color: 'var(--off-white)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    padding: '0.2rem 0.25rem',
    width: '100%',
    borderRadius: '0',
  },
  cellScore: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: 'var(--secondary)',
  },
  flashOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(240,236,228,0.15)',
    pointerEvents: 'none',
    zIndex: 1,
  },
  totalCell: {
    background: 'var(--color-surface)',
    position: 'sticky',
    right: 0,
  },
  totalScore: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1rem',
    color: 'var(--off-white)',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '50vh',
  },
  emptyText: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.5rem',
    color: 'var(--muted)',
  },
};
