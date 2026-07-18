'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const MANIFEST_FIELDS = [
  {
    key: "proof_id",
    label: "proof_id",
    type: "UUID v4 (String)",
    desc: "A globally unique cryptographic hash identifying this verification run. It acts as the primary index key linking code references and audit outcomes.",
    example: '"f9a3c8d1-72da-4b8c-b632-1a4b41b8a927"'
  },
  {
    key: "timestamp",
    label: "timestamp",
    type: "ISO 8601 UTC Timestamp",
    desc: "The exact date and time the audit swarm finished static codebase logic checks and committed the output signals.",
    example: '"2026-07-17T02:00:26Z"'
  },
  {
    key: "verdict",
    label: "verdict",
    type: "Enum ('supported' | 'contradicted' | 'unverified')",
    desc: "The final verdict computed by the Judge Agent: 'supported' (AST logic matches claim), 'contradicted' (AST logic directly conflicts with claim), or 'unverified' (insufficient code matching).",
    example: '"contradicted"'
  },
  {
    key: "confidence_score",
    label: "confidence_score",
    type: "Float (0.00 to 1.00)",
    desc: "Reflects the mathematical confidence of Verifier heuristic matches and namespace overlaps across codebase files.",
    example: "0.94"
  },
  {
    key: "file",
    label: "evidence.file",
    type: "String (filepath)",
    desc: "The exact workspace-relative path where the target assignment statement, configuration variable, or dependency constant resides.",
    example: '"backend/src/auth/tokens.py"'
  },
  {
    key: "lines",
    label: "evidence.lines",
    type: "Array [start_line, end_line]",
    desc: "The 1-indexed code lines pinpointing where the matching logic block or definition scope exists in the codebase source code.",
    example: "[12, 16]"
  },
  {
    key: "suggested_correction",
    label: "suggested_correction",
    type: "String (patch description)",
    desc: "Grounded code correction patch suggested by the Critic and Judge agents to correct conflicting code when the verdict is contradicted.",
    example: '"Modify JWT_LIFETIME to 30 days to align with security declarations."'
  }
]

export default function ProofSpecPage() {
  const supabase = createClient()
  const [authenticated, setAuthenticated] = useState(false)
  const [hoveredField, setHoveredField] = useState("verdict")

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setAuthenticated(!!user))
  }, [])

  const current = MANIFEST_FIELDS.find(f => f.key === hoveredField) || MANIFEST_FIELDS[2]

  return (
    <div style={{ background: '#0d0510', color: '#f9f5ff', minHeight: '100vh', fontFamily: 'Inter, sans-serif', position: 'relative', overflowX: 'hidden' }}>
      
      {/* Background radial atmosphere */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 1400, height: 800, background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(157,107,255,0.06) 0%, transparent 80%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 52px', height: 60,
        borderBottom: '1px solid rgba(255,100,60,0.07)',
        background: 'rgba(13,5,16,0.85)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '-0.05em', color: '#f9f5ff' }}>
            Varinth<span style={{ color: 'rgba(255,130,90,0.28)' }}>.engine</span>
          </span>
        </Link>

        {/* Center Links */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Link href="/swarm-pipeline" style={{ color: 'rgba(249,220,200,0.45)', fontSize: '0.82rem', textDecoration: 'none', transition: 'color 0.2s' }}>
            Swarm Pipeline
          </Link>
          <Link href="/integration-hub" style={{ color: 'rgba(249,220,200,0.45)', fontSize: '0.82rem', textDecoration: 'none', transition: 'color 0.2s' }}>
            Integration Hub
          </Link>
          <Link href="/proof-spec" style={{ color: '#ff6b45', fontSize: '0.82rem', textDecoration: 'none', fontWeight: 600 }}>
            Proof Spec
          </Link>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {authenticated ? (
            <Link href="/dashboard" style={{ background: '#f9f5ff', color: '#07050a', padding: '7px 20px', borderRadius: 5, fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none' }}>
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

      {/* Main Content */}
      <main style={{ padding: '140px 52px 100px', maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <header style={{ marginBottom: 60, textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--coral)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>
            JSON Schema Specification
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 5vw, 4.2rem)', fontWeight: 400, letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 24 }}>
            The Proof Manifest Specification
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, maxWidth: 580, margin: '0 auto' }}>
            Every audit outputs an immutable JSON payload. Hover over individual fields to explore their structural role, data types, and values.
          </p>
        </header>

        {/* 1. SCHEMA DIAL & TREE PATHWAYS */}
        <section style={{
          background: 'rgba(19,12,28,0.35)',
          border: '1px solid rgba(255,107,69,0.12)',
          borderRadius: 16,
          padding: '24px 40px',
          marginBottom: 48,
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          position: 'relative'
        }}>
          {/* Speedometer dial */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
              <circle cx="40" cy="40" r="30" fill="none" stroke="#ff6b45" strokeWidth="6" strokeDasharray="188.4" strokeDashoffset="40" style={{ filter: 'drop-shadow(0 0 4px #ff6b45)' }} />
              <text x="40" y="46" fill="#fff" fontSize="16" fontWeight="bold" textAnchor="middle" fontFamily="monospace">94%</text>
            </svg>
            <div>
              <span style={{ fontSize: '0.62rem', fontFamily: 'monospace', color: '#ff6b45', textTransform: 'uppercase', display: 'block' }}>METRIC RESOLUTION</span>
              <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>Confidence Weight score</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: hoveredField === 'proof_id' ? '#ff6b45' : 'inherit', fontWeight: hoveredField === 'proof_id' ? 'bold' : 'normal' }}>Proof ID</span>
            <span>→</span>
            <span style={{ color: hoveredField === 'verdict' ? '#ff6b45' : 'inherit', fontWeight: hoveredField === 'verdict' ? 'bold' : 'normal' }}>Verdict</span>
            <span>→</span>
            <span style={{ color: hoveredField === 'file' ? '#ff6b45' : 'inherit', fontWeight: hoveredField === 'file' ? 'bold' : 'normal' }}>Evidence File</span>
          </div>
        </section>

        {/* 2. SPLIT INTERACTIVE JSON SCHEMA VIEW */}
        <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 60, alignItems: 'start' }}>
          
          {/* JSON Explorer panel */}
          <div style={{
            background: '#040409',
            border: '1px solid rgba(157,130,255,0.08)',
            borderRadius: 14,
            padding: 32,
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.78rem',
            lineHeight: 1.8,
            color: 'rgba(255,255,255,0.3)',
            position: 'relative'
          }}>
            <div style={{ position: 'absolute', inset: 0, border: '1px solid rgba(255,107,69,0.12)', borderRadius: 14, pointerEvents: 'none' }} />

            <div>{'{'}</div>
            
            <div style={{ paddingLeft: 20 }}>
              <span
                onMouseEnter={() => setHoveredField("proof_id")}
                style={{ cursor: 'pointer', color: hoveredField === 'proof_id' ? '#ff6b45' : '#8b5cf6', transition: 'color 0.2s', fontWeight: hoveredField === 'proof_id' ? 700 : 400 }}
              >
                "proof_id"
              </span>
              : "f9a3c8d1-72da-4b8c-b632-1a4b41b8a927",
            </div>

            <div style={{ paddingLeft: 20 }}>
              <span
                onMouseEnter={() => setHoveredField("timestamp")}
                style={{ cursor: 'pointer', color: hoveredField === 'timestamp' ? '#ff6b45' : '#8b5cf6', transition: 'color 0.2s', fontWeight: hoveredField === 'timestamp' ? 700 : 400 }}
              >
                "timestamp"
              </span>
              : "2026-07-17T02:00:26Z",
            </div>

            <div style={{ paddingLeft: 20 }}>
              <span
                onMouseEnter={() => setHoveredField("verdict")}
                style={{ cursor: 'pointer', color: hoveredField === 'verdict' ? '#ff6b45' : '#8b5cf6', transition: 'color 0.2s', fontWeight: hoveredField === 'verdict' ? 700 : 400 }}
              >
                "verdict"
              </span>
              : <span style={{ color: '#ff3f5e' }}>"contradicted"</span>,
            </div>

            <div style={{ paddingLeft: 20 }}>
              <span
                onMouseEnter={() => setHoveredField("confidence_score")}
                style={{ cursor: 'pointer', color: hoveredField === 'confidence_score' ? '#ff6b45' : '#8b5cf6', transition: 'color 0.2s', fontWeight: hoveredField === 'confidence_score' ? 700 : 400 }}
              >
                "confidence_score"
              </span>
              : 0.94,
            </div>

            <div style={{ paddingLeft: 20 }}>
              <span>"evidence"</span>: {'{'}
              <div style={{ paddingLeft: 20 }}>
                <span
                  onMouseEnter={() => setHoveredField("file")}
                  style={{ cursor: 'pointer', color: hoveredField === 'file' ? '#ff6b45' : '#8b5cf6', transition: 'color 0.2s', fontWeight: hoveredField === 'file' ? 700 : 400 }}
                >
                  "file"
                </span>
                : "backend/src/auth/tokens.py",
              </div>
              <div style={{ paddingLeft: 20 }}>
                <span
                  onMouseEnter={() => setHoveredField("lines")}
                  style={{ cursor: 'pointer', color: hoveredField === 'lines' ? '#ff6b45' : '#8b5cf6', transition: 'color 0.2s', fontWeight: hoveredField === 'lines' ? 700 : 400 }}
                >
                  "lines"
                </span>
                : [12, 16]
              </div>
              <div>{'}'},</div>
            </div>

            <div style={{ paddingLeft: 20 }}>
              <span
                onMouseEnter={() => setHoveredField("suggested_correction")}
                style={{ cursor: 'pointer', color: hoveredField === 'suggested_correction' ? '#ff6b45' : '#8b5cf6', transition: 'color 0.2s', fontWeight: hoveredField === 'suggested_correction' ? 700 : 400 }}
              >
                "suggested_correction"
              </span>
              : "Modify JWT_LIFETIME to 30 days to align with security declarations."
            </div>

            <div>{'}'}</div>
          </div>

          {/* Explanation Card */}
          <div style={{
            background: 'rgba(19,12,28,0.3)',
            border: '1px solid rgba(157,130,255,0.08)',
            borderRadius: 14,
            padding: 36,
            minHeight: 340,
            boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
            position: 'relative'
          }}>
            <div style={{ position: 'absolute', inset: 0, border: '1px solid rgba(255,107,69,0.12)', borderRadius: 14, pointerEvents: 'none' }} />

            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: '#ff6b45', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              FIELD SPECIFICATION // {current.type}
            </span>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 500, letterSpacing: '-0.03em', marginTop: 18, marginBottom: 16 }}>
              {current.key}
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 30 }}>
              {current.desc}
            </p>

            <div style={{ background: '#040409', border: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: 6 }}>
              <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.3)' }}>SAMPLE VALUE</span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#00dcb8', marginTop: 6 }}>{current.example}</div>
            </div>
          </div>

        </section>

        {/* 3. ADDITIONAL SPEC DATABASE AND ORM MAP DETAILS */}
        <section style={{
          marginTop: 60,
          background: 'rgba(19,12,28,0.2)',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: 16,
          padding: 40
        }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: '#fff', marginBottom: 20 }}>
            Database Integration Schema
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 24 }}>
            The output payload is persisted in the PostgreSQL database. The <code>claims</code> table maps each claim directly to its parent <code>audit_runs</code> record, keeping verification runs synchronized across CI pull requests and dashboard telemetry graphs.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            <div style={{ background: '#040409', padding: 20, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: '#ff6b45', display: 'block', marginBottom: 10 }}>CLAIMS RECORD SCHEMA</span>
              <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                <code>{`Column             Type        Modifiers
------------------ ----------- ---------
claim_id           uuid        primary key
audit_run_id       uuid        foreign key
raw_text           text        not null
verdict            varchar     not null
confidence         numeric     not null
judge_explanation  text        nullable`}</code>
              </pre>
            </div>
            <div style={{ background: '#040409', padding: 20, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: '#00dcb8', display: 'block', marginBottom: 10 }}>EVIDENCE ITEMS SCHEMA</span>
              <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                <code>{`Column             Type        Modifiers
------------------ ----------- ---------
evidence_id        uuid        primary key
claim_id           uuid        foreign key
filepath           text        not null
line_range         integer[]   not null
code_snippet       text        not null
matcher_score      numeric     not null`}</code>
              </pre>
            </div>
          </div>
        </section>
      </main>

    </div>
  )
}
