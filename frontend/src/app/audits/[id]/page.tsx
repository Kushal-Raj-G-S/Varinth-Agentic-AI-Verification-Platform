'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { createClient } from '@/lib/supabase/client';
import { AuditRun } from '@/types/audit';
import { buildGithubPermalink, normalizeRepoUrl } from '@/lib/audits/buildGithubPermalink';

// Import V1 presentation blocks
import { AuditStatusBanner } from '@/components/audits/AuditStatusBanner';
import { InputComparisonPanel } from '@/components/audits/InputComparisonPanel';
import { AuditSkeleton } from '@/components/audits/AuditSkeleton';

// Import high-fidelity mock payloads
import {
  MOCK_SUCCESS_PAYLOAD,
  MOCK_PARTIAL_PAYLOAD,
  MOCK_FAILED_PAYLOAD,
  MOCK_IN_FLIGHT_PAYLOAD,
  MOCK_EMPTY_PAYLOAD,
} from '@/mocks/auditPayload';

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

export default function AuditDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const auditRunId = params.id as string;

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditRun | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Resolves repoUrl context safely
  const [repoUrl, setRepoUrl] = useState<string>('');

  // Accordion state tracker for claims list
  const [openClaims, setOpenClaims] = useState<Record<string, boolean>>({});

  // Show all evidence items tracker per claim
  const [showAllEvidence, setShowAllEvidence] = useState<Record<string, boolean>>({});

  const toggleClaim = (claimId: string) => {
    setOpenClaims((prev) => ({ ...prev, [claimId]: !prev[claimId] }));
  };

  const toggleShowAllEvidence = (claimId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAllEvidence((prev) => ({ ...prev, [claimId]: !prev[claimId] }));
  };

  const fetchAuditData = async (isFirstFetch = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setEmail(user.email || '');

      // Check mock route triggers
      if (auditRunId === 'mock-success') {
        setAudit(MOCK_SUCCESS_PAYLOAD);
        setRepoUrl('https://github.com/fly-apps/python-fastapi-hello');
        setLoading(false);
        return;
      }
      if (auditRunId === 'mock-partial') {
        setAudit(MOCK_PARTIAL_PAYLOAD);
        setRepoUrl('https://github.com/fly-apps/python-fastapi-hello');
        setLoading(false);
        return;
      }
      if (auditRunId === 'mock-failed') {
        setAudit(MOCK_FAILED_PAYLOAD);
        setRepoUrl('https://github.com/fly-apps/python-fastapi-hello');
        setLoading(false);
        return;
      }
      if (auditRunId === 'mock-in-flight') {
        setAudit(MOCK_IN_FLIGHT_PAYLOAD);
        setRepoUrl('https://github.com/fly-apps/python-fastapi-hello');
        setLoading(false);
        return;
      }
      if (auditRunId === 'mock-empty') {
        setAudit(MOCK_EMPTY_PAYLOAD);
        setRepoUrl('https://github.com/fly-apps/python-fastapi-hello');
        setLoading(false);
        return;
      }

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Session expired.');

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await window.fetch(`${apiUrl}/api/v1/audits/${auditRunId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Audit run details not found.');
      }

      const data: AuditRun = await res.json();
      setAudit(data);

      // Fetch repo URL from context if repoUrl is empty
      if (data.source_context_id) {
        const ctxRes = await supabase
          .from('source_contexts')
          .select('root_path')
          .eq('source_context_id', data.source_context_id)
          .single();
        if (ctxRes.data?.root_path) {
          setRepoUrl(ctxRes.data.root_path);
        }
      }
    } catch (err: any) {
      console.error('fetch_audit_error', err);
      if (isFirstFetch) {
        setError(err.message);
      }
    } finally {
      if (isFirstFetch) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!auditRunId) return;

    fetchAuditData(true);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [auditRunId]);

  // Set up polling dynamic updates for non-terminal pipeline stages
  useEffect(() => {
    if (!audit) return;

    const isNonTerminal = [
      'created',
      'queued',
      'cloning',
      'extracting_claims',
      'retrieving_evidence',
      'verifying',
      'judging',
      'persisting',
    ].includes(audit.status);

    if (isNonTerminal && !auditRunId.startsWith('mock-')) {
      if (!pollTimerRef.current) {
        pollTimerRef.current = setInterval(() => {
          fetchAuditData(false);
        }, 2000);
      }
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }
  }, [audit, auditRunId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <Navbar email={email} />
        <main className="py-8">
          <AuditSkeleton status="cloning" />
        </main>
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <Navbar email={email} />
        <main className="py-8">
          <div className="max-w-md mx-auto mt-20 text-center space-y-6 px-4">
            <div className="text-4xl text-zinc-600">◎</div>
            <h2 className="text-xl font-bold tracking-tight">Audit Run Not Found</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {error || 'The requested verification sheet could not be located.'}
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded-lg text-sm border border-zinc-800 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  const isNonTerminal = [
    'created',
    'queued',
    'cloning',
    'extracting_claims',
    'retrieving_evidence',
    'verifying',
    'judging',
    'persisting',
  ].includes(audit.status);

  if (isNonTerminal) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <Navbar email={email} />
        <main className="py-8">
          <AuditSkeleton status={audit.status} />
        </main>
      </div>
    );
  }

  // Calculate breakdown counts
  const counts = {
    supported: audit.claims.filter((c) => c.verdict === 'supported').length,
    contradicted: audit.claims.filter((c) => c.verdict === 'contradicted').length,
    unverified: audit.claims.filter((c) => c.verdict === 'unverified').length,
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    fetchAuditData(true);
  };

  const score = audit.global_score !== null ? Math.round(audit.global_score) : null;
  const scoreColor = score === null ? 'var(--text-3)' : score >= 80 ? 'var(--teal)' : score >= 50 ? 'var(--amber)' : 'var(--crimson)';
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = score !== null ? circumference - (score / 100) * circumference : circumference;
  const durationSec = audit.duration_ms ? (audit.duration_ms / 1000).toFixed(2) : null;
  const webRepoUrl = normalizeRepoUrl(repoUrl);

  const statusColors = {
    completed: { text: '#00dcb8', bg: 'rgba(0, 220, 184, 0.07)', border: 'rgba(0, 220, 184, 0.2)' },
    partial: { text: '#ffa833', bg: 'rgba(255, 168, 51, 0.07)', border: 'rgba(255, 168, 51, 0.2)' },
    failed: { text: '#ff3f5e', bg: 'rgba(255, 63, 94, 0.07)', border: 'rgba(255, 63, 94, 0.2)' },
  };
  const activeColor = statusColors[audit.status as keyof typeof statusColors] || { text: '#c8a896', bg: 'rgba(200, 168, 150, 0.07)', border: 'rgba(200, 168, 150, 0.2)' };

  return (
    <div style={{ background: '#0d0510', color: '#f9f5ff', minHeight: '100vh', fontFamily: 'var(--font-body)', position: 'relative', overflowX: 'hidden' }}>
      
      {/* Background radial atmosphere */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 1400, height: 800, background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(157,107,255,0.06) 0%, transparent 80%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'radial-gradient(rgba(157,107,255,0.03) 1px, transparent 1px)',
        backgroundSize: '24px 24px'
      }} />

      <Navbar email={email} />
      
      <main style={{ maxWidth: 'var(--max-w)', margin: '0 auto', padding: '32px var(--s8)', position: 'relative', zIndex: 1 }}>
        
        {/* ── Breadcrumbs ── */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 20 }}>
          <Link href="/dashboard" style={{ transition: 'color 0.15s' }} className="hover:text-zinc-200">
            Dashboard
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--text-2)' }}>Audit Verification Sheet</span>
        </nav>

        {/* ── Hero Title Row with Small inline ScoreGauge ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 20,
          borderBottom: '1px solid var(--border-1)',
          paddingBottom: 24,
          marginBottom: 32
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Inline circle progress */}
            <div style={{ position: 'relative', width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="60" height="60" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="30" cy="30" r={radius} fill="none" stroke="var(--surface-3)" strokeWidth="4" />
                {score !== null && (
                  <circle
                    cx="30"
                    cy="30"
                    r={radius}
                    fill="none"
                    stroke={scoreColor}
                    strokeWidth="4"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                )}
              </svg>
              <div style={{
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: scoreColor,
                fontFamily: 'var(--font-mono)'
              }}>
                {score !== null ? `${score}%` : 'N/A'}
              </div>
            </div>

            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--text-1)', letterSpacing: '-0.02em', margin: 0 }}>
                Audit Verification Report
              </h1>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>
                Run ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{audit.audit_run_id}</span>
              </p>
            </div>
          </div>

          {/* Right codebase + status badges */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <a
              href={webRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {repoUrl.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '')}
              </span>
            </a>

            <span style={{
              padding: '4px 10px',
              borderRadius: 'var(--r-full)',
              fontSize: '0.68rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: activeColor.text,
              background: activeColor.bg,
              border: `1px solid ${activeColor.border}`,
            }}>
              {audit.status}
            </span>
          </div>
        </div>

        {/* ── Warnings / Failures Banner ── */}
        <AuditStatusBanner
          status={audit.status}
          warnings={audit.warnings}
          failure={audit.failure}
          onRetry={handleRetry}
        />

        {/* ── Rest of the content only if not failed ── */}
        {audit.status !== 'failed' && (
          <>
            {/* ── Spacious Stats Bar Grid ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
              marginBottom: 32
            }}>
              {/* Box 1: Trust Score */}
              <HoverGlowCard accent={scoreColor} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '16px 20px', background: 'rgba(19,12,28,0.3)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10 }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Trust Score
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: scoreColor, fontFamily: 'var(--font-mono)' }}>
                  {score !== null ? `${score}%` : 'N/A'}
                </span>
              </HoverGlowCard>
              {/* Box 2: Claims Audited */}
              <HoverGlowCard accent="var(--coral)" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '16px 20px', background: 'rgba(19,12,28,0.3)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10 }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Assertions Checked
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>
                  {audit.claims.length}
                </span>
              </HoverGlowCard>
              {/* Box 3: Execution Time */}
              <HoverGlowCard accent="var(--violet)" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '16px 20px', background: 'rgba(19,12,28,0.3)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10 }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Verification Time
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
                  {durationSec ? `${durationSec}s` : '--'}
                </span>
              </HoverGlowCard>
              {/* Box 4: Verdict Breakdown */}
              <HoverGlowCard accent="var(--teal)" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '16px 20px', background: 'rgba(19,12,28,0.3)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10 }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Verdict Breakdown
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', gap: 10, marginTop: 4 }}>
                  <span style={{ color: 'var(--teal)' }}>{counts.supported} supported</span>
                  <span style={{ color: 'var(--crimson)' }}>{counts.contradicted} contradicted</span>
                  <span style={{ color: 'var(--text-3)' }}>{counts.unverified} unverified</span>
                </span>
              </HoverGlowCard>
            </div>

            {/* ── Input context preview ── */}
            <InputComparisonPanel
              questionText={audit.question_text}
              answerText={audit.answer_text}
            />

            {/* ── Claims Header Row ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--border-1)', paddingBottom: 10, marginBottom: 20 }}>
              <h2 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-display)', color: 'var(--text-1)', margin: 0 }}>
                Extracted Claims &amp; Proofs
              </h2>
              <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                {audit.claims.length} assertions total
              </span>
            </div>

            {/* ── Claims Accordions (using native .claim-row) ── */}
            {audit.claims.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                No verifiable claims could be isolated from this answer context.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {audit.claims.map((claim) => {
                  const isMemoryHit = claim.rule_trace?.memory_hit;
                  const isOpen = !!openClaims[claim.claim_id];
                  const showAll = !!showAllEvidence[claim.claim_id];

                  // Limit evidence items to top 3 by default
                  const displayedEvidence = showAll
                    ? claim.evidence_items
                    : claim.evidence_items.slice(0, 3);

                  const hiddenEvidenceCount = claim.evidence_items.length - 3;

                  return (
                    <div key={claim.claim_id} className={`claim-row claim-row-${claim.verdict}`}>
                      {/* Accordion header */}
                      <div className="claim-header" onClick={() => toggleClaim(claim.claim_id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
                          <span className="claim-index">#{claim.claim_index + 1}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                            <span className="claim-text" style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-1)' }}>
                              {claim.raw_text}
                            </span>
                            {isMemoryHit && (
                              <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--teal)', fontWeight: 500 }}>
                                🧠 Memory Cache Hit ({Math.round((claim.rule_trace?.memory_similarity || 0) * 100)}% match)
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginRight: 8 }}>
                          <span className={`badge badge-${claim.verdict}`} style={{
                            textTransform: 'uppercase',
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 'var(--r-xs)',
                            color: claim.verdict === 'supported' ? 'var(--teal)' : claim.verdict === 'contradicted' ? 'var(--crimson)' : 'var(--text-3)',
                            background: claim.verdict === 'supported' ? 'var(--teal-dim)' : claim.verdict === 'contradicted' ? 'var(--crimson-dim)' : 'var(--surface-2)',
                            border: `1px solid ${claim.verdict === 'supported' ? 'var(--teal-border)' : claim.verdict === 'contradicted' ? 'var(--crimson-border)' : 'var(--border-2)'}`,
                          }}>
                            {claim.verdict}
                          </span>
                          {claim.confidence !== null && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                              {Math.round(claim.confidence * 100)}% conf
                            </span>
                          )}
                        </div>

                        <svg
                          className={`claim-chevron ${isOpen ? 'open' : ''}`}
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>

                      {/* Accordion body details (Conditionally rendered in DOM for hydration immunity and readability) */}
                      {isOpen && (
                        <div className="claim-body open">
                          <div className="claim-body-inner" style={{ background: 'rgba(13, 5, 16, 0.4)', display: 'flex', flexDirection: 'column', gap: 20 }}>
                            
                            {/* Swarm explanation */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span className="input-label" style={{ fontSize: '0.72rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Swarm Verdict Reason
                              </span>
                              <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'var(--font-body)' }}>
                                {claim.judge_explanation || 'No natural language explanation was generated.'}
                              </p>
                            </div>

                            {/* Critic Agent Discrepancy Analysis */}
                            {claim.rule_trace?.critic_feedback && claim.rule_trace.critic_feedback.toLowerCase() !== 'none' && (
                              <div style={{
                                background: 'rgba(255, 107, 69, 0.04)',
                                borderLeft: '3px solid var(--coral)',
                                padding: 12,
                                borderRadius: '0 var(--r-sm) var(--r-sm) 0',
                                fontSize: '0.8rem',
                                color: 'var(--text-2)',
                                lineHeight: 1.5,
                              }}>
                                <strong style={{ color: 'var(--coral)', textTransform: 'uppercase', fontSize: '0.65rem', display: 'block', marginBottom: 4 }}>
                                  Critic Agent Discrepancy Analysis
                                </strong>
                                {claim.rule_trace.critic_feedback}
                              </div>
                            )}

                            {/* Suggested Grounded Correction */}
                            {claim.rule_trace?.suggested_correction && (
                              <div className="correction-box" style={{
                                background: 'rgba(255, 179, 0, 0.08)',
                                border: '1px solid rgba(255, 179, 0, 0.25)',
                                borderRadius: '6px',
                                padding: '12px',
                              }}>
                                <span style={{
                                  fontSize: '0.72rem',
                                  color: '#f59e0b',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontWeight: 600,
                                  marginBottom: '4px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em'
                                }}>
                                  💡 Suggested Grounded Correction ({claim.rule_trace.suggested_correction.confidence} confidence)
                                </span>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-1)', marginBottom: '8px', lineHeight: 1.4, margin: 0 }}>
                                  {claim.rule_trace.suggested_correction.statement}
                                </p>
                                {claim.rule_trace.suggested_correction.file_references && claim.rule_trace.suggested_correction.file_references.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>References:</span>
                                    {claim.rule_trace.suggested_correction.file_references.map((ref, idx) => (
                                      <span key={idx} className="mono" style={{
                                        fontSize: '0.7rem',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        color: 'var(--text-2)'
                                      }}>
                                        {ref}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Contradiction callout detail */}
                            {claim.verdict === 'contradicted' && claim.contradiction_reason && (
                              <div style={{
                                background: 'rgba(255, 63, 94, 0.04)',
                                borderLeft: '3px solid var(--crimson)',
                                padding: 12,
                                borderRadius: '0 var(--r-sm) var(--r-sm) 0',
                                fontSize: '0.8rem',
                                color: 'var(--text-2)',
                                lineHeight: 1.5,
                              }}>
                                <strong style={{ color: '#ff3f5e', textTransform: 'uppercase', fontSize: '0.65rem', display: 'block', marginBottom: 4 }}>
                                  Contradiction Details
                                </strong>
                                {claim.contradiction_reason}
                              </div>
                            )}

                            {/* Normalized Query */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span className="input-label" style={{ fontSize: '0.72rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Normalized Query
                              </span>
                              <code className="mono" style={{ background: 'var(--surface-2)', padding: '4px 8px', borderRadius: '4px', alignSelf: 'flex-start', fontSize: '0.72rem', color: 'var(--text-2)' }}>
                                {claim.normalized_query}
                              </code>
                            </div>

                            <div className="divider" style={{ borderTop: '1px solid var(--border-1)', margin: '8px 0' }}></div>

                            {/* Evidence list block */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <h5 style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', color: 'var(--text-2)', margin: 0 }}>
                                Matched Evidence ({claim.evidence_items.length})
                              </h5>

                              {claim.evidence_items.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', fontStyle: 'italic', margin: 0 }}>
                                  No evidence files matched during retrieval phase.
                                </p>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                  {displayedEvidence.map((ev) => {
                                    const permalink = buildGithubPermalink(
                                      repoUrl,
                                      ev.source_commit,
                                      ev.filepath,
                                      ev.start_line,
                                      ev.end_line
                                    );

                                    return (
                                      <div key={ev.evidence_id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ fontSize: '0.72rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                                          <a
                                            href={permalink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: 'var(--violet)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                                          >
                                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                            <span>{ev.filepath} @ lines {ev.start_line}-{ev.end_line}</span>
                                          </a>
                                          <span>Relevance: {Math.round(ev.relevance_score * 100)}%</span>
                                        </div>
                                        <pre className="snippet-block" style={{ margin: 0 }}>{ev.snippet_text}</pre>
                                      </div>
                                    );
                                  })}

                                  {/* Evidence expansion button */}
                                  {!showAll && hiddenEvidenceCount > 0 && (
                                    <button
                                      onClick={(e) => toggleShowAllEvidence(claim.claim_id, e)}
                                      className="btn btn-secondary btn-sm"
                                      style={{ alignSelf: 'flex-start', marginTop: 8 }}
                                    >
                                      Show {hiddenEvidenceCount} more evidence items
                                    </button>
                                  )}

                                  {showAll && claim.evidence_items.length > 3 && (
                                    <button
                                      onClick={(e) => toggleShowAllEvidence(claim.claim_id, e)}
                                      className="btn btn-secondary btn-sm"
                                      style={{ alignSelf: 'flex-start', marginTop: 8 }}
                                    >
                                      Show less
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
