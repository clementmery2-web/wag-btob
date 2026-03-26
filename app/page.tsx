'use client'

import { useEffect, useState, useMemo } from 'react'
import { MeilleureOffre } from '@/components/MeilleureOffre'
import { supabase } from '@/lib/supabase-client'

// ─── Types ────────────────────────────────────────────────────

interface Produit {
  id: string
  nom: string
  marque: string
  fournisseur_nom: string | null
  ean: string | null
  categorie: string | null
  prix_wag_ht: number
  ddm: string | null
  pcb: number | null
  stock_disponible: number | null
  remise_pct: number | null
  flux: string | null
}

interface LigneOffre {
  produit: Produit
  coche: boolean
  prixOffre: number | null
  quantite: number | null
}

// ─── Helpers ──────────────────────────────────────────────────

const getJours = (ddm: string | null): number | null => {
  if (!ddm) return null
  const j = Math.ceil((new Date(ddm).getTime() - Date.now()) / 86400000)
  return j
}

const getDdmBadge = (jours: number | null) => {
  if (jours === null) return null
  if (jours < 0) return { label: 'Expire', cls: 'bg-red-100 text-red-700' }
  if (jours < 10) return { label: `${jours}j`, cls: 'bg-red-100 text-red-700' }
  if (jours < 30) return { label: `${jours}j`, cls: 'bg-amber-100 text-amber-700' }
  return { label: `${jours}j`, cls: 'bg-green-100 text-green-700' }
}

const getExpireLabel = (ddm: string | null): string => {
  const j = getJours(ddm)
  if (j === null) return 'Expire dans 48h'
  if (j < 15) return 'Expire dans 6h'
  if (j < 30) return 'Expire dans 24h'
  return 'Expire dans 48h'
}

const getQmc = (p: Produit): number => p.pcb ?? 1

const getGroupeKey = (p: Produit) => p.fournisseur_nom || p.marque || 'Autres'

const formatEur = (n: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

// ─── Page ─────────────────────────────────────────────────────

export default function OffresPage() {
  const [lignesOffre, setLignesOffre] = useState<LigneOffre[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [enseigne, setEnseigne] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmation, setConfirmation] = useState(false)
  const [filtreCat, setFiltreCat] = useState('toutes')
  const [filtreDdm, setFiltreDdm] = useState('toutes')

  // Charger coordonnees memorisees
  useEffect(() => {
    setEnseigne(localStorage.getItem('wag_enseigne') || '')
    setEmail(localStorage.getItem('wag_email') || '')
  }, [])

  // Charger produits
  useEffect(() => {
    fetch('/api/catalogue')
      .then(r => r.json())
      .then(data => {
        const prods: Produit[] = (data.produits ?? data).map((p: Produit) => ({
          id: p.id,
          nom: p.nom,
          marque: p.marque,
          fournisseur_nom: p.fournisseur_nom ?? null,
          ean: p.ean ?? null,
          categorie: p.categorie ?? null,
          prix_wag_ht: p.prix_wag_ht ?? 0,
          ddm: p.ddm ?? null,
          pcb: p.pcb ?? null,
          stock_disponible: p.stock_disponible ?? null,
          remise_pct: p.remise_pct ?? null,
          flux: p.flux ?? null,
        }))
        setLignesOffre(prods.map(p => ({ produit: p, coche: false, prixOffre: null, quantite: null })))
      })
      .finally(() => setLoadingData(false))
  }, [])

  // Filtres
  const categories = useMemo(() => {
    const cats = new Set(lignesOffre.map(l => l.produit.categorie).filter((c): c is string => c !== null))
    return ['toutes', ...Array.from(cats)]
  }, [lignesOffre])

  const appliquerFiltres = (p: Produit): boolean => {
    if (filtreCat !== 'toutes' && p.categorie !== filtreCat) return false
    if (filtreDdm === 'urgent') {
      const j = getJours(p.ddm) ?? 999
      if (j > 15) return false
    }
    if (filtreDdm === 'moyen') {
      const j = getJours(p.ddm) ?? 999
      if (j <= 15 || j > 30) return false
    }
    if (filtreDdm === 'long') {
      const j = getJours(p.ddm) ?? 999
      if (j <= 30) return false
    }
    return true
  }

  const groupes = useMemo(() => {
    return lignesOffre
      .filter(l => appliquerFiltres(l.produit))
      .reduce((acc, l) => {
        const key = getGroupeKey(l.produit)
        if (!acc[key]) acc[key] = []
        acc[key].push(l)
        return acc
      }, {} as Record<string, LigneOffre[]>)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignesOffre, filtreCat, filtreDdm])

  // Toggle
  const toggleCoche = (produitId: string) => {
    setLignesOffre(prev => prev.map(l =>
      l.produit.id === produitId
        ? { ...l, coche: !l.coche, prixOffre: null, quantite: null }
        : l
    ))
  }

  const toggleGroupe = (groupeKey: string, coche: boolean) => {
    setLignesOffre(prev => prev.map(l =>
      getGroupeKey(l.produit) === groupeKey
        ? { ...l, coche, prixOffre: coche ? l.prixOffre : null, quantite: coche ? l.quantite : null }
        : l
    ))
  }

  const updatePrix = (produitId: string, prix: number | null) => {
    setLignesOffre(prev => prev.map(l =>
      l.produit.id === produitId ? { ...l, prixOffre: prix } : l
    ))
  }

  const updateQuantite = (produitId: string, qte: number | null) => {
    setLignesOffre(prev => prev.map(l =>
      l.produit.id === produitId ? { ...l, quantite: qte } : l
    ))
  }

  // Validation
  const lignesCochees = lignesOffre.filter(l => l.coche)

  const lignesInvalides = lignesCochees.filter(l =>
    !l.prixOffre ||
    l.prixOffre < l.produit.prix_wag_ht ||
    !l.quantite ||
    l.quantite < getQmc(l.produit)
  )

  const totalHT = lignesCochees.reduce((acc, l) =>
    acc + ((l.prixOffre ?? 0) * (l.quantite ?? 0)), 0
  )

  const peutEnvoyer =
    lignesCochees.length > 0 &&
    lignesInvalides.length === 0 &&
    enseigne.trim().length > 0 &&
    email.includes('@')

  // Soumission
  const handleSubmit = async () => {
    setLoading(true)
    try {
      for (const ligne of lignesCochees) {
        const jours = getJours(ligne.produit.ddm) ?? 999
        const expiresAt = jours < 15
          ? new Date(Date.now() + 6 * 3600000).toISOString()
          : jours < 30
            ? new Date(Date.now() + 24 * 3600000).toISOString()
            : new Date(Date.now() + 48 * 3600000).toISOString()
        const mode = jours < 15 ? 'prix_plancher_uniquement' : 'enchere'

        const { error } = await supabase.from('offres_acheteurs').insert({
          produit_id: ligne.produit.id,
          fournisseur_id: null,
          marque: ligne.produit.marque,
          nom_produit: ligne.produit.nom,
          acheteur_enseigne: enseigne,
          acheteur_email: email,
          prix_offre_ht: ligne.prixOffre,
          quantite: ligne.quantite,
          expires_at: expiresAt,
          mode: mode,
        })
        if (error) throw new Error(error.message)
      }

      localStorage.setItem('wag_enseigne', enseigne)
      localStorage.setItem('wag_email', email)

      setLignesOffre(prev => prev.map(l => ({ ...l, coche: false, prixOffre: null, quantite: null })))
      setConfirmation(true)
      setTimeout(() => setConfirmation(false), 5000)
    } catch (e) {
      console.error('Erreur:', e)
    } finally {
      setLoading(false)
    }
  }

  const nbFiltre = Object.values(groupes).reduce((s, g) => s + g.length, 0)

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <svg width="32" height="32" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="18" cy="18" r="18" fill="#16a34a" />
            <path d="M18 8c-2 3-8 6-8 13a8 8 0 0016 0c0-2-1-4-3-6-1 2-3 3-5 3s-3-2-3-4c0-2 1-4 3-6z" fill="#fff" opacity=".9" />
          </svg>
          <div>
            <span className="text-lg font-bold text-gray-900">Willy <span className="text-green-600">Anti-gaspi</span></span>
            <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5 rounded-full ml-2">Catalogue BtoB</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Titre */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Offres du moment</h1>
          <p className="text-sm text-gray-500">{nbFiltre} references &mdash; Prix depart entrepot Saint-Ouen HT &mdash; Transport non inclus</p>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-3">
          <select value={filtreCat} onChange={e => setFiltreCat(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700">
            {categories.map(c => <option key={c} value={c}>{c === 'toutes' ? 'Toutes categories' : c}</option>)}
          </select>
          <select value={filtreDdm} onChange={e => setFiltreDdm(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700">
            <option value="toutes">Toutes DDM</option>
            <option value="urgent">DDM urgente (&lt;15j)</option>
            <option value="moyen">DDM moyenne (15-30j)</option>
            <option value="long">DDM longue (&gt;30j)</option>
          </select>
        </div>

        {/* Loading */}
        {loadingData && (
          <div className="text-center py-16">
            <div className="inline-block w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500 mt-2">Chargement du catalogue...</p>
          </div>
        )}

        {/* Header colonnes */}
        {!loadingData && nbFiltre > 0 && (
          <div className="hidden lg:grid grid-cols-[40px_1fr_60px_70px_90px_120px_120px_90px] gap-2 px-4 py-2 text-[11px] font-semibold text-gray-400 uppercase">
            <span />
            <span>Produit</span>
            <span>DDM</span>
            <span>Stock</span>
            <span className="text-right">Plancher HT</span>
            <span>Meilleure offre</span>
            <span>Votre prix HT</span>
            <span>Qte (ctn)</span>
          </div>
        )}

        {/* Groupes */}
        {!loadingData && Object.entries(groupes).map(([key, lignes]) => {
          const tousCoches = lignes.every(l => l.coche)
          return (
            <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header groupe */}
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={tousCoches}
                  onChange={() => toggleGroupe(key, !tousCoches)}
                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <div>
                  <span className="text-sm font-bold text-gray-900">{key}</span>
                  <span className="text-xs text-gray-500 ml-2">{lignes.length} ref.</span>
                </div>
              </div>

              {/* Lignes */}
              <div className="divide-y divide-gray-50">
                {lignes.map(ligne => {
                  const p = ligne.produit
                  const jours = getJours(p.ddm)
                  const badge = getDdmBadge(jours)
                  const qmc = getQmc(p)
                  const prixInvalide = ligne.prixOffre !== null && ligne.prixOffre < p.prix_wag_ht
                  const qteInvalide = ligne.quantite !== null && ligne.quantite < qmc

                  return (
                    <div
                      key={p.id}
                      className={`px-4 py-3 transition-colors ${ligne.coche ? 'bg-green-50/50' : 'hover:bg-gray-50'}`}
                    >
                      {/* Mobile + Desktop layout */}
                      <div className="lg:grid lg:grid-cols-[40px_1fr_60px_70px_90px_120px_120px_90px] lg:gap-2 lg:items-center">
                        {/* Checkbox */}
                        <div className="flex items-center lg:block">
                          <input
                            type="checkbox"
                            checked={ligne.coche}
                            onChange={() => toggleCoche(p.id)}
                            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                        </div>

                        {/* Produit */}
                        <div className="mt-1 lg:mt-0">
                          <p className="text-sm font-medium text-gray-900">{p.nom}</p>
                          <p className="text-[11px] text-gray-500">
                            {p.stock_disponible ?? 0} ctn dispo &middot; min {qmc} &middot; {getExpireLabel(p.ddm)}
                          </p>
                        </div>

                        {/* DDM */}
                        <div className="hidden lg:block">
                          {badge && (
                            <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                              {badge.label}
                            </span>
                          )}
                        </div>

                        {/* Stock */}
                        <div className="hidden lg:block text-xs text-gray-600">
                          {p.stock_disponible ?? '—'} ctn
                        </div>

                        {/* Prix plancher */}
                        <div className="hidden lg:block text-right text-sm font-medium text-gray-900">
                          {p.prix_wag_ht.toFixed(2)} &euro;
                        </div>

                        {/* Meilleure offre */}
                        <div className="hidden lg:block">
                          <MeilleureOffre produitId={p.id} />
                        </div>

                        {/* Inputs */}
                        {ligne.coche ? (
                          <>
                            <div>
                              <input
                                type="number"
                                step="0.01"
                                min={p.prix_wag_ht}
                                placeholder={`${p.prix_wag_ht.toFixed(2)}`}
                                value={ligne.prixOffre ?? ''}
                                onChange={e => updatePrix(p.id, parseFloat(e.target.value) || null)}
                                className={`w-full px-2 py-1.5 text-sm border rounded-lg outline-none ${
                                  prixInvalide
                                    ? 'border-red-300 bg-red-50 focus:border-red-500'
                                    : 'border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-100'
                                }`}
                              />
                              {prixInvalide && (
                                <p className="text-[10px] text-red-500 mt-0.5">Sous le plancher</p>
                              )}
                              {ligne.prixOffre && !prixInvalide && (
                                <p className="text-[10px] text-green-600 mt-0.5">Dans la course</p>
                              )}
                            </div>
                            <div>
                              <input
                                type="number"
                                min={qmc}
                                placeholder={`min ${qmc}`}
                                value={ligne.quantite ?? ''}
                                onChange={e => updateQuantite(p.id, parseInt(e.target.value) || null)}
                                className={`w-full px-2 py-1.5 text-sm border rounded-lg outline-none ${
                                  qteInvalide
                                    ? 'border-red-300 bg-red-50 focus:border-red-500'
                                    : 'border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-100'
                                }`}
                              />
                              {qteInvalide && (
                                <p className="text-[10px] text-red-500 mt-0.5">Min. {qmc} ctn</p>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="hidden lg:block text-xs text-gray-400 italic">cocher pour offrir</p>
                            <span className="hidden lg:block" />
                          </>
                        )}
                      </div>

                      {/* Mobile: infos supplementaires quand coche */}
                      {ligne.coche && (
                        <div className="lg:hidden mt-3 space-y-2">
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            {badge && <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>}
                            <span>Plancher: {p.prix_wag_ht.toFixed(2)} &euro;</span>
                            <MeilleureOffre produitId={p.id} />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-gray-500">Prix HT</label>
                              <input
                                type="number"
                                step="0.01"
                                min={p.prix_wag_ht}
                                placeholder={`${p.prix_wag_ht.toFixed(2)}`}
                                value={ligne.prixOffre ?? ''}
                                onChange={e => updatePrix(p.id, parseFloat(e.target.value) || null)}
                                className={`w-full px-2 py-1.5 text-sm border rounded-lg outline-none ${
                                  prixInvalide ? 'border-red-300 bg-red-50' : 'border-gray-300 focus:border-green-500'
                                }`}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-500">Qte (ctn)</label>
                              <input
                                type="number"
                                min={qmc}
                                placeholder={`min ${qmc}`}
                                value={ligne.quantite ?? ''}
                                onChange={e => updateQuantite(p.id, parseInt(e.target.value) || null)}
                                className={`w-full px-2 py-1.5 text-sm border rounded-lg outline-none ${
                                  qteInvalide ? 'border-red-300 bg-red-50' : 'border-gray-300 focus:border-green-500'
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Vide */}
        {!loadingData && nbFiltre === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500">Catalogue en cours de mise a jour</p>
          </div>
        )}
      </div>

      {/* Barre soumission sticky */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
        {confirmation && (
          <div className="bg-green-50 border-b border-green-200 px-4 py-3 text-sm text-green-700 text-center font-medium">
            Vos offres ont bien ete envoyees. WAG vous contacte sous 24h.
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
          <input
            value={enseigne}
            onChange={e => setEnseigne(e.target.value)}
            placeholder="Votre enseigne"
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white w-40 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
          />
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email de contact"
            type="email"
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white w-52 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
          />
          <div className="flex-1 text-sm text-gray-600 text-right">
            <span className="font-semibold">{lignesCochees.length}</span> offre{lignesCochees.length > 1 ? 's' : ''} &middot; Total: <span className="font-semibold">{formatEur(totalHT)} HT</span>
            {lignesInvalides.length > 0 && (
              <span className="ml-2 text-xs text-red-500">({lignesInvalides.length} a corriger)</span>
            )}
          </div>
          <button
            disabled={!peutEnvoyer || loading}
            onClick={handleSubmit}
            className="bg-green-700 hover:bg-green-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors"
          >
            {loading
              ? 'Envoi...'
              : lignesInvalides.length > 0
                ? 'Corriger avant d\'envoyer'
                : `Envoyer mes ${lignesCochees.length} offres \u2192`}
          </button>
        </div>
      </div>
    </div>
  )
}
