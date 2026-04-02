'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';

type ExportTab = 'per-delegate' | 'full';

export default function ExportPage() {
  const params = useParams();
  const committeeId = params?.id as string;

  const [tab, setTab] = useState<ExportTab>('per-delegate');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exportData, setExportData] = useState<{
    sheets: unknown[];
    full_marksheet: unknown;
    audit_log: unknown[];
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/committee/${committeeId}/export`);
        if (!res.ok) {
          const d = await res.json();
          setError(d.error ?? 'Failed to load export data');
        } else {
          const data = await res.json();
          setExportData(data);
        }
      } catch {
        setError('Network error');
      }
      setLoading(false);
    }
    if (committeeId) load();
  }, [committeeId]);

  async function generatePDF(type: 'per-delegate' | 'full' | 'merged') {
    if (!exportData) return;
    setGenerating(true);

    try {
      // Dynamically import to avoid SSR issues with @react-pdf/renderer
      const { pdf } = await import('@react-pdf/renderer');
      const { PerDelegateSheetDocument, FullCommitteeMarksheetDocument } = await import(
        '@/components/pdf/PerDelegateSheet'
      );

      let blob: Blob;

      if (type === 'per-delegate') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = <PerDelegateSheetDocument sheets={exportData.sheets as any} />;
        blob = await pdf(doc).toBlob();
      } else if (type === 'full') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = <FullCommitteeMarksheetDocument data={exportData.full_marksheet as any} auditLog={exportData.audit_log as any} />;
        blob = await pdf(doc).toBlob();
      } else {
        // Merged: per-delegate + full together
        // Create per-delegate doc
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const perDelegateBlob = await pdf(<PerDelegateSheetDocument sheets={exportData.sheets as any} />).toBlob();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fullBlob = await pdf(<FullCommitteeMarksheetDocument data={exportData.full_marksheet as any} auditLog={exportData.audit_log as any} />).toBlob();
        // Merge by combining (simplified: just download both for now; true merge requires pdf-lib)
        blob = perDelegateBlob;
        const fullUrl = URL.createObjectURL(fullBlob);
        const fullA = document.createElement('a');
        fullA.href = fullUrl;
        fullA.download = 'markzo-full-marksheet.pdf';
        fullA.click();
        URL.revokeObjectURL(fullUrl);
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'per-delegate'
        ? 'markzo-per-delegate-sheets.pdf'
        : type === 'full'
        ? 'markzo-full-marksheet.pdf'
        : 'markzo-per-delegate-sheets.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[export] PDF generation error:', err);
      setError('Failed to generate PDF. Please try again.');
    }

    setGenerating(false);
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <p className="loading-text" style={styles.loadingText}>LOADING EXPORT DATA</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorWrap}>
        <p style={styles.errorText}>{error}</p>
      </div>
    );
  }

  const delegateCount = (exportData?.sheets ?? []).length;
  const auditCount = (exportData?.audit_log ?? []).length;

  return (
    <div style={styles.root}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={styles.container}
      >
        <h1 style={styles.heading}>EXPORT</h1>
        <p style={styles.subheading}>
          Generate official marking documents for this committee.
          {auditCount > 0 && ` ${auditCount} post-lock edit${auditCount !== 1 ? 's' : ''} will appear in the audit trail.`}
        </p>

        {/* Tab nav */}
        <div style={styles.tabs} role="tablist">
          <button
            onClick={() => setTab('per-delegate')}
            style={{ ...styles.tab, ...(tab === 'per-delegate' ? styles.tabActive : {}) }}
            role="tab"
            aria-selected={tab === 'per-delegate'}
          >
            PER-DELEGATE SHEETS
          </button>
          <button
            onClick={() => setTab('full')}
            style={{ ...styles.tab, ...(tab === 'full' ? styles.tabActive : {}) }}
            role="tab"
            aria-selected={tab === 'full'}
          >
            FULL MARKSHEET
          </button>
        </div>

        {/* Preview summary */}
        <div style={styles.previewCard}>
          {tab === 'per-delegate' ? (
            <>
              <p style={styles.previewTitle}>PER-DELEGATE SHEETS</p>
              <p style={styles.previewDesc}>
                {delegateCount} page{delegateCount !== 1 ? 's' : ''}, one per delegate.
                Includes: score breakdown, award tier, EB remarks, verbatim record (if entered).
              </p>
            </>
          ) : (
            <>
              <p style={styles.previewTitle}>FULL COMMITTEE MARKSHEET</p>
              <p style={styles.previewDesc}>
                All delegates in one ranked table. Award assignments section.
                {auditCount > 0 && ` Audit trail with ${auditCount} post-lock edit${auditCount !== 1 ? 's' : ''}.`}
              </p>
            </>
          )}

          <p style={styles.previewNote}>
            Clean formal layout — white background, black text. Suitable for distribution.
          </p>
        </div>

        {/* Download buttons */}
        <div style={styles.downloadRow}>
          <button
            onClick={() => generatePDF(tab)}
            disabled={generating}
            style={{ ...styles.downloadBtn, opacity: generating ? 0.5 : 1 }}
          >
            {generating
              ? <span className="loading-text">GENERATING</span>
              : `DOWNLOAD ${tab === 'per-delegate' ? 'PER-DELEGATE' : 'FULL MARKSHEET'} PDF →`
            }
          </button>

          <button
            onClick={() => generatePDF('merged')}
            disabled={generating}
            style={{ ...styles.mergeBtn, opacity: generating ? 0.4 : 1 }}
          >
            DOWNLOAD EVERYTHING (2 PDFs)
          </button>
        </div>

        {/* Transparency note */}
        <div style={styles.transparencyNote}>
          <p style={styles.transparencyText}>
            All PDFs include: Committee name · EB signatures · Compute timestamp ·
            &quot;Created using Markzo | markzo.sandnco.lol&quot;
          </p>
          {auditCount > 0 && (
            <p style={styles.auditNote}>
              ⚠ This committee has post-lock edits. The full marksheet PDF includes a complete audit trail.
            </p>
          )}
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
  loading: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh',
  },
  loadingText: {
    fontFamily: 'var(--font-body)', color: 'var(--secondary)', fontSize: '0.9rem', letterSpacing: '0.1em',
  },
  errorWrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh',
  },
  errorText: {
    fontFamily: 'var(--font-body)', color: 'var(--secondary)', fontSize: '0.9rem',
  },
  container: {
    maxWidth: '640px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  heading: {
    fontFamily: 'var(--font-wordmark)',
    fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
    color: 'var(--off-white)',
  },
  subheading: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: 'var(--secondary)',
    lineHeight: 1.6,
  },
  tabs: {
    display: 'flex',
    gap: '0',
    borderBottom: '1px solid var(--border-subtle)',
  },
  tab: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    letterSpacing: '0.1em',
    color: 'var(--secondary)',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    padding: '0.6rem 1rem',
    cursor: 'pointer',
    marginBottom: '-1px',
  },
  tabActive: {
    color: 'var(--off-white)',
    borderBottom: '2px solid var(--off-white)',
  },
  previewCard: {
    border: '1px solid var(--border-subtle)',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    background: 'rgba(240,236,228,0.02)',
  },
  previewTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1rem',
    color: 'var(--off-white)',
  },
  previewDesc: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: 'var(--secondary)',
    lineHeight: 1.5,
  },
  previewNote: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    color: 'var(--muted)',
    fontStyle: 'italic',
  },
  downloadRow: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  downloadBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: 'var(--off-white)',
    background: 'transparent',
    border: '1px solid var(--off-white)',
    padding: '0.7rem 1.25rem',
    cursor: 'pointer',
    letterSpacing: '0.06em',
  },
  mergeBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: 'var(--secondary)',
    background: 'transparent',
    border: '1px solid var(--border-subtle)',
    padding: '0.6rem 1rem',
    cursor: 'pointer',
    letterSpacing: '0.06em',
  },
  transparencyNote: {
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  transparencyText: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.7rem',
    color: 'var(--muted)',
    lineHeight: 1.5,
  },
  auditNote: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    color: 'var(--secondary)',
    lineHeight: 1.5,
  },
};
