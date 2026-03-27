'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { Produit, GroupeFournisseur } from './types'
import { calculerScenarioResult, formaterDate, calculerJoursDDM, formaterPrixEuro, validerPrix } from './pricingUtils'
import PmcImportModal from './PmcImportModal'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SCENARIO_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  A: { label: 'A — JACKPOT', bg: '#dcfce7', text: '#16a34a' },
  B: { label: 'B — NORMAL', bg: '#dbeafe', text: '#2563eb' },
  C: { label: 'Négo fournisseur', bg: '#fef3c7', text: '#d97706' },
  D: { label: 'D — REFUS', bg: '#fee2e2', text: '#dc2626' },
  PMC_REQUIS: { label: 'PMC requis', bg: '#fef3c7', text: '#d97706' },
}

const OWNERS = ['— Assigner', 'Chloé', 'Juliette', 'Solène', 'Clément', 'Jon', 'Marc', 'Eva', 'Autre']

// ─── Fonctions pures (hors composant) ─────────────────────────

function genererEmailFournisseur(
  fournisseurNom: string,
  produitsNego: Produit[],
  pmcEdits: Record<string, number | null>
): string {
  const lignes = produitsNego.map(p => {
    const r = calculerScenarioResult(p, pmcEdits)
    const cibleStr = r.cible != null && r.cible >= 0 ? r.cible.toFixed(2) + ' € HT' : 'N/A'
    return `• ${p.nom} : votre prix ${p.prix_achat_wag_ht.toFixed(2)} € HT → notre cible ${cibleStr}`
  }).join('\n')
  return [
    `Objet : Offre de rachat ${fournisseurNom} – produits proches DDM`,
    '',
    'Bonjour,',
    '',
    'Dans le cadre de notre démarche anti-gaspi, nous souhaitons vous proposer le rachat des références suivantes à prix négocié :',
    '',
    lignes,
    '',
    'Nous restons disponibles pour trouver un accord gagnant-gagnant.',
    '',
    'Cordialement,',
    'Willy Anti-gaspi — bonjour@willyantigaspi.fr',
  ].join('\n')
}

function genererEmailAcheteur(fournisseurNom: string, produitsNego: Produit[]): string {
  const lignes = produitsNego.map(p => {
    const dluo = formaterDate(p.dluo)
    return `• ${p.nom} — ${p.stock_disponible ?? '?'} cartons — DDM : ${dluo}`
  }).join('\n')
  return [
    `Objet : Offres flash ${fournisseurNom} – stocks à prix négociés`,
    '',
    'Bonjour,',
    '',
    'Nous avons négocié des prix attractifs sur les références suivantes, disponibles en quantités limitées :',
    '',
    lignes,
    '',
    'Ces produits sont disponibles immédiatement. Contactez-nous pour passer commande.',
    '',
    'Cordialement,',
    'Willy Anti-gaspi — bonjour@willyantigaspi.fr',
  ].join('\n')
}

function genererResumeInterne(
  produitsNego: Produit[],
  pmcEdits: Record<string, number | null>
): string {
  const header = 'Produit               | PA HT  | PMC fourn. | Ratio  | Cible  | Gap    | DDM'
  const sep = '-'.repeat(80)
  const lignes = produitsNego.map(p => {
    const r = calculerScenarioResult(p, pmcEdits)
    const jours = calculerJoursDDM(p.dluo)
    const nom = p.nom.substring(0, 20).padEnd(20)
    const ratio = r.ratio != null ? r.ratio.toFixed(1) + '%' : '—'
    const cible = r.cible != null && r.cible >= 0 ? r.cible.toFixed(2) + ' €' : '—'
    const gap = r.gap != null ? r.gap.toFixed(1) + '%' : '—'
    const pmc = p.pmc_fournisseur != null ? p.pmc_fournisseur.toFixed(2) : '—'
    const ddm = jours != null ? jours + 'j' : '?'
    return `${nom} | ${p.prix_achat_wag_ht.toFixed(2).padStart(6)} | ${pmc.padStart(10)} | ${ratio.padStart(6)} | ${cible.padStart(6)} | ${gap.padStart(6)} | ${ddm}`
  }).join('\n')
  return `${header}\n${sep}\n${lignes}`
}

function ModalCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      style={{
        marginTop: '12px', padding: '8px 20px', borderRadius: '6px',
        background: copied ? '#16a34a' : '#1F2937',
        color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px',
        transition: 'background 0.2s',
      }}
    >
      {copied ? '✓ Copié !' : '📋 Copier'}
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────

export default function PricingClient({ initialProduits }: { initialProduits: Produit[] }) {
  const [produits, setProduits] = useState<Produit[]>(initialProduits)
  const [pmcEdits, setPmcEdits] = useState<Record<string, number | null>>({})
  const [owners, setOwners] = useState<Record<string, string>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [validating, setValidating] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [modalGroupe, setModalGroupe] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [confirmingOne, setConfirmingOne] = useState<Record<string, boolean>>({})
  const [confirmingNego, setConfirmingNego] = useState<Record<string, boolean>>({})
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [savingPmc, setSavingPmc] = useState<Record<string, boolean>>({})
  const [savedPmc, setSavedPmc] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [modalTab, setModalTab] = useState<0 | 1 | 2>(0)
  const [flashRow, setFlashRow] = useState<string | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [showPmcImport, setShowPmcImport] = useState(false)
  const [pmcDisplay, setPmcDisplay] = useState<Record<string, string>>({})
  const [produitsFinalises, setProduitsFinalises] = useState<Record<string, 'valide' | 'refuse'>>({})
  const [pmcWarnings, setPmcWarnings] = useState<Record<string, string | null>>({})

  const inputPmcRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalGroupe(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

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
    await navigator.clipboard.writeText(text)
    setCopiedId(feedbackId)
    setTimeout(() => setCopiedId(prev => prev === feedbackId ? null : prev), 1500)
  }

  const openModal = (nom: string) => { setModalTab(0); setModalGroupe(nom) }

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
    setSavingPmc(prev => ({ ...prev, [produit.id]: true }))
    try {
      const { error } = await supabase
        .from('produits')
        .update({ pmc_fournisseur: nouvelleValeur })
        .eq('id', produit.id)
      if (!error) {
        setProduits(prev => prev.map(p =>
          p.id === produit.id ? { ...p, pmc_fournisseur: nouvelleValeur } : p
        ))
        setPmcEdits(prev => { const next = { ...prev }; delete next[produit.id]; return next })
        setSavedPmc(prev => ({ ...prev, [produit.id]: true }))
        setTimeout(() => setSavedPmc(prev => ({ ...prev, [produit.id]: false })), 1500)
      }
    } finally {
      setSavingPmc(prev => ({ ...prev, [produit.id]: false }))
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
        const { error } = await supabase.from('produits').update({ statut: 'valide', prix_vente_wag_ht: r.pv! }).eq('id', p.id)
        if (error) throw error
        succeededIds.push(p.id)
      }
      setProduits(prev => prev.filter(p => !succeededIds.includes(p.id)))
      if (succeededIds.length > 0) {
        setProduitsFinalises(prev => {
          const next = { ...prev }
          for (const id of succeededIds) next[id] = 'valide'
          return next
        })
      }
    } catch {
      if (succeededIds.length > 0) {
        setProduits(prev => prev.filter(p => !succeededIds.includes(p.id)))
        setProduitsFinalises(prev => {
          const next = { ...prev }
          for (const id of succeededIds) next[id] = 'valide'
          return next
        })
      }
      setErrors(prev => ({ ...prev, [groupeNom]: `Erreur (${succeededIds.length}/${produitsAValider.length} validés). Réessayez.` }))
    } finally {
      setValidating(prev => ({ ...prev, [groupeNom]: false }))
    }
  }

  const handleValiderUn = async (produit: Produit) => {
    const r = calculerScenarioResult(produit, pmcEdits)
    if (r.scenario !== 'A' && r.scenario !== 'B') return
    if (r.pv != null) {
      const { valide, warning } = validerPrix(r.pv, 'PV')
      if (!valide) {
        const confirmer = window.confirm(
          `Prix de vente calculé inhabituel : ${formaterPrixEuro(r.pv)}\n${warning}\n\nVoulez-vous quand même valider ce produit ?`
        )
        if (!confirmer) return
      }
    }
    setConfirmingOne(prev => ({ ...prev, [produit.id]: true }))
    setRowErrors(prev => ({ ...prev, [produit.id]: '' }))
    try {
      const { error } = await supabase.from('produits').update({ statut: 'valide', prix_vente_wag_ht: r.pv! }).eq('id', produit.id)
      if (error) throw error
      setFlashRow(produit.id)
      setTimeout(() => {
        setFlashRow(prev => prev === produit.id ? null : prev)
        setProduits(prev => prev.filter(p => p.id !== produit.id))
        setProduitsFinalises(prev => ({ ...prev, [produit.id]: 'valide' }))
      }, 350)
    } catch {
      setRowErrors(prev => ({ ...prev, [produit.id]: 'Erreur — réessayez' }))
    } finally {
      setConfirmingOne(prev => ({ ...prev, [produit.id]: false }))
    }
  }

  const handleConfirmerNego = async (produit: Produit) => {
    setConfirmingNego(prev => ({ ...prev, [produit.id]: true }))
    try {
      const { error } = await supabase.from('produits').update({ statut: 'nego_fournisseur' }).eq('id', produit.id)
      if (error) throw error
      setProduits(prev => prev.filter(p => p.id !== produit.id))
      setProduitsFinalises(prev => ({ ...prev, [produit.id]: 'valide' }))
    } catch (err) {
      console.error('Erreur confirmation négo:', err)
    } finally {
      setConfirmingNego(prev => ({ ...prev, [produit.id]: false }))
    }
  }

  const handlePmcImported = (updates: { id: string; pmc: number }[]) => {
    setProduits(prev => prev.map(p => {
      const update = updates.find(u => u.id === p.id)
      return update ? { ...p, pmc_fournisseur: update.pmc } : p
    }))
    setPmcEdits(prev => {
      const next = { ...prev }
      for (const u of updates) delete next[u.id]
      return next
    })
    setPmcDisplay(prev => {
      const next = { ...prev }
      for (const u of updates) delete next[u.id]
      return next
    })
    setPmcWarnings(prev => {
      const next = { ...prev }
      for (const u of updates) delete next[u.id]
      return next
    })
  }

  const handleRefuser = async (produitId: string) => {
    const { error } = await supabase.from('produits').update({ statut: 'refuse' }).eq('id', produitId)
    if (error) { console.error('[handleRefuser] error:', error.message); return }
    setProduitsFinalises(prev => ({ ...prev, [produitId]: 'refuse' }))
  }

  const handleAnnulerFinalisation = async (produitId: string) => {
    const { error } = await supabase.from('produits').update({ statut: 'en_attente', prix_vente_wag_ht: null, visible_catalogue: false }).eq('id', produitId)
    if (error) { console.error('[handleAnnulerFinalisation] error:', error.message); return }
    setProduitsFinalises(prev => { const n = { ...prev }; delete n[produitId]; return n })
    setPmcDisplay(prev => { const n = { ...prev }; delete n[produitId]; return n })
  }

  const countByScenario = (items: Produit[], ...scenarios: string[]) =>
    items.filter(p => scenarios.includes(calculerScenarioResult(p, pmcEdits).scenario)).length

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-4">
        {produits.length === 0 && (
          <div className="text-center py-20 text-sm text-gray-400">Aucun produit en attente de validation</div>
        )}

        {(() => {
          const bloqués = produits.filter(p =>
            calculerScenarioResult(p, pmcEdits).scenario === 'PMC_REQUIS'
          )
          const nb = bloqués.length
          if (nb === 0) return null
          const urgents = mounted
            ? bloqués.filter(p => {
                const j = calculerJoursDDM(p.dluo)
                return j !== null && j < 30
              }).length
            : 0
          return (
            <div style={{ background: '#fef3c7', border: '0.5px solid #fcd34d', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#92400e' }}>
                  {nb} produit{nb > 1 ? 's' : ''} bloqué{nb > 1 ? 's' : ''} — PMC manquant
                </span>
                {urgents > 0 && (
                  <span style={{ fontSize: '12px', color: '#dc2626', marginLeft: '8px', fontWeight: 500 }}>
                    dont {urgents} expirent dans moins de 30j
                  </span>
                )}
                <span style={{ fontSize: '12px', color: '#b45309', marginLeft: '8px' }}>
                  Importez un fichier EAN/PMC pour les débloquer en masse
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => {
                    const firstEmpty = Object.values(inputPmcRefs.current).find(el => el && !el.value)
                    if (firstEmpty) { firstEmpty.focus(); firstEmpty.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
                    setShowPmcImport(true)
                  }}
                  style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', background: '#d97706', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                >
                  Importer PMC →
                </button>
                <button
                  onClick={() => {
                    const firstEmpty = Object.values(inputPmcRefs.current).find(el => el && !el.value)
                    if (firstEmpty) { firstEmpty.focus(); firstEmpty.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
                  }}
                  style={{ fontSize: '12px', color: '#b45309', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  ou saisir manuellement
                </button>
              </div>
            </div>
          )
        })()}

        {groupes.map(groupe => {
          const isCollapsed = collapsed[groupe.nom] ?? false
          const resultsGroupe = groupe.produits.map(p => ({ produit: p, r: calculerScenarioResult(p, pmcEdits) }))
          const nbPrets = resultsGroupe.filter(({ r }) => r.scenario === 'A' || r.scenario === 'B').length
          const nbPmcManquant = resultsGroupe.filter(({ r }) => r.scenario === 'PMC_REQUIS').length
          const nbNego = resultsGroupe.filter(({ r }) => r.scenario === 'C').length
          const nbRefus = resultsGroupe.filter(({ r }) => r.scenario === 'D').length

          return (
            <div key={groupe.nom} className="bg-white rounded-xl border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
                <button onClick={() => toggleCollapsed(groupe.nom)} className="text-gray-400 text-xs w-5 text-center">
                  {isCollapsed ? '▶' : '▼'}
                </button>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-gray-900 uppercase">{groupe.nom}</span>
                  <p className="text-xs text-gray-500">
                    {groupe.produits.length} produits · importé le {mounted ? formaterDate(groupe.dateImport.toISOString().slice(0, 10)) : '—'}
                  </p>
                </div>
                {isCollapsed && (
                  <span className="text-xs text-gray-500">{nbPrets} prêts · {nbPmcManquant} PMC · {nbNego} négo · {nbRefus} refus</span>
                )}
                <select value={owners[groupe.nom] ?? ''} onChange={e => setOwners(prev => ({ ...prev, [groupe.nom]: e.target.value }))} className="text-xs border border-gray-300 rounded px-2 py-1 bg-white">
                  {OWNERS.map(o => <option key={o} value={o === OWNERS[0] ? '' : o}>{o}</option>)}
                </select>
                {nbNego > 0 && (
                  <button onClick={() => openModal(groupe.nom)} className="text-xs font-medium px-3 py-1 rounded-md border" style={{ borderColor: '#d97706', color: '#d97706' }}>
                    Générer email négo
                  </button>
                )}
                {(
                  <button
                    disabled={nbPrets === 0 || validating[groupe.nom]}
                    title={nbPrets === 0 ? 'Saisissez les PMC manquants pour débloquer la validation' : `${nbPrets} produit(s) prêt(s) à valider`}
                    onClick={() => handleValider(groupe.nom)}
                    style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: 'none', background: nbPrets === 0 ? '#e5e7eb' : '#16a34a', color: nbPrets === 0 ? '#9ca3af' : 'white', cursor: nbPrets === 0 ? 'not-allowed' : 'pointer', fontWeight: 500 }}
                  >
                    {validating[groupe.nom] ? 'Validation…' : `✓ Valider les ${nbPrets} prêts`}
                  </button>
                )}
              </div>
              {errors[groupe.nom] && <p className="px-4 pb-2 text-xs text-red-600">{errors[groupe.nom]}</p>}

              {!isCollapsed && (
                <>
                  {/* KPI bar */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', padding: '0 16px', margin: '12px 0' }}>
                    {[
                      { label: 'Prêts à valider', count: nbPrets, color: '#16a34a', bg: '#dcfce7' },
                      { label: 'PMC manquant', count: nbPmcManquant, color: '#d97706', bg: '#fef3c7' },
                      { label: 'En négo', count: nbNego, color: '#d97706', bg: '#fef3c7' },
                      { label: 'Refusés', count: nbRefus, color: '#dc2626', bg: '#fee2e2' },
                    ].map(({ label, count, color, bg }) => (
                      <div key={label} style={{ background: count > 0 ? bg : '#F9FAFB', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', border: `1px solid ${count > 0 ? color + '33' : '#E5E7EB'}` }}>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: count > 0 ? color : '#9CA3AF' }}>{count}</div>
                        <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                      <colgroup>
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '6%' }} />
                        <col style={{ width: '6%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '6%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '7%' }} />
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '19%' }} />
                      </colgroup>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                          {[
                            { label: 'PRODUIT EAN' },
                            { label: <>STOCK<br /><span style={{ fontWeight: 400, fontSize: '10px' }}>(cartons)</span></> },
                            { label: 'PA WAG HT' },
                            { label: 'PMC FOURN.' },
                            { label: 'PA/PMC', title: 'Ratio = PA WAG ÷ PMC × 100. A<30% | B 30-55% | C>55% négo | D>55%+gap>50% refus', cursor: 'help' },
                            { label: 'DDM' },
                            { label: 'PV B2B HT' },
                            { label: 'SCÉNARIO' },
                            { label: 'ACTION' },
                          ].map((h, i) => (
                            <th key={i} style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em', cursor: h.cursor ?? 'default' }} title={h.title}>{h.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resultsGroupe.map(({ produit, r }, index) => {
                          const badge = SCENARIO_BADGE[r.scenario]
                          const couleurLigne = r.scenario === 'A' ? '#16a34a' : r.scenario === 'B' ? '#2563eb' : (r.scenario === 'C' || r.scenario === 'PMC_REQUIS') ? '#d97706' : '#dc2626'
                          const isCD = r.scenario === 'C' || r.scenario === 'D'
                          const fondLigne = flashRow === produit.id ? '#dcfce7' : r.scenario === 'D' ? '#fef2f2' : index % 2 === 0 ? 'white' : '#F9FAFB'

                          return (
                            <tr key={produit.id} onMouseEnter={() => setHoveredRow(produit.id)} onMouseLeave={() => setHoveredRow(null)} style={{ borderBottom: '1px solid #F3F4F6', borderLeft: `4px solid ${couleurLigne}`, background: produitsFinalises[produit.id] ? '#f9fafb' : fondLigne, opacity: produitsFinalises[produit.id] ? 0.55 : (r.scenario === 'D' ? 0.82 : 1), transition: 'background 0.3s' }}>
                              {/* PRODUIT EAN */}
                              <td style={{ padding: '10px 12px' }}>
                                <div style={{ fontWeight: 600, fontSize: '14px' }}>{produit.nom}</div>
                                {produit.ean && <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{produit.ean}</div>}
                                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', visibility: hoveredRow === produit.id ? 'visible' : 'hidden', height: '18px' }}>
                                  {produit.ean && <button onClick={() => handleCopy(produit.ean!, produit.id + '-ean')} style={{ fontSize: '11px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{copiedId === produit.id + '-ean' ? '✓ Copié !' : '📋 EAN'}</button>}
                                  <button onClick={() => handleCopy(produit.nom, produit.id + '-nom')} style={{ fontSize: '11px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{copiedId === produit.id + '-nom' ? '✓ Copié !' : '📋 nom'}</button>
                                </div>
                              </td>
                              {/* STOCK */}
                              <td style={{ padding: '10px 8px', fontSize: '13px' }}>{produit.stock_disponible ?? '—'} ctn</td>
                              {/* PA HT */}
                              <td style={{ padding: '10px 8px', fontSize: '13px', textDecoration: isCD ? 'line-through' : 'none', color: isCD ? '#9CA3AF' : 'inherit' }}>
                                {formaterPrixEuro(produit.prix_achat_wag_ht)}
                              </td>
                              {/* PMC FOURN. */}
                              <td style={{ padding: '10px 8px' }}>
                                {produit.pmc_fournisseur != null && produit.pmc_fournisseur > 0
                                  ? <div style={{ color: '#16a34a', fontSize: '11px', marginBottom: '4px' }}>{produit.pmc_fournisseur.toFixed(2)} € fourn.</div>
                                  : produit.pmc_reference != null && produit.pmc_reference > 0
                                    ? <div style={{ color: '#9CA3AF', fontSize: '11px', marginBottom: '4px' }}>{produit.pmc_reference.toFixed(2)} € réf.</div>
                                    : <div style={{ color: '#9CA3AF', fontSize: '11px', marginBottom: '4px' }}>— fourn.</div>}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <input type="text" placeholder="Saisir PMC"
                                    disabled={!!produitsFinalises[produit.id] || savingPmc[produit.id]}
                                    value={
                                      pmcDisplay[produit.id] !== undefined
                                        ? pmcDisplay[produit.id]
                                        : pmcEdits[produit.id] != null
                                          ? `${String(pmcEdits[produit.id]).replace('.', ',')} €`
                                          : produit.pmc_fournisseur != null
                                            ? `${String(produit.pmc_fournisseur).replace('.', ',')} €`
                                            : ''
                                    }
                                    ref={el => { inputPmcRefs.current[produit.id] = el }}
                                    onChange={e => {
                                      const raw = e.target.value.replace(/\s*€\s*/g, '').replace(',', '.')
                                      setPmcDisplay(prev => ({ ...prev, [produit.id]: e.target.value }))
                                      const val = parseFloat(raw)
                                      if (!isNaN(val)) {
                                        const { warning } = validerPrix(val, 'PMC')
                                        setPmcWarnings(prev => ({ ...prev, [produit.id]: warning }))
                                        setPmcEdits(prev => ({ ...prev, [produit.id]: val }))
                                      }
                                    }}
                                    onFocus={() => {
                                      const raw = pmcEdits[produit.id] ?? produit.pmc_fournisseur
                                      if (raw != null) setPmcDisplay(prev => ({ ...prev, [produit.id]: String(raw).replace('.', ',') }))
                                    }}
                                    onBlur={() => {
                                      const raw = pmcEdits[produit.id] ?? produit.pmc_fournisseur
                                      if (raw != null) setPmcDisplay(prev => ({ ...prev, [produit.id]: `${String(raw).replace('.', ',')} €` }))
                                      else setPmcDisplay(prev => { const n = { ...prev }; delete n[produit.id]; return n })
                                      handlePmcBlur(produit)
                                    }}
                                    style={{ width: '95px', padding: '4px 8px', fontSize: '13px', border: pmcWarnings[produit.id] ? '1px solid #fcd34d' : '1px solid #D1D5DB', borderRadius: '6px', opacity: (savingPmc[produit.id] || produitsFinalises[produit.id]) ? 0.5 : 1 }} />
                                  {pmcWarnings[produit.id] && <span title={pmcWarnings[produit.id] ?? ''} style={{ cursor: 'help', fontSize: '14px', color: '#d97706', flexShrink: 0 }}>⚠</span>}
                                  {savingPmc[produit.id] && <span style={{ fontSize: '11px', color: '#9CA3AF' }}>…</span>}
                                  {savedPmc[produit.id] && <span style={{ fontSize: '11px', color: '#16a34a' }}>✓</span>}
                                  {produit.pmc_fournisseur != null && !savingPmc[produit.id] && !savedPmc[produit.id] && <span title="PMC fourni par le fournisseur" style={{ fontSize: '11px' }}>🔗</span>}
                                </div>
                              </td>
                              {/* PA/PMC */}
                              <td style={{ padding: '10px 8px' }}>
                                {r.ratio != null
                                  ? <span title={`Ratio : ${r.ratio.toFixed(2)}%${r.gap != null ? ` · Gap : ${r.gap.toFixed(2)}%` : ''}`} style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, background: r.scenario === 'D' ? '#fca5a5' : badge.bg, color: r.scenario === 'D' ? '#7f1d1d' : badge.text }}>{r.ratio.toFixed(0)}%</span>
                                  : <span style={{ color: '#9CA3AF', fontSize: '12px' }}>—</span>}
                              </td>
                              {/* DDM */}
                              <td style={{ padding: '10px 8px', fontSize: '13px' }}>
                                <div>{mounted ? formaterDate(produit.dluo) : '—'}</div>
                                {mounted && produit.dluo && (() => {
                                  const j = calculerJoursDDM(produit.dluo)
                                  if (j === null) return null
                                  if (j < 30) return (
                                    <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: '9999px', background: '#fee2e2', color: '#991b1b', fontSize: '10px', fontWeight: 500, marginTop: '2px' }}>{j}j</span>
                                  )
                                  if (j < 60) return (
                                    <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: '9999px', background: '#fef3c7', color: '#92400e', fontSize: '10px', fontWeight: 500, marginTop: '2px' }}>{j}j</span>
                                  )
                                  return <div style={{ fontSize: '10px', color: '#16a34a', marginTop: '2px' }}>{j}j</div>
                                })()}
                              </td>
                              {/* PV HT */}
                              <td style={{ padding: '10px 8px', fontSize: '13px' }}>
                                {(r.scenario === 'A' || r.scenario === 'B')
                                  ? <span style={{ color: '#16a34a', fontWeight: 700 }}>{formaterPrixEuro(r.pv)}</span>
                                  : r.scenario === 'C'
                                    ? r.cible != null && r.cible < 0
                                      ? <span style={{ fontSize: '11px', color: '#9ca3af' }}>N/A — PA &gt; PMC</span>
                                      : <span style={{ color: '#d97706', fontStyle: 'italic' }}>~{formaterPrixEuro(r.cible)}</span>
                                    : <span style={{ color: '#9CA3AF' }}>—</span>}
                              </td>
                              {/* SCÉNARIO */}
                              <td style={{ padding: '10px 8px' }}>
                                {r.scenario !== 'D' && (
                                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '9999px', background: badge.bg, color: badge.text, fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>{badge.label}</span>
                                )}
                                {(r.scenario === 'A' || r.scenario === 'B') && (
                                  <div style={{ fontSize: '12px', color: '#374151' }}>PA × {r.multiplicateur!.toFixed(2)} → {r.pv!.toFixed(2)} € +{r.marge!.toFixed(1)}%</div>
                                )}
                                {r.scenario === 'C' && (
                                  <div style={{ fontSize: '12px', color: '#374151' }}>
                                    {r.cible != null && r.cible < 0
                                      ? <span style={{ color: '#9ca3af' }}>N/A — PA &gt; PMC</span>
                                      : `Cible : ${r.cible != null ? r.cible.toFixed(2) : '—'} €`}
                                  </div>
                                )}
                                {r.scenario === 'D' && (
                                  <>
                                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '9999px', background: '#fca5a5', color: '#7f1d1d', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>D — REFUS</span>
                                    <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 500 }}>PA &gt; PMC · gap &gt;50%</div>
                                  </>
                                )}
                              </td>
                              {/* ACTION */}
                              <td style={{ padding: '8px', verticalAlign: 'middle' }}>
                                {!produitsFinalises[produit.id] ? (
                                  <>
                                    {(r.scenario === 'A' || r.scenario === 'B') && (
                                      <button onClick={() => handleValiderUn(produit)} disabled={confirmingOne[produit.id] || savingPmc[produit.id]}
                                        style={{ fontSize: '11px', padding: '4px 10px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>
                                        ✓ Valider
                                      </button>
                                    )}
                                    {r.scenario === 'C' && (
                                      <button onClick={() => handleConfirmerNego(produit)} disabled={confirmingNego[produit.id]}
                                        style={{ fontSize: '11px', padding: '4px 10px', background: '#d97706', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>
                                        ✓ Confirmer négo
                                      </button>
                                    )}
                                    {r.scenario === 'D' && (
                                      <button onClick={() => handleRefuser(produit.id)}
                                        style={{ fontSize: '11px', padding: '4px 10px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>
                                        ✗ Refuser
                                      </button>
                                    )}
                                    {rowErrors[produit.id] && <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '2px' }}>{rowErrors[produit.id]}</div>}
                                  </>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 500, color: produitsFinalises[produit.id] === 'valide' ? '#16a34a' : '#dc2626' }}>
                                      {produitsFinalises[produit.id] === 'valide' ? '✓ Validé' : '✗ Refusé'}
                                    </span>
                                    <button onClick={() => handleAnnulerFinalisation(produit.id)}
                                      style={{ fontSize: '10px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                                      Annuler
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )
        })}

      {/* Modale 3 onglets */}
      {modalGroupe !== null && (() => {
        const groupeModal = groupes.find(g => g.nom === modalGroupe)
        const produitsNego = groupeModal?.produits.filter(p => calculerScenarioResult(p, pmcEdits).scenario === 'C') ?? []
        const textes = [
          genererEmailFournisseur(modalGroupe, produitsNego, pmcEdits),
          genererEmailAcheteur(modalGroupe, produitsNego),
          genererResumeInterne(produitsNego, pmcEdits),
        ]
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setModalGroupe(null)}>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: 'min(640px, 95vw)', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Email négo — {modalGroupe}</h2>
                <button onClick={() => setModalGroupe(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF' }}>×</button>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #E5E7EB', paddingBottom: '8px' }}>
                {['Email fournisseur', 'Email acheteur', 'Résumé interne'].map((label, i) => (
                  <button key={i} onClick={() => setModalTab(i as 0 | 1 | 2)} style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '13px', border: modalTab === i ? 'none' : '1px solid #E5E7EB', background: modalTab === i ? '#16a34a' : 'white', color: modalTab === i ? 'white' : '#374151', cursor: 'pointer' }}>{label}</button>
                ))}
              </div>
              <textarea key={modalTab} defaultValue={textes[modalTab]} style={{ width: '100%', minHeight: '280px', padding: '12px', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.6', border: '1px solid #E5E7EB', borderRadius: '8px', background: '#F9FAFB', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
              <ModalCopyButton text={textes[modalTab]} />
            </div>
          </div>
        )
      })()}

      {showPmcImport && (
        <PmcImportModal
          key={Date.now()}
          produits={produits}
          onClose={() => setShowPmcImport(false)}
          onImported={handlePmcImported}
        />
      )}
    </div>
  )
}
