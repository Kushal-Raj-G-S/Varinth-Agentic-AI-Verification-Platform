'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────
// INTERACTIVE GLOW CARD
// ─────────────────────────────────────────────────────────────
function HoverGlowCard({ children, style = {}, accent = '#ff6b45', ...props }: any) {
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const boundsRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (boundsRef.current) {
      const bounds = boundsRef.current.getBoundingClientRect()
      setCoords({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top
      })
    }
  }

  return (
    <div
      ref={boundsRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...style,
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}
      {...props}
    >
      {isHovered && (
        <div style={{
          position: 'absolute',
          left: coords.x - 200,
          top: coords.y - 200,
          width: 400,
          height: 400,
          background: `radial-gradient(circle, ${accent}15 0%, transparent 65%)`,
          pointerEvents: 'none',
          zIndex: 1,
        }} />
      )}
      <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%' }}>
        {children}
      </div>
    </div>
  )
}

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
  const color = pct >= 80 ? 'var(--teal)' : pct >= 50 ? 'var(--amber)' : 'var(--crimson)'
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(255,255,255,0.02) 0deg)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: pct > 0 ? `0 0 16px ${color}1c` : 'none',
      flexShrink: 0,
      position: 'relative',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: '#0d0510',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.7rem', fontWeight: 700, color, fontFamily: 'var(--font-mono)',
      }}>
        {score === null ? '–' : `${pct}`}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; text: string; bg: string; border: string }> = {
    completed: { label: 'Done', text: '#00dcb8', bg: 'rgba(0, 220, 184, 0.07)', border: 'rgba(0, 220, 184, 0.2)' },
    failed: { label: 'Failed', text: '#ff3f5e', bg: 'rgba(255, 63, 94, 0.07)', border: 'rgba(255, 63, 94, 0.2)' },
    partial: { label: 'Partial', text: '#ffa833', bg: 'rgba(255, 168, 51, 0.07)', border: 'rgba(255, 168, 51, 0.2)' },
    running: { label: 'Running', text: '#b57bff', bg: 'rgba(181, 123, 255, 0.07)', border: 'rgba(181, 123, 255, 0.2)' },
  }
  const s = map[status] || { label: status, text: '#c8a896', bg: 'rgba(200, 168, 150, 0.07)', border: 'rgba(200, 168, 150, 0.2)' }
  return (
    <span style={{
      fontSize: '0.62rem',
      fontFamily: 'var(--font-mono)',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      padding: '2px 8px',
      borderRadius: 4,
      color: s.text,
      background: s.bg,
      border: `1px solid ${s.border}`
    }}>
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
    <div style={{ background: '#0d0510', color: '#f9f5ff', minHeight: '100vh', fontFamily: 'Inter, sans-serif', position: 'relative', overflowX: 'hidden' }}>
      
      {/* Background radial atmosphere */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 1400, height: 800, background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(157,107,255,0.06) 0%, transparent 80%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'radial-gradient(rgba(157,107,255,0.035) 1px, transparent 1px)',
        backgroundSize: '24px 24px'
      }} />

      <Navbar email={email} />
      
      <main style={{ padding: '60px 52px 100px', maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        
        {/* Header Title with live metrics */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid rgba(255,100,60,0.08)', paddingBottom: 28, marginBottom: 48 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', color: 'var(--text-1)', letterSpacing: '-0.03em', margin: 0 }}>
              Swarm Audit Console
            </h1>
            <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.4)', marginTop: 8, maxWidth: 580, lineHeight: 1.5 }}>
              Enter your AI-generated text or code block. Varinth's agents (Critic, Verifier, Judge) will cross-reference claims against your active repository index.
            </p>
          </div>

          {/* Mini monitors strip */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', background: 'rgba(19,12,28,0.25)', border: '1px solid rgba(157,130,255,0.08)', padding: '10px 18px', borderRadius: 8 }}>
            {[
              { name: 'Critic', color: '#22d3ee' },
              { name: 'Verifier', color: '#8b5cf6' },
              { name: 'Judge', color: '#10b981' }
            ].map(a => (
              <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ position: 'relative', width: 6, height: 6, display: 'inline-block' }}>
                  <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: a.color, animation: 'glowPulse 2s infinite' }} />
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)' }}>{a.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 60, alignItems: 'start' }}>

          {/* ── Left: Audit Query Form ── */}
          <HoverGlowCard
            accent="var(--coral)"
            style={{
              background: 'rgba(19, 12, 28, 0.3)',
              border: '1px solid rgba(157,130,255,0.08)',
              borderRadius: 14,
              padding: '36px'
            }}
          >
            <form onSubmit={handleAudit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {error && <div style={{ fontSize: '0.8rem', color: 'var(--crimson)', background: 'var(--crimson-dim)', border: '1px solid var(--crimson-border)', padding: '10px 14px', borderRadius: 6 }}>{error}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Codebase Source</label>
                  <select
                    value={selectedCtx}
                    onChange={e => { setSelectedCtx(e.target.value); setSelectedScope('') }}
                    required
                    style={{
                      background: '#040409',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 6,
                      padding: '10px 12px',
                      fontSize: '0.8rem',
                      color: '#fff',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="">Select source...</option>
                    {contexts.map(c => <option key={c.source_context_id} value={c.source_context_id}>{c.name}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Scope (optional)</label>
                  <select
                    value={selectedScope}
                    onChange={e => setSelectedScope(e.target.value)}
                    disabled={!selectedCtx}
                    style={{
                      background: '#040409',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 6,
                      padding: '10px 12px',
                      fontSize: '0.8rem',
                      color: '#fff',
                      cursor: selectedCtx ? 'pointer' : 'not-allowed',
                      opacity: selectedCtx ? 1 : 0.5,
                      outline: 'none'
                    }}
                  >
                    <option value="">Full codebase</option>
                    {scopes.map(s => <option key={s.source_scope_id} value={s.source_scope_id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Question asked to the AI</label>
                <input
                  placeholder="e.g. How does token expiration work?"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  required
                  style={{
                    background: '#040409',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6,
                    padding: '12px 14px',
                    fontSize: '0.82rem',
                    color: '#fff',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>AI-generated answer to verify (optional)</label>
                <textarea
                  placeholder="Paste the AI response here — or leave blank to run Question-Only Mode (which automatically generates a grounded draft answer from your codebase first)..."
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  style={{
                    background: '#040409',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6,
                    padding: '12px 14px',
                    fontSize: '0.82rem',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                    minHeight: 180,
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    lineHeight: 1.5
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <span>Max claims to extract</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--coral)' }}>{maxClaims}</span>
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
                style={{
                  background: 'linear-gradient(135deg, #ff6b45 0%, #ff8c6d 100%)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  padding: '14px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: submitting ? 'default' : 'pointer',
                  boxShadow: '0 0 24px rgba(255,107,69,0.22)',
                  transition: 'opacity 0.2s'
                }}
              >
                {submitting ? 'Running Swarms...' : 'Run Verification Audit →'}
              </button>
            </form>
          </HoverGlowCard>

          {/* ── Right: History / Audits List ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 400, letterSpacing: '-0.03em' }}>
                Recent Audits
              </h2>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-3)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 4 }}>
                {audits.length} runs
              </span>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[80, 80, 80].map((h, i) => (
                  <div key={i} style={{ height: h, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }} />
                ))}
              </div>
            ) : audits.length === 0 ? (
              <div style={{
                border: '1px solid rgba(157,130,255,0.08)',
                borderRadius: 14,
                background: 'rgba(19, 12, 28, 0.2)',
                padding: '48px 24px',
                textAlign: 'center',
                minHeight: 280,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{ fontSize: '2.5rem', color: 'rgba(255,107,69,0.2)', marginBottom: 14 }}>◎</div>
                <p style={{ color: 'var(--text-1)', fontSize: '0.9rem', fontWeight: 600, margin: '0 0 6px' }}>No audits run yet</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', maxWidth: 220, margin: '0 auto', lineHeight: 1.4 }}>
                  Paste an answer on the left to trigger the verification swarm.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {audits.map(run => (
                  <Link key={run.audit_run_id} href={`/audits/${run.audit_run_id}`} style={{ textDecoration: 'none' }}>
                    <HoverGlowCard
                      accent="var(--teal)"
                      style={{
                        background: 'rgba(19, 12, 28, 0.3)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        padding: '16px 20px',
                        borderRadius: 10
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
                        <ScoreDot score={run.global_score} />
                        <div style={{ flex: 1, minWidth: 0, paddingLeft: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <StatusBadge status={run.status} />
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-3)' }}>
                              {run.claim_count} claims
                              {run.duration_ms && ` · ${(run.duration_ms / 1000).toFixed(1)}s`}
                            </span>
                          </div>
                          <p style={{
                            fontSize: '0.72rem', color: 'var(--text-4)',
                            fontFamily: 'var(--font-mono)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            margin: 0,
                          }}>
                            {run.audit_run_id}
                          </p>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,107,69,0.4)" strokeWidth="2.5" style={{ transition: 'transform 0.2s', flexShrink: 0 }}>
                          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </HoverGlowCard>
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}
