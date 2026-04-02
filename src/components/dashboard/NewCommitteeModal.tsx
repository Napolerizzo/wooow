'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

interface EbMemberInput {
  role: string;
  name: string;
}

interface AwardTierInput {
  tier_name: string;
  num_awards: number;
}

interface DelegateInput {
  name: string;
  country: string;
  portfolio: string;
}

interface Props {
  onClose: () => void;
  onCreated: (committeeId: string, accessCode: string) => void;
}

export default function NewCommitteeModal({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [createdId, setCreatedId] = useState('');

  // Form state
  const [conferenceName, setConferenceName] = useState('');
  const [committeeName, setCommitteeName] = useState('');
  const [ebMembers, setEbMembers] = useState<EbMemberInput[]>([]);
  const [awardTiers, setAwardTiers] = useState<AwardTierInput[]>([]);
  const [delegates, setDelegates] = useState<DelegateInput[]>([]);
  // Section collapse state — all optional sections start collapsed
  const [showEb, setShowEb]         = useState(false);
  const [showAwards, setShowAwards] = useState(false);
  const [showDelegates, setShowDelegates] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');

  function addEbMember() {
    setEbMembers((m) => [...m, { role: '', name: '' }]);
  }
  function removeEbMember(i: number) {
    setEbMembers((m) => m.filter((_, idx) => idx !== i));
  }
  function updateEbMember(i: number, key: keyof EbMemberInput, value: string) {
    setEbMembers((m) => m.map((item, idx) => idx === i ? { ...item, [key]: value } : item));
  }

  function addAwardTier() {
    setAwardTiers((t) => [...t, { tier_name: '', num_awards: 1 }]);
  }
  function removeAwardTier(i: number) {
    setAwardTiers((t) => t.filter((_, idx) => idx !== i));
  }
  function updateAwardTier(i: number, key: keyof AwardTierInput, value: string | number) {
    setAwardTiers((t) => t.map((item, idx) => idx === i ? { ...item, [key]: value } : item));
  }

  function addDelegate() {
    setDelegates((d) => [...d, { name: '', country: '', portfolio: '' }]);
  }
  function removeDelegate(i: number) {
    setDelegates((d) => d.filter((_, idx) => idx !== i));
  }
  function updateDelegate(i: number, key: keyof DelegateInput, value: string) {
    setDelegates((d) => d.map((item, idx) => idx === i ? { ...item, [key]: value } : item));
  }
  function handlePaste() {
    const names = pasteText
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
      .slice(0, 500);
    setDelegates(names.map((n) => ({ name: n, country: '', portfolio: '' })));
    setPasteMode(false);
    setPasteText('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanDelegates = pasteMode
      ? pasteText
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n) => ({ name: n }))
      : delegates.filter((d) => d.name.trim());

    try {
      // Send access token in Authorization header — most reliable across
      // environments where cookie forwarding to API routes may vary
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch('/api/committee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          conference_name: conferenceName.trim(),
          committee_name: committeeName.trim(),
          eb_members: ebMembers.filter((m) => m.name.trim() && m.role.trim()),
          award_tiers: awardTiers.filter((t) => t.tier_name.trim() && t.num_awards > 0),
          delegates: cleanDelegates,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to create committee');
        setLoading(false);
        return;
      }

      setAccessCode(data.access_code);
      setCreatedId(data.committee_id);
      setStep('code');
      setLoading(false);
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  async function copyCode() {
    await navigator.clipboard.writeText(accessCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={styles.backdrop}
        onClick={step === 'code' ? undefined : onClose}
      />

      {/* Panel slides up from bottom */}
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 32 }}
        style={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {step === 'form' ? (
          <>
            <div style={styles.panelHeader}>
              <h2 id="modal-title" style={styles.panelTitle}>NEW COMMITTEE</h2>
              <button onClick={onClose} style={styles.closeBtn} aria-label="Close modal">✕</button>
            </div>

            <div style={styles.scrollArea}>
              <form onSubmit={handleSubmit} style={styles.form} noValidate>
                {/* Section: Conference */}
                <section style={styles.section}>
                  <h3 style={styles.sectionLabel}>CONFERENCE</h3>
                  <Field label="CONFERENCE NAME" required>
                    <input
                      type="text"
                      value={conferenceName}
                      onChange={(e) => setConferenceName(e.target.value)}
                      required
                      maxLength={150}
                      placeholder="e.g. MRMUN XI"
                      style={styles.input}
                      aria-required="true"
                    />
                  </Field>
                  <Field label="COMMITTEE NAME" required>
                    <input
                      type="text"
                      value={committeeName}
                      onChange={(e) => setCommitteeName(e.target.value)}
                      required
                      maxLength={150}
                      placeholder="e.g. DISEC"
                      style={styles.input}
                      aria-required="true"
                    />
                  </Field>
                </section>

                {/* Section: EB Members (optional) */}
                <section style={styles.section}>
                  <button type="button" style={styles.optionalToggle} onClick={() => { setShowEb((v) => !v); if (!showEb && ebMembers.length === 0) setEbMembers([{ role: 'Chair', name: '' }]); }}>
                    <h3 style={styles.sectionLabel}>EB MEMBERS <span style={styles.optBadge}>OPTIONAL</span></h3>
                    <span style={styles.optChevron}>{showEb ? '▲' : '▼'}</span>
                  </button>
                  {showEb && ebMembers.map((m, i) => (
                    <div key={i} style={styles.rowGroup}>
                      <input
                        type="text"
                        value={m.role}
                        onChange={(e) => updateEbMember(i, 'role', e.target.value)}
                        placeholder="Role"
                        maxLength={100}
                        style={{ ...styles.input, flex: '1' }}
                        aria-label={`EB member ${i + 1} role`}
                      />
                      <input
                        type="text"
                        value={m.name}
                        onChange={(e) => updateEbMember(i, 'name', e.target.value)}
                        placeholder="Name"
                        maxLength={100}
                        style={{ ...styles.input, flex: '2' }}
                        aria-label={`EB member ${i + 1} name`}
                      />
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => removeEbMember(i)}
                          style={styles.removeBtn}
                          aria-label={`Remove EB member ${i + 1}`}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {showEb && <button type="button" onClick={addEbMember} style={styles.addBtn}>+ ADD MEMBER</button>}
                </section>

                {/* Section: Award Tiers (optional) */}
                <section style={styles.section}>
                  <button type="button" style={styles.optionalToggle} onClick={() => { setShowAwards((v) => !v); if (!showAwards && awardTiers.length === 0) setAwardTiers([{ tier_name: 'Best Delegate', num_awards: 1 }]); }}>
                    <h3 style={styles.sectionLabel}>AWARD TIERS <span style={styles.optBadge}>OPTIONAL</span></h3>
                    <span style={styles.optChevron}>{showAwards ? '▲' : '▼'}</span>
                  </button>
                  {showAwards && awardTiers.map((t, i) => (
                    <div key={i} style={styles.rowGroup}>
                      <input
                        type="text"
                        value={t.tier_name}
                        onChange={(e) => updateAwardTier(i, 'tier_name', e.target.value)}
                        placeholder="e.g. Best Delegate"
                        maxLength={100}
                        style={{ ...styles.input, flex: '2' }}
                        aria-label={`Award tier ${i + 1} name`}
                      />
                      <input
                        type="number"
                        value={t.num_awards}
                        onChange={(e) => updateAwardTier(i, 'num_awards', Math.max(1, parseInt(e.target.value) || 1))}
                        min={1}
                        max={50}
                        style={{ ...styles.input, flex: '0.6', textAlign: 'center' }}
                        aria-label={`Award tier ${i + 1} count`}
                      />
                      <span style={styles.fieldHint}>awards</span>
                      <button
                        type="button"
                        onClick={() => removeAwardTier(i)}
                        style={styles.removeBtn}
                        aria-label={`Remove award tier ${i + 1}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {showAwards && <button type="button" onClick={addAwardTier} style={styles.addBtn}>+ ADD TIER</button>}
                </section>

                {/* Section: Delegates (optional) */}
                <section style={styles.section}>
                  <div style={styles.sectionLabelRow}>
                    <button type="button" style={styles.optionalToggle} onClick={() => { setShowDelegates((v) => !v); if (!showDelegates && delegates.length === 0) setDelegates([{ name: '', country: '', portfolio: '' }]); }}>
                      <h3 style={styles.sectionLabel}>DELEGATES <span style={styles.optBadge}>OPTIONAL</span></h3>
                      <span style={styles.optChevron}>{showDelegates ? '▲' : '▼'}</span>
                    </button>
                    {showDelegates && (
                      <button type="button" onClick={() => setPasteMode((p) => !p)} style={styles.toggleBtn}>
                        {pasteMode ? 'ONE BY ONE' : 'PASTE NAMES'}
                      </button>
                    )}
                  </div>

                  {showDelegates && pasteMode ? (
                    <div style={styles.field}>
                      <label style={styles.label}>COMMA-SEPARATED NAMES</label>
                      <textarea
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        placeholder="Alice, Bob, Charlie, ..."
                        style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
                        maxLength={20000}
                      />
                      <button type="button" onClick={handlePaste} style={styles.addBtn}>
                        PARSE NAMES
                      </button>
                    </div>
                  ) : showDelegates ? (
                    <>
                      {delegates.map((d, i) => (
                        <div key={i} style={styles.rowGroup}>
                          <input
                            type="text"
                            value={d.name}
                            onChange={(e) => updateDelegate(i, 'name', e.target.value)}
                            placeholder="Name"
                            maxLength={100}
                            style={{ ...styles.input, flex: '2' }}
                            aria-label={`Delegate ${i + 1} name`}
                          />
                          <input
                            type="text"
                            value={d.country}
                            onChange={(e) => updateDelegate(i, 'country', e.target.value)}
                            placeholder="Country"
                            maxLength={100}
                            style={{ ...styles.input, flex: '1.5' }}
                            aria-label={`Delegate ${i + 1} country`}
                          />
                          {delegates.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeDelegate(i)}
                              style={styles.removeBtn}
                              aria-label={`Remove delegate ${i + 1}`}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={addDelegate} style={styles.addBtn}>
                        + ADD DELEGATE
                      </button>
                    </>
                  ) : null}
                </section>

                {error && (
                  <p style={styles.error} role="alert">{error}</p>
                )}

                <div style={styles.formActions}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={styles.cancelBtn}
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{ ...styles.submitBtn, opacity: loading ? 0.5 : 1 }}
                  >
                    {loading ? <span className="loading-text">CREATING</span> : 'CREATE COMMITTEE →'}
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          /* Access code reveal */
          <div style={styles.codeReveal}>
            <h2 style={styles.codeTitle}>COMMITTEE CREATED</h2>
            <p style={styles.codeWarning}>
              COPY AND SHARE THIS CODE.
              <br />
              IT WILL NOT BE SHOWN AGAIN.
            </p>
            <div style={styles.codeBox}>
              <span style={styles.codeText}>{accessCode}</span>
            </div>
            <button onClick={copyCode} style={styles.copyBtn}>
              {copied ? 'COPIED ✓' : 'COPY CODE'}
            </button>
            <button
              onClick={() => onCreated(createdId, accessCode)}
              style={styles.doneBtn}
            >
              DONE — OPEN COMMITTEE →
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>
        {label}{required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8,8,8,0.85)',
    zIndex: 200,
  },
  panel: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 201,
    background: 'var(--color-surface)',
    borderTop: '1px solid var(--border-emphasis)',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0,
  },
  panelTitle: {
    fontFamily: 'var(--font-wordmark)',
    fontSize: '1.4rem',
    color: 'var(--off-white)',
  },
  closeBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    color: 'var(--secondary)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    lineHeight: 1,
  },
  scrollArea: {
    overflowY: 'auto',
    flex: 1,
    padding: '1.5rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
    maxWidth: '700px',
    margin: '0 auto',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  sectionLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.7rem',
    color: 'var(--muted)',
    letterSpacing: '0.12em',
    marginBottom: '0.25rem',
    borderBottom: '1px solid var(--border-subtle)',
    paddingBottom: '0.35rem',
  },
  sectionLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-subtle)',
    paddingBottom: '0.35rem',
    marginBottom: '0.25rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  label: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.7rem',
    color: 'var(--secondary)',
    letterSpacing: '0.1em',
  },
  input: {
    background: 'transparent',
    border: '1px solid var(--border-emphasis)',
    borderRadius: '0',
    padding: '0.5rem 0.6rem',
    color: 'var(--off-white)',
    fontSize: '0.85rem',
    fontFamily: 'var(--font-body)',
    width: '100%',
  },
  rowGroup: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  removeBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.7rem',
    color: 'var(--muted)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    padding: '0.3rem',
  },
  addBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: 'var(--secondary)',
    background: 'none',
    border: '1px solid var(--border-subtle)',
    padding: '0.4rem 0.75rem',
    cursor: 'pointer',
    letterSpacing: '0.08em',
    alignSelf: 'flex-start',
  },
  toggleBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.65rem',
    color: 'var(--secondary)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    letterSpacing: '0.08em',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
  fieldHint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.7rem',
    color: 'var(--muted)',
    flexShrink: 0,
  },
  error: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: 'var(--off-white)',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-emphasis)',
    padding: '0.5rem 0.75rem',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '1rem',
    paddingTop: '0.5rem',
  },
  cancelBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: 'var(--secondary)',
    background: 'none',
    border: '1px solid var(--border-subtle)',
    padding: '0.6rem 1rem',
    cursor: 'pointer',
    letterSpacing: '0.06em',
  },
  submitBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: 'var(--off-white)',
    background: 'transparent',
    border: '1px solid var(--off-white)',
    padding: '0.6rem 1.25rem',
    cursor: 'pointer',
    letterSpacing: '0.06em',
  },
  codeReveal: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 2rem',
    gap: '1.25rem',
    textAlign: 'center',
  },
  codeTitle: {
    fontFamily: 'var(--font-wordmark)',
    fontSize: '1.8rem',
    color: 'var(--off-white)',
  },
  codeWarning: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    color: 'var(--secondary)',
    letterSpacing: '0.05em',
    lineHeight: 1.6,
  },
  codeBox: {
    border: '1px solid var(--off-white)',
    padding: '1rem 2.5rem',
    background: 'rgba(240,236,228,0.04)',
  },
  codeText: {
    fontFamily: 'var(--font-heading)',
    fontSize: '2.5rem',
    color: 'var(--off-white)',
    letterSpacing: '0.3em',
  },
  copyBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: 'var(--secondary)',
    background: 'none',
    border: '1px solid var(--border-subtle)',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    letterSpacing: '0.08em',
  },
  optionalToggle: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
    borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.35rem', marginBottom: '0.25rem',
  },
  optBadge: {
    fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: '#444',
    letterSpacing: '0.08em', marginLeft: '0.5rem',
  },
  optChevron: {
    fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#444',
  },
  doneBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    color: 'var(--off-white)',
    background: 'transparent',
    border: '1px solid var(--off-white)',
    padding: '0.75rem 1.5rem',
    cursor: 'pointer',
    letterSpacing: '0.06em',
    marginTop: '0.5rem',
  },
};
