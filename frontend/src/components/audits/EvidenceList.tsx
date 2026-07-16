import React from 'react';
import { EvidenceItem } from '../../types/audit';
import { buildGithubPermalink } from '../../lib/audits/buildGithubPermalink';

interface EvidenceListProps {
  evidenceItems: EvidenceItem[];
  repoUrl: string;
}

export const EvidenceList: React.FC<EvidenceListProps> = ({
  evidenceItems,
  repoUrl,
}) => {
  if (evidenceItems.length === 0) {
    return (
      <div style={{
        fontSize: '0.75rem',
        color: 'var(--text-3)',
        fontStyle: 'italic',
        marginTop: 8,
        padding: 12,
        background: 'rgba(19, 12, 28, 0.2)',
        border: '1px solid var(--border-1)',
        borderRadius: 'var(--r-sm)',
      }}>
        No supporting or contradicting codebase evidence items were returned.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
      <h5 style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
        Matched Codebase Evidence
      </h5>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {evidenceItems.map((item, idx) => {
          const permalink = buildGithubPermalink(
            repoUrl,
            item.source_commit,
            item.filepath,
            item.start_line,
            item.end_line
          );

          return (
            <div key={item.evidence_id} style={{
              border: '1px solid var(--border-2)',
              borderRadius: 'var(--r-md)',
              overflow: 'hidden',
              background: 'var(--ink)',
            }}>
              {/* Header / File Metadata */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 16px',
                borderBottom: '1px solid var(--border-1)',
                background: 'var(--surface-1)',
              }}>
                <a
                  href={permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 500,
                    color: 'var(--violet)',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                  <span>{item.filepath} @ line {item.start_line}-{item.end_line}</span>
                </a>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Relevance Percentage tag */}
                  <span style={{
                    fontSize: '0.62rem',
                    padding: '2px 8px',
                    borderRadius: 'var(--r-full)',
                    fontWeight: 600,
                    background: 'var(--surface-2)',
                    color: 'var(--text-2)',
                    border: '1px solid var(--border-2)',
                  }}>
                    Relevance: {Math.round(item.relevance_score * 100)}%
                  </span>
                  
                  {/* Rank tag */}
                  <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                    #{idx + 1}
                  </span>
                </div>
              </div>

              {/* Code Snippet Box */}
              <div style={{ position: 'relative' }}>
                <pre style={{
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-1)',
                  padding: 16,
                  overflowX: 'auto',
                  whiteSpace: 'pre',
                  background: 'var(--ink)',
                  maxHeight: 280,
                  lineHeight: 1.6,
                  margin: 0,
                }}>
                  <code>{item.snippet_text}</code>
                </pre>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
