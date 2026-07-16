'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useCallback, useReducer } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────
// CUSTOM CROSSHAIR CURSOR
// ─────────────────────────────────────────────────────────────
function Cursor({ x, y, active }: { x: number; y: number; active: boolean }) {
  return (
    <div style={{
      position: 'fixed', left: x, top: y, zIndex: 99999,
      pointerEvents: 'none', transform: 'translate(-50%,-50%)',
      transition: 'transform 0.12s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <svg width={active ? 28 : 20} height={active ? 28 : 20} viewBox="0 0 28 28" fill="none"
        style={{ transition: 'width 0.15s, height 0.15s' }}>
        <circle cx="14" cy="14" r="4.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" />
        <line x1="14" y1="0" x2="14" y2="7" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeLinecap="round" />
        <line x1="14" y1="21" x2="14" y2="28" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeLinecap="round" />
        <line x1="0" y1="14" x2="7" y2="14" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeLinecap="round" />
        <line x1="21" y1="14" x2="28" y2="14" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeLinecap="round" />
        {active && <circle cx="14" cy="14" r="9" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />}
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PARTICLE CANVAS  (self-contained — no prop-driven re-renders)
// ─────────────────────────────────────────────────────────────
function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  const s = useRef({
    particles: [] as { x: number; y: number; vx: number; vy: number; r: number }[],
    raf: 0,
    mx: 0, my: 0,        // current smooth canvas position
    tx: 0.5, ty: 0.35,  // raw mouse target (0–1 normalized)
  })

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      // Prevent jump on first render
      s.current.mx = s.current.tx * canvas.width
      s.current.my = s.current.ty * canvas.height
    }
    resize()
    window.addEventListener('resize', resize)

    // Mouse updates TARGET only — draw loop interpolates smoothly
    const onMouse = (e: MouseEvent) => {
      s.current.tx = e.clientX / window.innerWidth
      s.current.ty = e.clientY / window.innerHeight
    }
    window.addEventListener('mousemove', onMouse)

    // Init particles
    s.current.particles = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.04,
      vy: (Math.random() - 0.5) * 0.04,
      r: Math.random() * 1.3 + 0.5,
    }))

    const draw = () => {
      const { particles } = s.current
      const W = canvas.width, H = canvas.height

      // 0.035 coefficient = smooth tracing following cursor
      s.current.mx += (s.current.tx * W - s.current.mx) * 0.035
      s.current.my += (s.current.ty * H - s.current.my) * 0.035
      const smx = s.current.mx, smy = s.current.my

      ctx.clearRect(0, 0, W, H)

      particles.forEach(p => {
        const dx = smx - p.x, dy = smy - p.y
        const d = Math.sqrt(dx * dx + dy * dy)

        // Organic slow background drift (no black hole pull)
        p.vx += (Math.random() - 0.5) * 0.002
        p.vy += (Math.random() - 0.5) * 0.002
        
        p.vx = Math.max(-0.15, Math.min(0.15, p.vx))
        p.vy = Math.max(-0.15, Math.min(0.15, p.vy))

        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0

        const glow = Math.max(0, 1 - d / 380)

        // Node — coral glow
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * (1 + glow * 2.2), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 120, 80, ${0.04 + glow * 0.52})`
        ctx.fill()

        // Edge directly from cursor to particle (focal hub effect)
        if (d < 150) {
          ctx.beginPath()
          ctx.moveTo(smx, smy)
          ctx.lineTo(p.x, p.y)
          ctx.strokeStyle = `rgba(0, 220, 184, ${(1 - d / 150) * 0.28})`
          ctx.lineWidth = 0.75
          ctx.stroke()
        }

        // Edges — teal glow near cursor, faint coral far
        particles.forEach(q => {
          const ex = q.x - p.x, ey = q.y - p.y
          const ed = Math.sqrt(ex * ex + ey * ey)
          if (ed < 135 && ed > 0) {
            const midX = (p.x + q.x) / 2, midY = (p.y + q.y) / 2
            const md = Math.sqrt((smx - midX) ** 2 + (smy - midY) ** 2)
            const mb = Math.max(0, 1 - md / 360)
            const farAlpha = (1 - ed / 135) * 0.04
            const nearAlpha = mb * 0.24
            ctx.beginPath()
            ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y)
            // Blend coral→teal based on cursor proximity
            if (mb > 0.15) {
              ctx.strokeStyle = `rgba(0, 220, 190, ${farAlpha + nearAlpha})`
            } else {
              ctx.strokeStyle = `rgba(255, 110, 80, ${farAlpha + nearAlpha})`
            }
            ctx.lineWidth = 0.5; ctx.stroke()
          }
        })
      })

      s.current.raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(s.current.raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouse)
    }
  }, []) // ← EMPTY DEPS: runs once, never restarts

  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }} />
}

// ─────────────────────────────────────────────────────────────
// MOCK ROTATING SCENARIOS
// ─────────────────────────────────────────────────────────────
const MOCK_SCENARIOS = [
  {
    q: "How is authentication and data safety handled in this project?",
    claims: [
      { text: 'The backend uses Redis for session caching with 24-hour TTLs.', verdict: 'supported' as const, ref: 'cache/redis.py:L34', conf: 97 },
      { text: 'JWT tokens are configured to expire after 30 days.', verdict: 'contradicted' as const, ref: 'auth/tokens.py:L108 · actual: 7d', conf: 94 },
      { text: 'All database queries use parameterized statements.', verdict: 'supported' as const, ref: 'db/queries.py:L12–L89', conf: 100 },
      { text: 'Rate limiting state persists between server restarts.', verdict: 'unverified' as const, ref: 'No persistent store detected', conf: 0 },
    ],
    score: 75,
    handle: "proof/f9a3c8d1"
  },
  {
    q: "How fast are duplicate claim verifications processed?",
    claims: [
      { text: 'Audit request checks vector cache for semantically identical past claims.', verdict: 'supported' as const, ref: 'memory/vector_store.py:L58', conf: 99 },
      { text: 'Swarms run standard LLM audits on every query without cache checks.', verdict: 'contradicted' as const, ref: 'bypassed via cached verdict', conf: 96 },
      { text: 'Critic agent analyzes context for variable name mappings.', verdict: 'supported' as const, ref: 'agents/critic.py:L12–L45', conf: 95 },
      { text: 'Cache TTL is managed dynamically using LRU eviction.', verdict: 'unverified' as const, ref: 'Hardcoded 24h default found', conf: 0 },
    ],
    score: 75,
    handle: "proof/a2e8c56d"
  },
  {
    q: "Does the storage layer support cascading deletes?",
    claims: [
      { text: 'Profiles table is linked with foreign keys to auth.users.', verdict: 'supported' as const, ref: 'db/schema.sql:L14', conf: 100 },
      { text: 'Deleting an auth user leaves profiles orphaned.', verdict: 'contradicted' as const, ref: 'ON DELETE CASCADE active', conf: 98 },
      { text: 'Audits table indices include user_id and started_at.', verdict: 'supported' as const, ref: 'db/schema.sql:L284–L298', conf: 93 },
      { text: 'Scopes queries automatically refresh index tables daily.', verdict: 'unverified' as const, ref: 'No cron database trigger detected', conf: 0 },
    ],
    score: 75,
    handle: "proof/d4f8a10b"
  },
  {
    q: "What are the connection timeouts on third-party service calls?",
    claims: [
      { text: 'External LLM client uses HTTPX with a 10-second request timeout.', verdict: 'supported' as const, ref: 'core/config.py:L12', conf: 92 },
      { text: 'Client retries failed requests infinitely.', verdict: 'contradicted' as const, ref: 'Max 3 retries configured', conf: 97 },
      { text: 'FastAPI middleware enables CORS for localhost origins.', verdict: 'supported' as const, ref: 'main.py:L48–L60', conf: 100 },
      { text: 'Rate limiter blocks client requests automatically at 50/min.', verdict: 'unverified' as const, ref: 'Limit set dynamically by provider', conf: 0 },
    ],
    score: 75,
    handle: "proof/b8e3c12a"
  },
  {
    q: "How does the Claude Desktop MCP server expose proofs?",
    claims: [
      { text: 'The MCP server lists tool actions to audit queries directly.', verdict: 'supported' as const, ref: 'app/mcp_server.py:L154', conf: 98 },
      { text: 'MCP client gets the raw database access credentials.', verdict: 'contradicted' as const, ref: 'Access tokens only via OAuth', conf: 99 },
      { text: 'Proof resources are exposed as deep-link URLs.', verdict: 'supported' as const, ref: 'app/mcp_server.py:L240', conf: 96 },
      { text: 'Cursor integrations support parallel multi-project checks.', verdict: 'unverified' as const, ref: 'Single project context active', conf: 0 },
    ],
    score: 75,
    handle: "proof/c9a4d85e"
  }
]

const VC = { supported: '#10b981', contradicted: '#f43f5e', unverified: '#5a5a65' }
const VL = { supported: '✓ SUPPORTED', contradicted: '✗ CONTRADICTED', unverified: '? UNVERIFIED' }

function ClaimScanner({ onCursorChange }: { onCursorChange: (v: boolean) => void }) {
  const [scenarioIdx, setScenarioIdx] = useState(0)
  const [scanPct, setScanPct] = useState(0)
  const [revealed, setRevealed] = useState<number[]>([])
  const [done, setDone] = useState(false)
  const [running, setRunning] = useState(false)
  const rafRef = useRef<number>(0)

  const activeScenario = MOCK_SCENARIOS[scenarioIdx]

  const run = useCallback(() => {
    if (running) return
    
    // Cycle scenario index for the next run
    const nextIdx = revealed.length > 0 ? (scenarioIdx + 1) % MOCK_SCENARIOS.length : scenarioIdx
    setScenarioIdx(nextIdx)
    const scenario = MOCK_SCENARIOS[nextIdx]

    setRunning(true); setScanPct(0); setRevealed([]); setDone(false)
    const start = performance.now()
    const dur = 2400
    const step = (now: number) => {
      const t = Math.min((now - start) / dur, 1)
      setScanPct(t * 100)
      if (t < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    
    scenario.claims.forEach((_, i) => setTimeout(() => setRevealed(p => [...p, i]), 600 + i * 520))
    setTimeout(() => { setDone(true); setRunning(false) }, 600 + scenario.claims.length * 520 + 400)
  }, [running, scenarioIdx, revealed])

  useEffect(() => { const t = setTimeout(run, 800); return () => clearTimeout(t) }, [])

  return (
    <div
      onClick={!running ? run : undefined}
      onMouseEnter={() => onCursorChange(true)}
      onMouseLeave={() => onCursorChange(false)}
      style={{
        background: '#050507', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03)',
        cursor: running ? 'default' : 'pointer',
      }}
    >
      {/* Chrome bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', background: '#030305', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#ff5f56','#ffbd2e','#27c93f'].map((c,i) => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c, opacity: 0.75 }} />)}
        </div>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'rgba(255,255,255,0.18)' }}>varinth · claim-verification</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {running && <><div style={{ width: 5, height: 5, borderRadius: '50%', background: '#8b5cf6', animation: 'glowPulse 0.9s infinite' }} /><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#8b5cf6' }}>scanning</span></>}
          {done && <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#10b981' }}>complete · click to rerun</span>}
        </div>
      </div>

      {/* Query line */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.03)', background: 'rgba(255,255,255,0.01)' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'rgba(255,255,255,0.18)' }}>
          Q: "{activeScenario.q}"
        </span>
      </div>

      {/* Claims */}
      <div style={{ padding: '6px 0', position: 'relative' }}>
        {/* Scan beam */}
        {running && (
          <div style={{
            position: 'absolute', left: 0, right: 0, top: `${scanPct}%`, height: 2, zIndex: 10, pointerEvents: 'none',
            background: 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.7) 20%, rgba(139,92,246,0.9) 50%, rgba(139,92,246,0.7) 80%, transparent 100%)',
            boxShadow: '0 0 16px rgba(139,92,246,0.5), 0 0 40px rgba(139,92,246,0.2)',
          }} />
        )}

        {activeScenario.claims.map((claim, i) => {
          const r = revealed.includes(i)
          const color = VC[claim.verdict]
          return (
            <div key={i} style={{
              padding: '14px 18px',
              borderBottom: i < activeScenario.claims.length - 1 ? '1px solid rgba(255,255,255,0.03)' : undefined,
              background: r ? `${color}08` : 'transparent',
              transition: 'background 0.5s',
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'rgba(255,255,255,0.12)', paddingTop: 2, minWidth: 14 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.5, color: r ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.15)', transition: 'color 0.5s', fontFamily: 'Inter, sans-serif' }}>
                    {claim.text}
                  </p>
                </div>
                <div style={{
                  minWidth: 140, textAlign: 'right', flexShrink: 0,
                  opacity: r ? 1 : 0, transform: r ? 'none' : 'translateX(6px)',
                  transition: 'opacity 0.4s, transform 0.4s',
                }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px',
                    background: `${color}12`, border: `1px solid ${color}28`, borderRadius: 3, marginBottom: 3,
                  }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', fontWeight: 700, color, letterSpacing: '0.02em' }}>
                      {VL[claim.verdict]}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', color: 'rgba(255,255,255,0.18)' }}>
                    {claim.ref}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Score footer */}
      <div style={{
        padding: '13px 18px', background: '#030305', borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        opacity: done ? 1 : 0, transition: 'opacity 0.7s',
      }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'rgba(255,255,255,0.2)' }}>
          Global Trust Score
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 100, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
            <div style={{
              height: '100%', borderRadius: 2, width: done ? `${activeScenario.score}%` : '0%',
              background: 'linear-gradient(90deg, #10b981, #3b82f6)',
              transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)',
              boxShadow: '0 0 8px rgba(16,185,129,0.5)',
            }} />
          </div>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>{activeScenario.score}%</span>
        </div>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#8b5cf6', opacity: 0.6 }}>
          {activeScenario.handle}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SCROLLING TICKER
// ─────────────────────────────────────────────────────────────
const TICKER_ITEMS = [
  { t: '✓ cache/redis.py:L34 · supported · 97%', c: '#10b981' },
  { t: '✗ auth/tokens.py:L108 · contradicted · 94%', c: '#f43f5e' },
  { t: '🧠 memory hit · 98.3% similarity · swarm bypassed', c: '#8b5cf6' },
  { t: '✓ db/queries.py:L12 · supported · 100%', c: '#10b981' },
  { t: '✓ middleware.py:L44 · supported · 91%', c: '#10b981' },
  { t: '? rate_limiter.py · unverified · no persistent store', c: '#5a5a65' },
  { t: '✓ schema.sql:L205 · supported · 88%', c: '#10b981' },
  { t: '✗ logger.py:L89 · contradicted · 96%', c: '#f43f5e' },
]

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  const supabase = createClient()
  const [ready, setReady] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.35 })
  const [cursor, setCursor] = useState({ x: -999, y: -999 })
  const [active, setActive] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { setAuthenticated(!!user); setReady(true) })
    const onMove = (e: MouseEvent) => {
      setMouse({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight })
      setCursor({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  if (!ready) return <div style={{ minHeight: '100dvh', background: '#000' }} />

  return (
    <>
      <style>{`
        * { cursor: none !important; }
        body { background: #07070f; overflow-x: hidden; }
        @keyframes glowPulse { 0%,100%{opacity:.3} 50%{opacity:1} }
        @keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmerGrad { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes borderGlow {
          0%,100%{border-color:rgba(255,100,60,0.18)}
          50%{border-color:rgba(0,220,180,0.35)}
        }
      `}</style>

      <Cursor x={cursor.x} y={cursor.y} active={active} />

      <div style={{ background: '#0d0510', color: '#f9f5ff', minHeight: '100dvh' }}>

        {/* ══════════ HERO ══════════ */}
        <section style={{ position: 'relative', height: '100dvh', overflow: 'hidden' }}>
          <ParticleCanvas />

          {/* Vignette overlay */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at 50% 0%, transparent 38%, rgba(13,5,16,0.82) 78%)' }} />

          {/* NAV */}
          <nav style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 52px', height: 60,
            borderBottom: '1px solid rgba(255,100,60,0.07)',
            background: 'rgba(13,5,16,0.6)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '-0.05em', color: '#f9f5ff' }}>
              Varinth<span style={{ color: 'rgba(255,130,90,0.28)' }}>.engine</span>
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {authenticated ? (
                <Link href="/dashboard" onMouseEnter={() => setActive(true)} onMouseLeave={() => setActive(false)}
                  style={{ background: '#fff', color: '#000', padding: '7px 20px', borderRadius: 5, fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none' }}>
                  Dashboard →
                </Link>
              ) : (
                <>
                  <Link href="/login" style={{ color: 'rgba(249,220,200,0.38)', padding: '7px 14px', fontSize: '0.82rem', textDecoration: 'none', letterSpacing: '0.01em' }}>
                    Sign in
                  </Link>
                  <Link href="/signup" onMouseEnter={() => setActive(true)} onMouseLeave={() => setActive(false)}
                    style={{ background: '#ff6b45', color: '#fff', padding: '7px 20px', borderRadius: 5, fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none', letterSpacing: '0.01em', boxShadow: '0 0 20px rgba(255,107,69,0.3)' }}>
                    Get started
                  </Link>
                </>
              )}
            </div>
          </nav>

          {/* HERO CONTENT */}
          <div style={{
            position: 'absolute', zIndex: 10,
            top: '50%', left: '52px', right: '52px',
            transform: 'translateY(-50%)',
            display: 'grid',
            gridTemplateColumns: '1fr 1.05fr',
            gap: 64,
            alignItems: 'center',
          }}>
            {/* Left: Text */}
            <div style={{ animation: 'fadeUp 0.75s cubic-bezier(0.16,1,0.3,1) 0.05s both' }}>

              {/* Headline */}
              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(3rem, 5.5vw, 5.2rem)',
                fontWeight: 400, lineHeight: 0.95, letterSpacing: '-0.05em',
                margin: '0 0 28px',
              }}>
                Every AI<br />
                output.<br />
                <span style={{
                  background: 'linear-gradient(120deg, #ff7a52 0%, #ffa833 38%, #00dcb8 75%)',
                  backgroundSize: '300% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  animation: 'shimmerGrad 5s linear infinite',
                }}>
                  Proven.
                </span>
              </h1>

              {/* Sub */}
              <p style={{ fontSize: '0.92rem', color: 'rgba(249,220,200,0.38)', lineHeight: 1.72, maxWidth: 360, margin: '0 0 38px', letterSpacing: '0.015em' }}>
                Varinth extracts atomic claims from AI-generated code or text, then runs a three-agent swarm — Critic, Verifier, Judge — against your actual codebase. With a full, inspectable proof path.
              </p>

              {/* CTAs */}
              <div style={{ display: 'flex', gap: 10 }}>
                {authenticated ? (
                  <Link href="/dashboard" onMouseEnter={() => setActive(true)} onMouseLeave={() => setActive(false)}
                    style={{ background: '#fff', color: '#000', padding: '11px 28px', borderRadius: 6, fontSize: '0.88rem', fontWeight: 600, textDecoration: 'none', boxShadow: '0 0 28px rgba(255,255,255,0.08)' }}>
                    Open Dashboard →
                  </Link>
                ) : (
                  <>
                    <Link href="/signup" onMouseEnter={() => setActive(true)} onMouseLeave={() => setActive(false)}
                      style={{ background: '#f0efff', color: '#07070f', padding: '11px 28px', borderRadius: 6, fontSize: '0.88rem', fontWeight: 600, textDecoration: 'none', boxShadow: '0 0 32px rgba(157,107,255,0.15)', letterSpacing: '0.01em' }}>
                      Start free →
                    </Link>
                    <Link href="/login"
                      style={{ border: '1px solid rgba(157,130,255,0.12)', color: 'rgba(157,130,255,0.5)', padding: '11px 20px', borderRadius: 6, fontSize: '0.88rem', textDecoration: 'none', letterSpacing: '0.01em' }}>
                      Sign in
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Right: Scanner */}
            <div style={{ animation: 'fadeUp 0.75s cubic-bezier(0.16,1,0.3,1) 0.2s both' }}>
              <ClaimScanner onCursorChange={setActive} />
            </div>
          </div>

          {/* Scroll indicator */}
          <div style={{
            position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, zIndex: 10,
          }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: 'rgba(255,255,255,0.12)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>scroll</span>
            <div style={{ width: 1, height: 28, background: 'linear-gradient(to bottom, rgba(255,255,255,0.15), transparent)', animation: 'glowPulse 2s infinite' }} />
          </div>
        </section>

        {/* ══════════ TICKER ══════════ */}
        <div style={{ overflow: 'hidden', borderTop: '1px solid rgba(157,130,255,0.06)', borderBottom: '1px solid rgba(157,130,255,0.06)', padding: '10px 0', background: 'rgba(7,7,15,0.6)' }}>
          <div style={{ display: 'flex', gap: 52, animation: 'ticker 32s linear infinite', width: 'max-content' }}>
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: item.c, opacity: 0.45, whiteSpace: 'nowrap' }}>
                {item.t}
              </span>
            ))}
          </div>
        </div>

        {/* ══════════ THREE AGENTS ══════════ */}
        <section style={{ padding: '140px 52px', maxWidth: 1240, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 100, alignItems: 'start' }}>
            {/* Sticky label */}
            <div style={{ position: 'sticky', top: 110 }}>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.63rem', color: 'rgba(255,255,255,0.14)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 18 }}>
                The mechanism
              </p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 4vw, 3.4rem)', fontWeight: 400, letterSpacing: '-0.05em', lineHeight: 1, color: '#f8f8f8' }}>
                Three<br />agents.<br />
                <span style={{ WebkitTextStroke: '1px rgba(255,255,255,0.18)', color: 'transparent' }}>One<br />verdict.</span>
              </h2>
            </div>

            {/* Agent cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[
                { n: '01', name: 'Critic', accent: '#22d3ee', body: 'Scans every evidence chunk for namespace collisions, renamed identifiers, and contextual discrepancies. Writes structured critique notes before any verdict is computed.', out: 'critique_notes[]' },
                { n: '02', name: 'Verifier', accent: '#8b5cf6', body: 'Maps the Critic\'s notes to boolean signals per evidence item: supports_claim and contradicts_claim. Returns strict JSON. Falls back to deterministic rules if the model is unavailable.', out: 'verdict_signals{}' },
                { n: '03', name: 'Judge', accent: '#10b981', body: 'Compiles evidence signals into a natural-language explanation and emits the final verdict: supported, contradicted, or unverified. Writes the explanation field in the Proof Object.', out: 'proof_object{}' },
              ].map(({ n, name, accent, body, out }, i) => (
                <div key={n}
                  style={{ padding: '44px 44px', background: '#0c0c1c', borderTop: i === 0 ? '1px solid rgba(157,130,255,0.06)' : undefined, borderBottom: '1px solid rgba(157,130,255,0.06)', position: 'relative', transition: 'background 180ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#10102a'; setActive(true) }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#0c0c1c'; setActive(false) }}
                >
                  {/* Accent stripe */}
                  <div style={{ position: 'absolute', left: 0, top: '18%', bottom: '18%', width: 2, background: accent, opacity: 0.35, borderRadius: 1 }} />
                  <div style={{ display: 'flex', gap: 40 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.63rem', color: accent, opacity: 0.45, paddingTop: 6, minWidth: 22 }}>{n}</span>
                    <div>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 400, letterSpacing: '-0.04em', color: '#f0efff', lineHeight: 1, marginBottom: 18 }}>{name}</h3>
                      <p style={{ fontSize: '0.875rem', color: 'rgba(157,140,255,0.38)', lineHeight: 1.72, marginBottom: 22, maxWidth: 500, letterSpacing: '0.012em' }}>{body}</p>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: accent, opacity: 0.45, padding: '4px 10px', border: `1px solid ${accent}20`, borderRadius: 4, background: `${accent}06` }}>
                        → {out}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ PROOF OBJECT ══════════ */}
        <section style={{ margin: '0 52px 140px', position: 'relative', overflow: 'hidden', background: '#0a0a19', border: '1px solid rgba(157,130,255,0.07)', borderRadius: 20, padding: '84px 84px' }}>
          <div style={{ position: 'absolute', top: -120, right: -120, width: 600, height: 600, background: 'radial-gradient(circle, rgba(157,107,255,0.08) 0%, transparent 65%)', pointerEvents: 'none' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, position: 'relative' }}>
            <div>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.63rem', color: 'rgba(255,255,255,0.14)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 20 }}>
                The output contract
              </p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 3.5vw, 3rem)', fontWeight: 400, letterSpacing: '-0.05em', lineHeight: 1, marginBottom: 26, color: '#f0efff' }}>
                Proof follows<br />the result.<br />
                <span style={{ WebkitTextStroke: '1px rgba(157,130,255,0.2)', color: 'transparent' }}>Every surface.</span>
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'rgba(157,140,255,0.4)', lineHeight: 1.72, marginBottom: 36, letterSpacing: '0.012em' }}>
                Whether you call Varinth from Claude Desktop, the dashboard, a REST API, or a CI pipeline — the Proof Object is identical. Every surface renders the same truth, differently.
              </p>
              {[
                { icon: '⬛', s: 'Website', tag: 'Full UI', d: 'Agent trace timeline, evidence snippets, memory hit badge, knowledge graph panel.' },
                { icon: '◈', s: 'MCP / Claude / Cursor', tag: 'Inline', d: 'Compact verdict + top evidence + deep-link to hosted proof URL.' },
                { icon: '{ }', s: 'REST API', tag: 'JSON', d: 'Raw Proof Object. proof_id, agent_trace[], guardrail_trace, claim_traces[].' },
              ].map(({ icon, s, tag, d }) => (
                <div key={s} style={{ display: 'flex', gap: 16, marginBottom: 10, padding: '16px 18px', background: 'rgba(157,130,255,0.02)', border: '1px solid rgba(157,130,255,0.06)', borderRadius: 9, transition: 'border-color 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(157,130,255,0.14)'; setActive(true) }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(157,130,255,0.06)'; setActive(false) }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: 'rgba(255,255,255,0.14)', paddingTop: 1, minWidth: 18 }}>{icon}</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(220,215,255,0.7)', letterSpacing: '0.01em' }}>{s}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', color: '#9d6bff', border: '1px solid rgba(157,107,255,0.22)', padding: '1px 6px', borderRadius: 3 }}>{tag}</span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'rgba(157,140,255,0.35)', lineHeight: 1.5, margin: 0, letterSpacing: '0.01em' }}>{d}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Live JSON */}
            <div style={{ background: '#050512', border: '1px solid rgba(157,130,255,0.08)', borderRadius: 12, padding: '28px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem', lineHeight: 1.9, overflow: 'hidden', alignSelf: 'start' }}>
              <div style={{ marginBottom: 10, color: 'rgba(255,255,255,0.1)', fontSize: '0.6rem', letterSpacing: '0.08em' }}>proof.json</div>
              <div><span style={{ color: 'rgba(255,255,255,0.2)' }}>{'{'}</span></div>
              <div style={{ paddingLeft: 16 }}><span style={{ color: 'rgba(255,255,255,0.2)' }}>"proof_id":</span> <span style={{ color: '#8b5cf6' }}>"f9a3c8d1…"</span><span style={{ color: 'rgba(255,255,255,0.15)' }}>,</span></div>
              <div style={{ paddingLeft: 16 }}><span style={{ color: 'rgba(255,255,255,0.2)' }}>"global_score":</span> <span style={{ color: '#10b981' }}>0.75</span><span style={{ color: 'rgba(255,255,255,0.15)' }}>,</span></div>
              <div style={{ paddingLeft: 16 }}><span style={{ color: 'rgba(255,255,255,0.2)' }}>"guardrail_trace":</span> <span style={{ color: 'rgba(255,255,255,0.3)' }}>{'{'}</span></div>
              <div style={{ paddingLeft: 32 }}><span style={{ color: 'rgba(255,255,255,0.2)' }}>"status":</span> <span style={{ color: '#22d3ee' }}>"passed"</span></div>
              <div style={{ paddingLeft: 16 }}><span style={{ color: 'rgba(255,255,255,0.3)' }}>{'}'}</span><span style={{ color: 'rgba(255,255,255,0.15)' }}>,</span></div>
              <div style={{ paddingLeft: 16 }}><span style={{ color: 'rgba(255,255,255,0.2)' }}>"memory_trace":</span> <span style={{ color: 'rgba(255,255,255,0.3)' }}>{'{'}</span></div>
              <div style={{ paddingLeft: 32 }}><span style={{ color: 'rgba(255,255,255,0.2)' }}>"hits_count":</span> <span style={{ color: '#8b5cf6' }}>2</span></div>
              <div style={{ paddingLeft: 16 }}><span style={{ color: 'rgba(255,255,255,0.3)' }}>{'}'}</span><span style={{ color: 'rgba(255,255,255,0.15)' }}>,</span></div>
              <div style={{ paddingLeft: 16 }}><span style={{ color: 'rgba(255,255,255,0.2)' }}>"claims":</span> <span style={{ color: 'rgba(255,255,255,0.3)' }}>[</span></div>
              <div style={{ paddingLeft: 32 }}><span style={{ color: 'rgba(255,255,255,0.3)' }}>{'{'}</span></div>
              <div style={{ paddingLeft: 48 }}><span style={{ color: 'rgba(255,255,255,0.2)' }}>"verdict":</span> <span style={{ color: '#10b981' }}>"supported"</span><span style={{ color: 'rgba(255,255,255,0.15)' }}>,</span></div>
              <div style={{ paddingLeft: 48 }}><span style={{ color: 'rgba(255,255,255,0.2)' }}>"confidence":</span> <span style={{ color: '#10b981' }}>0.97</span></div>
              <div style={{ paddingLeft: 32 }}><span style={{ color: 'rgba(255,255,255,0.3)' }}>{'}'}</span><span style={{ color: 'rgba(255,255,255,0.15)' }}>,</span></div>
              <div style={{ paddingLeft: 32 }}><span style={{ color: 'rgba(255,255,255,0.3)' }}>{'{'}</span></div>
              <div style={{ paddingLeft: 48 }}><span style={{ color: 'rgba(255,255,255,0.2)' }}>"verdict":</span> <span style={{ color: '#f43f5e' }}>"contradicted"</span><span style={{ color: 'rgba(255,255,255,0.15)' }}>,</span></div>
              <div style={{ paddingLeft: 48 }}><span style={{ color: 'rgba(255,255,255,0.2)' }}>"confidence":</span> <span style={{ color: '#f43f5e' }}>0.94</span></div>
              <div style={{ paddingLeft: 32 }}><span style={{ color: 'rgba(255,255,255,0.3)' }}>{'}'}</span></div>
              <div style={{ paddingLeft: 16 }}><span style={{ color: 'rgba(255,255,255,0.3)' }}>]</span></div>
              <div><span style={{ color: 'rgba(255,255,255,0.2)' }}>{'}'}</span></div>
            </div>
          </div>
        </section>

        {/* ══════════ FINAL CTA ══════════ */}
        <section style={{ padding: '140px 52px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.04)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 800, height: 500, background: 'radial-gradient(ellipse, rgba(157,107,255,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />

          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.63rem', color: 'rgba(255,255,255,0.13)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 44, position: 'relative' }}>
            Ready to verify
          </p>

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.4rem, 6.5vw, 4.8rem)', fontWeight: 400, letterSpacing: '-0.04em', lineHeight: 1.0, marginBottom: 56, position: 'relative', color: '#f0efff' }}>
            Trust every<br />
            <span style={{ WebkitTextStroke: '1px rgba(157,130,255,0.22)', color: 'transparent' }}>AI answer.</span>
          </h2>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', position: 'relative' }}>
            <Link href="/signup" onMouseEnter={() => setActive(true)} onMouseLeave={() => setActive(false)}
              style={{ background: '#f0efff', color: '#07070f', padding: '14px 38px', borderRadius: 6, fontSize: '0.95rem', fontWeight: 600, textDecoration: 'none', boxShadow: '0 0 60px rgba(157,107,255,0.12)', letterSpacing: '0.01em' }}>
              Start verifying free
            </Link>
            <Link href="/login"
              style={{ border: '1px solid rgba(157,130,255,0.13)', color: 'rgba(157,130,255,0.45)', padding: '14px 28px', borderRadius: 6, fontSize: '0.95rem', textDecoration: 'none', letterSpacing: '0.01em' }}>
              Sign in
            </Link>
          </div>

          <p style={{ marginTop: 34, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '0.08em', position: 'relative' }}>
            MCP-NATIVE · CLAUDE DESKTOP · CURSOR · REST API
          </p>
        </section>

      </div>
    </>
  )
}
