'use client'

import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'

interface ApiKey {
  api_key_id: string
  label: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function SettingsPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const getToken = async () => {
    const session = await supabase.auth.getSession()
    return session.data.session?.access_token || null
  }

  const fetchKeys = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setEmail(user.email || '')

    const token = await getToken()
    if (!token) { setLoading(false); return }

    try {
      const res = await fetch(`${API_URL}/api/v1/api-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setKeys(await res.json())
    } catch {
      // network errors here just leave the list empty — not fatal
    }
    setLoading(false)
  }

  useEffect(() => { fetchKeys() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setCreating(true)
    const token = await getToken()
    if (!token) { setError('Session expired. Please sign in again.'); setCreating(false); return }

    try {
      const res = await fetch(`${API_URL}/api/v1/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ label }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to create API key.')
      setNewKey(data.api_key)
      setLabel('')
      fetchKeys()
    } catch (err: any) {
      setError(err.message)
    }
    setCreating(false)
  }

  const handleRevoke = async (id: string) => {
    const token = await getToken()
    if (!token) return
    await fetch(`${API_URL}/api/v1/api-keys/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    fetchKeys()
  }

  const handleCopy = () => {
    if (!newKey) return
    navigator.clipboard?.writeText(newKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <Navbar email={email} />
      <main className="page anim-fade-in" style={{ padding: '40px 0' }}>
        <div className="container">
          <div style={{ marginBottom: '40px', borderBottom: '1px solid var(--border-1)', paddingBottom: '24px' }}>
            <h1 className="page-title">API Keys</h1>
            <p className="page-subtitle">
              Authenticate headless/CI callers — like the{' '}
              <a href="https://github.com/Kushal-Raj-G-S/Varinth-Agentic-AI-Verification-Platform/tree/main/integrations/github-action"
                 target="_blank" rel="noreferrer" style={{ color: 'var(--coral)' }}>
                GitHub PR Audit Action
              </a>{' '}
              — without an interactive login.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--s8)' }}>
            <div className="flex flex-col gap-6">
              <h2 className="font-display" style={{ fontSize: '1.25rem' }}>Your Keys</h2>

              {loading ? (
                <div className="card flex flex-col gap-4">
                  <div className="skeleton" style={{ height: '40px', width: '60%' }}></div>
                  <div className="skeleton" style={{ height: '16px', width: '100%' }}></div>
                </div>
              ) : keys.length === 0 ? (
                <div className="card empty-state" style={{ background: 'rgba(19, 12, 28, 0.2)', minHeight: 200 }}>
                  <span className="empty-state-icon" style={{ fontSize: '2.5rem', color: 'rgba(255,107,69,0.2)' }}>🔑</span>
                  <div className="empty-state-title">No API keys yet</div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>Create one on the right to start using Varinth from CI.</p>
                </div>
              ) : (
                keys.map((k) => (
                  <div key={k.api_key_id} className="card flex justify-between items-center" style={{ background: 'rgba(19, 12, 28, 0.4)' }}>
                    <div>
                      <h3 className="font-display" style={{ color: 'var(--text-1)', fontSize: '1rem' }}>{k.label}</h3>
                      <code className="mono text-3" style={{ fontSize: '0.75rem' }}>{k.key_prefix}…</code>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-4)', marginTop: 4 }}>
                        Created {new Date(k.created_at).toLocaleDateString()}
                        {k.last_used_at ? ` · last used ${new Date(k.last_used_at).toLocaleDateString()}` : ' · never used'}
                      </div>
                    </div>
                    <button onClick={() => handleRevoke(k.api_key_id)} className="btn btn-secondary btn-sm" style={{ borderColor: 'rgba(255,90,90,0.3)', color: '#ff8a8a' }}>
                      Revoke
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="card flex flex-col gap-4" style={{ height: 'fit-content' }}>
              <h2 className="font-display" style={{ fontSize: '1.1rem' }}>New API Key</h2>

              {newKey ? (
                <div className="flex flex-col gap-3">
                  <div className="alert alert-info" style={{ fontSize: '0.78rem' }}>
                    Copy this now — it won't be shown again.
                  </div>
                  <pre className="snippet-block" style={{ fontSize: '0.75rem', wordBreak: 'break-all', borderLeft: '2px solid var(--coral)' }}>{newKey}</pre>
                  <button onClick={handleCopy} className="btn btn-primary btn-sm">{copied ? 'Copied!' : 'Copy key'}</button>
                  <button onClick={() => setNewKey(null)} className="btn btn-secondary btn-sm">Done</button>
                </div>
              ) : (
                <form onSubmit={handleCreate} className="flex flex-col gap-4">
                  {error && <div className="auth-error">{error}</div>}
                  <div className="input-group">
                    <label className="input-label">Label</label>
                    <input
                      className="input"
                      placeholder="e.g. GitHub Actions — my-repo"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" disabled={creating} className="btn btn-primary">
                    {creating ? 'Generating…' : 'Generate key'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
