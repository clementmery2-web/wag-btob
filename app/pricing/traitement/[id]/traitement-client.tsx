'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { DEMO_OFFRES } from '../../lib/demo-data';
import { calculerMargeWag, calculerRemiseVsGd, joursRestantsDdm, formatEur, formatPct } from '../../lib/types';
import type { Produit } from '../../lib/types';

const SCENARIO_CONFIG: Record<string, { label: string; emoji: string; cls: string; desc: string }> = {
  A: { label: 'JACKPOT', emoji: '🟢', cls: 'bg-green-100 text-green-700 border-green-300', desc: 'Prix achat < 20% ref' },
  B: { label: 'NORMAL', emoji: '🟡', cls: 'bg-yellow-100 text-yellow-700 border-yellow-300', desc: 'Prix achat 20-43% ref' },
  C: { label: 'CONTRE-OFFRE', emoji: '🟠', cls: 'bg-orange-100 text-orange-700 border-orange-300', desc: 'Prix achat 43-50% ref' },
  D: { label: 'REFUS', emoji: '🔴', cls: 'bg-red-100 text-red-700 border-red-300', desc: 'Prix achat > 50% ref' },
};

const ETAT_LABELS: Record<string, string> = {
  intact: 'Intact',
  declasse: 'Déclassé',
  etiquette_abimee: 'Étiquette abîmée',
  emballage_abime: 'Emballage abîmé',
};

interface ProduitExt extends Produit {
  pmc_statut?: string;
  fournisseur_nom?: string;
}

export function TraitementClient({ offreId }: { offreId: string }) {
  const [produits, setProduits] = useState<ProduitExt[]>([]);
  const [fournisseurNom, setFournisseurNom] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const [sliderValue, setSliderValue] = useState<number | null>(null);
  const [sliderModifiedManually, setSliderModifiedManually] = useState(false);
  const [pmcTtcSaisi, setPmcTtcSaisi] = useState<Record<string, number>>({});
  const [pmcTtcStr, setPmcTtcStr] = useState<Record<string, string>>({});
  const [prixAchatSaisi, setPrixAchatSaisi] = useState<Record<string, number>>({});

  // Fetch products from API
  useEffect(() => {
    setLoading(true);
    fetch(`/api/pricing/produits?offre_id=${encodeURIComponent(offreId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.produits && data.produits.length > 0) {
          setProduits(data.produits);
          setFournisseurNom(data.produits[0].fournisseur_nom ?? '');
          setSource(data.source ?? 'supabase');
        } else {
          const demoOffre = DEMO_OFFRES.find(o => o.id === offreId);
          if (demoOffre) {
            setProduits(demoOffre.produits);
            setFournisseurNom(demoOffre.fournisseur);
            setSource('demo');
          }
        }
      })
      .catch(() => {
        const demoOffre = DEMO_OFFRES.find(o => o.id === offreId);
        if (demoOffre) {
          setProduits(demoOffre.produits);
          setFournisseurNom(demoOffre.fournisseur);
          setSource('demo');
        }
      })
      .finally(() => setLoading(false));
  }, [offreId]);

  const current = produits[currentIndex];
  const treated = produits.filter(p => p.statut !== 'a_traiter').length;

  // Prix d'achat effectif (saisi manuellement ou depuis Supabase)
  const prixAchat = prixAchatSaisi[current?.id ?? ''] ?? (current?.prix_achat_wag_ht || 0);

  // Calcul cascade
  const pmcTtc = pmcTtcSaisi[current?.id ?? ''] ?? (current?.pmc_ttc_gd || 0);
  const tva = current?.tva_taux || 5.5;
  const pmcHtCalcule = useMemo(() => {
    return pmcTtc > 0 ? pmcTtc / (1 + tva / 100) : null;
  }, [pmcTtc, tva]);

  const dluo_jours = current?.ddm
    ? Math.floor((new Date(current.ddm).getTime() - Date.now()) / 86400000)
    : null;

  const kDlouCalcule = useMemo(() => {
    if (current?.flux === 'dropshipping') return 0.48;
    if (dluo_jours === null) return 0.48;
    if (dluo_jours > 90) return 0.48;
    if (dluo_jours > 30) return 0.40;
    if (dluo_jours > 15) return 0.32;
    return 0.25;
  }, [current?.flux, dluo_jours]);

  const coeffFlux = current?.flux === 'entrepot' ? 1.20 : current?.flux === 'transit' ? 1.25 : 1.15;
  const prixMin = prixAchat * coeffFlux;

  const scenarioCalcule = useMemo(() => {
    if (!pmcHtCalcule || pmcHtCalcule === 0) return null;
    if (!prixAchat || prixAchat === 0) return null;
    const ref = pmcHtCalcule * kDlouCalcule;
    if (ref === 0) return null;
    const ratio = prixAchat / ref;
    if (ratio < 0.20) return { code: 'A', prixVente: pmcHtCalcule * 0.40 };
    if (ratio < 0.43) return { code: 'B', prixVente: pmcHtCalcule * 0.48 };
    if (ratio < 0.50) return { code: 'C', prixVente: (pmcHtCalcule * 0.48) / 1.15 };
    return { code: 'D', prixVente: null };
  }, [pmcHtCalcule, prixAchat, kDlouCalcule]);

  const prixVenteFinal = scenarioCalcule?.prixVente
    ? Math.max(scenarioCalcule.prixVente, prixMin)
    : null;

  // Prix d'achat suggéré (limite scénario B)
  const prixAchatSuggere = prixAchat === 0 && pmcHtCalcule && pmcHtCalcule > 0
    ? Math.round(pmcHtCalcule * kDlouCalcule * 0.43 * 100) / 100
    : null;

  // Auto-set slider when prixVenteFinal changes and slider not manually modified
  useEffect(() => {
    if (prixVenteFinal !== null && !sliderModifiedManually) {
      setSliderValue(prixVenteFinal);
    }
  }, [prixVenteFinal, sliderModifiedManually]);

  const prixVente = sliderValue ?? prixVenteFinal ?? current?.prix_vente_wag_ht ?? 0;
  const margeWag = prixAchat > 0 ? calculerMargeWag(prixAchat, prixVente) : 0;
  const remiseGd = pmcHtCalcule && pmcHtCalcule > 0 ? calculerRemiseVsGd(prixVente, pmcHtCalcule) : 0;
  const joursDdm = current ? joursRestantsDdm(current.ddm) : 0;
  const sc = scenarioCalcule ? SCENARIO_CONFIG[scenarioCalcule.code] : null;

  // handleAction with PATCH
  const handleAction = useCallback((action: Produit['statut']) => {
    if (!current) return;
    setProduits(prev => prev.map((p, i) => i === currentIndex ? { ...p, statut: action } : p));

    fetch(`/api/pricing/produits/${current.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        statut: action,
        prix_vente_wag_ht: sliderValue || prixVenteFinal || null,
        pmc_ttc_gd: pmcTtcSaisi[current.id] || null,
        pmc_ht: pmcHtCalcule || null,
        pmc_statut: pmcTtcSaisi[current.id] ? 'valide' : 'manuel_requis',
        k_dluo: kDlouCalcule,
        scenario: scenarioCalcule?.code || null,
        prix_achat_wag_ht: prixAchatSaisi[current.id] || null,
      }),
    }).catch(err => console.error('[traitement] PATCH failed:', err));

    setSliderValue(null);
    setSliderModifiedManually(false);
    if (currentIndex < produits.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [current, currentIndex, produits.length, sliderValue, prixVenteFinal, pmcTtcSaisi, pmcHtCalcule, kDlouCalcule, scenarioCalcule, prixAchatSaisi]);

  // Reset slider manual flag on index change
  useEffect(() => {
    setSliderModifiedManually(false);
  }, [currentIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      switch (e.key) {
        case 'ArrowRight': handleAction('valide'); break;
        case 'ArrowLeft': handleAction('contre_offre'); break;
        case 'ArrowDown': handleAction('refuse'); break;
        case ' ': e.preventDefault(); handleAction('passe'); break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleAction]);

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 mt-2">Chargement des produits...</p>
      </div>
    );
  }

  if (produits.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Offre introuvable ou aucun produit</p>
        <Link href="/pricing/offres" className="text-indigo-600 text-sm mt-2 inline-block">← Retour aux offres</Link>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="text-4xl">✅</div>
        <h2 className="text-xl font-bold text-gray-900">Tous les produits ont été traités</h2>
        <div className="flex justify-center gap-3">
          <Link href={`/pricing/validation/${offreId}`} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
            Voir le résumé →
          </Link>
          <Link href="/pricing/offres" className="text-gray-600 hover:text-gray-800 text-sm font-medium px-5 py-2.5 rounded-lg border border-gray-300 transition-colors">
            Retour aux offres
          </Link>
        </div>
      </div>
    );
  }

  const prixReventeTTC = Math.round(prixVente * 1.055 * 1.3 * 100) / 100;
  const margeRetailEstimee = 30;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/pricing/offres" className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{fournisseurNom || 'Offre'}</h1>
            {source && <p className="text-[10px] text-gray-400">Source : {source === 'supabase' ? '🟢 Supabase' : '🟡 Démo'}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${(treated / produits.length) * 100}%` }} />
            </div>
            <span className="font-medium">{treated} / {produits.length}</span>
          </div>
          <button
            onClick={() => setShowRules(!showRules)}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-1.5 rounded-md"
          >
            Règles auto
          </button>
          <Link
            href={`/pricing/validation/${offreId}`}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Résumé →
          </Link>
        </div>
      </div>

      {/* Rules modal */}
      {showRules && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm space-y-2">
          <h3 className="font-bold text-gray-900">Règles automatiques</h3>
          <p className="text-gray-600">• Si marge WAG &gt; 35% → valider automatiquement</p>
          <p className="text-gray-600">• Si scénario D → refuser automatiquement</p>
          <p className="text-gray-600">• Si scénario C → contre-offre automatiquement</p>
          <p className="text-xs text-gray-400 mt-2">Ces règles sont appliquées à titre indicatif</p>
        </div>
      )}

      {/* Main content - 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Colonne gauche — Infos produit */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{current.nom}</h3>
            <p className="text-sm text-gray-500">{current.marque}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow label="EAN" value={current.ean} />
            <InfoRow label="Contenance" value={current.contenance} />
            <InfoRow label="Stock" value={`${current.stock_disponible} unités`} />
            <InfoRow label="Flux" value={current.flux === 'entrepot' ? 'Entrepôt' : current.flux === 'dropshipping' ? 'Dropshipping' : 'Transit'} />
            <InfoRow label="État" value={ETAT_LABELS[current.etat] ?? current.etat} />
            <div>
              <p className="text-xs text-gray-400">DDM restante</p>
              <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                joursDdm < 30 ? 'bg-red-100 text-red-700' : joursDdm < 90 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
              }`}>
                {joursDdm} jours
              </span>
            </div>
          </div>
        </div>

        {/* Colonne droite — Pricing */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            {/* PMC TTC input */}
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase block mb-1">PMC TTC Grande Distribution (€)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="3.49"
                value={pmcTtcStr[current.id] ?? (current.pmc_ttc_gd ? String(current.pmc_ttc_gd) : '')}
                onChange={e => {
                  const str = e.target.value.replace(',', '.');
                  setPmcTtcStr(prev => ({ ...prev, [current.id]: str }));
                  setPmcTtcSaisi(prev => ({ ...prev, [current.id]: parseFloat(str) || 0 }));
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              />
              {pmcTtc > 0 && pmcHtCalcule !== null && (
                <p className="text-xs text-gray-500 mt-1">PMC HT : {pmcHtCalcule.toFixed(2)} €</p>
              )}
            </div>

            {/* Prix achat WAG HT */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase mb-1">Prix achat WAG HT</p>
              {prixAchat > 0 ? (
                <p className="text-2xl font-bold text-gray-900">{formatEur(prixAchat)}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-orange-500">Prix d&apos;achat manquant</p>
                  {prixAchatSuggere !== null && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs text-amber-700">
                        Prix d&apos;achat suggéré (limite scénario B) : <span className="font-bold">{formatEur(prixAchatSuggere)}</span> HT
                      </p>
                      <button
                        onClick={() => {
                          setPrixAchatSaisi(prev => ({ ...prev, [current.id]: prixAchatSuggere }));
                          setSliderModifiedManually(false);
                        }}
                        className="mt-1.5 text-xs font-semibold text-amber-800 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded transition-colors"
                      >
                        Utiliser ce prix
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Scénario */}
            {pmcTtc === 0 && (
              <p className="text-sm text-gray-400">Saisir le PMC TTC pour calculer le scénario</p>
            )}
            {sc && scenarioCalcule && (
              <div className={`rounded-lg border px-4 py-2.5 ${sc.cls}`}>
                <span className="font-bold text-sm">{sc.emoji} Scénario {scenarioCalcule.code} — {sc.label}</span>
                <span className="text-xs ml-2 opacity-70">({sc.desc})</span>
              </div>
            )}

            {/* Prix de vente + slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-400 uppercase">Prix de vente WAG HT</p>
                <p className="text-lg font-bold text-indigo-600">{formatEur(prixVente)}</p>
              </div>
              <input
                type="range"
                min={prixAchat}
                max={pmcHtCalcule || prixAchat * 3 || 10}
                step={0.01}
                value={prixVente}
                onChange={e => {
                  setSliderValue(parseFloat(e.target.value));
                  setSliderModifiedManually(true);
                }}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* Métriques */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Marge WAG</p>
                <p className={`text-xl font-bold ${margeWag >= 20 ? 'text-green-600' : margeWag >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                  {formatPct(margeWag)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Remise vs GD</p>
                <p className="text-xl font-bold text-indigo-600">-{formatPct(remiseGd)}</p>
              </div>
            </div>

            {/* Preview card acheteur */}
            <div className="border border-dashed border-gray-300 rounded-lg p-3">
              <p className="text-[10px] uppercase font-semibold text-gray-400 mb-2">Preview card acheteur</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{current.nom}</p>
                  <p className="text-xs text-gray-500">{current.marque} — {current.contenance}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-indigo-600">{formatEur(prixVente)} HT</p>
                  <p className="text-xs text-gray-500">Revente TTC : ~{formatEur(prixReventeTTC)}</p>
                  <p className="text-xs text-green-600">-{formatPct(remiseGd)} vs GD • Marge retail ~{margeRetailEstimee}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => handleAction('valide')}
              className="bg-green-600 hover:bg-green-700 text-white rounded-lg py-3 text-sm font-semibold transition-colors flex flex-col items-center gap-0.5"
            >
              <span>✅ Valider</span>
              <span className="text-[10px] opacity-70">→</span>
            </button>
            <button
              onClick={() => handleAction('contre_offre')}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-3 text-sm font-semibold transition-colors flex flex-col items-center gap-0.5"
            >
              <span>📩 Contre-offre</span>
              <span className="text-[10px] opacity-70">←</span>
            </button>
            <button
              onClick={() => handleAction('refuse')}
              className="bg-red-500 hover:bg-red-600 text-white rounded-lg py-3 text-sm font-semibold transition-colors flex flex-col items-center gap-0.5"
            >
              <span>❌ Refuser</span>
              <span className="text-[10px] opacity-70">↓</span>
            </button>
            <button
              onClick={() => handleAction('passe')}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg py-3 text-sm font-semibold transition-colors flex flex-col items-center gap-0.5"
            >
              <span>⏭️ Passer</span>
              <span className="text-[10px] opacity-50">espace</span>
            </button>
          </div>

          {/* Navigation produits */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => { if (currentIndex > 0) { setCurrentIndex(currentIndex - 1); setSliderValue(null); } }}
              disabled={currentIndex === 0}
              className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30"
            >
              ← Précédent
            </button>
            <span className="text-xs text-gray-400">Produit {currentIndex + 1} / {produits.length}</span>
            <button
              onClick={() => { if (currentIndex < produits.length - 1) { setCurrentIndex(currentIndex + 1); setSliderValue(null); } }}
              disabled={currentIndex === produits.length - 1}
              className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30"
            >
              Suivant →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-700">{value}</p>
    </div>
  );
}
