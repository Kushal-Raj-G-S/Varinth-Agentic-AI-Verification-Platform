'use client'

import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

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
        transition: 'border-color 0.3s',
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

const INTEGRATION_SECTIONS = [
  {
    id: "getting-started",
    label: "REST API",
    category: "GUIDES",
    title: "Audit an answer in one request",
    desc: "Call the Varinth HTTP API directly. It extracts claims, searches your codebase for evidence, and returns a verdict per claim — no CLI or SDK install required.",
    codeBlock: "curl -X POST http://localhost:8000/api/v1/audits \\\n  -H \"Authorization: Bearer $VARINTH_API_KEY\"",
    content: (
      <div>
        <h3 style={{ fontSize: '1rem', color: '#ff6b45', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>1. Register a source context once</h3>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>Point Varinth at a git repository it should search for evidence (see <code>POST /api/v1/contexts</code>).</p>
        <pre style={{ background: '#040409', border: '1px solid rgba(255,255,255,0.05)', padding: 16, borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)', marginBottom: 24 }}>
          <code>{`curl -X POST http://localhost:8000/api/v1/contexts \\
  -H "Authorization: Bearer $VARINTH_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Repo",
    "slug": "my-repo",
    "root_path": "https://github.com/you/your-repo.git"
  }'`}</code>
        </pre>

        <h3 style={{ fontSize: '1rem', color: '#ff6b45', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>2. Submit the audit</h3>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>Pass the question that was asked, the AI's answer, and which registered context to check it against.</p>
        <pre style={{ background: '#040409', border: '1px solid rgba(255,255,255,0.05)', padding: 16, borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)', marginBottom: 24 }}>
          <code>{`curl -X POST http://localhost:8000/api/v1/audits \\
  -H "Authorization: Bearer $VARINTH_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "question": "How long do JWT sessions last?",
    "answer": "JWT tokens expire after 30 days.",
    "context_slug": "my-repo",
    "max_claims": 10
  }'`}</code>
        </pre>

        <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
          $VARINTH_API_KEY comes from <a href="/settings" style={{ color: '#ff6b45' }}>Settings → API Keys</a>. The response includes a verdict, confidence, and cited file/line evidence for each extracted claim.
        </p>
      </div>
    )
  },
  {
    id: "verdict-rules",
    label: "Verdict Rules",
    category: "GUIDES",
    title: "How a verdict is actually decided",
    desc: "Verdicts are never decided by an LLM — a deterministic rule engine assigns them from scored, LLM-annotated evidence, so every verdict is auditable and reproducible.",
    codeBlock: "SUPPORT_THRESHOLD = 0.5\nCONTRADICT_THRESHOLD = 0.5",
    content: (
      <div>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>
          The Critic and Verifier agents annotate each evidence snippet with a relevance score and <code>supports_claim</code> / <code>contradicts_claim</code> flags. From there, a plain Python rule engine — not an LLM — decides the verdict:
        </p>
        <pre style={{ background: '#040409', border: '1px solid rgba(255,255,255,0.05)', padding: 16, borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)', height: 220, overflowY: 'auto' }}>
          <code>{`supported    — at least one evidence item with
               relevance_score >= 0.5 AND supports_claim

contradicted — at least one evidence item with
               relevance_score >= 0.5 AND contradicts_claim,
               AND a literal claim keyword appears in the
               snippet (guards against false-positive
               contradictions from topically adjacent code)

unverified   — everything else (no evidence, or evidence
               too weak to clear either threshold)`}</code>
        </pre>
        <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginTop: 16 }}>
          A hard invariant in the engine makes it impossible to emit <code>supported</code> with zero attached evidence — that path raises rather than silently passing.
        </p>
      </div>
    )
  },
  {
    id: "mcp-native",
    label: "Claude Desktop",
    category: "INTEGRATIONS",
    title: "Varinth inside Claude Desktop",
    desc: "Run Varinth natively as a Model Context Protocol (MCP) server inside Claude Desktop — the varinth_verify and varinth_compare tools run locally over stdio.",
    codeBlock: "{\n  \"mcpServers\": {\n    \"varinth\": {\n      \"command\": \"python\",\n      \"args\": [\"-m\", \"app.mcp_server\"]\n    }\n  }\n}",
    content: (
      <div>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>Add the Varinth server to your Claude Desktop configuration file (<code>claude_desktop_config.json</code>). It runs your own local clone of <code>backend/</code> — there's no hosted MCP endpoint:</p>
        <pre style={{ background: '#040409', border: '1px solid rgba(255,255,255,0.05)', padding: 16, borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)', marginBottom: 24 }}>
          <code>{`{
  "mcpServers": {
    "varinth": {
      "command": "python",
      "args": ["-m", "app.mcp_server"],
      "cwd": "/absolute/path/to/varinth/backend",
      "env": {
        "SUPABASE_URL": "...",
        "SUPABASE_SERVICE_ROLE_KEY": "...",
        "NVIDIA_API_KEY": "..."
      }
    }
  }
}`}</code>
        </pre>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(0,220,184,0.05)', border: '1px solid rgba(0,220,184,0.15)', borderRadius: 6 }}>
          <span style={{ fontSize: '0.78rem', color: '#00dcb8', fontWeight: 600 }}>Protip:</span>
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>Full template with every env var: <code>mcp_settings.example.json</code> at the repo root. Once loaded, ask Claude: "Verify that session TTL is 24 hours against ./my-project."</span>
        </div>
      </div>
    )
  },
  {
    id: "cursor-integration",
    label: "Cursor IDE",
    category: "INTEGRATIONS",
    title: "Varinth inside Cursor Composer",
    desc: "The same MCP server works in Cursor — it isn't a Claude Desktop-only protocol.",
    codeBlock: "python -m app.mcp_server",
    content: (
      <div>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>Register Varinth in Cursor under Settings &gt; Features &gt; MCP &gt; Add New MCP Server, using a stdio command (not a port) — same as the Claude Desktop config:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, background: '#040409', border: '1px solid rgba(255,255,255,0.04)', padding: 12, borderRadius: 6, fontSize: '0.78rem' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Name:</span>
            <span style={{ color: '#fff', fontWeight: 600 }}>varinth</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Type:</span>
            <span style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>command</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Command:</span>
            <span style={{ color: '#ff6b45', fontFamily: 'var(--font-mono)' }}>python -m app.mcp_server</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Working dir:</span>
            <span style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>/absolute/path/to/varinth/backend</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: "github-actions",
    label: "GitHub Actions",
    category: "INTEGRATIONS",
    title: "Varinth audits every pull request",
    desc: "Audits a PR's title and description against the real code at its head commit, and posts the verdict as a PR comment — updated in place on every push, no separate dashboard required.",
    codeBlock: "python3 varinth_pr_audit.py",
    content: (
      <div>
        <h3 style={{ fontSize: '1rem', color: '#ff6b45', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>1. Generate an API key</h3>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>
          From <a href="/settings" style={{ color: '#ff6b45' }}>Settings → API Keys</a>, create a key for CI use — it's shown once, so copy it immediately.
        </p>

        <h3 style={{ fontSize: '1rem', color: '#ff6b45', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>2. Add two repository secrets</h3>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>
          In the target repo's <code>Settings → Secrets and variables → Actions</code>: <code>VARINTH_API_URL</code> (your backend's base URL) and <code>VARINTH_API_KEY</code> (the key from step 1).
        </p>

        <h3 style={{ fontSize: '1rem', color: '#ff6b45', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>3. Copy the workflow file</h3>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>
          This is the actual workflow Varinth ships and runs on itself — copy it as-is into <code>.github/workflows/</code>. It fetches the audit script fresh from Varinth's repo on every run, so there's nothing else to install.
        </p>
        <pre style={{ background: '#040409', border: '1px solid rgba(255,255,255,0.05)', padding: 16, borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)', marginBottom: 24, overflowX: 'auto' }}>
          <code>{`name: Varinth PR Audit
on:
  pull_request:
    types: [opened, synchronize, reopened, edited]
permissions:
  pull-requests: write
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          repository: Kushal-Raj-G-S/Varinth-Agentic-AI-Verification-Platform
          sparse-checkout: integrations/github-action/varinth_pr_audit.py
          sparse-checkout-cone-mode: false
          path: .varinth-action
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: python3 .varinth-action/integrations/github-action/varinth_pr_audit.py
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          VARINTH_API_URL: \${{ secrets.VARINTH_API_URL }}
          VARINTH_API_KEY: \${{ secrets.VARINTH_API_KEY }}`}</code>
        </pre>

        <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
          Full setup, private-repo notes, and the <code>VARINTH_FAIL_ON_CONTRADICTION</code> switch to block merges on a contradicted claim: see{' '}
          <a href="https://github.com/Kushal-Raj-G-S/Varinth-Agentic-AI-Verification-Platform/tree/main/integrations/github-action" target="_blank" rel="noreferrer" style={{ color: '#ff6b45' }}>
            integrations/github-action/README.md
          </a>.
        </p>
      </div>
    )
  },
  {
    id: "rest-api",
    label: "Auditing a PR commit",
    category: "INTEGRATIONS",
    title: "Pin an audit to a specific commit",
    desc: "Pass a ref alongside context_slug to check a claim against a branch, tag, or commit SHA instead of the context's default branch — what the GitHub Action uses to audit a PR's actual head commit.",
    codeBlock: "curl -X POST http://localhost:8000/api/v1/audits \\\n  -d '{ ..., \"ref\": \"a1b2c3d\" }'",
    content: (
      <div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: '#10b981', border: '1px solid rgba(16,185,129,0.22)', padding: '2px 6px', borderRadius: 3, background: 'rgba(16,185,129,0.06)', display: 'inline-block', marginBottom: 12 }}>POST /api/v1/audits</span>
        <pre style={{ background: '#040409', border: '1px solid rgba(255,255,255,0.05)', padding: 16, borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)', marginBottom: 24 }}>
          <code>{`curl -X POST http://localhost:8000/api/v1/audits \\
  -H "Authorization: Bearer $VARINTH_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "question": "Does this PR add rate limiting to login?",
    "answer": "Yes — 10 requests/min per user via check_rate_limit.",
    "context_slug": "my-repo",
    "ref": "a1b2c3d4e5f6",
    "max_claims": 10
  }'`}</code>
        </pre>
        <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
          This is exactly how the "GitHub Actions" integration (see the sidebar) audits a pull request against its real diff instead of whatever's already on <code>main</code>.
        </p>
      </div>
    )
  }
]

export default function IntegrationHubPage() {
  const supabase = createClient()
  const [authenticated, setAuthenticated] = useState(false)
  const [activeSection, setActiveSection] = useState("getting-started")
  const [copied, setCopied] = useState(false)

  // Live Swarm Simulator variables
  const [typedClaim, setTypedClaim] = useState("session lifetime is 24 hours")
  const [logs, setLogs] = useState<string[]>([])
  const [isSimulating, setIsSimulating] = useState(false)
  const [simVerdict, setSimVerdict] = useState<"supported" | "contradicted" | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setAuthenticated(!!user))
  }, [])

  const current = INTEGRATION_SECTIONS.find(s => s.id === activeSection) || INTEGRATION_SECTIONS[0]

  const handleCopy = () => {
    navigator.clipboard.writeText(current.codeBlock)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const triggerLiveAudit = () => {
    setIsSimulating(true)
    setSimVerdict(null)
    setLogs(["[INIT] Connecting to codebase..."])
    
    const steps = [
      { t: 600, log: "[EXTRACT] Isolated assertion: 'session TTL = 24h'" },
      { t: 1200, log: "[CRITIC] Scanning AST scopes in config files..." },
      { t: 1800, log: "[VERIFIER] Running AST checkers..." },
      { t: 2400, log: "[JUDGE] Compiling final verification proof manifest..." }
    ]

    steps.forEach(s => {
      setTimeout(() => {
        setLogs(prev => [...prev, s.log])
      }, s.t)
    })

    setTimeout(() => {
      setSimVerdict("supported")
      setIsSimulating(false)
    }, 3200)
  }

  return (
    <div style={{ background: '#07020a', color: '#f9f5ff', minHeight: '100vh', fontFamily: 'Inter, sans-serif', position: 'relative', overflowX: 'hidden' }}>
      
      {/* Background atmospheric graphics */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 1400, height: 800, background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,220,184,0.06) 0%, transparent 80%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 52px', height: 60,
        borderBottom: '1px solid rgba(255,100,60,0.07)',
        background: 'rgba(7,2,10,0.85)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="Varinth Logo" style={{ width: 34, height: 34, objectFit: 'contain' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '-0.05em', color: '#f9f5ff' }}>
            Varinth<span style={{ color: 'rgba(255,130,90,0.28)' }}>.engine</span>
          </span>
        </Link>

        {/* Navigation Menu Links */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Link href="/swarm-pipeline" style={{ color: 'rgba(249,220,200,0.45)', fontSize: '0.82rem', textDecoration: 'none', transition: 'color 0.2s' }}>
            Swarm Pipeline
          </Link>
          <Link href="/integration-hub" style={{ color: '#ff6b45', fontSize: '0.82rem', textDecoration: 'none', fontWeight: 600 }}>
            Integration Hub
          </Link>
          <Link href="/proof-spec" style={{ color: 'rgba(249,220,200,0.45)', fontSize: '0.82rem', textDecoration: 'none', transition: 'color 0.2s' }}>
            Proof Spec
          </Link>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {authenticated ? (
            <Link href="/dashboard" style={{ background: '#f9f5ff', color: '#07020a', padding: '7px 20px', borderRadius: 5, fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none' }}>
              Dashboard →
            </Link>
          ) : (
            <>
              <Link href="/login" style={{ color: 'rgba(249,220,200,0.38)', padding: '7px 14px', fontSize: '0.82rem', textDecoration: 'none' }}>
                Sign in
              </Link>
              <Link href="/signup" style={{ background: '#ff6b45', color: '#fff', padding: '7px 20px', borderRadius: 5, fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none', boxShadow: '0 0 20px rgba(255,107,69,0.3)' }}>
                Get started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Main layout container */}
      <main style={{ padding: '140px 52px 100px', maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        
        {/* INTERACTIVE CONNECTIONS TOPOLOGY SHOWCASE */}
        <section style={{
          background: 'rgba(19,12,28,0.35)',
          border: '1px solid rgba(0,220,184,0.12)',
          borderRadius: 16,
          padding: '30px 48px',
          marginBottom: 60,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflow: 'hidden'
        }}>
          {/* Animated SVG connecting hubs */}
          <svg width="800" height="80" viewBox="0 0 800 80">
            <defs>
              <linearGradient id="hubGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff7a52" stopOpacity="0.2" />
                <stop offset="50%" stopColor="#00dcb8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            {/* Core network lines */}
            <path d="M 100,40 Q 250,10 400,40 T 700,40" fill="none" stroke="url(#hubGrad)" strokeWidth="2.5" />
            
            {/* Nodes */}
            <circle cx="100" cy="40" r="10" fill="#ff7a52" />
            <text x="100" y="65" fill="rgba(255,255,255,0.4)" fontSize="10" textAnchor="middle">CLI Client</text>

            <circle cx="400" cy="40" r="14" fill="#00dcb8" style={{ filter: 'drop-shadow(0 0 8px #00dcb8)' }} />
            <text x="400" y="67" fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">Varinth.engine</text>

            <circle cx="700" cy="40" r="10" fill="#8b5cf6" />
            <text x="700" y="65" fill="rgba(255,255,255,0.4)" fontSize="10" textAnchor="middle">IDE / CI Hub</text>

            {/* Traveler pulses */}
            <circle r="4" fill="#ff6b45">
              <animateMotion dur="4s" repeatCount="indefinite" path="M 100,40 Q 250,10 400,40" />
            </circle>
            <circle r="4" fill="#8b5cf6">
              <animateMotion dur="4s" repeatCount="indefinite" path="M 700,40 Q 550,70 400,40" />
            </circle>
          </svg>
        </section>

        {/* Split grid for sidebar + content */}
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 60, alignItems: 'start' }}>
          
          {/* Left Sidebar */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div>
              <div style={{ fontSize: '0.58rem', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
                Integration Guides
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {INTEGRATION_SECTIONS.filter(s => s.category === "GUIDES").map(s => {
                  const active = s.id === activeSection
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActiveSection(s.id)}
                      style={{
                        background: active ? 'rgba(255,107,69,0.06)' : 'none',
                        border: 'none',
                        borderLeft: `2px solid ${active ? '#ff6b45' : 'transparent'}`,
                        color: active ? '#fff' : 'rgba(255,255,255,0.4)',
                        padding: '8px 12px',
                        fontSize: '0.82rem',
                        fontWeight: active ? 600 : 400,
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderRadius: '0 4px 4px 0',
                        transition: 'all 0.2s'
                      }}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.58rem', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
                IDE & CI Pipelines
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {INTEGRATION_SECTIONS.filter(s => s.category === "INTEGRATIONS").map(s => {
                  const active = s.id === activeSection
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActiveSection(s.id)}
                      style={{
                        background: active ? 'rgba(0,220,184,0.06)' : 'none',
                        border: 'none',
                        borderLeft: `2px solid ${active ? '#00dcb8' : 'transparent'}`,
                        color: active ? '#fff' : 'rgba(255,255,255,0.4)',
                        padding: '8px 12px',
                        fontSize: '0.82rem',
                        fontWeight: active ? 600 : 400,
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderRadius: '0 4px 4px 0',
                        transition: 'all 0.2s'
                      }}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Interactive Swarm Simulator Console */}
            <div style={{
              background: 'rgba(19,12,28,0.3)',
              border: '1px solid rgba(0,220,184,0.12)',
              borderRadius: 12,
              padding: 18,
              position: 'relative'
            }}>
              <div style={{ fontSize: '0.58rem', fontFamily: 'var(--font-mono)', color: '#00dcb8', marginBottom: 8, letterSpacing: '0.05em' }}>
                SWARM SIMULATOR
              </div>
              <input
                type="text"
                value={typedClaim}
                onChange={(e) => setTypedClaim(e.target.value)}
                style={{
                  width: '100%',
                  background: '#040409',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 5,
                  padding: '6px 10px',
                  fontSize: '0.72rem',
                  color: '#fff',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  marginBottom: 10
                }}
              />
              <button
                onClick={triggerLiveAudit}
                disabled={isSimulating}
                style={{
                  width: '100%',
                  background: isSimulating ? 'rgba(255,255,255,0.05)' : '#00dcb8',
                  border: 'none',
                  borderRadius: 5,
                  color: isSimulating ? 'rgba(255,255,255,0.2)' : '#000',
                  padding: '8px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: isSimulating ? 'default' : 'pointer',
                  transition: 'background 0.3s',
                  marginBottom: 12
                }}
              >
                {isSimulating ? "Auditing AST..." : "Trigger Code Check"}
              </button>

              {/* Logs Output */}
              {logs.length > 0 && (
                <div style={{
                  background: '#040409',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.04)',
                  padding: 10,
                  maxHeight: 140,
                  overflowY: 'auto',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.62rem',
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1.5,
                  textAlign: 'left'
                }}>
                  {logs.map((log, li) => <div key={li} style={{ marginBottom: 4 }}>{log}</div>)}
                  {simVerdict && (
                    <div style={{ marginTop: 8, color: '#00dcb8', fontWeight: 'bold' }}>
                      ✓ SWARM VERDICT: {simVerdict.toUpperCase()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* Right Main Content Panel */}
          <HoverGlowCard
            accent={current.category === 'GUIDES' ? '#ff6b45' : '#00dcb8'}
            style={{
              background: 'rgba(19,12,28,0.3)',
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: 16,
              padding: 48,
              minHeight: 520,
              boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
              position: 'relative'
            }}
          >
            {/* Top Right Copy action */}
            <button
              onClick={handleCopy}
              style={{
                position: 'absolute',
                top: 48,
                right: 48,
                background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 6,
                color: copied ? '#10b981' : 'rgba(255,255,255,0.5)',
                padding: '6px 12px',
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                outline: 'none',
                zIndex: 10
              }}
            >
              {copied ? "✓ COPIED" : "COPY CODE"}
            </button>

            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: current.category === 'GUIDES' ? '#ff6b45' : '#00dcb8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {current.category} // {current.id.toUpperCase()}
            </span>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 500, letterSpacing: '-0.04em', marginTop: 18, marginBottom: 12 }}>
              {current.title}
            </h1>
            <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.68, marginBottom: 36, maxWidth: 620 }}>
              {current.desc}
            </p>

            <hr style={{ border: 'none', height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 36 }} />

            {current.content}
          </HoverGlowCard>

        </div>
      </main>

    </div>
  )
}
