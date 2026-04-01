import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

// Use standard PDF-safe fonts (no custom embedding required)
Font.register({
  family: 'Times-Roman',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/notoserifsc/v22/H4c8BXePl9DZ0Xe7gG9cyOj7mmia.ttf' },
  ],
});

interface SubCriterion {
  name: string;
  max: number;
}

interface SchemaFieldBreakdown {
  field_id: string;
  field_name: string;
  field_type: string;
  max_score: number;
  scoring_mode: string;
  score: number;
  item_count: number;
  sub_criteria?: SubCriterion[];
  sub_scores?: { criterion: string; score: number }[];
}

export interface DelegateSheetData {
  // Committee info
  conference_name: string;
  committee_name: string;
  computed_at: string;
  locked: boolean;
  is_edited_after_lock: boolean;
  last_edited_at?: string;
  last_edited_by_name?: string;

  // Delegate info
  delegate_name: string;
  country?: string | null;
  portfolio?: string | null;
  total_score: number;
  rank: number;
  award_tier?: string | null;

  // Marks breakdown
  fields: SchemaFieldBreakdown[];
  verbatim?: string | null;
  eb_remarks?: string | null;

  // EB members
  eb_members: { role: string; name: string }[];
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
    padding: '40px 50px',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    borderBottomStyle: 'solid',
  },
  headerLeft: {
    fontSize: 9,
    color: '#555',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
  headerCenter: {
    textAlign: 'center',
    flex: 1,
    paddingHorizontal: 16,
  },
  headerConference: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  headerCommittee: {
    fontSize: 9,
    color: '#555',
    textAlign: 'center',
  },
  headerDate: {
    fontSize: 8,
    color: '#888',
    textAlign: 'right',
  },
  rule: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
    borderBottomStyle: 'solid',
    marginVertical: 10,
  },
  delegateBlock: {
    marginBottom: 16,
  },
  delegateName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  delegateSub: {
    fontSize: 9,
    color: '#555',
    marginBottom: 4,
  },
  rankRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 6,
  },
  rankItem: {
    flexDirection: 'column',
    gap: 1,
  },
  rankLabel: {
    fontSize: 7,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rankValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  awardBadge: {
    borderWidth: 0.5,
    borderColor: '#333',
    borderStyle: 'solid',
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  awardText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#333',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
    borderBottomStyle: 'solid',
    paddingBottom: 3,
  },
  table: {
    borderWidth: 0.5,
    borderColor: '#ddd',
    borderStyle: 'solid',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
    borderBottomStyle: 'solid',
  },
  tableRowLast: {
    flexDirection: 'row',
  },
  tableHeader: {
    backgroundColor: '#f8f8f8',
  },
  cellField: { width: '40%', padding: '4px 6px' },
  cellScore: { width: '20%', padding: '4px 6px', textAlign: 'right' },
  cellMax: { width: '20%', padding: '4px 6px', textAlign: 'right' },
  cellMode: { width: '20%', padding: '4px 6px' },
  cellText: { fontSize: 9 },
  cellTextBold: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#333',
    borderTopStyle: 'solid',
  },
  totalLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  totalValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  textBlock: {
    fontFamily: 'Courier',
    fontSize: 8.5,
    lineHeight: 1.5,
    color: '#333',
    marginTop: 4,
  },
  remarksBlock: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    lineHeight: 1.5,
    color: '#333',
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    borderTopWidth: 0.5,
    borderTopColor: '#ccc',
    borderTopStyle: 'solid',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  footerLeft: {
    flex: 1,
  },
  footerSignature: {
    fontSize: 7,
    color: '#666',
    marginBottom: 1,
  },
  footerRight: {
    textAlign: 'right',
    flex: 1,
  },
  footerMarkzo: {
    fontSize: 7,
    color: '#888',
    textAlign: 'right',
  },
  editedWarning: {
    fontSize: 7.5,
    color: '#cc0000',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
});

export function PerDelegateSheetDocument({ sheets }: { sheets: DelegateSheetData[] }) {
  return (
    <Document title="Markzo — Per-Delegate Sheets">
      {sheets.map((data, pageIdx) => (
        <Page key={pageIdx} size="A4" style={s.page}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerLeft}>MARKZO</Text>
            <View style={s.headerCenter}>
              <Text style={s.headerConference}>{data.conference_name}</Text>
              <Text style={s.headerCommittee}>{data.committee_name}</Text>
            </View>
            <Text style={s.headerDate}>
              {new Date(data.computed_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </Text>
          </View>

          {/* Delegate info */}
          <View style={s.delegateBlock}>
            <Text style={s.delegateName}>{data.delegate_name}</Text>
            {(data.country || data.portfolio) && (
              <Text style={s.delegateSub}>
                {[data.country, data.portfolio].filter(Boolean).join(' · ')}
              </Text>
            )}
            <View style={s.rankRow}>
              <View style={s.rankItem}>
                <Text style={s.rankLabel}>Total Score</Text>
                <Text style={s.rankValue}>{data.total_score.toFixed(1)}</Text>
              </View>
              <View style={s.rankItem}>
                <Text style={s.rankLabel}>Rank</Text>
                <Text style={s.rankValue}>#{data.rank}</Text>
              </View>
            </View>
            {data.award_tier && (
              <View style={s.awardBadge}>
                <Text style={s.awardText}>{data.award_tier.toUpperCase()}</Text>
              </View>
            )}
          </View>

          <View style={s.rule} />

          {/* Score breakdown */}
          <Text style={s.sectionTitle}>SCORE BREAKDOWN</Text>
          <View style={s.table}>
            {/* Header row */}
            <View style={[s.tableRow, s.tableHeader]}>
              <View style={s.cellField}><Text style={s.cellTextBold}>Field</Text></View>
              <View style={s.cellScore}><Text style={s.cellTextBold}>Score</Text></View>
              <View style={s.cellMax}><Text style={s.cellTextBold}>Max</Text></View>
              <View style={s.cellMode}><Text style={s.cellTextBold}>Mode</Text></View>
            </View>
            {data.fields.map((field, i) => (
              <View
                key={field.field_id}
                style={i === data.fields.length - 1 ? s.tableRowLast : s.tableRow}
              >
                <View style={s.cellField}><Text style={s.cellText}>{field.field_name}</Text></View>
                <View style={s.cellScore}>
                  <Text style={s.cellTextBold}>{field.score.toFixed(1)}</Text>
                </View>
                <View style={s.cellMax}><Text style={s.cellText}>{field.max_score}</Text></View>
                <View style={s.cellMode}><Text style={s.cellText}>{field.scoring_mode}</Text></View>
              </View>
            ))}
          </View>

          {/* Total */}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>TOTAL SCORE</Text>
            <Text style={s.totalValue}>{data.total_score.toFixed(1)}</Text>
          </View>

          {/* EB Remarks */}
          {data.eb_remarks && (
            <>
              <Text style={s.sectionTitle}>EB REMARKS</Text>
              <Text style={s.remarksBlock}>{data.eb_remarks}</Text>
            </>
          )}

          {/* Verbatim */}
          {data.verbatim && (
            <>
              <Text style={s.sectionTitle}>VERBATIM RECORD</Text>
              <Text style={s.textBlock}>{data.verbatim}</Text>
            </>
          )}

          {/* Footer */}
          <View style={s.footer} fixed>
            <View style={s.footerLeft}>
              <Text style={s.footerSignature}>Digitally signed by:</Text>
              {data.eb_members.map((m, i) => (
                <Text key={i} style={s.footerSignature}>{m.role}: {m.name}</Text>
              ))}
              {data.is_edited_after_lock && (
                <Text style={s.editedWarning}>
                  EDITED POST-LOCK — last edit: {data.last_edited_at
                    ? new Date(data.last_edited_at).toLocaleString()
                    : 'unknown'} by {data.last_edited_by_name ?? 'unknown'}
                </Text>
              )}
            </View>
            <View style={s.footerRight}>
              <Text style={s.footerMarkzo}>Created using Markzo</Text>
              <Text style={s.footerMarkzo}>markzo.sandnco.lol</Text>
              <Text style={s.footerMarkzo}>Fully transparent marking system</Text>
              <Text style={s.footerMarkzo}>
                Computed: {new Date(data.computed_at).toLocaleString()}
              </Text>
            </View>
          </View>
        </Page>
      ))}
    </Document>
  );
}

export function FullCommitteeMarksheetDocument({
  data,
  auditLog,
}: {
  data: {
    conference_name: string;
    committee_name: string;
    computed_at: string;
    is_edited_after_lock: boolean;
    last_edited_at?: string;
    last_edited_by_name?: string;
    eb_members: { role: string; name: string }[];
    rankings: {
      rank: number;
      name: string;
      country?: string | null;
      total_score: number;
      award_tier?: string | null;
      breakdown: { field_name: string; score: number }[];
    }[];
    schema_fields: { id: string; field_name: string }[];
    award_assignments: { award_tier: string; delegates: string[] }[];
  };
  auditLog: {
    id: string;
    edited_at: string;
    edited_by_guest_name: string | null;
    old_score: number;
    new_score: number;
    note: string | null;
  }[];
}) {
  return (
    <Document title="Markzo — Full Committee Marksheet">
      <Page size="A4" style={{ ...s.page, paddingBottom: 80 }} orientation="landscape">
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerLeft}>MARKZO</Text>
          <View style={s.headerCenter}>
            <Text style={s.headerConference}>{data.conference_name}</Text>
            <Text style={s.headerCommittee}>{data.committee_name} — FULL MARKSHEET</Text>
          </View>
          <Text style={s.headerDate}>
            {new Date(data.computed_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </Text>
        </View>

        {/* Summary table */}
        <Text style={s.sectionTitle}>DELEGATE RANKINGS</Text>
        <View style={s.table}>
          <View style={[s.tableRow, s.tableHeader]}>
            <View style={{ width: '5%', padding: '3px 4px' }}><Text style={s.cellTextBold}>#</Text></View>
            <View style={{ width: '25%', padding: '3px 4px' }}><Text style={s.cellTextBold}>Delegate</Text></View>
            {data.schema_fields.slice(0, 4).map((f) => (
              <View key={f.id} style={{ flex: 1, padding: '3px 4px' }}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold' }}>
                  {f.field_name}
                </Text>
              </View>
            ))}
            <View style={{ width: '12%', padding: '3px 4px' }}><Text style={s.cellTextBold}>Total</Text></View>
            <View style={{ width: '18%', padding: '3px 4px' }}><Text style={s.cellTextBold}>Award</Text></View>
          </View>

          {data.rankings.map((r, i) => (
            <View
              key={r.rank}
              style={i === data.rankings.length - 1 ? s.tableRowLast : s.tableRow}
            >
              <View style={{ width: '5%', padding: '3px 4px' }}>
                <Text style={s.cellText}>{r.rank}</Text>
              </View>
              <View style={{ width: '25%', padding: '3px 4px' }}>
                <Text style={{ fontSize: 8.5 }}>{r.name}</Text>
                {r.country && <Text style={{ fontSize: 7, color: '#888' }}>{r.country}</Text>}
              </View>
              {data.schema_fields.slice(0, 4).map((f) => {
                const bd = r.breakdown.find((b) => b.field_name === f.field_name);
                return (
                  <View key={f.id} style={{ flex: 1, padding: '3px 4px' }}>
                    <Text style={s.cellText}>{bd ? bd.score.toFixed(1) : '—'}</Text>
                  </View>
                );
              })}
              <View style={{ width: '12%', padding: '3px 4px' }}>
                <Text style={s.cellTextBold}>{r.total_score.toFixed(1)}</Text>
              </View>
              <View style={{ width: '18%', padding: '3px 4px' }}>
                <Text style={{ fontSize: 7.5 }}>{r.award_tier ?? ''}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Award assignments */}
        {data.award_assignments.length > 0 && (
          <>
            <Text style={s.sectionTitle}>AWARD ASSIGNMENTS</Text>
            {data.award_assignments.map((a) => (
              <View key={a.award_tier} style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 1 }}>
                  {a.award_tier}
                </Text>
                <Text style={{ fontSize: 8.5, color: '#555' }}>{a.delegates.join(', ')}</Text>
              </View>
            ))}
          </>
        )}

        {/* Audit trail */}
        {auditLog.length > 0 && (
          <>
            <Text style={s.sectionTitle}>AUDIT TRAIL — POST-LOCK EDITS</Text>
            <View style={s.table}>
              <View style={[s.tableRow, s.tableHeader]}>
                <View style={{ width: '25%', padding: '3px 5px' }}><Text style={s.cellTextBold}>When</Text></View>
                <View style={{ width: '25%', padding: '3px 5px' }}><Text style={s.cellTextBold}>By</Text></View>
                <View style={{ width: '15%', padding: '3px 5px' }}><Text style={s.cellTextBold}>Old</Text></View>
                <View style={{ width: '15%', padding: '3px 5px' }}><Text style={s.cellTextBold}>New</Text></View>
                <View style={{ flex: 1, padding: '3px 5px' }}><Text style={s.cellTextBold}>Note</Text></View>
              </View>
              {auditLog.map((entry, i) => (
                <View
                  key={entry.id}
                  style={i === auditLog.length - 1 ? s.tableRowLast : s.tableRow}
                >
                  <View style={{ width: '25%', padding: '3px 5px' }}>
                    <Text style={s.cellText}>
                      {new Date(entry.edited_at).toLocaleString()}
                    </Text>
                  </View>
                  <View style={{ width: '25%', padding: '3px 5px' }}>
                    <Text style={s.cellText}>{entry.edited_by_guest_name ?? 'Auth User'}</Text>
                  </View>
                  <View style={{ width: '15%', padding: '3px 5px' }}>
                    <Text style={s.cellText}>{entry.old_score}</Text>
                  </View>
                  <View style={{ width: '15%', padding: '3px 5px' }}>
                    <Text style={s.cellText}>{entry.new_score}</Text>
                  </View>
                  <View style={{ flex: 1, padding: '3px 5px' }}>
                    <Text style={s.cellText}>{entry.note ?? ''}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <View style={s.footerLeft}>
            <Text style={s.footerSignature}>Digitally signed by:</Text>
            {data.eb_members.map((m, i) => (
              <Text key={i} style={s.footerSignature}>{m.role}: {m.name}</Text>
            ))}
          </View>
          <View style={s.footerRight}>
            <Text style={s.footerMarkzo}>Created using Markzo | markzo.sandnco.lol | Fully transparent marking system</Text>
            <Text style={s.footerMarkzo}>
              Computed: {new Date(data.computed_at).toLocaleString()}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
