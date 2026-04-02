'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';

interface TimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  description: string;
  actor?: string;
}

interface AuditEntry {
  id: string;
  edited_at: string;
  edited_by_guest_name: string | null;
  old_score: number;
  new_score: number;
  note: string | null;
  mark_id: string;
}

interface EBMember {
  role: string;
  name: string;
  is_owner: boolean;
  joined_at: string;
}

interface AuditData {
  conference_name: string;
  committee_name: string;
  is_locked: boolean;
  eb_members: EBMember[];
  delegates: { id: string; name: string }[];
  timeline: TimelineEvent[];
  audit_log: AuditEntry[];
  marks_count: number;
}

const TYPE_ICONS: Record<string, string> = {
  created: '◆',
  eb_joined: '○',
  delegates: '▲',
  marks: '·',
  computed: '◈',
  locked: '■',
  post_lock_edit: '⚠',
};

const TYPE_COLORS: Record<string, string> = {
  created: 'var(--off-white)',
  eb_joined: 'var(--secondary)',
  delegates: 'var(--secondary)',
  marks: 'var(--muted)',
  computed: 'var(--off-white)',
  locked: 'var(--off-white)',
  post_lock_edit: 'var(--secondary)',
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function AuditPage() {
  const params = useParams();
  const committeeId = params?.id as string;

  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedEdit, setExpandedEdit] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/committee/${committeeId}/audit`);
        if (!res.ok) {
          const d = await res.json();
          setError(d.error ?? 'Failed to load audit data');
        } else {
          setData(await res.json());
        }
      } catch {
        setError('Network error');
      }
      setLoading(false);
    }
    if (committeeId) load();
  }, [committeeId]);

  if (loading) {
    return (
      <div style={styles.center}>
        <p className="loading-text" style={styles.loadingText}>LOADING AUDIT LOG</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.center}>
        <p style={styles.errorText}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const postLockEdits = data.audit_log.length;

  return (
    <div style={styles.root}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={styles.container}
      >
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.heading}>AUDIT LOG</h1>
            <p style={styles.subheading}>
              {data.conference_name && `${data.conference_name} · `}
              {data.committee_name}
            </p>
          </div>
          <div style={styles.statusPills}>
            <span style={{ ...styles.pill, color: data.is_locked ? 'var(--off-white)' : 'var(--secondary)', borderColor: data.is_locked ? 'var(--off-white)' : 'var(--border-subtle)' }}>
              {data.is_locked ? 'LOCKED' : 'ACTIVE'}
            </span>
            {postLockEdits > 0 && (
              <span style={{ ...styles.pill, color: 'var(--secondary)', borderColor: 'var(--border-subtle)' }}>
                {postLockEdits} POST-LOCK EDIT{postLockEdits !== 1 ? 'S' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={styles.statsRow}>
          <div style={styles.statItem}>
            <p style={styles.statValue}>{data.delegates.length}</p>
            <p style={styles.statLabel}>DELEGATES</p>
          </div>
          <div style={styles.statItem}>
            <p style={styles.statValue}>{data.eb_members.length}</p>
            <p style={styles.statLabel}>EB MEMBERS</p>
          </div>
          <div style={styles.statItem}>
            <p style={styles.statValue}>{data.marks_count}</p>
            <p style={styles.statLabel}>MARK ENTRIES</p>
          </div>
          <div style={styles.statItem}>
            <p style={styles.statValue}>{postLockEdits}</p>
            <p style={styles.statLabel}>EDITS AFTER LOCK</p>
          </div>
        </div>

        {/* Timeline */}
        <div style={styles.section}>
          <p style={styles.sectionTitle}>COMMITTEE TIMELINE</p>
          <div style={styles.timeline}>
            {data.timeline.map((event, i) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                style={styles.timelineItem}
              >
                <div style={styles.timelineLeft}>
                  <span style={{ ...styles.timelineIcon, color: TYPE_COLORS[event.type] ?? 'var(--muted)' }}>
                    {TYPE_ICONS[event.type] ?? '·'}
                  </span>
                  <div style={styles.timelineConnector} />
                </div>
                <div style={styles.timelineContent}>
                  <p style={{ ...styles.timelineDesc, color: TYPE_COLORS[event.type] ?? 'var(--secondary)' }}>
                    {event.description}
                  </p>
                  <div style={styles.timelineMeta}>
                    <span style={styles.timelineTime}>{formatTimestamp(event.timestamp)}</span>
                    {event.actor && (
                      <span style={styles.timelineActor}> · {event.actor}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* EB Members */}
        <div style={styles.section}>
          <p style={styles.sectionTitle}>EB COMPOSITION</p>
          <div style={styles.ebList}>
            {data.eb_members.map((m) => (
              <div key={`${m.role}-${m.name}`} style={styles.ebRow}>
                <div style={styles.ebNameWrap}>
                  <span style={styles.ebName}>{m.name}</span>
                  {m.is_owner && <span style={styles.ownerBadge}>OWNER</span>}
                </div>
                <span style={styles.ebRole}>{m.role}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Post-lock edits */}
        {postLockEdits > 0 && (
          <div style={styles.section}>
            <p style={styles.sectionTitle}>POST-LOCK EDITS</p>
            <p style={styles.sectionNote}>
              These changes were made after the committee was locked. All edits are immutable and permanently recorded.
            </p>
            <div style={styles.editsList}>
              {data.audit_log.map((edit, i) => (
                <motion.div
                  key={edit.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  style={styles.editRow}
                  onClick={() => setExpandedEdit(expandedEdit === edit.id ? null : edit.id)}
                >
                  <div style={styles.editHeader}>
                    <div style={styles.editScores}>
                      <span style={styles.editOldScore}>{edit.old_score}</span>
                      <span style={styles.editArrow}>→</span>
                      <span style={styles.editNewScore}>{edit.new_score}</span>
                      <span style={styles.editDelta}>
                        ({edit.new_score > edit.old_score ? '+' : ''}{(edit.new_score - edit.old_score).toFixed(1)})
                      </span>
                    </div>
                    <div style={styles.editMeta}>
                      <span style={styles.editTime}>{formatTimestamp(edit.edited_at)}</span>
                      <span style={styles.editActor}>{edit.edited_by_guest_name ?? 'Authenticated user'}</span>
                    </div>
                  </div>
                  {expandedEdit === edit.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      style={styles.editExpanded}
                    >
                      <p style={styles.editMarkId}>Mark ID: <span style={styles.editMarkIdValue}>{edit.mark_id}</span></p>
                      {edit.note && <p style={styles.editNote}>&quot;{edit.note}&quot;</p>}
                      {!edit.note && <p style={styles.editNoteEmpty}>No note provided</p>}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Delegate list */}
        <div style={styles.section}>
          <p style={styles.sectionTitle}>REGISTERED DELEGATES ({data.delegates.length})</p>
          <div style={styles.delegateGrid}>
            {data.delegates.map((d) => (
              <span key={d.id} style={styles.delegateName}>{d.name}</span>
            ))}
          </div>
        </div>

        {/* Integrity footer */}
        <div style={styles.integrityFooter}>
          <p style={styles.integrityText}>
            This audit log is generated from immutable database records.
            Post-lock edits cannot be deleted or modified.
            {data.is_locked && ' Committee is locked — no further marks can be entered.'}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    padding: '2rem 1.5rem',
    overflowY: 'auto',
  },
  center: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh',
  },
  loadingText: {
    fontFamily: 'var(--font-body)', color: 'var(--secondary)', fontSize: '0.9rem', letterSpacing: '0.1em',
  },
  errorText: {
    fontFamily: 'var(--font-body)', color: 'var(--secondary)', fontSize: '0.9rem',
  },
  container: {
    maxWidth: '720px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  heading: {
    fontFamily: 'var(--font-wordmark)',
    fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
    color: 'var(--off-white)',
  },
  subheading: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: 'var(--secondary)',
    marginTop: '0.25rem',
  },
  statusPills: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  pill: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.62rem',
    letterSpacing: '0.1em',
    border: '1px solid',
    padding: '0.2rem 0.5rem',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1px',
    border: '1px solid var(--border-subtle)',
    background: 'var(--border-subtle)',
  },
  statItem: {
    background: 'var(--black)',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  statValue: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.75rem',
    color: 'var(--off-white)',
    lineHeight: 1,
  },
  statLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.6rem',
    color: 'var(--muted)',
    letterSpacing: '0.1em',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  sectionTitle: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.65rem',
    color: 'var(--muted)',
    letterSpacing: '0.12em',
    borderBottom: '1px solid var(--border-subtle)',
    paddingBottom: '0.4rem',
  },
  sectionNote: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--muted)',
    lineHeight: 1.5,
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
  },
  timelineItem: {
    display: 'flex',
    gap: '0.75rem',
    position: 'relative',
  },
  timelineLeft: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '16px',
    flexShrink: 0,
  },
  timelineIcon: {
    fontSize: '0.7rem',
    lineHeight: 1,
    marginTop: '0.3rem',
    flexShrink: 0,
  },
  timelineConnector: {
    flex: 1,
    width: '1px',
    background: 'var(--border-subtle)',
    marginTop: '0.25rem',
    marginBottom: '-1px',
  },
  timelineContent: {
    paddingBottom: '1rem',
    flex: 1,
  },
  timelineDesc: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    lineHeight: 1.4,
  },
  timelineMeta: {
    marginTop: '0.2rem',
    display: 'flex',
    flexWrap: 'wrap',
  },
  timelineTime: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.68rem',
    color: 'var(--muted)',
  },
  timelineActor: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.68rem',
    color: 'var(--muted)',
  },
  ebList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    border: '1px solid var(--border-subtle)',
  },
  ebRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.6rem 0.75rem',
    borderBottom: '1px solid var(--border-subtle)',
  },
  ebNameWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  ebName: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: 'var(--off-white)',
  },
  ownerBadge: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.55rem',
    color: 'var(--muted)',
    border: '1px solid var(--border-subtle)',
    padding: '0.1rem 0.3rem',
    letterSpacing: '0.08em',
  },
  ebRole: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    color: 'var(--secondary)',
    letterSpacing: '0.05em',
  },
  editsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    border: '1px solid var(--border-subtle)',
  },
  editRow: {
    padding: '0.75rem',
    borderBottom: '1px solid var(--border-subtle)',
    cursor: 'pointer',
  },
  editHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  editScores: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  editOldScore: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1rem',
    color: 'var(--muted)',
  },
  editArrow: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--muted)',
  },
  editNewScore: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1rem',
    color: 'var(--off-white)',
  },
  editDelta: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    color: 'var(--secondary)',
  },
  editMeta: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.1rem',
  },
  editTime: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.65rem',
    color: 'var(--muted)',
  },
  editActor: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.68rem',
    color: 'var(--secondary)',
  },
  editExpanded: {
    marginTop: '0.6rem',
    paddingTop: '0.6rem',
    borderTop: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
    overflow: 'hidden',
  },
  editMarkId: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.65rem',
    color: 'var(--muted)',
  },
  editMarkIdValue: {
    fontFamily: 'monospace',
    color: 'var(--secondary)',
    fontSize: '0.62rem',
  },
  editNote: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--secondary)',
    fontStyle: 'italic',
  },
  editNoteEmpty: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    color: 'var(--muted)',
    fontStyle: 'italic',
  },
  delegateGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
  },
  delegateName: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--secondary)',
    border: '1px solid var(--border-subtle)',
    padding: '0.2rem 0.5rem',
  },
  integrityFooter: {
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: '1rem',
  },
  integrityText: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.68rem',
    color: 'var(--muted)',
    lineHeight: 1.6,
    fontStyle: 'italic',
  },
};
