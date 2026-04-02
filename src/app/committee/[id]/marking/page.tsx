'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';
import TableView from '@/components/marking/TableView';
import DelegateView from '@/components/marking/DelegateView';
import RollCallSection from '@/components/marking/RollCallSection';
import ErrorOverlay from '@/components/ErrorOverlay';

type Delegate = Database['public']['Tables']['delegates']['Row'];
type SchemaField = Database['public']['Tables']['marking_schema']['Row'];
type Mark = Database['public']['Tables']['marks']['Row'];

type ViewMode = 'table' | 'delegate';

interface OnlineUser {
  id: string;
  name: string;
  color: string;
}

export default function MarkingPage() {
  const params = useParams();
  const committeeId = params?.id as string;

  // On mobile, force delegate view
  const [isMobile, setIsMobile] = useState(false);
  const [mode, setMode] = useState<ViewMode>('table');
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [schema, setSchema] = useState<SchemaField[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState('');
  const [selectedDelegateIdx, setSelectedDelegateIdx] = useState(0);
  const [onlineUsers] = useState<OnlineUser[]>([]);
  const [realtimeConnected, setRealtimeConnected] = useState(true);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

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

  // Post-lock modal state
  const [postLockModal, setPostLockModal] = useState<{
    delegateId: string;
    fieldId: string;
    itemIndex: number;
    subCriterion: string | null;
    currentScore: number;
  } | null>(null);
  const [postLockNote, setPostLockNote] = useState('');

  const supabaseRef = useRef(createClient());

  const loadAll = useCallback(async () => {
    const [delegatesRes, schemaRes, marksRes, committeeRes] = await Promise.all([
      fetch(`/api/committee/${committeeId}/delegates`),
      fetch(`/api/committee/${committeeId}/schema`),
      fetch(`/api/committee/${committeeId}/marks`),
      supabaseRef.current.from('committees').select('is_locked').eq('id', committeeId).single(),
    ]);

    if (delegatesRes.ok) {
      const d = await delegatesRes.json();
      setDelegates(d.delegates ?? []);
    }
    if (schemaRes.ok) {
      const s = await schemaRes.json();
      setSchema(s.schema ?? []);
    }
    if (marksRes.ok) {
      const m = await marksRes.json();
      setMarks(m.marks ?? []);
    }
    if (!committeeRes.error && committeeRes.data) {
      setIsLocked(committeeRes.data.is_locked);
    }

    setLoading(false);
  }, [committeeId]);

  // Fatal load error clears loading even on network fail
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setFatalError('Could not load marking data. Check your connection.');
      }
    }, 15000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Realtime subscription
  useEffect(() => {
    if (!committeeId) return;

    loadAll();

    const supabase = supabaseRef.current;

    // Subscribe to marks changes for this committee only
    const marksChannel = supabase
      .channel(`marks:${committeeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'marks',
          filter: `committee_id=eq.${committeeId}`,
        },
        (payload) => {
          // Validate committee_id before applying
          if (payload.new && (payload.new as Mark).committee_id !== committeeId) return;
          if (payload.old && (payload.old as Mark).committee_id !== committeeId) return;

          setMarks((prev) => {
            if (payload.eventType === 'INSERT') {
              return [...prev, payload.new as Mark];
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((m) =>
                m.id === (payload.new as Mark).id ? (payload.new as Mark) : m
              );
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((m) => m.id !== (payload.old as { id: string }).id);
            }
            return prev;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'delegates',
          filter: `committee_id=eq.${committeeId}`,
        },
        (payload) => {
          if ((payload.new as Delegate).committee_id !== committeeId) return;
          setDelegates((prev) =>
            prev.map((d) => d.id === (payload.new as Delegate).id ? (payload.new as Delegate) : d)
          );
        }
      )
      .subscribe((status) => {
        const connected = status === 'SUBSCRIBED';
        setRealtimeConnected(connected);

        if (!connected && status === 'CHANNEL_ERROR') {
          // Exponential backoff reconnect
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current += 1;
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            supabase.removeChannel(marksChannel);
            loadAll(); // Full reload on reconnect
          }, delay);
        } else if (connected) {
          reconnectAttemptsRef.current = 0;
        }
      });

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      supabase.removeChannel(marksChannel);
    };
  }, [committeeId, loadAll]);

  async function saveMark(
    delegateId: string,
    fieldId: string,
    itemIndex: number,
    score: number,
    subCriterion: string | null = null,
    countsTowardFinal = true
  ) {
    if (isLocked) {
      // Show post-lock confirmation modal
      const existing = marks.find(
        (m) =>
          m.delegate_id === delegateId &&
          m.schema_field_id === fieldId &&
          m.item_index === itemIndex &&
          m.sub_criterion === subCriterion
      );
      setPostLockModal({
        delegateId,
        fieldId,
        itemIndex,
        subCriterion,
        currentScore: existing?.score ?? 0,
      });
      return;
    }

    const res = await fetch(`/api/committee/${committeeId}/marks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delegate_id: delegateId,
        schema_field_id: fieldId,
        committee_id: committeeId,
        item_index: itemIndex,
        sub_criterion: subCriterion,
        score,
        counts_toward_final: countsTowardFinal,
      }),
    });

    if (!res.ok) {
      console.error('[marking] saveMark error:', await res.text());
    }
  }

  async function confirmPostLockEdit(newScore: number) {
    if (!postLockModal) return;

    await fetch(`/api/committee/${committeeId}/marks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delegate_id: postLockModal.delegateId,
        schema_field_id: postLockModal.fieldId,
        committee_id: committeeId,
        item_index: postLockModal.itemIndex,
        sub_criterion: postLockModal.subCriterion,
        score: newScore,
        counts_toward_final: true,
        post_lock_note: postLockNote,
      }),
    });

    // Refresh marks
    const marksRes = await fetch(`/api/committee/${committeeId}/marks`);
    if (marksRes.ok) {
      const data = await marksRes.json();
      setMarks(data.marks ?? []);
    }

    setPostLockModal(null);
    setPostLockNote('');
  }

  async function updateDelegate(delegateId: string, updates: {
    roll_call_status?: 'present' | 'present_and_voting' | 'absent';
    verbatim?: string;
    eb_remarks?: string;
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
          <a href={`/committee/${committeeId}/setup`} style={styles.schemaLink}>
            Go to SETUP
          </a>{' '}
          to add fields.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div style={styles.toolbar}>
        {!isMobile ? (
          <div style={styles.modeToggle} role="tablist" aria-label="Marking view mode">
            <button
              onClick={() => setMode('table')}
              style={{
                ...styles.modeBtn,
                ...(mode === 'table' ? styles.modeBtnActive : {}),
              }}
              role="tab"
              aria-selected={mode === 'table'}
            >
              TABLE VIEW
            </button>
            <button
              onClick={() => setMode('delegate')}
              style={{
                ...styles.modeBtn,
                ...(mode === 'delegate' ? styles.modeBtnActive : {}),
              }}
              role="tab"
              aria-selected={mode === 'delegate'}
            >
              DELEGATE VIEW
            </button>
          </div>
        ) : (
          <span style={styles.mobileLabel}>DELEGATE VIEW</span>
        )}

        <div style={styles.toolbarRight}>
          {/* Online collaborators */}
          {onlineUsers.length > 0 && (
            <div style={styles.onlineUsers} aria-label="Online collaborators">
              {onlineUsers.slice(0, 5).map((u) => (
                <div
                  key={u.id}
                  style={{ ...styles.userDot, background: u.color }}
                  title={u.name}
                  aria-label={u.name}
                >
                  {u.name[0].toUpperCase()}
                </div>
              ))}
            </div>
          )}

          {/* Realtime status */}
          {!realtimeConnected && (
            <div style={styles.disconnected} role="status" aria-live="polite">
              <span style={styles.disconnectedDot} />
              RECONNECTING...
            </div>
          )}

          {isLocked && (
            <span style={styles.lockedIndicator} aria-label="Committee is locked">
              LOCKED
            </span>
          )}
        </div>
      </div>

      {/* ── Roll Call section ──────────────────────────────────────────── */}
      <RollCallSection
        delegates={delegates}
        isLocked={isLocked}
        onUpdate={updateDelegate}
      />

      {/* ── Main marking view ─────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {mode === 'table' ? (
          <motion.div
            key="table"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={styles.viewContainer}
          >
            <TableView
              delegates={delegates}
              schema={schema}
              marks={marks}
              isLocked={isLocked}
              committeeId={committeeId}
              onSaveMark={saveMark}
              onDelegateClick={(idx) => { setSelectedDelegateIdx(idx); setMode('delegate'); }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="delegate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={styles.viewContainer}
          >
            <DelegateView
              delegates={delegates}
              schema={schema}
              marks={marks}
              isLocked={isLocked}
              committeeId={committeeId}
              selectedIdx={selectedDelegateIdx}
              onSelectIdx={setSelectedDelegateIdx}
              onSaveMark={saveMark}
              onUpdateDelegate={updateDelegate}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Post-lock edit modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {postLockModal && (
          <PostLockModal
            currentScore={postLockModal.currentScore}
            note={postLockNote}
            onNoteChange={setPostLockNote}
            onConfirm={confirmPostLockEdit}
            onCancel={() => { setPostLockModal(null); setPostLockNote(''); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PostLockModal({
  currentScore,
  note,
  onNoteChange,
  onConfirm,
  onCancel,
}: {
  currentScore: number;
  note: string;
  onNoteChange: (v: string) => void;
  onConfirm: (score: number) => void;
  onCancel: () => void;
}) {
  const [newScore, setNewScore] = useState(currentScore);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={styles.modalBackdrop}
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        style={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-lock-title"
      >
        <h3 id="post-lock-title" style={styles.modalTitle}>EDITING LOCKED MARK</h3>
        <p style={styles.modalWarning}>
          This committee is locked. Editing will create an audit entry.
        </p>

        <div style={styles.modalField}>
          <label style={styles.modalLabel}>NEW SCORE</label>
          <input
            type="number"
            value={newScore}
            onChange={(e) => setNewScore(parseFloat(e.target.value) || 0)}
            min={0}
            step={0.5}
            style={styles.modalInput}
            autoFocus
            aria-label="New score"
          />
        </div>

        <div style={styles.modalField}>
          <label style={styles.modalLabel}>REASON (OPTIONAL)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            maxLength={500}
            placeholder="Why are you editing this mark?"
            style={styles.modalInput}
            aria-label="Reason for edit"
          />
        </div>

        <div style={styles.modalActions}>
          <button onClick={onCancel} style={styles.modalCancel}>CANCEL</button>
          <button
            onClick={() => onConfirm(newScore)}
            style={styles.modalConfirm}
          >
            EDIT MARK — LOG AUDIT ENTRY
          </button>
        </div>
      </motion.div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 56px)',
    overflow: 'hidden',
  },
  loading: {
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
  noSchema: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '50vh',
    gap: '0.75rem',
    textAlign: 'center',
    padding: '2rem',
  },
  noSchemaText: {
    fontFamily: 'var(--font-heading)',
    fontSize: '2rem',
    color: 'var(--secondary)',
  },
  noSchemaHint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: 'var(--muted)',
  },
  schemaLink: {
    color: 'var(--off-white)',
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.6rem 1.5rem',
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0,
    gap: '1rem',
    flexWrap: 'wrap',
  },
  modeToggle: {
    display: 'flex',
    gap: '0',
  },
  modeBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    letterSpacing: '0.1em',
    color: 'var(--secondary)',
    background: 'transparent',
    border: '1px solid var(--border-subtle)',
    padding: '0.4rem 0.9rem',
    cursor: 'pointer',
  },
  modeBtnActive: {
    color: 'var(--off-white)',
    background: 'rgba(240,236,228,0.06)',
    border: '1px solid var(--border-emphasis)',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  onlineUsers: {
    display: 'flex',
    gap: '0.25rem',
  },
  userDot: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-body)',
    fontSize: '0.65rem',
    color: 'var(--black)',
    fontWeight: 'bold',
  },
  disconnected: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.65rem',
    color: '#888',
    letterSpacing: '0.06em',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  disconnectedDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#555',
    display: 'inline-block',
  },
  mobileLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    color: 'var(--secondary)',
    letterSpacing: '0.1em',
  },
  lockedIndicator: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.65rem',
    color: 'var(--secondary)',
    letterSpacing: '0.12em',
    border: '1px solid var(--border-subtle)',
    padding: '0.2rem 0.5rem',
  },
  viewContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8,8,8,0.88)',
    zIndex: 300,
  },
  modal: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 301,
    background: '#0d0d0d',
    border: '1px solid var(--border-emphasis)',
    padding: '2rem',
    width: '100%',
    maxWidth: '420px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  modalTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.2rem',
    color: 'var(--off-white)',
  },
  modalWarning: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: 'var(--secondary)',
    lineHeight: 1.5,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-subtle)',
    padding: '0.6rem 0.75rem',
  },
  modalField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  modalLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.68rem',
    color: 'var(--secondary)',
    letterSpacing: '0.1em',
  },
  modalInput: {
    background: 'transparent',
    border: '1px solid var(--border-emphasis)',
    padding: '0.5rem 0.65rem',
    color: 'var(--off-white)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    borderRadius: '0',
  },
  modalActions: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'flex-end',
  },
  modalCancel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--secondary)',
    background: 'none',
    border: '1px solid var(--border-subtle)',
    padding: '0.5rem 0.9rem',
    cursor: 'pointer',
    letterSpacing: '0.06em',
  },
  modalConfirm: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--black)',
    background: 'var(--off-white)',
    border: '1px solid var(--off-white)',
    padding: '0.5rem 0.9rem',
    cursor: 'pointer',
    letterSpacing: '0.06em',
  },
};
