import React from 'react';
import Link from 'next/link';
import { normalizeRepoUrl } from '../../lib/audits/buildGithubPermalink';

interface AuditHeaderProps {
  repoUrl: string;
  startedAt: string;
  durationMs: number | null;
  status: string;
}

export const AuditHeader: React.FC<AuditHeaderProps> = ({
  repoUrl,
  startedAt,
  durationMs,
  status,
}) => {
  const formattedDate = new Date(startedAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });

  const durationSec = durationMs ? (durationMs / 1000).toFixed(2) : null;
  const webRepoUrl = normalizeRepoUrl(repoUrl);

  const statusColors = {
    completed: { text: '#00dcb8', bg: 'rgba(0, 220, 184, 0.07)', border: 'rgba(0, 220, 184, 0.2)' },
    partial: { text: '#ffa833', bg: 'rgba(255, 168, 51, 0.07)', border: 'rgba(255, 168, 51, 0.2)' },
    failed: { text: '#ff3f5e', bg: 'rgba(255, 63, 94, 0.07)', border: 'rgba(255, 63, 94, 0.2)' },
  };
  const activeColor = statusColors[status as keyof typeof statusColors] || { text: '#c8a896', bg: 'rgba(200, 168, 150, 0.07)', border: 'rgba(200, 168, 150, 0.2)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
      {/* Breadcrumbs */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-3)' }}>
        <Link href="/dashboard" style={{ transition: 'color 0.15s' }} className="hover:text-zinc-200">
          Dashboard
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--text-2)' }}>Audit Verification Sheet</span>
      </nav>

      {/* Main title metadata stack */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        borderBottom: '1px solid var(--border-1)',
        paddingBottom: 20
      }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--text-1)', letterSpacing: '-0.02em', margin: 0 }}>
            Audit Verification Report
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>
            Triggered at {formattedDate}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          {/* Target codebase info badge */}
          <a
            href={webRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 'var(--r-sm)',
              fontSize: '0.75rem',
              fontWeight: 500,
              background: 'var(--surface-2)',
              color: 'var(--text-2)',
              border: '1px solid var(--border-2)',
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
              {repoUrl.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '')}
            </span>
          </a>

          {/* Performance duration badge */}
          {durationSec && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 'var(--r-sm)',
              fontSize: '0.75rem',
              fontWeight: 500,
              background: 'var(--surface-1)',
              color: 'var(--text-3)',
              border: '1px solid var(--border-1)',
            }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Duration: {durationSec}s</span>
            </div>
          )}

          {/* Current execution status pill */}
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
            {status}
          </span>
        </div>
      </div>
    </div>
  );
};
