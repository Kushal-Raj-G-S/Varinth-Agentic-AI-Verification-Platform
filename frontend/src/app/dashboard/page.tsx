'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'

interface SourceContext {
  source_context_id: string
  name: string
  slug: string
  root_path: string
}

interface SourceScope {
  source_scope_id: string
  source_context_id: string
  name: string
  slug: string
}

interface AuditSummary {
  audit_run_id: string
  status: string
  global_score: number | null
  claim_count: number
  started_at: string
  completed_at: string | null
  duration_ms: number | null
}

function ScoreDot({ score }: { score: number | null }) {
  const pct = score === null ? 0 : Math.round(score * 100)
  // Chromatic dark status colors: teal (good), amber (medium), crimson (poor)
  const color = pct >= 80 ? 'var(--teal)' : pct >= 50 ? 'var(--amber)' : 'var(--crimson)'
  return (
    <div style={{
      width: 44, height: 44, borderRadius: '50%',
      background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(255,255,255,0.02) 0deg)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: pct > 0 ? `0 0 16px ${color}1c` : 'none',
      flexShrink: 0,
      position: 'relative',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: '#130c1c',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.74rem', fontWeight: 700, color, fontFamily: 'var(--font-mono)',
      }}>
        {score === null ? '–' : `${pct}`}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; class: string }> = {
    completed: { label: 'Done', class: 'badge-supported' },
    failed: { label: 'Failed', class: 'badge-contradicted' },
    partial: { label: 'Partial', class: 'badge-high' },
    running: { label: 'Running', class: 'badge-medium' },
  }
  const s = map[status] || { label: status, class: 'badge-low' }
  return (
    <span className={`badge ${s.class}`} style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
      {s.label}
    </span>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [contexts, setContexts] = useState<SourceContext[]>([])
  const [scopes, setScopes] = useState<SourceScope[]>([])
  const [audits, setAudits] = useState<AuditSummary[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedCtx, setSelectedCtx] = useState('')
  const [selectedScope, setSelectedScope] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [maxClaims, setMaxClaims] = useState(15)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setEmail(user.email || '')

    const { data: ctxData } = await supabase
      .from('source_contexts').select('*').eq('user_id', user.id).eq('is_active', true)
    if (ctxData) setContexts(ctxData)

    const { data: runData } = await supabase
      .from('audit_runs').select('*').eq('user_id', user.id).order('started_at', { ascending: false }).limit(20)

    if (runData) {
      const hydrated: AuditSummary[] = []
      for (const run of runData) {
        const { count } = await supabase
          .from('claims').select('claim_id', { count: 'exact', head: true }).eq('audit_run_id', run.audit_run_id)
        hydrated.push({
          audit_run_id: run.audit_run_id,
          status: run.status,
          global_score: run.global_score === null ? null : parseFloat(run.global_score),
          claim_count: count || 0,
          started_at: run.started_at,
          completed_at: run.completed_at,
          duration_ms: run.duration_ms,
        })
      }
      setAudits(hydrated)
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    if (!selectedCtx) { setScopes([]); return }
    supabase.from('source_scopes').select('*').eq('source_context_id', selectedCtx).eq('is_active', true)
      .then(({ data }) => { if (data) setScopes(data) })
  }, [selectedCtx])

  const handleAudit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token
    if (!token) { setError('Session expired. Please sign in again.'); setSubmitting(false); return }

    const ctxObj = contexts.find(c => c.source_context_id === selectedCtx)
    const scopeObj = scopes.find(s => s.source_scope_id === selectedScope)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/audits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          question, answer,
          context_slug: ctxObj?.slug || null,
          scope_slug: scopeObj?.slug || null,
          max_claims: maxClaims,
        }),
      })
      if (!response.ok) { const err = await response.json(); throw new Error(err.detail || 'Audit failed.') }
      const run = await response.json()
      router.push(`/audits/${run.audit_run_id}`)
    } catch (err: any) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <>
      <Navbar email={email} />
      <main className="page anim-fade-in" style={{ padding: '40px 0' }}>
        <div className="container">
          
          {/* Header */}
          <div style={{ marginBottom: '40px', borderBottom: '1px solid var(--border-1)', paddingBottom: '24px' }}>
            <h1 className="page-title">
              Audit Engine
            </h1>
            <p className="page-subtitle">
              Verify any AI-generated answer against a connected codebase using a three-agent Critic-Verifier-Judge swarm
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '48px', alignItems: 'start' }}>

            {/* ── Left: Form ── */}
            <div className="card" style={{ background: 'rgba(19, 12, 28, 0.4)', padding: '32px' }}>
              <form onSubmit={handleAudit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {error && <div className="auth-error">{error}</div>}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="input-group">
                    <label className="input-label">Codebase Source</label>
                    <select
                      className="input"
                      value={selectedCtx}
                      onChange={e => { setSelectedCtx(e.target.value); setSelectedScope('') }}
                      required
                      style={{ cursor: 'pointer', background: 'var(--surface-1)' }}
                    >
                      <option value="">Select source...</option>
                      {contexts.map(c => <option key={c.source_context_id} value={c.source_context_id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Scope (optional)</label>
                    <select
                      className="input"
                      value={selectedScope}
                      onChange={e => setSelectedScope(e.target.value)}
                      disabled={!selectedCtx}
                      style={{ cursor: selectedCtx ? 'pointer' : 'not-allowed', background: 'var(--surface-1)' }}
                    >
                      <option value="">Full codebase</option>
                      {scopes.map(s => <option key={s.source_scope_id} value={s.source_scope_id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Question asked to the AI</label>
                  <input
                    className="input"
                    placeholder="e.g. How does authentication work in this project?"
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">AI-generated answer to verify</label>
                  <textarea
                    className="input"
                    placeholder="Paste the AI response here — Varinth will extract claims and verify each one..."
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    required
                    style={{ minHeight: 180 }}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Max claims to extract</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-1)' }}>{maxClaims}</span>
                  </label>
                  <input
                    type="range" min="1" max="30"
                    value={maxClaims}
                    onChange={e => setMaxClaims(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--coral)', cursor: 'pointer' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className={`btn btn-primary w-full ${submitting ? 'btn-loading' : ''}`}
                  style={{ padding: '14px', fontSize: '0.9rem' }}
                >
                  {submitting ? '' : 'Run Verification Audit →'}
                </button>
              </form>
            </div>

            {/* ── Right: History ── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 400, letterSpacing: '-0.03em' }}>
                  Recent Audits
                </h2>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-3)' }}>
                  {audits.length} runs
                </span>
              </div>

              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[80, 80, 80].map((h, i) => (
                    <div key={i} className="skeleton" style={{ height: h, borderRadius: 'var(--r-md)' }} />
                  ))}
                </div>
              ) : audits.length === 0 ? (
                <div className="empty-state" style={{
                  border: '1px solid var(--border-1)',
                  borderRadius: 'var(--r-md)',
                  background: 'rgba(19, 12, 28, 0.2)',
                  minHeight: 280,
                }}>
                  <div className="empty-state-icon" style={{ fontSize: '2.5rem', color: 'rgba(255,107,69,0.2)' }}>◎</div>
                  <p className="empty-state-title" style={{ color: 'var(--text-1)' }}>No audits yet</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', maxWidth: 220, margin: '0 auto' }}>
                    Paste an answer on the left to trigger the verification swarm.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {audits.map(run => (
                    <Link key={run.audit_run_id} href={`/audits/${run.audit_run_id}`} style={{ textDecoration: 'none' }}>
                      <div className="run-card" style={{
                        background: 'rgba(19, 12, 28, 0.4)',
                        border: '1px solid var(--border-1)',
                        padding: '16px 20px',
                      }}>
                        <ScoreDot score={run.global_score} />
                        <div style={{ flex: 1, minWidth: 0, paddingLeft: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <StatusBadge status={run.status} />
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-3)' }}>
                              {run.claim_count} claims
                              {run.duration_ms && ` · ${(run.duration_ms / 1000).toFixed(1)}s`}
                            </span>
                          </div>
                          <p style={{
                            fontSize: '0.74rem', color: 'var(--text-4)',
                            fontFamily: 'var(--font-mono)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            margin: 0,
                          }}>
                            {run.audit_run_id}
                          </p>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,107,69,0.4)" strokeWidth="2" style={{ transition: 'transform 0.2s' }}>
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </>
  )
}
