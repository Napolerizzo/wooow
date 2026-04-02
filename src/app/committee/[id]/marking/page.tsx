'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useSaveStatus } from '@/lib/save-status';
import type { Database } from '@/types/database';
import TableView from '@/components/marking/TableView';
import DelegateView from '@/components/marking/DelegateView';
import RollCallSection from '@/components/marking/RollCallSection';
import ErrorOverlay from '@/components/ErrorOverlay';

type Delegate   = Database['public']['Tables']['delegates']['Row'];
type SchemaField = Database['public']['Tables']['marking_schema']['Row'];
type Mark       = Database['public']['Tables']['marks']['Row'];
type ViewMode   = 'table' | 'delegate';

interface OnlineUser { id: string; name: string; color: string; }

const PRESENCE_COLORS = ['#e0a952','#52c97c','#5296e0','#e05252','#a952e0','#52dde0'];

export default function MarkingPage() {
  const params = useParams();
  const committeeId = params?.id as string;
  const { setStatus: setSaveStatus } = useSaveStatus();

  const [isMobile, setIsMobile]   = useState(false);
  const [mode, setMode]           = useState<ViewMode>('table');
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [schema, setSchema]       = useState<SchemaField[]>([]);
  const [marks, setMarks]         = useState<Mark[]>([]);
  const [isLocked, setIsLocked]         = useState(false);
  const [quorumFraction, setQuorumFraction] = useState(0.25);
  const [loading, setLoading]     = useState(true);
  const [fatalError, setFatalError] = useState('');
  const [selectedDelegateIdx, setSelectedDelegateIdx] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [realtimeConnected, setRealtimeConnected] = useState(true);
  const [remoteFlashCells, setRemoteFlashCells]   = useState<Set<string>>(new Set());
  const [sessionTag, setSessionTag]               = useState('');
  const [editingSessionTag, setEditingSessionTag] = useState(false);
  const [showAddDelegate, setShowAddDelegate]     = useState(false);

  const supabaseRef           = useRef(createClient());
  const reconnectTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef  = useRef(0);
  // debounce timers per cell key
  const debounceTimers        = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // track which cell last triggered local save so we don't double-flash
  const localSaveCells        = useRef<Set<string>>(new Set());

  useEffect(() => {
    function checkMobile() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setMode('delegate');
    }
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [postLockModal, setPostLockModal] = useState<{
    delegateId: string; fieldId: string; itemIndex: number;
    subCriterion: string | null; currentScore: number;
  } | null>(null);
  const [postLockNote, setPostLockNote] = useState('');

  const loadAll = useCallback(async () => {
    const [dRes, sRes, mRes, cRes] = await Promise.all([
      fetch(`/api/committee/${committeeId}/delegates`),
      fetch(`/api/committee/${committeeId}/schema`),
      fetch(`/api/committee/${committeeId}/marks`),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseRef.current as any).from('committees').select('is_locked, quorum_fraction').eq('id', committeeId).single(),
    ]);
    if (dRes.ok) { const d = await dRes.json(); setDelegates(d.delegates ?? []); }
    if (sRes.ok) { const s = await sRes.json(); setSchema(s.schema ?? []); }
    if (mRes.ok) { const m = await mRes.json(); setMarks(m.marks ?? []); }
    if (!cRes.error && cRes.data) {
      const row = cRes.data as { is_locked: boolean; quorum_fraction?: number };
      setIsLocked(row.is_locked);
      if (typeof row.quorum_fraction === 'number') setQuorumFraction(row.quorum_fraction);
    }
    setLoading(false);
  }, [committeeId]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (loading) { setLoading(false); setFatalError('Could not load marking data. Check your connection.'); }
    }, 15000);
    return () => clearTimeout(t);
  }, [loading]);

  // Realtime + presence
  useEffect(() => {
    if (!committeeId) return;
    loadAll();

    const supabase = supabaseRef.current;

    // -- marks + delegates changes --
    const marksChannel = supabase
      .channel(`marks:${committeeId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'marks',
        filter: `committee_id=eq.${committeeId}`,
      }, (payload) => {
        if (payload.new && (payload.new as Mark).committee_id !== committeeId) return;
        if (payload.old && (payload.old as Mark).committee_id !== committeeId) return;

        setMarks((prev) => {
          if (payload.eventType === 'INSERT') return [...prev, payload.new as Mark];
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Mark;
            // Flash cell if update came from another session (not our debounce)
            const cellKey = `${updated.delegate_id}-${updated.schema_field_id}-${updated.item_index}-${updated.sub_criterion}`;
            if (!localSaveCells.current.has(cellKey)) {
              setRemoteFlashCells((s) => new Set(s).add(cellKey));
              setTimeout(() => {
                setRemoteFlashCells((s) => { const n = new Set(s); n.delete(cellKey); return n; });
              }, 800);
            }
            return prev.map((m) => m.id === updated.id ? updated : m);
          }
          if (payload.eventType === 'DELETE') {
            return prev.filter((m) => m.id !== (payload.old as { id: string }).id);
          }
          return prev;
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'delegates',
        filter: `committee_id=eq.${committeeId}`,
      }, (payload) => {
        if ((payload.new as Delegate).committee_id !== committeeId) return;
        setDelegates((prev) =>
          prev.map((d) => d.id === (payload.new as Delegate).id ? (payload.new as Delegate) : d)
        );
      })
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR') {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current += 1;
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            supabase.removeChannel(marksChannel);
            loadAll();
          }, delay);
        } else if (status === 'SUBSCRIBED') {
          reconnectAttemptsRef.current = 0;
        }
      });

    // -- presence channel --
    const presenceChannel = supabase.channel(`presence:${committeeId}`, {
      config: { presence: { key: committeeId } },
    });

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('display_name').eq('id', user.id).single()
        .then(({ data }) => {
          const name = data?.display_name ?? user.email?.split('@')[0] ?? 'User';
          const color = PRESENCE_COLORS[Math.abs(user.id.charCodeAt(0) + user.id.charCodeAt(1)) % PRESENCE_COLORS.length];

          presenceChannel
            .on('presence', { event: 'sync' }, () => {
              const state = presenceChannel.presenceState();
              const users: OnlineUser[] = [];
              for (const key of Object.keys(state)) {
                const entries = state[key] as unknown as Array<{ userId: string; name: string; color: string }>;
                for (const e of entries) {
                  if (e.userId !== user.id) users.push({ id: e.userId, name: e.name, color: e.color });
                }
              }
              setOnlineUsers(users);
            })
            .subscribe(async (s) => {
              if (s === 'SUBSCRIBED') {
                await presenceChannel.track({ userId: user.id, name, color });
              }
            });
        });
    });

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      supabase.removeChannel(marksChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [committeeId, loadAll]);

  // 600ms debounced save per cell
  const saveMark = useCallback(async (
    delegateId: string, fieldId: string, itemIndex: number,
    score: number, subCriterion: string | null = null,
    countsTowardFinal = true, isUnsure = false
  ) => {
    if (isLocked) {
      const existing = marks.find(
        (m) => m.delegate_id === delegateId && m.schema_field_id === fieldId &&
               m.item_index === itemIndex && m.sub_criterion === subCriterion
      );
      setPostLockModal({ delegateId, fieldId, itemIndex, subCriterion, currentScore: existing?.score ?? 0 });
      return;
    }

    const cellKey = `${delegateId}-${fieldId}-${itemIndex}-${subCriterion}`;

    // Clear existing debounce for this cell
    const existing = debounceTimers.current.get(cellKey);
    if (existing) clearTimeout(existing);

    setSaveStatus('pending');

    const timer = setTimeout(async () => {
      debounceTimers.current.delete(cellKey);
      localSaveCells.current.add(cellKey);
      try {
        const res = await fetch(`/api/committee/${committeeId}/marks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            delegate_id: delegateId, schema_field_id: fieldId,
            committee_id: committeeId, item_index: itemIndex,
            sub_criterion: subCriterion, score, counts_toward_final: countsTowardFinal,
            is_unsure: isUnsure,
            session_tag: sessionTag || undefined,
          }),
        });
        setSaveStatus(res.ok ? 'saved' : 'error');
      } catch {
        setSaveStatus('error');
      } finally {
        // Remove from local-save set after short window so realtime won't double-flash
        setTimeout(() => localSaveCells.current.delete(cellKey), 1500);
      }
    }, 600);

    debounceTimers.current.set(cellKey, timer);
  }, [committeeId, isLocked, marks, setSaveStatus]);

  async function confirmPostLockEdit(newScore: number) {
    if (!postLockModal) return;
    setSaveStatus('pending');
    try {
      const res = await fetch(`/api/committee/${committeeId}/marks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delegate_id: postLockModal.delegateId, schema_field_id: postLockModal.fieldId,
          committee_id: committeeId, item_index: postLockModal.itemIndex,
          sub_criterion: postLockModal.subCriterion, score: newScore,
          counts_toward_final: true, post_lock_note: postLockNote,
        }),
      });
      setSaveStatus(res.ok ? 'saved' : 'error');
      if (res.ok) {
        const mRes = await fetch(`/api/committee/${committeeId}/marks`);
        if (mRes.ok) { const d = await mRes.json(); setMarks(d.marks ?? []); }
      }
    } catch { setSaveStatus('error'); }
    setPostLockModal(null);
    setPostLockNote('');
  }

  async function updateDelegate(delegateId: string, updates: {
    roll_call_status?: 'present' | 'present_and_voting' | 'absent';
    verbatim?: string; eb_remarks?: string;
  }) {
    await fetch(`/api/committee/${committeeId}/delegates`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delegate_id: delegateId, ...updates }),
    });
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <p className="loading-text" style={styles.loadingText}>LOADING MARKING INTERFACE</p>
      </div>
    );
  }

  if (fatalError) {
    return <ErrorOverlay message="SOMETHING BROKE." sub={fatalError} onDismiss={() => { setFatalError(''); loadAll(); }} />;
  }

  if (schema.length === 0) {
    return (
      <div style={styles.noSchema}>
        <p style={styles.noSchemaText}>NOTHING TO MARK YET.</p>
        <p style={styles.noSchemaHint}>
          The chair hasn&apos;t set up a marking schema.{' '}
          <a href={`/committee/${committeeId}/setup`} style={styles.schemaLink}>Go to SETUP</a>{' '}
          to add fields.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div style={styles.toolbar}>
        {!isMobile ? (
          <div style={styles.modeToggle} role="tablist" aria-label="Marking view mode">
            {(['table', 'delegate'] as ViewMode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} role="tab"
                aria-selected={mode === m}
                style={{ ...styles.modeBtn, ...(mode === m ? styles.modeBtnActive : {}) }}>
                {m === 'table' ? 'TABLE VIEW' : 'DELEGATE VIEW'}
              </button>
            ))}
          </div>
        ) : (
          <span style={styles.mobileLabel}>DELEGATE VIEW</span>
        )}

        <div style={styles.toolbarRight}>
          {/* Presence badges */}
          {onlineUsers.length > 0 && (
            <div style={styles.onlineUsers} aria-label="Online collaborators">
              {onlineUsers.slice(0, 5).map((u) => (
                <div key={u.id} style={{ ...styles.presenceBadge, background: u.color }}
                  title={`${u.name} is viewing`} aria-label={u.name}>
                  {u.name[0].toUpperCase()}
                </div>
              ))}
              {onlineUsers.length > 5 && (
                <div style={{ ...styles.presenceBadge, background: '#333' }}>
                  +{onlineUsers.length - 5}
                </div>
              )}
            </div>
          )}

          {/* Session tag */}
          <div style={styles.sessionTagWrap}>
            {editingSessionTag ? (
              <input
                autoFocus
                value={sessionTag}
                onChange={(e) => setSessionTag(e.target.value)}
                onBlur={() => setEditingSessionTag(false)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingSessionTag(false); }}
                placeholder="SESSION TAG…"
                style={styles.sessionTagInput}
                maxLength={40}
                aria-label="Session tag"
              />
            ) : (
              <button
                onClick={() => setEditingSessionTag(true)}
                style={{ ...styles.sessionTagBtn, color: sessionTag ? 'var(--color-accent)' : '#333' }}
                title="Tag this marking session"
              >
                {sessionTag || 'TAG SESSION'}
              </button>
            )}
          </div>

          {!realtimeConnected && (
            <div style={styles.disconnected} role="status" aria-live="polite">
              <span style={styles.disconnectedDot} />RECONNECTING...
            </div>
          )}

          {!isLocked && (
            <button onClick={() => setShowAddDelegate(true)} style={styles.addDelegateBtn} title="Add delegate inline">
              + DELEGATE
            </button>
          )}
          {isLocked && (
            <span style={styles.lockedIndicator} aria-label="Committee is locked">LOCKED</span>
          )}
        </div>
      </div>

      {/* ── Roll Call ─────────────────────────────────────────────────── */}
      <RollCallSection
        delegates={delegates} isLocked={isLocked}
        quorumFraction={quorumFraction}
        onUpdate={updateDelegate}
        onQuorumFractionChange={async (v) => {
          setQuorumFraction(v);
          await supabaseRef.current.from('committees')
            .update({ quorum_fraction: v } as Record<string, unknown>)
            .eq('id', committeeId);
        }}
      />

      {/* ── Marking View ──────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {mode === 'table' ? (
          <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={styles.viewContainer}>
            <TableView
              delegates={delegates} schema={schema} marks={marks}
              isLocked={isLocked} committeeId={committeeId}
              onSaveMark={saveMark} remoteFlashCells={remoteFlashCells}
              sessionTag={sessionTag}
              onDelegateClick={(idx) => { setSelectedDelegateIdx(idx); setMode('delegate'); }}
            />
          </motion.div>
        ) : (
          <motion.div key="delegate" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={styles.viewContainer}>
            <DelegateView
              delegates={delegates} schema={schema} marks={marks}
              isLocked={isLocked} committeeId={committeeId}
              selectedIdx={selectedDelegateIdx} onSelectIdx={setSelectedDelegateIdx}
              onSaveMark={saveMark} onUpdateDelegate={updateDelegate}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Inline add-delegate overlay ───────────────────────────────── */}
      <AnimatePresence>
        {showAddDelegate && (
          <AddDelegateOverlay
            committeeId={committeeId}
            onAdded={() => { loadAll(); setShowAddDelegate(false); }}
            onClose={() => setShowAddDelegate(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Post-lock modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {postLockModal && (
          <PostLockModal
            currentScore={postLockModal.currentScore} note={postLockNote}
            onNoteChange={setPostLockNote} onConfirm={confirmPostLockEdit}
            onCancel={() => { setPostLockModal(null); setPostLockNote(''); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AddDelegateOverlay({ committeeId, onAdded, onClose }: {
  committeeId: string; onAdded: () => void; onClose: () => void;
}) {
  const [name, setName]       = useState('');
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true); setError('');
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/committee/${committeeId}/delegates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ name: name.trim(), country: country.trim() || null }),
      });
      if (res.ok) { onAdded(); }
      else { const d = await res.json(); setError(d.error ?? 'Failed to add delegate'); }
    } catch { setError('Network error'); }
    setLoading(false);
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={styles.modalBackdrop} onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.2 }}
        style={{ ...styles.modal, maxWidth: '340px' }}
        role="dialog" aria-modal="true" aria-labelledby="add-delegate-title">
        <h3 id="add-delegate-title" style={styles.modalTitle}>ADD DELEGATE</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>NAME *</label>
            <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)}
              maxLength={100} placeholder="Delegate name" style={styles.modalInput} required />
          </div>
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>COUNTRY</label>
            <input type="text" value={country} onChange={(e) => setCountry(e.target.value)}
              maxLength={100} placeholder="Optional" style={styles.modalInput} />
          </div>
          {error && <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--color-danger)' }}>{error}</p>}
          <div style={styles.modalActions}>
            <button type="button" onClick={onClose} style={styles.modalCancel}>CANCEL</button>
            <button type="submit" disabled={loading || !name.trim()} style={{ ...styles.modalConfirm, opacity: loading || !name.trim() ? 0.5 : 1 }}>
              {loading ? 'ADDING…' : 'ADD →'}
            </button>
          </div>
        </form>
      </motion.div>
    </>
  );
}

function PostLockModal({ currentScore, note, onNoteChange, onConfirm, onCancel }: {
  currentScore: number; note: string;
  onNoteChange: (v: string) => void; onConfirm: (score: number) => void; onCancel: () => void;
}) {
  const [newScore, setNewScore] = useState(currentScore);
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={styles.modalBackdrop} onClick={onCancel} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
        style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="post-lock-title">
        <h3 id="post-lock-title" style={styles.modalTitle}>EDITING LOCKED MARK</h3>
        <p style={styles.modalWarning}>This committee is locked. Editing will create an audit entry.</p>
        <div style={styles.modalField}>
          <label style={styles.modalLabel}>NEW SCORE</label>
          <input type="number" value={newScore}
            onChange={(e) => setNewScore(parseFloat(e.target.value) || 0)}
            min={0} step={0.5} style={styles.modalInput} autoFocus aria-label="New score" />
        </div>
        <div style={styles.modalField}>
          <label style={styles.modalLabel}>REASON (OPTIONAL)</label>
          <input type="text" value={note} onChange={(e) => onNoteChange(e.target.value)}
            maxLength={500} placeholder="Why are you editing this mark?"
            style={styles.modalInput} aria-label="Reason for edit" />
        </div>
        <div style={styles.modalActions}>
          <button onClick={onCancel} style={styles.modalCancel}>CANCEL</button>
          <button onClick={() => onConfirm(newScore)} style={styles.modalConfirm}>
            EDIT MARK — LOG AUDIT ENTRY
          </button>
        </div>
      </motion.div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', overflow: 'hidden' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' },
  loadingText: { fontFamily: 'var(--font-body)', color: 'var(--secondary)', fontSize: '0.9rem', letterSpacing: '0.1em' },
  noSchema: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: '0.75rem', textAlign: 'center', padding: '2rem' },
  noSchemaText: { fontFamily: 'var(--font-heading)', fontSize: '2rem', color: 'var(--secondary)' },
  noSchemaHint: { fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--muted)' },
  schemaLink: { color: 'var(--off-white)', textDecoration: 'underline', textUnderlineOffset: '3px' },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, gap: '1rem', flexWrap: 'wrap' },
  modeToggle: { display: 'flex', gap: '0' },
  modeBtn: { fontFamily: 'var(--font-body)', fontSize: '0.72rem', letterSpacing: '0.1em', color: 'var(--secondary)', background: 'transparent', border: '1px solid var(--border-subtle)', padding: '0.4rem 0.9rem', cursor: 'pointer' },
  modeBtnActive: { color: 'var(--off-white)', background: 'rgba(240,236,228,0.06)', border: '1px solid var(--border-emphasis)' },
  toolbarRight: { display: 'flex', alignItems: 'center', gap: '1rem' },
  onlineUsers: { display: 'flex', gap: '0.3rem', alignItems: 'center' },
  presenceBadge: { width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#080808', fontWeight: 'bold', flexShrink: 0 },
  disconnected: { fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: '#888', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.4rem' },
  disconnectedDot: { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-text-secondary)', display: 'inline-block' },
  mobileLabel: { fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: 'var(--secondary)', letterSpacing: '0.1em' },
  lockedIndicator: { fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--secondary)', letterSpacing: '0.12em', border: '1px solid var(--border-subtle)', padding: '0.2rem 0.5rem' },
  viewContainer: { flex: 1, overflow: 'hidden' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(8,8,8,0.88)', zIndex: 300 },
  modal: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 301, background: 'var(--color-surface)', border: '1px solid var(--border-emphasis)', padding: '2rem', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  modalTitle: { fontFamily: 'var(--font-heading)', fontSize: '1.2rem', color: 'var(--off-white)' },
  modalWarning: { fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--secondary)', lineHeight: 1.5, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', padding: '0.6rem 0.75rem' },
  modalField: { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  modalLabel: { fontFamily: 'var(--font-body)', fontSize: '0.68rem', color: 'var(--secondary)', letterSpacing: '0.1em' },
  modalInput: { background: 'transparent', border: '1px solid var(--border-emphasis)', padding: '0.5rem 0.65rem', color: 'var(--off-white)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', borderRadius: '0' },
  modalActions: { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' },
  modalCancel: { fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--secondary)', background: 'none', border: '1px solid var(--border-subtle)', padding: '0.5rem 0.9rem', cursor: 'pointer', letterSpacing: '0.06em' },
  modalConfirm: { fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--black)', background: 'var(--off-white)', border: '1px solid var(--off-white)', padding: '0.5rem 0.9rem', cursor: 'pointer', letterSpacing: '0.06em' },
  sessionTagWrap: { display: 'flex', alignItems: 'center' },
  sessionTagBtn: { fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.08em', background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem 0' },
  sessionTagInput: { fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.08em', background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-border)', color: 'var(--color-accent)', padding: '0.15rem 0', width: '130px', outline: 'none' },
  addDelegateBtn: { fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.08em', color: 'var(--color-text-secondary)', background: 'transparent', border: '1px solid var(--color-border)', padding: '0.25rem 0.6rem', cursor: 'pointer' },
};
