import React from 'react';

interface ScoreGaugeProps {
  globalScore: number | null;
  counts: {
    supported: number;
    contradicted: number;
    unverified: number;
  };
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  globalScore,
  counts,
}) => {
  const hasScore = globalScore !== null;
  const score = hasScore ? Math.round(globalScore) : 0;

  // Determine colors based on themes
  const strokeColor = !hasScore
    ? '#3d2c38'
    : score >= 80
    ? '#00dcb8'
    : score >= 50
    ? '#ffa833'
    : '#ff3f5e';

  const textColor = !hasScore
    ? 'var(--text-3)'
    : score >= 80
    ? '#00dcb8'
    : score >= 50
    ? '#ffa833'
    : '#ff3f5e';

  // SVG parameters for radial circle
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr',
      background: 'var(--surface-1)',
      border: '1px solid var(--border-1)',
      borderRadius: 'var(--r-lg)',
      padding: 24,
      marginBottom: 24,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    }} className="md:grid-cols-3">
      {/* Circle indicator left */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        gap: 12,
        borderBottom: '1px solid var(--border-1)',
      }} className="md:border-r md:border-b-0 md:border-zinc-900">
        <div style={{
          position: 'relative',
          width: 100,
          height: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Background Ring */}
          <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="var(--surface-3)"
              strokeWidth="7"
            />
            {/* Progress Ring */}
            {hasScore && (
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={strokeColor}
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
              />
            )}
          </svg>
          {/* Inner textual score display */}
          <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 700, color: textColor, letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
              {hasScore ? `${score}%` : 'N/A'}
            </span>
          </div>
        </div>
        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Global Trust Score
        </span>
      </div>

      {/* Numerical verdict cards on the right */}
      <div style={{
        gridColumn: 'span 2',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '16px 24px',
        gap: 16,
      }}>
        <div>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>
            Audited Assertions Summary
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4, margin: 0 }}>
            Verification results across all extracted claim statements.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {/* Supported Count Card */}
          <div style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-2)',
            borderRadius: 'var(--r-md)',
            padding: '12px 8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Supported
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#00dcb8', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              {counts.supported}
            </span>
          </div>

          {/* Contradicted Count Card */}
          <div style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-2)',
            borderRadius: 'var(--r-md)',
            padding: '12px 8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Contradicted
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ff3f5e', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              {counts.contradicted}
            </span>
          </div>

          {/* Unverified Count Card */}
          <div style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-2)',
            borderRadius: 'var(--r-md)',
            padding: '12px 8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Unverified
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-2)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              {counts.unverified}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
