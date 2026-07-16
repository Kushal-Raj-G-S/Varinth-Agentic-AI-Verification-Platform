'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Google Icon SVG
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

// Floating orb background
function AuthBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', top: '-15%', left: '-10%',
        width: '55%', height: '55%',
        background: 'radial-gradient(circle at center, rgba(255,107,69,0.12) 0%, transparent 65%)',
        filter: 'blur(40px)',
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', right: '-10%',
        width: '50%', height: '50%',
        background: 'radial-gradient(circle at center, rgba(0,220,184,0.09) 0%, transparent 65%)',
        filter: 'blur(50px)',
      }} />
      <div style={{
        position: 'absolute', top: '40%', right: '20%',
        width: '30%', height: '30%',
        background: 'radial-gradient(circle at center, rgba(181,123,255,0.06) 0%, transparent 70%)',
        filter: 'blur(30px)',
      }} />
      {/* Subtle grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,120,80,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,120,80,0.025) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        maskImage: 'radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.6) 70%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.6) 70%)',
      }} />
    </div>
  )
}

// Divider with label
function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,120,80,0.08)' }} />
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '0.62rem',
        color: 'rgba(255,200,180,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,120,80,0.08)' }} />
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (oauthError) {
      setError(oauthError.message)
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      router.refresh()
      router.push('/dashboard')
    }
  }

  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0d0510', position: 'relative', padding: '24px',
    }}>
      <AuthBackground />

      {/* Logo top-left */}
      <Link href="/" style={{
        position: 'absolute', top: 28, left: 36,
        fontFamily: 'var(--font-display)', fontSize: '1.2rem',
        letterSpacing: '-0.05em', color: '#f9f5ff', textDecoration: 'none',
      }}>
        Varinth<span style={{ color: 'rgba(255,130,90,0.3)' }}>.engine</span>
      </Link>

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 420,
        background: 'rgba(19,12,28,0.8)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,107,69,0.12)',
        borderRadius: 20,
        padding: '44px 40px',
        boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,107,69,0.04), inset 0 1px 0 rgba(255,200,180,0.06)',
        animation: 'scaleUp 0.4s cubic-bezier(0.16,1,0.3,1) both',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48, borderRadius: 12, marginBottom: 18,
            background: 'rgba(255,107,69,0.1)', border: '1px solid rgba(255,107,69,0.2)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M9 12l2 2 4-4" stroke="#ff6b45" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="9" stroke="#ff6b45" strokeWidth="1.5" />
            </svg>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: '1.9rem', fontWeight: 400,
            letterSpacing: '-0.04em', color: '#f9f5ff', marginBottom: 6, lineHeight: 1,
          }}>
            Welcome back
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'rgba(200,168,150,0.55)', letterSpacing: '0.01em' }}>
            Sign in to your verification workspace
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(255,63,94,0.08)', border: '1px solid rgba(255,63,94,0.2)',
            borderRadius: 8, padding: '10px 14px', marginBottom: 16,
            fontSize: '0.8rem', color: '#ff3f5e', letterSpacing: '0.01em',
          }}>
            {error}
          </div>
        )}

        {/* Google OAuth button */}
        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10, padding: '11px 16px', borderRadius: 8, marginBottom: 16,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#f9f5ff', fontSize: '0.875rem', fontWeight: 500,
            cursor: googleLoading ? 'wait' : 'pointer', letterSpacing: '0.01em',
            transition: 'all 150ms ease',
            opacity: loading ? 0.5 : 1,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.18)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)' }}
        >
          {googleLoading
            ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.65s linear infinite' }} />
            : <GoogleIcon />
          }
          {googleLoading ? 'Redirecting...' : 'Continue with Google'}
        </button>

        <Divider label="or" />

        {/* Email / Password form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'rgba(200,168,150,0.6)', letterSpacing: '0.02em' }}>
              Email
            </label>
            <input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading || googleLoading}
              style={{
                background: 'rgba(255,107,69,0.025)', border: '1px solid rgba(255,107,69,0.12)',
                borderRadius: 8, padding: '10px 13px', color: '#f9f5ff',
                fontSize: '0.875rem', letterSpacing: '0.01em', outline: 'none',
                transition: 'border-color 120ms',
              }}
              onFocus={e => { e.target.style.borderColor = 'rgba(0,220,184,0.45)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,220,184,0.07)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,107,69,0.12)'; e.target.style.boxShadow = 'none' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'rgba(200,168,150,0.6)', letterSpacing: '0.02em' }}>
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading || googleLoading}
              style={{
                background: 'rgba(255,107,69,0.025)', border: '1px solid rgba(255,107,69,0.12)',
                borderRadius: 8, padding: '10px 13px', color: '#f9f5ff',
                fontSize: '0.875rem', outline: 'none', transition: 'border-color 120ms',
              }}
              onFocus={e => { e.target.style.borderColor = 'rgba(0,220,184,0.45)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,220,184,0.07)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,107,69,0.12)'; e.target.style.boxShadow = 'none' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            style={{
              marginTop: 2, padding: '12px 16px',
              background: loading ? 'rgba(255,107,69,0.6)' : '#ff6b45',
              border: 'none', borderRadius: 8,
              color: '#fff', fontSize: '0.9rem', fontWeight: 600,
              letterSpacing: '0.01em', cursor: loading ? 'wait' : 'pointer',
              boxShadow: '0 0 24px rgba(255,107,69,0.28)',
              transition: 'all 150ms ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: googleLoading ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 36px rgba(255,107,69,0.45)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(255,107,69,0.28)' }}
          >
            {loading
              ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.65s linear infinite' }} /> Signing in…</>
              : 'Sign in →'
            }
          </button>
        </form>

        {/* Footer */}
        <div style={{ marginTop: 24, textAlign: 'center', fontSize: '0.8rem', color: 'rgba(200,168,150,0.35)', letterSpacing: '0.01em' }}>
          No account?{' '}
          <Link href="/signup" style={{ color: 'rgba(255,200,180,0.6)', fontWeight: 500 }}>
            Create one free
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes scaleUp { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 1000px #130c1c inset !important; -webkit-text-fill-color: #f9f5ff !important; }
        * { cursor: default; }
      `}</style>
    </main>
  )
}
