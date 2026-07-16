'use client'

import { useState } from 'react'
import VerdictBadge from './VerdictBadge'

interface RuleTrace {
  critic_feedback?: string
  memory_hit?: boolean
  memory_similarity?: number
}

interface EvidenceItem {
  source_id: string
  location: string
  snippet: string
  relevance_score: number | null
  retrieval_rank: number | null
  supports_claim: boolean | null
  contradicts_claim: boolean | null
}

interface Claim {
  claim_index: number
  raw_text: string
  normalized_text: string
  claim_type: string
  importance: string
  verdict: 'supported' | 'contradicted' | 'unverified'
  confidence: number | null
  explanation: string | null
  rule_trace: RuleTrace | null
  evidence: EvidenceItem[]
}

export default function ClaimRow({ claim }: { claim: Claim }) {
  const [open, setOpen] = useState(false)
  const isMemoryHit = claim.rule_trace?.memory_hit

  return (
    <div className={`claim-row claim-row-${claim.verdict}`}>
      <div className="claim-header" onClick={() => setOpen(!open)}>
        <span className="claim-index">#{claim.claim_index}</span>
        <div className="flex-1 flex flex-col gap-1">
          <span className="claim-text">{claim.raw_text}</span>
          {isMemoryHit && (
            <span className="flex items-center gap-1 mono" style={{ fontSize: '0.7rem', color: 'var(--teal)', fontWeight: 500 }}>
              🧠 Memory Cache Hit ({Math.round((claim.rule_trace?.memory_similarity || 0) * 100)}% match)
            </span>
          )}
        </div>
        <div className="flex items-center gap-3" style={{ marginRight: 'var(--s2)' }}>
          <span className={`badge badge-${claim.importance}`}>
            {claim.importance}
          </span>
          <VerdictBadge verdict={claim.verdict} />
        </div>
        <svg
          className={`claim-chevron ${open ? 'open' : ''}`}
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

      <div className={`claim-body ${open ? 'open' : ''}`}>
        <div className="claim-body-inner">
          {claim.rule_trace?.critic_feedback && claim.rule_trace.critic_feedback.toLowerCase() !== 'none' && (
            <div className="critic-box">
              <span className="input-label" style={{ fontSize: '0.75rem', color: 'var(--coral)', marginBottom: '4px', display: 'block' }}>
                Critic Agent Discrepancy Analysis
              </span>
              <p className="critic-text" style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>
                {claim.rule_trace.critic_feedback}
              </p>
            </div>
          )}

          {claim.explanation && (
            <div className="flex flex-col gap-1">
              <span className="input-label" style={{ fontSize: '0.75rem' }}>Explanation</span>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-1)' }}>
                {claim.explanation}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="input-label" style={{ fontSize: '0.75rem' }}>Normalized Query</span>
            <code className="mono" style={{ background: 'var(--surface-2)', padding: '4px 8px', borderRadius: '4px', alignSelf: 'flex-start', fontSize: '0.75rem', color: 'var(--text-2)' }}>
              {claim.normalized_text}
            </code>
          </div>

          <div className="divider" style={{ margin: 'var(--s2) 0' }}></div>

          <div className="flex flex-col gap-3">
            <h5 className="font-display">Evidence Items ({claim.evidence.length})</h5>
            {claim.evidence.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>
                No evidence items were retrieved for this claim.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {claim.evidence.map((ev, index) => (
                  <div key={index} className="flex flex-col gap-2">
                    <div style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                      <span className="flex items-center gap-2" style={{ color: 'var(--text-2)' }}>
                        {ev.source_id} @ {ev.location}
                        {ev.supports_claim && (
                          <span className="badge badge-supported" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>Supports</span>
                        )}
                        {ev.contradicts_claim && (
                          <span className="badge badge-contradicted" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>Contradicts</span>
                        )}
                      </span>
                      {ev.relevance_score !== null && (
                        <span>relevance: {Math.round(ev.relevance_score * 100)}%</span>
                      )}
                    </div>
                    <pre className="snippet-block">{ev.snippet}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
