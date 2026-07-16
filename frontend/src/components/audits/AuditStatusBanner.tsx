import React from 'react';
import { AuditWarning, AuditFailure } from '../../types/audit';

interface AuditStatusBannerProps {
  status: string;
  warnings: AuditWarning[];
  failure?: AuditFailure;
  onRetry?: () => void;
}

export const AuditStatusBanner: React.FC<AuditStatusBannerProps> = ({
  status,
  warnings,
  failure,
  onRetry,
}) => {
  if (status === 'failed') {
    return (
      <div style={{
        background: 'rgba(255, 63, 94, 0.05)',
        border: '1px solid rgba(255, 63, 94, 0.25)',
        borderRadius: 'var(--r-md)',
        padding: 16,
        marginBottom: 24,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div style={{
            flexShrink: 0,
            background: 'rgba(255, 63, 94, 0.1)',
            color: '#ff3f5e',
            padding: 6,
            borderRadius: 'var(--r-xs)',
            border: '1px solid rgba(255, 63, 94, 0.15)',
            marginRight: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>
              Verification Audit Failed
            </h3>
            <p style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--text-2)', lineHeight: 1.5 }}>
              {failure?.error_message || 'An unexpected server error occurred during the verification execution loop.'}
            </p>
            {failure?.failure_code && (
              <span style={{
                marginTop: 8,
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 6px',
                borderRadius: 'var(--r-xs)',
                fontSize: '0.65rem',
                fontFamily: 'var(--font-mono)',
                background: 'rgba(255, 63, 94, 0.12)',
                color: '#ff3f5e',
                border: '1px solid rgba(255, 63, 94, 0.18)',
              }}>
                Code: {failure.failure_code}
              </span>
            )}
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                marginLeft: 'auto',
                background: 'rgba(255, 63, 94, 0.12)',
                color: 'var(--text-1)',
                border: '1px solid rgba(255, 63, 94, 0.2)',
                padding: '6px 12px',
                borderRadius: 'var(--r-sm)',
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 63, 94, 0.25)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 63, 94, 0.12)'; }}
            >
              Retry Audit
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === 'partial' && warnings.length > 0) {
    return (
      <div style={{
        background: 'rgba(255, 168, 51, 0.05)',
        border: '1px solid rgba(255, 168, 51, 0.25)',
        borderRadius: 'var(--r-md)',
        padding: 16,
        marginBottom: 24,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div style={{
            flexShrink: 0,
            background: 'rgba(255, 168, 51, 0.1)',
            color: '#ffa833',
            padding: 6,
            borderRadius: 'var(--r-xs)',
            border: '1px solid rgba(255, 168, 51, 0.15)',
            marginRight: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>
              Audit Completed with Warnings
            </h3>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {warnings.map((w, idx) => (
                <div key={idx} style={{ fontSize: '0.75rem', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>
                  • <span style={{ fontWeight: 600, color: '#ffa833' }}>[{w.warning_code}]:</span> {w.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
