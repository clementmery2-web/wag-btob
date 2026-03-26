'use client'

import { useState, useEffect } from 'react'

interface Offre {
  id: string
  produit_id: string | null
  marque: string | null
  nom_produit: string | null
  acheteur_enseigne: string
  acheteur_email: string
  prix_offre_ht: number
  quantite: number
  attribue: boolean
  expires_at: string | null
  produits: {
    nom: string
    stock_disponible: number
    prix_vente_wag_ht: number
    prix_achat_wag_ht: number | null
  } | null
}

interface Props {
  offres: Offre[]
}

const GRID = '2fr 1fr 90px 80px 90px 70px 70px 100px'

export function OffresAcheteursClient({ offres }: Props) {
  const [vue, setVue] = useState<'fournisseur' | 'acheteur'>('fournisseur')
  const [attribues, setAttribues] = useState<Set<string>>(new Set())
  const [groupesOuverts, setGroupesOuverts] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)
  const [alerteGroupe, setAlerteGroupe] = useState<string | null>(null)

  useEffect(() => {
    if (offres.length > 0) {
      const premierGroupe = offres[0].marque || 'Sans marque'
      setGroupesOuverts(new Set([premierGroupe]))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Helpers ──────────────────────────────────────────────

  const handleAttribuer = async (id: string) => {
    try {
      const res = await fetch(`/api/pricing/offres-acheteurs/${id}`, { method: 'PATCH' })
      if (!res.ok) {
        const data = await res.json()
        console.error('Erreur attribution:', data.error)
        return
      }
      setAttribues(prev => new Set([...prev, id]))
    } catch (e) {
      console.error('Erreur reseau attribution:', e)
    }
  }

  const toggleGroupe = (key: string) => {
    setGroupesOuverts(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const qteLabel = (q: number) => `${q} carton${q > 1 ? 's' : ''}`

  const getMarge = (o: Offre): number | null => {
    const pa = o.produits?.prix_achat_wag_ht
    const pv = o.prix_offre_ht
    if (!pa || pa <= 0 || pv <= 0) return null
    return ((pv - pa) / pv) * 100
  }

  const getMargeColor = (m: number | null): string => {
    if (m === null) return '#9ca3af'
    if (m > 20) return '#16a34a'
    if (m >= 10) return '#d97706'
    return '#dc2626'
  }

  const getTotalGroupe = (items: Offre[]): number =>
    items.reduce((acc, o) => acc + o.prix_offre_ht * o.quantite, 0)

  const getStockRestant = (offre: Offre): number => {
    const stockTotal = offre.produits?.stock_disponible ?? 0
    const dejaAttribue = offres
      .filter(o => o.produit_id === offre.produit_id && attribues.has(o.id) && o.id !== offre.id)
      .reduce((acc, o) => acc + o.quantite, 0)
    return stockTotal - dejaAttribue
  }

  const toutesAttribuees = (items: Offre[]): boolean =>
    items.length > 0 && items.every(o => attribues.has(o.id))

  const handleAttribuerTout = async (key: string, items: Offre[]) => {
    setAlerteGroupe(null)
    const valides = items.filter(o => !attribues.has(o.id) && o.quantite <= getStockRestant(o))
    const invalides = items.filter(o => !attribues.has(o.id) && o.quantite > getStockRestant(o))
    for (const o of valides) {
      try { await handleAttribuer(o.id) } catch (e) { console.error('Erreur attribution:', e) }
    }
    if (invalides.length > 0) {
      setAlerteGroupe(`${invalides.length} ligne(s) non attribuée(s) : stock insuffisant`)
      setTimeout(() => setAlerteGroupe(null), 5000)
    }
  }

  const genererRecap = (groupeKey: string, items: Offre[]): string => {
    const attrib = items.filter(o => attribues.has(o.id))
    const total = attrib.reduce((acc, o) => acc + o.prix_offre_ht * o.quantite, 0)
    const lignes = attrib.map(o => {
      const nom = o.nom_produit ?? o.produits?.nom ?? 'Produit inconnu'
      const st = (o.prix_offre_ht * o.quantite).toFixed(2)
      return `- ${nom} : ${o.prix_offre_ht.toFixed(2)} \u20ac HT \u00d7 ${o.quantite} cartons = ${st} \u20ac HT`
    }).join('\n')
    return `R\u00e9cap offres attribu\u00e9es \u2014 ${groupeKey}\nDate : ${new Date().toLocaleDateString('fr-FR')}\n\n${lignes}\n\nTotal : ${total.toFixed(2)} \u20ac HT d\u00e9part entrep\u00f4t Saint-Ouen\nTransport non inclus\n\nWilly Anti-gaspi \u2014 bonjour@willyantigaspi.fr`
  }

  const handleValiderGroupe = async (groupeKey: string, items: Offre[]) => {
    const texte = genererRecap(groupeKey, items)
    let success = false
    try {
      await navigator.clipboard.writeText(texte)
      success = true
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = texte; ta.style.position = 'fixed'; ta.style.opacity = '0'
        document.body.appendChild(ta); ta.focus(); ta.select()
        success = document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {
        window.prompt('Copiez ce texte manuellement (Ctrl+A puis Ctrl+C) :', texte)
        success = true
      }
    }
    if (success) { setCopied(groupeKey); setTimeout(() => setCopied(null), 3000) }
  }

  // ─── Groupements ──────────────────────────────────────────

  const parMarque = offres.reduce((acc, o) => {
    const key = o.marque || 'Sans marque'
    if (!acc[key]) acc[key] = []
    acc[key].push(o)
    return acc
  }, {} as Record<string, Offre[]>)

  const parAcheteur = offres.reduce((acc, o) => {
    const key = o.acheteur_enseigne
    if (!acc[key]) acc[key] = []
    acc[key].push(o)
    return acc
  }, {} as Record<string, Offre[]>)

  // ─── Render ligne ─────────────────────────────────────────

  const renderLigne = (o: Offre, col2: string) => {
    const estAttribue = attribues.has(o.id)
    const marge = getMarge(o)
    const stockRestant = getStockRestant(o)
    const stockInsuffisant = o.quantite > stockRestant && !estAttribue
    const txtColor = estAttribue ? '#9ca3af' : '#111'

    return (
      <div key={o.id} style={{
        display: 'grid', gridTemplateColumns: GRID, gap: '8px',
        padding: '10px 12px', borderBottom: '1px solid #f3f4f6',
        alignItems: 'center', fontSize: '13px'
      }}>
        <div>
          <p style={{ margin: 0, fontWeight: 500, color: txtColor }}>{o.nom_produit ?? o.produits?.nom ?? '-'}</p>
        </div>
        <span style={{ color: estAttribue ? '#9ca3af' : '#666' }}>{col2}</span>
        <span style={{ color: txtColor, textAlign: 'right' }}>{o.prix_offre_ht.toFixed(2)} &euro;</span>
        <span style={{ color: estAttribue ? '#9ca3af' : '#333', textAlign: 'right' }}>{qteLabel(o.quantite ?? 0)}</span>
        <span style={{ color: txtColor, textAlign: 'right', fontWeight: 500 }}>{(o.prix_offre_ht * o.quantite).toFixed(2)} &euro;</span>
        <span style={{ color: estAttribue ? '#9ca3af' : '#666', textAlign: 'right' }}>
          {o.produits?.prix_achat_wag_ht != null ? `${o.produits.prix_achat_wag_ht.toFixed(2)} \u20ac` : '\u2014'}
        </span>
        <span style={{ color: getMargeColor(marge), textAlign: 'right', fontWeight: 500 }}>
          {marge !== null ? `${marge.toFixed(1)}%` : '\u2014'}
        </span>
        <div style={{ textAlign: 'center' }}>
          {stockInsuffisant && (
            <span style={{ fontSize: '11px', color: '#dc2626', display: 'block', marginBottom: '2px' }}>
              Stock insuffisant ({stockRestant})
            </span>
          )}
          {estAttribue ? (
            <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 500 }}>&#10003; Attribuée</span>
          ) : (
            <button
              disabled={stockInsuffisant}
              onClick={() => handleAttribuer(o.id)}
              style={{
                background: stockInsuffisant ? '#f3f4f6' : '#4f46e5',
                color: stockInsuffisant ? '#9ca3af' : 'white',
                border: 'none', borderRadius: '6px', padding: '4px 10px',
                fontSize: '12px', fontWeight: 500,
                cursor: stockInsuffisant ? 'not-allowed' : 'pointer'
              }}
            >
              Attribuer
            </button>
          )}
        </div>
      </div>
    )
  }

  // ─── Render groupe ────────────────────────────────────────

  const renderGroupe = (key: string, items: Offre[], col2Header: string, getCol2: (o: Offre) => string) => {
    const ouvert = groupesOuverts.has(key)
    const lignesNonAttribuees = items.filter(o => !attribues.has(o.id))
    return (
      <div key={key} style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: '12px' }}>
        {/* Header */}
        <div
          onClick={() => toggleGroupe(key)}
          style={{ padding: '12px 16px', borderBottom: ouvert ? '1px solid #f3f4f6' : 'none', background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#888' }}>{ouvert ? '\u25BC' : '\u25B6'}</span>
            <div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#111' }}>{key}</span>
              <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>{items.length} offre{items.length > 1 ? 's' : ''}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#4f46e5' }}>Valeur totale : {getTotalGroupe(items).toFixed(2)} &euro; HT</span>
            {lignesNonAttribuees.length > 0 && (
              <button
                onClick={() => handleAttribuerTout(key, items)}
                style={{ background: 'transparent', border: '1px solid #4f46e5', color: '#4f46e5', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', cursor: 'pointer' }}
              >
                Attribuer tout
              </button>
            )}
            {toutesAttribuees(items) && (
              <button
                onClick={() => handleValiderGroupe(key, items)}
                style={{
                  background: copied === key ? '#f0fdf4' : '#16a34a',
                  color: copied === key ? '#16a34a' : 'white',
                  border: copied === key ? '1px solid #bbf7d0' : 'none',
                  borderRadius: '6px', padding: '4px 12px', fontSize: '12px', fontWeight: 500, cursor: 'pointer'
                }}
              >
                {copied === key ? '\u2713 Récap copié !' : 'Valider et copier le récap'}
              </button>
            )}
          </div>
        </div>
        {alerteGroupe && (
          <p style={{ fontSize: '12px', color: '#dc2626', margin: '0', padding: '4px 16px', background: '#fef2f2' }}>{alerteGroupe}</p>
        )}
        {/* Contenu */}
        {ouvert && (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            {/* Col header */}
            <div style={{
              display: 'grid', gridTemplateColumns: GRID, gap: '8px',
              padding: '6px 12px', borderBottom: '1px solid #e5e7eb',
              fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              <span>Produit</span>
              <span>{col2Header}</span>
              <span style={{ textAlign: 'right' }}>Prix proposé HT</span>
              <span style={{ textAlign: 'right' }}>Qté (cartons)</span>
              <span style={{ textAlign: 'right' }}>Total ligne</span>
              <span style={{ textAlign: 'right' }}>PA HT</span>
              <span style={{ textAlign: 'right' }}>Marge</span>
              <span style={{ textAlign: 'center' }}>Action</span>
            </div>
            {items.map(o => renderLigne(o, getCol2(o)))}
          </div>
        )}
      </div>
    )
  }

  // ─── Render principal ─────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111', margin: 0 }}>Offres acheteurs</h1>
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '8px', padding: '2px' }}>
          <button
            onClick={() => setVue('fournisseur')}
            style={{
              padding: '6px 12px', fontSize: '12px', fontWeight: 500, borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: vue === 'fournisseur' ? 'white' : 'transparent',
              color: vue === 'fournisseur' ? '#111' : '#888',
              boxShadow: vue === 'fournisseur' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            Par fournisseur
          </button>
          <button
            onClick={() => setVue('acheteur')}
            style={{
              padding: '6px 12px', fontSize: '12px', fontWeight: 500, borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: vue === 'acheteur' ? 'white' : 'transparent',
              color: vue === 'acheteur' ? '#111' : '#888',
              boxShadow: vue === 'acheteur' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            Par acheteur
          </button>
        </div>
      </div>

      {offres.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 0', fontSize: '14px', color: '#9ca3af' }}>Aucune offre en attente</div>
      )}

      {vue === 'fournisseur' && Object.entries(parMarque).map(([key, items]) =>
        renderGroupe(key, items, 'Acheteur', o => o.acheteur_enseigne)
      )}

      {vue === 'acheteur' && Object.entries(parAcheteur).map(([key, items]) =>
        renderGroupe(key, items, 'Marque', o => o.marque ?? '-')
      )}
    </div>
  )
}
