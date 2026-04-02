'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Database } from '@/types/database';

type Delegate    = Database['public']['Tables']['delegates']['Row'];
type SchemaField = Database['public']['Tables']['marking_schema']['Row'];
type Mark        = Database['public']['Tables']['marks']['Row'];

interface Props {
  delegates: Delegate[];
  schema: SchemaField[];
  marks: Mark[];
  isLocked: boolean;
  committeeId: string;
  remoteFlashCells?: Set<string>;
  sessionTag?: string;
  onSaveMark: (
    delegateId: string, fieldId: string, itemIndex: number,
    score: number, subCriterion?: string | null,
    countsTowardFinal?: boolean, isUnsure?: boolean
  ) => Promise<void>;
  onDelegateClick: (idx: number) => void;
}

type TableMode = 'marks' | 'stats';

function getMark(marks: Mark[], delegateId: string, fieldId: string, itemIndex = 1, subCriterion: string | null = null) {
  return marks.find(
    (m) => m.delegate_id === delegateId && m.schema_field_id === fieldId &&
           m.item_index === itemIndex && m.sub_criterion === subCriterion
  );
}

function getFieldTotal(marks: Mark[], delegateId: string, field: SchemaField): number | null {
  const fm = marks.filter((m) => m.delegate_id === delegateId && m.schema_field_id === field.id);
  if (fm.length === 0) return null;
  if (field.scoring_mode === 'average') {
    const scores = fm.filter((m) => m.counts_toward_final).map((m) => m.score);
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  }
  return fm.filter((m) => m.counts_toward_final).reduce((s, m) => s + m.score, 0);
}

function getDelegateTotal(marks: Mark[], delegate: Delegate, schema: SchemaField[]): number {
  return schema.reduce((sum, f) => sum + (getFieldTotal(marks, delegate.id, f) ?? 0), 0);
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

export default function TableView({
  delegates, schema, marks, isLocked,
  remoteFlashCells = new Set(),
  sessionTag,
  onSaveMark, onDelegateClick,
}: Props) {
  const [flashCells, setFlashCells]   = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [tableMode, setTableMode]     = useState<TableMode>('marks');
  const [qMode, setQMode]             = useState(false);   // keyboard quick-mark mode
  const [qFocusKey, setQFocusKey]     = useState<string | null>(null);
  const [unsureCells, setUnsureCells] = useState<Set<string>>(new Set());
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Sorted delegates by total (live rank)
  const rankedDelegates = [...delegates].sort(
    (a, b) => getDelegateTotal(marks, b, schema) - getDelegateTotal(marks, a, schema)
  );

  // Init unsure set from marks
  useEffect(() => {
    const s = new Set<string>();
    for (const m of marks) {
      if ((m as Mark & { is_unsure?: boolean }).is_unsure) {
        s.add(`${m.delegate_id}-${m.schema_field_id}-${m.item_index}-${m.sub_criterion}`);
      }
    }
    setUnsureCells(s);
  }, [marks]);

  // Q key — toggle quick-mark mode
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'q' || e.key === 'Q') {
        setQMode((v) => {
          if (v) setQFocusKey(null);
          return !v;
        });
      }
      if (e.key === 'Escape') { setQMode(false); setQFocusKey(null); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const flashCell = useCallback((key: string) => {
    setFlashCells((p) => new Set(p).add(key));
    setTimeout(() => setFlashCells((p) => { const n = new Set(p); n.delete(key); return n; }), 700);
  }, []);

  async function handleCellSave(
    delegateId: string, fieldId: string, itemIndex: number,
    value: string, subCriterion: string | null = null
  ) {
    const score = parseFloat(value);
    if (isNaN(score) || score < 0) return;
    const cellKey = `${delegateId}-${fieldId}-${itemIndex}-${subCriterion}`;
    const isUnsure = unsureCells.has(cellKey);
    setEditingCell(null);
    await onSaveMark(delegateId, fieldId, itemIndex, score, subCriterion, true, isUnsure);
    flashCell(cellKey);
  }

  function handleContextMenu(e: React.MouseEvent, cellKey: string) {
    e.preventDefault();
    setUnsureCells((prev) => {
      const n = new Set(prev);
      if (n.has(cellKey)) n.delete(cellKey);
      else n.add(cellKey);
      return n;
    });
  }

  // Low participation flag: delegate has marks for < 50% of fields
  function isLowParticipation(delegateId: string): boolean {
    const markedFields = new Set(marks.filter((m) => m.delegate_id === delegateId).map((m) => m.schema_field_id));
    return schema.length > 0 && markedFields.size < schema.length * 0.5;
  }

  if (delegates.length === 0) {
    return <div style={styles.empty}><p style={styles.emptyText}>NO DELEGATES IN THIS COMMITTEE.</p></div>;
  }

  // ── STATS tab ────────────────────────────────────────────────────────────
  if (tableMode === 'stats') {
    const allTotals = delegates.map((d) => getDelegateTotal(marks, d, schema));
    const mean = allTotals.length ? allTotals.reduce((a, b) => a + b, 0) / allTotals.length : 0;
    const sd   = stdDev(allTotals);
    const max  = Math.max(...allTotals, 0);
    const min  = Math.min(...allTotals, Infinity);

    return (
      <div style={styles.root}>
        <TabBar mode={tableMode} onChange={setTableMode} qMode={qMode} />
        <div style={{ ...styles.tableWrap, padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Distribution */}
          <div>
            <p style={styles.statsSectionLabel}>SCORE DISTRIBUTION</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <StatCard label="MEAN"   value={mean.toFixed(2)} />
              <StatCard label="STD DEV" value={sd.toFixed(2)} accent={sd > 15 ? '#e05252' : undefined} />
              <StatCard label="MAX"    value={max.toFixed(1)} />
              <StatCard label="MIN"    value={min === Infinity ? '—' : min.toFixed(1)} />
              <StatCard label="N"      value={String(delegates.length)} />
            </div>
          </div>

          {/* Per-field variance */}
          <div>
            <p style={styles.statsSectionLabel}>PER-FIELD EB CONSISTENCY</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem' }}>
              {schema.map((field) => {
                const vals = delegates.map((d) => getFieldTotal(marks, d.id, field) ?? 0);
                const fsd  = stdDev(vals);
                const highVar = fsd > 10;
                return (
                  <div key={field.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--secondary)', width: '160px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {field.field_name}
                    </span>
                    <div style={{ flex: 1, height: '3px', background: 'var(--color-border)', position: 'relative', maxWidth: '200px' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, (fsd / 20) * 100)}%`, background: highVar ? '#e05252' : '#52c97c', transition: 'width 0.4s' }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: highVar ? '#e05252' : 'var(--muted)', minWidth: '48px' }}>
                      σ={fsd.toFixed(1)}{highVar ? ' ⚠' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Low participation list */}
          <div>
            <p style={styles.statsSectionLabel}>LOW PARTICIPATION FLAGS</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.6rem' }}>
              {delegates.filter((d) => isLowParticipation(d.id)).map((d) => (
                <span key={d.id} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#e05252', border: '1px solid #e0525233', padding: '0.15rem 0.45rem' }}>
                  {d.name}
                </span>
              ))}
              {delegates.filter((d) => isLowParticipation(d.id)).length === 0 && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#444' }}>All delegates marked.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MARKS tab ────────────────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      <TabBar mode={tableMode} onChange={setTableMode} qMode={qMode} />
      {qMode && (
        <div style={styles.qModeBanner}>
          <span>Q MODE ACTIVE — TAB through cells, ENTER to confirm. Press Q or ESC to exit.</span>
        </div>
      )}
      {sessionTag && (
        <div style={styles.sessionTagBanner}>SESSION: {sessionTag}</div>
      )}
      <div style={styles.tableWrap}>
        <table style={styles.table} role="grid" aria-label="Delegate marks table">
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '32px', minWidth: '32px' }}>
                <span style={styles.thText}>#</span>
              </th>
              <th style={{ ...styles.th, ...styles.stickyCol, zIndex: 3 }}>
                <span style={styles.thText}>DELEGATE</span>
              </th>
              {schema.map((field) => (
                <th key={field.id} style={styles.th}>
                  <span style={styles.thText}>{field.field_name}</span>
                  <span style={styles.thType}>{field.field_type}</span>
                </th>
              ))}
              <th style={styles.th}><span style={styles.thText}>TOTAL</span></th>
            </tr>
          </thead>
          <tbody>
            {rankedDelegates.map((delegate, rank) => {
              const total    = getDelegateTotal(marks, delegate, schema);
              const lowPart  = isLowParticipation(delegate.id);

              return (
                <tr key={delegate.id} style={styles.tr}>
                  {/* Live rank */}
                  <td style={{ ...styles.td, textAlign: 'center', padding: '0.35rem 0.4rem' }}>
                    <motion.span
                      layout
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: rank < 3 ? '#e0a952' : '#333' }}
                    >
                      {rank + 1}
                    </motion.span>
                  </td>

                  {/* Delegate name */}
                  <td style={{ ...styles.td, ...styles.stickyCol }}>
                    <button
                      onClick={() => onDelegateClick(delegates.indexOf(delegate))}
                      style={styles.delegateBtn}
                      aria-label={`Open delegate view for ${delegate.name}`}
                    >
                      <span style={{ ...styles.delegateName, color: lowPart ? '#e05252' : 'var(--off-white)' }}>
                        {delegate.name}
                      </span>
                      {lowPart && <span title="Low participation" style={styles.flagDot}>!</span>}
                    </button>
                  </td>

                  {/* Score cells */}
                  {schema.map((field) => {
                    const mark      = getMark(marks, delegate.id, field.id);
                    const fieldTotal = getFieldTotal(marks, delegate.id, field);
                    const cellKey   = `${delegate.id}-${field.id}-1-null`;
                    const isFlash   = flashCells.has(cellKey) || remoteFlashCells.has(cellKey);
                    const isEdit    = editingCell === cellKey;
                    const isUnsure  = unsureCells.has(cellKey);

                    return (
                      <td
                        key={field.id}
                        style={styles.td}
                        onContextMenu={(e) => handleContextMenu(e, cellKey)}
                        title={isUnsure ? 'Marked as unsure (right-click to toggle)' : 'Right-click to mark as unsure'}
                      >
                        <AnimatePresence>
                          {isFlash && (
                            <motion.div key="flash"
                              initial={{ opacity: 0.5 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
                              transition={{ duration: 0.6 }} style={styles.flashOverlay}
                            />
                          )}
                        </AnimatePresence>
                        {isUnsure && <span style={styles.unsureDot} title="Unsure" />}

                        {!isLocked || isEdit ? (
                          <CellInput
                            defaultValue={mark?.score ?? ''}
                            disabled={isLocked && !isEdit}
                            qMode={qMode}
                            isFocused={qFocusKey === cellKey}
                            onSave={(v) => handleCellSave(delegate.id, field.id, 1, v)}
                            onFocus={() => { setEditingCell(cellKey); if (qMode) setQFocusKey(cellKey); }}
                            onBlur={() => setEditingCell(null)}
                            inputRef={(el) => { if (el) inputRefs.current.set(cellKey, el); else inputRefs.current.delete(cellKey); }}
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
                    <motion.span layout style={styles.totalScore}>
                      {total > 0 ? total.toFixed(1) : '—'}
                    </motion.span>
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

// ── Sub-components ─────────────────────────────────────────────────────────

function TabBar({ mode, onChange, qMode }: { mode: TableMode; onChange: (m: TableMode) => void; qMode: boolean }) {
  return (
    <div style={styles.tabBar}>
      {(['marks', 'stats'] as TableMode[]).map((t) => (
        <button key={t} onClick={() => onChange(t)} style={{ ...styles.tab, ...(mode === t ? styles.tabActive : {}) }}>
          {t.toUpperCase()}
        </button>
      ))}
      <div style={styles.tabSpacer} />
      <span style={{ ...styles.qBadge, opacity: qMode ? 1 : 0.25 }}>Q</span>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ padding: '0.5rem 0.85rem', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '0.1rem', minWidth: '80px' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.56rem', color: '#444', letterSpacing: '0.08em' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', color: accent ?? '#f0ece4', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function CellInput({ defaultValue, disabled, qMode, isFocused, onSave, onFocus, onBlur, inputRef }: {
  defaultValue: number | string; disabled: boolean; qMode: boolean; isFocused: boolean;
  onSave: (v: string) => void; onFocus: () => void; onBlur: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  const [value, setValue] = useState(String(defaultValue));

  useEffect(() => {
    setValue(String(defaultValue));
  // Only sync when external value changes (realtime), not on every keystroke
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue]);

  return (
    <input
      ref={inputRef}
      type="text" inputMode="numeric" value={value}
      onChange={(e) => { if (/^[\d.]*$/.test(e.target.value)) setValue(e.target.value); }}
      onFocus={(e) => { e.currentTarget.select(); onFocus(); }}
      onBlur={() => { onBlur(); onSave(value); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || (qMode && e.key === 'Tab')) e.currentTarget.blur();
        if (e.key === 'Escape') { setValue(String(defaultValue)); e.currentTarget.blur(); }
      }}
      disabled={disabled} min={0} step={0.5}
      style={{
        ...styles.cellInput,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'default' : 'text',
        outline: isFocused ? '1px solid var(--color-accent)' : 'none',
      }}
      aria-label="Score"
    />
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  tabBar: { display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--color-border)', flexShrink: 0, padding: '0 1rem' },
  tab: { fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.1em', color: 'var(--muted)', background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '0.45rem 0.65rem', cursor: 'pointer' },
  tabActive: { color: 'var(--off-white)', borderBottomColor: 'var(--off-white)' },
  tabSpacer: { flex: 1 },
  qBadge: { fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', padding: '0.1rem 0.35rem', letterSpacing: '0.08em', transition: 'opacity 0.2s' },
  qModeBanner: { fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--color-accent)', background: '#c9b99a0d', borderBottom: '1px solid #c9b99a22', padding: '0.3rem 1.5rem', letterSpacing: '0.04em' },
  sessionTagBanner: { fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#444', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '0.25rem 1.5rem', letterSpacing: '0.08em' },
  tableWrap: { flex: 1, overflowX: 'auto', overflowY: 'auto' },
  table: { borderCollapse: 'collapse', width: '100%', minWidth: '600px' },
  th: { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)', background: '#080808', textAlign: 'left', verticalAlign: 'bottom', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2 },
  thText: { display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--off-white)', letterSpacing: '0.08em' },
  thType: { display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--muted)', letterSpacing: '0.06em', marginTop: '1px' },
  tr: { borderBottom: '1px solid var(--border-subtle)' },
  td: { padding: '0.35rem 0.6rem', borderRight: '1px solid var(--border-subtle)', position: 'relative', verticalAlign: 'middle', background: 'var(--black)', minWidth: '80px' },
  stickyCol: { position: 'sticky', left: '32px', background: 'var(--color-surface)', zIndex: 1, minWidth: '140px', maxWidth: '200px' },
  delegateBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', textAlign: 'left', padding: '0.15rem 0' },
  delegateName: { fontFamily: 'var(--font-mono)', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  flagDot: { fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#e05252', flexShrink: 0 },
  cellInput: { background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)', color: 'var(--off-white)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', padding: '0.2rem 0.25rem', width: '100%', borderRadius: 0 },
  cellScore: { fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--secondary)' },
  flashOverlay: { position: 'absolute', inset: 0, background: 'rgba(240,236,228,0.18)', pointerEvents: 'none', zIndex: 1 },
  unsureDot: { position: 'absolute', top: '4px', right: '4px', width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-warning)', pointerEvents: 'none' },
  totalCell: { background: 'var(--color-surface)', position: 'sticky', right: 0 },
  totalScore: { fontFamily: 'var(--font-mono)', fontSize: '0.95rem', color: 'var(--off-white)', fontWeight: 500 },
  empty: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' },
  emptyText: { fontFamily: 'var(--font-heading)', fontSize: '1.5rem', color: 'var(--muted)' },
  statsSectionLabel: { fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: '#444', letterSpacing: '0.1em' },
};
