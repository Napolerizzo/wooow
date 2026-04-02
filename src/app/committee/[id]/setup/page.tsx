'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

type FieldType = Database['public']['Tables']['marking_schema']['Row']['field_type'];
type ScoringMode = 'absolute' | 'average';

interface SubCriterion {
  name: string;
  max: number;
}

interface SchemaField {
  id?: string; // undefined for new, defined for saved
  field_name: string;
  field_type: FieldType;
  max_score: number;
  scoring_mode: ScoringMode;
  max_items_total: number | null;
  max_items_count: number | null;
  sub_criteria: SubCriterion[];
  sort_order: number;
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  speech: 'Speech',
  chit: 'Chit',
  poi: 'POI',
  poi_reply: 'POI Reply',
  documentation: 'Documentation',
  roll_call: 'Roll Call',
  custom: 'Custom',
};

function emptyField(sort_order: number): SchemaField {
  return {
    field_name: '',
    field_type: 'speech',
    max_score: 10,
    scoring_mode: 'absolute',
    max_items_total: null,
    max_items_count: null,
    sub_criteria: [],
    sort_order,
  };
}

export default function SetupPage() {
  const params = useParams();
  const committeeId = params?.id as string;

  const [fields, setFields] = useState<SchemaField[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Load existing schema
  const loadSchema = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('marking_schema')
      .select('*')
      .eq('committee_id', committeeId)
      .order('sort_order');

    if (data && data.length > 0) {
      setFields(
        data.map((row) => ({
          id: row.id,
          field_name: row.field_name,
          field_type: row.field_type,
          max_score: row.max_score,
          scoring_mode: row.scoring_mode,
          max_items_total: row.max_items_total,
          max_items_count: row.max_items_count,
          sub_criteria: Array.isArray(row.sub_criteria)
            ? (row.sub_criteria as unknown as SubCriterion[])
            : [],
          sort_order: row.sort_order,
        }))
      );
    }
    setLoading(false);
  }, [committeeId]);

  useEffect(() => {
    if (committeeId) loadSchema();
  }, [committeeId, loadSchema]);

  function addField() {
    const newField = emptyField(fields.length);
    setFields((f) => [...f, newField]);
    setSelectedIdx(fields.length);
  }

  function updateField(idx: number, updates: Partial<SchemaField>) {
    setFields((f) =>
      f.map((field, i) => (i === idx ? { ...field, ...updates } : field))
    );
  }

  function removeField(idx: number) {
    setFields((f) => {
      const next = f.filter((_, i) => i !== idx).map((field, i) => ({ ...field, sort_order: i }));
      return next;
    });
    setSelectedIdx(null);
  }

  function addSubCriterion(fieldIdx: number) {
    updateField(fieldIdx, {
      sub_criteria: [
        ...fields[fieldIdx].sub_criteria,
        { name: '', max: 10 },
      ],
    });
  }

  function updateSubCriterion(fieldIdx: number, subIdx: number, updates: Partial<SubCriterion>) {
    const subs = [...fields[fieldIdx].sub_criteria];
    subs[subIdx] = { ...subs[subIdx], ...updates };
    updateField(fieldIdx, { sub_criteria: subs });
  }

  function removeSubCriterion(fieldIdx: number, subIdx: number) {
    const subs = fields[fieldIdx].sub_criteria.filter((_, i) => i !== subIdx);
    updateField(fieldIdx, { sub_criteria: subs });
  }

  // Calculate total max score
  const totalMaxScore = fields.reduce((sum, f) => {
    if (f.field_type === 'speech' && f.sub_criteria.length > 0) {
      const subMax = f.sub_criteria.reduce((s, c) => s + c.max, 0);
      if (f.scoring_mode === 'absolute') {
        return sum + subMax * (f.max_items_count ?? 1);
      } else {
        return sum + subMax; // averaged
      }
    }
    if (f.scoring_mode === 'absolute') {
      return sum + f.max_score * (f.max_items_count ?? f.max_items_total ?? 1);
    }
    return sum + f.max_score;
  }, 0);

  async function handleSave() {
    setError('');
    setSaving(true);

    // Validate
    for (const field of fields) {
      if (!field.field_name.trim()) {
        setError('All fields must have a name.');
        setSaving(false);
        return;
      }
      if (field.max_score < 0) {
        setError('Max scores must be non-negative.');
        setSaving(false);
        return;
      }
    }

    try {
      const res = await fetch(`/api/committee/${committeeId}/schema`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: fields.map((f, i) => ({
            ...f,
            sort_order: i,
            sub_criteria: f.sub_criteria.length > 0 ? f.sub_criteria : null,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save schema');
        setSaving(false);
        return;
      }

      await loadSchema();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Network error. Please try again.');
    }
    setSaving(false);
  }

  const selectedField = selectedIdx !== null ? fields[selectedIdx] : null;

  if (loading) {
    return (
      <div style={styles.loadingWrap}>
        <p style={styles.loadingText} className="loading-text">LOADING SCHEMA</p>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      {/* ── Left panel: field list ─────────────────────────────────────── */}
      <div style={styles.leftPanel}>
        <div style={styles.leftHeader}>
          <h1 style={styles.heading}>MARKING SCHEMA</h1>
          <p style={styles.subheading}>Define how delegates are scored</p>
        </div>

        <Reorder.Group
          axis="y"
          values={fields}
          onReorder={(newOrder) => {
            setFields(newOrder.map((f, i) => ({ ...f, sort_order: i })));
            if (selectedIdx !== null) {
              const selectedId = fields[selectedIdx]?.id;
              const newIdx = newOrder.findIndex((f) => f.id === selectedId);
              setSelectedIdx(newIdx >= 0 ? newIdx : null);
            }
          }}
          style={styles.fieldList}
        >
          <AnimatePresence>
            {fields.map((field, idx) => (
              <Reorder.Item
                key={field.id ?? `new-${idx}`}
                value={field}
                style={{
                  ...styles.fieldItem,
                  ...(selectedIdx === idx ? styles.fieldItemActive : {}),
                }}
                onClick={() => setSelectedIdx(idx)}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                role="button"
                tabIndex={0}
                aria-label={`Edit field: ${field.field_name || 'Untitled'}`}
                onKeyDown={(e) => { if (e.key === 'Enter') setSelectedIdx(idx); }}
              >
                <span style={styles.fieldItemType}>{FIELD_TYPE_LABELS[field.field_type]}</span>
                <span style={styles.fieldItemName}>
                  {field.field_name || <em style={{ color: 'var(--muted)' }}>Untitled</em>}
                </span>
                <span style={styles.fieldItemMax}>{field.max_score}</span>
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </Reorder.Group>

        <button onClick={addField} style={styles.addFieldBtn} aria-label="Add marking field">
          + ADD FIELD
        </button>

        {/* Total score preview */}
        <div style={styles.totalPreview}>
          <span style={styles.totalLabel}>MAX TOTAL</span>
          <span style={styles.totalValue}>{totalMaxScore.toFixed(1)}</span>
        </div>

        {/* Save button */}
        <div style={styles.saveArea}>
          {error && <p style={styles.error} role="alert">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving || fields.length === 0}
            style={{
              ...styles.saveBtn,
              opacity: (saving || fields.length === 0) ? 0.5 : 1,
            }}
          >
            {saving ? (
              <span className="loading-text">SAVING</span>
            ) : saved ? (
              'SAVED ✓'
            ) : (
              'SAVE SCHEMA →'
            )}
          </button>
        </div>
      </div>

      {/* ── Right panel: field config ─────────────────────────────────── */}
      <div style={styles.rightPanel}>
        <AnimatePresence mode="wait">
          {selectedField !== null && selectedIdx !== null ? (
            <motion.div
              key={selectedIdx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              style={styles.fieldConfig}
            >
              <div style={styles.configHeader}>
                <h2 style={styles.configTitle}>CONFIGURE FIELD</h2>
                <button
                  onClick={() => removeField(selectedIdx)}
                  style={styles.deleteBtn}
                  aria-label="Delete this field"
                >
                  DELETE FIELD
                </button>
              </div>

              {/* Field name */}
              <ConfigField label="FIELD NAME">
                <input
                  type="text"
                  value={selectedField.field_name}
                  onChange={(e) => updateField(selectedIdx, { field_name: e.target.value })}
                  maxLength={100}
                  placeholder="e.g. Main Speech"
                  style={styles.configInput}
                  aria-label="Field name"
                />
              </ConfigField>

              {/* Field type */}
              <ConfigField label="FIELD TYPE">
                <div style={styles.typeGrid}>
                  {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => updateField(selectedIdx, { field_type: type })}
                      style={{
                        ...styles.typeBtn,
                        ...(selectedField.field_type === type ? styles.typeBtnActive : {}),
                      }}
                      aria-pressed={selectedField.field_type === type}
                    >
                      {FIELD_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </ConfigField>

              {/* Max score */}
              <ConfigField label="MAX SCORE">
                <input
                  type="number"
                  value={selectedField.max_score}
                  onChange={(e) => updateField(selectedIdx, { max_score: Math.max(0, parseFloat(e.target.value) || 0) })}
                  min={0}
                  step={0.5}
                  style={{ ...styles.configInput, width: '120px' }}
                  aria-label="Maximum score"
                />
              </ConfigField>

              {/* Scoring mode */}
              <ConfigField label="SCORING MODE">
                <div style={styles.toggleGroup} role="radiogroup" aria-label="Scoring mode">
                  <button
                    onClick={() => updateField(selectedIdx, { scoring_mode: 'absolute' })}
                    style={{
                      ...styles.toggleBtn,
                      ...(selectedField.scoring_mode === 'absolute' ? styles.toggleBtnActive : {}),
                    }}
                    role="radio"
                    aria-checked={selectedField.scoring_mode === 'absolute'}
                  >
                    ABSOLUTE
                  </button>
                  <button
                    onClick={() => updateField(selectedIdx, { scoring_mode: 'average' })}
                    style={{
                      ...styles.toggleBtn,
                      ...(selectedField.scoring_mode === 'average' ? styles.toggleBtnActive : {}),
                    }}
                    role="radio"
                    aria-checked={selectedField.scoring_mode === 'average'}
                  >
                    AVERAGE
                  </button>
                </div>
                <p style={styles.modeHint}>
                  {selectedField.scoring_mode === 'average'
                    ? 'Final score = average of all entries'
                    : 'Final score = sum of selected entries'}
                </p>
              </ConfigField>

              {/* Items config (for speech, chit, poi, documentation) */}
              {selectedField.field_type !== 'roll_call' && (
                <>
                  <ConfigField label="TOTAL ITEMS ALLOWED">
                    <input
                      type="number"
                      value={selectedField.max_items_total ?? ''}
                      onChange={(e) => updateField(selectedIdx, {
                        max_items_total: e.target.value ? Math.max(1, parseInt(e.target.value)) : null,
                      })}
                      min={1}
                      placeholder="unlimited"
                      style={{ ...styles.configInput, width: '120px' }}
                      aria-label="Maximum total items"
                    />
                  </ConfigField>

                  {selectedField.field_type === 'speech' && (
                    <ConfigField label="SPEECHES THAT COUNT TOWARD FINAL">
                      <input
                        type="number"
                        value={selectedField.max_items_count ?? ''}
                        onChange={(e) => updateField(selectedIdx, {
                          max_items_count: e.target.value ? Math.max(1, parseInt(e.target.value)) : null,
                        })}
                        min={1}
                        placeholder="all"
                        style={{ ...styles.configInput, width: '120px' }}
                        aria-label="Number of speeches counting toward final score"
                      />
                      <p style={styles.fieldNote}>
                        EB will manually select which speeches count during marking
                      </p>
                    </ConfigField>
                  )}
                </>
              )}

              {/* Sub-criteria (speech only) */}
              {selectedField.field_type === 'speech' && (
                <ConfigField label="SUB-CRITERIA">
                  <div style={styles.subCriteriaList}>
                    {selectedField.sub_criteria.map((sub, si) => (
                      <motion.div
                        key={si}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={styles.subCriterionRow}
                      >
                        <input
                          type="text"
                          value={sub.name}
                          onChange={(e) => updateSubCriterion(selectedIdx, si, { name: e.target.value })}
                          placeholder="e.g. Research"
                          maxLength={100}
                          style={{ ...styles.configInput, flex: 2 }}
                          aria-label={`Sub-criterion ${si + 1} name`}
                        />
                        <input
                          type="number"
                          value={sub.max}
                          onChange={(e) => updateSubCriterion(selectedIdx, si, { max: Math.max(0, parseFloat(e.target.value) || 0) })}
                          min={0}
                          step={0.5}
                          style={{ ...styles.configInput, flex: 0.6, textAlign: 'center' }}
                          aria-label={`Sub-criterion ${si + 1} max score`}
                        />
                        <button
                          onClick={() => removeSubCriterion(selectedIdx, si)}
                          style={styles.removeSub}
                          aria-label={`Remove sub-criterion ${si + 1}`}
                        >
                          ✕
                        </button>
                      </motion.div>
                    ))}
                  </div>
                  <button
                    onClick={() => addSubCriterion(selectedIdx)}
                    style={styles.addSubBtn}
                  >
                    + ADD SUB-CRITERION
                  </button>
                  {selectedField.sub_criteria.length > 0 && (
                    <p style={styles.fieldNote}>
                      Sub-criteria total: {selectedField.sub_criteria.reduce((s, c) => s + c.max, 0)}
                    </p>
                  )}
                </ConfigField>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={styles.configEmpty}
            >
              <p style={styles.configEmptyText}>
                {fields.length === 0
                  ? 'ADD YOUR FIRST FIELD.'
                  : 'SELECT A FIELD TO CONFIGURE.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ConfigField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={styles.configFieldWrap}>
      <label style={styles.configLabel}>{label}</label>
      {children}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loadingWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '50vh',
  },
  loadingText: {
    fontFamily: 'var(--font-body)',
    color: 'var(--secondary)',
    fontSize: '0.9rem',
    letterSpacing: '0.1em',
  },
  root: {
    display: 'flex',
    height: 'calc(100vh - 56px)',
    overflow: 'hidden',
  },
  leftPanel: {
    width: '300px',
    borderRight: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflow: 'hidden',
  },
  leftHeader: {
    padding: '1.5rem',
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0,
  },
  heading: {
    fontFamily: 'var(--font-wordmark)',
    fontSize: '1.2rem',
    color: 'var(--off-white)',
    marginBottom: '0.2rem',
  },
  subheading: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    color: 'var(--secondary)',
    letterSpacing: '0.04em',
  },
  fieldList: {
    flex: 1,
    overflowY: 'auto',
    padding: '0.75rem 0',
    listStyle: 'none',
  },
  fieldItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.6rem 1.5rem',
    cursor: 'pointer',
    borderLeft: '2px solid transparent',
    transition: 'background 0.1s, border-color 0.1s',
    userSelect: 'none',
  },
  fieldItemActive: {
    background: 'rgba(240,236,228,0.04)',
    borderLeft: '2px solid var(--off-white)',
  },
  fieldItemType: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.65rem',
    color: 'var(--muted)',
    letterSpacing: '0.06em',
    minWidth: '60px',
    flexShrink: 0,
  },
  fieldItemName: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: 'var(--off-white)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fieldItemMax: {
    fontFamily: 'var(--font-heading)',
    fontSize: '0.9rem',
    color: 'var(--secondary)',
    flexShrink: 0,
  },
  addFieldBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--secondary)',
    background: 'none',
    border: 'none',
    borderTop: '1px solid var(--border-subtle)',
    padding: '0.9rem 1.5rem',
    cursor: 'pointer',
    letterSpacing: '0.1em',
    textAlign: 'left',
  },
  totalPreview: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '0.75rem 1.5rem',
    borderTop: '1px solid var(--border-subtle)',
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0,
  },
  totalLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.65rem',
    color: 'var(--muted)',
    letterSpacing: '0.1em',
  },
  totalValue: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.5rem',
    color: 'var(--off-white)',
  },
  saveArea: {
    padding: '1rem 1.5rem',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  error: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--off-white)',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-emphasis)',
    padding: '0.4rem 0.6rem',
  },
  saveBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    letterSpacing: '0.08em',
    color: 'var(--off-white)',
    background: 'transparent',
    border: '1px solid var(--off-white)',
    padding: '0.65rem 1rem',
    cursor: 'pointer',
    width: '100%',
  },
  rightPanel: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem 2rem',
  },
  fieldConfig: {
    maxWidth: '520px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  configHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  configTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.2rem',
    color: 'var(--off-white)',
  },
  deleteBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.7rem',
    color: 'var(--muted)',
    background: 'none',
    border: '1px solid var(--border-subtle)',
    padding: '0.3rem 0.6rem',
    cursor: 'pointer',
    letterSpacing: '0.06em',
  },
  configFieldWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  configLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.68rem',
    color: 'var(--secondary)',
    letterSpacing: '0.12em',
  },
  configInput: {
    background: 'transparent',
    border: '1px solid var(--border-emphasis)',
    borderRadius: '0',
    padding: '0.5rem 0.65rem',
    color: 'var(--off-white)',
    fontSize: '0.85rem',
    fontFamily: 'var(--font-body)',
  },
  typeGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
  },
  typeBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    color: 'var(--secondary)',
    background: 'transparent',
    border: '1px solid var(--border-subtle)',
    padding: '0.35rem 0.65rem',
    cursor: 'pointer',
    letterSpacing: '0.06em',
  },
  typeBtnActive: {
    color: 'var(--off-white)',
    border: '1px solid var(--off-white)',
    background: 'rgba(240,236,228,0.06)',
  },
  toggleGroup: {
    display: 'flex',
    gap: '0',
  },
  toggleBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    color: 'var(--secondary)',
    background: 'transparent',
    border: '1px solid var(--border-emphasis)',
    padding: '0.5rem 1.25rem',
    cursor: 'pointer',
    letterSpacing: '0.08em',
  },
  toggleBtnActive: {
    color: 'var(--black)',
    background: 'var(--off-white)',
  },
  modeHint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.7rem',
    color: 'var(--muted)',
    marginTop: '-0.25rem',
  },
  subCriteriaList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    marginBottom: '0.4rem',
  },
  subCriterionRow: {
    display: 'flex',
    gap: '0.4rem',
    alignItems: 'center',
  },
  removeSub: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.7rem',
    color: 'var(--muted)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    padding: '0.25rem',
  },
  addSubBtn: {
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
  fieldNote: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.68rem',
    color: 'var(--muted)',
    fontStyle: 'italic',
  },
  configEmpty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '40vh',
  },
  configEmptyText: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.5rem',
    color: 'var(--muted)',
    textAlign: 'center',
  },
};
