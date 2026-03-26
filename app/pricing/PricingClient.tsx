'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { Produit, GroupeFournisseur, ScenarioResult } from './types'
import { calculerScenarioResult, formaterDate, calculerJoursDDM } from './pricingUtils'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SCENARIO_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  A: { label: 'A \u2014 JACKPOT', bg: '#dcfce7', text: '#16a34a' },
  B: { label: 'B \u2014 NORMAL', bg: '#dbeafe', text: '#2563eb' },
  C: { label: 'N\u00e9go fournisseur', bg: '#fef3c7', text: '#d97706' },
  D: { label: 'D \u2014 REFUS', bg: '#fee2e2', text: '#dc2626' },
  PMC_REQUIS: { label: 'PMC requis', bg: '#fef3c7', text: '#d97706' },
}

const BORDER_COLORS: Record<string, string> = {
  A: '#16a34a', B: '#2563eb', C: '#d97706', D: '#dc2626', PMC_REQUIS: '#d97706'
}

const OWNERS = ['\u2014 Assigner', 'Juliette', 'Lucas', 'Marie']

export default function PricingClient({ initialProduits }: { initialProduits: Produit[] }) {
  const [produits, setProduits] = useState<Produit[]>(initialProduits)
  const [pmcEdits, setPmcEdits] = useState<Record<string, number | null>>({})
  const [owners, setOwners] = useState<Record<string, string>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [validating, setValidating] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmingNego, setConfirmingNego] = useState<Record<string, boolean>>({})
  const [modalGroupe, setModalGroupe] = useState<string | null>(null)
  const [savedPmc, setSavedPmc] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const inputPmcRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // ─── Groupement ─────────────────────────────────────────────

  const groupes: GroupeFournisseur[] = useMemo(() => {
    const map: Record<string, Produit[]> = {}
    for (const p of produits) {
      const key = p.fournisseur_nom || 'Autre'
      if (!map[key]) map[key] = []
      map[key].push(p)
    }
    return Object.entries(map)
      .map(([nom, items]): GroupeFournisseur => ({
        nom,
        produits: items,
        dateImport: new Date(Math.max(...items.map(p => new Date(p.created_at).getTime())))
      }))
      .sort((a, b) => b.dateImport.getTime() - a.dateImport.getTime())
  }, [produits])

  // ─── Handlers ───────────────────────────────────────────────

  const toggleCollapsed = (nom: string) => {
    setCollapsed(prev => ({ ...prev, [nom]: !(prev[nom] ?? false) }))
  }

  const handleCopy = async (text: string, feedbackId: string) => {
    try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
    setCopiedId(feedbackId)
    setTimeout(() => setCopiedId(id => id === feedbackId ? null : id), 1500)
  }

  const handlePmcChange = (produitId: string, raw: string) => {
    const parsed = parseFloat(raw)
    setPmcEdits(prev => ({
      ...prev,
      [produitId]: (raw === '' || isNaN(parsed) || parsed <= 0) ? null : parsed
    }))
  }

  const handlePmcBlur = async (produit: Produit) => {
    if (!(produit.id in pmcEdits)) return
    const nouvelleValeur = pmcEdits[produit.id] ?? null
    if (nouvelleValeur === (produit.pmc_fournisseur ?? null)) return
    const { error } = await supabase
      .from('produits')
      .update({ pmc_fournisseur: nouvelleValeur })
      .eq('id', produit.id)
    if (!error) {
      setSavedPmc(prev => ({ ...prev, [produit.id]: true }))
      setTimeout(() => setSavedPmc(prev => ({ ...prev, [produit.id]: false })), 1500)
    }
  }

  const handleValider = async (groupeNom: string) => {
    const groupe = groupes.find(g => g.nom === groupeNom)
    if (!groupe) return
    const produitsAValider = groupe.produits.filter(p => {
      const r = calculerScenarioResult(p, pmcEdits)
      return r.scenario === 'A' || r.scenario === 'B'
    })
    if (produitsAValider.length === 0) return

    setValidating(prev => ({ ...prev, [groupeNom]: true }))
    setErrors(prev => ({ ...prev, [groupeNom]: '' }))
    const succeededIds: string[] = []
    try {
      for (const p of produitsAValider) {
        const r = calculerScenarioResult(p, pmcEdits)
        const { error } = await supabase
          .from('produits')
          .update({ statut: 'valide', prix_vente_wag_ht: r.pv! })
          .eq('id', p.id)
        if (error) throw error
        succeededIds.push(p.id)
      }
      setProduits(prev => prev.filter(p => !succeededIds.includes(p.id)))
    } catch {
      if (succeededIds.length > 0) setProduits(prev => prev.filter(p => !succeededIds.includes(p.id)))
      setErrors(prev => ({ ...prev, [groupeNom]: `Erreur (${succeededIds.length}/${produitsAValider.length} valid\u00e9s). R\u00e9essayez.` }))
    } finally {
      setValidating(prev => ({ ...prev, [groupeNom]: false }))
    }
  }

  const handleConfirmerNego = async (produit: Produit) => {
    setConfirmingNego(prev => ({ ...prev, [produit.id]: true }))
    try {
      const { error } = await supabase
        .from('produits')
        .update({ statut: 'nego_fournisseur' })
        .eq('id', produit.id)
      if (error) throw error
      setProduits(prev => prev.filter(p => p.id !== produit.id))
    } catch (err) {
      console.error('Erreur confirmation n\u00e9go:', err)
    } finally {
      setConfirmingNego(prev => ({ ...prev, [produit.id]: false }))
    }
  }

  // ─── Helpers scénario ───────────────────────────────────────

  const countByScenario = (items: Produit[], ...scenarios: string[]) =>
    items.filter(p => scenarios.includes(calculerScenarioResult(p, pmcEdits).scenario)).length

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // ─── Email négo ─────────────────────────────────────────────

  const genererEmailNego = (groupe: GroupeFournisseur): string => {
    const negoItems = groupe.produits.filter(p => calculerScenarioResult(p, pmcEdits).scenario === 'C')
    const lignes = negoItems.map(p => {
      const r = calculerScenarioResult(p, pmcEdits)
      return `- ${p.nom} : votre prix ${fmt(p.prix_achat_wag_ht)} \u20ac HT \u2192 notre cible ${fmt(r.cible!)} \u20ac HT`
    }).join('\n')
    return `Bonjour,\n\nNous souhaitons vous soumettre une contre-offre sur les r\u00e9f\u00e9rences suivantes :\n\n${lignes}\n\nMerci de confirmer votre accord ou de proposer un prix interm\u00e9diaire.\n\nCordialement,\nWilly Anti-gaspi \u2014 bonjour@willyantigaspi.fr`
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <div className="w-8 h-8 bg-[#dcfce7] rounded-lg flex items-center justify-center">
            <span className="text-[#16a34a] font-bold text-sm">W</span>
          </div>
          <span className="font-bold text-gray-900 text-sm">WAG Pricing</span>
          <span className="text-gray-400 mx-1">|</span>
          <span className="text-sm text-gray-600">Validation pricing \u2014 produits en attente</span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {produits.length === 0 && (
          <div className="text-center py-20 text-sm text-gray-400">Aucun produit en attente de validation</div>
        )}

        {groupes.map(groupe => {
          const isCollapsed = collapsed[groupe.nom] ?? false
          const pretsCount = countByScenario(groupe.produits, 'A', 'B')
          const pmcCount = countByScenario(groupe.produits, 'PMC_REQUIS')
          const negoCount = groupe.produits.filter(p => calculerScenarioResult(p, pmcEdits).scenario === 'C').length
          const refusCount = countByScenario(groupe.produits, 'D')

          return (
            <div key={groupe.nom} className="bg-white rounded-xl border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
              {/* Header groupe */}
              <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
                <button onClick={() => toggleCollapsed(groupe.nom)} className="text-gray-400 text-xs w-5 text-center">
                  {isCollapsed ? '\u25B6' : '\u25BC'}
                </button>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-gray-900 uppercase">{groupe.nom}</span>
                  <p className="text-xs text-gray-500">
                    {groupe.produits.length} produits \u00B7 import\u00e9 le {mounted ? formaterDate(groupe.dateImport.toISOString().slice(0, 10)) : '\u2014'}
                  </p>
                </div>

                {isCollapsed && (
                  <span className="text-xs text-gray-500">
                    {pretsCount} pr\u00eats \u00B7 {pmcCount} PMC \u00B7 {negoCount} n\u00e9go \u00B7 {refusCount} refus
                  </span>
                )}

                <select
                  value={owners[groupe.nom] ?? ''}
                  onChange={e => setOwners(prev => ({ ...prev, [groupe.nom]: e.target.value }))}
                  className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                >
                  {OWNERS.map(o => <option key={o} value={o === OWNERS[0] ? '' : o}>{o}</option>)}
                </select>

                {negoCount > 0 && (
                  <button
                    onClick={() => setModalGroupe(groupe.nom)}
                    className="text-xs font-medium px-3 py-1 rounded-md border"
                    style={{ borderColor: '#d97706', color: '#d97706' }}
                  >
                    G\u00e9n\u00e9rer email n\u00e9go
                  </button>
                )}

                {pretsCount > 0 && (
                  <button
                    disabled={validating[groupe.nom]}
                    onClick={() => handleValider(groupe.nom)}
                    className="text-xs font-medium text-white px-3 py-1 rounded-md disabled:opacity-50"
                    style={{ background: '#16a34a' }}
                  >
                    {validating[groupe.nom] ? 'Validation\u2026' : `\u2713 Valider les ${pretsCount} pr\u00eats`}
                  </button>
                )}
              </div>

              {errors[groupe.nom] && (
                <p className="px-4 pb-2 text-xs text-red-600">{errors[groupe.nom]}</p>
              )}

              {!isCollapsed && (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-2 px-4 py-2 border-t border-gray-100 text-xs">
                    <span style={{ color: '#16a34a' }} className="font-semibold">{pretsCount} Pr\u00eats \u00e0 valider</span>
                    <span style={{ color: '#d97706' }} className="font-semibold">{pmcCount} PMC manquant</span>
                    <span style={{ color: '#d97706' }} className="font-semibold">{negoCount} En n\u00e9go</span>
                    <span style={{ color: '#dc2626' }} className="font-semibold">{refusCount} Refus\u00e9s</span>
                  </div>

                  {/* Table */}
                  <div style={{ overflowX: 'auto' }}>
                    {/* Col headers */}
                    <div className="grid gap-2 px-4 py-2 border-t border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wide" style={{ gridTemplateColumns: '1.8fr 80px 65px 110px 72px 80px 160px', minWidth: '800px' }}>
                      <span>Produit / EAN</span>
                      <span>Stock</span>
                      <span>PA HT</span>
                      <span>PMC</span>
                      <span>PA/PMC</span>
                      <span>DDM</span>
                      <span>Sc\u00e9nario</span>
                    </div>

                    {/* Rows */}
                    {groupe.produits.map(produit => {
                      const r = calculerScenarioResult(produit, pmcEdits)
                      const badge = SCENARIO_BADGE[r.scenario]
                      const jours = mounted ? calculerJoursDDM(produit.dluo) : null
                      const isCD = r.scenario === 'C' || r.scenario === 'D'

                      return (
                        <div
                          key={produit.id}
                          className="grid gap-2 px-4 py-2.5 border-b border-gray-50 items-center text-[13px] group"
                          style={{ gridTemplateColumns: '1.8fr 80px 65px 110px 72px 80px 160px', minWidth: '800px', borderLeft: `4px solid ${BORDER_COLORS[r.scenario]}` }}
                        >
                          {/* Produit / EAN */}
                          <div>
                            <p className="font-medium text-gray-900 text-sm leading-tight">{produit.nom}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-400">{produit.ean || '\u2014'}</span>
                              <span className="hidden group-hover:inline text-[10px] text-indigo-500 cursor-pointer" onClick={() => produit.ean && handleCopy(produit.ean, produit.id + '-ean')}>
                                {copiedId === produit.id + '-ean' ? 'Copi\u00e9 !' : 'copier EAN'}
                              </span>
                              <span className="hidden group-hover:inline text-[10px] text-indigo-500 cursor-pointer" onClick={() => handleCopy(produit.nom, produit.id + '-nom')}>
                                {copiedId === produit.id + '-nom' ? 'Copi\u00e9 !' : 'copier nom'}
                              </span>
                            </div>
                          </div>

                          {/* Stock */}
                          <span className="text-gray-600 text-xs">{produit.stock_disponible ?? '\u2014'} ctn</span>

                          {/* PA HT */}
                          <span className={`text-sm font-medium ${isCD ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                            {fmt(produit.prix_achat_wag_ht)} \u20ac
                          </span>

                          {/* PMC */}
                          <div>
                            <span className="text-[11px]" style={{ color: produit.pmc_fournisseur ? '#16a34a' : '#9ca3af' }}>
                              {produit.pmc_fournisseur ? `${fmt(produit.pmc_fournisseur)} \u20ac fourn.` : '\u2014 fourn.'}
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="PMC"
                                className="w-[66px] text-xs border border-gray-300 rounded px-1.5 py-1 focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] outline-none"
                                value={produit.id in pmcEdits ? (pmcEdits[produit.id] ?? '') : (produit.pmc_fournisseur ?? '')}
                                ref={(el) => { inputPmcRefs.current[produit.id] = el }}
                                onChange={(e) => handlePmcChange(produit.id, e.target.value)}
                                onBlur={() => handlePmcBlur(produit)}
                              />
                              {savedPmc[produit.id] && <span className="text-green-600 text-xs">\u2713</span>}
                              {produit.pmc_fournisseur != null && <span title="Sync fournisseur" className="text-xs">\uD83D\uDD17</span>}
                            </div>
                          </div>

                          {/* PA/PMC ratio */}
                          {r.ratio !== null ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full inline-block w-fit" style={{ background: badge.bg, color: badge.text }}>
                              {r.ratio.toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">\u2014</span>
                          )}

                          {/* DDM */}
                          <div>
                            <span className="text-xs text-gray-700">{mounted ? formaterDate(produit.dluo) : '\u2014'}</span>
                            {mounted && jours !== null && (
                              <span className={`block text-[10px] font-medium ${jours < 30 ? 'text-red-600' : jours < 60 ? 'text-amber-600' : 'text-green-600'}`}>
                                {jours}j
                              </span>
                            )}
                          </div>

                          {/* Scénario + action */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full inline-block" style={{ background: badge.bg, color: badge.text }}>
                              {badge.label}
                            </span>

                            {(r.scenario === 'A' || r.scenario === 'B') && (
                              <p className="text-[10px] text-gray-500">
                                PA \u00d7{r.multiplicateur!.toFixed(2)} \u2192 {fmt(r.pv!)} \u20ac{' '}
                                <span style={{ color: r.scenario === 'A' ? '#16a34a' : '#2563eb' }}>+{r.marge!.toFixed(1)}%</span>
                              </p>
                            )}

                            {r.scenario === 'C' && (
                              <div>
                                <p className="text-[10px] text-gray-500">Cible : {fmt(r.cible!)} \u20ac</p>
                                <button
                                  disabled={confirmingNego[produit.id]}
                                  onClick={() => handleConfirmerNego(produit)}
                                  className="text-[11px] font-medium mt-0.5 disabled:opacity-50"
                                  style={{ color: '#d97706' }}
                                >
                                  {confirmingNego[produit.id] ? '\u2026' : '\u2713 Confirmer n\u00e9go'}
                                </button>
                              </div>
                            )}

                            {r.scenario === 'D' && (
                              <p className="text-[10px] text-gray-500">PA &gt; PMC \u00B7 gap &gt;50%</p>
                            )}

                            {r.scenario === 'PMC_REQUIS' && (
                              <button
                                className="text-[11px] text-indigo-600 font-medium"
                                onClick={() => {
                                  inputPmcRefs.current[produit.id]?.focus()
                                  inputPmcRefs.current[produit.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                }}
                              >
                                Saisir PMC \u2192
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Modale email négo */}
      {modalGroupe !== null && (() => {
        const groupeModal = groupes.find(g => g.nom === modalGroupe)
        if (!groupeModal) return null
        const texte = genererEmailNego(groupeModal)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setModalGroupe(null)}>
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative bg-white rounded-xl shadow-2xl max-w-[640px] w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Email n\u00e9go \u2014 {modalGroupe}</h2>
                <button onClick={() => setModalGroupe(null)} className="text-gray-400 hover:text-gray-600 text-xl">\u00d7</button>
              </div>
              <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-4 whitespace-pre-wrap mb-4">{texte}</pre>
              <button
                onClick={() => handleCopy(texte, 'modal-email')}
                className="text-sm font-medium text-white px-4 py-2 rounded-lg"
                style={{ background: '#16a34a' }}
              >
                {copiedId === 'modal-email' ? '\u2713 Copi\u00e9 !' : '\uD83D\uDCCB Copier'}
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
