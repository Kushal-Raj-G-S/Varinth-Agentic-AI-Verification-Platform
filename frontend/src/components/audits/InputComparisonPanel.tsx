import React, { useState } from 'react';

interface InputComparisonPanelProps {
  questionText: string;
  answerText: string;
}

export const InputComparisonPanel: React.FC<InputComparisonPanelProps> = ({
  questionText,
  answerText,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{
      border: '1px solid var(--border-1)',
      borderRadius: 'var(--r-lg)',
      background: 'var(--surface-1)',
      overflow: 'hidden',
      marginBottom: 24,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    }}>
      {/* Header clickable bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          outline: 'none',
          textAlign: 'left',
        }}
        aria-expanded={isOpen}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--text-3)" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)' }}>
            Input Code Context &amp; Statements
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
            {isOpen ? 'Hide context' : 'Show details'}
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

      {/* Accordion panel content */}
      {isOpen && (
        <div style={{
          padding: 20,
          borderTop: '1px solid var(--border-1)',
          background: 'rgba(19, 12, 28, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          {/* Question Text block */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h4 style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Question Asked
            </h4>
            <div style={{
              background: 'var(--ink)',
              border: '1px solid var(--border-2)',
              borderRadius: 'var(--r-md)',
              padding: 12,
              fontSize: '0.78rem',
              color: 'var(--text-2)',
              whiteSpace: 'pre-wrap',
              fontFamily: 'var(--font-mono)',
              minHeight: 60,
              lineHeight: 1.5,
            }}>
              {questionText || '(No question text provided)'}
            </div>
          </div>

          {/* Answer Text block */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h4 style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Audited AI Answer
            </h4>
            <div style={{
              background: 'var(--ink)',
              border: '1px solid var(--border-2)',
              borderRadius: 'var(--r-md)',
              padding: 12,
              fontSize: '0.78rem',
              color: 'var(--text-2)',
              whiteSpace: 'pre-wrap',
              fontFamily: 'var(--font-mono)',
              minHeight: 60,
              lineHeight: 1.5,
            }}>
              {answerText}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
