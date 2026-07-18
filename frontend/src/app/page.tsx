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
    const onMouse = (e: PointerEvent) => {
      s.current.tx = e.clientX / window.innerWidth
      s.current.ty = e.clientY / window.innerHeight
    }
    window.addEventListener('pointermove', onMouse)

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
      window.removeEventListener('pointermove', onMouse)
    }
  }, []) // ← EMPTY DEPS: runs once, never restarts

  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }} />
}

// ─────────────────────────────────────────────────────────────
// SWARM INTERACTIVE PLAYGROUND PRESETS
// ─────────────────────────────────────────────────────────────
const SWARM_PRESETS = [
  {
    title: "Token Expiry Check",
    q: "How safe are authentication tokens?",
    answer: "JWT tokens are configured in auth/tokens.py to expire after 30 days.",
    claims: [
      { text: "JWT tokens are set to expire after 30 days.", verdict: "contradicted", confidence: "94%" }
    ],
    critic: "Conflict flagged: auth/tokens.py declares expiry_delta limit as 7 days.",
    evidence: [
      { file: "auth/tokens.py", line: 108, code: "expiry_delta = timedelta(days=7) # limit 7d" }
    ],
    correction: {
      statement: "JWT tokens expire after 7 days, not 30 days.",
      confidence: "strong",
      ref: ["auth/tokens.py:L108"]
    }
  },
  {
    title: "Cache Policy",
    q: "How does the Redis caching structure handle evictions?",
    answer: "Database queries are cached in Redis inside cache/redis.py using LRU eviction.",
    claims: [
      { text: "Queries are cached using Redis LRU eviction.", verdict: "unverified", confidence: "0%" }
    ],
    critic: "Inconsistency: Client sets TTL, but no explicit LRU eviction configuration is found.",
    evidence: [
      { file: "cache/redis.py", line: 34, code: "self.redis.setex(key, 3600, val) # fallback: no policy" }
    ],
    correction: {
      statement: "Redis sets 1h TTL fallback, but no explicit LRU eviction is configured.",
      confidence: "tentative",
      ref: ["cache/redis.py:L34"]
    }
  },
  {
    title: "SQL Safety",
    q: "Are database queries safe from SQL injection attacks?",
    answer: "Query retrieval in db/queries.py uses parameterized SQL statements.",
    claims: [
      { text: "Queries use parameterized SQL bindings.", verdict: "supported", confidence: "100%" }
    ],
    critic: "Verified: SQL query syntax conforms to DB-API parameter bindings.",
    evidence: [
      { file: "db/queries.py", line: 12, code: "cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))" }
    ],
    correction: null
  }
];

function InteractiveSwarmPlayground({ onCursorChange }: { onCursorChange: (v: boolean) => void }) {
  const [presetIdx, setPresetIdx] = useState(0);
  const [step, setStep] = useState(0); // 0: idle, 1: extracted, 2: critic, 3: verifier, 4: judge
  const [autoPlay, setAutoPlay] = useState(false);
  const [activeVerdict, setActiveVerdict] = useState<'supported' | 'contradicted' | 'unverified' | null>(null);

  // Drag physics states
  const [nodes, setNodes] = useState<Record<string, { x: number; y: number }>>({
    claim: { x: 0, y: 0 },
    critic: { x: -140, y: -80 },
    verifier: { x: 140, y: -80 },
    judge: { x: 0, y: 95 },
    code: { x: 145, y: 35 }
  });

  const [dragged, setDragged] = useState<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragNodeStart = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const activePreset = SWARM_PRESETS[presetIdx];

  // Auto-play routine
  const triggerAutoPlay = () => {
    if (autoPlay) {
      if (timerRef.current) clearInterval(timerRef.current);
      setAutoPlay(false);
      setStep(0);
      setActiveVerdict(null);
      return;
    }
    setAutoPlay(true);
    setStep(1);
    setActiveVerdict(null);
    let nextStep = 2;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setStep(nextStep);
      if (nextStep === 4) {
        setActiveVerdict(activePreset.claims[0].verdict as any);
        clearInterval(timerRef.current!);
        setAutoPlay(false);
      } else {
        nextStep++;
      }
    }, 1800);
  };

  // Preset switch resets step
  const selectPreset = (idx: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setAutoPlay(false);
    setPresetIdx(idx);
    setStep(0);
    setActiveVerdict(null);
  };

  // Draggability
  const handlePointerDown = (nodeKey: string, e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragged(nodeKey);
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragNodeStart.current = { x: nodes[nodeKey].x, y: nodes[nodeKey].y };
    onCursorChange(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragged) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setNodes(prev => ({
      ...prev,
      [dragged]: {
        x: dragNodeStart.current.x + dx,
        y: dragNodeStart.current.y + dy
      }
    }));
  };

  const homeRef = useRef({
    claim: { x: 0, y: 0 },
    critic: { x: -140, y: -80 },
    verifier: { x: 140, y: -80 },
    judge: { x: 0, y: 95 },
    code: { x: 145, y: 35 }
  });

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragged) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      // Commit current position as the new home so nodes don't snap back
      homeRef.current = {
        ...homeRef.current,
        [dragged]: { ...nodes[dragged] }
      };
      setDragged(null);
      onCursorChange(false);
    }
  };

  // Gentle idle bobbing — always around the user-placed home position
  useEffect(() => {
    if (dragged) return;
    let active = true;
    const tick = () => {
      if (!active || dragged) return;
      setNodes(prev => {
        let changed = false;
        const next = { ...prev };
        const k = 0.10;
        const time = performance.now() / 700;
        Object.keys(homeRef.current).forEach(key => {
          const home = homeRef.current[key as keyof typeof homeRef.current];
          let phase = 0;
          if (key === 'critic') phase = 1;
          if (key === 'verifier') phase = 2;
          if (key === 'judge') phase = 3;
          if (key === 'code') phase = 4;

          const bobX = Math.cos(time + phase) * 3;
          const bobY = Math.sin(time + phase) * 5;

          const targetX = home.x + bobX;
          const targetY = home.y + bobY;

          const node = prev[key as keyof typeof prev];
          const dx = targetX - node.x;
          const dy = targetY - node.y;

          if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
            next[key as keyof typeof prev] = {
              x: node.x + dx * k,
              y: node.y + dy * k
            };
            changed = true;
          }
        });
        return changed ? next : prev;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [dragged]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const visualWidth = 420;
  const visualHeight = 320;
  const cx = visualWidth / 2;
  const cy = visualHeight / 2;

  return (
    <div style={{
      background: 'radial-gradient(ellipse 80% 60% at 50% 55%, rgba(80,40,140,0.18) 0%, #050507 65%)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03)',
      width: '100%',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Window Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', background: '#030305', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#ff5f56','#ffbd2e','#27c93f'].map((c,i) => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c, opacity: 0.75 }} />)}
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'rgba(255,255,255,0.18)' }}>varinth · swarm-visual-playground</span>
        <button
          onClick={triggerAutoPlay}
          onMouseEnter={() => onCursorChange(true)}
          onMouseLeave={() => onCursorChange(false)}
          style={{
            background: autoPlay ? 'rgba(244,63,94,0.1)' : 'rgba(139,92,246,0.15)',
            border: `1px solid ${autoPlay ? 'rgba(244,63,94,0.3)' : 'rgba(139,92,246,0.3)'}`,
            borderRadius: '4px',
            color: autoPlay ? '#f43f5e' : '#a78bfa',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            padding: '2px 8px',
            cursor: 'pointer',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}
        >
          {autoPlay ? 'Stop Swarm' : 'Auto Play Swarm'}
        </button>
      </div>

      {/* Preset Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.03)', background: 'rgba(255,255,255,0.01)' }}>
        {SWARM_PRESETS.map((p, idx) => {
          const isSel = idx === presetIdx;
          return (
            <button
              key={p.title}
              onClick={() => selectPreset(idx)}
              onMouseEnter={() => onCursorChange(true)}
              onMouseLeave={() => onCursorChange(false)}
              style={{
                flex: 1,
                background: isSel ? 'rgba(255,255,255,0.02)' : 'transparent',
                border: 'none',
                borderBottom: isSel ? '2px solid var(--coral)' : '2px solid transparent',
                color: isSel ? 'var(--text-1)' : 'var(--text-3)',
                padding: '10px 6px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center'
              }}
            >
              {p.title}
            </button>
          );
        })}
      </div>

      {/* Stepper Status Indicators */}
      <div style={{ display: 'flex', padding: '8px 16px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.02)', gap: '8px', justifyContent: 'center' }}>
        {[
          { label: 'Extract', color: '#ff6b45' },
          { label: 'Critic', color: '#22d3ee' },
          { label: 'Verifier', color: '#8b5cf6' },
          { label: 'Judge', color: '#10b981' }
        ].map((s, i) => {
          const isAct = step >= (i + 1);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: isAct ? s.color : 'rgba(255,255,255,0.06)',
                boxShadow: isAct ? `0 0 8px ${s.color}` : 'none',
                transition: 'all 0.3s'
              }} />
              <span style={{
                fontSize: '0.58rem',
                fontFamily: 'var(--font-mono)',
                color: isAct ? 'var(--text-1)' : 'var(--text-4)',
                fontWeight: isAct ? 600 : 400
              }}>
                {s.label}
              </span>
              {i < 3 && <span style={{ color: 'rgba(255,255,255,0.05)', fontSize: '0.55rem' }}>→</span>}
            </div>
          );
        })}
      </div>

      {/* Dynamic Physics Arena */}
      <div
        onPointerMove={handlePointerMove}
        style={{
          height: visualHeight,
          position: 'relative',
          background: '#020204',
          overflow: 'hidden',
          userSelect: 'none',
          touchAction: 'none'
        }}
      >
        {/* Center atmospheric glow — subtle depth without grid interference */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 55% at 50% 50%, rgba(100,40,180,0.12) 0%, transparent 68%)', pointerEvents: 'none' }} />
        {/* Edge vignette for depth */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 90% 85% at 50% 50%, transparent 55%, rgba(2,2,4,0.7) 100%)', pointerEvents: 'none' }} />

        {/* SVG connection lasers, flows, and corner decorations — sits BELOW html nodes */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
          <defs>
            <style>{`
              @keyframes dash {
                to { stroke-dashoffset: -20; }
              }
              @keyframes laserPulse {
                0%, 100% { opacity: 0.3; }
                50% { opacity: 1; }
              }
              @keyframes ringFade {
                0%, 100% { opacity: 0.05; }
                50% { opacity: 0.11; }
              }
              @keyframes cornerBlink {
                0%, 100% { opacity: 0.18; }
                50% { opacity: 0.36; }
              }
              @keyframes particleGlow {
                0%, 100% { opacity: 0.9; r: 3; }
                50% { opacity: 1; r: 4; }
              }
            `}</style>
          </defs>

          {/* ── PCB corner bracket traces ── */}
          {/* Top-left corner */}
          <g stroke="rgba(157,107,255,0.28)" strokeWidth="1" fill="none" style={{ animation: 'cornerBlink 4s ease-in-out infinite' }}>
            <polyline points="8,28 8,8 28,8" />
            <circle cx="8" cy="8" r="2" fill="rgba(157,107,255,0.4)" stroke="none" />
          </g>
          {/* Top-right corner */}
          <g stroke="rgba(34,211,238,0.22)" strokeWidth="1" fill="none" style={{ animation: 'cornerBlink 4s ease-in-out 1s infinite' }}>
            <polyline points={`${visualWidth - 28},8 ${visualWidth - 8},8 ${visualWidth - 8},28`} />
            <circle cx={visualWidth - 8} cy="8" r="2" fill="rgba(34,211,238,0.35)" stroke="none" />
          </g>
          {/* Bottom-left corner */}
          <g stroke="rgba(16,185,129,0.22)" strokeWidth="1" fill="none" style={{ animation: 'cornerBlink 4s ease-in-out 2s infinite' }}>
            <polyline points={`8,${visualHeight - 28} 8,${visualHeight - 8} 28,${visualHeight - 8}`} />
            <circle cx="8" cy={visualHeight - 8} r="2" fill="rgba(16,185,129,0.35)" stroke="none" />
          </g>
          {/* Bottom-right corner */}
          <g stroke="rgba(255,107,69,0.18)" strokeWidth="1" fill="none" style={{ animation: 'cornerBlink 4s ease-in-out 3s infinite' }}>
            <polyline points={`${visualWidth - 28},${visualHeight - 8} ${visualWidth - 8},${visualHeight - 8} ${visualWidth - 8},${visualHeight - 28}`} />
            <circle cx={visualWidth - 8} cy={visualHeight - 8} r="2" fill="rgba(255,107,69,0.3)" stroke="none" />
          </g>

          {/* Coordinate labels in corners */}
          <text x="14" y={visualHeight - 13} fontFamily="monospace" fontSize="8" fill="rgba(255,255,255,0.07)" letterSpacing="0.5">[0,0]</text>
          <text x={visualWidth - 36} y="20" fontFamily="monospace" fontSize="8" fill="rgba(255,255,255,0.07)" letterSpacing="0.5">[4,3]</text>

          {/* Concentric radar rings at center */}
          {[60, 110, 165, 210].map((r, ri) => (
            <circle
              key={ri}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={ri % 2 === 0 ? 'rgba(157,107,255,0.07)' : 'rgba(0,220,184,0.04)'}
              strokeWidth={1}
              style={{ animation: `ringFade ${2.5 + ri * 0.6}s ease-in-out ${ri * 0.4}s infinite` }}
            />
          ))}
          {/* Crosshair lines at center */}
          <line x1={cx} y1={cy - 12} x2={cx} y2={cy + 12} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          <line x1={cx - 12} y1={cy} x2={cx + 12} y2={cy} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          <circle cx={cx} cy={cy} r={2.5} fill="rgba(157,107,255,0.25)" />

          {/* ── Path definitions for animateMotion ── */}
          <defs>
            {[
              { id: 'path-critic-claim', from: 'critic', to: 'claim', active: step >= 2 },
              { id: 'path-verifier-claim', from: 'verifier', to: 'claim', active: step >= 3 },
              { id: 'path-verifier-code', from: 'verifier', to: 'code', active: step >= 3 },
              { id: 'path-judge-claim', from: 'judge', to: 'claim', active: step >= 4 },
            ].map(({ id, from, to, active }) => {
              const p1 = nodes[from]; const p2 = nodes[to];
              if (!p1 || !p2) return null;
              return <path key={id} id={id} d={`M ${cx + p1.x} ${cy + p1.y} L ${cx + p2.x} ${cy + p2.y}`} fill="none" />;
            })}
          </defs>

          {/* Connection lines + particle travelers */}
          {[
            { from: 'critic', to: 'claim', color: '#22d3ee', active: step >= 2, pathId: 'path-critic-claim', dur: '1.4s' },
            { from: 'verifier', to: 'claim', color: '#8b5cf6', active: step >= 3, pathId: 'path-verifier-claim', dur: '1.6s' },
            { from: 'verifier', to: 'code', color: '#ffa833', active: step >= 3, pathId: 'path-verifier-code', dur: '1.2s' },
            { from: 'judge', to: 'claim', color: '#10b981', active: step >= 4, pathId: 'path-judge-claim', dur: '1.5s' },
          ].map((line, idx) => {
            const p1 = nodes[line.from];
            const p2 = nodes[line.to];
            if (!p1 || !p2) return null;
            return (
              <g key={idx}>
                {/* Base glow line */}
                <line
                  x1={cx + p1.x} y1={cy + p1.y}
                  x2={cx + p2.x} y2={cy + p2.y}
                  stroke={line.active ? `${line.color}33` : 'transparent'}
                  strokeWidth={3}
                  style={{ transition: 'stroke 0.4s' }}
                />
                {/* Active dashed laser */}
                {line.active && (
                  <line
                    x1={cx + p1.x} y1={cy + p1.y}
                    x2={cx + p2.x} y2={cy + p2.y}
                    stroke={line.color}
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    strokeLinecap="round"
                    style={{
                      animation: 'dash 0.9s linear infinite, laserPulse 1.2s ease-in-out infinite',
                      filter: `drop-shadow(0 0 5px ${line.color})`
                    }}
                  />
                )}
                {/* ── Particle travelers along path ── */}
                {line.active && [0, 0.38, 0.72].map((offset, pi) => (
                  <circle key={pi} r="3" fill={line.color} style={{ filter: `drop-shadow(0 0 4px ${line.color})`, animation: 'particleGlow 0.8s ease-in-out infinite' }}>
                    <animateMotion dur={line.dur} repeatCount="indefinite" begin={`${offset}s`}>
                      <mpath href={`#${line.pathId}`} />
                    </animateMotion>
                  </circle>
                ))}
              </g>
            );
          })}

          {/* ── Sonar ping rings around active agent nodes ── */}
          {[
            { key: 'critic', color: '#22d3ee', active: step >= 2 },
            { key: 'verifier', color: '#8b5cf6', active: step >= 3 },
            { key: 'judge', color: '#10b981', active: step >= 4 },
          ].map(({ key, color, active }) => {
            const n = nodes[key];
            if (!n || !active) return null;
            const x = cx + n.x; const y = cy + n.y;
            return (
              <g key={key}>
                {[0, 0.8].map((delay, ri) => (
                  <circle key={ri} cx={x} cy={y} r="0" fill="none" stroke={color} strokeWidth="1" opacity="0">
                    <animate attributeName="r" from="26" to="56" dur="2s" begin={`${delay}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.55" to="0" dur="2s" begin={`${delay}s`} repeatCount="indefinite" />
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>

        {/* Dynamic Nodes */}

        {/* Critic Node (Cyan) */}
        <div
          onPointerDown={(e) => handlePointerDown('critic', e)}
          onPointerUp={handlePointerUp}
          style={{
            position: 'absolute',
            left: cx + nodes.critic.x,
            top: cy + nodes.critic.y,
            transform: 'translate(-50%, -50%)',
            background: step >= 2 ? '#22d3ee' : '#152530',
            border: `1px solid ${step >= 2 ? '#67e8f9' : 'rgba(34,211,238,0.1)'}`,
            borderRadius: '50%',
            width: 48, height: 48,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'grab', zIndex: 10,
            boxShadow: step >= 2 ? '0 0 20px rgba(34,211,238,0.4)' : 'none',
            transition: 'background 0.3s, border-color 0.3s, box-shadow 0.3s'
          }}
        >
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: step >= 2 ? '#000' : 'rgba(255,255,255,0.3)', letterSpacing: '0.02em' }}>Critic</span>
          <span style={{ fontSize: '0.45rem', opacity: 0.6, color: step >= 2 ? '#000' : '#fff' }}>01</span>
        </div>

        {/* Verifier Node (Purple) */}
        <div
          onPointerDown={(e) => handlePointerDown('verifier', e)}
          onPointerUp={handlePointerUp}
          style={{
            position: 'absolute',
            left: cx + nodes.verifier.x,
            top: cy + nodes.verifier.y,
            transform: 'translate(-50%, -50%)',
            background: step >= 3 ? '#8b5cf6' : '#221535',
            border: `1px solid ${step >= 3 ? '#c084fc' : 'rgba(139,92,246,0.1)'}`,
            borderRadius: '50%',
            width: 48, height: 48,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'grab', zIndex: 10,
            boxShadow: step >= 3 ? '0 0 20px rgba(139,92,246,0.4)' : 'none',
            transition: 'background 0.3s, border-color 0.3s, box-shadow 0.3s'
          }}
        >
          <span style={{ fontSize: '0.6rem', fontWeight: 700, color: step >= 3 ? '#fff' : 'rgba(255,255,255,0.3)', letterSpacing: '0.02em' }}>Verifier</span>
          <span style={{ fontSize: '0.45rem', opacity: 0.6, color: '#fff' }}>02</span>
        </div>

        {/* Judge Node (Emerald) */}
        <div
          onPointerDown={(e) => handlePointerDown('judge', e)}
          onPointerUp={handlePointerUp}
          style={{
            position: 'absolute',
            left: cx + nodes.judge.x,
            top: cy + nodes.judge.y,
            transform: 'translate(-50%, -50%)',
            background: step >= 4 ? '#10b981' : '#102520',
            border: `1px solid ${step >= 4 ? '#34d399' : 'rgba(16,185,129,0.1)'}`,
            borderRadius: '50%',
            width: 48, height: 48,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'grab', zIndex: 10,
            boxShadow: step >= 4 ? '0 0 20px rgba(16,185,129,0.4)' : 'none',
            transition: 'background 0.3s, border-color 0.3s, box-shadow 0.3s'
          }}
        >
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: step >= 4 ? '#000' : 'rgba(255,255,255,0.3)', letterSpacing: '0.02em' }}>Judge</span>
          <span style={{ fontSize: '0.45rem', opacity: 0.6, color: step >= 4 ? '#000' : '#fff' }}>03</span>
        </div>

        {/* Code Files Source Node (Orange) */}
        <div
          onPointerDown={(e) => handlePointerDown('code', e)}
          onPointerUp={handlePointerUp}
          style={{
            position: 'absolute',
            left: cx + nodes.code.x,
            top: cy + nodes.code.y,
            transform: 'translate(-50%, -50%)',
            background: step >= 3 ? '#1a1100' : '#0c0c10',
            border: `1px solid ${step >= 3 ? '#ffa833' : 'rgba(255,255,255,0.05)'}`,
            borderRadius: '6px',
            padding: '6px 12px',
            display: 'flex', flexDirection: 'column', gap: '2px',
            cursor: 'grab', zIndex: 10,
            transition: 'border-color 0.3s, background 0.3s'
          }}
        >
          <span style={{ fontSize: '0.52rem', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.25)' }}>source_code</span>
          <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: step >= 3 ? '#ffa833' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{activePreset.evidence[0].file}</span>
        </div>

        {/* Central Claim Node (Target) */}
        <div
          onPointerDown={(e) => handlePointerDown('claim', e)}
          onPointerUp={handlePointerUp}
          style={{
            position: 'absolute',
            left: cx + nodes.claim.x,
            top: cy + nodes.claim.y,
            transform: 'translate(-50%, -50%)',
            background: activeVerdict === 'supported' ? '#0a1f1a' : activeVerdict === 'contradicted' ? '#1a0a10' : activeVerdict === 'unverified' ? '#111118' : '#100c18',
            border: `1px solid ${activeVerdict === 'supported' ? '#10b981' : activeVerdict === 'contradicted' ? '#f43f5e' : activeVerdict === 'unverified' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: '10px',
            padding: '12px 14px',
            width: 190,
            display: 'flex', flexDirection: 'column', gap: 8,
            cursor: 'grab', zIndex: 12,
            boxShadow: activeVerdict === 'supported' ? '0 0 25px rgba(16,185,129,0.18), 0 8px 32px rgba(0,0,0,0.9)' : activeVerdict === 'contradicted' ? '0 0 25px rgba(244,63,94,0.18), 0 8px 32px rgba(0,0,0,0.9)' : '0 8px 32px rgba(0,0,0,0.9)',
            transition: 'border-color 0.4s, background 0.4s, box-shadow 0.4s'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.52rem', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em' }}>CLAIM NODE #01</span>
            {activeVerdict && (
              <span style={{
                fontSize: '0.55rem', fontWeight: 700, color: activeVerdict === 'supported' ? '#10b981' : activeVerdict === 'contradicted' ? '#f43f5e' : '#9ca3af',
                letterSpacing: '0.05em'
              }}>
                {activeVerdict.toUpperCase()}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem', color: step >= 1 ? '#f9f5ff' : 'rgba(255,255,255,0.2)', transition: 'color 0.3s', lineHeight: 1.45 }}>
            {step >= 1 ? activePreset.claims[0].text : 'Claim waiting to be extracted...'}
          </p>
        </div>

        {/* Claim particle extraction flight paths */}
        {step === 1 && (
          <div style={{
            position: 'absolute',
            left: 32, top: 40,
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--coral)',
            boxShadow: '0 0 8px var(--coral)',
            animation: 'fadeUp 1.2s cubic-bezier(0.16,1,0.3,1) infinite'
          }} />
        )}
      </div>

      {/* Code Terminal / Grounded Correction Details Panel */}
      <div style={{
        background: '#030305',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '14px 18px',
        minHeight: 120,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.18)', fontSize: '0.75rem', padding: '20px 0' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>Swarm is idle. Click Auto Play or select steps above.</span>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.52rem', fontFamily: 'var(--font-mono)', color: 'var(--coral)' }}>SWARM // PARSING SOURCE TEXT</span>
            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', margin: 0, lineHeight: 1.5 }}>
              &gt; Analyzing text: "{activePreset.answer}"<br />
              &gt; 1 claim successfully parsed and formatted into central working node.
            </p>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.52rem', fontFamily: 'var(--font-mono)', color: '#22d3ee' }}>CRITIC AGENT // COMPARATIVE HEURISTICS</span>
            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', margin: 0, lineHeight: 1.5 }}>
              &gt; {activePreset.critic}<br />
              &gt; Warning trace added to claims stack.
            </p>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.52rem', fontFamily: 'var(--font-mono)', color: '#8b5cf6' }}>VERIFIER AGENT // CODEBASE EVIDENCE</span>
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '6px 10px', marginTop: '2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: '#ffa833', fontFamily: 'var(--font-mono)', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '3px', marginBottom: '4px' }}>
                <span>FILE: {activePreset.evidence[0].file}:{activePreset.evidence[0].line}</span>
                <span>MATCHING EVIDENCE</span>
              </div>
              <code style={{ fontSize: '0.65rem', color: '#a78bfa', fontFamily: 'var(--font-mono)' }}>{activePreset.evidence[0].code}</code>
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', animation: 'fadeUp 0.3s var(--ease-out) both' }}>
            <span style={{ fontSize: '0.52rem', fontFamily: 'var(--font-mono)', color: '#10b981' }}>JUDGE AGENT // DECISION SUMMARY &amp; AUDIT PATH</span>
            {activePreset.correction ? (
              <div style={{
                background: 'rgba(255, 179, 0, 0.06)',
                border: '1px solid rgba(255, 179, 0, 0.2)',
                borderRadius: '6px',
                padding: '10px',
                marginTop: '2px'
              }}>
                <span style={{ fontSize: '0.58rem', color: '#ffa833', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px', textTransform: 'uppercase' }}>
                  💡 Suggested Grounded Correction ({activePreset.correction.confidence} confidence)
                </span>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-1)', margin: 0, lineHeight: 1.4 }}>
                  {activePreset.correction.statement}
                </p>
              </div>
            ) : (
              <p style={{ fontSize: '0.72rem', color: 'var(--teal)', fontFamily: 'var(--font-mono)', margin: 0, lineHeight: 1.5 }}>
                &gt; Swarm verdict: supported. Evidence confirms 100% truth alignment.<br />
                &gt; No discrepancy warnings generated.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
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
// INTERACTIVE GLOW CARD
// ─────────────────────────────────────────────────────────────
function HoverGlowCard({ children, style = {}, accent = '#ff6b45', onMouseEnter, onMouseLeave, ...props }: any) {
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
      onMouseEnter={(e) => {
        setIsHovered(true)
        if (onMouseEnter) onMouseEnter(e)
      }}
      onMouseLeave={(e) => {
        setIsHovered(false)
        if (onMouseLeave) onMouseLeave(e)
      }}
      style={{
        ...style,
        position: 'relative',
        overflow: 'hidden',
      }}
      {...props}
    >
      {isHovered && (
        <div style={{
          position: 'absolute',
          left: coords.x - 220,
          top: coords.y - 220,
          width: 440,
          height: 440,
          background: `radial-gradient(circle, ${accent}18 0%, transparent 65%)`,
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

// ─────────────────────────────────────────────────────────────
// AGENT CONSOLE RUNNER SIMULATION
// ─────────────────────────────────────────────────────────────
function AgentConsoleSim({ agent }: { agent: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % 4);
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  if (agent === 'Critic') {
    return (
      <div style={{
        background: '#040409',
        border: '1px solid rgba(34,211,238,0.12)',
        borderRadius: 8,
        padding: '14px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.62rem',
        lineHeight: 1.6,
        color: '#22d3ee',
        height: 120,
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        textAlign: 'left'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(34,211,238,0.08)', paddingBottom: 4, marginBottom: 6 }}>
          <span>critic-swarm-shell</span>
          <span style={{ fontSize: '0.55rem', opacity: 0.5 }}>ACTIVE</span>
        </div>
        {frame >= 0 && <div>&gt; Scanning tokens.py namespaces...</div>}
        {frame >= 1 && <div style={{ color: 'rgba(255,255,255,0.4)' }}>&gt; Found declaration limit: 7d</div>}
        {frame >= 2 && <div style={{ color: '#ffa833' }}>[WARN] Claim says 30d (conflict)</div>}
        {frame >= 3 && <div style={{ color: '#ff5f56' }}>&gt; Appending critique notes... done</div>}
        <div style={{ position: 'absolute', bottom: 4, right: 6, fontSize: '0.52rem', opacity: 0.2 }}>V2_CRITIC_SWARM</div>
      </div>
    );
  }

  if (agent === 'Verifier') {
    return (
      <div style={{
        background: '#040409',
        border: '1px solid rgba(139,92,246,0.12)',
        borderRadius: 8,
        padding: '14px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.62rem',
        lineHeight: 1.6,
        color: '#a78bfa',
        height: 120,
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        textAlign: 'left'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(139,92,246,0.08)', paddingBottom: 4, marginBottom: 6 }}>
          <span>verifier-core-runner</span>
          <span style={{ fontSize: '0.55rem', opacity: 0.5 }}>ACTIVE</span>
        </div>
        {frame >= 0 && <div>&gt; Evaluating rule constraints...</div>}
        {frame >= 1 && <div style={{ color: 'rgba(255,255,255,0.4)' }}>&gt; checking file content matches...</div>}
        {frame >= 2 && <div style={{ color: '#f43f5e' }}>&gt; contradicts_claim: TRUE</div>}
        {frame >= 3 && <div style={{ color: '#10b981' }}>&gt; supports_claim: FALSE</div>}
        <div style={{ position: 'absolute', bottom: 4, right: 6, fontSize: '0.52rem', opacity: 0.2 }}>V2_VERIFIER_SWARM</div>
      </div>
    );
  }

  // Judge
  return (
    <div style={{
      background: '#040409',
      border: '1px solid rgba(16,185,129,0.12)',
      borderRadius: 8,
      padding: '14px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.62rem',
      lineHeight: 1.6,
      color: '#10b981',
      height: 120,
      overflow: 'hidden',
      position: 'relative',
      width: '100%',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      textAlign: 'left'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(16,185,129,0.08)', paddingBottom: 4, marginBottom: 4 }}>
        <span>judge-finalizer</span>
        <span style={{ fontSize: '0.55rem', opacity: 0.5 }}>RESOLVED</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)' }}>CONSOLIDATING VERDICT</div>
        <div style={{
          padding: '4px 12px',
          background: frame >= 2 ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)',
          border: `1px solid ${frame >= 2 ? '#f43f5e' : '#10b981'}`,
          borderRadius: 4,
          color: frame >= 2 ? '#f43f5e' : '#10b981',
          fontWeight: 700,
          fontSize: '0.7rem',
          letterSpacing: '0.04em',
          animation: 'glowPulse 1s infinite'
        }}>
          {frame >= 2 ? '✗ CONTRADICTED' : '✓ SUPPORTED'}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.52rem', opacity: 0.3 }}>
        <span>CONF: {frame >= 2 ? '94%' : '100%'}</span>
        <span>V2_JUDGE_SWARM</span>
      </div>
    </div>
  );
}

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
  const [surfaceMode, setSurfaceMode] = useState(0)
  const [ctaMetrics, setCtaMetrics] = useState({ audits: 47, claims: 312, repos: 8 })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { setAuthenticated(!!user); setReady(true) })
    const onMove = (e: PointerEvent) => {
      setMouse({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight })
      setCursor({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setCtaMetrics(prev => ({
        audits: prev.audits + Math.floor(Math.random() * 3),
        claims: prev.claims + Math.floor(Math.random() * 11),
        repos: prev.repos + (Math.random() > 0.85 ? 1 : 0),
      }))
    }, 1800)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!ready) return;
    let observer: IntersectionObserver | null = null;
    const timer = setTimeout(() => {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('active');
            }
          });
        },
        { threshold: 0.02 }
      );
      document.querySelectorAll('.reveal').forEach((el) => observer?.observe(el));
    }, 100);
    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [ready]);

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
        @keyframes orbitSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes orbitSpinRev { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
        @keyframes pulseRing { 0%{transform:scale(0.8);opacity:0.7} 100%{transform:scale(2.2);opacity:0} }
        @keyframes scanlineScroll { from{background-position:0 0} to{background-position:0 60px} }
        @keyframes claimTicker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes floatUp { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-12px)} }
        @keyframes countFlash { 0%{color:inherit} 30%{color:#00dcb8} 100%{color:inherit} }
        .cta-metric-val { animation: countFlash 1.8s ease infinite; }
        .reveal {
          opacity: 0;
          transform: translateY(40px) scale(0.98);
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .reveal.active {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      `}</style>

      <Cursor x={cursor.x} y={cursor.y} active={active} />

      {/* Interactive page-wide ambient cursor glow spotlight */}
      <div style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        background: `radial-gradient(circle 500px at ${cursor.x}px ${cursor.y}px, rgba(157, 107, 255, 0.055), transparent 75%)`,
        zIndex: 1,
        transition: 'background 0.05s ease'
      }} />

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
            <Link href="/" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontFamily: 'var(--font-display)',
              fontSize: '1.4rem',
              letterSpacing: '-0.05em',
              color: '#f9f5ff',
              textDecoration: 'none'
            }}>
              <img src="/logo.png" alt="Varinth Logo" style={{ width: 34, height: 34, objectFit: 'contain' }} />
              <span>Varinth<span style={{ color: 'rgba(255,130,90,0.28)' }}>.engine</span></span>
            </Link>

            {/* Center Links */}
            <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
              <Link href="/swarm-pipeline" style={{ color: 'rgba(249,220,200,0.45)', fontSize: '0.82rem', textDecoration: 'none', transition: 'color 0.2s', fontWeight: 500 }} onMouseEnter={(e) => e.currentTarget.style.color = '#f9f5ff'} onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(249,220,200,0.45)'}>
                Swarm Pipeline
              </Link>
              <Link href="/integration-hub" style={{ color: 'rgba(249,220,200,0.45)', fontSize: '0.82rem', textDecoration: 'none', transition: 'color 0.2s', fontWeight: 500 }} onMouseEnter={(e) => e.currentTarget.style.color = '#f9f5ff'} onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(249,220,200,0.45)'}>
                Integration Hub
              </Link>
              <Link href="/proof-spec" style={{ color: 'rgba(249,220,200,0.45)', fontSize: '0.82rem', textDecoration: 'none', transition: 'color 0.2s', fontWeight: 500 }} onMouseEnter={(e) => e.currentTarget.style.color = '#f9f5ff'} onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(249,220,200,0.45)'}>
                Proof Spec
              </Link>
            </div>

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
              <InteractiveSwarmPlayground onCursorChange={setActive} />
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
        <section className="reveal" style={{ padding: '140px 52px', maxWidth: 1240, margin: '0 auto', position: 'relative' }}>

          {/* Subtle atmospheric decorations */}
          {/* Faint dot-grid */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
            backgroundImage: 'radial-gradient(rgba(157,107,255,0.07) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse 70% 80% at 15% 50%, black 30%, transparent 100%)'
          }} />
          {/* Accent glow halos for each agent color — left side, stacked */}
          <div style={{ position: 'absolute', left: -80, top: '18%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
          <div style={{ position: 'absolute', left: -60, top: '48%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
          <div style={{ position: 'absolute', left: -40, top: '72%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
          {/* Small decorative accent block — replaces the awful vertical line */}
          <div style={{ position: 'absolute', left: 30, top: '22%', pointerEvents: 'none', zIndex: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {['#22d3ee', '#8b5cf6', '#10b981'].map((c, i) => (
              <div key={i} style={{ width: 18, height: 2, borderRadius: 1, background: c, opacity: 0.18 + i * 0.04 }} />
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 100, alignItems: 'start', position: 'relative', zIndex: 1 }}>
            {/* Sticky label */}
            <div style={{ position: 'sticky', top: 110 }}>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.63rem', color: 'rgba(255,255,255,0.14)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 18 }}>
                The mechanism
              </p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 4vw, 3.4rem)', fontWeight: 400, letterSpacing: '-0.05em', lineHeight: 1, color: '#f8f8f8' }}>
                Three<br />agents.<br />
                <span style={{ WebkitTextStroke: '1px rgba(255,255,255,0.18)', color: 'transparent' }}>One<br />verdict.</span>
              </h2>

              {/* Mini flow diagram below the label */}
              <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  { label: 'Critic', color: '#22d3ee', step: '01' },
                  { label: 'Verifier', color: '#8b5cf6', step: '02' },
                  { label: 'Judge', color: '#10b981', step: '03' },
                ].map(({ label, color, step }, idx) => (
                  <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: idx < 2 ? 0 : 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}88`, flexShrink: 0 }} />
                      {idx < 2 && <div style={{ width: 1, height: 28, background: `linear-gradient(to bottom, ${color}44, rgba(255,255,255,0.04))` }} />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', color: 'rgba(255,255,255,0.15)' }}>{step}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color, opacity: 0.7 }}>{label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[
                { n: '01', name: 'Critic', accent: '#22d3ee', body: 'Scans every evidence chunk for namespace collisions, renamed identifiers, and contextual discrepancies. Writes structured critique notes before any verdict is computed.', out: 'critique_notes[]' },
                { n: '02', name: 'Verifier', accent: '#8b5cf6', body: 'Maps the Critic\'s notes to boolean signals per evidence item: supports_claim and contradicts_claim. Returns strict JSON. Falls back to deterministic rules if the model is unavailable.', out: 'verdict_signals{}' },
                { n: '03', name: 'Judge', accent: '#10b981', body: 'Compiles evidence signals into a natural-language explanation and emits the final verdict: supported, contradicted, or unverified. Writes the explanation field in the Proof Object.', out: 'proof_object{}' },
              ].map(({ n, name, accent, body, out }, i) => (
                <HoverGlowCard
                  key={n}
                  accent={accent}
                  onMouseEnter={() => setActive(true)}
                  onMouseLeave={() => setActive(false)}
                  style={{
                    padding: '44px 44px',
                    background: '#0c0c1c',
                    borderTop: i === 0 ? '1px solid rgba(157,130,255,0.06)' : undefined,
                    borderBottom: '1px solid rgba(157,130,255,0.06)',
                  }}
                >
                  {/* Accent stripe */}
                  <div style={{ position: 'absolute', left: 0, top: '18%', bottom: '18%', width: 2, background: accent, opacity: 0.35, borderRadius: 1 }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 40, alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 40 }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.63rem', color: accent, opacity: 0.45, paddingTop: 6, minWidth: 22 }}>{n}</span>
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 400, letterSpacing: '-0.04em', color: '#f0efff', lineHeight: 1, marginBottom: 18 }}>{name}</h3>
                        <p style={{ fontSize: '0.875rem', color: 'rgba(157,140,255,0.38)', lineHeight: 1.72, marginBottom: 22, maxWidth: 450, letterSpacing: '0.012em' }}>{body}</p>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: accent, opacity: 0.45, padding: '4px 10px', border: `1px solid ${accent}20`, borderRadius: 4, background: `${accent}06` }}>
                          → {out}
                        </span>
                      </div>
                    </div>
                    {/* Simulated terminal preview */}
                    <div style={{ width: '100%', pointerEvents: 'none' }}>
                      <AgentConsoleSim agent={name} />
                    </div>
                  </div>
                </HoverGlowCard>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ PROOF OBJECT ══════════ */}
        <section className="reveal" style={{ margin: '0 52px 140px', position: 'relative', overflow: 'hidden', background: '#08081a', border: '1px solid transparent', borderRadius: 20, padding: '84px 84px',
          backgroundImage: 'linear-gradient(#08081a, #08081a), linear-gradient(135deg, rgba(157,107,255,0.35) 0%, rgba(0,220,184,0.15) 40%, rgba(157,107,255,0.1) 100%)',
          backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box'
        }}>

          {/* Top-right glow orb */}
          <div style={{ position: 'absolute', top: -120, right: -120, width: 600, height: 600, background: 'radial-gradient(circle, rgba(157,107,255,0.1) 0%, transparent 65%)', pointerEvents: 'none' }} />
          {/* Bottom-left light leak */}
          <div style={{ position: 'absolute', bottom: -80, left: -80, width: 400, height: 400, background: 'radial-gradient(circle, rgba(0,220,184,0.06) 0%, transparent 65%)', pointerEvents: 'none' }} />

          {/* Animated horizontal scan stripe */}
          <div style={{ position: 'absolute', left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(157,107,255,0.25) 30%, rgba(0,220,184,0.2) 70%, transparent)', pointerEvents: 'none', animation: 'floatUp 8s ease-in-out infinite', top: '35%' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, position: 'relative' }}>
            <div>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.63rem', color: 'rgba(255,255,255,0.14)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 20 }}>
                The output contract
              </p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 3.5vw, 3rem)', fontWeight: 400, letterSpacing: '-0.05em', lineHeight: 1, marginBottom: 26, color: '#f0efff' }}>
                Proof follows<br />the result.<br />
                <span style={{ WebkitTextStroke: '1px rgba(157,130,255,0.2)', color: 'transparent' }}>Every surface.</span>
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'rgba(157,140,255,0.4)', lineHeight: 1.72, marginBottom: 28, letterSpacing: '0.012em' }}>
                Whether you call Varinth from Claude Desktop, the dashboard, a REST API, or a CI pipeline — the Proof Object is identical. Every surface renders the same truth, differently.
              </p>

              {/* Live surface count indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, padding: '10px 14px', background: 'rgba(157,107,255,0.05)', border: '1px solid rgba(157,107,255,0.12)', borderRadius: 8 }}>
                <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#9d6bff', animation: 'glowPulse 2s infinite' }} />
                  <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: '1px solid rgba(157,107,255,0.3)', animation: 'pulseRing 2s ease-out infinite' }} />
                </div>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'rgba(157,107,255,0.7)', letterSpacing: '0.05em' }}>3 active surfaces — same proof_id</span>
              </div>
              {[
                { icon: '⬛', s: 'Website / Cloud', tag: 'Full UI', d: 'Agent trace timeline, evidence snippets, memory hit badge, knowledge graph panel.', accent: '#9d6bff' },
                { icon: '◈', s: 'MCP / Claude Desktop', tag: 'Inline', d: 'Compact verdict + top evidence + deep-link to hosted proof URL.', accent: '#22d3ee' },
                { icon: '{ }', s: 'REST API Gateway', tag: 'JSON Response', d: 'Raw Proof Object. proof_id, agent_trace[], guardrail_trace, claim_traces[].', accent: '#10b981' },
              ].map(({ icon, s, tag, d, accent }, idx) => (
                <HoverGlowCard
                  key={s}
                  accent={accent}
                  onClick={() => setSurfaceMode(idx)}
                  onMouseEnter={() => setActive(true)}
                  onMouseLeave={() => setActive(false)}
                  style={{
                    display: 'flex',
                    gap: 16,
                    marginBottom: 10,
                    padding: '16px 18px',
                    background: surfaceMode === idx ? `${accent}10` : 'rgba(157,130,255,0.02)',
                    border: surfaceMode === idx ? `1px solid ${accent}55` : '1px solid rgba(157,130,255,0.06)',
                    borderRadius: 9,
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                  }}
                >
                  <div style={{ display: 'flex', gap: 16, width: '100%', alignItems: 'center' }}>
                    {/* Active indicator dot */}
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: surfaceMode === idx ? accent : 'rgba(255,255,255,0.1)', flexShrink: 0, boxShadow: surfaceMode === idx ? `0 0 8px ${accent}` : undefined, transition: 'all 0.3s' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: surfaceMode === idx ? '#f0efff' : 'rgba(220,215,255,0.7)', letterSpacing: '0.01em', transition: 'color 0.2s' }}>{s}</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', color: accent, border: `1px solid ${accent}33`, padding: '1px 6px', borderRadius: 3 }}>{tag}</span>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: surfaceMode === idx ? 'rgba(255,255,255,0.55)' : 'rgba(157,140,255,0.35)', lineHeight: 1.5, margin: 0, letterSpacing: '0.01em', transition: 'color 0.2s' }}>{d}</p>
                    </div>
                  </div>
                </HoverGlowCard>
              ))}
            </div>

            {/* Live Interactive Preview Surface */}
            <div style={{
              background: '#050512',
              border: `1px solid ${surfaceMode === 0 ? 'rgba(157,107,255,0.22)' : surfaceMode === 1 ? 'rgba(34,211,238,0.22)' : 'rgba(16,185,129,0.22)'}`,
              borderRadius: 12,
              padding: '24px',
              minHeight: 320,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignSelf: 'start',
              width: '100%',
              position: 'relative',
              textAlign: 'left',
              overflow: 'hidden',
              boxShadow: `0 30px 70px rgba(0,0,0,0.6), inset 0 0 40px ${surfaceMode === 0 ? 'rgba(157,107,255,0.03)' : surfaceMode === 1 ? 'rgba(34,211,238,0.03)' : 'rgba(16,185,129,0.03)'}`,
              transition: 'all 0.4s'
            }}>
              {/* Telemetry sweep line */}
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: 2,
                background: `linear-gradient(90deg, transparent, ${surfaceMode === 0 ? '#9d6bff' : surfaceMode === 1 ? '#22d3ee' : '#10b981'}, transparent)`,
                animation: 'sonarSweep 4s linear infinite',
                zIndex: 3
              }} />

              {surfaceMode === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 8 }}>
                    <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.3)' }}>varinth-web-audit-console</span>
                    <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-mono)', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 4, animation: 'glowPulse 2s infinite' }}>STATUS: ACTIVE</span>
                  </div>
                  
                  {/* Mock dashboard card */}
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: 16, position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: '0.52rem', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.3)' }}>AUDIT ID</div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f0efff' }}>f9a3c8d1-72da-4b8c</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.52rem', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.3)' }}>TRUST SCORE</div>
                        <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#10b981', filter: 'drop-shadow(0 0 4px #10b981)' }}>75%</div>
                      </div>
                    </div>
                    
                    {/* Progress slider bar */}
                    <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginBottom: 16 }}>
                      <div style={{ width: '75%', height: '100%', background: 'linear-gradient(90deg, #10b981, #3b82f6)', borderRadius: 2 }} />
                    </div>

                    {/* Claims mini lines */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[
                        { text: "Redis session caching with 24-h TTL", status: "supported", color: "#10b981" },
                        { text: "JWT expiry configuration set to 30d", status: "contradicted", color: "#f43f5e" }
                      ].map((c, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', padding: '6px 8px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 4 }}>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{c.text}</span>
                          <span style={{ color: c.color, fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', filter: `drop-shadow(0 0 2px ${c.color})` }}>{c.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {surfaceMode === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 8 }}>
                    <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.3)' }}>claude-desktop-terminal</span>
                    <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-mono)', color: '#22d3ee', background: 'rgba(34,211,238,0.1)', padding: '2px 8px', borderRadius: 4 }}>INTEGRATED</span>
                  </div>

                  {/* Claude Chat Bubble */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* User Prompt */}
                    <div style={{ alignSelf: 'flex-end', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)', borderRadius: '12px 12px 0 12px', padding: '10px 14px', maxWidth: '85%' }}>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: '#f0efff', lineHeight: 1.4 }}>
                        Ask Varinth: verify database statement parameterization in queries.py.
                      </p>
                    </div>

                    {/* Varinth MCP Tool block */}
                    <div style={{ alignSelf: 'flex-start', background: '#070716', border: '1px solid rgba(34,211,238,0.22)', borderRadius: '12px 12px 12px 0', padding: '12px 16px', maxWidth: '85%', boxShadow: '0 0 12px rgba(34,211,238,0.1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'glowPulse 2s infinite' }} />
                        <span style={{ fontSize: '0.55rem', color: '#10b981', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.04em' }}>VARINTH TOOL OUTPUT</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.45 }}>
                        Verdict: <strong style={{ color: '#10b981' }}>✓ SUPPORTED</strong><br />
                        File: db/queries.py:L12<br />
                        Match: <code style={{ color: '#22d3ee', fontSize: '0.65rem', fontFamily: 'var(--font-mono)' }}>cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))</code>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {surfaceMode === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, animation: 'fadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', lineHeight: 1.7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)' }}>proof.json (REST API response)</span>
                    <span style={{ fontSize: '0.58rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 4 }}>APPLICATION/JSON</span>
                  </div>
                  <div><span style={{ color: 'rgba(255,255,255,0.2)' }}>{'{'}</span></div>
                  <div style={{ paddingLeft: 12 }}><span style={{ color: 'rgba(255,255,255,0.2)' }}>"proof_id":</span> <span style={{ color: '#8b5cf6', filter: 'drop-shadow(0 0 2px #8b5cf6)' }}>"f9a3c8d1-72da-4b8c"</span>,</div>
                  <div style={{ paddingLeft: 12 }}><span style={{ color: 'rgba(255,255,255,0.2)' }}>"global_score":</span> <span style={{ color: '#10b981', filter: 'drop-shadow(0 0 2px #10b981)' }}>0.75</span>,</div>
                  <div style={{ paddingLeft: 12 }}><span style={{ color: 'rgba(255,255,255,0.2)' }}>"guardrail_trace":</span> <span style={{ color: 'rgba(255,255,255,0.3)' }}>{'{'}</span></div>
                  <div style={{ paddingLeft: 24 }}><span style={{ color: 'rgba(255,255,255,0.2)' }}>"status":</span> <span style={{ color: '#22d3ee', filter: 'drop-shadow(0 0 2px #22d3ee)' }}>"passed"</span></div>
                  <div style={{ paddingLeft: 12 }}><span style={{ color: 'rgba(255,255,255,0.3)' }}>{'}'}</span>,</div>
                  <div style={{ paddingLeft: 12 }}><span style={{ color: 'rgba(255,255,255,0.2)' }}>"claims":</span> <span style={{ color: 'rgba(255,255,255,0.3)' }}>[</span></div>
                  <div style={{ paddingLeft: 24 }}><span style={{ color: 'rgba(255,255,255,0.3)' }}>{'{'}</span> <span style={{ color: 'rgba(255,255,255,0.2)' }}>"verdict":</span> <span style={{ color: '#10b981' }}>"supported"</span>, <span style={{ color: 'rgba(255,255,255,0.2)' }}>"confidence":</span> <span style={{ color: '#10b981' }}>0.97</span> <span style={{ color: 'rgba(255,255,255,0.3)' }}>{'}'}</span></div>
                  <div style={{ paddingLeft: 12 }}><span style={{ color: 'rgba(255,255,255,0.3)' }}>]</span></div>
                  <div><span style={{ color: 'rgba(255,255,255,0.2)' }}>{'}'}</span></div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ══════════ FINAL CTA ══════════ */}
        <section className="reveal" style={{ position: 'relative', overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.04)' }}>

          {/* ── Animated scanline grid background ── */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
            backgroundImage: 'linear-gradient(rgba(157,107,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(157,107,255,0.022) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            animation: 'scanlineScroll 8s linear infinite'
          }} />

          {/* ── Deep purple orb center ── */}
          <div style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%,-50%)', width: 700, height: 700, background: 'radial-gradient(ellipse, rgba(157,107,255,0.11) 0%, rgba(0,220,184,0.04) 45%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

          {/* ── Orbiting rings ── */}
          <div style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%,-50%)', width: 520, height: 520, pointerEvents: 'none', zIndex: 0 }}>
            <div style={{ position: 'absolute', inset: 0, border: '1px solid rgba(157,107,255,0.08)', borderRadius: '50%', animation: 'orbitSpin 22s linear infinite' }}>
              <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 8, height: 8, background: '#9d6bff', borderRadius: '50%', boxShadow: '0 0 12px 4px rgba(157,107,255,0.6)' }} />
            </div>
            <div style={{ position: 'absolute', inset: 40, border: '1px solid rgba(0,220,184,0.07)', borderRadius: '50%', animation: 'orbitSpinRev 16s linear infinite' }}>
              <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, background: '#00dcb8', borderRadius: '50%', boxShadow: '0 0 10px 3px rgba(0,220,184,0.5)' }} />
            </div>
            <div style={{ position: 'absolute', inset: 90, border: '1px solid rgba(255,107,69,0.06)', borderRadius: '50%', animation: 'orbitSpin 30s linear infinite' }}>
              <div style={{ position: 'absolute', top: -3, left: '50%', transform: 'translateX(-50%)', width: 5, height: 5, background: '#ff6b45', borderRadius: '50%', boxShadow: '0 0 8px 2px rgba(255,107,69,0.5)' }} />
            </div>
          </div>

          {/* ── Pulse rings ── */}
          {[0, 0.6, 1.2].map((delay, i) => (
            <div key={i} style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%,-50%)', width: 180, height: 180, border: '1px solid rgba(157,107,255,0.18)', borderRadius: '50%', animation: `pulseRing 3s ${delay}s ease-out infinite`, pointerEvents: 'none', zIndex: 0 }} />
          ))}

          {/* ══ LIVE METRICS STRIP ══ */}
          <div style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            {[
              { val: ctaMetrics.audits.toLocaleString(), label: 'Audits run', sub: 'Since launch', accent: '#9d6bff' },
              { val: ctaMetrics.claims.toLocaleString(), label: 'Claims verified', sub: 'Across all repos', accent: '#00dcb8' },
              { val: ctaMetrics.repos.toLocaleString(), label: 'Repos indexed', sub: 'Public & private', accent: '#ff6b45' },
            ].map(({ val, label, sub, accent }, i) => (
              <div
                key={i}
                style={{
                  padding: '52px 0', textAlign: 'center',
                  borderRight: i < 2 ? '1px solid rgba(255,255,255,0.04)' : undefined,
                }}
              >
                <div style={{ fontSize: 'clamp(2.4rem, 4vw, 3.8rem)', fontFamily: 'var(--font-display)', fontWeight: 400, color: accent, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 10, textShadow: `0 0 40px ${accent}55` }} className="cta-metric-val">
                  {val}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', fontWeight: 500, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono, monospace', color: 'rgba(255,255,255,0.18)', letterSpacing: '0.08em' }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* ══ LIVE CLAIM TICKER ══ */}
          <div style={{ position: 'relative', zIndex: 2, overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '14px 0', background: 'rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', gap: 64, animation: 'claimTicker 28s linear infinite', width: 'max-content' }}>
              {[...Array(2)].flatMap((_, ci) => [
                { claim: 'JWT expiry set to 30 days', verdict: 'contradicted', color: '#f43f5e' },
                { claim: 'Redis session TTL is 24h', verdict: 'supported', color: '#10b981' },
                { claim: 'SQL queries use parameterised inputs', verdict: 'supported', color: '#10b981' },
                { claim: 'Auth middleware validates scope', verdict: 'unverified', color: '#f59e0b' },
                { claim: 'Rate limiting applied at API gateway', verdict: 'supported', color: '#10b981' },
                { claim: 'Model context window is 128k', verdict: 'contradicted', color: '#f43f5e' },
                { claim: 'Secrets never hardcoded in source', verdict: 'supported', color: '#10b981' },
                { claim: 'DB migrations auto-run on deploy', verdict: 'unverified', color: '#f59e0b' },
              ].map((item, i) => (
                <div key={`${ci}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, display: 'inline-block', boxShadow: `0 0 6px ${item.color}` }} />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)' }}>{item.claim}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: item.color, fontWeight: 700, textTransform: 'uppercase' }}>{item.verdict}</span>
                </div>
              )))}
            </div>
          </div>

          {/* ══ MAIN CTA CONTENT ══ */}
          <div style={{ position: 'relative', zIndex: 2, padding: '100px 52px 80px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center', maxWidth: 1240, margin: '0 auto' }}>

            {/* Left: Headline + buttons */}
            <div>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.63rem', color: 'rgba(255,255,255,0.13)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 28 }}>
                Ready to verify
              </p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.8rem, 5vw, 5rem)', fontWeight: 400, letterSpacing: '-0.05em', lineHeight: 0.95, marginBottom: 32, color: '#f0efff' }}>
                Trust every<br />
                <span style={{ WebkitTextStroke: '1.5px rgba(157,130,255,0.35)', color: 'transparent' }}>AI answer.</span>
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'rgba(157,140,255,0.45)', lineHeight: 1.7, marginBottom: 40, maxWidth: 420, letterSpacing: '0.012em' }}>
                Varinth gives every AI-generated claim a citation. Your codebase becomes the ground truth. Your team stops guessing.
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link href="/signup" onMouseEnter={() => setActive(true)} onMouseLeave={() => setActive(false)}
                  style={{ background: 'linear-gradient(135deg, #ff6b45 0%, #9d6bff 100%)', color: '#fff', padding: '16px 44px', borderRadius: 8, fontSize: '0.95rem', fontWeight: 700, textDecoration: 'none', boxShadow: '0 0 60px rgba(157,107,255,0.25), 0 0 120px rgba(255,107,69,0.1)', letterSpacing: '0.01em', display: 'inline-block' }}>
                  Start verifying free →
                </Link>
                <Link href="/login" onMouseEnter={() => setActive(true)} onMouseLeave={() => setActive(false)}
                  style={{ border: '1px solid rgba(157,130,255,0.2)', color: 'rgba(200,190,255,0.6)', padding: '16px 28px', borderRadius: 8, fontSize: '0.95rem', textDecoration: 'none', letterSpacing: '0.01em', backdropFilter: 'blur(4px)' }}>
                  Sign in
                </Link>
              </div>

              {/* Feature badges */}
              <div style={{ display: 'flex', gap: 10, marginTop: 36, flexWrap: 'wrap' }}>
                {[
                  { label: 'MCP-native', icon: '◈' },
                  { label: 'Claude Desktop', icon: '⬡' },
                  { label: 'Cursor IDE', icon: '⟐' },
                  { label: 'REST API', icon: '{ }' },
                ].map(({ label, icon }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'rgba(255,255,255,0.2)' }}>{icon}</span>
                    <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.02em' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Live mini audit terminal */}
            <div style={{ position: 'relative', animation: 'floatUp 6s ease-in-out infinite' }}>
              <div style={{
                background: '#050510',
                border: '1px solid rgba(157,130,255,0.12)',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(157,130,255,0.06), 0 0 80px rgba(157,107,255,0.08)',
              }}>
                {/* Terminal titlebar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: '#030308', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['#ff5f56','#ffbd2e','#27c93f'].map((c,i) => <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: c, opacity: 0.7 }} />)}
                  </div>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'rgba(255,255,255,0.18)' }}>varinth · live-audit</span>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', animation: 'glowPulse 2s ease infinite' }} />
                </div>

                {/* Audit input line */}
                <div style={{ padding: '18px 20px 10px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', marginBottom: 6 }}>claim input</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: '#f0efff', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(157,130,255,0.12)', borderRadius: 6 }}>
                    "Redis session TTL is configured to 24 hours"
                  </div>
                </div>

                {/* Agent pipeline */}
                <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { agent: 'Critic', status: 'done', note: 'TTL constant found at cache/config.py:L18', color: '#22d3ee' },
                    { agent: 'Verifier', status: 'done', note: 'supports_claim: true — confidence 0.97', color: '#8b5cf6' },
                    { agent: 'Judge', status: 'active', note: 'Compiling final proof object…', color: '#10b981' },
                  ].map(({ agent, status, note, color }, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: status === 'active' ? color : 'rgba(255,255,255,0.15)', boxShadow: status === 'active' ? `0 0 8px ${color}` : undefined, marginTop: 4, flexShrink: 0, animation: status === 'active' ? 'glowPulse 1.2s ease infinite' : undefined }} />
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color, fontWeight: 700 }}>{agent}</span>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', color: status === 'done' ? 'rgba(16,185,129,0.7)' : 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>{status}</span>
                        </div>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.64rem', color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{note}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Verdict banner */}
                <div style={{ margin: '0 16px 16px', padding: '14px 18px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'rgba(16,185,129,0.6)', letterSpacing: '0.1em', marginBottom: 4 }}>FINAL VERDICT</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 400, color: '#10b981', letterSpacing: '-0.03em', textShadow: '0 0 20px rgba(16,185,129,0.4)' }}>✓ Supported</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)', marginBottom: 4 }}>CONFIDENCE</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.2rem', color: '#10b981', fontWeight: 700 }}>97%</div>
                  </div>
                </div>

                {/* Evidence link */}
                <div style={{ padding: '0 16px 18px' }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.64rem', color: 'rgba(255,255,255,0.15)', padding: '8px 14px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: 'rgba(157,107,255,0.5)' }}>◈</span>
                    <span>cache/config.py:L18 — <span style={{ color: 'rgba(157,107,255,0.6)' }}>SESSION_TTL = 86400</span></span>
                  </div>
                </div>
              </div>

              {/* Floating proof ID badge */}
              <div style={{ position: 'absolute', top: -14, right: 20, background: '#0d0d1f', border: '1px solid rgba(157,107,255,0.25)', borderRadius: 20, padding: '5px 14px', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#9d6bff', boxShadow: '0 0 6px #9d6bff', display: 'inline-block' }} />
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'rgba(157,107,255,0.7)' }}>proof_id: f9a3c8d1</span>
              </div>
            </div>
          </div>

          {/* ══ BOTTOM FEATURE STRIP ══ */}
          <div style={{ position: 'relative', zIndex: 2, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              { tag: 'ZERO-CONFIG', title: 'Instant setup', desc: 'Drop in your repo URL. Varinth handles the rest — no SDK, no config files.', accent: '#9d6bff', badge: 'repo + URL' },
              { tag: 'PROOF-FIRST', title: 'Evidence required', desc: 'Every verdict is tied to a file path and line range. No citation, no verdict.', accent: '#22d3ee', badge: 'evidence[]' },
              { tag: 'CI-NATIVE', title: 'Pipeline ready', desc: 'Integrates silently into GitHub Actions, GitLab CI, or any REST-compatible runner.', accent: '#10b981', badge: 'exit 0 | 1' },
              { tag: 'MCP-NATIVE', title: 'In your IDE', desc: 'Runs as a native MCP tool inside Claude Desktop and Cursor. No tab switching.', accent: '#f59e0b', badge: 'mcp::verify' },
            ].map(({ tag, title, desc, accent, badge }, i) => (
              <div
                key={i}
                onMouseEnter={() => setActive(true)}
                onMouseLeave={() => setActive(false)}
                style={{
                  padding: '36px 28px',
                  borderRight: i < 3 ? '1px solid rgba(255,255,255,0.04)' : undefined,
                  borderTop: `2px solid ${accent}22`,
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'default',
                  transition: 'border-color 0.3s',
                }}
              >
                {/* Subtle top-left glow */}
                <div style={{ position: 'absolute', top: -30, left: -30, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle, ${accent}12, transparent 70%)`, pointerEvents: 'none' }} />
                {/* Mono tag */}
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', color: accent, letterSpacing: '0.12em', opacity: 0.7, marginBottom: 14, textTransform: 'uppercase' }}>{tag}</div>
                {/* Title */}
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'rgba(230,225,255,0.85)', marginBottom: 10, letterSpacing: '-0.01em' }}>{title}</div>
                {/* Desc */}
                <div style={{ fontSize: '0.78rem', color: 'rgba(157,140,255,0.38)', lineHeight: 1.6, marginBottom: 20 }}>{desc}</div>
                {/* Code badge */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: `${accent}08`, border: `1px solid ${accent}20`, borderRadius: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: accent, opacity: 0.6 }} />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: accent, opacity: 0.7 }}>{badge}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </>
  )
}
