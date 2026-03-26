'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────

interface ProduitPricing {
  id: string
  nom: string
  ean: string | null
  marque: string | null
  fournisseur_nom: string | null
  stock_disponible: number | null
  qmc: number | null
  prix_achat_wag_ht: number
  pmc_fournisseur: number | null
  pmc_reference: number | null
  dluo: string | null
  statut: string
  created_at: string
}

interface GroupeFournisseur {
  nom: string
  produits: ProduitPricing[]
  ouvert: boolean
  owner: string
}

// ─── Couleurs scénarios ───────────────────────────────────────

const COLORS = {
  A: '#1D9E75', B: '#1D9E75', C: '#EF9F27', D: '#E24B4A', PMC_REQUIS: '#EF9F27'
} as const

const OPERATORS = ['Chloé', 'Juliette', 'Solène', 'Clément', 'Jonathan', 'Marc', 'Eva']
const GRID = '1.8fr 90px 80px 65px 110px 72px 80px 130px 85px'

// ─── Pricing logic ────────────────────────────────────────────

type Scenario = 'A' | 'B' | 'C' | 'D' | 'PMC_REQUIS'

const getScenario = (pa: number, pmc: number | null): Scenario => {
  if (!pmc || pmc <= 0) return 'PMC_REQUIS'
  const ratio = pa / pmc
  if (ratio < 0.30) return 'A'
  if (ratio <= 0.55) return 'B'
  const gap = (pa - pmc * 0.55 / 1.15) / pa
  if (gap < 0.40) return 'C'
  return 'D'
}

const getMultiplicateur = (pa: number, pmc: number): number => {
  const s = getScenario(pa, pmc)
  if (s === 'A') return Math.round((pmc * 0.40 / pa) * 100) / 100
  if (s === 'B') return Math.round((pmc * 0.55 / pa) * 100) / 100
  return 0
}

const getPrixVente = (pa: number, pmc: number): number | null => {
  const s = getScenario(pa, pmc)
  if (s === 'A') return Math.round(pmc * 0.40 * 100) / 100
  if (s === 'B') return Math.round(pmc * 0.55 * 100) / 100
  return null
}

const getMarge = (pa: number, pv: number): number =>
  Math.round((pv - pa) / pv * 1000) / 10

const getRatio = (pa: number, pmc: number): number =>
  Math.round(pa / pmc * 100)

const getCibleNego = (pmc: number): number =>
  Math.round(pmc * 0.55 / 1.15 * 100) / 100

const getJours = (dluo: string | null): number | null => {
  if (!dluo) return null
  return Math.ceil((new Date(dluo).getTime() - Date.now()) / 86400000)
}

// ─── Email generation ─────────────────────────────────────────

const genererEmail = (groupe: GroupeFournisseur, tab: 1 | 2 | 3): string => {
  const date = new Date().toLocaleDateString('fr-FR')
  const nego = groupe.produits.filter(p => p.statut === 'nego_fournisseur' || getScenario(p.prix_achat_wag_ht, p.pmc_reference) === 'C')
  const refuses = groupe.produits.filter(p => getScenario(p.prix_achat_wag_ht, p.pmc_reference) === 'D')
  const valides = groupe.produits.filter(p => { const s = getScenario(p.prix_achat_wag_ht, p.pmc_reference); return s === 'A' || s === 'B' })
  const pmcManquants = groupe.produits.filter(p => getScenario(p.prix_achat_wag_ht, p.pmc_reference) === 'PMC_REQUIS')

  const ligneNego = (p: ProduitPricing) => {
    const cible = getCibleNego(p.pmc_reference!)
    const ecart = Math.round((cible - p.prix_achat_wag_ht) / p.prix_achat_wag_ht * 100)
    return `- ${p.nom} : votre prix ${p.prix_achat_wag_ht.toFixed(2)} \u20ac HT \u2192 notre cible ${cible.toFixed(2)} \u20ac HT (${ecart > 0 ? '+' : ''}${ecart}%)`
  }

  if (tab === 1) return `Objet : Contre-offre \u2014 mercuriale du ${date}\n\nBonjour,\n\nNous souhaitons vous soumettre une contre-offre sur les r\u00e9f\u00e9rences suivantes :\n\n${nego.map(ligneNego).join('\n')}\n\nMerci de confirmer votre accord ou de proposer un prix interm\u00e9diaire.\n\nCordialement,\nWilly Anti-gaspi \u2014 bonjour@willyantigaspi.fr`

  if (tab === 2) return `Objet : Contre-offre et refus \u2014 mercuriale du ${date}\n\nBonjour,\n\nCONTRE-OFFRES :\n${nego.map(ligneNego).join('\n')}\n\nPRODUITS REFUS\u00c9S :\n${refuses.map(p => `\u2717 ${p.nom} \u2014 ${p.prix_achat_wag_ht.toFixed(2)} \u20ac HT \u2014 PA sup\u00e9rieur au PMC`).join('\n')}\n\nCordialement,\nWilly Anti-gaspi \u2014 bonjour@willyantigaspi.fr`

  return `Objet : Bilan complet \u2014 mercuriale du ${date}\n\nBonjour,\n\nPRODUITS ACCEPT\u00c9S (${valides.length}) :\n${valides.map(p => { const pv = getPrixVente(p.prix_achat_wag_ht, p.pmc_reference!); return `\u2713 ${p.nom} \u2014 Prix valid\u00e9 : ${pv?.toFixed(2)} \u20ac HT` }).join('\n')}\n\nCONTRE-OFFRES (${nego.length}) :\n${nego.map(ligneNego).join('\n')}${pmcManquants.length > 0 ? `\n\nEN ATTENTE PMC (${pmcManquants.length}) :\n${pmcManquants.map(p => `? ${p.nom} \u2014 PMC non disponible`).join('\n')}` : ''}\n\nPRODUITS REFUS\u00c9S (${refuses.length}) :\n${refuses.map(p => `\u2717 ${p.nom} \u2014 PA sup\u00e9rieur au PMC, non rentable`).join('\n')}\n\nCordialement,\nWilly Anti-gaspi \u2014 bonjour@willyantigaspi.fr`
}

// ─── Component ────────────────────────────────────────────────

export function PricingValidationClient() {
  const [groupes, setGroupes] = useState<GroupeFournisseur[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [emailPanel, setEmailPanel] = useState<string | null>(null)
  const [emailTab, setEmailTab] = useState<1 | 2 | 3>(1)
  const [refusConfirm, setRefusConfirm] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/pricing/validation')
      .then(r => r.json())
      .then(({ produits }) => {
        const map: Record<string, ProduitPricing[]> = {}
        produits?.forEach((p: ProduitPricing) => {
          const key = p.fournisseur_nom || 'Autre'
          if (!map[key]) map[key] = []
          map[key].push(p)
        })
        setGroupes(Object.entries(map).map(([nom, prods]) => ({
          nom, produits: prods, ouvert: true, owner: ''
        })))
      })
      .finally(() => setLoading(false))
  }, [])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const toggleGroupe = (nom: string) => {
    setGroupes(prev => prev.map(g => g.nom === nom ? { ...g, ouvert: !g.ouvert } : g))
  }

  const updateOwner = (nom: string, owner: string) => {
    setGroupes(prev => prev.map(g => g.nom === nom ? { ...g, owner } : g))
  }

  const updatePmcWag = (produitId: string, value: number) => {
    setGroupes(prev => prev.map(g => ({
      ...g, produits: g.produits.map(p => p.id === produitId ? { ...p, pmc_reference: value } : p)
    })))
  }

  const patchProduit = async (id: string, updates: Record<string, unknown>) => {
    const res = await fetch(`/api/pricing/produits/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    return res.ok
  }

  const retirer = (produitId: string) => {
    setGroupes(prev => prev.map(g => ({
      ...g, produits: g.produits.filter(p => p.id !== produitId)
    })).filter(g => g.produits.length > 0))
  }

  const validerProduit = async (produit: ProduitPricing) => {
    const pmc = produit.pmc_reference
    if (!pmc) return
    const pv = getPrixVente(produit.prix_achat_wag_ht, pmc)
    if (!pv) return
    const ok = await patchProduit(produit.id, {
      statut: 'valide', visible_catalogue: true, prix_vente_wag_ht: pv, pmc_reference: pmc
    })
    if (ok) { retirer(produit.id); showToast('\u2713 Produit publi\u00e9 dans le catalogue acheteur') }
  }

  const validerGroupe = async (groupeNom: string) => {
    const g = groupes.find(gr => gr.nom === groupeNom)
    if (!g) return
    const prets = g.produits.filter(p => { const s = getScenario(p.prix_achat_wag_ht, p.pmc_reference); return s === 'A' || s === 'B' })
    for (const p of prets) await validerProduit(p)
  }

  const confirmerRefus = async (produit: ProduitPricing) => {
    const ok = await patchProduit(produit.id, { statut: 'refuse', visible_catalogue: false })
    if (ok) { retirer(produit.id); setRefusConfirm(null); showToast('Produit refus\u00e9 et archiv\u00e9') }
  }

  const passerEnNego = async (produitId: string) => {
    await patchProduit(produitId, { statut: 'nego_fournisseur' })
    setGroupes(prev => prev.map(g => ({
      ...g, produits: g.produits.map(p => p.id === produitId ? { ...p, statut: 'nego_fournisseur' } : p)
    })))
  }

  const updatePaApresNego = (produitId: string, nouveauPa: number) => {
    setGroupes(prev => prev.map(g => ({
      ...g, produits: g.produits.map(p => p.id === produitId ? { ...p, prix_achat_wag_ht: nouveauPa, statut: 'en_attente' } : p)
    })))
  }

  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text) } catch { /* fallback */ }
    showToast('\u2713 Copi\u00e9')
  }

  // ─── Render ─────────────────────────────────────────────────

  if (loading) return (
    <div className="text-center py-16">
      <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-500 mt-2">Chargement...</p>
    </div>
  )

  return (
    <div className="space-y-4 relative">
      <h1 className="text-2xl font-bold text-gray-900">Validation pricing</h1>

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 text-green-700 text-sm font-medium px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {groupes.length === 0 && (
        <div className="text-center py-16 text-sm text-gray-400">Aucun produit en attente de validation</div>
      )}

      {groupes.map(groupe => {
        const prets = groupe.produits.filter(p => { const s = getScenario(p.prix_achat_wag_ht, p.pmc_reference); return s === 'A' || s === 'B' })
        const pmcManquants = groupe.produits.filter(p => getScenario(p.prix_achat_wag_ht, p.pmc_reference) === 'PMC_REQUIS')
        const enNego = groupe.produits.filter(p => p.statut === 'nego_fournisseur')
        const refuses = groupe.produits.filter(p => getScenario(p.prix_achat_wag_ht, p.pmc_reference) === 'D')

        return (
          <div key={groupe.nom} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3 flex-wrap">
              <button onClick={() => toggleGroupe(groupe.nom)} className="text-gray-400 text-xs">
                {groupe.ouvert ? '\u25BC' : '\u25B6'}
              </button>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-gray-900">{groupe.nom}</span>
                <span className="text-xs text-gray-500 ml-2">{groupe.produits.length} produits</span>
              </div>
              {!groupe.ouvert && (
                <span className="text-xs text-gray-500">
                  {prets.length} pr\u00eats \u00B7 {pmcManquants.length} PMC \u00B7 {enNego.length} n\u00e9go
                </span>
              )}
              <select
                value={groupe.owner}
                onChange={e => updateOwner(groupe.nom, e.target.value)}
                onClick={e => e.stopPropagation()}
                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
              >
                <option value="">\u2014 Assigner</option>
                {OPERATORS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              {prets.length > 0 && (
                <button
                  onClick={e => { e.stopPropagation(); validerGroupe(groupe.nom) }}
                  className="text-xs font-medium text-white bg-green-600 hover:bg-green-700 px-3 py-1 rounded-md"
                >
                  \u2713 Valider les {prets.length} pr\u00eats
                </button>
              )}
              {enNego.length > 0 && (
                <button
                  onClick={e => { e.stopPropagation(); setEmailPanel(emailPanel === groupe.nom ? null : groupe.nom) }}
                  className="text-xs font-medium text-indigo-600 border border-indigo-300 hover:bg-indigo-50 px-3 py-1 rounded-md"
                >
                  G\u00e9n\u00e9rer email
                </button>
              )}
            </div>

            {groupe.ouvert && (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-4 gap-2 px-4 py-2 text-xs">
                  <span className="text-green-600 font-medium">{prets.length} Pr\u00eats</span>
                  <span className="text-amber-600 font-medium">{pmcManquants.length} PMC manquant</span>
                  <span className="text-orange-600 font-medium">{enNego.length} En n\u00e9go</span>
                  <span className="text-red-600 font-medium">{refuses.length} Refus\u00e9s</span>
                </div>

                <div style={{ overflowX: 'auto', width: '100%' }}>
                  {/* Col header */}
                  <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '4px', padding: '6px 12px', borderBottom: '1px solid #e5e7eb', fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: '900px' }}>
                    <span>Produit</span>
                    <span>EAN</span>
                    <span>Stock</span>
                    <span>PA HT</span>
                    <span>PMC</span>
                    <span>PA/PMC</span>
                    <span>DDM</span>
                    <span>Sc\u00e9nario</span>
                    <span>Action</span>
                  </div>

                  {/* Lignes */}
                  {groupe.produits.map(produit => {
                    const pmc = produit.pmc_reference
                    const scenario = getScenario(produit.prix_achat_wag_ht, pmc)
                    const ratio = pmc ? getRatio(produit.prix_achat_wag_ht, pmc) : null
                    const pv = pmc ? getPrixVente(produit.prix_achat_wag_ht, pmc) : null
                    const mult = pmc ? getMultiplicateur(produit.prix_achat_wag_ht, pmc) : null
                    const marge = pv ? getMarge(produit.prix_achat_wag_ht, pv) : null
                    const jours = getJours(produit.dluo)
                    const enNegoLigne = produit.statut === 'nego_fournisseur'

                    return (
                      <div key={produit.id} style={{
                        display: 'grid', gridTemplateColumns: GRID, gap: '4px',
                        padding: '8px 12px', borderBottom: '1px solid #f3f4f6',
                        borderLeft: `3px solid ${COLORS[scenario]}`,
                        alignItems: 'center', fontSize: '13px', minWidth: '900px'
                      }}>
                        {/* Produit */}
                        <div>
                          <p style={{ margin: 0, fontWeight: 500, color: '#111', cursor: 'pointer' }} onClick={() => copyText(produit.nom)} title="Copier">{produit.nom}</p>
                        </div>

                        {/* EAN */}
                        <span style={{ color: '#666', cursor: produit.ean ? 'pointer' : 'default' }} onClick={() => produit.ean && copyText(produit.ean)} title={produit.ean ? 'Copier' : undefined}>
                          {produit.ean || '\u2014'}
                        </span>

                        {/* Stock */}
                        <span style={{ color: '#333' }}>{produit.stock_disponible ?? '\u2014'} ctn</span>

                        {/* PA HT */}
                        <div>
                          {enNegoLigne ? (
                            <>
                              <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '11px' }}>{produit.prix_achat_wag_ht.toFixed(2)}</span>
                              <input type="number" step="0.01" placeholder="Nv PA" style={{ width: '58px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', padding: '2px 4px' }}
                                onChange={e => { const v = parseFloat(e.target.value); if (v > 0) updatePaApresNego(produit.id, v) }} />
                            </>
                          ) : (
                            <span style={{ fontWeight: 500 }}>{produit.prix_achat_wag_ht.toFixed(2)} \u20ac</span>
                          )}
                        </div>

                        {/* PMC */}
                        <div>
                          <span style={{ fontSize: '10px', color: '#888' }}>
                            {produit.pmc_fournisseur ? `${produit.pmc_fournisseur.toFixed(2)} fourn.` : '\u2014 fourn.'}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <input type="number" step="0.01" value={pmc ?? ''} placeholder="PMC" style={{ width: '66px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', padding: '2px 4px' }}
                              onChange={e => updatePmcWag(produit.id, parseFloat(e.target.value) || 0)} />
                            <span style={{ fontSize: '10px', color: '#888' }}>\u270E</span>
                          </div>
                        </div>

                        {/* PA/PMC */}
                        {ratio !== null ? (
                          <span style={{ fontWeight: 600, color: COLORS[scenario], fontSize: '12px' }}>{ratio}%</span>
                        ) : <span style={{ color: '#ccc' }}>\u2014</span>}

                        {/* DDM */}
                        <div>
                          {produit.dluo ? (
                            <>
                              <span style={{ fontSize: '12px', color: jours !== null && jours < 30 ? '#854F0B' : '#3B6D11' }}>
                                {new Date(produit.dluo).toLocaleDateString('fr-FR')}
                              </span>
                              {jours !== null && <span style={{ fontSize: '10px', color: '#888', marginLeft: '2px' }}>{jours}j</span>}
                            </>
                          ) : <span style={{ color: '#ccc' }}>\u2014</span>}
                        </div>

                        {/* Scenario */}
                        <div>
                          {scenario === 'PMC_REQUIS' && <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px' }}>PMC requis</span>}
                          {scenario === 'A' && (
                            <div>
                              <span style={{ background: '#d1fae5', color: '#065f46', fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px' }}>A \u2014 JACKPOT</span>
                              <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#666' }}>PA \u00d7{mult} \u2192 {pv?.toFixed(2)} \u20ac</p>
                              <span style={{ fontSize: '11px', color: '#1D9E75', fontWeight: 600 }}>+{marge}%</span>
                            </div>
                          )}
                          {scenario === 'B' && (
                            <div>
                              <span style={{ background: '#dbeafe', color: '#1e40af', fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px' }}>B \u2014 NORMAL</span>
                              <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#666' }}>PA \u00d7{mult} \u2192 {pv?.toFixed(2)} \u20ac</p>
                              <span style={{ fontSize: '11px', color: '#185FA5', fontWeight: 600 }}>+{marge}%</span>
                            </div>
                          )}
                          {(scenario === 'C' || enNegoLigne) && (
                            <div>
                              <span style={{ background: '#fff7ed', color: '#9a3412', fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px' }}>N\u00e9go fournisseur</span>
                              {pmc && <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#666' }}>Cible : {getCibleNego(pmc).toFixed(2)} \u20ac</p>}
                            </div>
                          )}
                          {scenario === 'D' && !enNegoLigne && <span style={{ background: '#fee2e2', color: '#991b1b', fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px' }}>D \u2014 REFUS</span>}
                        </div>

                        {/* Action */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
                          {(scenario === 'A' || scenario === 'B') && (
                            <button onClick={() => validerProduit(produit)} style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}>
                              Valider \u2192
                            </button>
                          )}
                          {scenario === 'C' && !enNegoLigne && (
                            <button onClick={() => passerEnNego(produit.id)} style={{ background: '#ea580c', color: 'white', border: 'none', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}>
                              Contre-offre \u2192
                            </button>
                          )}
                          {enNegoLigne && (
                            <span style={{ fontSize: '11px', color: '#ea580c', fontWeight: 500 }}>En attente</span>
                          )}
                          {scenario === 'D' && !enNegoLigne && (
                            refusConfirm === produit.id ? (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button onClick={() => confirmerRefus(produit)} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', padding: '3px 6px', fontSize: '10px', cursor: 'pointer' }}>Confirmer</button>
                                <button onClick={() => setRefusConfirm(null)} style={{ background: '#f3f4f6', color: '#666', border: 'none', borderRadius: '4px', padding: '3px 6px', fontSize: '10px', cursor: 'pointer' }}>Annuler</button>
                              </div>
                            ) : (
                              <button onClick={() => setRefusConfirm(produit.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}>
                                Refuser
                              </button>
                            )
                          )}
                          {scenario === 'PMC_REQUIS' && (
                            <span style={{ fontSize: '11px', color: '#888' }}>Saisir PMC</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Email panel */}
                {emailPanel === groupe.nom && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <div className="flex gap-2 mb-3">
                      {([1, 2, 3] as const).map(t => (
                        <button key={t} onClick={() => setEmailTab(t)} className={`text-xs px-3 py-1.5 rounded-md font-medium ${emailTab === t ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-300'}`}>
                          {t === 1 ? 'Contre-offre' : t === 2 ? 'CO + refus' : 'Bilan complet'}
                        </button>
                      ))}
                      <button onClick={() => { navigator.clipboard.writeText(genererEmail(groupe, emailTab)); showToast('\u2713 Email copi\u00e9') }} className="text-xs px-3 py-1.5 rounded-md font-medium bg-green-600 text-white ml-auto">
                        Copier l&apos;email \u2192
                      </button>
                    </div>
                    <pre className="text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{genererEmail(groupe, emailTab)}</pre>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
