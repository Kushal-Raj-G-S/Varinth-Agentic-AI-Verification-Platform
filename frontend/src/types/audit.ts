export interface EvidenceItem {
  evidence_id: string;
  claim_id: string;
  filepath: string;
  start_line: number;
  end_line: number;
  snippet_text: string;
  relevance_score: number;
  retrieval_method: string;
  source_commit: string;
  source_branch: string;
  language: string;
  rank: number;
}

export interface Claim {
  claim_id: string;
  audit_run_id: string;
  claim_index: number;
  raw_text: string;
  normalized_query: string;
  status: 'pending' | 'processed' | 'skipped';
  verdict: 'supported' | 'contradicted' | 'unverified';
  confidence: number;
  judge_explanation: string;
  contradiction_reason: string | null;
  created_at: string;
  evidence_items: EvidenceItem[];
  rule_trace?: {
    memory_hit?: boolean;
    memory_similarity?: number;
    critic_feedback?: string;
    suggested_correction?: {
      statement: string;
      file_references: string[];
      confidence: 'strong' | 'tentative';
    } | null;
  } | null;
}

export interface AuditFailure {
  failure_code: string;
  error_message: string;
}

export interface AuditWarning {
  warning_code: string;
  message: string;
}

export interface AuditRun {
  audit_run_id: string;
  user_id: string;
  source_context_id: string;
  question_text: string;
  answer_text: string;
  status:
    | 'created'
    | 'queued'
    | 'cloning'
    | 'extracting_claims'
    | 'retrieving_evidence'
    | 'verifying'
    | 'judging'
    | 'persisting'
    | 'completed'
    | 'partial'
    | 'failed';
  global_score: number | null;
  started_at: string;
  completed_at?: string;
  duration_ms: number | null;
  clone_duration_ms?: number;
  retrieval_duration_ms?: number;
  verification_duration_ms?: number;
  persistence_duration_ms?: number;
  claims: Claim[];
  warnings: AuditWarning[];
  failure?: AuditFailure;
}
