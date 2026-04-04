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
    const maxT = Math.max(...allTotals, 0);
    const minT = allTotals.length ? Math.min(...allTotals) : 0;
    const sorted = [...allTotals].sort((a, b) => a - b);
    const median = sorted.length ? (sorted.length % 2 === 0 ? (sorted[sorted.length/2-1] + sorted[sorted.length/2]) / 2 : sorted[Math.floor(sorted.length/2)]) : 0;

    return (
      <div style={styles.root}>
        <TabBar mode={tableMode} onChange={setTableMode} qMode={qMode} />
        <div style={{ ...styles.tableWrap, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* Committee health summary */}
          <div>
            <p style={styles.statsSectionLabel}>COMMITTEE HEALTH</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <StatCard label="MEAN"   value={mean.toFixed(2)} />
              <StatCard label="MEDIAN" value={median.toFixed(2)} />
              <StatCard label="STD DEV" value={sd.toFixed(2)} accent={sd > 15 ? '#e05252' : undefined} />
              <StatCard label="MAX"    value={maxT.toFixed(1)} />
              <StatCard label="MIN"    value={minT.toFixed(1)} />
              <StatCard label="N"      value={String(delegates.length)} />
            </div>
          </div>

          {/* Per-field breakdown */}
          <div>
            <p style={styles.statsSectionLabel}>PER-FIELD BREAKDOWN</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.75rem' }}>
              {schema.map((field) => {
                const vals = delegates.map((d) => getFieldTotal(marks, d.id, field) ?? 0).filter(v => v > 0);
                if (vals.length === 0) return null;
                const fMean = vals.reduce((a, b) => a + b, 0) / vals.length;
                const fSorted = [...vals].sort((a, b) => a - b);
                const fMedian = fSorted.length % 2 === 0 ? (fSorted[fSorted.length/2-1] + fSorted[fSorted.length/2]) / 2 : fSorted[Math.floor(fSorted.length/2)];
                const fMax = Math.max(...vals);
                const fMin = Math.min(...vals);
                const fSd  = stdDev(vals);
                const highVar = fSd > field.max_score * 0.3;

                return (
                  <div key={field.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#888', letterSpacing: '0.08em' }}>
                        {field.field_name}
                      </span>
                      {highVar && <span style={{ fontSize: '10px', color: '#e0a952' }}>△ HIGH VARIANCE</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      <StatCard label="MEAN" value={fMean.toFixed(1)} />
                      <StatCard label="MED"  value={fMedian.toFixed(1)} />
                      <StatCard label="MAX"  value={fMax.toFixed(1)} />
                      <StatCard label="MIN"  value={fMin.toFixed(1)} />
                      <StatCard label="σ"    value={fSd.toFixed(1)} accent={highVar ? '#e0a952' : undefined} />
                    </div>
                    {/* Distribution bar */}
                    <div style={{ position: 'relative', height: '18px', background: '#0c0c0c', marginTop: '0.25rem', maxWidth: '400px', overflow: 'hidden' }}>
                      {vals.map((v, i) => {
                        const pct = field.max_score > 0 ? (v / field.max_score) * 100 : 0;
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: '100%' }}
                            transition={{ delay: i * 0.015, duration: 0.3, ease: 'easeOut' }}
                            style={{
                              position: 'absolute', bottom: 0,
                              left: `${pct}%`, width: '1px',
                              background: 'rgba(240,236,228,0.18)',
                            }}
                          />
                        );
                      })}
                      {/* Mean line */}
                      <motion.div
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                          position: 'absolute', bottom: 0,
                          left: `${field.max_score > 0 ? (fMean / field.max_score) * 100 : 0}%`,
                          width: '2px', height: '100%',
                          background: '#52c97c', transformOrigin: 'bottom',
                          boxShadow: '0 0 6px rgba(82,201,124,0.5)',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '400px', marginTop: '2px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#333' }}>0</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#333' }}>{field.max_score}</span>
                    </div>
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
              const rowBg    = rank % 2 === 0 ? '#080808' : '#0b0b0b';

              return (
                <motion.tr
                  key={delegate.id}
                  layout
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30, delay: rank * 0.018 }}
                  className="mark-row"
                  style={{ ...styles.tr, background: rowBg }}
                >
                  {/* Live rank */}
                  <td style={{ ...styles.td, textAlign: 'center', padding: '0.35rem 0.4rem', background: rowBg }}>
                    <motion.span
                      layout
                      animate={{ scale: [1.4, 1] }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className={rank < 3 ? 'rank-pop' : undefined}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', fontWeight: 700, color: rank < 3 ? '#e0a952' : '#444', display: 'block' }}
                    >
                      {rank + 1}
                    </motion.span>
                  </td>

                  {/* Delegate name */}
                  <td style={{ ...styles.td, ...styles.stickyCol, background: rowBg }}>
                    <button
                      onClick={() => onDelegateClick(delegates.indexOf(delegate))}
                      style={styles.delegateBtn}
                      aria-label={`Open delegate view for ${delegate.name}`}
                    >
                      <span style={{
                        ...styles.delegateName,
                        color: lowPart ? '#e05252' : 'var(--off-white)',
                        fontFamily: 'var(--font-heading)',
                        fontWeight: 700,
                        fontSize: '14px',
                      }}>
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
                        style={{ ...styles.td, background: rowBg }}
                        onContextMenu={(e) => handleContextMenu(e, cellKey)}
                        title={isUnsure ? 'Marked as unsure (right-click to toggle)' : 'Right-click to mark as unsure'}
                      >
                        <AnimatePresence>
                          {isFlash && (
                            <motion.div key="flash"
                              initial={{ opacity: 0.6 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
                              transition={{ duration: 0.7 }} style={styles.flashOverlay}
                            />
                          )}
                        </AnimatePresence>
                        {isUnsure && <span style={styles.unsureDot} title="Unsure ◈" aria-label="Unsure">◈</span>}

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
                </motion.tr>
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
        <button key={t} onClick={() => onChange(t)}
          style={{ ...styles.tab, ...(mode === t ? styles.tabActive : {}), position: 'relative', overflow: 'hidden', transition: 'color 0.2s' }}>
          {mode === t && (
            <motion.span
              layoutId="table-tab-pill"
              style={{ position: 'absolute', inset: 0, background: 'rgba(240,236,228,0.05)', zIndex: 0,
                borderBottom: '1.5px solid rgba(240,236,228,0.35)' }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            />
          )}
          <span style={{ position: 'relative', zIndex: 1 }}>{t.toUpperCase()}</span>
        </button>
      ))}
      <div style={styles.tabSpacer} />
      <motion.span
        animate={{ opacity: qMode ? 1 : 0.2, scale: qMode ? 1.05 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{ ...styles.qBadge, boxShadow: qMode ? '0 0 10px rgba(201,185,154,0.3)' : 'none' }}
      >Q</motion.span>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="glow-hover"
      style={{ padding: '0.5rem 0.85rem', border: `1px solid ${accent ? accent + '44' : 'var(--color-border)'}`,
        display: 'flex', flexDirection: 'column', gap: '0.1rem', minWidth: '80px',
        background: accent ? `${accent}08` : 'transparent',
        transition: 'border-color 0.2s',
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.56rem', color: accent ?? '#555', letterSpacing: '0.08em' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', color: accent ?? '#f0ece4', fontWeight: 500 }}>{value}</span>
    </motion.div>
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
      className="cell-glow"
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
  tr: { borderBottom: '1px solid #111', minHeight: '52px' },
  td: { padding: '0.5rem 0.75rem', borderRight: '1px solid #111', position: 'relative', verticalAlign: 'middle', minWidth: '80px', minHeight: '52px', height: '52px' },
  stickyCol: { position: 'sticky', left: '44px', zIndex: 1, minWidth: '160px', maxWidth: '220px' },
  delegateBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', textAlign: 'left', padding: '0.15rem 0', minHeight: '36px' },
  delegateName: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  flagDot: { fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#e05252', flexShrink: 0 },
  cellInput: { background: 'transparent', border: 'none', borderBottom: '1px solid #222', color: 'var(--off-white)', fontFamily: 'var(--font-mono)', fontSize: '0.88rem', fontWeight: 700, padding: '0.2rem 0.25rem', width: '100%', borderRadius: 0, minHeight: '36px' },
  cellScore: { fontFamily: 'var(--font-mono)', fontSize: '0.88rem', fontWeight: 700, color: 'var(--secondary)' },
  flashOverlay: { position: 'absolute', inset: 0, background: 'rgba(240,236,228,0.22)', pointerEvents: 'none', zIndex: 1 },
  unsureDot: { position: 'absolute', top: '3px', right: '3px', fontSize: '10px', color: 'var(--color-warning)', pointerEvents: 'none', lineHeight: 1 },
  totalCell: { background: 'var(--color-surface)', position: 'sticky', right: 0 },
  totalScore: { fontFamily: 'var(--font-mono)', fontSize: '1rem', color: 'var(--off-white)', fontWeight: 700 },
  empty: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' },
  emptyText: { fontFamily: 'var(--font-heading)', fontSize: '1.5rem', color: 'var(--muted)' },
  statsSectionLabel: { fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: '#444', letterSpacing: '0.1em' },
};
