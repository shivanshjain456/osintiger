// Lightweight investigation metadata — for list views that don't need full report/source data.
// Avoids fetching + parsing the large reportJson and sourceResults columns.
export interface InvestigationSummary {
  id: string;
  target: string;
  input_type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  confidence: number | null;
  key_findings_count: number;
  sources_count: number;
  needs_review: boolean;
  starred: boolean;
  tags: string[];
  notes: string;
  bookmarked_findings: number[];
  finding_annotations: Record<number, string>;
}
