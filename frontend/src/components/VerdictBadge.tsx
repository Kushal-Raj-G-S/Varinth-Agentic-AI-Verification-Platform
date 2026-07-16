'use client'

export default function VerdictBadge({ verdict }: { verdict: 'supported' | 'contradicted' | 'unverified' }) {
  const map = {
    supported:    { label: 'Supported',    cls: 'badge-supported' },
    contradicted: { label: 'Contradicted', cls: 'badge-contradicted' },
    unverified:   { label: 'Unverified',   cls: 'badge-unverified' },
  }
  const { label, cls } = map[verdict]
  return <span className={`badge ${cls}`}>{label}</span>
}
