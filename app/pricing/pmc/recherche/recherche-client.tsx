'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProduitAPI {
  id: string;
  ean: string;
  nom: string;
  marque: string;
  tva_taux: number;
  prix_achat_wag_ht: number;
  dluo: string;
  flux: string;
}

interface EanGroup {
  ids: string[];
  nom: string;
  marque: string;
  tva_taux: number;
  prix_achat_wag_ht: number;
  dluo: string;
  flux: string;
}

interface PmcParsed {
  ean: string;
  pmc_leclerc: number | null;
  pmc_carrefour: number | null;
  pmc_auchan: number | null;
  pmc_intermarche: number | null;
  pmc_lidl: number | null;
  pmc_concurrent_antigaspi: number | null;
  pmc_grossiste: number | null;
  source_url: string;
  source_niveau: string;
}

interface PreviewRow extends PmcParsed {
  nom: string;
  marque: string;
  tva_taux: number;
  prix_achat_wag_ht: number;
  dluo: string;
  flux: string;
  pmc_retenu: number | null;
  pmc_ht: number | null;
  k_dluo: number;
  scenario: string | null;
  prix_vente_final: number | null;
  prix_revente_ttc: number | null;
  ratio: number | null;
  flag_anomalie: boolean;
  selected: boolean;
}

// ─── Calculation Functions ───────────────────────────────────────────────────

function calcP75(values: number[]): number | null {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0];
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(Math.floor(sorted.length * 0.75), sorted.length - 1);
  return sorted[idx];
}

function calcKDluo(flux: string, dluo: string): number {
  if (flux === 'dropshipping') return 0.48;
  const jours = Math.floor((new Date(dluo).getTime() - Date.now()) / 86400000);
  if (jours > 90) return 0.48;
  if (jours > 30) return 0.40;
  if (jours > 15) return 0.32;
  return 0.25;
}

function calcScenario(
  pmc_retenu: number | null,
  pmc_ht: number | null,
  k_dluo: number,
  prix_achat: number,
  flux: string,
  tva_taux: number,
) {
  if (!pmc_retenu || pmc_retenu === 0 || !pmc_ht)
    return { scenario: null, prix_vente_final: null, prix_revente_ttc: null, ratio: null };

  const prix_reference = pmc_ht * k_dluo;
  if (prix_reference === 0)
    return { scenario: null, prix_vente_final: null, prix_revente_ttc: null, ratio: null };

  const ratio = prix_achat / prix_reference;
  const coeff = flux === 'entrepot' ? 1.20 : flux === 'transit' ? 1.25 : 1.15;
  const prix_min = prix_achat * coeff;

  let scenario: string;
  let prix_vente: number | null;
  if (ratio < 0.20) { scenario = 'A'; prix_vente = pmc_ht * 0.40; }
  else if (ratio < 0.43) { scenario = 'B'; prix_vente = pmc_ht * 0.48; }
  else if (ratio < 0.50) { scenario = 'C'; prix_vente = (pmc_ht * 0.48) / 1.15; }
  else { scenario = 'D'; prix_vente = null; }

  const prix_vente_final = prix_vente !== null ? Math.max(prix_vente, prix_min) : null;
  const prix_revente_ttc = prix_vente_final ? prix_vente_final * 1.50 * (1 + tva_taux / 100) : null;
  return { scenario, prix_vente_final, prix_revente_ttc, ratio };
}

function computeRow(pmc: PmcParsed, group: EanGroup): PreviewRow {
  const sources_gd = [pmc.pmc_leclerc, pmc.pmc_carrefour, pmc.pmc_auchan, pmc.pmc_intermarche]
    .filter((v): v is number => v !== null && v > 0);
  const pmc_retenu = calcP75(sources_gd);
  const pmc_ht = pmc_retenu ? pmc_retenu / (1 + group.tva_taux / 100) : null;
  const k_dluo = calcKDluo(group.flux, group.dluo);
  const { scenario, prix_vente_final, prix_revente_ttc, ratio } = calcScenario(
    pmc_retenu, pmc_ht, k_dluo, group.prix_achat_wag_ht, group.flux, group.tva_taux,
  );
  const flag_anomalie =
    sources_gd.length > 1 && pmc_retenu !== null
      ? (Math.max(...sources_gd) - Math.min(...sources_gd)) / pmc_retenu > 0.50
      : false;

  return {
    ...pmc,
    nom: group.nom,
    marque: group.marque,
    tva_taux: group.tva_taux,
    prix_achat_wag_ht: group.prix_achat_wag_ht,
    dluo: group.dluo,
    flux: group.flux,
    pmc_retenu,
    pmc_ht,
    k_dluo,
    scenario,
    prix_vente_final,
    prix_revente_ttc,
    ratio,
    flag_anomalie,
    selected: pmc.source_niveau !== 'introuvable',
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

const LOT_SIZE = 20;

export function RecherchePmcClient() {
  const [produits, setProduits] = useState<ProduitAPI[]>([]);
  const [eanMap, setEanMap] = useState<Map<string, EanGroup>>(new Map());
  const [loading, setLoading] = useState(true);
  const [currentLot, setCurrentLot] = useState(0);
  const [promptText, setPromptText] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchProduits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pricing/pmc/recherche');
      const data = await res.json();
      const prods: ProduitAPI[] = data.produits ?? [];
      setProduits(prods);

      // Deduplicate by EAN
      const map = new Map<string, EanGroup>();
      for (const p of prods) {
        const existing = map.get(p.ean);
        if (existing) {
          existing.ids.push(p.id);
        } else {
          map.set(p.ean, {
            ids: [p.id],
            nom: p.nom,
            marque: p.marque,
            tva_taux: p.tva_taux,
            prix_achat_wag_ht: parseFloat(String(p.prix_achat_wag_ht)) || 0,
            dluo: p.dluo,
            flux: p.flux,
          });
        }
      }
      setEanMap(map);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProduits(); }, [fetchProduits]);

  const eanList = Array.from(eanMap.keys());
  const totalEans = eanList.length;
  const totalLots = Math.max(1, Math.ceil(totalEans / LOT_SIZE));
  const lotEans = eanList.slice(currentLot * LOT_SIZE, (currentLot + 1) * LOT_SIZE);

  // ─── Prompt generation ──────────────────────────────────────────────────

  function generatePrompt() {
    const lines = lotEans.map(ean => {
      const g = eanMap.get(ean)!;
      return `${ean} | ${g.nom} | ${g.marque} | ${g.tva_taux}%`;
    });

    const prompt = `Active la recherche web avant de répondre.
Recherche les prix TTC actuels pour ces produits sur chaque enseigne française. Cherche par EAN d'abord, puis par nom+marque si non trouvé.
Retourne UNIQUEMENT ce JSON sans aucun texte avant ou après :
{"pmcs": [{"ean": "xxx", "pmc_leclerc": XX.XX, "pmc_carrefour": XX.XX, "pmc_auchan": XX.XX, "pmc_intermarche": XX.XX, "pmc_lidl": XX.XX, "pmc_concurrent_antigaspi": XX.XX, "pmc_grossiste": XX.XX, "source_url": "https://...", "source_niveau": "enseigne|estimation|introuvable"}]}
Règles : null si introuvable sur une enseigne. Ne jamais inventer un prix.
Produits [EAN | Nom | Marque | TVA%] :
${lines.join('\n')}`;

    setPromptText(prompt);
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ─── JSON parsing ───────────────────────────────────────────────────────

  function parseJson() {
    const match = jsonInput.match(/\{[\s\S]*"pmcs"[\s\S]*\}/);
    if (!match) return;
    try {
      const parsed = JSON.parse(match[0]);
      const pmcs: PmcParsed[] = parsed.pmcs ?? [];
      const rows = pmcs
        .filter(p => eanMap.has(p.ean))
        .map(p => computeRow(p, eanMap.get(p.ean)!));
      setPreviewRows(rows);
    } catch {
      // ignore invalid JSON
    }
  }

  useEffect(() => {
    if (jsonInput.trim()) parseJson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsonInput]);

  // ─── Cell edit handler ──────────────────────────────────────────────────

  function updateCell(idx: number, field: keyof PmcParsed, value: number | null) {
    setPreviewRows(prev => {
      const next = [...prev];
      const row = { ...next[idx], [field]: value };
      const group = eanMap.get(row.ean);
      if (group) {
        const recomputed = computeRow(row as PmcParsed, group);
        recomputed.selected = row.selected;
        next[idx] = recomputed;
      } else {
        next[idx] = row;
      }
      return next;
    });
  }

  function toggleSelect(idx: number) {
    setPreviewRows(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], selected: !next[idx].selected };
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setPreviewRows(prev => prev.map(r => ({ ...r, selected: checked })));
  }

  // ─── Import ─────────────────────────────────────────────────────────────

  async function handleImport() {
    const selected = previewRows.filter(r => r.selected);
    if (selected.length === 0) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/pricing/pmc/recherche', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pmcs: selected.map(r => ({
            ean: r.ean,
            pmc_leclerc: r.pmc_leclerc,
            pmc_carrefour: r.pmc_carrefour,
            pmc_auchan: r.pmc_auchan,
            pmc_intermarche: r.pmc_intermarche,
            pmc_lidl: r.pmc_lidl,
            pmc_concurrent_antigaspi: r.pmc_concurrent_antigaspi,
            pmc_grossiste: r.pmc_grossiste,
            pmc_retenu: r.pmc_retenu,
            pmc_ht: r.pmc_ht,
            source_niveau: r.source_niveau,
            source_url: r.source_url,
            flag_anomalie: r.flag_anomalie,
            k_dluo: r.k_dluo,
            scenario: r.scenario,
            prix_vente_wag_ht: r.prix_vente_final,
            prix_revente_conseille_ttc: r.prix_revente_ttc,
          })),
        }),
      });
      const result = await res.json();
      setImportResult(`${selected.length} EANs traités, ${result.updated} produits mis à jour, ${result.inserted} entrées historique créées`);
      setPreviewRows([]);
      setJsonInput('');
      setPromptText('');
      await fetchProduits();
    } catch {
      setImportResult('Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  }

  // ─── Render helpers ─────────────────────────────────────────────────────

  const scenarioColor: Record<string, string> = {
    A: 'text-green-700',
    B: 'text-yellow-700',
    C: 'text-orange-700',
    D: 'text-red-700',
  };

  const selectedCount = previewRows.filter(r => r.selected).length;

  function fmtNum(v: number | null): string {
    if (v === null) return '—';
    return v.toFixed(2);
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Recherche PMC manuelle</h1>
          <p className="text-sm text-gray-700 mt-1">
            {totalEans} EANs uniques à traiter / {produits.length} produits total
          </p>
        </div>
      </div>

      {/* Lot selector */}
      {totalLots > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">Lot :</span>
          {Array.from({ length: totalLots }, (_, i) => {
            const start = i * LOT_SIZE + 1;
            const end = Math.min((i + 1) * LOT_SIZE, totalEans);
            return (
              <button
                key={i}
                onClick={() => { setCurrentLot(i); setPromptText(''); setPreviewRows([]); setJsonInput(''); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  currentLot === i
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'
                }`}
              >
                Lot {i + 1} ({start}-{end})
              </button>
            );
          })}
        </div>
      )}

      {/* Step 1: Generate prompt */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Étape 1 — Générer le prompt</h2>
        <p className="text-sm text-gray-700">
          {lotEans.length} EANs dans ce lot. Cliquez pour générer le prompt à envoyer à Claude.ai.
        </p>
        <button
          onClick={generatePrompt}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Générer le prompt
        </button>

        {promptText && (
          <div className="space-y-3">
            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-900 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {promptText}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={copyPrompt}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                {copied ? 'Copié !' : 'Copier le prompt'}
              </button>
              <button
                onClick={() => window.open('https://claude.ai', '_blank')}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Ouvrir Claude.ai
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Paste JSON */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Étape 2 — Coller la réponse JSON</h2>
        <textarea
          value={jsonInput}
          onChange={e => setJsonInput(e.target.value)}
          placeholder='Collez ici la réponse JSON de Claude ({"pmcs": [...]})'
          rows={6}
          className="w-full border border-gray-300 rounded-lg p-3 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Step 3: Preview table */}
      {previewRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">
            Étape 3 — Preview ({previewRows.length} résultats)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-gray-900 font-medium">
                    <input
                      type="checkbox"
                      checked={previewRows.every(r => r.selected)}
                      onChange={e => toggleAll(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="text-left py-2 px-2 text-gray-900 font-medium">EAN</th>
                  <th className="text-left py-2 px-2 text-gray-900 font-medium">Nom</th>
                  <th className="text-right py-2 px-2 text-gray-900 font-medium">Leclerc</th>
                  <th className="text-right py-2 px-2 text-gray-900 font-medium">Carrefour</th>
                  <th className="text-right py-2 px-2 text-gray-900 font-medium">Auchan</th>
                  <th className="text-right py-2 px-2 text-gray-900 font-medium">Intermarché</th>
                  <th className="text-right py-2 px-2 text-gray-900 font-medium">Lidl</th>
                  <th className="text-right py-2 px-2 text-gray-900 font-medium">Anti-gaspi</th>
                  <th className="text-right py-2 px-2 text-gray-900 font-medium">Grossiste</th>
                  <th className="text-right py-2 px-2 text-gray-900 font-medium">PMC P75</th>
                  <th className="text-right py-2 px-2 text-gray-900 font-medium">PMC HT</th>
                  <th className="text-right py-2 px-2 text-gray-900 font-medium">K_dluo</th>
                  <th className="text-center py-2 px-2 text-gray-900 font-medium">Scénario</th>
                  <th className="text-right py-2 px-2 text-gray-900 font-medium">Prix vente HT</th>
                  <th className="text-center py-2 px-2 text-gray-900 font-medium">⚠️</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, idx) => {
                  const isIntrouvable = row.source_niveau === 'introuvable';
                  const rowClass = isIntrouvable ? 'bg-gray-50' : '';
                  const textClass = isIntrouvable ? 'text-gray-500' : 'text-gray-900';

                  return (
                    <tr key={row.ean} className={`border-b border-gray-100 ${rowClass}`}>
                      <td className="py-2 px-2">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => toggleSelect(idx)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className={`py-2 px-2 font-mono text-xs ${textClass}`}>{row.ean}</td>
                      <td className={`py-2 px-2 max-w-[160px] truncate ${textClass}`} title={`${row.nom} — ${row.marque}`}>
                        {row.nom}
                      </td>
                      {/* Editable price cells */}
                      {(['pmc_leclerc', 'pmc_carrefour', 'pmc_auchan', 'pmc_intermarche', 'pmc_lidl', 'pmc_concurrent_antigaspi', 'pmc_grossiste'] as const).map(field => (
                        <td key={field} className="py-1 px-1">
                          <input
                            type="number"
                            step="0.01"
                            value={row[field] ?? ''}
                            onChange={e => {
                              const v = e.target.value === '' ? null : parseFloat(e.target.value);
                              updateCell(idx, field, v);
                            }}
                            className={`w-16 text-right border border-gray-300 rounded px-1 py-0.5 text-xs ${textClass} focus:ring-1 focus:ring-indigo-500`}
                          />
                        </td>
                      ))}
                      <td className={`py-2 px-2 text-right font-medium ${textClass}`}>{fmtNum(row.pmc_retenu)}</td>
                      <td className={`py-2 px-2 text-right ${textClass}`}>{fmtNum(row.pmc_ht)}</td>
                      <td className={`py-2 px-2 text-right ${textClass}`}>{row.k_dluo.toFixed(2)}</td>
                      <td className={`py-2 px-2 text-center font-bold ${row.scenario ? scenarioColor[row.scenario] || textClass : textClass}`}>
                        {row.scenario ?? '—'}
                      </td>
                      <td className={`py-2 px-2 text-right font-medium ${textClass}`}>{fmtNum(row.prix_vente_final)}</td>
                      <td className="py-2 px-2 text-center">
                        {row.flag_anomalie && <span className="text-orange-500" title="Écart > 50% entre enseignes">⚠️</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Step 4: Import */}
          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={handleImport}
              disabled={importing || selectedCount === 0}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing ? 'Import en cours...' : `Importer ${selectedCount} PMC sélectionnés`}
            </button>
            {importResult && (
              <span className="text-sm text-green-700 font-medium">{importResult}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
