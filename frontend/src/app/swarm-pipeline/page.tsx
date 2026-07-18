'use client'

import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const PIPELINE_STEPS = [
  {
    step: "01",
    name: "Claim Extraction",
    role: "Semantic Parser Agent",
    accent: "#ff7a52",
    title: "Semantic Deconstruction & Token Parsing",
    desc: "When Varinth receives an AI-generated answer, docstring, or PR summary, the Semantic Parser isolates technical claims. It removes natural language fillers and compiles claims into testable JSON boundaries specifying target files, variable names, and logic constraints.",
    specification: [
      "Input Payload: Unstructured markdown or raw text blocks containing engineering claims.",
      "Parsing Pipeline: Natural language token parsing -> AST namespace extraction -> Constraint compilation.",
      "Output Format: Extracted Claim Target Object containing 'claim_id', 'target_pattern', 'variable_scope', and 'constraint_value'.",
      "Namespace Matching: Leverages semantic vector search against index symbols to pinpoint target scopes."
    ],
    code: `[VARINTH EXTRACTOR - v2.4.1] Initializing extraction engine...
> Context source: pull_request_body_12
> Scanning text blocks for logical assertions...
  - Isolated Claim #1: "JWT lifetime is set to 30 days"
  - Target Path Filter: "**/auth/tokens.py"
  - Symbol Scope Match: "JWT_LIFETIME" | "EXPIRY_TIME_LIMIT"
  - Logic Constraint: "days == 30"
✓ Successfully compiled 1 formal claim targets.
✓ Emitted target spec to extracted_claims.json`
  },
  {
    step: "02",
    name: "Swarm Criticism",
    role: "AST Critic Agent",
    accent: "#22d3ee",
    title: "Abstract Syntax Tree & Import Analysis",
    desc: "The Critic Agent performs initial static scans on targets. It constructs the AST (Abstract Syntax Tree), resolves imports, maps variable assignments, and identifies naming variations or codebase anomalies before verification.",
    specification: [
      "Target Directory: Configured workspace codebase paths (default: ./src).",
      "Analysis Methods: AST traversal, lexical token parsing, and import map resolution.",
      "Anomalies Checked: Deprecated variable names, function renames, namespace overrides, and configuration drift.",
      "Scratchpad Sandbox: Generates critique files detailing resolved imports and constant scopes."
    ],
    code: `[CRITIC SWARM - v2.4.1] Starting target code analysis...
> Codebase Root: ./backend/src
> Loading AST configurations for backend/src/auth/tokens.py...
  - Traversing AST Nodes (Module -> Assign)
  - Resolved variable symbol: JWT_LIFETIME
  - Value assignment node: datetime.timedelta(days=7)
  - Found imported dependencies: datetime, tokens_config
! Discrepancy logged: Claim asserts 30 days, codebase defines 7 days.`
  },
  {
    step: "03",
    name: "Rule Verification",
    role: "Heuristic Verifier",
    accent: "#8b5cf6",
    title: "Executing AST Constraints & Checkers",
    desc: "The Verifier runs verification rules and maps Critic notes to boolean signals. It checks variable values, configuration flags, and functions against constraints to produce reports.",
    specification: [
      "Verification Schema: Heuristic checks mapped against workspace constraints (.varinth/rules.json).",
      "Rule Execution: AST parsing and pattern checking on targeted values.",
      "Verdict Outputs: Supported (passes logical checks) or Contradicted (violates constraints).",
      "Telemetry Logs: Collects lines of code, matching strings, and absolute confidence indexes."
    ],
    code: `[VERIFIER RUNNER - v2.4.1] Running verification checks...
> Loading active rules from workspace: rule_jwt_duration_limits
> Target AST Node: Assignment (JWT_LIFETIME)
  - Constraint Check: "JWT_LIFETIME.days == 30"
  - Codebase Value: 7
  - Match Status: FAIL
> Verdict Signal: contradictions_claim = TRUE
> Confidence Weight: 0.96 (exact value match mismatch)`
  },
  {
    step: "04",
    name: "Verdict Judgment",
    role: "Consolidated Judge",
    accent: "#10b981",
    title: "Proof Manifest Assembly & Grounded Fixes",
    desc: "The Judge collects signals, checks cache indexes, and compiles the final Proof Manifest. If a claim is contradicted, the Judge writes a grounded code correction suggestion mapping directly to the file coordinates.",
    specification: [
      "Verdict Resolution: Aggregates signals from all verifiers and resolves final status.",
      "Trust Index: Calculates score based on verification results and confidence weights.",
      "Grounded Correction: Creates patch details (file name, line number, current code, target patch).",
      "Proof Payload: Emits immutable JSON manifest containing evidence items and verification logs."
    ],
    code: `[JUDGE ENGINE - v2.4.1] Assembling final proof manifest...
> Audit ID: f9a3c8d1-72da-4b8c-b632-1a4b41b8a927
> Consolidated Status: CONTRADICTED
> Primary Reference: backend/src/auth/tokens.py:L14
  Line 14: JWT_LIFETIME = datetime.timedelta(days=7)
> Correction Patch:
  - File: backend/src/auth/tokens.py
  - Target Line: 14
  - Current: JWT_LIFETIME = datetime.timedelta(days=7)
  - Suggestion: JWT_LIFETIME = datetime.timedelta(days=30)`
  }
]

export default function SwarmPipelinePage() {
  const supabase = createClient()
  const [authenticated, setAuthenticated] = useState(false)
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setAuthenticated(!!user))
  }, [])

  const stepColor = PIPELINE_STEPS[activeStep].accent

  return (
    <div style={{ background: '#07020a', color: '#f9f5ff', minHeight: '100vh', fontFamily: 'Inter, sans-serif', position: 'relative', overflowX: 'hidden' }}>
      
      {/* Background decoration */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 1400, height: 800, background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(157,107,255,0.07) 0%, transparent 80%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'radial-gradient(rgba(157,107,255,0.03) 1px, transparent 1px)',
        backgroundSize: '28px 28px'
      }} />

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

        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Link href="/swarm-pipeline" style={{ color: '#ff6b45', fontSize: '0.82rem', textDecoration: 'none', fontWeight: 600 }}>
            Swarm Pipeline
          </Link>
          <Link href="/integration-hub" style={{ color: 'rgba(249,220,200,0.45)', fontSize: '0.82rem', textDecoration: 'none', transition: 'color 0.2s' }}>
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

      {/* Content Container */}
      <main style={{ padding: '140px 52px 100px', maxWidth: 1240, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <header style={{ marginBottom: 60, textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--coral)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>
            Swarm Orchestration Trace
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 5vw, 4.4rem)', fontWeight: 400, letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 24 }}>
            Visual Swarm Execution Pipeline
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, maxWidth: 680, margin: '0 auto' }}>
            A formal trace of how Varinth isolates claims, checks AST structures, maps custom verification rules, and emits cryptographic proofs.
          </p>
        </header>

        {/* 1. VISUAL PIPELINE MAP */}
        <section style={{
          background: 'rgba(19,12,28,0.35)',
          border: '1px solid rgba(255,100,60,0.06)',
          borderRadius: 16,
          padding: '40px',
          marginBottom: 48,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          {/* SVG Map representing node channels with animated travelers */}
          <svg width="700" height="120" viewBox="0 0 700 120" style={{ position: 'relative', zIndex: 2 }}>
            <defs>
              <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff7a52" />
                <stop offset="33%" stopColor="#22d3ee" />
                <stop offset="66%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>

            {/* Connecting paths */}
            <path id="flow-line" d="M 80,60 H 620" stroke="url(#glowGrad)" strokeWidth="3" opacity="0.25" />
            
            {/* Animated traveler pulse */}
            <circle r="6" fill={stepColor} style={{ transition: 'fill 0.4s, filter 0.4s', filter: `drop-shadow(0 0 8px ${stepColor})` }}>
              <animateMotion dur="5s" repeatCount="indefinite" path="M 80,60 H 620" />
            </circle>

            {/* Step circles */}
            {PIPELINE_STEPS.map((s, idx) => {
              const active = idx === activeStep
              const cx = 80 + idx * 180
              return (
                <g key={s.step} onClick={() => setActiveStep(idx)} style={{ cursor: 'pointer' }}>
                  {active && (
                    <circle cx={cx} cy="60" r="28" fill="none" stroke={s.accent} strokeWidth="1.5" opacity="0.5">
                      <animate attributeName="r" values="24;36;24" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle cx={cx} cy="60" r="18" fill={active ? s.accent : '#151020'} stroke={active ? s.accent : 'rgba(255,255,255,0.1)'} strokeWidth="2" style={{ transition: 'all 0.3s' }} />
                  <text x={cx} y="64" fill={active ? '#000' : 'rgba(255,255,255,0.4)'} fontSize="11" fontWeight="bold" textAnchor="middle" style={{ transition: 'fill 0.3s', fontFamily: 'monospace' }}>
                    {s.step}
                  </text>
                  <text x={cx} y="100" fill={active ? '#fff' : 'rgba(255,255,255,0.3)'} fontSize="10" fontWeight={active ? 'bold' : 'normal'} textAnchor="middle" style={{ transition: 'fill 0.3s' }}>
                    {s.name}
                  </text>
                </g>
              )
            })}
          </svg>
        </section>

        {/* 2. SPECIFICATION DETAILS GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 60, alignItems: 'start' }}>
          
          {/* Left panel: Detailed documentation spec */}
          <div style={{ background: 'rgba(19,12,28,0.2)', border: '1px solid rgba(255,255,255,0.04)', padding: 36, borderRadius: 14, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 12, left: 12, width: 12, height: 12, borderTop: `2px solid ${stepColor}`, borderLeft: `2px solid ${stepColor}`, transition: 'border-color 0.4s' }} />
            <div style={{ position: 'absolute', top: 12, right: 12, width: 12, height: 12, borderTop: `2px solid ${stepColor}`, borderRight: `2px solid ${stepColor}`, transition: 'border-color 0.4s' }} />
            <div style={{ position: 'absolute', bottom: 12, left: 12, width: 12, height: 12, borderBottom: `2px solid ${stepColor}`, borderLeft: `2px solid ${stepColor}`, transition: 'border-color 0.4s' }} />
            <div style={{ position: 'absolute', bottom: 12, right: 12, width: 12, height: 12, borderBottom: `2px solid ${stepColor}`, borderRight: `2px solid ${stepColor}`, transition: 'border-color 0.4s' }} />

            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: stepColor, border: `1px solid ${stepColor}33`, padding: '4px 10px', borderRadius: 4, background: `${stepColor}0d`, letterSpacing: '0.08em', fontWeight: 600 }}>
              AGENT IDENTITY: {PIPELINE_STEPS[activeStep].role.toUpperCase()}
            </span>

            <h2 style={{ fontSize: '2rem', fontWeight: 500, letterSpacing: '-0.03em', marginTop: 24, marginBottom: 16, color: '#fff' }}>
              {PIPELINE_STEPS[activeStep].title}
            </h2>
            
            <p style={{ fontSize: '0.88rem', color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 28 }}>
              {PIPELINE_STEPS[activeStep].desc}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: stepColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                TECHNICAL SPECIFICATIONS
              </span>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PIPELINE_STEPS[activeStep].specification.map((spec, i) => (
                  <li key={i}>{spec}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right panel: Active Console Code Terminal */}
          <div style={{
            background: '#030105',
            border: '1px solid rgba(255,100,60,0.08)',
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: 2,
              background: `linear-gradient(90deg, transparent, ${stepColor}, transparent)`,
              animation: 'sonarSweep 4s linear infinite',
              zIndex: 3
            }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 18px', background: '#0b040e', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              {['#ff5f56', '#ffbd2e', '#27c93f'].map((c, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c, opacity: 0.8 }} />)}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>console_output</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: stepColor }}>{PIPELINE_STEPS[activeStep].role}</span>
            </div>

            <pre style={{
              margin: 0, padding: 22,
              fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#ffeadb',
              lineHeight: 1.8, overflowX: 'auto', textAlign: 'left',
              background: '#040409'
            }}>
              <code>{PIPELINE_STEPS[activeStep].code}</code>
            </pre>
          </div>

        </div>

      </main>

      <style jsx global>{`
        @keyframes sonarSweep {
          0% { transform: translateY(0); opacity: 0.1; }
          50% { opacity: 0.8; }
          100% { transform: translateY(320px); opacity: 0.1; }
        }
      `}</style>

    </div>
  )
}
