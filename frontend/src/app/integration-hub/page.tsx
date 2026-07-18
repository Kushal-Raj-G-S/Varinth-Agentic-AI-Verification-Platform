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
    label: "CLI Installation",
    category: "GUIDES",
    title: "Verify assertions in seconds",
    desc: "Connect Varinth directly to your codebase. It doesn't write code or guess answers; it reads code, resolves references, and checks logic with mathematical proofs.",
    codeBlock: "npm install -g @varinth/cli\nvarinth verify --claim \"JWT tokens expire in 30 days\" --dir ./src",
    content: (
      <div>
        <h3 style={{ fontSize: '1rem', color: '#ff6b45', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>1. Install the CLI Globally</h3>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>The command line interface handles parsing, connects directly to Supabase authentication, and runs local audits.</p>
        <pre style={{ background: '#040409', border: '1px solid rgba(255,255,255,0.05)', padding: 16, borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)', marginBottom: 24 }}>
          <code>npm install -g @varinth/cli</code>
        </pre>

        <h3 style={{ fontSize: '1rem', color: '#ff6b45', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>2. Execute Code Verification</h3>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>Run an audit passing the target claim statement, codebase directories, and custom rule configurations.</p>
        <pre style={{ background: '#040409', border: '1px solid rgba(255,255,255,0.05)', padding: 16, borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)', marginBottom: 24 }}>
          <code>varinth verify --claim "JWT tokens expire in 30 days" --dir ./backend/src --rules .varinth/rules.json --verbose</code>
        </pre>

        <h3 style={{ fontSize: '1rem', color: '#ff6b45', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>CLI Parameters reference</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', background: '#040409', padding: 16, borderRadius: 6 }}>
          <div><code>--claim [string]</code> : The exact statement or assertion to test.</div>
          <div><code>--dir [path]</code> : Relative directory path containing target source code files.</div>
          <div><code>--rules [path]</code> : Optional custom JSON file containing AST heuristics and severity boundaries.</div>
          <div><code>--verbose</code> : Emits full compiler warnings and step telemetry logs directly to console.</div>
        </div>
      </div>
    )
  },
  {
    id: "swarm-rules",
    label: "Swarm Rules Spec",
    category: "GUIDES",
    title: "Define AST Verification Rules",
    desc: "Create custom verification rules in your workspace configuration file. Varinth's agents parse these rules and test code strictly against them.",
    codeBlock: "{\n  \"rules\": [\n    {\n      \"id\": \"jwt-expiry-max\",\n      \"name\": \"Maximum JWT Expiry Limit\"\n    }\n  ]\n}",
    content: (
      <div>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>Define validation constraints in <code>.varinth/rules.json</code> at your project root:</p>
        <pre style={{ background: '#040409', border: '1px solid rgba(255,255,255,0.05)', padding: 16, borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)', height: 280, overflowY: 'auto' }}>
          <code>{`{
  "rules": [
    {
      "id": "jwt-expiry-max",
      "name": "Maximum JWT Expiry Limit",
      "severity": "error",
      "files": ["**/auth/*.py", "**/tokens.py"],
      "constraint": "JWT expiry must not exceed 7 days (604800 seconds) in configuration files."
    },
    {
      "id": "parameterized-queries",
      "name": "SQL Injection Prevention",
      "severity": "critical",
      "files": ["**/db/**/*.py"],
      "constraint": "All database execute commands must use query parameters, not string formatting."
    },
    {
      "id": "csrf-protection",
      "name": "Cross-Site Request Forgery Guard",
      "severity": "error",
      "files": ["**/app/main.py", "**/middleware.py"],
      "constraint": "Middlewares must include CSRF tokens matching config keys."
    }
  ]
}`}</code>
        </pre>
      </div>
    )
  },
  {
    id: "mcp-native",
    label: "Claude Desktop",
    category: "INTEGRATIONS",
    title: "Varinth inside Claude Desktop",
    desc: "Run Varinth natively as a Model Context Protocol (MCP) server inside Claude Desktop.",
    codeBlock: "{\n  \"mcpServers\": {\n    \"varinth\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"@varinth/mcp-server\"],\n      \"env\": {\n        \"VARINTH_API_KEY\": \"vt_live_abcdef123456\"\n      }\n    }\n  }\n}",
    content: (
      <div>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>Add the Varinth server to your Claude Desktop configuration file (<code>claude_desktop_config.json</code>):</p>
        <pre style={{ background: '#040409', border: '1px solid rgba(255,255,255,0.05)', padding: 16, borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)', marginBottom: 24 }}>
          <code>{`{
  "mcpServers": {
    "varinth": {
      "command": "npx",
      "args": ["-y", "@varinth/mcp-server"],
      "env": {
        "VARINTH_API_KEY": "vt_live_abcdef123456",
        "VARINTH_WORKSPACE_DIR": "./workspace"
      }
    }
  }
}`}</code>
        </pre>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(0,220,184,0.05)', border: '1px solid rgba(0,220,184,0.15)', borderRadius: 6 }}>
          <span style={{ fontSize: '0.78rem', color: '#00dcb8', fontWeight: 600 }}>Protip:</span>
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>Once loaded, simply ask Claude: \"Check if my token authentication duration is set correctly.\"</span>
        </div>
      </div>
    )
  },
  {
    id: "cursor-integration",
    label: "Cursor IDE",
    category: "INTEGRATIONS",
    title: "Varinth inside Cursor Composer",
    desc: "Enable Varinth inside Cursor to audit codebases contextually in Composer view.",
    codeBlock: "npx -y @varinth/mcp-server --port 3020",
    content: (
      <div>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>Register Varinth in Cursor under Settings &gt; Features &gt; MCP &gt; Add New MCP Server:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, background: '#040409', border: '1px solid rgba(255,255,255,0.04)', padding: 12, borderRadius: 6, fontSize: '0.78rem' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Name:</span>
            <span style={{ color: '#fff', fontWeight: 600 }}>varinth-engine</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Type:</span>
            <span style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>command</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Command:</span>
            <span style={{ color: '#ff6b45', fontFamily: 'var(--font-mono)' }}>npx -y @varinth/mcp-server --port 3020</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: "github-actions",
    label: "GitHub Actions",
    category: "INTEGRATIONS",
    title: "Automate verification in GitHub PRs",
    desc: "Verify claims automatically in every GitHub branch check and fail build steps on logic contradictions.",
    codeBlock: "uses: varinth/actions-audit@v2",
    content: (
      <div>
        <pre style={{ background: '#040409', border: '1px solid rgba(255,255,255,0.05)', padding: 16, borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)' }}>
          <code>{`name: Varinth Verification
on:
  pull_request:
    branches: [ main, dev ]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
      - name: Setup Node Environment
        uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Run Varinth Swarm Audit
        uses: varinth/actions-audit@v2
        with:
          api-key: \${{ secrets.VARINTH_API_KEY }}
          claim: "Session TTL is 24 hours"
          dir: "./src"
          fail-on-contradict: true`}</code>
        </pre>
      </div>
    )
  },
  {
    id: "rest-api",
    label: "REST SDK Reference",
    category: "INTEGRATIONS",
    title: "Trigger Swarms programmatically",
    desc: "Call the Varinth HTTP REST API to audit custom scopes asynchronously.",
    codeBlock: "curl -X POST https://api.varinth.com/v2/audits \\\n  -H \"Authorization: Bearer vt_live_abcdef123456\"",
    content: (
      <div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: '#10b981', border: '1px solid rgba(16,185,129,0.22)', padding: '2px 6px', borderRadius: 3, background: 'rgba(16,185,129,0.06)', display: 'inline-block', marginBottom: 12 }}>POST /v2/audits</span>
        <pre style={{ background: '#040409', border: '1px solid rgba(255,255,255,0.05)', padding: 16, borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)', marginBottom: 24 }}>
          <code>{`curl -X POST https://api.varinth.com/v2/audits \\
  -H "Authorization: Bearer vt_live_abcdef123456" \\
  -H "Content-Type: application/json" \\
  -d '{
    "repository_url": "https://github.com/user/project",
    "branch": "main",
    "claim": "Rate limiting applied at API gateway",
    "max_claims": 10
  }'`}</code>
        </pre>
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
        <Link href="/" style={{ textDecoration: 'none' }}>
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
