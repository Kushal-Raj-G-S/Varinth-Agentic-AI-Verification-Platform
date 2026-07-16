'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const USE_CASES = [
  { id: 'coding', icon: '⟨/⟩', label: 'AI Coding Assistant', desc: 'Verify Copilot, Cursor, or Claude code answers' },
  { id: 'api', icon: '⬡', label: 'API Integration', desc: 'Verify answers from LLM API responses in CI/CD' },
  { id: 'research', icon: '◉', label: 'Research & Analysis', desc: 'Fact-check AI-generated technical summaries' },
  { id: 'qa', icon: '◈', label: 'QA & Code Review', desc: 'Catch hallucinations in automated review workflows' },
]

const STEPS = ['Welcome', 'Use case', 'Ready']

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [selectedUseCase, setSelectedUseCase] = useState('')
  const [saving, setSaving] = useState(false)

  const handleFinish = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({
        onboarding_completed: true,
        use_case: selectedUseCase,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id)
    }
    router.push('/dashboard')
  }

  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0d0510', padding: '24px', position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient blobs */}
      <div style={{ position: 'absolute', top: '10%', left: '15%', width: '40%', height: '40%', background: 'radial-gradient(circle, rgba(255,107,69,0.08) 0%, transparent 65%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '15%', width: '35%', height: '35%', background: 'radial-gradient(circle, rgba(0,220,184,0.07) 0%, transparent 65%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      {/* Progress bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'rgba(255,107,69,0.08)' }}>
        <div style={{
          height: '100%', background: 'linear-gradient(90deg, #ff6b45, #ffa833)',
          width: `${((step + 1) / STEPS.length) * 100}%`,
          transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)',
          boxShadow: '0 0 8px rgba(255,107,69,0.5)',
        }} />
      </div>

      {/* Step dots */}
      <div style={{ position: 'absolute', top: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: i === step ? 24 : 8, height: 8, borderRadius: 4,
              background: i <= step ? '#ff6b45' : 'rgba(255,107,69,0.15)',
              transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
            }} />
          </div>
        ))}
      </div>

      {/* ── Step 0: Welcome ── */}
      {step === 0 && (
        <div style={{ textAlign: 'center', maxWidth: 520, animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 72, height: 72, borderRadius: 18, marginBottom: 28,
            background: 'rgba(255,107,69,0.1)', border: '1px solid rgba(255,107,69,0.2)',
            boxShadow: '0 0 40px rgba(255,107,69,0.15)',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M9 12l2 2 4-4" stroke="#ff6b45" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke="#ff6b45" strokeWidth="1.5" />
            </svg>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
            fontWeight: 400, letterSpacing: '-0.05em', color: '#f9f5ff',
            lineHeight: 1.05, marginBottom: 16,
          }}>
            You're in.<br />
            <span style={{
              background: 'linear-gradient(120deg, #ff7a52 0%, #ffa833 50%, #00dcb8 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Let's verify everything.
            </span>
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'rgba(200,168,150,0.5)', lineHeight: 1.7, marginBottom: 40, letterSpacing: '0.015em' }}>
            Varinth runs a three-agent swarm — Critic, Verifier, Judge — against your actual codebase to extract and verify every claim in any AI answer.
          </p>
          <button
            onClick={() => setStep(1)}
            style={{
              padding: '13px 40px', background: '#ff6b45', border: 'none',
              borderRadius: 8, color: '#fff', fontSize: '0.95rem', fontWeight: 600,
              letterSpacing: '0.015em', cursor: 'pointer',
              boxShadow: '0 0 30px rgba(255,107,69,0.3)',
              transition: 'box-shadow 150ms',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 44px rgba(255,107,69,0.48)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 30px rgba(255,107,69,0.3)' }}
          >
            Get started →
          </button>
        </div>
      )}

      {/* ── Step 1: Use case ── */}
      {step === 1 && (
        <div style={{ maxWidth: 600, width: '100%', animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 400, letterSpacing: '-0.04em', color: '#f9f5ff', marginBottom: 8 }}>
              What are you building?
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'rgba(200,168,150,0.45)', letterSpacing: '0.015em' }}>
              Select your primary use case — helps us tailor your experience
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {USE_CASES.map(uc => (
              <button
                key={uc.id}
                onClick={() => setSelectedUseCase(uc.id)}
                style={{
                  textAlign: 'left', padding: '20px 20px',
                  background: selectedUseCase === uc.id ? 'rgba(255,107,69,0.1)' : 'rgba(19,12,28,0.8)',
                  border: selectedUseCase === uc.id ? '1px solid rgba(255,107,69,0.35)' : '1px solid rgba(255,107,69,0.08)',
                  borderRadius: 12, cursor: 'pointer',
                  boxShadow: selectedUseCase === uc.id ? '0 0 20px rgba(255,107,69,0.1)' : 'none',
                  transition: 'all 180ms ease',
                }}
                onMouseEnter={e => { if (selectedUseCase !== uc.id) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,107,69,0.2)' }}
                onMouseLeave={e => { if (selectedUseCase !== uc.id) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,107,69,0.08)' }}
              >
                {/* Fixed visibility on usecase icons using theme colors instead of browser defaults */}
                <div style={{
                  fontSize: '1.6rem',
                  fontWeight: 'bold',
                  marginBottom: 10,
                  color: selectedUseCase === uc.id ? 'var(--teal)' : 'var(--coral)',
                  transition: 'color 180ms ease'
                }}>
                  {uc.icon}
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f9f5ff', marginBottom: 4, letterSpacing: '0.015em' }}>
                  {uc.label}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'rgba(200,168,150,0.4)', lineHeight: 1.4, letterSpacing: '0.012em' }}>
                  {uc.desc}
                </div>
                {selectedUseCase === uc.id && (
                  <div style={{
                    marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: '0.68rem', color: '#ff6b45', fontFamily: 'var(--font-mono)',
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#ff6b45" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Selected
                  </div>
                )}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'space-between' }}>
            <button
              onClick={() => setStep(0)}
              style={{
                padding: '11px 20px', background: 'transparent',
                border: '1px solid rgba(255,107,69,0.1)', borderRadius: 8,
                color: 'rgba(200,168,150,0.4)', fontSize: '0.875rem', cursor: 'pointer',
                letterSpacing: '0.015em',
              }}
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!selectedUseCase}
              style={{
                padding: '11px 28px', background: selectedUseCase ? '#ff6b45' : 'rgba(255,107,69,0.2)',
                border: 'none', borderRadius: 8, color: '#fff',
                fontSize: '0.875rem', fontWeight: 600, cursor: selectedUseCase ? 'pointer' : 'not-allowed',
                transition: 'all 150ms', boxShadow: selectedUseCase ? '0 0 24px rgba(255,107,69,0.3)' : 'none',
                letterSpacing: '0.015em',
              }}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Ready ── */}
      {step === 2 && (
        <div style={{ textAlign: 'center', maxWidth: 520, animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 72, height: 72, borderRadius: '50%', marginBottom: 28,
            background: 'rgba(0,220,184,0.1)', border: '1px solid rgba(0,220,184,0.25)',
            boxShadow: '0 0 40px rgba(0,220,184,0.12)',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="#00dcb8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', fontWeight: 400, letterSpacing: '-0.05em', color: '#f9f5ff', lineHeight: 1.05, marginBottom: 16 }}>
            All set.<br />
            <span style={{ WebkitTextStroke: '1px rgba(0,220,184,0.35)', color: 'transparent' }}>
              Start verifying.
            </span>
          </h2>

          <p style={{ fontSize: '0.9rem', color: 'rgba(200,168,150,0.45)', lineHeight: 1.7, marginBottom: 14, letterSpacing: '0.015em' }}>
            Your workspace is ready. Connect a codebase from your dashboard, paste any AI answer, and Varinth returns a full Proof Object with file-level evidence.
          </p>

          {/* Quick how-to */}
          {[
            { n: '1', t: 'Connect a codebase', d: 'Create a Source Context pointing to your project' },
            { n: '2', t: 'Paste any AI answer', d: 'From ChatGPT, Claude, Copilot — anything' },
            { n: '3', t: 'Get the proof', d: 'File references, agent trace, trust score' },
          ].map(item => (
            <div key={item.n} style={{
              display: 'flex', gap: 14, textAlign: 'left', padding: '12px 0',
              borderBottom: item.n !== '3' ? '1px solid rgba(255,107,69,0.06)' : undefined,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(255,107,69,0.1)', border: '1px solid rgba(255,107,69,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#ff6b45', fontWeight: 700,
              }}>{item.n}</div>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f9f5ff', letterSpacing: '0.015em', marginBottom: 2 }}>{item.t}</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(200,168,150,0.4)', letterSpacing: '0.012em' }}>{item.d}</div>
              </div>
            </div>
          ))}

          <button
            onClick={handleFinish}
            disabled={saving}
            style={{
              marginTop: 32, padding: '13px 44px',
              background: saving ? 'rgba(255,107,69,0.5)' : '#ff6b45',
              border: 'none', borderRadius: 8, color: '#fff',
              fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.015em',
              cursor: saving ? 'wait' : 'pointer',
              boxShadow: '0 0 30px rgba(255,107,69,0.3)',
              display: 'flex', alignItems: 'center', gap: 8, margin: '32px auto 0',
            }}
          >
            {saving
              ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.65s linear infinite' }} />Opening dashboard…</>
              : 'Open Dashboard →'
            }
          </button>
        </div>
      )}

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </main>
  )
}
