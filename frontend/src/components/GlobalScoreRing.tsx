'use client'

import { useEffect, useState } from 'react'

export default function GlobalScoreRing({ score, size = 100 }: { score: number | null; size?: number }) {
  const radius = 40
  const strokeWidth = 7
  const circumference = 2 * Math.PI * radius
  const [offset, setOffset] = useState(circumference)

  useEffect(() => {
    const progress = score === null ? 0 : score
    setOffset(circumference - progress * circumference)
  }, [score, circumference])

  const pct = score === null ? 0 : Math.round(score * 100)
  const color = score === null ? 'var(--text-3)' : pct >= 80 ? 'var(--teal)' : pct >= 50 ? 'var(--amber)' : 'var(--crimson)'

  return (
    <div className="score-ring-container" style={{ width: size, height: size }}>
      <svg className="score-ring-svg" width={size} height={size} viewBox="0 0 100 100">
        {/* Track */}
        <circle cx="50" cy="50" r={radius} fill="transparent" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
        {/* Progress */}
        <circle
          cx="50" cy="50" r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1)', filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <div className="score-ring-text">
        <div className="score-ring-value" style={{ fontSize: `${size * 0.2}px`, color }}>
          {score === null ? '–' : `${pct}%`}
        </div>
        <div className="score-ring-label" style={{ fontSize: `${size * 0.095}px` }}>
          Trust
        </div>
      </div>
    </div>
  )
}
