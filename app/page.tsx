'use client';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { CatalogueProduit } from './lib/catalogue-data';

const SEUIL_COMMANDE = 500;
const TVA_RATE = 0.20;
const PRODUCTS_PER_PAGE = 12;

// ─── Filtres simplifiés ──────────────────────────────────────
const FILTRES = [
  { id: 'meilleures_affaires', label: 'Meilleures affaires', emoji: '\u2B50' },
  { id: 'epicerie', label: 'Épicerie & Boissons', emoji: '\u{1F96B}' },
  { id: 'hygiene', label: 'Hygiène & Beauté', emoji: '\u{1F9F4}' },
  { id: 'entretien', label: 'Entretien', emoji: '\u{1F9F9}' },
  { id: 'stock_limite', label: 'Stock limité', emoji: '\u26A1' },
  { id: 'ddm_courte', label: 'DDM courte', emoji: '\u23F0' },
] as const;

type FiltreId = (typeof FILTRES)[number]['id'];

const FILTRE_CATEGORY_MAP: Record<string, string[]> = {
  epicerie: ['Épicerie salée', 'Épicerie sucrée', 'Boissons'],
  hygiene: ['Hygiène & Beauté'],
  entretien: ['Entretien'],
};

// ─── Helpers ────────────────────────────────────────────────────

function num(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function joursRestants(ddm: string | null | undefined): number | null {
  if (!ddm) return null;
  const ts = new Date(ddm).getTime();
  if (isNaN(ts)) return null;
  const j = Math.floor((ts - Date.now()) / 86400000);
  return j > 0 ? j : null;
}

function formatEur(n: number): string {
  const safe = isNaN(n) ? 0 : n;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(safe);
}

/** Normalize product names — "GENIE LESSIVE LIQUIDE" → "Génie Lessive Liquide" */
function normalizeName(name: string): string {
  if (!name) return '';
  // Si plus de 60% des lettres sont en majuscules → normaliser
  const letters = name.replace(/[^a-zA-Z]/g, '');
  const upperCount = (name.match(/[A-Z]/g) || []).length;
  if (letters.length > 0 && upperCount / letters.length > 0.6) {
    return name.toLowerCase().replace(/(^\w|\s\w|[-]\w)/g,
      c => c.toUpperCase());
  }
  return name;
}

function nbCartonsMin(p: CatalogueProduit): number {
  const pcb = num(p.pcb) || 1;
  const minUnites = num(p.min_unites) || pcb;
  return Math.max(1, Math.ceil(minUnites / pcb));
}

/** Category background + emoji for products without photo */
function categoryPlaceholder(cat: string): { bg: string; emoji: string } {
  const lc = cat.toLowerCase();
  if (lc.includes('épicerie') || lc.includes('boisson')) return { bg: 'bg-green-50', emoji: '\u{1F96B}' };
  if (lc.includes('hygiène') || lc.includes('beauté')) return { bg: 'bg-blue-50', emoji: '\u{1F9F4}' };
  if (lc.includes('entretien')) return { bg: 'bg-yellow-50', emoji: '\u{1F9F9}' };
  if (lc.includes('bébé')) return { bg: 'bg-pink-50', emoji: '\u{1F37C}' };
  if (lc.includes('animaux')) return { bg: 'bg-orange-50', emoji: '\u{1F43E}' };
  return { bg: 'bg-gray-50', emoji: '\u{1F4E6}' };
}

/** Score composite pour tri "Meilleures affaires" */
function scoreProduit(p: CatalogueProduit): number {
  const remise = num(p.remise_pct);
  const marge = num(p.marge_retail_estimee);
  const stockBonus = num(p.stock_disponible) < 200 ? 50 : 0;
  return remise * 0.5 + marge * 0.3 + stockBonus * 0.2;
}

function filtrerEtTrier(produits: CatalogueProduit[], filtre: FiltreId): CatalogueProduit[] {
  let result = [...produits];

  if (filtre === 'stock_limite') {
    result = result.filter(p => num(p.stock_disponible) < 200);
  } else if (filtre === 'ddm_courte') {
    result = result.filter(p => {
      const j = joursRestants(p.ddm);
      return j !== null && j < 90;
    });
  } else if (filtre in FILTRE_CATEGORY_MAP) {
    const cats = FILTRE_CATEGORY_MAP[filtre];
    result = result.filter(p => cats.includes(p.categorie));
  }

  // Tri par score composite décroissant
  if (filtre === 'ddm_courte') {
    result.sort((a, b) => (joursRestants(a.ddm) ?? 999) - (joursRestants(b.ddm) ?? 999));
  } else {
    result.sort((a, b) => scoreProduit(b) - scoreProduit(a));
  }

  return result;
}

// ─── Main page ──────────────────────────────────────────────────

export default function CataloguePage() {
  const [filtre, setFiltre] = useState<FiltreId>('meilleures_affaires');
  const [allProduits, setAllProduits] = useState<CatalogueProduit[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PER_PAGE);
  const [panier, setPanier] = useState<Record<string, number>>({});
  const [panierOpen, setPanierOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [commandeEnvoyee, setCommandeEnvoyee] = useState(false);

  const grilleRef = useRef<HTMLDivElement>(null);

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

  // Reset visible count when filter changes
  useEffect(() => { setVisibleCount(PRODUCTS_PER_PAGE); }, [filtre]);

  const produits = useMemo(() => filtrerEtTrier(allProduits, filtre), [allProduits, filtre]);
  const visibleProduits = useMemo(() => produits.slice(0, visibleCount), [produits, visibleCount]);
  const hasMore = visibleCount < produits.length;

  // Cart items
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
  const totalHT = panierItems.reduce((s, i) => s + i.total, 0);
  const seuilAtteint = totalHT >= SEUIL_COMMANDE;

  function addToPanier(p: CatalogueProduit) {
    const min = nbCartonsMin(p);
    setPanier(prev => ({ ...prev, [p.id]: (prev[p.id] ?? 0) + min }));
    // Don't auto-open cart — keep user browsing
  }

  function updateCartons(id: string, cartons: number, minCartons: number) {
    if (cartons < minCartons) {
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

  function scrollToGrille() {
    grilleRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ═══ HEADER — sticky ═══ */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
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
            <Link href="/fournisseurs" className="hidden sm:inline-flex text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Vous êtes fournisseur ?&nbsp;&rarr;
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

      {/* ═══ SECTION 1 — HERO ═══ */}
      <section className="bg-green-800 relative overflow-hidden">
        {/* Subtle texture */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center relative z-10">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white mb-4 leading-tight">
            Des marques connues. Des prix impossibles.
          </h1>
          <p className="text-base sm:text-xl text-white/85 max-w-2xl mx-auto mb-8 leading-relaxed">
            Petit Navire, Bonduelle, Gerblé, Tropicana — jusqu&apos;à -85% du prix GD.
            <br className="hidden sm:block" />
            Vous achetez 2&nbsp;€, vous revendez 4&nbsp;€.
          </p>

          {/* 3 chiffres clés */}
          <div className="flex items-center justify-center gap-6 sm:gap-12 mb-8">
            <div className="text-center">
              <p className="text-3xl sm:text-5xl font-extrabold text-white">{allProduits.length || '...'}</p>
              <p className="text-xs sm:text-sm text-white/70 mt-1">références disponibles</p>
            </div>
            <div className="w-px h-12 bg-white/20" />
            <div className="text-center">
              <p className="text-3xl sm:text-5xl font-extrabold text-white">-85%</p>
              <p className="text-xs sm:text-sm text-white/70 mt-1">remise max vs GD</p>
            </div>
            <div className="w-px h-12 bg-white/20" />
            <div className="text-center">
              <p className="text-3xl sm:text-5xl font-extrabold text-white">&times;2</p>
              <p className="text-xs sm:text-sm text-white/70 mt-1">marge moyenne acheteurs</p>
            </div>
          </div>

          <button
            onClick={scrollToGrille}
            className="bg-white text-green-800 font-bold text-base sm:text-lg px-8 py-3.5 rounded-xl hover:bg-green-50 transition-colors shadow-lg"
          >
            Voir les meilleures affaires &rarr;
          </button>
        </div>
      </section>

      {/* ═══ SECTION 2 — BARRE DE RÉASSURANCE ═══ */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-gray-600">
          <span>Commande min. 500&nbsp;€ HT</span>
          <span className="hidden sm:inline text-gray-300">&bull;</span>
          <span>Livraison France entière</span>
          <span className="hidden sm:inline text-gray-300">&bull;</span>
          <span>Facture pro fournie</span>
          <span className="hidden sm:inline text-gray-300">&bull;</span>
          <span className="text-orange-600 font-medium">Offre valable jusqu&apos;à épuisement des stocks</span>
        </div>
      </div>

      {/* ═══ SECTION 3 — FILTRES ═══ */}
      <div ref={grilleRef} className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
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
              {f.emoji} {f.label}
            </button>
          ))}
        </div>

        {/* Source indicator (discret) */}
        {source && (
          <p className="text-xs text-gray-400 mb-2">
            Source : {source === 'supabase' ? '\u{1F7E2} Supabase' : source === 'demo' ? '\u{1F7E1} Données de démo' : '\u{1F534} Erreur'}
          </p>
        )}
      </div>

      {/* ═══ SECTION 4 — GRILLE PRODUITS ═══ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
                <div className="bg-gray-200 h-40" />
                <div className="p-4 space-y-3">
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-6 bg-gray-200 rounded w-2/3" />
                  <div className="h-10 bg-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Product grid */}
        {!loading && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleProduits.map(p => {
                const jours = joursRestants(p.ddm);
                const cartonsInPanier = panier[p.id] ?? 0;
                const pcb = num(p.pcb) || 1;
                const minCartons = nbCartonsMin(p);
                const unitesInPanier = cartonsInPanier * pcb;
                const prixLigne = unitesInPanier * num(p.prix_wag_ht);
                const placeholder = categoryPlaceholder(p.categorie);
                const hasPhoto = p.photo_url && (p.photo_statut === 'validee' || p.photo_statut === 'upload_manuel' || p.photo_statut === 'auto_trouvee');

                // Prix de revente estimé (×1.50) et marge
                const coutTTC = num(p.prix_wag_ht) * (1 + TVA_RATE);
                const prixRevente = coutTTC * 1.50;
                // Utiliser marge Supabase si disponible, sinon calculer
                const margeRevente = num(p.marge_retail_estimee) > 0
                  ? num(p.marge_retail_estimee)
                  : ((prixRevente - coutTTC) / prixRevente) * 100;

                // Nom normalisé
                const nomNorm = normalizeName(p.nom);
                const marqueNorm = normalizeName(p.marque);

                return (
                  <div key={p.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                    {/* Photo zone */}
                    <div className={`${hasPhoto ? 'bg-white' : placeholder.bg} h-40 flex items-center justify-center relative`}>
                      {hasPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo_url!} alt={nomNorm} className="w-full h-full object-contain p-2" />
                      ) : (
                        <span className="text-5xl">{placeholder.emoji}</span>
                      )}
                      {/* Badge remise — toujours */}
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        -{Math.round(num(p.remise_pct))}%
                      </span>
                      {/* Badge DDM — seulement si pertinent */}
                      {jours !== null && (
                        <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          jours < 30 ? 'bg-red-100 text-red-700' : jours < 90 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                        }`}>
                          DDM {jours}j
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4 flex-1 flex flex-col">
                      <p className="text-xs text-gray-400 mb-0.5">{marqueNorm}</p>
                      <h3 className="text-sm font-semibold text-gray-900 mb-0.5 leading-snug line-clamp-2">{nomNorm}</h3>
                      <p className="text-xs text-gray-400 mb-3">{p.contenance}</p>

                      {/* Prix WAG + GD barré */}
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-xl font-bold text-green-600">{formatEur(num(p.prix_wag_ht))}</span>
                        <span className="text-sm text-gray-400 line-through">{formatEur(num(p.prix_gd_ht))}</span>
                        <span className="text-xs text-gray-400">HT</span>
                      </div>

                      {/* Argument acheteur : prix de revente */}
                      <div className="bg-green-50 rounded-lg px-3 py-2 mb-3">
                        <p className="text-sm text-green-700 font-medium">
                          Vous revendez ~{formatEur(prixRevente)}
                        </p>
                        <p className="text-xs text-green-600">
                          Marge estimée ~{Math.round(margeRevente)}%
                        </p>
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
                                &minus;
                              </button>
                              <div className="flex-1 bg-white border-x border-gray-200 px-2 py-2 text-center">
                                <p className="text-sm font-semibold text-gray-900">
                                  {cartonsInPanier} carton{cartonsInPanier > 1 ? 's' : ''}
                                </p>
                              </div>
                              <button
                                onClick={() => updateCartons(p.id, cartonsInPanier + 1, minCartons)}
                                className="bg-green-600 hover:bg-green-700 px-3 py-2 text-white font-bold text-sm transition-colors"
                              >
                                +
                              </button>
                            </div>
                            <p className="text-center text-xs text-gray-500 mt-1">
                              = {unitesInPanier} unités &middot; {formatEur(prixLigne)} HT
                            </p>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToPanier(p)}
                            className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
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
            </div>

            {/* Voir plus */}
            {hasMore && (
              <div className="text-center mt-8">
                <button
                  onClick={() => setVisibleCount(prev => prev + PRODUCTS_PER_PAGE)}
                  className="bg-white border border-gray-300 text-gray-700 font-semibold text-sm px-8 py-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Voir plus de produits ({produits.length - visibleCount} restants)
                </button>
              </div>
            )}

            {produits.length === 0 && (
              <div className="text-center py-16">
                <p className="text-gray-500">Aucun produit dans cette catégorie pour le moment.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ SECTION 5 — PANIER LATÉRAL ═══ */}
      {panierOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setPanierOpen(false)} />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
            {/* Header panier */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Mon panier</h2>
              <button onClick={() => setPanierOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {panierItems.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">Votre panier est vide</p>
              )}

              {panierItems.map(item => {
                const pcb = num(item.pcb) || 1;
                const minC = nbCartonsMin(item);
                const placeholder = categoryPlaceholder(item.categorie);
                const hasPhoto = item.photo_url && (item.photo_statut === 'validee' || item.photo_statut === 'upload_manuel' || item.photo_statut === 'auto_trouvee');
                const nomNorm = normalizeName(item.nom);
                const marqueNorm = normalizeName(item.marque);

                return (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      {/* Mini photo/emoji */}
                      <div className={`w-10 h-10 ${hasPhoto ? 'bg-white' : placeholder.bg} rounded flex items-center justify-center flex-shrink-0`}>
                        {hasPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.photo_url!} alt={nomNorm} className="w-full h-full object-contain rounded" />
                        ) : (
                          <span className="text-lg">{placeholder.emoji}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{nomNorm}</p>
                        <p className="text-xs text-gray-500">{marqueNorm}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateCartons(item.id, item.nbCartons - 1, minC)}
                          className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center text-xs text-gray-600 hover:bg-gray-100"
                        >
                          &minus;
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
                      <span className="text-sm font-bold text-gray-900">{formatEur(item.total)} HT</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {item.nbCartons} carton{item.nbCartons > 1 ? 's' : ''} ({item.nbUnites} unités) — {formatEur(num(item.prix_wag_ht))}/unité
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Résumé + barre de progression + formulaire */}
            <div className="border-t border-gray-200 p-4 space-y-3">
              <div className="flex justify-between text-sm font-semibold text-gray-900">
                <span>Sous-total HT</span>
                <span>{formatEur(totalHT)}</span>
              </div>

              {/* Barre de progression */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Minimum {formatEur(SEUIL_COMMANDE)} HT</span>
                  <span className={seuilAtteint ? 'text-green-600 font-medium' : 'text-red-500'}>
                    {seuilAtteint ? 'Commande minimum atteinte !' : `Il manque ${formatEur(SEUIL_COMMANDE - totalHT)}`}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${seuilAtteint ? 'bg-green-500' : 'bg-red-400'}`}
                    style={{ width: `${Math.min(100, (totalHT / SEUIL_COMMANDE) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Formulaire commande — visible seulement si >= 500€ */}
              {seuilAtteint && !commandeEnvoyee && (
                <form onSubmit={handleCommande} className="space-y-3 pt-2">
                  <input
                    type="email"
                    required
                    placeholder="Votre email professionnel"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Votre téléphone"
                    value={telephone}
                    onChange={e => setTelephone(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                  />
                  <button
                    type="submit"
                    className="w-full bg-green-700 hover:bg-green-800 text-white text-sm font-bold py-3 rounded-lg transition-colors"
                  >
                    Envoyer ma commande &rarr;
                  </button>
                  <p className="text-xs text-gray-400 text-center">
                    Nous vous recontactons sous 2h pour confirmer et organiser la livraison.
                  </p>
                </form>
              )}

              {commandeEnvoyee && (
                <div className="text-center py-4">
                  <p className="text-base font-bold text-green-700">Commande envoyée !</p>
                  <p className="text-sm text-gray-500 mt-1">Nous vous recontactons sous 2h.</p>
                </div>
              )}

              {!seuilAtteint && totalCartons > 0 && (
                <p className="text-xs text-gray-400 text-center">
                  Ajoutez {formatEur(SEUIL_COMMANDE - totalHT)} HT pour pouvoir commander.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══ SECTION 6 — RÉASSURANCE FINALE ═══ */}
      <section className="bg-gray-100 border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div>
            <p className="text-2xl mb-2">&#x1F512;</p>
            <p className="font-bold text-gray-900 mb-1">Achat sécurisé</p>
            <p className="text-sm text-gray-600">
              Paiement par virement bancaire.<br />
              Facture pro émise à chaque commande.
            </p>
          </div>
          <div>
            <p className="text-2xl mb-2">&#x1F4E6;</p>
            <p className="font-bold text-gray-900 mb-1">Livraison France entière</p>
            <p className="text-sm text-gray-600">
              Livraison organisée par nos soins.<br />
              Délai 3-5 jours ouvrés après confirmation.
            </p>
          </div>
          <div>
            <p className="text-2xl mb-2">&#x267B;&#xFE0F;</p>
            <p className="font-bold text-gray-900 mb-1">Produits garantis</p>
            <p className="text-sm text-gray-600">
              Tous nos produits sont conformes et vendables.<br />
              DDM vérifiée à réception.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg width="24" height="24" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="18" cy="18" r="18" fill="#16a34a" />
              <path d="M18 8c-2 3-8 6-8 13a8 8 0 0016 0c0-2-1-4-3-6-1 2-3 3-5 3s-3-2-3-4c0-2 1-4 3-6z" fill="#fff" opacity=".9" />
            </svg>
            <span className="font-bold text-gray-900">Willy Anti-gaspi</span>
            <span className="text-sm text-gray-500">— Catalogue BtoB</span>
          </div>
          <p className="text-sm text-gray-600">
            <a href="mailto:contact@willyantigaspi.fr" className="hover:text-green-600 transition-colors">contact@willyantigaspi.fr</a>
          </p>
          <p className="text-xs text-gray-400 mt-2">CGV &bull; Mentions légales &bull; Politique de confidentialité</p>
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
            Panier ({totalCartons}) — {formatEur(totalHT)} HT
          </button>
        </div>
      )}
    </div>
  );
}
