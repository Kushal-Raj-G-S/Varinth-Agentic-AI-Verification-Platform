import React, { useState } from 'react';
import { Claim } from '../../types/audit';
import { EvidenceList } from './EvidenceList';

interface ClaimCardProps {
  claim: Claim;
  repoUrl: string;
}

export const ClaimCard: React.FC<ClaimCardProps> = ({ claim, repoUrl }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Verdict design definitions
  const verdictStyleMap = {
    supported: {
      bg: 'rgba(0, 220, 184, 0.03)',
      border: 'rgba(0, 220, 184, 0.15)',
      hoverBg: 'rgba(0, 220, 184, 0.06)',
      badgeText: '#00dcb8',
      badgeBg: 'rgba(0, 220, 184, 0.08)',
      badgeBorder: 'rgba(0, 220, 184, 0.2)',
      icon: (
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#00dcb8" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    contradicted: {
      bg: 'rgba(255, 63, 94, 0.03)',
      border: 'rgba(255, 63, 94, 0.15)',
      hoverBg: 'rgba(255, 63, 94, 0.06)',
      badgeText: '#ff3f5e',
      badgeBg: 'rgba(255, 63, 94, 0.08)',
      badgeBorder: 'rgba(255, 63, 94, 0.2)',
      icon: (
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#ff3f5e" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    unverified: {
      bg: 'rgba(200, 168, 150, 0.02)',
      border: 'var(--border-1)',
      hoverBg: 'rgba(200, 168, 150, 0.05)',
      badgeText: 'var(--text-3)',
      badgeBg: 'var(--surface-2)',
      badgeBorder: 'var(--border-2)',
      icon: (
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--text-3)" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  };

  const style = verdictStyleMap[claim.verdict] || verdictStyleMap.unverified;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div style={{
      border: `1px solid ${style.border}`,
      borderRadius: 'var(--r-lg)',
      background: isHovered ? style.hoverBg : style.bg,
      overflow: 'hidden',
      transition: 'background-color 0.2s',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      marginBottom: 16,
    }}>
      {/* Clickable Header card */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: 20,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          outline: 'none',
          textAlign: 'left',
          gap: 12,
        }}
        aria-expanded={isOpen}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 'var(--r-xs)',
              fontSize: '0.62rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: style.badgeText,
              background: style.badgeBg,
              border: `1px solid ${style.badgeBorder}`,
            }}>
              {style.icon}
              <span>{claim.verdict}</span>
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              Confidence: {Math.round(claim.confidence * 100)}%
            </span>
          </div>
          <h3 style={{
            fontSize: '0.875rem',
            fontWeight: 550,
            color: 'var(--text-1)',
            letterSpacing: '0.01em',
            lineHeight: 1.5,
            margin: 0,
          }}>
            {claim.raw_text}
          </h3>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          borderTop: '1px solid rgba(255, 255, 255, 0.02)',
          paddingTop: 8,
        }}>
          <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
            Assertion #{claim.claim_index + 1}
          </span>
          <svg
            width="16"
            height="16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="var(--text-3)"
            strokeWidth={2}
            style={{
              transition: 'transform 0.2s',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Accordion content area */}
      {isOpen && (
        <div style={{
          padding: 20,
          borderTop: '1px solid var(--border-1)',
          background: 'rgba(19, 12, 28, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          {/* Judge Explanation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h4 style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Judge Verdict Explanation
            </h4>
            <p style={{
              fontSize: '0.78rem',
              color: 'var(--text-2)',
              lineHeight: 1.6,
              background: 'var(--ink)',
              border: '1px solid var(--border-2)',
              padding: 14,
              borderRadius: 'var(--r-md)',
              whiteSpace: 'pre-wrap',
              margin: 0,
            }}>
              {claim.judge_explanation || 'No verdict explanation was generated.'}
            </p>
          </div>

          {/* Contradiction warning caller */}
          {claim.verdict === 'contradicted' && claim.contradiction_reason && (
            <div style={{
              background: 'rgba(255, 63, 94, 0.07)',
              border: '1px solid rgba(255, 63, 94, 0.18)',
              color: '#ff3f5e',
              padding: 12,
              borderRadius: 'var(--r-sm)',
              fontSize: '0.75rem',
              lineHeight: 1.5,
            }}>
              <span style={{ fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                Contradiction Found:
              </span>
              {claim.contradiction_reason}
            </div>
          )}

          {/* Sub-evidence rendering */}
          <EvidenceList evidenceItems={claim.evidence_items} repoUrl={repoUrl} />
        </div>
      )}
    </div>
  );
};
