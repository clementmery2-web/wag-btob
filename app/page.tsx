'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
  qmc: number | null
  stock_disponible: number | null
  remise_pct: number | null
  flux: string | null
}

interface LigneOffre {
  produit: Produit
  prixOffre: number | null
  quantite: number | null
}

// ─── Helpers (hors composant) ─────────────────────────────────

const getDdmBadge = (jours: number | null) => {
  if (jours === null) return { label: '\u2014', cls: 'bg-gray-100 text-gray-500' }
  if (jours <= 0) return { label: '\u2014', cls: 'bg-gray-100 text-gray-500' }
  if (jours < 10) return { label: `${jours}j`, cls: 'bg-red-100 text-red-700' }
  if (jours < 30) return { label: `${jours}j`, cls: 'bg-amber-100 text-amber-700' }
  return { label: `${jours}j`, cls: 'bg-green-100 text-green-700' }
}

const formatEur = (n: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

// ─── Page ─────────────────────────────────────────────────────

export default function OffresPage() {
  const router = useRouter()
  const [lignesOffre, setLignesOffre] = useState<LigneOffre[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [prenomNom, setPrenomNom] = useState('')
  const [nomEnseigne, setNomEnseigne] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [filtreCat, setFiltreCat] = useState('toutes')
  const [filtreDdm, setFiltreDdm] = useState('toutes')
  const [tri, setTri] = useState('ddm')

  // Charger coordonnees memorisees
  useEffect(() => {
    setPrenomNom(localStorage.getItem('wag_prenom_nom') || '')
    setNomEnseigne(localStorage.getItem('wag_nom_enseigne') || '')
    setEmail(localStorage.getItem('wag_email') || '')
  }, [])

  // Charger produits
  useEffect(() => {
    fetch('/api/catalogue')
      .then(r => r.json())
      .then(data => {
        const raw = data.produits ?? data
        console.log('[catalogue] source:', data.source, 'produits fetched:', raw.length, 'first:', raw[0] ? JSON.stringify(raw[0]).slice(0, 200) : 'none')
        setLignesOffre(raw.map((p: Produit) => ({
          produit: {
            id: p.id,
            nom: p.nom,
            marque: p.marque,
            fournisseur_nom: p.fournisseur_nom ?? null,
            ean: p.ean ?? null,
            categorie: p.categorie ?? null,
            prix_wag_ht: p.prix_wag_ht ?? 0,
            ddm: p.ddm ?? null,
            pcb: p.pcb ?? null,
            qmc: p.qmc ?? p.pcb ?? null,
            stock_disponible: p.stock_disponible ?? null,
            remise_pct: p.remise_pct ?? null,
            flux: p.flux ?? null,
          },
          prixOffre: null,
          quantite: null,
        })))
      })
      .finally(() => setLoadingData(false))
  }, [])

  // ─── Fonctions utilitaires ──────────────────────────────────

  const getGroupeKey = (p: Produit): string =>
    p.fournisseur_nom || p.marque || 'Autres'

  const getQmc = (p: Produit): number => p.qmc ?? 1

  const getJours = (ddm: string | null): number | null => {
    if (!ddm) return null
    return Math.ceil((new Date(ddm).getTime() - Date.now()) / 86400000)
  }

  const getExpireLabel = (ddm: string | null): string => {
    const j = getJours(ddm)
    if (j === null) return 'Expire dans 48h'
    if (j < 0) return 'Expire'
    if (j < 15) return `Expire dans ${Math.min(j * 24, 6)}h`
    if (j < 30) return 'Expire dans 24h'
    return 'Expire dans 48h'
  }

  const estActive = (l: LigneOffre): boolean =>
    l.prixOffre !== null && l.prixOffre > 0 &&
    l.quantite !== null && l.quantite > 0

  const estValide = (l: LigneOffre): boolean =>
    estActive(l) &&
    l.prixOffre! >= l.produit.prix_wag_ht &&
    l.quantite! >= getQmc(l.produit)

  const getEtatGroupe = useCallback((groupeKey: string): 'tous' | 'aucun' | 'partiel' => {
    const lignesGroupe = lignesOffre.filter(
      l => getGroupeKey(l.produit) === groupeKey
    )
    const nbActifs = lignesGroupe.filter(estActive).length
    if (nbActifs === 0) return 'aucun'
    if (nbActifs === lignesGroupe.length) return 'tous'
    return 'partiel'
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignesOffre])

  // ─── Filtres et tri ─────────────────────────────────────────

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

  const sortLignes = (a: LigneOffre, b: LigneOffre): number => {
    if (tri === 'ddm') {
      const ja = getJours(a.produit.ddm) ?? 9999
      const jb = getJours(b.produit.ddm) ?? 9999
      return ja - jb
    }
    if (tri === 'remise') return (b.produit.remise_pct ?? 0) - (a.produit.remise_pct ?? 0)
    if (tri === 'marque') return (a.produit.marque ?? '').localeCompare(b.produit.marque ?? '')
    if (tri === 'stock') return (b.produit.stock_disponible ?? 0) - (a.produit.stock_disponible ?? 0)
    return 0
  }

  const groupes = useMemo(() => {
    const filtered = lignesOffre
      .filter(l => appliquerFiltres(l.produit))
      .sort(sortLignes)
    const g = filtered.reduce((acc, l) => {
      const key = getGroupeKey(l.produit)
      if (!acc[key]) acc[key] = []
      acc[key].push(l)
      return acc
    }, {} as Record<string, LigneOffre[]>)
    const sorted = Object.entries(g).sort(([, a], [, b]) => sortLignes(a[0], b[0]))
    return Object.fromEntries(sorted)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignesOffre, filtreCat, filtreDdm, tri])

  // ─── Handlers ───────────────────────────────────────────────

  const handleToggleGroupe = (groupeKey: string) => {
    const etat = getEtatGroupe(groupeKey)
    if (etat === 'tous') {
      setLignesOffre(prev => prev.map(l =>
        getGroupeKey(l.produit) === groupeKey
          ? { ...l, prixOffre: null, quantite: null }
          : l
      ))
    } else {
      setLignesOffre(prev => prev.map(l =>
        getGroupeKey(l.produit) === groupeKey &&
        (l.prixOffre === null || l.prixOffre === 0)
          ? { ...l, prixOffre: l.produit.prix_wag_ht, quantite: getQmc(l.produit) }
          : l
      ))
    }
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

  // ─── Variables calculees ────────────────────────────────────

  const lignesActives = lignesOffre.filter(estActive)
  const lignesInvalides = lignesActives.filter(l => !estValide(l))
  const totalHT = lignesActives.reduce(
    (acc, l) => acc + (l.prixOffre! * l.quantite!), 0
  )
  const peutEnvoyer =
    lignesActives.length > 0 &&
    lignesInvalides.length === 0 &&
    prenomNom.trim().length > 0 &&
    nomEnseigne.trim().length > 0 &&
    email.includes('@') && email.includes('.')

  const nbFiltre = Object.values(groupes).reduce((s, g) => s + g.length, 0)

  // ─── Soumission ─────────────────────────────────────────────

  const handleSubmit = async () => {
    setLoading(true)
    setErreur(null)

    const snapshot = lignesActives.map(l => ({
      nom: l.produit.nom,
      marque: l.produit.marque,
      prixOffre: l.prixOffre!,
      quantite: l.quantite!,
      sousTotal: l.prixOffre! * l.quantite!
    }))

    try {
      for (const ligne of lignesActives) {
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
          acheteur_enseigne: `${prenomNom} \u2014 ${nomEnseigne}`,
          acheteur_email: email,
          prix_offre_ht: ligne.prixOffre,
          quantite: ligne.quantite,
          expires_at: expiresAt,
          mode: mode,
        })
        if (error) throw new Error(error.message)
      }

      localStorage.setItem('wag_confirmation', JSON.stringify({
        offres: snapshot,
        totalHT: lignesActives.reduce(
          (acc, l) => acc + l.prixOffre! * l.quantite!, 0
        ),
        prenomNom: prenomNom || '',
        nomEnseigne: nomEnseigne || '',
        email: email || '',
        date: new Date().toLocaleDateString('fr-FR', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        })
      }))

      localStorage.setItem('wag_prenom_nom', prenomNom)
      localStorage.setItem('wag_nom_enseigne', nomEnseigne)
      localStorage.setItem('wag_email', email)

      router.push('/confirmation')
    } catch (e) {
      console.error('Erreur soumission:', e)
      setErreur('Une erreur est survenue. Veuillez reessayer.')
      setLoading(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────

  const GRID = 'grid-cols-[2fr_65px_55px_80px_90px_95px_70px_85px]'

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
          <select value={tri} onChange={e => setTri(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700">
            <option value="ddm">DDM urgente d&apos;abord</option>
            <option value="remise">Meilleure remise d&apos;abord</option>
            <option value="marque">Par marque A&rarr;Z</option>
            <option value="stock">Stock decroissant</option>
          </select>
        </div>

        {/* Loading */}
        {loadingData && (
          <div className="text-center py-16">
            <div className="inline-block w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500 mt-2">Chargement du catalogue...</p>
          </div>
        )}

        {/* Tableau scrollable */}
        {!loadingData && nbFiltre > 0 && (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            {/* Header colonnes */}
            <div className={`hidden lg:grid ${GRID} gap-2 px-4 py-2 text-[11px] font-semibold text-gray-400 uppercase min-w-[800px]`}>
              <span>Produit</span>
              <span>DDM</span>
              <span>Stock</span>
              <span className="text-right">Plancher HT</span>
              <span>Meilleure offre</span>
              <span>Votre prix HT</span>
              <span>Qte</span>
              <span className="text-right">Sous-total</span>
            </div>

            {/* Groupes */}
            {Object.entries(groupes).map(([key, lignes]) => {
              const etat = getEtatGroupe(key)
              return (
                <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-3 min-w-[800px]">
                  {/* Header groupe */}
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={etat === 'tous'}
                      ref={el => { if (el) el.indeterminate = etat === 'partiel' }}
                      onChange={() => handleToggleGroupe(key)}
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
                      const prixInvalide = ligne.prixOffre !== null && ligne.prixOffre > 0 && ligne.prixOffre < p.prix_wag_ht
                      const qteInvalide = ligne.quantite !== null && ligne.quantite > 0 && ligne.quantite < qmc
                      const active = estActive(ligne)
                      const sousTotal = active ? (ligne.prixOffre! * ligne.quantite!) : null

                      return (
                        <div key={p.id} className={`px-4 py-3 transition-colors ${active ? 'bg-green-50/50' : 'hover:bg-gray-50'}`}>
                          {/* Desktop */}
                          <div className={`hidden lg:grid ${GRID} gap-2 items-center`}>
                            {/* Produit */}
                            <div>
                              <p className="text-sm font-medium text-gray-900">{p.nom}</p>
                              <p className="text-[11px] text-gray-500">
                                {p.stock_disponible ?? 0} cartons dispo &middot; PCB {qmc} &middot; {getExpireLabel(p.ddm)}
                              </p>
                            </div>

                            {/* DDM */}
                            <div>
                              <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </div>

                            {/* Stock */}
                            <div className="text-xs text-gray-600">
                              {p.stock_disponible ?? '\u2014'}
                            </div>

                            {/* Prix plancher */}
                            <div className="text-right text-sm font-medium text-gray-900">
                              {p.prix_wag_ht.toFixed(2)} &euro;
                            </div>

                            {/* Meilleure offre */}
                            <div>
                              <MeilleureOffre produitId={p.id} />
                            </div>

                            {/* Prix HT */}
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
                                    : ligne.prixOffre && !prixInvalide
                                      ? 'border-green-300 focus:border-green-500 focus:ring-2 focus:ring-green-100'
                                      : 'border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-100'
                                }`}
                              />
                              {prixInvalide && (
                                <p className="text-[10px] text-red-500 mt-0.5">Min. {p.prix_wag_ht.toFixed(2)} &euro; HT</p>
                              )}
                            </div>

                            {/* Quantite */}
                            <div>
                              <input
                                type="number"
                                min={qmc}
                                placeholder={`${qmc}`}
                                value={ligne.quantite ?? ''}
                                onChange={e => updateQuantite(p.id, parseInt(e.target.value) || null)}
                                className={`w-full px-2 py-1.5 text-sm border rounded-lg outline-none ${
                                  qteInvalide
                                    ? 'border-red-300 bg-red-50 focus:border-red-500'
                                    : 'border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-100'
                                }`}
                              />
                              {qteInvalide && (
                                <p className="text-[10px] text-red-500 mt-0.5">Min. {qmc} cartons</p>
                              )}
                            </div>

                            {/* Sous-total */}
                            <div className="text-right text-sm font-medium text-gray-900">
                              {sousTotal !== null ? `${sousTotal.toFixed(2)} \u20ac` : '\u2014'}
                            </div>
                          </div>

                          {/* Mobile */}
                          <div className="lg:hidden space-y-2">
                            <p className="text-sm font-medium text-gray-900">{p.nom}</p>
                            <div className="flex items-center gap-2 text-[11px] text-gray-500">
                              <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                              <span>{p.stock_disponible ?? 0} cartons</span>
                              <span>PCB {qmc}</span>
                              <span>Plancher {p.prix_wag_ht.toFixed(2)} &euro;</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <MeilleureOffre produitId={p.id} />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
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
                                <label className="text-[10px] text-gray-500">Qte</label>
                                <input
                                  type="number"
                                  min={qmc}
                                  placeholder={`${qmc}`}
                                  value={ligne.quantite ?? ''}
                                  onChange={e => updateQuantite(p.id, parseInt(e.target.value) || null)}
                                  className={`w-full px-2 py-1.5 text-sm border rounded-lg outline-none ${
                                    qteInvalide ? 'border-red-300 bg-red-50' : 'border-gray-300 focus:border-green-500'
                                  }`}
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500">Sous-total</label>
                                <p className="text-sm font-medium text-gray-900 py-1.5">
                                  {sousTotal !== null ? `${sousTotal.toFixed(2)} \u20ac` : '\u2014'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Vide */}
        {!loadingData && nbFiltre === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500">Catalogue en cours de mise a jour</p>
          </div>
        )}
      </div>

      {/* Barre soumission sticky — EN DEHORS du div overflowX */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
          <input
            value={prenomNom}
            onChange={e => setPrenomNom(e.target.value)}
            placeholder="Prenom Nom"
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white w-36 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
          />
          <input
            value={nomEnseigne}
            onChange={e => setNomEnseigne(e.target.value)}
            placeholder="Enseigne"
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white w-36 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
          />
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white w-48 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
          />
          <div className="flex-1 text-sm text-gray-600 text-right">
            <span className="font-semibold">{lignesActives.length}</span> offre{lignesActives.length > 1 ? 's' : ''} &middot; Total: <span className="font-semibold">{totalHT.toFixed(2)} &euro; HT depart entrepot</span>
            {lignesInvalides.length > 0 && (
              <span className="ml-2 text-xs text-red-500 font-medium">({lignesInvalides.length} a corriger)</span>
            )}
          </div>
          {erreur && (
            <p className="w-full text-xs text-red-600" style={{ margin: '4px 0' }}>{erreur}</p>
          )}
          <button
            disabled={!peutEnvoyer || loading}
            onClick={handleSubmit}
            className="bg-green-700 hover:bg-green-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors"
          >
            {loading
              ? 'Envoi en cours...'
              : lignesActives.length === 0
                ? 'Saisissez un prix pour commencer'
                : lignesInvalides.length > 0
                  ? `Corriger ${lignesInvalides.length} offre${lignesInvalides.length > 1 ? 's' : ''}`
                  : `Envoyer mes ${lignesActives.length} offres \u2192`}
          </button>
        </div>
      </div>
    </div>
  )
}
