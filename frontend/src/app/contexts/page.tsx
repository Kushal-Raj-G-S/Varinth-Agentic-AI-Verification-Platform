'use client'

import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'

interface SourceContext {
  source_context_id: string
  name: string
  slug: string
  root_path: string
  description: string | null
  created_at: string
}

interface SourceScope {
  source_scope_id: string
  source_context_id: string
  name: string
  slug: string
  relative_path: string
  scope_type: string
}

export default function ContextsPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [contexts, setContexts] = useState<SourceContext[]>([])
  const [scopes, setScopes] = useState<Record<string, SourceScope[]>>({})
  const [loading, setLoading] = useState(true)

  // Form states
  const [ctxName, setCtxName] = useState('')
  const [ctxSlug, setCtxSlug] = useState('')
  const [ctxRoot, setCtxRoot] = useState('')
  const [ctxDesc, setCtxDesc] = useState('')
  const [ctxError, setCtxError] = useState<string | null>(null)
  const [ctxSuccess, setCtxSuccess] = useState(false)
  const [creatingCtx, setCreatingCtx] = useState(false)

  const [scopeName, setScopeName] = useState('')
  const [scopeSlug, setScopeSlug] = useState('')
  const [scopeRel, setScopeRel] = useState('')
  const [scopeType, setScopeType] = useState('code')
  const [activeCtxId, setActiveCtxId] = useState<string | null>(null)
  const [scopeError, setScopeError] = useState<string | null>(null)
  const [scopeSuccess, setScopeSuccess] = useState(false)
  const [creatingScope, setCreatingScope] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setEmail(user.email || '')
      
      const { data: ctxData } = await supabase
        .from('source_contexts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (ctxData) {
        setContexts(ctxData)
        
        const newScopes: Record<string, SourceScope[]> = {}
        for (const ctx of ctxData) {
          const { data: scopeData } = await supabase
            .from('source_scopes')
            .select('*')
            .eq('source_context_id', ctx.source_context_id)
            .eq('is_active', true)
          if (scopeData) {
            newScopes[ctx.source_context_id] = scopeData
          }
        }
        setScopes(newScopes)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreateContext = async (e: React.FormEvent) => {
    e.preventDefault()
    setCtxError(null)
    setCtxSuccess(false)
    setCreatingCtx(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Enforce Git Repository URL strictly for Cloud SaaS model
    const isGit = ctxRoot.startsWith('http://') || ctxRoot.startsWith('https://') || ctxRoot.startsWith('git@')
    if (!isGit) {
      setCtxError('Please enter a valid Git Repository URL (starting with http://, https://, or git@)')
      setCreatingCtx(false)
      return
    }

    const { error } = await supabase
      .from('source_contexts')
      .insert({
        user_id: user.id,
        name: ctxName,
        slug: ctxSlug,
        root_path: ctxRoot,
        description: ctxDesc || null,
      })

    if (error) {
      setCtxError(error.message)
      setCreatingCtx(false)
    } else {
      setCtxSuccess(true)
      setCtxName('')
      setCtxSlug('')
      setCtxRoot('')
      setCtxDesc('')
      setCreatingCtx(false)
      fetchData()
    }
  }

  const handleCreateScope = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeCtxId) return
    setScopeError(null)
    setScopeSuccess(false)
    setCreatingScope(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('source_scopes')
      .insert({
        source_context_id: activeCtxId,
        user_id: user.id,
        name: scopeName,
        slug: scopeSlug,
        relative_path: scopeRel,
        scope_type: scopeType,
      })

    if (error) {
      setScopeError(error.message)
      setCreatingScope(false)
    } else {
      setScopeSuccess(true)
      setScopeName('')
      setScopeSlug('')
      setScopeRel('')
      setScopeType('code')
      setCreatingScope(false)
      fetchData()
    }
  }

  return (
    <>
      <Navbar email={email} />
      <main className="page anim-fade-in" style={{ padding: '40px 0' }}>
        <div className="container">
          <div style={{ marginBottom: '40px', borderBottom: '1px solid var(--border-1)', paddingBottom: '24px' }}>
            <h1 className="page-title">Source Contexts</h1>
            <p className="page-subtitle">Configure root directories and narrow scopes for audits</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--s8)' }}>
            
            <div className="flex flex-col gap-6">
              <h2 className="font-display" style={{ fontSize: '1.25rem' }}>Your Directories</h2>
              {loading ? (
                <div className="card flex flex-col gap-4">
                  <div className="skeleton" style={{ height: '40px', width: '60%' }}></div>
                  <div className="skeleton" style={{ height: '16px', width: '100%' }}></div>
                  <div className="skeleton" style={{ height: '16px', width: '90%' }}></div>
                </div>
              ) : contexts.length === 0 ? (
                <div className="card empty-state" style={{ background: 'rgba(19, 12, 28, 0.2)', minHeight: 280 }}>
                  <span className="empty-state-icon" style={{ fontSize: '2.5rem', color: 'rgba(255,107,69,0.2)' }}>📁</span>
                  <div className="empty-state-title">No repositories configured</div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>Register a Git Repository URL on the right to start verifying answers against it.</p>
                </div>
              ) : (
                contexts.map((ctx) => (
                  <div key={ctx.source_context_id} className="card flex flex-col gap-4" style={{ background: 'rgba(19, 12, 28, 0.4)' }}>
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-display" style={{ color: 'var(--text-1)', fontSize: '1.2rem' }}>{ctx.name}</h3>
                        <code className="mono text-3" style={{ fontSize: '0.75rem' }}>slug: {ctx.slug}</code>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: '0.62rem', background: 'rgba(0, 220, 184, 0.08)', border: '1px solid rgba(0, 220, 184, 0.25)', color: 'var(--teal)', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>git</span>
                        <span className="badge badge-supported">active</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="input-label" style={{ fontSize: '0.75rem' }}>Repository URL</span>
                      <pre className="snippet-block" style={{ fontSize: '0.75rem', borderLeft: '2px solid var(--coral)', color: 'var(--text-2)' }}>{ctx.root_path}</pre>
                    </div>

                    {ctx.description && <p style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>{ctx.description}</p>}

                    <div className="divider"></div>

                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-display" style={{ fontSize: '0.95rem' }}>Bounded Scopes</h4>
                        <button onClick={() => { setActiveCtxId(ctx.source_context_id); setScopeSuccess(false); setScopeError(null); }} className="btn btn-secondary btn-sm">
                          + Add Scope
                        </button>
                      </div>

                      {activeCtxId === ctx.source_context_id && (
                        <form onSubmit={handleCreateScope} className="card flex flex-col gap-4 anim-scale-up" style={{ padding: 'var(--s4)', background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}>
                          <h5 className="font-display">New Bounded Scope</h5>
                          {scopeError && <div className="auth-error">{scopeError}</div>}
                          {scopeSuccess && <div className="alert alert-info">Scope created successfully.</div>}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s4)' }}>
                            <div className="input-group">
                              <label className="input-label">Scope Name</label>
                              <input className="input" placeholder="e.g. Services Layer" value={scopeName} onChange={(e) => setScopeName(e.target.value)} required />
                            </div>
                            <div className="input-group">
                              <label className="input-label">Slug</label>
                              <input className="input" placeholder="e.g. services" value={scopeSlug} onChange={(e) => setScopeSlug(e.target.value)} required />
                            </div>
                          </div>
                          <div className="input-group">
                            <label className="input-label">Relative Path (from root)</label>
                            <input className="input" placeholder="e.g. backend/app/services" value={scopeRel} onChange={(e) => setScopeRel(e.target.value)} required />
                          </div>
                          <div className="input-group">
                            <label className="input-label">Scope Type</label>
                            <select className="input" value={scopeType} onChange={(e) => setScopeType(e.target.value)} style={{ background: 'var(--surface-1)' }}>
                              <option value="code">Code Only</option>
                              <option value="doc">Documentation Only</option>
                              <option value="config">Configuration Only</option>
                              <option value="mixed">Mixed/All</option>
                            </select>
                          </div>
                          <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                            <button type="button" onClick={() => setActiveCtxId(null)} className="btn btn-secondary btn-sm" style={{ borderColor: 'transparent' }}>Cancel</button>
                            <button type="submit" disabled={creatingScope} className="btn btn-primary btn-sm">{creatingScope ? 'Saving...' : 'Save Scope'}</button>
                          </div>
                        </form>
                      )}

                      {(!scopes[ctx.source_context_id] || scopes[ctx.source_context_id].length === 0) ? (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>No bounded scopes configured. Audits run against the entire root directory.</p>
                      ) : (
                        <div className="flex flex-col gap-2 stagger">
                          {scopes[ctx.source_context_id].map((scope) => (
                            <div key={scope.source_scope_id} className="flex justify-between items-center card" style={{ padding: '10px var(--s4)', background: 'var(--surface-2)' }}>
                              <div>
                                <span className="font-display" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)' }}>{scope.name}</span>
                                <code className="mono text-3" style={{ fontSize: '0.7rem', marginLeft: 'var(--s2)' }}>slug: {scope.slug}</code>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="badge badge-low">{scope.scope_type}</span>
                                <code className="mono text-2" style={{ fontSize: '0.7rem' }}>./{scope.relative_path}</code>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-col gap-6">
              <h2 className="font-display" style={{ fontSize: '1.25rem' }}>Register Repository</h2>
              <form onSubmit={handleCreateContext} className="card flex flex-col gap-5" style={{ background: 'rgba(19, 12, 28, 0.4)' }}>
                {ctxError && <div className="auth-error">{ctxError}</div>}
                {ctxSuccess && <div className="alert alert-info">Repository registered successfully.</div>}

                <div className="input-group">
                  <label className="input-label">Repository Name</label>
                  <input className="input" placeholder="e.g. Baxel Core API" value={ctxName} onChange={(e) => { setCtxName(e.target.value); setCtxSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')); }} required />
                </div>

                <div className="input-group">
                  <label className="input-label">Slug</label>
                  <input className="input" placeholder="e.g. baxel-core" value={ctxSlug} onChange={(e) => setCtxSlug(e.target.value)} required />
                </div>

                <div className="input-group">
                  <label className="input-label">Git Repository URL</label>
                  <input className="input" placeholder="e.g. https://github.com/username/project" value={ctxRoot} onChange={(e) => setCtxRoot(e.target.value)} required />
                </div>

                <div className="input-group">
                  <label className="input-label">Description (Optional)</label>
                  <textarea className="input" placeholder="Describe the purpose of this codebase..." value={ctxDesc} onChange={(e) => setCtxDesc(e.target.value)}></textarea>
                </div>

                <button type="submit" disabled={creatingCtx} className="btn btn-primary w-full">
                  {creatingCtx ? 'Registering...' : 'Register Repository'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
