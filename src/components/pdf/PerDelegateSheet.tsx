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

// ── CRAZY THEME PALETTE ────────────────────────────────────────────────────
const BG       = '#080808';   // near-black background
const BG2      = '#0f0f0f';   // slightly lighter bg
const BG3      = '#161616';   // card bg
const NEON     = '#C8FF00';   // electric acid green
const HOT      = '#FF2D7E';   // hot pink
const CYAN     = '#00F0FF';   // electric cyan
const GOLD     = '#FFB800';   // warm gold
const OFF_W    = '#F0ECE4';   // off-white text
const DIM      = '#555555';   // dimmed text
const DIMMER   = '#2a2a2a';   // very dim borders
const WARN_R   = '#FF3B30';   // warning red

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica', fontSize: 9, color: OFF_W,
    backgroundColor: BG, padding: '0px 0px 80px',
  },
  pageLandscape: {
    fontFamily: 'Helvetica', fontSize: 8.5, color: OFF_W,
    backgroundColor: BG, padding: '0px 0px 80px',
  },

  // ── MEGA HEADER BLOCK ────────────────────────────────────────────────────
  headerBand: {
    backgroundColor: NEON, paddingHorizontal: 36, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 0,
  },
  headerWordmark: {
    fontSize: 22, fontFamily: 'Helvetica-Bold', letterSpacing: 4,
    color: BG,
  },
  headerCenterBlock: { alignItems: 'center', flex: 1, paddingHorizontal: 10 },
  headerConference: {
    fontSize: 10, fontFamily: 'Helvetica-Bold', color: BG,
    textAlign: 'center', letterSpacing: 1.5, marginBottom: 1,
  },
  headerCommittee: {
    fontSize: 7.5, color: '#2a2a2a', textAlign: 'center', letterSpacing: 0.8,
  },
  headerRight: { alignItems: 'flex-end' },
  headerDate: { fontSize: 7, color: BG, letterSpacing: 0.4, textAlign: 'right' },
  headerDocType: {
    fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#1a1a1a',
    letterSpacing: 1.5, textAlign: 'right', marginTop: 2,
  },

  // Sub-header pink bar
  subHeaderBand: {
    backgroundColor: HOT, paddingHorizontal: 36, paddingVertical: 5,
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20,
  },
  subHeaderText: {
    fontSize: 7, fontFamily: 'Helvetica-Bold', color: OFF_W,
    letterSpacing: 2,
  },
  subHeaderDot: {
    width: 3, height: 3, backgroundColor: OFF_W,
  },

  innerPad: { paddingHorizontal: 36 },

  // ── DELEGATE BLOCK ───────────────────────────────────────────────────────
  delegateBlock: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 16, paddingHorizontal: 36, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: DIMMER, borderBottomStyle: 'solid',
  },
  delegateLeft: { flex: 1 },
  delegateName: {
    fontSize: 30, fontFamily: 'Helvetica-Bold', color: OFF_W,
    letterSpacing: -1, marginBottom: 4, lineHeight: 1,
  },
  delegateSub:  { fontSize: 9, color: DIM, marginBottom: 8, letterSpacing: 0.3 },
  rollStatus: {
    fontSize: 7, letterSpacing: 1.5, color: NEON,
    borderWidth: 1, borderColor: NEON, borderStyle: 'solid',
    paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start',
    fontFamily: 'Helvetica-Bold',
  },
  delegateRight: { alignItems: 'flex-end', gap: 6 },

  // Score box — big neon number
  scoreBox: {
    borderWidth: 2, borderColor: NEON, borderStyle: 'solid',
    backgroundColor: BG3,
    paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center',
    minWidth: 90,
  },
  scoreBoxLabel: {
    fontSize: 6, letterSpacing: 1.8, color: NEON,
    fontFamily: 'Helvetica-Bold', marginBottom: 4,
  },
  scoreBoxValue: {
    fontSize: 38, fontFamily: 'Helvetica-Bold', color: NEON, lineHeight: 1,
  },
  rankText: { fontSize: 7.5, color: DIM, marginTop: 4, letterSpacing: 0.3 },
  awardBadge: {
    borderWidth: 1.5, borderColor: GOLD, borderStyle: 'solid',
    backgroundColor: '#1a1400',
    paddingHorizontal: 10, paddingVertical: 4,
  },
  awardText: {
    fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 2, color: GOLD,
  },

  // ── STATS BAR ────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row', gap: 1, marginBottom: 16,
    marginHorizontal: 36,
  },
  statChip: {
    flex: 1, paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: BG3,
    borderWidth: 1, borderColor: DIMMER, borderStyle: 'solid',
    flexDirection: 'column', gap: 2,
  },
  statChipLabel: { fontSize: 6, letterSpacing: 1.2, color: DIM, fontFamily: 'Helvetica-Bold' },
  statChipValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: OFF_W },

  // ── SECTION TITLE ────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 7, fontFamily: 'Helvetica-Bold', color: BG,
    letterSpacing: 2, marginBottom: 0, marginTop: 14,
    backgroundColor: CYAN,
    paddingHorizontal: 36, paddingVertical: 5,
  },
  sectionTitleInner: {
    fontSize: 7, fontFamily: 'Helvetica-Bold', color: DIM,
    letterSpacing: 1.8, marginBottom: 6, marginTop: 14,
    paddingBottom: 4, paddingHorizontal: 36,
    borderBottomWidth: 0.5, borderBottomColor: DIMMER, borderBottomStyle: 'solid',
  },

  // ── SCORE TABLE ──────────────────────────────────────────────────────────
  tableWrap: { paddingHorizontal: 36, marginTop: 8 },
  table: {
    borderWidth: 1, borderColor: DIMMER, borderStyle: 'solid',
  },
  tableHeaderRow: {
    flexDirection: 'row', backgroundColor: BG3,
    borderBottomWidth: 1, borderBottomColor: HOT, borderBottomStyle: 'solid',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5, borderBottomColor: DIMMER, borderBottomStyle: 'solid',
  },
  tableRowAlt: {
    flexDirection: 'row', backgroundColor: BG2,
    borderBottomWidth: 0.5, borderBottomColor: DIMMER, borderBottomStyle: 'solid',
  },
  tableRowLast: { flexDirection: 'row', backgroundColor: BG2 },
  cField:  { width: '38%', padding: '5px 8px' },
  cScore:  { width: '14%', padding: '5px 8px', textAlign: 'right' },
  cMax:    { width: '12%', padding: '5px 8px', textAlign: 'right' },
  cMode:   { width: '14%', padding: '5px 8px' },
  cBar:    { flex: 1, padding: '5px 8px', justifyContent: 'center' },
  cellTxt: { fontSize: 8.5, color: OFF_W },
  cellHdr: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: DIM, letterSpacing: 0.5 },
  cellBold:{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: NEON },
  barTrack:{ height: 3, backgroundColor: DIMMER },
  barFill: { height: 3, backgroundColor: CYAN },

  // Total score banner
  totalBanner: {
    marginHorizontal: 36, marginTop: 12,
    backgroundColor: BG3,
    borderWidth: 1.5, borderColor: NEON, borderStyle: 'solid',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  totalLabel: {
    fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 2.5, color: NEON,
  },
  totalScore: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: NEON },

  // ── TEXT BLOCKS ──────────────────────────────────────────────────────────
  textBlockWrap: { paddingHorizontal: 36, marginTop: 6 },
  verbatimBlock: {
    fontFamily: 'Courier', fontSize: 7.5, lineHeight: 1.7, color: '#888',
    backgroundColor: BG3, padding: 8,
    borderLeftWidth: 2, borderLeftColor: CYAN, borderLeftStyle: 'solid',
  },
  remarksBlock: {
    fontFamily: 'Helvetica', fontSize: 8.5, lineHeight: 1.6, color: OFF_W,
    backgroundColor: BG3, padding: 8,
    borderLeftWidth: 2, borderLeftColor: HOT, borderLeftStyle: 'solid',
  },
  editWarning: {
    fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: WARN_R,
    marginHorizontal: 36, marginTop: 8,
    backgroundColor: '#1a0000', padding: 6,
    borderWidth: 1, borderColor: WARN_R, borderStyle: 'solid',
  },

  // ── FOOTER ───────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: BG3,
    borderTopWidth: 1.5, borderTopColor: DIMMER, borderTopStyle: 'solid',
    paddingHorizontal: 36, paddingVertical: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  sigBlock: { flex: 1 },
  sigLabel: { fontSize: 6, color: DIM, marginBottom: 4, letterSpacing: 1.2, fontFamily: 'Helvetica-Bold' },
  sigRow:   { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
  sigItem:  { flexDirection: 'column', gap: 1, minWidth: 70 },
  sigName:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: OFF_W },
  sigRole:  { fontSize: 6, color: DIM },
  footerRight: { textAlign: 'right' },
  footerBrand: { fontSize: 6.5, color: DIM, textAlign: 'right' },
  footerAccent: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: NEON, textAlign: 'right', letterSpacing: 1 },
});

// ── Per-delegate document ──────────────────────────────────────────────────

export function PerDelegateSheetDocument({ sheets }: { sheets: DelegateSheetData[] }) {
  return (
    <Document title="Markzo — Per-Delegate Sheets">
      {sheets.map((d, pi) => (
        <Page key={pi} size="A4" style={s.page}>

          {/* ── Mega header band ── */}
          <View style={s.headerBand}>
            <Text style={s.headerWordmark}>MARKZO</Text>
            <View style={s.headerCenterBlock}>
              <Text style={s.headerConference}>{d.conference_name}</Text>
              <Text style={s.headerCommittee}>{d.committee_name}</Text>
            </View>
            <View style={s.headerRight}>
              <Text style={s.headerDate}>
                {new Date(d.computed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
              <Text style={s.headerDocType}>DELEGATE MARKSHEET</Text>
            </View>
          </View>

          {/* Sub-header pink bar */}
          <View style={s.subHeaderBand}>
            <Text style={s.subHeaderText}>OFFICIAL SCORING DOCUMENT</Text>
            <View style={s.subHeaderDot} />
            <Text style={s.subHeaderText}>CONFIDENTIAL</Text>
            <View style={s.subHeaderDot} />
            <Text style={s.subHeaderText}>RANK #{d.rank} OF {d.total_delegates}</Text>
          </View>

          {/* ── Delegate info + score box ── */}
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
                <Text style={s.rankText}>#{d.rank} of {d.total_delegates} delegates</Text>
              </View>
              {d.award_tier && (
                <View style={s.awardBadge}>
                  <Text style={s.awardText}>{d.award_tier.toUpperCase()}</Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Committee stats ── */}
          {d.present_count !== undefined && (
            <View style={s.statsRow}>
              <View style={s.statChip}>
                <Text style={s.statChipLabel}>PRESENT</Text>
                <Text style={s.statChipValue}>{(d.present_count ?? 0) + (d.pav_count ?? 0)}</Text>
              </View>
              <View style={s.statChip}>
                <Text style={s.statChipLabel}>P&amp;V</Text>
                <Text style={s.statChipValue}>{d.pav_count ?? 0}</Text>
              </View>
              <View style={s.statChip}>
                <Text style={s.statChipLabel}>ABSENT</Text>
                <Text style={s.statChipValue}>{d.absent_count ?? 0}</Text>
              </View>
              <View style={{ ...s.statChip, borderColor: NEON, flex: 2 }}>
                <Text style={{ ...s.statChipLabel, color: NEON }}>COMMITTEE RANK</Text>
                <Text style={{ ...s.statChipValue, color: NEON }}>#{d.rank} / {d.total_delegates}</Text>
              </View>
            </View>
          )}

          {/* ── Score breakdown ── */}
          <Text style={s.sectionTitle}>  SCORE BREAKDOWN</Text>
          <View style={s.tableWrap}>
            <View style={s.table}>
              <View style={s.tableHeaderRow}>
                <View style={s.cField}><Text style={s.cellHdr}>FIELD</Text></View>
                <View style={s.cScore}><Text style={s.cellHdr}>SCORE</Text></View>
                <View style={s.cMax}><Text style={s.cellHdr}>MAX</Text></View>
                <View style={s.cMode}><Text style={s.cellHdr}>MODE</Text></View>
                <View style={s.cBar}><Text style={s.cellHdr}>VISUAL</Text></View>
              </View>
              {d.fields.map((f, i) => {
                const pct = f.max_score > 0 ? Math.min(1, f.score / f.max_score) : 0;
                const rowStyle = i === d.fields.length - 1 ? s.tableRowLast : (i % 2 === 0 ? s.tableRow : s.tableRowAlt);
                return (
                  <View key={f.field_id} style={rowStyle}>
                    <View style={s.cField}>
                      <Text style={s.cellTxt}>{f.field_name}{f.weight && f.weight !== 1 ? ` ×${f.weight}` : ''}</Text>
                    </View>
                    <View style={s.cScore}><Text style={s.cellBold}>{f.score.toFixed(1)}</Text></View>
                    <View style={s.cMax}><Text style={{ ...s.cellTxt, color: DIM }}>{f.max_score}</Text></View>
                    <View style={s.cMode}><Text style={{ ...s.cellTxt, color: DIM, fontSize: 7.5 }}>{f.scoring_mode}</Text></View>
                    <View style={s.cBar}>
                      <View style={s.barTrack}>
                        <View style={{ ...s.barFill, width: `${Math.round(pct * 100)}%` }} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Total score banner */}
          <View style={s.totalBanner}>
            <Text style={s.totalLabel}>TOTAL SCORE</Text>
            <Text style={s.totalScore}>{d.total_score.toFixed(1)}</Text>
          </View>

          {/* EB remarks */}
          {d.eb_remarks && (
            <>
              <Text style={s.sectionTitle}>  EB REMARKS</Text>
              <View style={s.textBlockWrap}>
                <Text style={s.remarksBlock}>{d.eb_remarks}</Text>
              </View>
            </>
          )}

          {/* Verbatim */}
          {d.verbatim && (
            <>
              <Text style={s.sectionTitle}>  VERBATIM RECORD</Text>
              <View style={s.textBlockWrap}>
                <Text style={s.verbatimBlock}>{d.verbatim}</Text>
              </View>
            </>
          )}

          {/* Post-lock edit warning */}
          {d.is_edited_after_lock && (
            <Text style={s.editWarning}>
              ! EDITED POST-LOCK — {d.last_edited_at ? new Date(d.last_edited_at).toLocaleString() : ''}
              {d.last_edited_by_name ? ` by ${d.last_edited_by_name}` : ''}
            </Text>
          )}

          {/* Footer */}
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
              <Text style={s.footerAccent}>MARKZO</Text>
              <Text style={s.footerBrand}>markzo.sandnco.lol · Transparent MUN marking</Text>
              <Text style={s.footerBrand}>{new Date(d.computed_at).toLocaleString()}</Text>
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
          <Text style={s.footerAccent}>MARKZO</Text>
          <Text style={s.footerBrand}>markzo.sandnco.lol · Transparent MUN marking</Text>
          <Text style={s.footerBrand}>Computed: {new Date(data.computed_at).toLocaleString()}</Text>
        </View>
      </View>
    );
  }

  function PageHeader({ subtitle, accentColor }: { subtitle: string; accentColor?: string }) {
    const accent = accentColor ?? NEON;
    return (
      <>
        <View style={{ ...s.headerBand, backgroundColor: accent }}>
          <Text style={s.headerWordmark}>MARKZO</Text>
          <View style={s.headerCenterBlock}>
            <Text style={s.headerConference}>{data.conference_name}</Text>
            <Text style={s.headerCommittee}>{data.committee_name}</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerDate}>
              {new Date(data.computed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
            <Text style={s.headerDocType}>{subtitle}</Text>
          </View>
        </View>
        <View style={{ ...s.subHeaderBand, backgroundColor: BG3, borderBottomWidth: 1, borderBottomColor: DIMMER, borderBottomStyle: 'solid' }}>
          <Text style={{ ...s.subHeaderText, color: DIM }}>{subtitle}</Text>
          <View style={{ ...s.subHeaderDot, backgroundColor: DIM }} />
          <Text style={{ ...s.subHeaderText, color: DIM }}>FULL COMMITTEE REPORT</Text>
        </View>
      </>
    );
  }

  const statusLabel = (st: string | null | undefined) => {
    if (st === 'present_and_voting') return 'P&V';
    if (st === 'present') return 'P';
    if (st === 'absent') return 'A';
    return '—';
  };

  return (
    <Document title="Markzo — Full Committee Marksheet">

      {/* ── PAGE 1: Rankings ───────────────────────────────────────────── */}
      <Page size="A4" style={s.page} orientation="landscape">
        <PageHeader subtitle="FULL MARKSHEET" accentColor={NEON} />

        {/* Committee stats */}
        {data.stats && (
          <View style={{ ...s.statsRow, marginTop: 16, marginBottom: 10 }}>
            {[
              { label: 'TOTAL', value: data.stats.total },
              { label: 'PRESENT', value: data.stats.present + data.stats.pav, color: '#00c853' },
              { label: 'P&V', value: data.stats.pav, color: GOLD },
              { label: 'ABSENT', value: data.stats.absent, color: WARN_R },
              { label: 'QUORUM', value: data.stats.quorum, color: CYAN },
            ].map((item) => (
              <View key={item.label} style={{ ...s.statChip, borderColor: item.color ?? DIMMER }}>
                <Text style={{ ...s.statChipLabel, color: item.color ?? DIM }}>{item.label}</Text>
                <Text style={{ ...s.statChipValue, color: item.color ?? OFF_W }}>{item.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Rankings table */}
        <Text style={s.sectionTitle}>  DELEGATE RANKINGS</Text>
        <View style={s.tableWrap}>
          <View style={s.table}>
            <View style={s.tableHeaderRow}>
              <View style={{ width: '4%', padding: '3px 5px' }}><Text style={s.cellHdr}>#</Text></View>
              <View style={{ width: '20%', padding: '3px 5px' }}><Text style={s.cellHdr}>DELEGATE</Text></View>
              {fields.map((f) => (
                <View key={f.id} style={{ flex: 1, padding: '3px 5px' }}>
                  <Text style={{ ...s.cellHdr, fontSize: 6 }}>{f.field_name}</Text>
                </View>
              ))}
              <View style={{ width: '9%', padding: '3px 5px' }}><Text style={{ ...s.cellHdr, color: NEON }}>TOTAL</Text></View>
              <View style={{ width: '14%', padding: '3px 5px' }}><Text style={s.cellHdr}>AWARD</Text></View>
            </View>
            {data.rankings.map((r, i) => {
              const rowStyle = i === data.rankings.length - 1 ? s.tableRowLast : (i % 2 === 0 ? s.tableRow : s.tableRowAlt);
              const isTop3 = r.rank <= 3;
              return (
                <View key={r.rank} style={{ ...rowStyle, ...(isTop3 ? { borderLeftWidth: 2, borderLeftColor: GOLD, borderLeftStyle: 'solid' } : {}) }}>
                  <View style={{ width: '4%', padding: '3px 5px' }}>
                    <Text style={{ ...s.cellTxt, color: isTop3 ? GOLD : DIM, fontFamily: isTop3 ? 'Helvetica-Bold' : 'Helvetica' }}>{r.rank}</Text>
                  </View>
                  <View style={{ width: '20%', padding: '3px 5px' }}>
                    <Text style={{ fontSize: 8, color: OFF_W }}>{r.name}</Text>
                    {r.country && <Text style={{ fontSize: 6, color: DIM }}>{r.country}</Text>}
                  </View>
                  {fields.map((f) => {
                    const bd = r.breakdown.find((b) => b.field_name === f.field_name);
                    return (
                      <View key={f.id} style={{ flex: 1, padding: '3px 5px' }}>
                        <Text style={s.cellTxt}>{bd ? bd.score.toFixed(1) : '—'}</Text>
                      </View>
                    );
                  })}
                  <View style={{ width: '9%', padding: '3px 5px' }}>
                    <Text style={{ ...s.cellBold, fontSize: 9 }}>{r.total_score.toFixed(1)}</Text>
                  </View>
                  <View style={{ width: '14%', padding: '3px 5px' }}>
                    <Text style={{ fontSize: 7, color: r.award_tier ? GOLD : DIM }}>{r.award_tier ?? ''}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Award assignments */}
        {data.award_assignments.length > 0 && (
          <>
            <Text style={{ ...s.sectionTitle, backgroundColor: GOLD, color: BG }}>  AWARD ASSIGNMENTS</Text>
            <View style={{ paddingHorizontal: 36, marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {data.award_assignments.map((a) => (
                <View key={a.award_tier} style={{ borderWidth: 1, borderColor: GOLD, borderStyle: 'solid', padding: 8, backgroundColor: '#1a1200' }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: GOLD, letterSpacing: 1.5, marginBottom: 3 }}>{a.award_tier}</Text>
                  <Text style={{ fontSize: 8, color: OFF_W }}>{a.delegates.join(', ')}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Audit trail */}
        {auditLog.length > 0 && (
          <>
            <Text style={{ ...s.sectionTitle, backgroundColor: WARN_R }}>  AUDIT TRAIL — POST-LOCK EDITS</Text>
            <View style={s.tableWrap}>
              <View style={s.table}>
                <View style={s.tableHeaderRow}>
                  <View style={{ width: '22%', padding: '3px 5px' }}><Text style={s.cellHdr}>TIMESTAMP</Text></View>
                  <View style={{ width: '22%', padding: '3px 5px' }}><Text style={s.cellHdr}>EDITOR</Text></View>
                  <View style={{ width: '12%', padding: '3px 5px' }}><Text style={s.cellHdr}>OLD</Text></View>
                  <View style={{ width: '12%', padding: '3px 5px' }}><Text style={s.cellHdr}>NEW</Text></View>
                  <View style={{ flex: 1, padding: '3px 5px' }}><Text style={s.cellHdr}>NOTE</Text></View>
                </View>
                {auditLog.map((e, i) => (
                  <View key={e.id} style={i === auditLog.length - 1 ? s.tableRowLast : s.tableRow}>
                    <View style={{ width: '22%', padding: '3px 5px' }}><Text style={s.cellTxt}>{new Date(e.edited_at).toLocaleString()}</Text></View>
                    <View style={{ width: '22%', padding: '3px 5px' }}><Text style={s.cellTxt}>{e.edited_by_guest_name ?? 'Auth User'}</Text></View>
                    <View style={{ width: '12%', padding: '3px 5px' }}><Text style={{ ...s.cellTxt, color: '#ff8888' }}>{e.old_score}</Text></View>
                    <View style={{ width: '12%', padding: '3px 5px' }}><Text style={{ ...s.cellTxt, color: NEON }}>{e.new_score}</Text></View>
                    <View style={{ flex: 1, padding: '3px 5px' }}><Text style={s.cellTxt}>{e.note ?? ''}</Text></View>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        <PageFooter />
      </Page>

      {/* ── PAGE 2: Roll Call ──────────────────────────────────────────── */}
      {rollCall && (
        <Page size="A4" style={s.page}>
          <PageHeader subtitle="ROLL CALL" accentColor={CYAN} />

          {/* Stats */}
          <View style={{ ...s.statsRow, marginTop: 16, marginBottom: 14 }}>
            {[
              { label: 'TOTAL DELEGATES', value: rollCall.total, color: OFF_W },
              { label: 'PRESENT (P)', value: rollCall.present, color: '#00c853' },
              { label: 'PRESENT & VOTING', value: rollCall.pav, color: GOLD },
              { label: 'ABSENT', value: rollCall.absent, color: WARN_R },
              { label: 'QUORUM NEEDED', value: rollCall.quorum, color: CYAN },
            ].map((item) => (
              <View key={item.label} style={{ ...s.statChip, borderColor: item.color }}>
                <Text style={{ ...s.statChipLabel, color: item.color }}>{item.label}</Text>
                <Text style={{ ...s.statChipValue, color: item.color }}>{item.value}</Text>
              </View>
            ))}
          </View>

          {/* Voting thresholds */}
          <Text style={{ ...s.sectionTitle, backgroundColor: HOT }}>  VOTING THRESHOLDS</Text>
          <View style={{ ...s.statsRow, marginTop: 10, marginBottom: 14 }}>
            {[
              { label: 'SIMPLE MAJORITY (>50% P&V)', value: rollCall.simple_majority, color: '#00c853' },
              { label: 'SPECIAL MAJORITY (2/3 P&V)', value: rollCall.special_majority, color: GOLD },
              { label: 'TOTAL VOTING (P&V)', value: rollCall.pav, color: CYAN },
            ].map((item) => (
              <View key={item.label} style={{ ...s.statChip, flex: 1, borderColor: item.color, paddingVertical: 12 }}>
                <Text style={{ ...s.statChipLabel, color: item.color }}>{item.label}</Text>
                <Text style={{ ...s.statChipValue, fontSize: 22, color: item.color }}>{item.value}</Text>
              </View>
            ))}
          </View>

          {/* Attendance list */}
          <Text style={{ ...s.sectionTitle, backgroundColor: NEON }}>  ATTENDANCE LIST</Text>
          <View style={s.tableWrap}>
            <View style={s.table}>
              <View style={s.tableHeaderRow}>
                <View style={{ width: '5%', padding: '3px 6px' }}><Text style={s.cellHdr}>#</Text></View>
                <View style={{ flex: 1, padding: '3px 6px' }}><Text style={s.cellHdr}>DELEGATE</Text></View>
                <View style={{ width: '22%', padding: '3px 6px' }}><Text style={s.cellHdr}>COUNTRY</Text></View>
                <View style={{ width: '18%', padding: '3px 6px' }}><Text style={s.cellHdr}>STATUS</Text></View>
              </View>
              {rollCall.delegates.map((d, i) => {
                const rowStyle = i === rollCall.delegates.length - 1 ? s.tableRowLast : (i % 2 === 0 ? s.tableRow : s.tableRowAlt);
                const statusColor = d.status === 'present_and_voting' ? GOLD
                  : d.status === 'present' ? '#00c853'
                  : d.status === 'absent' ? WARN_R
                  : DIM;
                return (
                  <View key={i} style={rowStyle}>
                    <View style={{ width: '5%', padding: '3px 6px' }}><Text style={{ ...s.cellTxt, color: DIM }}>{i + 1}</Text></View>
                    <View style={{ flex: 1, padding: '3px 6px' }}><Text style={s.cellTxt}>{d.name}</Text></View>
                    <View style={{ width: '22%', padding: '3px 6px' }}><Text style={{ fontSize: 7.5, color: DIM }}>{d.country ?? ''}</Text></View>
                    <View style={{ width: '18%', padding: '3px 6px' }}>
                      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: statusColor, letterSpacing: 0.5 }}>
                        {statusLabel(d.status)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <PageFooter />
        </Page>
      )}

      {/* ── PAGE 3: Recognitions ───────────────────────────────────────── */}
      {recTypes.length > 0 && (
        <Page size="A4" style={s.page} orientation={recTypes.length > 4 ? 'landscape' : 'portrait'}>
          <PageHeader subtitle="RECOGNITIONS" accentColor={HOT} />

          {/* Committee totals by type */}
          <View style={{ ...s.statsRow, marginTop: 16, marginBottom: 14, flexWrap: 'wrap' }}>
            {recTypes.map((t, idx) => {
              const total = recTable.reduce((acc, r) => acc + (r.counts.find((c) => c.type_id === t.id)?.count ?? 0), 0);
              const colors = [NEON, CYAN, HOT, GOLD, '#aa88ff', '#ff8844'];
              const col = colors[idx % colors.length];
              return (
                <View key={t.id} style={{ ...s.statChip, borderColor: col, minWidth: 70 }}>
                  <Text style={{ ...s.statChipLabel, color: col }}>{t.name.toUpperCase()}</Text>
                  <Text style={{ ...s.statChipValue, color: col, fontSize: 20 }}>{total}</Text>
                </View>
              );
            })}
            <View style={{ ...s.statChip, borderColor: OFF_W, flex: 1, minWidth: 80 }}>
              <Text style={{ ...s.statChipLabel, color: OFF_W }}>GRAND TOTAL</Text>
              <Text style={{ ...s.statChipValue, color: OFF_W, fontSize: 20 }}>{recTable.reduce((acc, r) => acc + r.total, 0)}</Text>
            </View>
          </View>

          <Text style={{ ...s.sectionTitle, backgroundColor: HOT }}>  RECOGNITION BREAKDOWN — PER DELEGATE</Text>
          <View style={s.tableWrap}>
            <View style={s.table}>
              <View style={s.tableHeaderRow}>
                <View style={{ width: '28%', padding: '3px 6px' }}><Text style={s.cellHdr}>DELEGATE</Text></View>
                {recTypes.map((t) => (
                  <View key={t.id} style={{ flex: 1, padding: '3px 6px' }}>
                    <Text style={{ ...s.cellHdr, fontSize: 6.5 }}>{t.name.toUpperCase()}</Text>
                  </View>
                ))}
                <View style={{ width: '10%', padding: '3px 6px' }}>
                  <Text style={{ ...s.cellHdr, color: NEON }}>TOTAL</Text>
                </View>
              </View>
              {recTable.map((r, i) => {
                const rowStyle = i === recTable.length - 1 ? s.tableRowLast : (i % 2 === 0 ? s.tableRow : s.tableRowAlt);
                return (
                  <View key={r.delegate_id} style={rowStyle}>
                    <View style={{ width: '28%', padding: '3px 6px' }}>
                      <Text style={{ fontSize: 8.5, color: OFF_W }}>{r.name}</Text>
                      {r.country && <Text style={{ fontSize: 6, color: DIM }}>{r.country}</Text>}
                    </View>
                    {recTypes.map((t) => {
                      const c = r.counts.find((x) => x.type_id === t.id);
                      return (
                        <View key={t.id} style={{ flex: 1, padding: '3px 6px' }}>
                          <Text style={{
                            fontSize: 9,
                            fontFamily: c && c.count > 0 ? 'Helvetica-Bold' : 'Helvetica',
                            color: c && c.count > 0 ? CYAN : DIM,
                          }}>
                            {c?.count ?? 0}
                          </Text>
                        </View>
                      );
                    })}
                    <View style={{ width: '10%', padding: '3px 6px' }}>
                      <Text style={{ ...s.cellBold, color: r.total > 0 ? NEON : DIM }}>{r.total}</Text>
                    </View>
                  </View>
                );
              })}
              {/* Committee totals row */}
              <View style={{ flexDirection: 'row', backgroundColor: '#111', borderTopWidth: 1.5, borderTopColor: HOT, borderTopStyle: 'solid' }}>
                <View style={{ width: '28%', padding: '4px 6px' }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: HOT, letterSpacing: 1 }}>COMMITTEE TOTAL</Text>
                </View>
                {recTypes.map((t) => {
                  const total = recTable.reduce((acc, r) => acc + (r.counts.find((c) => c.type_id === t.id)?.count ?? 0), 0);
                  return (
                    <View key={t.id} style={{ flex: 1, padding: '4px 6px' }}>
                      <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: CYAN }}>{total}</Text>
                    </View>
                  );
                })}
                <View style={{ width: '10%', padding: '4px 6px' }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: NEON }}>
                    {recTable.reduce((acc, r) => acc + r.total, 0)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <PageFooter />
        </Page>
      )}

      {/* ── PAGE 4: Verbatim ───────────────────────────────────────────── */}
      {verbatimList.length > 0 && (
        <Page size="A4" style={s.page}>
          <PageHeader subtitle="VERBATIM RECORD" accentColor={CYAN} />

          <Text style={{ ...s.sectionTitle, backgroundColor: CYAN, marginTop: 16 }}>  DELEGATE SPEECHES &amp; REMARKS</Text>

          <View style={{ paddingHorizontal: 36, marginTop: 10 }}>
            {verbatimList.map((v, i) => (
              <View key={i} style={{
                marginBottom: 14, paddingBottom: 12,
                borderBottomWidth: i === verbatimList.length - 1 ? 0 : 0.5,
                borderBottomColor: DIMMER, borderBottomStyle: 'solid',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 6, gap: 8 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: OFF_W }}>{v.name}</Text>
                  {v.country && <Text style={{ fontSize: 8, color: DIM }}>{v.country}</Text>}
                </View>

                {v.verbatim && (
                  <>
                    <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: CYAN, letterSpacing: 1.5, marginBottom: 3 }}>VERBATIM</Text>
                    <Text style={s.verbatimBlock}>{v.verbatim}</Text>
                  </>
                )}

                {v.eb_remarks && (
                  <>
                    <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: HOT, letterSpacing: 1.5, marginTop: 6, marginBottom: 3 }}>EB REMARKS</Text>
                    <Text style={s.remarksBlock}>{v.eb_remarks}</Text>
                  </>
                )}
              </View>
            ))}
          </View>

          <PageFooter />
        </Page>
      )}

    </Document>
  );
}
