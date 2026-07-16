import React from 'react';

interface AuditSkeletonProps {
  status: string;
}

const STATUS_MESSAGES: Record<string, string> = {
  created: 'Initializing verification context...',
  queued: 'Waiting in executor queue...',
  cloning: 'Downloading public codebase from GitHub...',
  extracting_claims: 'Analyzing text to isolate claim variables...',
  retrieving_evidence: 'Querying vector spaces for code snippets...',
  verifying: 'Running Critic-Verifier evaluation swarm...',
  judging: 'Writing proofs and explanations...',
  persisting: 'Finalizing database transactions...',
};

export const AuditSkeleton: React.FC<AuditSkeletonProps> = ({ status }) => {
  const message = STATUS_MESSAGES[status] || 'Processing audit verification loop...';

  return (
    <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Active Stage Indicator */}
      <div style={{
        background: 'rgba(181, 123, 255, 0.05)',
        border: '1px solid rgba(181, 123, 255, 0.15)',
        borderRadius: 'var(--r-md)',
        padding: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexDirection: 'row',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: 32, height: 32 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '2px solid rgba(181, 123, 255, 0.2)',
              borderTopColor: '#b57bff',
              animation: 'spin 1s linear infinite',
            }} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Audit in Progress
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2, margin: 0 }}>{message}</p>
          </div>
        </div>
        <span style={{
          marginLeft: 'auto',
          padding: '4px 10px',
          borderRadius: 'var(--r-full)',
          fontSize: '0.68rem',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          background: 'rgba(181, 123, 255, 0.1)',
          border: '1px solid rgba(181, 123, 255, 0.2)',
          color: '#b57bff',
        }}>
          {status}
        </span>
      </div>

      {/* Header Skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 24, width: '40%', background: 'var(--surface-1)', borderRadius: 'var(--r-sm)' }} className="skeleton" />
        <div style={{ height: 16, width: '60%', background: 'var(--surface-1)', borderRadius: 'var(--r-sm)' }} className="skeleton" />
      </div>

      {/* Global Score Panel Skeleton */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        background: 'var(--surface-1)',
        border: '1px solid var(--border-1)',
        borderRadius: 'var(--r-lg)',
        padding: 24,
      }} className="md:grid-cols-3">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 12 }}>
          <div style={{
            width: 90,
            height: 90,
            borderRadius: '50%',
            border: '6px solid var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ height: 16, width: 32, background: 'var(--surface-2)', borderRadius: 'var(--r-xs)' }} className="skeleton" />
          </div>
          <div style={{ height: 14, width: 90, background: 'var(--surface-2)', borderRadius: 'var(--r-xs)' }} className="skeleton" />
        </div>
        <div style={{ gridColumn: 'span 2', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ height: 16, width: 120, background: 'var(--surface-2)', borderRadius: 'var(--r-xs)' }} className="skeleton" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ height: 48, background: 'var(--surface-2)', borderRadius: 'var(--r-sm)' }} className="skeleton" />
            <div style={{ height: 48, background: 'var(--surface-2)', borderRadius: 'var(--r-sm)' }} className="skeleton" />
            <div style={{ height: 48, background: 'var(--surface-2)', borderRadius: 'var(--r-sm)' }} className="skeleton" />
          </div>
        </div>
      </div>

      {/* Claims List Skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ height: 20, width: 100, background: 'var(--surface-1)', borderRadius: 'var(--r-xs)' }} className="skeleton" />
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            border: '1px solid var(--border-1)',
            borderRadius: 'var(--r-lg)',
            padding: 20,
            background: 'var(--surface-1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ height: 18, width: 80, background: 'var(--surface-2)', borderRadius: 'var(--r-xs)' }} className="skeleton" />
              <div style={{ height: 18, width: 48, background: 'var(--surface-2)', borderRadius: 'var(--r-xs)' }} className="skeleton" />
            </div>
            <div style={{ height: 14, width: '100%', background: 'var(--surface-2)', borderRadius: 'var(--r-xs)' }} className="skeleton" />
            <div style={{ height: 14, width: '70%', background: 'var(--surface-2)', borderRadius: 'var(--r-xs)' }} className="skeleton" />
          </div>
        ))}
      </div>
    </div>
  );
};
