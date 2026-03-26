'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

interface NavBarProps {
  nbMercuriales?: number
  nbProduitsValider?: number
  nbProduitsLigne?: number
  nbOffresAcheteurs?: number
}

export default function NavBar({
  nbMercuriales = 0,
  nbProduitsValider = 0,
  nbProduitsLigne = 0,
  nbOffresAcheteurs = 0,
}: NavBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [hovered, setHoveredState] = useState<string | null>(null)

  const handleDeconnexion = async () => {
    await fetch('/api/pricing/auth', { method: 'DELETE' })
    router.push('/pricing/login')
    router.refresh()
  }

  const isActive = (href: string) =>
    href === '/pricing/offres'
      ? pathname === '/pricing/offres' || (pathname.startsWith('/pricing/offres/') && !pathname.startsWith('/pricing/offres-acheteurs'))
      : pathname === href || pathname.startsWith(href + '/')

  const hover = (id: string) => () => setHoveredState(id)
  const unhover = () => setHoveredState(null)

  const linkStyle = (href: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '0 12px', height: '52px', fontSize: '12px',
    color: isActive(href) ? '#16a34a' : '#6b7280',
    fontWeight: isActive(href) ? 500 : 400,
    textDecoration: 'none',
    borderBottom: isActive(href) ? '2.5px solid #16a34a' : '2px solid transparent',
    background: (isActive(href) || hovered === href) ? '#f9fafb' : 'transparent',
    whiteSpace: 'nowrap', flexShrink: 0, transition: 'background 0.15s',
  })

  const utilLinkStyle = (href: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '0 10px', height: '52px', fontSize: '12px',
    color: isActive(href) ? '#16a34a' : '#9ca3af',
    fontWeight: isActive(href) ? 500 : 400,
    textDecoration: 'none',
    borderBottom: isActive(href) ? '2.5px solid #16a34a' : '2px solid transparent',
    background: hovered === href ? '#f9fafb' : 'transparent',
    whiteSpace: 'nowrap', flexShrink: 0, transition: 'background 0.15s',
  })

  const Badge = ({ count, variant }: { count: number; variant: 'blue' | 'green' | 'red' }) => {
    if (count === 0) return null
    const styles = {
      blue:  { background: '#dbeafe', color: '#1d4ed8' },
      green: { background: '#16a34a', color: 'white' },
      red:   { background: '#dc2626', color: 'white' },
    }
    return (
      <span style={{ ...styles[variant], fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '9999px' }}>
        {count}
      </span>
    )
  }

  const Sep = () => (
    <div style={{ width: '1px', height: '20px', background: '#e5e7eb', margin: '0 0.5rem', flexShrink: 0 }} />
  )

  const hasActivity = nbMercuriales > 0 || nbProduitsValider > 0 || nbProduitsLigne > 0 || nbOffresAcheteurs > 0

  return (
    <nav style={{
      background: 'white',
      borderBottom: '0.5px solid #e5e7eb',
      position: 'sticky', top: 0, zIndex: 40,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 1.25rem', height: '52px' }}>
        <Link href="/pricing/dashboard" style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          fontWeight: 500, fontSize: '14px', color: '#111827',
          textDecoration: 'none', marginRight: '1.25rem', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px', fontWeight: 700 }}>W</div>
          WAG B2B
        </Link>

        <Sep />

        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <Link href="/pricing/offres" style={linkStyle('/pricing/offres')} onMouseEnter={hover('/pricing/offres')} onMouseLeave={unhover}>
            Mercuriales<Badge count={nbMercuriales} variant="blue" />
          </Link>
          <Link href="/pricing/validation-pricing" style={linkStyle('/pricing/validation-pricing')} onMouseEnter={hover('/pricing/validation-pricing')} onMouseLeave={unhover}>
            Validation pricing<Badge count={nbProduitsValider} variant="green" />
          </Link>
          <Link href="/pricing/produits-en-ligne" style={linkStyle('/pricing/produits-en-ligne')} onMouseEnter={hover('/pricing/produits-en-ligne')} onMouseLeave={unhover}>
            Produits en ligne
            <Badge count={nbProduitsLigne} variant="green" />
          </Link>
          <Link href="/pricing/offres-acheteurs" style={linkStyle('/pricing/offres-acheteurs')} onMouseEnter={hover('/pricing/offres-acheteurs')} onMouseLeave={unhover}>
            Offres acheteurs<Badge count={nbOffresAcheteurs} variant="red" />
          </Link>
          <Link href="/pricing/attribution" style={linkStyle('/pricing/attribution')} onMouseEnter={hover('/pricing/attribution')} onMouseLeave={unhover}>
            Attribution
          </Link>
        </div>

        <Sep />

        <Link href="/pricing/analytics" style={utilLinkStyle('/pricing/analytics')} onMouseEnter={hover('/pricing/analytics')} onMouseLeave={unhover}>
          Analytics
        </Link>
        <Link href="/pricing/docs" style={utilLinkStyle('/pricing/docs')} onMouseEnter={hover('/pricing/docs')} onMouseLeave={unhover}>
          Docs
        </Link>

        <Sep />

        <button onClick={handleDeconnexion} style={{ fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Déconnexion
        </button>
      </div>

      {hasActivity && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '16px',
          padding: '5px 1.25rem', fontSize: '11px',
          background: '#f9fafb', borderTop: '0.5px solid #e5e7eb',
        }}>
          <span style={{ color: '#9ca3af' }}>En cours :</span>
          {nbMercuriales > 0 && <span style={{ color: '#1d4ed8', fontWeight: 500 }}>{nbMercuriales} nouvelle{nbMercuriales > 1 ? 's' : ''} mercuriale{nbMercuriales > 1 ? 's' : ''}</span>}
          {nbProduitsValider > 0 && <span style={{ color: '#16a34a', fontWeight: 500 }}>{nbProduitsValider} produit{nbProduitsValider > 1 ? 's' : ''} à valider</span>}
          {nbOffresAcheteurs > 0 && <span style={{ color: '#dc2626', fontWeight: 500 }}>{nbOffresAcheteurs} offre{nbOffresAcheteurs > 1 ? 's' : ''} urgente{nbOffresAcheteurs > 1 ? 's' : ''}</span>}
          {nbProduitsLigne > 0 && <span style={{ color: '#15803d' }}>{nbProduitsLigne} produit{nbProduitsLigne > 1 ? 's' : ''} en ligne</span>}
        </div>
      )}
    </nav>
  )
}
