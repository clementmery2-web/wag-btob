'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CATEGORY_EMOJI, FILTRE_CATEGORY_MAP } from './lib/catalogue-data';
import type { CatalogueProduit } from './lib/catalogue-data';

const SEUIL_COMMANDE = 500;
const TVA_RATE = 0.20;

const FILTRES = [
  { id: 'tout', label: 'Tout', emoji: '' },
  { id: 'meilleures_affaires', label: 'Meilleures affaires', emoji: '\u2B50' },
  { id: 'stock_limite', label: 'Stock limité', emoji: '\u26A1' },
  { id: 'ddm_courte', label: 'DDM courte', emoji: '\u{1F550}' },
  { id: 'marge_max', label: 'Marge max', emoji: '\u{1F4B0}' },
  { id: 'epicerie', label: 'Épicerie', emoji: '\u{1F96B}' },
  { id: 'hygiene', label: 'Hygiène & Beauté', emoji: '\u{1F9F4}' },
  { id: 'bebe', label: 'Bébé', emoji: '\u{1F37C}' },
  { id: 'entretien', label: 'Entretien', emoji: '\u{1F9F9}' },
  { id: 'animaux', label: 'Animaux', emoji: '\u{1F43E}' },
] as const;

type FiltreId = (typeof FILTRES)[number]['id'];

// ─── Helpers ────────────────────────────────────────────────────

function num(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function joursRestants(ddm: string | null | undefined): number {
  if (!ddm) return 0;
  const ts = new Date(ddm).getTime();
  if (isNaN(ts)) return 0;
  return Math.max(0, Math.floor((ts - Date.now()) / 86400000));
}

function formatEur(n: number): string {
  const safe = isNaN(n) ? 0 : n;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(safe);
}

/** Nombre minimum de cartons pour atteindre le QMC */
function nbCartonsMin(p: CatalogueProduit): number {
  const pcb = num(p.pcb) || 1;
  const minUnites = num(p.min_unites) || pcb;
  return Math.max(1, Math.ceil(minUnites / pcb));
}

/** Filtre + tri intelligent */
function filtrerEtTrier(produits: CatalogueProduit[], filtre: FiltreId): CatalogueProduit[] {
  let result = [...produits];

  // Calcul jours restants pour chaque produit
  const joursMap = new Map<string, number>();
  for (const p of result) joursMap.set(p.id, joursRestants(p.ddm));

  // FILTRAGE
  if (filtre === 'stock_limite') {
    result = result.filter(p => num(p.stock_disponible) < 200);
  } else if (filtre === 'ddm_courte') {
    result = result.filter(p => { const j = joursMap.get(p.id) ?? 0; return j > 0 && j < 90; });
  } else if (filtre in FILTRE_CATEGORY_MAP) {
    const cats = FILTRE_CATEGORY_MAP[filtre];
    result = result.filter(p => cats.includes(p.categorie));
  }

  // TRI
  if (filtre === 'meilleures_affaires') {
    result.sort((a, b) => num(b.remise_pct) - num(a.remise_pct));
  } else if (filtre === 'marge_max') {
    result.sort((a, b) => num(b.marge_retail_estimee) - num(a.marge_retail_estimee));
  } else if (filtre === 'ddm_courte') {
    result.sort((a, b) => (joursMap.get(a.id) ?? 0) - (joursMap.get(b.id) ?? 0));
  } else {
    // Tri par défaut : score composite
    result.sort((a, b) => {
      const stockScore = (s: number) => s < 100 ? 100 : s < 500 ? 50 : 0;
      const scoreA = num(a.remise_pct) * 0.4 + num(a.marge_retail_estimee) * 0.3 + stockScore(num(a.stock_disponible)) * 0.3;
      const scoreB = num(b.remise_pct) * 0.4 + num(b.marge_retail_estimee) * 0.3 + stockScore(num(b.stock_disponible)) * 0.3;
      return scoreB - scoreA;
    });
  }

  return result;
}

// ─── Main page ──────────────────────────────────────────────────

export default function CataloguePage() {
  const [filtre, setFiltre] = useState<FiltreId>('tout');
  const [allProduits, setAllProduits] = useState<CatalogueProduit[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>('');
  // Panier : produit_id → nb_cartons
  const [panier, setPanier] = useState<Record<string, number>>({});
  const [panierOpen, setPanierOpen] = useState(false);
  const [commandeOpen, setCommandeOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [commandeEnvoyee, setCommandeEnvoyee] = useState(false);

  const fetchProduits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/catalogue');
      const data = await res.json();
      setAllProduits(data.produits ?? []);
      setSource(data.source ?? '');
    } catch {
      setAllProduits([]);
      setSource('erreur');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProduits(); }, [fetchProduits]);

  // Filtered + sorted products
  const produits = useMemo(() => filtrerEtTrier(allProduits, filtre), [allProduits, filtre]);

  // Panier items with carton-based quantities
  const panierItems = useMemo(() => {
    return Object.entries(panier)
      .filter(([, cartons]) => cartons > 0)
      .map(([id, cartons]) => {
        const p = allProduits.find(x => x.id === id);
        if (!p) return null;
        const pcb = num(p.pcb) || 1;
        const prixUnit = num(p.prix_wag_ht);
        const nbUnites = cartons * pcb;
        const total = nbUnites * prixUnit;
        return { ...p, nbCartons: cartons, nbUnites, total };
      })
      .filter(Boolean) as (CatalogueProduit & { nbCartons: number; nbUnites: number; total: number })[];
  }, [panier, allProduits]);

  const totalCartons = panierItems.reduce((s, i) => s + i.nbCartons, 0);
  const totalUnites = panierItems.reduce((s, i) => s + i.nbUnites, 0);
  const totalHT = panierItems.reduce((s, i) => s + i.total, 0);
  const tva = totalHT * TVA_RATE;
  const totalTTC = totalHT + tva;
  const seuilAtteint = totalHT >= SEUIL_COMMANDE;

  // Group dropshipping items by fournisseur
  const fournisseurGroups = useMemo(() => {
    const groups = new Map<string, { items: typeof panierItems; totalHT: number }>();
    for (const item of panierItems) {
      if (item.flux === 'dropshipping' && item.fournisseur_nom) {
        const key = item.fournisseur_nom;
        const existing = groups.get(key) || { items: [], totalHT: 0 };
        existing.items.push(item);
        existing.totalHT += item.total;
        groups.set(key, existing);
      }
    }
    return groups;
  }, [panierItems]);

  const nbFournisseurs = fournisseurGroups.size;

  const fournisseurWarnings = useMemo(() => {
    const warnings: string[] = [];
    for (const [nom, group] of fournisseurGroups) {
      for (const item of group.items) {
        const minCartons = nbCartonsMin(item);
        if (item.nbCartons < minCartons) {
          warnings.push(`${nom} : ${item.nom} — min. ${minCartons} carton${minCartons > 1 ? 's' : ''} (${minCartons * (num(item.pcb) || 1)} unités)`);
        }
      }
    }
    return warnings;
  }, [fournisseurGroups]);

  const commandeBloquee = !seuilAtteint || fournisseurWarnings.length > 0;

  function addToPanier(p: CatalogueProduit) {
    const min = nbCartonsMin(p);
    setPanier(prev => ({
      ...prev,
      [p.id]: (prev[p.id] ?? 0) + min,
    }));
  }

  function updateCartons(id: string, cartons: number, minCartons: number) {
    if (cartons < minCartons) {
      // Below minimum → remove from cart
      setPanier(prev => { const n = { ...prev }; delete n[id]; return n; });
    } else {
      setPanier(prev => ({ ...prev, [id]: cartons }));
    }
  }

  function removeFromPanier(id: string) {
    setPanier(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  function handleCommande(e: React.FormEvent) {
    e.preventDefault();
    setCommandeEnvoyee(true);
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="18" cy="18" r="18" fill="#16a34a" />
              <path d="M18 8c-2 3-8 6-8 13a8 8 0 0016 0c0-2-1-4-3-6-1 2-3 3-5 3s-3-2-3-4c0-2 1-4 3-6z" fill="#fff" opacity=".9" />
            </svg>
            <div>
              <span className="text-lg font-bold text-gray-900">Willy <span className="text-green-600">Anti-gaspi</span></span>
              <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5 rounded-full ml-2">Catalogue BtoB</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/fournisseurs" className="hidden sm:inline-flex text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Espace fournisseur
            </Link>
            <button
              onClick={() => setPanierOpen(!panierOpen)}
              className="relative bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              Panier
              {totalCartons > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {totalCartons}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Hero */}
        <div className="text-center py-8 sm:py-12 mb-6">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3 leading-tight">
            Produits anti-gaspi à prix <span className="text-green-600">imbattables</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
            Stocks proches DDM, surplus et déclassés — jusqu&apos;à -80% vs grande distribution.
            <br className="hidden sm:block" />
            Commande minimum 500€ HT. Livraison France entière.
          </p>
        </div>

        {/* Filtres — pills scrollables */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {FILTRES.map(f => (
            <button
              key={f.id}
              onClick={() => setFiltre(f.id)}
              className={`flex-shrink-0 text-sm font-medium px-4 py-2 rounded-full border transition-colors ${
                filtre === f.id
                  ? 'bg-green-700 text-white border-green-700'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-green-500'
              }`}
            >
              {f.emoji ? `${f.emoji} ` : ''}{f.label}
            </button>
          ))}
        </div>

        {/* Source indicator (dev) */}
        {source && (
          <p className="text-xs text-gray-400 mb-2">
            Source : {source === 'supabase' ? '\u{1F7E2} Supabase' : source === 'demo' ? '\u{1F7E1} Données de démo' : '\u{1F534} Erreur'}
            {source === 'demo' && ' — configurez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY'}
          </p>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-16">
            <div className="inline-block w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500 mt-2">Chargement du catalogue...</p>
          </div>
        )}

        {/* Grille produits */}
        {!loading && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-12">
          {produits.map(p => {
            const jours = joursRestants(p.ddm);
            const cartonsInPanier = panier[p.id] ?? 0;
            const pcb = num(p.pcb) || 1;
            const minCartons = nbCartonsMin(p);
            const unitesInPanier = cartonsInPanier * pcb;
            const prixLigne = unitesInPanier * num(p.prix_wag_ht);

            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                {/* Photo */}
                <div className="bg-gray-100 h-36 flex items-center justify-center relative">
                  {p.photo_url && (p.photo_statut === 'validee' || p.photo_statut === 'upload_manuel' || p.photo_statut === 'auto_trouvee') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photo_url} alt={p.nom} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-4xl">{CATEGORY_EMOJI[p.categorie] || '\u{1F4E6}'}</span>
                  )}
                  {/* Badge remise */}
                  <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    -{Math.round(num(p.remise_pct))}%
                  </span>
                  {/* Badge DDM */}
                  <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    jours < 30 ? 'bg-red-100 text-red-700' : jours < 90 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                  }`}>
                    DDM {jours}j
                  </span>
                  {/* Badge contextuel selon filtre actif */}
                  {filtre === 'meilleures_affaires' && (
                    <span className="absolute bottom-2 left-2 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{'\u2B50'} Top affaire</span>
                  )}
                  {filtre === 'stock_limite' && (
                    <span className="absolute bottom-2 left-2 bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{'\u26A1'} Stock limité</span>
                  )}
                  {filtre === 'ddm_courte' && (
                    <span className="absolute bottom-2 left-2 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{'\u{1F550}'} Prix cassé</span>
                  )}
                  {filtre === 'marge_max' && (
                    <span className="absolute bottom-2 left-2 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{'\u{1F4B0}'} Marge +{Math.round(num(p.marge_retail_estimee))}%</span>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 flex-1 flex flex-col">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{p.marque}</p>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2 leading-snug">{p.nom}</h3>
                  <p className="text-xs text-gray-500 mb-3">{p.contenance}</p>

                  {/* Prix */}
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xl font-bold text-green-600">{formatEur(num(p.prix_wag_ht))}</span>
                    <span className="text-sm text-gray-400 line-through">{formatEur(num(p.prix_gd_ht))}</span>
                    <span className="text-xs text-gray-500">HT</span>
                  </div>

                  {/* Métriques */}
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                    <span className="text-green-600 font-medium">Marge retail ~{Math.round(num(p.marge_retail_estimee))}%</span>
                    <span>
                      {p.pmc_type === 'gd' ? 'vs GD' : p.pmc_type === 'pharma_bio' ? 'vs Pharma/Bio' : 'vs prix public'}
                    </span>
                  </div>

                  {/* Min commande — selon flux */}
                  <div className="text-xs text-gray-400 mb-3">
                    {p.flux === 'dropshipping' ? (
                      <>
                        <p>Min. {minCartons} carton{minCartons > 1 ? 's' : ''} &bull; {minCartons * pcb} unités</p>
                        <p className="text-[10px] text-amber-600 mt-0.5">Expédié par le fournisseur</p>
                      </>
                    ) : (
                      <p>Min. {minCartons} carton{minCartons > 1 ? 's' : ''} &bull; {minCartons * pcb} unités</p>
                    )}
                    <p className="mt-0.5">{num(p.stock_disponible)} dispo</p>
                  </div>

                  {/* Sélecteur quantité / Bouton ajout */}
                  <div className="mt-auto">
                    {cartonsInPanier > 0 ? (
                      <div>
                        <div className="flex items-stretch rounded-lg border border-gray-200 overflow-hidden">
                          <button
                            onClick={() => updateCartons(p.id, cartonsInPanier - 1, minCartons)}
                            className="bg-gray-100 hover:bg-gray-200 px-3 py-2 text-gray-700 font-bold text-sm transition-colors"
                          >
                            −
                          </button>
                          <div className="flex-1 bg-white border-x border-gray-200 px-3 py-2 text-center">
                            <p className="text-sm font-semibold text-gray-900">
                              {cartonsInPanier} carton{cartonsInPanier > 1 ? 's' : ''} &middot; {unitesInPanier} unités
                            </p>
                          </div>
                          <button
                            onClick={() => updateCartons(p.id, cartonsInPanier + 1, minCartons)}
                            className="bg-green-600 hover:bg-green-700 px-3 py-2 text-white font-bold text-sm transition-colors"
                          >
                            +
                          </button>
                        </div>
                        <p className="text-center text-xs text-green-600 font-semibold mt-1">{formatEur(prixLigne)} HT</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToPanier(p)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Ajouter au panier
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>}

        {!loading && produits.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500">Aucun produit dans cette catégorie pour le moment.</p>
          </div>
        )}
      </div>

      {/* Panier latéral */}
      {panierOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setPanierOpen(false)} />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Panier ({totalCartons} carton{totalCartons > 1 ? 's' : ''})</h2>
              <button onClick={() => setPanierOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {panierItems.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">Votre panier est vide</p>
              )}

              {/* Avertissement multi-fournisseur dropshipping */}
              {nbFournisseurs > 1 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                  <p className="font-semibold">{'\u26A0\uFE0F'} {nbFournisseurs} expéditions séparées — {nbFournisseurs} minimums de commande</p>
                </div>
              )}

              {/* Avertissement QMC non atteint par fournisseur */}
              {fournisseurWarnings.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 space-y-1">
                  <p className="font-semibold">Minimum de commande non atteint :</p>
                  {fournisseurWarnings.map((w, i) => (
                    <p key={i}>&bull; {w}</p>
                  ))}
                </div>
              )}

              {/* Produits stock WAG / transit */}
              {panierItems.filter(i => i.flux !== 'dropshipping').length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Stock WAG / Transit</p>
                  {panierItems.filter(i => i.flux !== 'dropshipping').map(item => (
                    <PanierItemRow key={item.id} item={item} updateCartons={updateCartons} removeFromPanier={removeFromPanier} />
                  ))}
                </div>
              )}

              {/* Produits dropshipping — groupés par fournisseur */}
              {Array.from(fournisseurGroups.entries()).map(([fournisseur, group]) => (
                <div key={fournisseur}>
                  <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-2">
                    Expédié par {fournisseur}
                  </p>
                  {group.items.map(item => (
                    <PanierItemRow key={item.id} item={item} updateCartons={updateCartons} removeFromPanier={removeFromPanier} />
                  ))}
                </div>
              ))}
            </div>

            {/* Résumé + seuil */}
            <div className="border-t border-gray-200 p-4 space-y-3">
              {/* Résumé */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Sous-total</span>
                  <span>{totalCartons} cartons &middot; {totalUnites} unités</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-900">
                  <span>Montant HT</span>
                  <span>{formatEur(totalHT)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>TVA estimée (20%)</span>
                  <span>{formatEur(tva)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-100">
                  <span>Total TTC estimé</span>
                  <span>{formatEur(totalTTC)}</span>
                </div>
              </div>

              {/* Barre de seuil */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Seuil minimum {formatEur(SEUIL_COMMANDE)} HT</span>
                  <span className={seuilAtteint ? 'text-green-600 font-medium' : 'text-red-500'}>
                    {seuilAtteint ? '\u2705 Commande minimum atteinte !' : `Il vous manque ${formatEur(SEUIL_COMMANDE - totalHT)} HT`}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${seuilAtteint ? 'bg-green-500' : 'bg-red-400'}`}
                    style={{ width: `${Math.min(100, (totalHT / SEUIL_COMMANDE) * 100)}%` }}
                  />
                </div>
              </div>

              {!commandeOpen ? (
                <button
                  onClick={() => setCommandeOpen(true)}
                  disabled={commandeBloquee}
                  className={`w-full text-sm font-bold py-3 rounded-lg transition-colors ${
                    commandeBloquee
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-700 hover:bg-green-800 text-white'
                  }`}
                >
                  {!seuilAtteint
                    ? `Minimum ${formatEur(SEUIL_COMMANDE)} HT requis`
                    : fournisseurWarnings.length > 0
                      ? 'Minimum fournisseur non atteint'
                      : 'Commander \u2192'}
                </button>
              ) : commandeEnvoyee ? (
                <div className="text-center py-4">
                  <div className="text-3xl mb-2">{'\u{1F389}'}</div>
                  <p className="text-base font-bold text-gray-900">Commande envoyée !</p>
                  <p className="text-sm text-gray-500 mt-1">Nous vous recontactons sous 2h.</p>
                </div>
              ) : (
                <form onSubmit={handleCommande} className="space-y-3">
                  <p className="text-sm font-semibold text-gray-900">Vos coordonnées</p>
                  <input
                    type="email"
                    required
                    placeholder="votre@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="06 XX XX XX XX"
                    value={telephone}
                    onChange={e => setTelephone(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                  />
                  <button
                    type="submit"
                    className="w-full bg-green-700 hover:bg-green-800 text-white text-sm font-bold py-3 rounded-lg transition-colors"
                  >
                    Envoyer ma commande ({formatEur(totalHT)} HT)
                  </button>
                  <p className="text-xs text-gray-400 text-center">Pas d&apos;engagement — on vous confirme la disponibilité sous 2h</p>
                </form>
              )}
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <svg width="24" height="24" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="18" cy="18" r="18" fill="#16a34a" />
              <path d="M18 8c-2 3-8 6-8 13a8 8 0 0016 0c0-2-1-4-3-6-1 2-3 3-5 3s-3-2-3-4c0-2 1-4 3-6z" fill="#fff" opacity=".9" />
            </svg>
            <span className="font-bold text-gray-900">Willy Anti-gaspi</span>
            <span className="text-sm text-gray-500">— Catalogue BtoB</span>
          </div>
          <p className="text-sm text-gray-600 mb-1">
            <a href="mailto:contact@willyantigaspi.fr" className="hover:text-green-600 transition-colors">contact@willyantigaspi.fr</a>
          </p>
          <p className="text-sm text-gray-400 mt-3">CGV &bull; Mentions légales &bull; Politique de confidentialité</p>
        </div>
      </footer>

      {/* Bouton panier sticky mobile */}
      {totalCartons > 0 && !panierOpen && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-40">
          <button
            onClick={() => setPanierOpen(true)}
            className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            Voir le panier — {formatEur(totalHT)} HT ({totalCartons} carton{totalCartons > 1 ? 's' : ''})
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Panier item row ──────────────────────────────────────────

function PanierItemRow({ item, updateCartons, removeFromPanier }: {
  item: CatalogueProduit & { nbCartons: number; nbUnites: number; total: number };
  updateCartons: (id: string, cartons: number, minCartons: number) => void;
  removeFromPanier: (id: string) => void;
}) {
  const pcb = num(item.pcb) || 1;
  const minC = nbCartonsMin(item);

  return (
    <div className="bg-gray-50 rounded-lg p-3 mb-2">
      <div className="flex items-start gap-3 mb-2">
        {/* Photo mini */}
        <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
          {item.photo_url && (item.photo_statut === 'validee' || item.photo_statut === 'upload_manuel' || item.photo_statut === 'auto_trouvee') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photo_url} alt={item.nom} className="w-full h-full object-contain rounded" />
          ) : (
            <span className="text-lg">{CATEGORY_EMOJI[item.categorie] || '\u{1F4E6}'}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{item.nom}</p>
          <p className="text-xs text-gray-500">{item.marque}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {item.nbCartons} carton{item.nbCartons > 1 ? 's' : ''} &times; {pcb} unités = {item.nbUnites} unités
          </p>
          <p className="text-xs text-gray-400">{formatEur(num(item.prix_wag_ht))} HT / unité</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => updateCartons(item.id, item.nbCartons - 1, minC)}
            className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center text-xs text-gray-600 hover:bg-gray-100"
          >
            −
          </button>
          <span className="text-sm font-semibold px-2 min-w-[60px] text-center">
            {item.nbCartons} crt{item.nbCartons > 1 ? 's' : ''}
          </span>
          <button
            onClick={() => updateCartons(item.id, item.nbCartons + 1, minC)}
            className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center text-xs text-gray-600 hover:bg-gray-100"
          >
            +
          </button>
        </div>
        <span className="text-sm font-bold text-gray-900">{formatEur(item.total)}</span>
      </div>
      <button
        onClick={() => removeFromPanier(item.id)}
        className="mt-2 text-[11px] text-red-500 hover:text-red-700 transition-colors flex items-center gap-1"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
        Supprimer
      </button>
    </div>
  );
}
