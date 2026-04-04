import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

interface SubCriterion { name: string; max: number; }

interface SchemaFieldBreakdown {
  field_id: string;
  field_name: string;
  field_type: string;
  max_score: number;
  scoring_mode: string;
  score: number;
  item_count: number;
  weight?: number;
  sub_criteria?: SubCriterion[];
  sub_scores?: { criterion: string; score: number }[];
}

export interface DelegateSheetData {
  conference_name: string;
  committee_name: string;
  computed_at: string;
  locked: boolean;
  is_edited_after_lock: boolean;
  last_edited_at?: string;
  last_edited_by_name?: string;
  delegate_name: string;
  country?: string | null;
  portfolio?: string | null;
  total_score: number;
  rank: number;
  total_delegates: number;
  award_tier?: string | null;
  roll_call_status?: string | null;
  fields: SchemaFieldBreakdown[];
  verbatim?: string | null;
  eb_remarks?: string | null;
  eb_members: { role: string; name: string }[];
  // committee stats
  present_count?: number;
  pav_count?: number;
  absent_count?: number;
}

const BLACK = '#0a0a0a';
const MID   = '#666';
const RULE  = '#d0cbc3';
const WARN  = '#c0392b';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica', fontSize: 9, color: BLACK,
    backgroundColor: '#ffffff', padding: '36px 44px 70px',
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14, paddingBottom: 10,
    borderBottomWidth: 1.5, borderBottomColor: BLACK, borderBottomStyle: 'solid',
  },
  headerWordmark: { fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 2 },
  headerCenter: { textAlign: 'center', flex: 1, paddingHorizontal: 12 },
  headerConference: { fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 1 },
  headerCommittee:  { fontSize: 8, color: MID, textAlign: 'center' },
  headerMeta: { textAlign: 'right' },
  headerDate: { fontSize: 7.5, color: MID, textAlign: 'right' },
  headerDoc:  { fontSize: 7, color: '#aaa', textAlign: 'right', marginTop: 1 },

  // ── Delegate block ───────────────────────────────────────────────────────
  delegateBlock: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 14, paddingBottom: 12,
    borderBottomWidth: 0.5, borderBottomColor: RULE, borderBottomStyle: 'solid',
  },
  delegateLeft: { flex: 1 },
  delegateName: { fontSize: 22, fontFamily: 'Helvetica-Bold', marginBottom: 2, letterSpacing: -0.5 },
  delegateSub:  { fontSize: 8.5, color: MID, marginBottom: 6 },
  rollStatus: { fontSize: 7, letterSpacing: 0.5, color: MID, borderWidth: 0.5, borderColor: RULE, borderStyle: 'solid', paddingHorizontal: 5, paddingVertical: 1, alignSelf: 'flex-start' },
  delegateRight: { alignItems: 'flex-end', gap: 4 },
  scoreBox: {
    borderWidth: 1, borderColor: BLACK, borderStyle: 'solid',
    paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center',
  },
  scoreBoxLabel: { fontSize: 6.5, letterSpacing: 1, color: MID, marginBottom: 2 },
  scoreBoxValue: { fontSize: 26, fontFamily: 'Helvetica-Bold', lineHeight: 1 },
  rankText: { fontSize: 8, color: MID, marginTop: 2 },
  awardBadge: {
    borderWidth: 1, borderColor: BLACK, borderStyle: 'solid',
    paddingHorizontal: 8, paddingVertical: 3, marginTop: 4,
  },
  awardText: { fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },

  // ── Committee stats bar ──────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row', gap: 6, marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 0.5, borderBottomColor: RULE, borderBottomStyle: 'solid',
  },
  statChip: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 0.5, borderColor: RULE, borderStyle: 'solid',
    flexDirection: 'column', gap: 1,
  },
  statChipLabel: { fontSize: 6, letterSpacing: 0.8, color: MID },
  statChipValue: { fontSize: 11, fontFamily: 'Helvetica-Bold' },

  // ── Section title ────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 7, fontFamily: 'Helvetica-Bold', color: MID,
    letterSpacing: 1.2, marginBottom: 6, marginTop: 14,
    borderBottomWidth: 0.5, borderBottomColor: RULE, borderBottomStyle: 'solid',
    paddingBottom: 3,
  },

  // ── Score breakdown table ────────────────────────────────────────────────
  table: { borderWidth: 0.5, borderColor: RULE, borderStyle: 'solid' },
  tableHeaderRow: {
    flexDirection: 'row', backgroundColor: '#f5f2ed',
    borderBottomWidth: 0.5, borderBottomColor: RULE, borderBottomStyle: 'solid',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5, borderBottomColor: RULE, borderBottomStyle: 'solid',
  },
  tableRowLast: { flexDirection: 'row' },
  cField:  { width: '38%', padding: '4px 6px' },
  cScore:  { width: '14%', padding: '4px 6px', textAlign: 'right' },
  cMax:    { width: '12%', padding: '4px 6px', textAlign: 'right' },
  cMode:   { width: '14%', padding: '4px 6px' },
  cBar:    { flex: 1, padding: '4px 6px', justifyContent: 'center' },
  cellTxt: { fontSize: 8.5 },
  cellBold:{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  barTrack:{ height: 4, backgroundColor: '#eee' },
  barFill: { height: 4, backgroundColor: BLACK },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 8, marginTop: 6,
    borderTopWidth: 1.5, borderTopColor: BLACK, borderTopStyle: 'solid',
  },
  totalLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  totalScore: { fontSize: 18, fontFamily: 'Helvetica-Bold' },

  // ── Text blocks ──────────────────────────────────────────────────────────
  verbatimBlock: { fontFamily: 'Courier', fontSize: 7.5, lineHeight: 1.6, color: '#333', marginTop: 4 },
  remarksBlock:  { fontFamily: 'Helvetica', fontSize: 8.5, lineHeight: 1.5, color: '#333', marginTop: 4 },
  editWarning:   { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: WARN, marginBottom: 2 },

  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute', bottom: 24, left: 44, right: 44,
    borderTopWidth: 1, borderTopColor: BLACK, borderTopStyle: 'solid',
    paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  sigBlock: { flex: 1 },
  sigLabel: { fontSize: 6.5, color: MID, marginBottom: 3, letterSpacing: 0.6 },
  sigRow:   { flexDirection: 'row', gap: 24, flexWrap: 'wrap' },
  sigItem:  { flexDirection: 'column', gap: 1, minWidth: 80 },
  sigName:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold' },
  sigRole:  { fontSize: 6.5, color: MID },
  footerRight: { textAlign: 'right' },
  footerBrand: { fontSize: 7, color: '#aaa', textAlign: 'right' },
});

// ── Per-delegate document ──────────────────────────────────────────────────

export function PerDelegateSheetDocument({ sheets }: { sheets: DelegateSheetData[] }) {
  return (
    <Document title="Markzo — Per-Delegate Sheets">
      {sheets.map((d, pi) => (
        <Page key={pi} size="A4" style={s.page}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerWordmark}>MARKZO</Text>
            <View style={s.headerCenter}>
              <Text style={s.headerConference}>{d.conference_name}</Text>
              <Text style={s.headerCommittee}>{d.committee_name}</Text>
            </View>
            <View style={s.headerMeta}>
              <Text style={s.headerDate}>
                {new Date(d.computed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
              <Text style={s.headerDoc}>DELEGATE MARKSHEET</Text>
            </View>
          </View>

          {/* Delegate info */}
          <View style={s.delegateBlock}>
            <View style={s.delegateLeft}>
              <Text style={s.delegateName}>{d.delegate_name}</Text>
              {(d.country || d.portfolio) && (
                <Text style={s.delegateSub}>{[d.country, d.portfolio].filter(Boolean).join(' · ')}</Text>
              )}
              {d.roll_call_status && (
                <Text style={s.rollStatus}>
                  {d.roll_call_status === 'present_and_voting' ? 'PRESENT & VOTING'
                    : d.roll_call_status.toUpperCase()}
                </Text>
              )}
            </View>
            <View style={s.delegateRight}>
              <View style={s.scoreBox}>
                <Text style={s.scoreBoxLabel}>TOTAL SCORE</Text>
                <Text style={s.scoreBoxValue}>{d.total_score.toFixed(1)}</Text>
                <Text style={s.rankText}>RANK #{d.rank} of {d.total_delegates}</Text>
              </View>
              {d.award_tier && (
                <View style={s.awardBadge}><Text style={s.awardText}>{d.award_tier.toUpperCase()}</Text></View>
              )}
            </View>
          </View>

          {/* Committee stats */}
          {(d.present_count !== undefined) && (
            <View style={s.statsRow}>
              <View style={s.statChip}>
                <Text style={s.statChipLabel}>PRESENT</Text>
                <Text style={s.statChipValue}>{(d.present_count ?? 0) + (d.pav_count ?? 0)}</Text>
              </View>
              <View style={s.statChip}>
                <Text style={s.statChipLabel}>P&V</Text>
                <Text style={s.statChipValue}>{d.pav_count ?? 0}</Text>
              </View>
              <View style={s.statChip}>
                <Text style={s.statChipLabel}>ABSENT</Text>
                <Text style={s.statChipValue}>{d.absent_count ?? 0}</Text>
              </View>
            </View>
          )}

          {/* Score breakdown */}
          <Text style={s.sectionTitle}>SCORE BREAKDOWN</Text>
          <View style={s.table}>
            <View style={s.tableHeaderRow}>
              <View style={s.cField}><Text style={s.cellBold}>Field</Text></View>
              <View style={s.cScore}><Text style={s.cellBold}>Score</Text></View>
              <View style={s.cMax}><Text style={s.cellBold}>Max</Text></View>
              <View style={s.cMode}><Text style={s.cellBold}>Mode</Text></View>
              <View style={s.cBar}><Text style={s.cellBold}>—</Text></View>
            </View>
            {d.fields.map((f, i) => {
              const pct = f.max_score > 0 ? Math.min(1, f.score / f.max_score) : 0;
              return (
                <View key={f.field_id} style={i === d.fields.length - 1 ? s.tableRowLast : s.tableRow}>
                  <View style={s.cField}><Text style={s.cellTxt}>{f.field_name}{f.weight && f.weight !== 1 ? ` (×${f.weight})` : ''}</Text></View>
                  <View style={s.cScore}><Text style={s.cellBold}>{f.score.toFixed(1)}</Text></View>
                  <View style={s.cMax}><Text style={s.cellTxt}>{f.max_score}</Text></View>
                  <View style={s.cMode}><Text style={s.cellTxt}>{f.scoring_mode}</Text></View>
                  <View style={s.cBar}>
                    <View style={s.barTrack}>
                      <View style={{ ...s.barFill, width: `${Math.round(pct * 100)}%` }} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={s.totalRow}>
            <Text style={s.totalLabel}>TOTAL SCORE</Text>
            <Text style={s.totalScore}>{d.total_score.toFixed(1)}</Text>
          </View>

          {/* EB remarks */}
          {d.eb_remarks && (
            <>
              <Text style={s.sectionTitle}>EB REMARKS</Text>
              <Text style={s.remarksBlock}>{d.eb_remarks}</Text>
            </>
          )}

          {/* Verbatim */}
          {d.verbatim && (
            <>
              <Text style={s.sectionTitle}>VERBATIM RECORD</Text>
              <Text style={s.verbatimBlock}>{d.verbatim}</Text>
            </>
          )}

          {/* Post-lock edit warning */}
          {d.is_edited_after_lock && (
            <Text style={{ ...s.editWarning, marginTop: 10 }}>
              ⚠ EDITED POST-LOCK — {d.last_edited_at ? new Date(d.last_edited_at).toLocaleString() : ''}{d.last_edited_by_name ? ` by ${d.last_edited_by_name}` : ''}
            </Text>
          )}

          {/* Footer / EB signatures */}
          <View style={s.footer} fixed>
            <View style={s.sigBlock}>
              <Text style={s.sigLabel}>EB SIGNATURES</Text>
              <View style={s.sigRow}>
                {d.eb_members.map((m, i) => (
                  <View key={i} style={s.sigItem}>
                    <Text style={s.sigName}>{m.name}</Text>
                    <Text style={s.sigRole}>{m.role}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={s.footerRight}>
              <Text style={s.footerBrand}>Markzo · markzo.sandnco.lol</Text>
              <Text style={s.footerBrand}>Transparent MUN marking · {new Date(d.computed_at).toLocaleString()}</Text>
            </View>
          </View>
        </Page>
      ))}
    </Document>
  );
}

// ── Full committee marksheet ────────────────────────────────────────────────

interface RollCallData {
  delegates: { name: string; country?: string | null; status?: string | null }[];
  present: number; pav: number; absent: number; total: number;
  quorum: number; simple_majority: number; special_majority: number;
}

interface RecognitionType { id: string; name: string; }
interface RecognitionRow {
  delegate_id: string; name: string; country?: string | null;
  counts: { type_id: string; type_name: string; count: number }[];
  total: number;
}

interface VerbatimItem {
  name: string; country?: string | null;
  verbatim?: string | null; eb_remarks?: string | null;
}

export function FullCommitteeMarksheetDocument({
  data, auditLog,
}: {
  data: {
    conference_name: string; committee_name: string; computed_at: string;
    is_edited_after_lock: boolean; last_edited_at?: string; last_edited_by_name?: string;
    eb_members: { role: string; name: string }[];
    rankings: {
      rank: number; name: string; country?: string | null;
      total_score: number; award_tier?: string | null;
      breakdown: { field_name: string; score: number }[];
    }[];
    schema_fields: { id: string; field_name: string }[];
    award_assignments: { award_tier: string; delegates: string[] }[];
    stats?: { present: number; pav: number; absent: number; total: number; quorum: number };
    roll_call?: RollCallData;
    recognition_types?: RecognitionType[];
    recognition_table?: RecognitionRow[];
    verbatim_list?: VerbatimItem[];
  };
  auditLog: {
    id: string; edited_at: string; edited_by_guest_name: string | null;
    old_score: number; new_score: number; note: string | null;
  }[];
}) {
  const fields = data.schema_fields;
  const rollCall = data.roll_call;
  const recTypes = data.recognition_types ?? [];
  const recTable = data.recognition_table ?? [];
  const verbatimList = data.verbatim_list ?? [];

  function PageFooter() {
    return (
      <View style={s.footer} fixed>
        <View style={s.sigBlock}>
          <Text style={s.sigLabel}>EB SIGNATURES</Text>
          <View style={s.sigRow}>
            {data.eb_members.map((m, i) => (
              <View key={i} style={s.sigItem}>
                <Text style={s.sigName}>{m.name}</Text>
                <Text style={s.sigRole}>{m.role}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={s.footerRight}>
          <Text style={s.footerBrand}>Markzo · markzo.sandnco.lol · Transparent MUN marking</Text>
          <Text style={s.footerBrand}>Computed: {new Date(data.computed_at).toLocaleString()}</Text>
        </View>
      </View>
    );
  }

  function PageHeader({ subtitle }: { subtitle: string }) {
    return (
      <View style={s.header}>
        <Text style={s.headerWordmark}>MARKZO</Text>
        <View style={s.headerCenter}>
          <Text style={s.headerConference}>{data.conference_name}</Text>
          <Text style={s.headerCommittee}>{data.committee_name} — {subtitle}</Text>
        </View>
        <View style={s.headerMeta}>
          <Text style={s.headerDate}>
            {new Date(data.computed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </View>
      </View>
    );
  }

  const statusLabel = (s: string | null | undefined) => {
    if (s === 'present_and_voting') return 'P&V';
    if (s === 'present') return 'P';
    if (s === 'absent') return 'A';
    return '—';
  };

  return (
    <Document title="Markzo — Full Committee Marksheet">

      {/* ── PAGE 1: Rankings ───────────────────────────────────────────── */}
      <Page size="A4" style={{ ...s.page, paddingBottom: 80 }} orientation="landscape">
        <PageHeader subtitle="FULL MARKSHEET" />

        {/* Committee statistics */}
        {data.stats && (
          <View style={{ ...s.statsRow, marginBottom: 10 }}>
            {[
              { label: 'TOTAL', value: data.stats.total },
              { label: 'PRESENT', value: data.stats.present + data.stats.pav },
              { label: 'P&V', value: data.stats.pav },
              { label: 'ABSENT', value: data.stats.absent },
              { label: 'QUORUM', value: data.stats.quorum },
            ].map((item) => (
              <View key={item.label} style={s.statChip}>
                <Text style={s.statChipLabel}>{item.label}</Text>
                <Text style={s.statChipValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Rankings table */}
        <Text style={s.sectionTitle}>DELEGATE RANKINGS</Text>
        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <View style={{ width: '4%', padding: '3px 4px' }}><Text style={s.cellBold}>#</Text></View>
            <View style={{ width: '22%', padding: '3px 4px' }}><Text style={s.cellBold}>Delegate</Text></View>
            {fields.map((f) => (
              <View key={f.id} style={{ flex: 1, padding: '3px 4px' }}>
                <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold' }}>{f.field_name}</Text>
              </View>
            ))}
            <View style={{ width: '10%', padding: '3px 4px' }}><Text style={s.cellBold}>Total</Text></View>
            <View style={{ width: '16%', padding: '3px 4px' }}><Text style={s.cellBold}>Award</Text></View>
          </View>
          {data.rankings.map((r, i) => (
            <View key={r.rank} style={i === data.rankings.length - 1 ? s.tableRowLast : s.tableRow}>
              <View style={{ width: '4%', padding: '3px 4px' }}><Text style={s.cellTxt}>{r.rank}</Text></View>
              <View style={{ width: '22%', padding: '3px 4px' }}>
                <Text style={{ fontSize: 8 }}>{r.name}</Text>
                {r.country && <Text style={{ fontSize: 6.5, color: MID }}>{r.country}</Text>}
              </View>
              {fields.map((f) => {
                const bd = r.breakdown.find((b) => b.field_name === f.field_name);
                return (
                  <View key={f.id} style={{ flex: 1, padding: '3px 4px' }}>
                    <Text style={s.cellTxt}>{bd ? bd.score.toFixed(1) : '—'}</Text>
                  </View>
                );
              })}
              <View style={{ width: '10%', padding: '3px 4px' }}>
                <Text style={s.cellBold}>{r.total_score.toFixed(1)}</Text>
              </View>
              <View style={{ width: '16%', padding: '3px 4px' }}>
                <Text style={{ fontSize: 7.5 }}>{r.award_tier ?? ''}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Awards */}
        {data.award_assignments.length > 0 && (
          <>
            <Text style={s.sectionTitle}>AWARD ASSIGNMENTS</Text>
            {data.award_assignments.map((a) => (
              <View key={a.award_tier} style={{ marginBottom: 3 }}>
                <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginBottom: 1 }}>{a.award_tier}</Text>
                <Text style={{ fontSize: 8, color: MID }}>{a.delegates.join(', ')}</Text>
              </View>
            ))}
          </>
        )}

        {/* Audit trail */}
        {auditLog.length > 0 && (
          <>
            <Text style={s.sectionTitle}>AUDIT TRAIL — POST-LOCK EDITS</Text>
            <View style={s.table}>
              <View style={s.tableHeaderRow}>
                <View style={{ width: '22%', padding: '3px 5px' }}><Text style={s.cellBold}>Timestamp</Text></View>
                <View style={{ width: '22%', padding: '3px 5px' }}><Text style={s.cellBold}>Editor</Text></View>
                <View style={{ width: '12%', padding: '3px 5px' }}><Text style={s.cellBold}>Old</Text></View>
                <View style={{ width: '12%', padding: '3px 5px' }}><Text style={s.cellBold}>New</Text></View>
                <View style={{ flex: 1, padding: '3px 5px' }}><Text style={s.cellBold}>Note</Text></View>
              </View>
              {auditLog.map((e, i) => (
                <View key={e.id} style={i === auditLog.length - 1 ? s.tableRowLast : s.tableRow}>
                  <View style={{ width: '22%', padding: '3px 5px' }}><Text style={s.cellTxt}>{new Date(e.edited_at).toLocaleString()}</Text></View>
                  <View style={{ width: '22%', padding: '3px 5px' }}><Text style={s.cellTxt}>{e.edited_by_guest_name ?? 'Auth User'}</Text></View>
                  <View style={{ width: '12%', padding: '3px 5px' }}><Text style={s.cellTxt}>{e.old_score}</Text></View>
                  <View style={{ width: '12%', padding: '3px 5px' }}><Text style={s.cellTxt}>{e.new_score}</Text></View>
                  <View style={{ flex: 1, padding: '3px 5px' }}><Text style={s.cellTxt}>{e.note ?? ''}</Text></View>
                </View>
              ))}
            </View>
          </>
        )}

        <PageFooter />
      </Page>

      {/* ── PAGE 2: Roll Call ──────────────────────────────────────────── */}
      {rollCall && (
        <Page size="A4" style={s.page}>
          <PageHeader subtitle="ROLL CALL" />

          {/* Stats chips */}
          <View style={{ ...s.statsRow, marginBottom: 14 }}>
            {[
              { label: 'TOTAL DELEGATES', value: rollCall.total },
              { label: 'PRESENT (P)', value: rollCall.present },
              { label: 'PRESENT & VOTING', value: rollCall.pav },
              { label: 'ABSENT', value: rollCall.absent },
              { label: 'QUORUM', value: rollCall.quorum },
            ].map((item) => (
              <View key={item.label} style={s.statChip}>
                <Text style={s.statChipLabel}>{item.label}</Text>
                <Text style={s.statChipValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          {/* Majority thresholds */}
          <Text style={s.sectionTitle}>VOTING THRESHOLDS</Text>
          <View style={{ ...s.statsRow, marginBottom: 14 }}>
            {[
              { label: 'SIMPLE MAJORITY (>50% of P&V)', value: rollCall.simple_majority },
              { label: 'SPECIAL MAJORITY (2/3 of P&V)', value: rollCall.special_majority },
              { label: 'VOTING (P&V)', value: rollCall.pav },
            ].map((item) => (
              <View key={item.label} style={{ ...s.statChip, flex: 1 }}>
                <Text style={s.statChipLabel}>{item.label}</Text>
                <Text style={{ ...s.statChipValue, fontSize: 18 }}>{item.value}</Text>
              </View>
            ))}
          </View>

          {/* Roll call list */}
          <Text style={s.sectionTitle}>ATTENDANCE LIST</Text>
          <View style={s.table}>
            <View style={s.tableHeaderRow}>
              <View style={{ width: '5%', padding: '3px 5px' }}><Text style={s.cellBold}>#</Text></View>
              <View style={{ flex: 1, padding: '3px 5px' }}><Text style={s.cellBold}>Delegate</Text></View>
              <View style={{ width: '20%', padding: '3px 5px' }}><Text style={s.cellBold}>Country</Text></View>
              <View style={{ width: '18%', padding: '3px 5px' }}><Text style={s.cellBold}>Status</Text></View>
            </View>
            {rollCall.delegates.map((d, i) => (
              <View key={i} style={i === rollCall.delegates.length - 1 ? s.tableRowLast : s.tableRow}>
                <View style={{ width: '5%', padding: '3px 5px' }}><Text style={s.cellTxt}>{i + 1}</Text></View>
                <View style={{ flex: 1, padding: '3px 5px' }}><Text style={s.cellTxt}>{d.name}</Text></View>
                <View style={{ width: '20%', padding: '3px 5px' }}><Text style={{ fontSize: 7.5, color: MID }}>{d.country ?? ''}</Text></View>
                <View style={{ width: '18%', padding: '3px 5px' }}>
                  <Text style={{
                    fontSize: 8, fontFamily: 'Helvetica-Bold',
                    color: d.status === 'present_and_voting' ? '#b8860b'
                      : d.status === 'present' ? '#2e7d32'
                      : d.status === 'absent' ? '#888'
                      : MID,
                  }}>
                    {statusLabel(d.status)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <PageFooter />
        </Page>
      )}

      {/* ── PAGE 3: Recognitions ───────────────────────────────────────── */}
      {recTypes.length > 0 && (
        <Page size="A4" style={s.page} orientation={recTypes.length > 4 ? 'landscape' : 'portrait'}>
          <PageHeader subtitle="RECOGNITIONS" />

          {/* Committee totals */}
          <View style={{ ...s.statsRow, marginBottom: 14 }}>
            {recTypes.map((t) => (
              <View key={t.id} style={s.statChip}>
                <Text style={s.statChipLabel}>{t.name.toUpperCase()}</Text>
                <Text style={s.statChipValue}>
                  {recTable.reduce((s, r) => s + (r.counts.find((c) => c.type_id === t.id)?.count ?? 0), 0)}
                </Text>
              </View>
            ))}
            <View style={s.statChip}>
              <Text style={s.statChipLabel}>TOTAL</Text>
              <Text style={s.statChipValue}>{recTable.reduce((s, r) => s + r.total, 0)}</Text>
            </View>
          </View>

          <Text style={s.sectionTitle}>RECOGNITION BREAKDOWN — PER DELEGATE</Text>
          <View style={s.table}>
            <View style={s.tableHeaderRow}>
              <View style={{ width: '30%', padding: '3px 5px' }}><Text style={s.cellBold}>Delegate</Text></View>
              {recTypes.map((t) => (
                <View key={t.id} style={{ flex: 1, padding: '3px 5px' }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold' }}>{t.name}</Text>
                </View>
              ))}
              <View style={{ width: '10%', padding: '3px 5px' }}><Text style={s.cellBold}>Total</Text></View>
            </View>
            {recTable.map((r, i) => (
              <View key={r.delegate_id} style={i === recTable.length - 1 ? s.tableRowLast : s.tableRow}>
                <View style={{ width: '30%', padding: '3px 5px' }}>
                  <Text style={{ fontSize: 8 }}>{r.name}</Text>
                  {r.country && <Text style={{ fontSize: 6.5, color: MID }}>{r.country}</Text>}
                </View>
                {recTypes.map((t) => {
                  const c = r.counts.find((x) => x.type_id === t.id);
                  return (
                    <View key={t.id} style={{ flex: 1, padding: '3px 5px' }}>
                      <Text style={{ fontSize: 8.5, fontFamily: c && c.count > 0 ? 'Helvetica-Bold' : 'Helvetica' }}>
                        {c?.count ?? 0}
                      </Text>
                    </View>
                  );
                })}
                <View style={{ width: '10%', padding: '3px 5px' }}>
                  <Text style={s.cellBold}>{r.total}</Text>
                </View>
              </View>
            ))}
          </View>

          <PageFooter />
        </Page>
      )}

      {/* ── PAGE 4: Verbatim ───────────────────────────────────────────── */}
      {verbatimList.length > 0 && (
        <Page size="A4" style={s.page}>
          <PageHeader subtitle="VERBATIM RECORD (GSL)" />

          <Text style={s.sectionTitle}>DELEGATE SPEECHES & REMARKS</Text>

          {verbatimList.map((v, i) => (
            <View key={i} style={{ marginBottom: 14, paddingBottom: 12,
              borderBottomWidth: i === verbatimList.length - 1 ? 0 : 0.5,
              borderBottomColor: RULE, borderBottomStyle: 'solid' }}>
              {/* Delegate name */}
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 4, gap: 6 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold' }}>{v.name}</Text>
                {v.country && <Text style={{ fontSize: 8, color: MID }}>{v.country}</Text>}
              </View>

              {/* Verbatim */}
              {v.verbatim && (
                <>
                  <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: MID, letterSpacing: 0.8, marginBottom: 3 }}>VERBATIM</Text>
                  <Text style={s.verbatimBlock}>{v.verbatim}</Text>
                </>
              )}

              {/* EB Remarks */}
              {v.eb_remarks && (
                <>
                  <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: MID, letterSpacing: 0.8, marginTop: 6, marginBottom: 3 }}>EB REMARKS</Text>
                  <Text style={s.remarksBlock}>{v.eb_remarks}</Text>
                </>
              )}
            </View>
          ))}

          <PageFooter />
        </Page>
      )}

    </Document>
  );
}
