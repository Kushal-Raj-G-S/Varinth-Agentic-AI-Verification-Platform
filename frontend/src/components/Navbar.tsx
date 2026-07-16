'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Navbar({ email }: { email?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.refresh()
    router.push('/login')
  }

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      height: 'var(--nav-h)',
      background: 'rgba(13, 5, 16, 0.85)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderBottom: '1px solid var(--border-1)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 var(--s8)',
      gap: 'var(--s8)',
    }}>
      <Link href="/dashboard" style={{
        fontFamily: 'var(--font-display)',
        fontSize: '1.25rem',
        letterSpacing: '-0.04em',
        color: 'var(--text-1)',
        textDecoration: 'none',
      }}>
        Varinth<span style={{ color: 'var(--text-3)' }}>.engine</span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
        <Link
          href="/dashboard"
          className={`nav-link ${pathname === '/dashboard' ? 'active' : ''}`}
        >
          Audits
        </Link>
        <Link
          href="/contexts"
          className={`nav-link ${pathname.startsWith('/contexts') ? 'active' : ''}`}
        >
          Sources
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {email && (
          <span style={{
            fontSize: '0.78rem',
            color: 'var(--text-4)',
            fontFamily: 'var(--font-mono)',
            maxWidth: 180,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {email}
          </span>
        )}
        <button onClick={handleLogout} className="btn btn-secondary btn-sm">
          Sign out
        </button>
      </div>
    </nav>
  )
}
