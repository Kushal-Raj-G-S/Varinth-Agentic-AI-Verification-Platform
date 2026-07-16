import Link from 'next/link'
import GlobalScoreRing from './GlobalScoreRing'

interface AuditSummary {
  audit_run_id: string
  status: string
  global_score: number | null
  claim_count: number
  started_at: string
  completed_at: string | null
  duration_ms: number | null
}

export default function AuditRunCard({ run }: { run: AuditSummary }) {
  const formattedDate = new Date(run.started_at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Link href={`/audits/${run.audit_run_id}`} className="run-card">
      <div style={{ flex: 1 }}>
        <h4 className="font-display" style={{ marginBottom: 'var(--space-1)', color: 'var(--text-primary)' }}>
          Audit Run
        </h4>
        <div className="flex gap-4 text-muted mono" style={{ fontSize: '0.75rem' }}>
          <span>{formattedDate}</span>
          <span>•</span>
          <span>{run.claim_count} claims</span>
          {run.duration_ms && (
            <>
              <span>•</span>
              <span>{run.duration_ms}ms</span>
            </>
          )}
        </div>
        <div style={{ marginTop: 'var(--space-2)' }}>
          <span className={`badge ${run.status === 'completed' ? 'badge-supported' : run.status === 'failed' ? 'badge-contradicted' : 'badge-unverified'}`}>
            {run.status}
          </span>
        </div>
      </div>
      <div>
        <GlobalScoreRing score={run.global_score} size={64} />
      </div>
    </Link>
  )
}
