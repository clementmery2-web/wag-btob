'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { calculerScenarioResult, validerPrix } from './pricingUtils'
import type { Produit, ScenarioResult } from './types'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface MatchRow {
  ean: string
  pmc: number
  produitId: string
  produitNom: string
  pmcActuel: number | null
  scenarioApres: ScenarioResult
  pmcSuspecte: boolean
  pmcWarning: string | null
}

type Step = 'upload' | 'mapping' | 'preview'

interface Props {
  produits: Produit[]
  onClose: () => void
  onImported: (updates: { id: string; pmc: number }[]) => void
}

export default function PmcImportModal({ produits, onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eanCol, setEanCol] = useState<string | null>(null)
  const [pmcCol, setPmcCol] = useState<string | null>(null)
  const [allCols, setAllCols] = useState<{ name: string; samples: string[] }[]>([])
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [unmatchedCount, setUnmatchedCount] = useState(0)
  const [noHeaderMode, setNoHeaderMode] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const detectEanCol = (rows: Record<string, unknown>[]): string | null => {
    if (rows.length === 0) return null
    const headers = Object.keys(rows[0])
    for (const h of headers) {
      const values = rows.slice(0, 10).map(r => String(r[h] ?? '').trim())
      const isEan = values.filter(v => /^\d{8}$|^\d{12}$|^\d{13}$/.test(v)).length >= Math.min(3, values.length)
      if (isEan) return h
    }
    return null
  }

  const detectPmcCol = (rows: Record<string, unknown>[], eanColName: string | null): string | null => {
    const PMC_HINTS = ['pmc', 'pvc', 'prix_vente', 'prix_marche', 'prix_reference', 'tarif', 'prix_consommateur', 'pvttc', 'pvht', 'prix']
    const headers = Object.keys(rows[0] ?? {}).filter(h => h !== eanColName)
    for (const hint of PMC_HINTS) {
      const found = headers.find(h => h.toLowerCase().includes(hint))
      if (found) return found
    }
    for (const h of headers) {
      const vals = rows.slice(0, 10)
        .map(r => parseFloat(String(r[h] ?? '').replace(',', '.')))
        .filter(v => !isNaN(v) && v >= 0.5 && v <= 50)
      if (vals.length >= Math.min(5, rows.length * 0.5)) return h
    }
    return null
  }

  const handleFile = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    setFileName(file.name)
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]

      const hasEmptyHeaders = (r: Record<string, unknown>[]) =>
        Object.keys(r[0] ?? {}).every(k => k.startsWith('__EMPTY') || k === '')

      let rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      if (hasEmptyHeaders(rows) && rows.length > 1) {
        rows = XLSX.utils.sheet_to_json(sheet, { defval: '', range: 1 })
      }

      if (hasEmptyHeaders(rows)) {
        const rawRowsArr = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 }) as unknown[][]
        if (rawRowsArr.length > 0) {
          const headers = (rawRowsArr[0] as unknown[]).map((_, i) => String.fromCharCode(65 + i))
          rows = rawRowsArr.slice(1).map(row =>
            Object.fromEntries(headers.map((h, i) => [h, (row as unknown[])[i] ?? '']))
          )
          setNoHeaderMode(true)
        }
      } else {
        setNoHeaderMode(false)
      }

      if (rows.length === 0) { setError('Fichier vide ou format non reconnu'); setLoading(false); return }
      setRawRows(rows)
      const detectedEan = detectEanCol(rows)
      setEanCol(detectedEan)
      const detectedPmc = detectPmcCol(rows, detectedEan)
      setPmcCol(detectedPmc)
      const headers = Object.keys(rows[0]).filter(h => h !== detectedEan)
      const cols = headers
        .map(h => {
          const samples = rows.slice(0, 4)
            .map(r => { const v = parseFloat(String(r[h] ?? '').replace(',', '.')); return isNaN(v) ? null : v.toFixed(2) })
            .filter(Boolean) as string[]
          return { name: h, samples }
        })
        .filter(c => c.samples.length >= 2)
      setAllCols(cols)
      setStep('mapping')
    } catch {
      setError('Erreur lors de la lecture du fichier')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleConfirmMapping = useCallback(() => {
    if (!eanCol || !pmcCol) return
    const matchRows: MatchRow[] = []
    let unmatched = 0
    for (const row of rawRows) {
      const eanRaw = String(row[eanCol] ?? '').trim()
      if (!eanRaw || eanRaw === '0') continue
      const pmcRaw = String(row[pmcCol] ?? '').replace(',', '.')
      const pmc = parseFloat(pmcRaw)
      if (isNaN(pmc) || pmc <= 0) continue
      const matchedProduits = produits.filter(p => p.ean != null && String(p.ean).trim() === eanRaw)
      if (matchedProduits.length === 0) { unmatched++; continue }
      for (const p of matchedProduits) {
        const fakeEdits: Record<string, number | null> = { [p.id]: pmc }
        const scenarioApres = calculerScenarioResult(p, fakeEdits)
        const { valide, warning } = validerPrix(pmc, 'PMC')
        matchRows.push({ ean: eanRaw, pmc, produitId: p.id, produitNom: p.nom, pmcActuel: p.pmc_fournisseur, scenarioApres, pmcSuspecte: !valide, pmcWarning: warning })
      }
    }
    setMatches(matchRows)
    setUnmatchedCount(unmatched)
    setStep('preview')
  }, [eanCol, pmcCol, rawRows, produits])

  const handleApply = async () => {
    if (matches.length === 0) return
    setApplying(true)
    const succeeded: { id: string; pmc: number }[] = []
    try {
      for (const row of matches) {
        const { error } = await supabase.from('produits').update({ pmc_fournisseur: row.pmc }).eq('id', row.produitId).eq('statut', 'en_attente')
        if (!error) succeeded.push({ id: row.produitId, pmc: row.pmc })
      }
      onImported(succeeded)
      onClose()
    } catch {
      setError('Erreur lors de la mise à jour')
    } finally {
      setApplying(false)
    }
  }

  const SCENARIO_BADGE: Record<string, { label: string; bg: string; color: string }> = {
    A: { label: 'A — Jackpot', bg: '#dcfce7', color: '#15803d' },
    B: { label: 'B — Normal', bg: '#dbeafe', color: '#1d4ed8' },
    C: { label: 'C — Négo', bg: '#fef3c7', color: '#b45309' },
    D: { label: 'D — Refus', bg: '#fee2e2', color: '#991b1b' },
    PMC_REQUIS: { label: 'PMC requis', bg: '#f3f4f6', color: '#6b7280' },
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: 'min(520px, 95vw)', maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: '#111827' }}>Importer des PMC</h2>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '3px 0 0' }}>
              {step === 'upload' && "Déposez n'importe quel fichier fournisseur"}
              {step === 'mapping' && `${fileName} · ${rawRows.length} lignes`}
              {step === 'preview' && `EAN → ${eanCol} · PMC → ${pmcCol}`}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9ca3af', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', border: '0.5px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#991b1b' }}>{error}</div>
        )}

        {/* UPLOAD */}
        {step === 'upload' && (
          <div
            onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) }}
            onDragOver={e => e.preventDefault()}
            style={{ border: '2px dashed #d1d5db', borderRadius: '8px', padding: '40px 24px', textAlign: 'center', cursor: loading ? 'wait' : 'pointer' }}
            onClick={() => !loading && document.getElementById('pmc-file-input')?.click()}
          >
            <input id="pmc-file-input" type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
            {loading
              ? <p style={{ color: '#6b7280', fontSize: '13px' }}>Analyse du fichier…</p>
              : <>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 15V3m0 0L8 7m4-4 4 4" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: 4 }}>Cliquez ou glissez un fichier</p>
                  <p style={{ fontSize: '12px', color: '#9ca3af' }}>.xlsx · .xls · .csv</p>
                </>
            }
          </div>
        )}

        {/* MAPPING */}
        {step === 'mapping' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f0fdf4', border: '0.5px solid #86efac', borderRadius: '8px', marginBottom: 20 }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" fill="#dcfce7" /><path d="M5 8l2 2 4-4" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span style={{ fontSize: '12px', color: '#15803d', fontWeight: 500 }}>EAN détecté automatiquement</span>
              <code style={{ fontSize: '12px', color: '#16a34a', marginLeft: 4 }}>{eanCol ?? 'non trouvé'}</code>
              <span style={{ fontSize: '11px', color: '#86efac', marginLeft: 'auto' }}>13 chiffres ✓</span>
            </div>

            <p style={{ fontSize: '12px', color: '#374151', marginBottom: 12, fontWeight: 500 }}>Quelle colonne est le prix marché consommateur (PMC) ?</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {allCols.map((col, idx) => {
                const isSelected = pmcCol === col.name
                const isRecommended = idx === 0
                return (
                  <div key={col.name} onClick={() => setPmcCol(col.name)} style={{
                    padding: '10px 14px', border: isSelected ? '2px solid #16a34a' : '0.5px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', background: isSelected ? '#f0fdf4' : 'white', display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, background: isSelected ? '#16a34a' : 'transparent', border: isSelected ? 'none' : '1.5px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />}
                    </div>
                    <code style={{ fontSize: '13px', color: isSelected ? '#15803d' : '#374151', minWidth: 140 }}>{noHeaderMode ? `Colonne ${col.name}` : col.name}</code>
                    <span style={{ fontSize: '11px', color: isSelected ? '#16a34a' : '#9ca3af', fontFamily: 'monospace', marginLeft: 'auto' }}>{col.samples.join(' · ')}</span>
                    {isRecommended && <span style={{ fontSize: '10px', color: '#15803d', background: '#dcfce7', padding: '1px 6px', borderRadius: '9999px', fontWeight: 500, flexShrink: 0 }}>Suggéré</span>}
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: '8px', border: '0.5px solid #e5e7eb', background: 'white', fontSize: '13px', cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleConfirmMapping} disabled={!pmcCol} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: pmcCol ? '#16a34a' : '#e5e7eb', color: pmcCol ? 'white' : '#9ca3af', fontSize: '13px', cursor: pmcCol ? 'pointer' : 'not-allowed', fontWeight: 500 }}>
                Voir les matches →
              </button>
            </div>
          </>
        )}

        {/* PREVIEW */}
        {step === 'preview' && (
          <>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 500 }}>{matches.length} produit{matches.length > 1 ? 's' : ''} à mettre à jour</span>
              {unmatchedCount > 0 && <span style={{ fontSize: '12px', color: '#9ca3af' }}>{unmatchedCount} EAN non trouvés</span>}
              <button onClick={() => setStep('mapping')} style={{ fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', textDecoration: 'underline' }}>Changer de colonne</button>
            </div>

            {matches.some(r => r.pmcSuspecte) && (
              <div style={{ background: '#fef3c7', border: '0.5px solid #fcd34d', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontSize: '12px', color: '#92400e' }}>
                ⚠ {matches.filter(r => r.pmcSuspecte).length} valeur(s) PMC inhabituelle(s) détectée(s) — vérifiez le séparateur décimal de votre fichier (point ou virgule)
              </div>
            )}

            <div style={{ border: '0.5px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', width: '35%' }}>Produit</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', width: '18%' }}>PMC actuel</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', width: '18%' }}>Nouveau PMC</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', width: '29%' }}>Scénario après</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((row, i) => {
                    const badge = SCENARIO_BADGE[row.scenarioApres.scenario]
                    return (
                      <tr key={row.produitId} style={{ borderTop: '0.5px solid #f3f4f6', background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                        <td style={{ padding: '7px 10px', color: '#374151' }}>{row.produitNom}</td>
                        <td style={{ padding: '7px 10px', color: '#9ca3af' }}>{row.pmcActuel ? `${row.pmcActuel.toFixed(2)} €` : '—'}</td>
                        <td style={{ padding: '7px 10px', color: row.pmcSuspecte ? '#d97706' : '#16a34a', fontWeight: 500 }}>
                          {row.pmc.toFixed(2)} €
                          {row.pmcSuspecte && <span title={row.pmcWarning ?? ''} style={{ cursor: 'help', marginLeft: '4px', fontSize: '12px' }}>⚠</span>}
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          <span style={{ background: badge.bg, color: badge.color, fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '9999px' }}>{badge.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
              {unmatchedCount > 0 && <span style={{ fontSize: '11px', color: '#9ca3af', marginRight: 'auto' }}>{unmatchedCount} EAN ignorés — absents du catalogue</span>}
              <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: '8px', border: '0.5px solid #e5e7eb', background: 'white', fontSize: '13px', cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleApply} disabled={applying || matches.length === 0} style={{
                padding: '7px 16px', borderRadius: '8px', border: 'none',
                background: (applying || matches.length === 0) ? '#e5e7eb' : '#16a34a',
                color: (applying || matches.length === 0) ? '#9ca3af' : 'white',
                fontSize: '13px', fontWeight: 500, cursor: (applying || matches.length === 0) ? 'not-allowed' : 'pointer',
              }}>
                {applying ? 'Import en cours…' : `Importer ${matches.length} PMC →`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
