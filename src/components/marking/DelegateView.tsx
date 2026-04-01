'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Database } from '@/types/database';

type Delegate = Database['public']['Tables']['delegates']['Row'];
type SchemaField = Database['public']['Tables']['marking_schema']['Row'];
type Mark = Database['public']['Tables']['marks']['Row'];

interface SubCriterion {
  name: string;
  max: number;
}

interface Props {
  delegates: Delegate[];
  schema: SchemaField[];
  marks: Mark[];
  isLocked: boolean;
  committeeId: string;
  selectedIdx: number;
  onSelectIdx: (idx: number) => void;
  onSaveMark: (
    delegateId: string,
    fieldId: string,
    itemIndex: number,
    score: number,
    subCriterion?: string | null,
    countsTowardFinal?: boolean
  ) => Promise<void>;
  onUpdateDelegate: (delegateId: string, updates: {
    verbatim?: string;
    eb_remarks?: string;
  }) => Promise<void>;
}

function getDelegateTotal(marks: Mark[], delegateId: string, schema: SchemaField[]): number {
  return schema.reduce((sum, field) => {
    const fieldMarks = marks.filter(
      (m) => m.delegate_id === delegateId && m.schema_field_id === field.id && m.counts_toward_final
    );
    if (fieldMarks.length === 0) return sum;

    if (field.scoring_mode === 'average') {
      const scores = fieldMarks.map((m) => m.score);
      return sum + scores.reduce((a, b) => a + b, 0) / scores.length;
    }
    return sum + fieldMarks.reduce((s, m) => s + m.score, 0);
  }, 0);
}

export default function DelegateView({
  delegates,
  schema,
  marks,
  isLocked,
  selectedIdx,
  onSelectIdx,
  onSaveMark,
  onUpdateDelegate,
}: Props) {
  const delegate = delegates[selectedIdx] ?? null;

  const [verbatim, setVerbatim] = useState(delegate?.verbatim ?? '');
  const [remarks, setRemarks] = useState(delegate?.eb_remarks ?? '');
  const [savingText, setSavingText] = useState(false);

  useEffect(() => {
    setVerbatim(delegate?.verbatim ?? '');
    setRemarks(delegate?.eb_remarks ?? '');
  }, [delegate?.id, delegate?.verbatim, delegate?.eb_remarks]);

  if (!delegate) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyText}>SELECT A DELEGATE.</p>
      </div>
    );
  }

  const total = getDelegateTotal(marks, delegate.id, schema);

  async function saveText() {
    setSavingText(true);
    await onUpdateDelegate(delegate!.id, { verbatim, eb_remarks: remarks });
    setSavingText(false);
  }

  return (
    <div style={styles.root}>
      {/* ── Navigation ────────────────────────────────────────────────── */}
      <div style={styles.nav}>
        <button
          onClick={() => onSelectIdx(Math.max(0, selectedIdx - 1))}
          disabled={selectedIdx === 0}
          style={{ ...styles.navBtn, opacity: selectedIdx === 0 ? 0.3 : 1 }}
          aria-label="Previous delegate"
        >
          ← PREV DELEGATE
        </button>

        <div style={styles.navCenter}>
          <select
            value={selectedIdx}
            onChange={(e) => onSelectIdx(Number(e.target.value))}
            style={styles.delegateSelect}
            aria-label="Select delegate"
          >
            {delegates.map((d, i) => (
              <option key={d.id} value={i}>{d.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => onSelectIdx(Math.min(delegates.length - 1, selectedIdx + 1))}
          disabled={selectedIdx === delegates.length - 1}
          style={{ ...styles.navBtn, opacity: selectedIdx === delegates.length - 1 ? 0.3 : 1 }}
          aria-label="Next delegate"
        >
          NEXT DELEGATE →
        </button>
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div style={styles.content}>
        <AnimatePresence mode="wait">
          <motion.div
            key={delegate.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            style={styles.delegateSection}
          >
            {/* Header */}
            <div style={styles.delegateHeader}>
              <h2 style={styles.delegateName}>{delegate.name}</h2>
              {(delegate.country || delegate.portfolio) && (
                <p style={styles.delegateSubtitle}>
                  {[delegate.country, delegate.portfolio].filter(Boolean).join(' · ')}
                </p>
              )}
              <p style={styles.delegateTotal}>
                TOTAL: <span style={styles.totalValue}>{total > 0 ? total.toFixed(1) : '—'}</span>
              </p>
            </div>

            {/* Marking fields */}
            {schema.map((field) => {
              const subCriteria = Array.isArray(field.sub_criteria)
                ? (field.sub_criteria as unknown as SubCriterion[])
                : [];
              const fieldMarks = marks.filter(
                (m) => m.delegate_id === delegate.id && m.schema_field_id === field.id
              );
              const maxItems = field.max_items_total ?? 3;
              const itemCount = Math.max(
                fieldMarks.length > 0 ? Math.max(...fieldMarks.map((m) => m.item_index)) : 0,
                field.field_type !== 'roll_call' ? 1 : 0
              );

              return (
                <section key={field.id} style={styles.fieldSection}>
                  <div style={styles.fieldHeader}>
                    <h3 style={styles.fieldName}>{field.field_name}</h3>
                    <span style={styles.fieldMeta}>
                      {field.field_type} · max {field.max_score} · {field.scoring_mode}
                    </span>
                  </div>

                  {field.field_type === 'roll_call' ? (
                    <p style={styles.rollCallNote}>
                      Roll call managed in the roll call section above.
                    </p>
                  ) : (
                    <>
                      {/* Render existing item slots */}
                      {Array.from({ length: Math.max(itemCount, 1) }, (_, i) => i + 1).map((itemIdx) => {
                        const countsTowardFinal = fieldMarks.find((m) => m.item_index === itemIdx)?.counts_toward_final ?? true;

                        return (
                          <div key={itemIdx} style={styles.itemSlot}>
                            <div style={styles.itemSlotHeader}>
                              <span style={styles.itemLabel}>
                                {field.field_type === 'speech'
                                  ? `Speech ${itemIdx}`
                                  : field.field_type === 'chit'
                                  ? `Chit ${itemIdx}`
                                  : field.field_type === 'poi' || field.field_type === 'poi_reply'
                                  ? `${field.field_name} ${itemIdx}`
                                  : `Item ${itemIdx}`}
                              </span>
                              {field.field_type === 'speech' && (
                                <label style={styles.countsToggle}>
                                  <input
                                    type="checkbox"
                                    checked={countsTowardFinal}
                                    onChange={(e) => {
                                      const m = fieldMarks.find((m) => m.item_index === itemIdx);
                                      if (m) {
                                        onSaveMark(
                                          delegate.id, field.id, itemIdx,
                                          m.score, m.sub_criterion, e.target.checked
                                        );
                                      }
                                    }}
                                    disabled={isLocked}
                                    aria-label={`Speech ${itemIdx} counts toward final`}
                                    style={{ marginRight: '0.3rem', accentColor: 'var(--off-white)' }}
                                  />
                                  <span style={styles.countsLabel}>counts toward final</span>
                                </label>
                              )}
                            </div>

                            {/* Sub-criteria or single score */}
                            {subCriteria.length > 0 ? (
                              <div style={styles.subCriteriaGrid}>
                                {subCriteria.map((sub) => {
                                  const subMark = fieldMarks.find(
                                    (m) => m.item_index === itemIdx && m.sub_criterion === sub.name
                                  );
                                  return (
                                    <ScoreInput
                                      key={sub.name}
                                      label={`${sub.name} (max ${sub.max})`}
                                      value={subMark?.score ?? ''}
                                      max={sub.max}
                                      disabled={false}
                                      onSave={(v) =>
                                        onSaveMark(delegate.id, field.id, itemIdx, v, sub.name, countsTowardFinal)
                                      }
                                    />
                                  );
                                })}
                              </div>
                            ) : (
                              <ScoreInput
                                label={`Score (max ${field.max_score})`}
                                value={fieldMarks.find((m) => m.item_index === itemIdx)?.score ?? ''}
                                max={field.max_score}
                                disabled={false}
                                onSave={(v) =>
                                  onSaveMark(delegate.id, field.id, itemIdx, v, null, countsTowardFinal)
                                }
                              />
                            )}
                          </div>
                        );
                      })}

                      {/* Add more items */}
                      {!isLocked && itemCount < maxItems && (
                        <button
                          onClick={() => {
                            const nextIdx = itemCount + 1;
                            onSaveMark(delegate.id, field.id, nextIdx, 0, null, true);
                          }}
                          style={styles.addItemBtn}
                        >
                          + ADD {field.field_type.toUpperCase()}
                        </button>
                      )}
                    </>
                  )}
                </section>
              );
            })}

            {/* Verbatim */}
            <section style={styles.textSection}>
              <h3 style={styles.textSectionTitle}>VERBATIM RECORD</h3>
              <textarea
                value={verbatim}
                onChange={(e) => setVerbatim(e.target.value)}
                maxLength={20000}
                placeholder="Enter speech verbatim here..."
                style={styles.verbatimArea}
                disabled={isLocked}
                aria-label="Verbatim speech text"
              />
            </section>

            {/* EB Remarks */}
            <section style={styles.textSection}>
              <h3 style={styles.textSectionTitle}>EB REMARKS</h3>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                maxLength={2000}
                placeholder="Improvement notes for this delegate..."
                style={styles.remarksArea}
                disabled={isLocked}
                aria-label="EB remarks"
              />
            </section>

            {/* Save text fields */}
            {!isLocked && (
              <button
                onClick={saveText}
                disabled={savingText}
                style={{ ...styles.saveTextBtn, opacity: savingText ? 0.5 : 1 }}
              >
                {savingText ? <span className="loading-text">SAVING</span> : 'SAVE NOTES →'}
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function ScoreInput({
  label,
  value,
  max,
  disabled,
  onSave,
}: {
  label: string;
  value: number | string;
  max: number;
  disabled: boolean;
  onSave: (score: number) => void;
}) {
  const [localValue, setLocalValue] = useState(String(value));

  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  function commit() {
    const n = parseFloat(localValue);
    if (!isNaN(n) && n >= 0 && n <= max) {
      onSave(n);
    } else if (localValue === '' || localValue === '0') {
      onSave(0);
    }
  }

  return (
    <div style={scoreStyles.wrap}>
      <label style={scoreStyles.label}>{label}</label>
      <input
        type="number"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        disabled={disabled}
        min={0}
        max={max}
        step={0.5}
        style={{ ...scoreStyles.input, opacity: disabled ? 0.4 : 1 }}
        aria-label={label}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
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
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1.5rem',
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0,
    gap: '1rem',
  },
  navBtn: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1rem',
    color: 'var(--off-white)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    letterSpacing: '0.04em',
    flexShrink: 0,
  },
  navCenter: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
  },
  delegateSelect: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1rem',
    color: 'var(--off-white)',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border-subtle)',
    padding: '0.2rem 0.5rem',
    cursor: 'pointer',
    maxWidth: '280px',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem',
  },
  delegateSection: {
    maxWidth: '680px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  delegateHeader: {
    paddingBottom: '1rem',
    borderBottom: '1px solid var(--border-subtle)',
  },
  delegateName: {
    fontFamily: 'var(--font-heading)',
    fontSize: '2rem',
    color: 'var(--off-white)',
    marginBottom: '0.25rem',
  },
  delegateSubtitle: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: 'var(--secondary)',
    marginBottom: '0.5rem',
  },
  delegateTotal: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--secondary)',
    letterSpacing: '0.08em',
    marginTop: '0.5rem',
  },
  totalValue: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.4rem',
    color: 'var(--off-white)',
  },
  fieldSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  fieldHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '0.5rem',
    paddingBottom: '0.35rem',
    borderBottom: '1px solid var(--border-subtle)',
  },
  fieldName: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.1rem',
    color: 'var(--off-white)',
  },
  fieldMeta: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.65rem',
    color: 'var(--muted)',
    letterSpacing: '0.06em',
    flexShrink: 0,
  },
  rollCallNote: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--muted)',
    fontStyle: 'italic',
  },
  itemSlot: {
    border: '1px solid var(--border-subtle)',
    padding: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    background: 'rgba(240,236,228,0.02)',
  },
  itemSlotHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    color: 'var(--secondary)',
    letterSpacing: '0.06em',
  },
  countsToggle: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
  countsLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.65rem',
    color: 'var(--muted)',
    letterSpacing: '0.04em',
  },
  subCriteriaGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  addItemBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    color: 'var(--secondary)',
    background: 'none',
    border: '1px solid var(--border-subtle)',
    padding: '0.35rem 0.65rem',
    cursor: 'pointer',
    letterSpacing: '0.08em',
    alignSelf: 'flex-start',
  },
  textSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  textSectionTitle: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.68rem',
    color: 'var(--secondary)',
    letterSpacing: '0.12em',
    borderBottom: '1px solid var(--border-subtle)',
    paddingBottom: '0.3rem',
  },
  verbatimArea: {
    background: 'transparent',
    border: '1px solid var(--border-subtle)',
    padding: '0.75rem',
    color: 'var(--off-white)',
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    lineHeight: '1.6',
    minHeight: '120px',
    resize: 'vertical',
    borderRadius: '0',
    width: '100%',
  },
  remarksArea: {
    background: 'transparent',
    border: '1px solid var(--border-subtle)',
    padding: '0.75rem',
    color: 'var(--off-white)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    lineHeight: '1.5',
    minHeight: '80px',
    resize: 'vertical',
    borderRadius: '0',
    width: '100%',
  },
  saveTextBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: 'var(--off-white)',
    background: 'transparent',
    border: '1px solid var(--border-emphasis)',
    padding: '0.6rem 1.25rem',
    cursor: 'pointer',
    letterSpacing: '0.06em',
    alignSelf: 'flex-start',
  },
};

const scoreStyles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    minWidth: '120px',
  },
  label: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.65rem',
    color: 'var(--muted)',
    letterSpacing: '0.04em',
  },
  input: {
    background: 'transparent',
    border: '1px solid var(--border-emphasis)',
    padding: '0.4rem 0.5rem',
    color: 'var(--off-white)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    width: '90px',
    borderRadius: '0',
  },
};
