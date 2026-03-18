'use client';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { CatalogueProduit } from './lib/catalogue-data';

const SEUIL_COMMANDE = 500;
const PALIER_PRIORITAIRE = 1500;
const PALIER_REMISE = 2500;
const REMISE_FIDELITE = 0.03;
const PRODUCTS_PER_PAGE = 12;

// ─── 7 filtres métier ──────────────────────────────────────
const FILTRES = [
  { id: 'tout', label: 'Tout', emoji: '📦' },
  { id: 'meilleures_marges', label: 'Meilleures marges', emoji: '💰' },
  { id: 'grandes_marques', label: 'Grandes marques', emoji: '🏷️' },
  { id: 'epicerie', label: 'Épicerie', emoji: '🛒' },
  { id: 'hygiene_entretien', label: 'Hygiène & Entretien', emoji: '🧴' },
  { id: 'petits_prix', label: 'Petits prix', emoji: '🔖' },
  { id: 'stock_urgent', label: 'Stock urgent', emoji: '⚡' },
] as const;

type FiltreId = (typeof FILTRES)[number]['id'];

const GRANDES_MARQUES = [
  'petit navire', 'calvé', 'calve', 'colgate', 'lipton',
  'elephant', 'maille', 'rio mare', 'oral-b', 'oral b',
  'fa', 'mir', 'wc net', 'génie', 'genie', 'carolin',
  'chanteclair', 'nair', 'kleenex', 'signal', 'bonduelle',
  'gerblé', 'gerble', 'tropicana', 'bledina', 'blédina', 'brasses',
  'pampers', 'le chat', 'le petit marseillais', 'natessance', 'parmentier',
];

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
  const letters = name.replace(/[^a-zA-Z]/g, '');
  const upperCount = (name.match(/[A-Z]/g) || []).length;
  if (letters.length > 0 && upperCount / letters.length > 0.6) {
    return name.toLowerCase().replace(/(^\w|\s\w|[-]\w)/g, c => c.toUpperCase());
  }
  return name;
}

/** Category placeholder: emoji + colors */
function categoryPlaceholder(cat: string): { bg: string; emoji: string } {
  const lc = cat.toLowerCase();
  if (lc.includes('épicerie') || lc.includes('boisson')) return { bg: 'bg-emerald-50', emoji: '🥫' };
  if (lc.includes('hygiène') || lc.includes('beauté')) return { bg: 'bg-sky-50', emoji: '🧴' };
  if (lc.includes('entretien')) return { bg: 'bg-amber-50', emoji: '🧹' };
  if (lc.includes('bébé')) return { bg: 'bg-pink-50', emoji: '🍼' };
  if (lc.includes('animaux')) return { bg: 'bg-orange-50', emoji: '🐾' };
  return { bg: 'bg-gray-50', emoji: '📦' };
}

/** Score composite pour tri par défaut */
function scoreProduit(p: CatalogueProduit): number {
  const marge = num(p.marge_retail_estimee);
  const remise = num(p.remise_pct);
  const stockBonus = num(p.stock_disponible) < 300 ? 30 : 0;
  return (marge * 0.5) + (remise * 0.3) + stockBonus;
}

/** Cartons restants (stock / pcb) */
function cartonsRestants(p: CatalogueProduit): number {
  const pcb = num(p.pcb) || 1;
  return Math.floor(num(p.stock_disponible) / pcb);
}

/** Prix de revente estimé TTC (×1.50 arrondi psychologique) */
function prixReventeEstime(prixWagHt: number, tvaTaux: number): number {
  const tvaMult = 1 + tvaTaux / 100;
  const raw = prixWagHt * 1.50 * tvaMult;
  return Math.ceil(raw * 10) / 10 - 0.01;
}

/** Marge estimée correcte */
function margeEstimee(prixWagHt: number, tvaTaux: number): number {
  const tvaMult = 1 + tvaTaux / 100;
  const revente = prixReventeEstime(prixWagHt, tvaTaux);
  const coutTTC = prixWagHt * tvaMult;
  if (revente <= 0) return 0;
  return Math.round(((revente - coutTTC) / revente) * 100);
}

/** Truncate brand for placeholder (max 12 chars) */
function truncBrand(marque: string): string {
  const norm = normalizeName(marque);
  return norm.length > 12 ? norm.slice(0, 12) + '…' : norm;
}

// Extend CatalogueProduit to optionally have created_at from API
interface ProduitAvecDate extends CatalogueProduit {
  created_at?: string;
}

function isGrandeMarque(p: ProduitAvecDate): boolean {
  return GRANDES_MARQUES.some(m => p.marque.toLowerCase().includes(m));
}

function filtrerEtTrier(produits: ProduitAvecDate[], filtre: FiltreId): ProduitAvecDate[] {
  let result = [...produits];

  if (filtre === 'meilleures_marges') {
    result.sort((a, b) => num(b.remise_pct) - num(a.remise_pct));
    return result;
  }

  if (filtre === 'grandes_marques') {
    result = result.filter(isGrandeMarque);
    result.sort((a, b) => scoreProduit(b) - scoreProduit(a));
    return result;
  }

  if (filtre === 'epicerie') {
    const cats = ['Épicerie salée', 'Épicerie sucrée', 'Boissons'];
    result = result.filter(p => cats.includes(p.categorie));
  }

  if (filtre === 'hygiene_entretien') {
    const cats = ['Hygiène & Beauté', 'Entretien'];
    result = result.filter(p => cats.includes(p.categorie));
  }

  if (filtre === 'petits_prix') {
    result = result.filter(p => num(p.prix_wag_ht) < 2.00);
    result.sort((a, b) => num(a.prix_wag_ht) - num(b.prix_wag_ht));
    return result;
  }

  if (filtre === 'stock_urgent') {
    result = result.filter(p => num(p.stock_disponible) < 300);
    result.sort((a, b) => num(a.stock_disponible) - num(b.stock_disponible));
    return result;
  }

  // Tri par défaut : score composite
  result.sort((a, b) => scoreProduit(b) - scoreProduit(a));
  return result;
}

/** Count products per filter to hide empty ones */
function countForFilter(produits: ProduitAvecDate[], filtreId: FiltreId): number {
  if (filtreId === 'tout') return produits.length;
  return filtrerEtTrier(produits, filtreId).length;
}

// ─── Main page ──────────────────────────────────────────────────

export default function CataloguePage() {
  const [filtre, setFiltre] = useState<FiltreId>('tout');
  const [allProduits, setAllProduits] = useState<ProduitAvecDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PER_PAGE);
  const [panier, setPanier] = useState<Record<string, number>>({});
  const [panierOpen, setPanierOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [note, setNote] = useState('');
  const [commandeEnvoyee, setCommandeEnvoyee] = useState(false);

  const grilleRef = useRef<HTMLDivElement>(null);

  const fetchProduits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/catalogue');
      const data = await res.json();
      setAllProduits(data.produits ?? []);
    } catch {
      setAllProduits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProduits(); }, [fetchProduits]);
  useEffect(() => { setVisibleCount(PRODUCTS_PER_PAGE); }, [filtre]);

  const produits = useMemo(() => filtrerEtTrier(allProduits, filtre), [allProduits, filtre]);
  const visibleProduits = useMemo(() => produits.slice(0, visibleCount), [produits, visibleCount]);
  const hasMore = visibleCount < produits.length;

  // Visible filters (hide empty)
  const visibleFiltres = useMemo(() => {
    return FILTRES.filter(f => countForFilter(allProduits, f.id) > 0);
  }, [allProduits]);

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

  const totalArticles = panierItems.length;
  const totalHT = panierItems.reduce((s, i) => s + i.total, 0);
  const remiseAppliquee = totalHT >= PALIER_REMISE;
  const montantRemise = remiseAppliquee ? totalHT * REMISE_FIDELITE : 0;
  const totalFinal = totalHT - montantRemise;
  const seuilAtteint = totalHT >= SEUIL_COMMANDE;
  const prioritaireAtteint = totalHT >= PALIER_PRIORITAIRE;

  // TVA estimée (moyenne pondérée des TVA du panier)
  const tvaEstimee = useMemo(() => {
    if (panierItems.length === 0) return 0;
    return panierItems.reduce((s, item) => {
      const tva = num(item.tva_taux) || 5.5;
      return s + item.total * (tva / 100);
    }, 0);
  }, [panierItems]);
  const tvaFinal = remiseAppliquee ? tvaEstimee * (1 - REMISE_FIDELITE) : tvaEstimee;

  function addToPanier(p: CatalogueProduit) {
    setPanier(prev => ({ ...prev, [p.id]: (prev[p.id] ?? 0) + 1 }));
  }

  function updateCartons(id: string, cartons: number) {
    if (cartons < 1) {
      setPanier(prev => { const n = { ...prev }; delete n[id]; return n; });
    } else {
      setPanier(prev => ({ ...prev, [id]: cartons }));
    }
  }

  function handleCommande(e: React.FormEvent) {
    e.preventDefault();
    setCommandeEnvoyee(true);
  }

  function scrollToGrille() {
    grilleRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  // Progress bar percentage (max at PALIER_REMISE)
  const progressPct = Math.min(100, (totalHT / PALIER_REMISE) * 100);
  const pct500 = (SEUIL_COMMANDE / PALIER_REMISE) * 100;
  const pct1500 = (PALIER_PRIORITAIRE / PALIER_REMISE) * 100;

  // ─── Quantity Selector Component ──────────────────────────────
  function QuantitySelector({ productId, pcb, prixUnit }: { productId: string; pcb: number; prixUnit: number }) {
    const qty = panier[productId] ?? 0;
    const unites = qty * pcb;
    const [inputVal, setInputVal] = useState(String(qty));

    // Sync input when external qty changes
    useEffect(() => { setInputVal(String(qty)); }, [qty]);

    function handleBlur() {
      const parsed = parseInt(inputVal, 10);
      if (!parsed || parsed < 1) {
        updateCartons(productId, 0); // remove
      } else {
        updateCartons(productId, parsed);
      }
    }

    const isUnitMode = pcb === 1;

    return (
      <div>
        <div className="flex items-stretch rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => updateCartons(productId, qty - 1)}
            className="bg-gray-100 hover:bg-gray-200 px-3 py-2 text-gray-700 font-bold text-sm transition-colors"
          >
            &minus;
          </button>
          <div className="flex-1 bg-white border-x border-gray-200 flex items-center justify-center">
            <input
              type="text"
              inputMode="numeric"
              value={inputVal}
              onChange={e => setInputVal(e.target.value.replace(/[^0-9]/g, ''))}
              onBlur={handleBlur}
              onKeyDown={e => { if (e.key === 'Enter') handleBlur(); }}
              className="w-12 text-center border border-gray-300 rounded py-1 font-semibold text-sm focus:border-green-500 focus:outline-none"
            />
          </div>
          <button
            onClick={() => updateCartons(productId, qty + 1)}
            className="bg-green-700 hover:bg-green-800 px-3 py-2 text-white font-bold text-sm transition-colors"
          >
            +
          </button>
        </div>
        <p className="text-center text-xs text-gray-500 mt-1">
          {isUnitMode
            ? `${unites} unité${unites > 1 ? 's' : ''}`
            : `${qty} carton${qty > 1 ? 's' : ''} · ${unites} unités`
          }
          {' — '}{formatEur(prixUnit)} HT/unité
        </p>
      </div>
    );
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
          <button
            onClick={() => setPanierOpen(!panierOpen)}
            className="relative bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            <span className="hidden sm:inline">Panier</span>
            {totalArticles > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {totalArticles}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ═══ HERO ═══ */}
      <section className="bg-green-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center relative z-10">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white mb-4 leading-tight">
            Remplissez vos rayons.<br />
            Doublez votre marge.
          </h1>
          <p className="text-base sm:text-xl text-white/85 max-w-2xl mx-auto mb-8 leading-relaxed">
            103 références de marques nationales à 50-75%
            en dessous du prix grossiste classique.
            <br className="hidden sm:block" />
            Votre marge calculée sur chaque produit.
          </p>

          {/* 3 chiffres clés */}
          <div className="flex items-center justify-center gap-6 sm:gap-12 mb-8">
            <div className="text-center">
              <p className="text-3xl sm:text-5xl font-extrabold text-white">&times;2</p>
              <p className="text-xs sm:text-sm text-white/70 mt-1">marge vs fournisseur classique</p>
            </div>
            <div className="w-px h-12 bg-white/20" />
            <div className="text-center">
              <p className="text-3xl sm:text-5xl font-extrabold text-white">5j</p>
              <p className="text-xs sm:text-sm text-white/70 mt-1">délai de livraison</p>
            </div>
            <div className="w-px h-12 bg-white/20" />
            <div className="text-center">
              <p className="text-3xl sm:text-5xl font-extrabold text-white">103</p>
              <p className="text-xs sm:text-sm text-white/70 mt-1">références disponibles</p>
            </div>
          </div>

          <button
            onClick={scrollToGrille}
            className="bg-white text-green-800 font-bold text-base sm:text-lg px-8 py-3.5 rounded-xl hover:bg-green-50 transition-colors shadow-lg"
          >
            Voir les offres du moment &rarr;
          </button>
        </div>
      </section>

      {/* ═══ FILTRES ═══ */}
      <div ref={grilleRef} className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {visibleFiltres.map(f => {
            const count = countForFilter(allProduits, f.id);
            return (
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
                {f.id !== 'tout' && <span className="text-xs ml-1 opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ GRILLE PRODUITS ═══ */}
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
                const cartonsInPanier = panier[p.id] ?? 0;
                const pcb = num(p.pcb) || 1;
                const prixUnit = num(p.prix_wag_ht);
                const placeholder = categoryPlaceholder(p.categorie);
                const hasPhoto = p.photo_url && (p.photo_statut === 'validee' || p.photo_statut === 'upload_manuel' || p.photo_statut === 'auto_trouvee');
                const cartons = cartonsRestants(p);
                const jours = joursRestants(p.ddm);
                const tvaTaux = num(p.tva_taux) || 5.5;

                const nomNorm = normalizeName(p.nom);
                const revente = prixReventeEstime(prixUnit, tvaTaux);
                const marge = num(p.marge_retail_estimee) > 0
                  ? Math.round(num(p.marge_retail_estimee))
                  : margeEstimee(prixUnit, tvaTaux);

                return (
                  <div key={p.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                    {/* Header card : badge remise + stock urgence */}
                    <div className="flex items-center justify-between px-3 pt-3">
                      <span className="bg-red-600 text-white text-xl font-black px-3 py-1.5 rounded-lg">
                        -{Math.round(num(p.remise_pct))}%
                      </span>
                      {cartons > 0 && cartons < 50 && (
                        <span className="text-xs text-orange-600 font-medium">
                          {cartons} carton{cartons > 1 ? 's' : ''} restant{cartons > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Photo zone */}
                    <div className={`${hasPhoto ? 'bg-white' : placeholder.bg} h-36 flex items-center justify-center`}>
                      {hasPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo_url!} alt={nomNorm} className="w-full h-full object-contain p-2" />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-4xl">{placeholder.emoji}</span>
                          <span className="text-sm font-bold text-gray-600">{truncBrand(p.marque)}</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4 flex-1 flex flex-col">
                      <p className="text-base font-bold text-gray-900 uppercase mb-0.5">{normalizeName(p.marque)}</p>
                      <h3 className="text-sm text-gray-600 mb-1 leading-snug line-clamp-2">{nomNorm}</h3>

                      {/* DDM courte — seulement si < 60 jours */}
                      {jours !== null && jours > 0 && jours < 60 && (
                        <span className="inline-block bg-orange-100 text-orange-700 text-xs font-medium px-2 py-0.5 rounded-full mb-2 w-fit">
                          Prix cassé — DDM courte
                        </span>
                      )}

                      {/* Bloc marge */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 space-y-1">
                        <div className="flex justify-between items-baseline">
                          <span className="text-sm text-gray-600">Vous achetez</span>
                          <span className="font-semibold text-gray-900">{formatEur(prixUnit)} HT</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-sm text-gray-600">Vous revendez</span>
                          <span className="font-semibold text-green-700">~{formatEur(revente)} TTC</span>
                        </div>
                        <div className="flex justify-between items-baseline pt-1 border-t border-green-200">
                          <span className="text-sm font-bold text-green-800">Votre marge</span>
                          <span className="text-lg font-black text-green-700">&asymp;&nbsp;{marge}%</span>
                        </div>
                      </div>

                      {/* Stock urgent badge on card */}
                      {filtre === 'stock_urgent' && cartons > 0 && (
                        <p className="text-xs text-orange-600 font-medium mb-2">
                          {cartons} carton{cartons > 1 ? 's' : ''} restant{cartons > 1 ? 's' : ''}
                        </p>
                      )}

                      {/* CTA / Sélecteur */}
                      <div className="mt-auto">
                        {cartonsInPanier > 0 ? (
                          <QuantitySelector productId={p.id} pcb={pcb} prixUnit={prixUnit} />
                        ) : (
                          <button
                            onClick={() => addToPanier(p)}
                            className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-3 rounded-lg transition-colors"
                          >
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

      {/* ═══ PANIER LATÉRAL ═══ */}
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
                const ph = categoryPlaceholder(item.categorie);
                const hasPhoto = item.photo_url && (item.photo_statut === 'validee' || item.photo_statut === 'upload_manuel' || item.photo_statut === 'auto_trouvee');
                const nomNorm = normalizeName(item.nom);
                const marqueNorm = normalizeName(item.marque);
                const pcb = num(item.pcb) || 1;
                const isUnitMode = pcb === 1;

                return (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 ${hasPhoto ? 'bg-white' : ph.bg} rounded flex items-center justify-center flex-shrink-0`}>
                        {hasPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.photo_url!} alt={nomNorm} className="w-full h-full object-contain rounded" />
                        ) : (
                          <span className="text-lg">{ph.emoji}</span>
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
                          onClick={() => updateCartons(item.id, item.nbCartons - 1)}
                          className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center text-xs text-gray-600 hover:bg-gray-100"
                        >
                          &minus;
                        </button>
                        <span className="text-sm font-semibold px-2 min-w-[60px] text-center">
                          {isUnitMode
                            ? `${item.nbUnites} unité${item.nbUnites > 1 ? 's' : ''}`
                            : `${item.nbCartons} crt${item.nbCartons > 1 ? 's' : ''}`
                          }
                        </span>
                        <button
                          onClick={() => updateCartons(item.id, item.nbCartons + 1)}
                          className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center text-xs text-gray-600 hover:bg-gray-100"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-bold text-gray-900">{formatEur(item.total)} HT</span>
                    </div>
                    {!isUnitMode && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        {item.nbCartons} carton{item.nbCartons > 1 ? 's' : ''} ({item.nbUnites} unités) — {formatEur(num(item.prix_wag_ht))}/unité
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Résumé + 3 paliers + formulaire */}
            <div className="border-t border-gray-200 p-4 space-y-3">
              {/* Récap commande */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Sous-total HT</span>
                  <span className="font-semibold">{formatEur(totalHT)}</span>
                </div>
                {remiseAppliquee && (
                  <div className="flex justify-between text-sm text-green-700">
                    <span className="font-medium">Remise fidélité -3%</span>
                    <span className="font-semibold">-{formatEur(montantRemise)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-200 pt-1">
                  <span>Total HT</span>
                  <span>{formatEur(totalFinal)}</span>
                </div>
                {totalHT > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>TVA estimée</span>
                      <span>{formatEur(tvaFinal)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 font-medium">
                      <span>Total TTC estimé</span>
                      <span>{formatEur(totalFinal + tvaFinal)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Barre de progression 3 paliers */}
              {totalHT > 0 && (
                <div className="space-y-2">
                  <div className="relative w-full h-3 bg-gray-200 rounded-full">
                    <div
                      className="h-full rounded-full transition-all duration-300 bg-green-600"
                      style={{ width: `${progressPct}%` }}
                    />
                    {/* Markers — cercles sur la barre */}
                    {[
                      { pct: pct500, reached: seuilAtteint },
                      { pct: pct1500, reached: prioritaireAtteint },
                      { pct: 100, reached: remiseAppliquee },
                    ].map((m, i) => (
                      <div
                        key={i}
                        className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 flex items-center justify-center text-[8px] font-bold ${
                          m.reached
                            ? 'bg-green-600 border-green-700 text-white'
                            : 'bg-white border-gray-300 text-gray-400'
                        }`}
                        style={{ left: `${m.pct}%`, transform: 'translate(-50%, -50%)' }}
                      >
                        {m.reached ? '✓' : ''}
                      </div>
                    ))}
                  </div>

                  {/* Palier labels */}
                  <div className="flex justify-between text-[10px]">
                    <span className={seuilAtteint ? 'text-green-600 font-medium' : 'text-gray-400'}>500 €</span>
                    <span className={prioritaireAtteint ? 'text-green-600 font-medium' : 'text-gray-400'}>1 500 €</span>
                    <span className={remiseAppliquee ? 'text-green-600 font-medium' : 'text-gray-400'}>2 500 €</span>
                  </div>

                  {/* Palier messages */}
                  {!seuilAtteint && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-red-700">
                        Il manque <strong>{formatEur(SEUIL_COMMANDE - totalHT)}</strong> HT pour valider votre commande
                      </p>
                    </div>
                  )}
                  {seuilAtteint && !prioritaireAtteint && (
                    <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 space-y-1">
                      <p className="text-xs text-green-700 font-medium">&#10003; Commande validée !</p>
                      <p className="text-xs text-gray-600">
                        Ajoutez <strong>{formatEur(PALIER_PRIORITAIRE - totalHT)}</strong> HT pour débloquer la livraison prioritaire sous 3 jours
                      </p>
                    </div>
                  )}
                  {prioritaireAtteint && !remiseAppliquee && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 space-y-1">
                      <p className="text-xs text-blue-700 font-medium">&#x1F680; Livraison prioritaire débloquée !</p>
                      <p className="text-xs text-gray-600">
                        Plus que <strong>{formatEur(PALIER_REMISE - totalHT)}</strong> HT pour obtenir -3% sur toute la commande
                      </p>
                    </div>
                  )}
                  {remiseAppliquee && (
                    <div className="bg-green-100 border border-green-300 rounded-lg px-3 py-2 space-y-1 animate-pulse">
                      <p className="text-xs text-green-800 font-bold">
                        &#x1F3AF; Remise -3% appliquée ! Vous économisez {formatEur(montantRemise)} HT sur cette commande
                      </p>
                      <p className="text-xs text-blue-700 font-medium">&#x1F680; Livraison prioritaire sous 3j</p>
                    </div>
                  )}
                </div>
              )}

              {/* Formulaire commande — visible dès 500€ */}
              {seuilAtteint && !commandeEnvoyee && (
                <form onSubmit={handleCommande} className="space-y-3 pt-2">
                  <input
                    type="email"
                    required
                    placeholder="Email professionnel"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Téléphone"
                    value={telephone}
                    onChange={e => setTelephone(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                  />
                  <textarea
                    placeholder="Note optionnelle"
                    rows={2}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none resize-none"
                  />
                  <button
                    type="submit"
                    className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-4 rounded-lg transition-colors text-lg"
                  >
                    Envoyer ma commande &rarr;
                  </button>
                  <p className="text-xs text-gray-400 text-center leading-relaxed">
                    Confirmation sous 2h &bull; Paiement à 30 jours disponible pour les clients récurrents
                  </p>
                </form>
              )}

              {commandeEnvoyee && (
                <div className="text-center py-4">
                  <p className="text-base font-bold text-green-700">Commande envoyée !</p>
                  <p className="text-sm text-gray-500 mt-1">Nous vous recontactons sous 2h.</p>
                </div>
              )}

              {!seuilAtteint && totalArticles > 0 && (
                <p className="text-xs text-gray-400 text-center">
                  Ajoutez {formatEur(SEUIL_COMMANDE - totalHT)} HT pour pouvoir commander.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══ FOOTER — RÉASSURANCE ═══ */}
      <section className="bg-gray-100 border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div>
            <p className="text-2xl mb-2">&#x1F512;</p>
            <p className="font-bold text-gray-900 mb-1">Paiement sécurisé</p>
            <p className="text-sm text-gray-600">
              Virement bancaire. Facture pro à chaque commande.<br />
              Paiement à 30 jours pour clients récurrents.
            </p>
          </div>
          <div>
            <p className="text-2xl mb-2">&#x1F4E6;</p>
            <p className="font-bold text-gray-900 mb-1">Livraison France entière</p>
            <p className="text-sm text-gray-600">
              Sous 5 jours ouvrés. Prioritaire sous 3 jours<br />
              dès 1&nbsp;500&nbsp;€ HT de commande.
            </p>
          </div>
          <div>
            <p className="text-2xl mb-2">&#x2705;</p>
            <p className="font-bold text-gray-900 mb-1">Produits garantis conformes</p>
            <p className="text-sm text-gray-600">
              DDM vérifiée. Produits inspectés avant expédition.<br />
              Avoir immédiat en cas de non-conformité.
            </p>
          </div>
        </div>

        {/* Séparateur + lien fournisseur */}
        <div className="border-t border-gray-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 text-center">
            <p className="text-sm text-gray-500">
              Vous êtes fournisseur et souhaitez écouler vos surplus ?{' '}
              <Link href="/fournisseurs" className="text-green-600 hover:text-green-700 font-medium transition-colors">
                Déposer mon listing &rarr;
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Footer minimal */}
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
      {totalArticles > 0 && !panierOpen && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-40">
          <button
            onClick={() => setPanierOpen(true)}
            className="w-full bg-green-700 hover:bg-green-800 text-white rounded-xl py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            Panier ({totalArticles} article{totalArticles > 1 ? 's' : ''}) — {formatEur(totalHT)} HT
          </button>
        </div>
      )}
    </div>
  );
}
