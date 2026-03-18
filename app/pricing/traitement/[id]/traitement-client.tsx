'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { DEMO_OFFRES } from '../../lib/demo-data';
import { calculerScenario, calculerMargeWag, calculerRemiseVsGd, calculerPrixVenteWag, joursRestantsDdm, formatEur, formatPct, PMC_TYPE_CONFIG, getRemiseLabel } from '../../lib/types';
import type { Produit, PmcType } from '../../lib/types';

const SCENARIO_CONFIG = {
  A: { label: 'JACKPOT', emoji: '🟢', cls: 'bg-green-100 text-green-800 border-green-300', desc: 'Prix achat < 20% PMC HT' },
  B: { label: 'NORMAL', emoji: '🟡', cls: 'bg-yellow-100 text-yellow-800 border-yellow-300', desc: 'Prix achat 20-43% PMC HT' },
  C: { label: 'CONTRE-OFFRE', emoji: '🟠', cls: 'bg-orange-100 text-orange-800 border-orange-300', desc: 'Prix achat 43-50% PMC HT' },
  D: { label: 'REFUS', emoji: '🔴', cls: 'bg-red-100 text-red-800 border-red-300', desc: 'Prix achat > 50% PMC HT' },
};

const ETAT_LABELS: Record<string, string> = {
  intact: 'Intact',
  declasse: 'Déclassé',
  etiquette_abimee: 'Étiquette abîmée',
  emballage_abime: 'Emballage abîmé',
};

export function TraitementClient({ offreId }: { offreId: string }) {
  const offre = DEMO_OFFRES.find(o => o.id === offreId);
  const [produits, setProduits] = useState<Produit[]>(offre?.produits ?? []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const [sliderValue, setSliderValue] = useState<number | null>(null);

  const current = produits[currentIndex];
  const treated = produits.filter(p => p.statut !== 'a_traiter').length;

  // Keyboard shortcuts
  const handleAction = useCallback((action: Produit['statut']) => {
    if (!current) return;
    setProduits(prev => prev.map((p, i) => i === currentIndex ? { ...p, statut: action } : p));
    setSliderValue(null);
    if (currentIndex < produits.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [current, currentIndex, produits.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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

  if (!offre) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Offre introuvable</p>
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

  const pmcHt = current.pmc_ht ?? 0;
  const pmcType: PmcType = current.pmc_type ?? 'gd';
  const pmcTypeConfig = PMC_TYPE_CONFIG[pmcType];
  const prixVente = sliderValue ?? current.prix_vente_wag_ht ?? calculerPrixVenteWag(current.prix_achat_ht, current.flux);
  const scenario = pmcHt > 0 ? calculerScenario(current.prix_achat_ht, pmcHt) : null;
  const margeWag = calculerMargeWag(current.prix_achat_ht, prixVente);
  const remiseGd = pmcHt > 0 ? calculerRemiseVsGd(prixVente, pmcHt) : 0;
  const joursDdm = joursRestantsDdm(current.ddm);
  const sc = scenario ? SCENARIO_CONFIG[scenario] : null;
  const remiseLabel = getRemiseLabel(pmcType, remiseGd);

  // Alertes
  const alertes: string[] = [];
  if (remiseGd > 75) alertes.push('PMC potentiellement faux (remise > 75%)');
  if (joursDdm < 30) alertes.push('DDM très courte — vérifier pricing');
  if (pmcType === 'estime') alertes.push('PMC estimé — vérifier manuellement avant validation');

  const prixReventeTTC = Math.round(prixVente * 1.055 * 1.3 * 100) / 100; // +5.5% TVA + marge retail ~30%
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
          <h1 className="text-lg font-bold text-gray-900">{offre.fournisseur}</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress */}
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
          <p className="text-xs text-gray-400 mt-2">Ces règles sont appliquées à titre indicatif — données de démonstration</p>
        </div>
      )}

      {/* Main content - split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Card produit (40%) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          {/* Photo placeholder */}
          <div className="bg-gray-100 rounded-lg h-40 flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91M18 13.5a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

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

        {/* Panel pricing (60%) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Prix et scénario */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase mb-1">Prix achat WAG HT</p>
                <p className="text-2xl font-bold text-gray-900">{formatEur(current.prix_achat_ht)}</p>
              </div>
              <div className={`rounded-lg p-3 -m-1 ${pmcTypeConfig.bgClass}`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`text-xs font-medium uppercase ${pmcTypeConfig.textClass === 'text-gray-900' ? 'text-gray-400' : pmcTypeConfig.textClass} opacity-80`}>
                    {pmcTypeConfig.label}
                  </p>
                  {current.pmc_type !== 'gd' && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      current.pmc_type === 'pharma_bio' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {current.pmc_type === 'pharma_bio' ? 'PHARMA/BIO' : 'ESTIMÉ'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-2xl font-bold ${pmcTypeConfig.textClass}`}>{pmcHt ? formatEur(pmcHt) : '—'}</p>
                  {current.pmc_fiabilite > 0 && (
                    <span className="text-xs text-amber-500" title={`Fiabilité ${current.pmc_fiabilite}/${PMC_TYPE_CONFIG[current.pmc_type].maxFiabilite} max (${pmcTypeConfig.label})`}>
                      {'⭐'.repeat(current.pmc_fiabilite)}
                    </span>
                  )}
                </div>
                {current.pmc_sources.length > 0 && (
                  <div className="mt-1 text-xs text-gray-400">
                    {current.pmc_sources.map(s => `${s.enseigne} ${formatEur(s.prix)}`).join(' | ')}
                  </div>
                )}
              </div>
            </div>

            {/* Scénario */}
            {sc && (
              <div className={`rounded-lg border px-4 py-2.5 ${sc.cls}`}>
                <span className="font-bold text-sm">{sc.emoji} Scénario {scenario} — {sc.label}</span>
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
                min={current.prix_achat_ht}
                max={pmcHt || current.prix_achat_ht * 3}
                step={0.01}
                value={prixVente}
                onChange={e => setSliderValue(parseFloat(e.target.value))}
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
                <p className="text-xs text-gray-400">
                  Remise vs {pmcType === 'gd' ? 'GD' : pmcType === 'pharma_bio' ? 'Pharma/Bio' : 'estimé'}
                </p>
                <p className="text-xl font-bold text-indigo-600">-{formatPct(remiseGd)}</p>
              </div>
            </div>

            {/* Alertes */}
            {alertes.length > 0 && (
              <div className="space-y-1">
                {alertes.map((a, i) => (
                  <p key={i} className="text-xs text-amber-600 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    {a}
                  </p>
                ))}
              </div>
            )}

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
                  <p className="text-xs text-green-600">{remiseLabel} • Marge retail ~{margeRetailEstimee}%</p>
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
