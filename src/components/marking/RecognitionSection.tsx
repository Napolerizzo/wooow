'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RecognitionType {
  id: string;
  name: string;
  sort_order: number;
}

interface RecognitionEntry {
  id: string;
  delegate_id: string;
  recognition_type_id: string;
  count: number;
}

interface Delegate {
  id: string;
  name: string;
  country?: string | null;
  roll_call_status?: string | null;
}

interface Props {
  committeeId: string;
  delegates: Delegate[];
}

const PRESET_TYPES = [
  { name: 'POI',              emoji: '🙋' },
  { name: 'POO',              emoji: '🔔' },
  { name: 'POI REPLIES',      emoji: '↩️' },
  { name: 'SPEECH',           emoji: '🎤' },
  { name: 'DOC',              emoji: '📄' },
  { name: 'POI CHIT',         emoji: '📝' },
  { name: 'SUBSTANTIVE CHIT', emoji: '📋' },
];

export default function RecognitionSection({ committeeId, delegates }: Props) {
  const [open, setOpen] = useState(true);
  const [types, setTypes] = useState<RecognitionType[]>([]);
  const [entries, setEntries] = useState<RecognitionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingType, setAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const load = useCallback(async () => {
    const res = await fetch(`/api/committee/${committeeId}/recognitions`);
    if (res.ok) {
      const d = await res.json();
      setTypes(d.types ?? []);
      setEntries(d.entries ?? []);
    }
    setLoading(false);
  }, [committeeId]);

  useEffect(() => { load(); }, [load]);

  function getCount(delegateId: string, typeId: string): number {
    return entries.find((e) => e.delegate_id === delegateId && e.recognition_type_id === typeId)?.count ?? 0;
  }

  function setCount(delegateId: string, typeId: string, count: number) {
    setEntries((prev) => {
      const existing = prev.find((e) => e.delegate_id === delegateId && e.recognition_type_id === typeId);
      if (existing) return prev.map((e) => e.delegate_id === delegateId && e.recognition_type_id === typeId ? { ...e, count } : e);
      return [...prev, { id: `local-${delegateId}-${typeId}`, delegate_id: delegateId, recognition_type_id: typeId, count }];
    });

    const key = `${delegateId}-${typeId}`;
    const existing = saveTimers.current.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(async () => {
      saveTimers.current.delete(key);
      await fetch(`/api/committee/${committeeId}/recognitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert_entry', delegate_id: delegateId, recognition_type_id: typeId, count }),
      });
    }, 500);
    saveTimers.current.set(key, t);
  }

  async function addType(name?: string) {
    const finalName = (name ?? newTypeName).trim();
    if (!finalName) return;
    const sort_order = types.length;
    const res = await fetch(`/api/committee/${committeeId}/recognitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert_type', name: finalName, sort_order }),
    });
    if (res.ok) {
      setNewTypeName('');
      setAddingType(false);
      setShowPresets(false);
      load();
    }
  }

  async function addPresetType(name: string) {
    if (types.some((t) => t.name.toUpperCase() === name.toUpperCase())) return;
    const sort_order = types.length;
    const res = await fetch(`/api/committee/${committeeId}/recognitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert_type', name, sort_order }),
    });
    if (res.ok) load();
  }

  async function deleteType(id: string) {
    await fetch(`/api/committee/${committeeId}/recognitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_type', id }),
    });
    setTypes((prev) => prev.filter((t) => t.id !== id));
    setEntries((prev) => prev.filter((e) => e.recognition_type_id !== id));
  }

  // Totals
  const totalByType = types.map((t) => ({
    typeId: t.id,
    name: t.name,
    total: delegates.reduce((s, d) => s + getCount(d.id, t.id), 0),
  }));
  const totalByDelegate = delegates.map((d) => ({
    delegateId: d.id,
    total: types.reduce((s, t) => s + getCount(d.id, t.id), 0),
  }));

  const grandTotal = totalByType.reduce((s, x) => s + x.total, 0);
  const activeDelegates = delegates.filter((d) => d.roll_call_status !== 'absent');

  const availablePresets = PRESET_TYPES.filter(
    (p) => !types.some((t) => t.name.toUpperCase() === p.name.toUpperCase())
  );

  return (
    <div style={styles.root}>
      {/* Header */}
      <button style={styles.header} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span style={styles.headerLeft}>
          <span style={styles.dot} />
          <span style={styles.headerLabel}>RECOGNITIONS</span>
          <span style={styles.headerSub}>
            {types.length > 0
              ? types.map((t) => {
                  const tot = totalByType.find((x) => x.typeId === t.id)?.total ?? 0;
                  return `${t.name} ${tot}`;
                }).join(' · ')
              : 'Click to configure recognition types'}
          </span>
        </span>
        {grandTotal > 0 && (
          <span style={styles.headerGrandTotal}>{grandTotal} total</span>
        )}
        <span style={{ ...styles.chevron, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={styles.body}>
              {loading ? (
                <p style={styles.hint}>Loading...</p>
              ) : (
                <>
                  {/* Preset quick-add strip */}
                  {availablePresets.length > 0 && (
                    <div style={styles.presetStrip}>
                      <span style={styles.presetLabel}>QUICK ADD</span>
                      <div style={styles.presetChips}>
                        {availablePresets.map((p) => (
                          <button
                            key={p.name}
                            style={styles.presetChip}
                            onClick={() => addPresetType(p.name)}
                            title={`Add ${p.name} column`}
                          >
                            {p.name}
                          </button>
                        ))}
                        <button
                          style={styles.addAllBtn}
                          onClick={async () => {
                            for (const p of availablePresets) {
                              await addPresetType(p.name);
                            }
                          }}
                          title="Add all preset types at once"
                        >
                          + ALL
                        </button>
                      </div>
                    </div>
                  )}

                  {types.length === 0 && !addingType ? (
                    <div style={styles.emptyState}>
                      <p style={styles.hint}>No recognition types yet. Use quick-add above or create a custom type.</p>
                      <button style={styles.addTypeBtn} onClick={() => setAddingType(true)}>+ CUSTOM</button>
                    </div>
                  ) : (
                    <>
                      {/* Table */}
                      <div style={{ overflowX: 'auto', marginTop: availablePresets.length > 0 ? 12 : 0 }}>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              <th style={{ ...styles.th, textAlign: 'left', minWidth: 140 }}>DELEGATE</th>
                              {types.map((t) => (
                                <th key={t.id} style={styles.th}>
                                  <div style={styles.typeHeader}>
                                    <span style={styles.typeName}>{t.name}</span>
                                    <button
                                      style={styles.deleteTypeBtn}
                                      onClick={() => deleteType(t.id)}
                                      title={`Remove ${t.name}`}
                                      aria-label={`Delete ${t.name}`}
                                    >×</button>
                                  </div>
                                  <div style={styles.typeTotal}>
                                    {totalByType.find((x) => x.typeId === t.id)?.total ?? 0}
                                  </div>
                                </th>
                              ))}
                              <th style={{ ...styles.th, color: '#666', borderLeft: '1px solid #2a2a2a' }}>TOTAL</th>
                              {addingType && (
                                <th style={styles.th}>
                                  <input
                                    autoFocus
                                    value={newTypeName}
                                    onChange={(e) => setNewTypeName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') addType();
                                      if (e.key === 'Escape') { setAddingType(false); setNewTypeName(''); }
                                    }}
                                    placeholder="NAME…"
                                    style={styles.newTypeInput}
                                    maxLength={20}
                                    aria-label="New recognition type name"
                                  />
                                  <div style={styles.newTypeBtns}>
                                    <button style={styles.confirmBtn} onClick={() => addType()}>✓</button>
                                    <button style={styles.cancelBtn} onClick={() => { setAddingType(false); setNewTypeName(''); }}>✕</button>
                                  </div>
                                </th>
                              )}
                              <th style={styles.addColTh}>
                                {!addingType && (
                                  <button style={styles.addTypeBtn} onClick={() => setAddingType(true)} title="Add custom recognition type">+</button>
                                )}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeDelegates.map((d) => {
                              const delegateTotal = totalByDelegate.find((x) => x.delegateId === d.id)?.total ?? 0;
                              return (
                                <tr key={d.id} style={styles.tr}>
                                  <td style={styles.nameTd}>
                                    <span style={styles.delegateName}>{d.name}</span>
                                    {d.country && <span style={styles.delegateCountry}>{d.country}</span>}
                                  </td>
                                  {types.map((t) => (
                                    <td key={t.id} style={styles.countTd}>
                                      <input
                                        type="number"
                                        min={0}
                                        max={999}
                                        value={getCount(d.id, t.id)}
                                        onChange={(e) => setCount(d.id, t.id, Math.max(0, parseInt(e.target.value, 10) || 0))}
                                        onFocus={(e) => e.target.select()}
                                        style={styles.countInput}
                                        aria-label={`${d.name} ${t.name} count`}
                                      />
                                    </td>
                                  ))}
                                  <td style={{ ...styles.countTd, color: '#888', fontWeight: 700, borderLeft: '1px solid #2a2a2a' }}>
                                    {delegateTotal}
                                  </td>
                                  {addingType && <td style={styles.countTd} />}
                                  <td style={styles.countTd} />
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Committee totals summary */}
                      {types.length > 0 && (
                        <div style={styles.totalsSection}>
                          <div style={styles.totalsLabel}>COMMITTEE TOTALS</div>
                          <div style={styles.totalsGrid}>
                            {totalByType.map((t) => (
                              <div key={t.typeId} style={styles.totalChip}>
                                <span style={styles.totalChipName}>{t.name}</span>
                                <span style={styles.totalChipValue}>{t.total}</span>
                              </div>
                            ))}
                            <div style={{ ...styles.totalChip, ...styles.totalChipGrand }}>
                              <span style={styles.totalChipName}>GRAND TOTAL</span>
                              <span style={{ ...styles.totalChipValue, ...styles.totalChipGrandValue }}>{grandTotal}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    borderBottom: '1px solid #1e1e1e',
    background: '#080808',
  },
  header: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
    textAlign: 'left', gap: '8px',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 },
  dot: { width: 6, height: 6, borderRadius: '50%', background: '#e0a952', flexShrink: 0 },
  headerLabel: {
    fontFamily: 'var(--font-body)', fontSize: '10px', letterSpacing: '0.1em',
    color: '#888', flexShrink: 0,
  },
  headerSub: {
    fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#444',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  headerGrandTotal: {
    fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#e0a952',
    fontWeight: 700, flexShrink: 0, marginRight: 4,
  },
  chevron: {
    fontSize: '12px', color: '#444', flexShrink: 0,
    transition: 'transform 0.2s',
  },
  body: { padding: '0 20px 16px' },
  hint: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#555', marginBottom: '12px' },

  // Preset strip
  presetStrip: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 0 4px', flexWrap: 'wrap',
  },
  presetLabel: {
    fontFamily: 'var(--font-body)', fontSize: '8px', letterSpacing: '0.12em',
    color: '#444', flexShrink: 0,
  },
  presetChips: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' },
  presetChip: {
    background: 'none', border: '1px solid #252525', color: '#666',
    fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.06em',
    cursor: 'pointer', padding: '3px 8px',
    transition: 'color 0.15s, border-color 0.15s',
  },
  addAllBtn: {
    background: 'none', border: '1px solid #333', color: '#e0a952',
    fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.06em',
    cursor: 'pointer', padding: '3px 8px',
    transition: 'color 0.15s, border-color 0.15s',
  },

  emptyState: { display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' },
  table: { borderCollapse: 'collapse', width: '100%', minWidth: 'max-content' },
  th: {
    fontFamily: 'var(--font-body)', fontSize: '9px', letterSpacing: '0.1em', color: '#555',
    padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid #1e1e1e',
    whiteSpace: 'nowrap',
  },
  typeHeader: { display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' },
  typeName: { fontFamily: 'var(--font-body)', fontSize: '9px', letterSpacing: '0.08em', color: '#777' },
  typeTotal: { fontSize: '14px', fontFamily: 'var(--font-mono)', color: '#888', marginTop: '2px' },
  deleteTypeBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#2a2a2a',
    fontSize: '12px', padding: '0 2px', lineHeight: 1,
    transition: 'color 0.15s',
  },
  addColTh: { padding: '4px', width: '36px' },
  newTypeInput: {
    background: '#111', border: '1px solid #333', color: '#f0ece4',
    fontFamily: 'var(--font-mono)', fontSize: '10px', padding: '4px 6px',
    width: '80px', outline: 'none',
  },
  newTypeBtns: { display: 'flex', gap: '4px', marginTop: '4px', justifyContent: 'center' },
  confirmBtn: {
    background: 'none', border: '1px solid #333', color: '#52c97c',
    cursor: 'pointer', fontSize: '11px', padding: '2px 6px',
  },
  cancelBtn: {
    background: 'none', border: '1px solid #1e1e1e', color: '#555',
    cursor: 'pointer', fontSize: '11px', padding: '2px 6px',
  },
  addTypeBtn: {
    background: 'none', border: '1px solid #2a2a2a', color: '#555',
    fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em',
    cursor: 'pointer', padding: '4px 10px',
    transition: 'color 0.15s, border-color 0.15s',
  },
  tr: { borderBottom: '1px solid #111' },
  nameTd: {
    padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: '1px',
  },
  delegateName: { fontFamily: 'var(--font-body)', fontSize: '12px', color: '#d0cbc3' },
  delegateCountry: { fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#444' },
  countTd: { padding: '6px 8px', textAlign: 'center', verticalAlign: 'middle' },
  countInput: {
    width: '48px', textAlign: 'center',
    background: '#111', border: '1px solid #1e1e1e', color: '#f0ece4',
    fontFamily: 'var(--font-mono)', fontSize: '13px', padding: '4px 2px',
    outline: 'none', appearance: 'textfield',
    MozAppearance: 'textfield',
  } as React.CSSProperties,

  // Committee totals section
  totalsSection: {
    marginTop: '16px',
    padding: '12px 0 0',
    borderTop: '1px solid #1e1e1e',
  },
  totalsLabel: {
    fontFamily: 'var(--font-body)', fontSize: '8px', letterSpacing: '0.12em',
    color: '#444', marginBottom: '8px',
  },
  totalsGrid: {
    display: 'flex', flexWrap: 'wrap', gap: '6px',
  },
  totalChip: {
    display: 'flex', flexDirection: 'column', gap: '2px',
    padding: '6px 12px',
    border: '1px solid #1e1e1e',
    background: '#0d0d0d',
    minWidth: '70px',
  },
  totalChipName: {
    fontFamily: 'var(--font-body)', fontSize: '7px', letterSpacing: '0.1em',
    color: '#444', whiteSpace: 'nowrap',
  },
  totalChipValue: {
    fontFamily: 'var(--font-mono)', fontSize: '18px', color: '#888',
    fontWeight: 700, lineHeight: 1,
  },
  totalChipGrand: {
    border: '1px solid #2a2a2a',
    background: '#0f0f0f',
  },
  totalChipGrandValue: {
    color: '#e0a952', fontSize: '22px',
  },
};
