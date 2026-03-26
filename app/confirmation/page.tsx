'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const WAG_EMAIL = 'contact@willyantigaspi.fr'

interface OffreRecap {
  nom: string
  marque: string
  prixOffre: number
  quantite: number
  sousTotal: number
}

interface ConfirmationData {
  offres: OffreRecap[]
  totalHT: number
  prenomNom: string
  nomEnseigne: string
  email: string
  date: string
}

export default function ConfirmationPage() {
  const router = useRouter()
  const [data, setData] = useState<ConfirmationData | null>(null)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    let redirecting = false
    const raw = localStorage.getItem('wag_confirmation')

    if (!raw) {
      redirecting = true
      router.push('/')
    } else {
      try {
        const parsed = JSON.parse(raw)
        setData(parsed)
        localStorage.removeItem('wag_confirmation')
      } catch {
        redirecting = true
        router.push('/')
      }
    }

    if (!redirecting) {
      setChargement(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    document.title = 'Confirmation \u2014 Willy Anti-gaspi'
  }, [])

  if (chargement || !data) {
    return (
      <main style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontFamily: 'sans-serif'
      }}>
        <p style={{ color: '#888', fontSize: '14px' }}>Chargement...</p>
      </main>
    )
  }

  const totalHTNum = Number(data.totalHT)

  const mailtoBody =
    `Bonjour,%0D%0A%0D%0A` +
    `Je souhaite avoir des informations sur mes offres ` +
    `envoy%C3%A9es le ${data.date}.%0D%0A%0D%0A` +
    `Cordialement,%0D%0A${encodeURIComponent(data.prenomNom)}`

  const mailtoSubject = encodeURIComponent(
    `Suivi offres du ${data.date}${data.nomEnseigne ? ' \u2014 ' + data.nomEnseigne : ''}`
  )

  return (
    <main style={{
      fontFamily: 'sans-serif',
      maxWidth: '640px',
      margin: '0 auto',
      padding: '2rem 1rem'
    }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '2rem'
      }}>
        <div style={{
          width: '28px', height: '28px',
          background: '#16a34a', borderRadius: '50%',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'white',
          fontSize: '14px', fontWeight: 700,
          flexShrink: 0
        }}>W</div>
        <span style={{
          fontWeight: 600, color: '#16a34a', fontSize: '16px'
        }}>
          Willy Anti-gaspi
        </span>
        <span style={{
          fontSize: '11px', color: '#888',
          letterSpacing: '0.08em', textTransform: 'uppercase' as const
        }}>
          CATALOGUE BTOB
        </span>
      </div>

      {/* Bloc confirmation */}
      <div style={{
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        textAlign: 'center' as const
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>&#9989;</div>
        <h1 style={{
          fontSize: '20px', fontWeight: 600,
          color: '#15803d', margin: '0 0 8px'
        }}>
          Offres envoyees !
        </h1>
        <p style={{ fontSize: '14px', color: '#166534', margin: 0 }}>
          WAG vous contacte sous 24h sur{' '}
          <strong>{data.email || WAG_EMAIL}</strong>
        </p>
      </div>

      {/* Recap acheteur */}
      {(data.prenomNom || data.nomEnseigne) && (
        <div style={{
          fontSize: '13px', color: '#666', marginBottom: '1rem'
        }}>
          <strong style={{ color: '#333' }}>
            {data.prenomNom || 'Acheteur'}
          </strong>
          {data.nomEnseigne && ` \u2014 ${data.nomEnseigne}`}
          {' \u00B7 '}Envoye le {data.date}
        </div>
      )}

      {/* Tableau recap */}
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden',
        marginBottom: '1.5rem'
      }}>
        {/* Header tableau */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 80px 60px 90px',
          gap: '8px',
          padding: '8px 12px',
          background: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          fontSize: '11px', color: '#888',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em'
        }}>
          <span>Produit</span>
          <span>Prix HT</span>
          <span>Qte</span>
          <span style={{ textAlign: 'right' as const }}>Sous-total</span>
        </div>

        {/* Lignes produits */}
        {data.offres.map((o, i) => (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '2fr 80px 60px 90px',
            gap: '8px',
            padding: '10px 12px',
            borderBottom: i < data.offres.length - 1
              ? '1px solid #f3f4f6' : 'none',
            fontSize: '13px',
            alignItems: 'center'
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 500, color: '#111' }}>
                {o.nom}
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>
                {o.marque}
              </p>
            </div>
            <span style={{ color: '#333' }}>
              {Number(o.prixOffre).toFixed(2)} &euro;
            </span>
            <span style={{ color: '#333' }}>
              {o.quantite} ctn
            </span>
            <span style={{
              textAlign: 'right' as const,
              fontWeight: 500, color: '#111'
            }}>
              {Number(o.sousTotal).toFixed(2)} &euro;
            </span>
          </div>
        ))}

        {/* Ligne total */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 80px 60px 90px',
          gap: '8px',
          padding: '10px 12px',
          background: '#f9fafb',
          borderTop: '1px solid #e5e7eb',
          fontSize: '13px', fontWeight: 600
        }}>
          <span style={{ color: '#333' }}>Total</span>
          <span></span>
          <span></span>
          <span style={{
            textAlign: 'right' as const, color: '#15803d'
          }}>
            {totalHTNum.toFixed(2)} &euro; HT
          </span>
        </div>
      </div>

      {/* Note depart entrepot */}
      <p style={{
        fontSize: '12px', color: '#888',
        textAlign: 'center' as const, marginBottom: '1.5rem'
      }}>
        Prix depart entrepot Saint-Ouen &mdash; Transport non inclus
      </p>

      {/* Boutons */}
      <div style={{
        display: 'flex', gap: '12px', flexDirection: 'column' as const
      }}>
        <button
          onClick={() => router.push('/')}
          style={{
            width: '100%', padding: '12px',
            background: '#16a34a', color: 'white',
            border: 'none', borderRadius: '8px',
            fontSize: '14px', fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          Voir de nouvelles offres &rarr;
        </button>

        <a
          href={`mailto:${WAG_EMAIL}?subject=${mailtoSubject}&body=${mailtoBody}`}
          style={{
            width: '100%', padding: '12px',
            background: 'white', color: '#16a34a',
            border: '1px solid #16a34a', borderRadius: '8px',
            fontSize: '14px', fontWeight: 500,
            textAlign: 'center' as const,
            textDecoration: 'none', display: 'block',
            boxSizing: 'border-box' as const
          }}
        >
          Contacter WAG par email
        </a>
      </div>

    </main>
  )
}
