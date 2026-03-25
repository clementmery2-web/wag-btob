'use client';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import type { CatalogueProduit } from './lib/catalogue-data';

const SEUIL_COMMANDE = 500;
const PRODUCTS_PER_PAGE = 15;

// ─── 7 filtres métier (repensés acheteur déstockage) ─────────
const FILTRES = [
  { id: 'tout', label: 'Tout le catalogue', emoji: '📦', description: '' },
  { id: 'coup_de_coeur', label: 'Coups de cœur', emoji: '🔥', description: 'Nos meilleures affaires du moment' },
  { id: 'grandes_marques', label: 'Grandes marques', emoji: '🏷️', description: 'Marques que vos clients reconnaissent' },
  { id: 'epicerie', label: 'Épicerie', emoji: '🛒', description: '' },
  { id: 'hygiene_entretien', label: 'Hygiène & Entretien', emoji: '🧴', description: '' },
  { id: 'moins_2_euros', label: 'Moins de 2€', emoji: '💶', description: 'Petits prix — rotation rapide' },
  { id: 'stock_urgent', label: 'Fin de stock', emoji: '⚡', description: 'Moins de 20 cartons disponibles' },
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

/** Score composite pour tri par défaut */
function scoreProduit(p: CatalogueProduit): number {
  const marge = num(p.marge_retail_estimee);
  const remise = num(p.remise_pct);
  const maxCart = maxCartons(p);
  const stockBonus = maxCart < 20 ? 20 : 0;
  return (marge * 0.5) + (remise * 0.3) + stockBonus;
}

/** Score coup de coeur : marge + remise + urgence stock */
function scoreCoupDeCoeur(p: CatalogueProduit): number {
  const remise = num(p.remise_pct);
  const marge = margeReelle(p);
  const maxCart = maxCartons(p);
  const stockBonus = maxCart < 20 ? 20 : 0;
  return (remise * 0.4) + (marge * 0.4) + stockBonus;
}

/** Cartons max disponibles (stock / pcb) */
function maxCartons(p: CatalogueProduit): number {
  const pcb = num(p.pcb) || 1;
  return Math.floor(num(p.stock_disponible) / pcb);
}

/** Prix de revente affiché TTC */
function prixReventeAffiche(p: CatalogueProduit): number {
  // Si prix_revente_conseille_ttc disponible en base
  if (p.prix_revente_conseille_ttc && p.prix_revente_conseille_ttc > 0) {
    return p.prix_revente_conseille_ttc;
  }
  // Fallback x1.50
  const tvaMult = 1 + (num(p.tva_taux) || 5.5) / 100;
  const raw = num(p.prix_wag_ht) * 1.50 * tvaMult;
  return Math.ceil(raw * 10) / 10 - 0.01;
}

/** Marge réelle en % */
function margeReelle(p: CatalogueProduit): number {
  // Priority 1: marge_retail_estimee from Supabase (already calculated at import)
  const margeDb = num(p.marge_retail_estimee);
  if (margeDb > 0) return Math.round(margeDb);

  // Priority 2: calculate from prix_revente_conseille_ttc
  const prixWag = num(p.prix_wag_ht);
  const tvaTaux = num(p.tva_taux) || 5.5;
  if (p.prix_revente_conseille_ttc && p.prix_revente_conseille_ttc > 0) {
    const coutAchatTtc = prixWag * (1 + tvaTaux / 100);
    const reventeTtc = p.prix_revente_conseille_ttc;
    if (reventeTtc <= 0) return 0;
    return Math.round((reventeTtc - coutAchatTtc) / reventeTtc * 100);
  }

  // Fallback x1.50 → always 33%
  return 33;
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

  if (filtre === 'coup_de_coeur') {
    result.sort((a, b) => scoreCoupDeCoeur(b) - scoreCoupDeCoeur(a));
    return result.slice(0, 20);
  }

  if (filtre === 'grandes_marques') {
    result = result.filter(isGrandeMarque);
    result.sort((a, b) => scoreProduit(b) - scoreProduit(a));
    return result;
  }

  if (filtre === 'epicerie') {
    result = result.filter(p => {
      const lc = (p.categorie || '').toLowerCase();
      return lc.includes('épicerie') || lc.includes('epicerie') || lc.includes('alimentaire') || lc.includes('boisson');
    });
  }

  if (filtre === 'hygiene_entretien') {
    result = result.filter(p => {
      const lc = (p.categorie || '').toLowerCase();
      return lc.includes('hygiène') || lc.includes('hygiene') || lc.includes('beauté') || lc.includes('beaute') || lc.includes('entretien');
    });
  }

  if (filtre === 'moins_2_euros') {
    result = result.filter(p => num(p.prix_wag_ht) < 2.00);
    result.sort((a, b) => num(a.prix_wag_ht) - num(b.prix_wag_ht));
    return result;
  }

  if (filtre === 'stock_urgent') {
    result = result.filter(p => maxCartons(p) < 20 && maxCartons(p) > 0);
    result.sort((a, b) => maxCartons(a) - maxCartons(b));
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

/** Stock badge info */
function stockBadge(mc: number): { text: string; cls: string } | null {
  if (mc <= 0) return { text: 'Rupture de stock', cls: 'text-gray-400 bg-gray-100' };
  if (mc <= 10) return { text: `${mc} carton${mc > 1 ? 's' : ''} restant${mc > 1 ? 's' : ''}`, cls: 'text-orange-600 bg-orange-50' };
  if (mc <= 50) return { text: `${mc} cartons restants`, cls: 'text-gray-500 bg-gray-50' };
  return { text: `${mc} cartons dispo`, cls: 'text-gray-400 bg-gray-50' };
}

// ─── Main page ──────────────────────────────────────────────────

export default function CataloguePage() {
  const [filtre, setFiltre] = useState<FiltreId>('coup_de_coeur');
  const [allProduits, setAllProduits] = useState<ProduitAvecDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PER_PAGE);
  const [panier, setPanier] = useState<Record<string, number>>({});
  const [panierOpen, setPanierOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [commandeEnvoyee, setCommandeEnvoyee] = useState(false);
  const [commandeNumero, setCommandeNumero] = useState('');
  const [commandeLoading, setCommandeLoading] = useState(false);
  const [commandeError, setCommandeError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const grilleRef = useRef<HTMLDivElement>(null);

  const fetchProduits = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('produits')
        .select('*')
        .eq('statut', 'en_ligne');

      if (error || !data || data.length === 0) {
        // Fallback API si Supabase vide ou erreur
        const res = await fetch('/api/catalogue');
        const json = await res.json();
        setAllProduits(json.produits ?? []);
      } else {
        // Mapper les champs Supabase vers CatalogueProduit
        const mapped = data.map((row): CatalogueProduit & { created_at?: string } => {
          const prixWag = Number(row.prix_wag_ht) || 0;
          const pmc = Number(row.pmc) || 0;
          const remise = pmc > 0 ? Math.round((1 - prixWag / pmc) * 100) : 0;
          return {
            id: row.id,
            nom: row.nom ?? '',
            marque: row.marque ?? '',
            photo_url: null,
            photo_statut: 'non_trouvee',
            photo_source: null,
            ean: row.ean ?? null,
            categorie: row.categorie ?? '',
            contenance: '',
            prix_wag_ht: prixWag,
            prix_gd_ht: pmc,
            remise_pct: remise,
            marge_retail_estimee: remise > 0 ? remise : 0,
            ddm: row.ddm ?? '',
            flux: (row.flux as CatalogueProduit['flux']) || 'dropshipping',
            pcb: row.quantite_minimum ?? 1,
            palletisation: 40,
            min_commande: 1,
            min_commande_unite: 'carton',
            min_cartons: 1,
            min_unites: row.quantite_minimum ?? 1,
            qmc_fournisseur: 1,
            fournisseur_nom: null,
            stock_disponible: row.quantite_disponible ?? 0,
            pmc_type: 'gd',
            tva_taux: Number(row.tva_taux) || 5.5,
            prix_revente_conseille_ttc: null,
            created_at: row.created_at,
          };
        });
        setAllProduits(mapped);
      }
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
  const seuilAtteint = totalHT >= SEUIL_COMMANDE;

  // TVA estimée (par produit, taux mixtes)
  const tvaEstimee = useMemo(() => {
    if (panierItems.length === 0) return 0;
    return panierItems.reduce((s, item) => {
      const tva = num(item.tva_taux) || 5.5;
      return s + item.total * (tva / 100);
    }, 0);
  }, [panierItems]);

  function addToPanier(p: CatalogueProduit) {
    const mc = maxCartons(p);
    if (mc <= 0) return;
    setPanier(prev => {
      const current = prev[p.id] ?? 0;
      if (current >= mc) return prev;
      return { ...prev, [p.id]: current + 1 };
    });
  }

  function updateCartonsInPanier(id: string, cartons: number) {
    const p = allProduits.find(x => x.id === id);
    const mc = p ? maxCartons(p) : 999;
    if (cartons < 1) {
      setPanier(prev => { const n = { ...prev }; delete n[id]; return n; });
    } else {
      const clamped = Math.min(cartons, mc);
      setPanier(prev => ({ ...prev, [id]: clamped }));
    }
  }

  async function handleCommande(e: React.FormEvent) {
    e.preventDefault();
    setCommandeLoading(true);
    setCommandeError('');
    try {
      const payload = {
        email,
        telephone: '',
        note,
        produits: panierItems.map(item => ({
          produit_id: item.id,
          nom: item.nom,
          marque: item.marque,
          nb_cartons: item.nbCartons,
          nb_unites: item.nbUnites,
          prix_wag_ht: num(item.prix_wag_ht),
          tva_taux: num(item.tva_taux) || 5.5,
          total_ligne_ht: item.total,
        })),
        total_ht: totalHT,
        remise_pct: 0,
        total_apres_remise_ht: totalHT,
      };
      const res = await fetch('/api/commande', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCommandeError(data.error || 'Erreur lors de l\'envoi');
        return;
      }
      setCommandeNumero(data.numero);
      setCommandeEnvoyee(true);
      setPanierOpen(false);
      setShowConfirmation(true);
    } catch {
      setCommandeError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setCommandeLoading(false);
    }
  }

  function handleCloseConfirmation() {
    setShowConfirmation(false);
    setCommandeEnvoyee(false);
    setPanier({});
    setEmail('');
    setNote('');
  }

  function scrollToGrille() {
    grilleRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  // Progress bar percentage
  const progressPct = Math.min(100, (totalHT / SEUIL_COMMANDE) * 100);

  // ─── Quantity Selector Component (with max stock) ──────────────────
  function QuantitySelector({ productId, pcb, prixUnit }: { productId: string; pcb: number; prixUnit: number }) {
    const qty = panier[productId] ?? 0;
    const totalLigne = qty * pcb * prixUnit;
    const nbUvc = qty * pcb;
    const p = allProduits.find(x => x.id === productId);
    const mc = p ? maxCartons(p) : 999;

    return (
      <div>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => updateCartonsInPanier(productId, qty - 1)}
            className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors"
          >
            &minus;
          </button>
          <input
            type="number"
            min={1}
            max={mc}
            value={qty}
            onChange={e => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 1) updateCartonsInPanier(productId, val);
            }}
            onBlur={e => {
              const val = parseInt(e.target.value, 10);
              if (isNaN(val) || val < 1) updateCartonsInPanier(productId, 1);
            }}
            onFocus={e => e.target.select()}
            className="w-20 text-center font-bold text-lg border border-gray-300 rounded-lg py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
          />
          <button
            onClick={() => updateCartonsInPanier(productId, qty + 1)}
            disabled={qty >= mc}
            className="bg-green-600 text-white rounded-lg px-3 py-2 font-bold text-sm hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            +
          </button>
          <span className="text-sm text-gray-600 font-medium">carton{qty > 1 ? 's' : ''}</span>
        </div>
        {pcb > 1 && (
          <p className="text-xs text-gray-400 text-center mt-1">({nbUvc} UVC)</p>
        )}
        <div className="text-center text-green-700 font-bold text-xl mt-1">
          {formatEur(totalLigne)} HT
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ═══ HEADER — sticky ═══ */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-default">
            <svg width="32" height="32" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="18" cy="18" r="18" fill="#16a34a" />
              <path d="M18 8c-2 3-8 6-8 13a8 8 0 0016 0c0-2-1-4-3-6-1 2-3 3-5 3s-3-2-3-4c0-2 1-4 3-6z" fill="#fff" opacity=".9" />
            </svg>
            <div>
              <span className="text-lg font-bold text-gray-900">Willy <span className="text-green-600">Anti-gaspi</span></span>
              <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5 rounded-full ml-2 cursor-default">Catalogue BtoB</span>
            </div>
          </div>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse p-4 space-y-3">
                <div className="h-3 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-16 bg-gray-200 rounded" />
                <div className="h-10 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Product grid — 5 cols desktop, no photos */}
        {!loading && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {visibleProduits.map(p => {
                const cartonsInPanier = panier[p.id] ?? 0;
                const pcb = num(p.pcb) || 1;
                const prixUnit = num(p.prix_wag_ht);
                const mc = maxCartons(p);
                const jours = joursRestants(p.ddm);
                const badge = stockBadge(mc);

                const nomNorm = normalizeName(p.nom);
                const revente = prixReventeAffiche(p);
                const marge = margeReelle(p);

                return (
                  <div key={p.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                    {/* Header: remise + stock */}
                    <div className="flex items-start justify-between px-3 pt-3">
                      <span className="bg-red-600 text-white text-lg font-black px-2.5 py-1 rounded-lg leading-none">
                        -{Math.round(num(p.remise_pct))}%
                      </span>
                      {badge && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.cls}`}>
                          {badge.text}
                        </span>
                      )}
                    </div>

                    {/* Info — no photo */}
                    <div className="px-3 pb-3 pt-2 flex-1 flex flex-col">
                      <p className="text-sm font-bold text-gray-900 uppercase leading-tight">{normalizeName(p.marque)}</p>
                      <h3 className="text-xs text-gray-600 mb-0.5 leading-snug line-clamp-2">{nomNorm}</h3>
                      {p.ean && (
                        <p className="text-[10px] text-gray-400 mt-0.5">EAN : {p.ean}</p>
                      )}

                      {/* DDM courte */}
                      {jours !== null && jours > 0 && jours < 60 && (
                        <span className="inline-block bg-orange-100 text-orange-700 text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 w-fit">
                          DDM courte
                        </span>
                      )}

                      {/* Bloc marge */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 mt-2 mb-2 space-y-0.5">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-gray-600">Vous achetez</span>
                          <span className="text-sm font-semibold text-gray-900">{formatEur(prixUnit)} HT</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-gray-600">Vous revendez</span>
                          <span className="text-sm font-semibold text-green-700">~{formatEur(revente)} TTC</span>
                        </div>
                        <div className="flex justify-between items-baseline pt-0.5 border-t border-green-200">
                          <span className="text-xs font-bold text-green-800">Votre marge</span>
                          <span className="text-base font-black text-green-700">&asymp;&nbsp;{marge}%</span>
                        </div>
                      </div>

                      {/* Carton info */}
                      <p className="text-[11px] text-gray-500 text-center mb-2">
                        {pcb >= 2
                          ? `📦 Carton de ${pcb} UVC — ${formatEur(prixUnit * pcb)} HT`
                          : `📦 Vendu à la pièce — ${formatEur(prixUnit)} HT`
                        }
                      </p>

                      {/* CTA / Sélecteur */}
                      <div className="mt-auto">
                        {mc <= 0 ? (
                          <div className="w-full text-center text-gray-400 font-medium py-2.5 rounded-lg bg-gray-100 text-sm">
                            Rupture de stock
                          </div>
                        ) : cartonsInPanier > 0 ? (
                          <QuantitySelector productId={p.id} pcb={pcb} prixUnit={prixUnit} />
                        ) : (
                          <button
                            onClick={() => addToPanier(p)}
                            className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
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
                <p className="text-gray-500">
                  {allProduits.length === 0
                    ? 'Catalogue en cours de mise à jour'
                    : 'Aucun produit dans cette catégorie pour le moment.'}
                </p>
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
                const nomNorm = normalizeName(item.nom);
                const marqueNorm = normalizeName(item.marque);
                const pcb = num(item.pcb) || 1;
                const mc = maxCartons(item);

                return (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 line-clamp-2">{nomNorm}</p>
                        <p className="text-xs text-gray-500">{marqueNorm}</p>
                      </div>
                      <button
                        onClick={() => updateCartonsInPanier(item.id, 0)}
                        className="text-gray-400 hover:text-red-500 text-sm flex-shrink-0 p-1 transition-colors"
                        title="Supprimer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateCartonsInPanier(item.id, item.nbCartons - 1)}
                          className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center text-xs text-gray-600 hover:bg-gray-100"
                        >
                          &minus;
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={mc}
                          value={item.nbCartons}
                          onChange={e => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val >= 1) updateCartonsInPanier(item.id, val);
                          }}
                          onBlur={e => {
                            const val = parseInt(e.target.value, 10);
                            if (isNaN(val) || val < 1) updateCartonsInPanier(item.id, 1);
                          }}
                          onFocus={e => e.target.select()}
                          className="w-14 text-center font-bold text-sm border border-gray-300 rounded py-1 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                        />
                        <button
                          onClick={() => updateCartonsInPanier(item.id, item.nbCartons + 1)}
                          disabled={item.nbCartons >= mc}
                          className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                        <span className="text-xs text-gray-500 ml-1">carton{item.nbCartons > 1 ? 's' : ''}</span>
                      </div>
                      <span className="text-sm font-bold text-green-700">{formatEur(item.total)} HT</span>
                    </div>
                    {pcb > 1 && (
                      <p className="text-xs text-gray-400 mt-1">({item.nbUnites} UVC)</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Récap fixe en bas — totaux + barre + formulaire (pas de liste récap) */}
            <div className="border-t bg-white p-4 space-y-3 shrink-0">
              {/* Totaux */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Sous-total HT</span>
                  <span className="font-semibold">{formatEur(totalHT)}</span>
                </div>
                {totalHT > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>TVA estimée</span>
                      <span>{formatEur(tvaEstimee)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-200 pt-1">
                      <span>Total TTC</span>
                      <span>{formatEur(totalHT + tvaEstimee)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Barre de progression 0→500€ */}
              {totalHT > 0 && (
                <div className="space-y-1">
                  <div className="w-full h-2.5 bg-gray-200 rounded-full">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${seuilAtteint ? 'bg-green-600' : 'bg-red-500'}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  {!seuilAtteint ? (
                    <p className="text-xs text-red-600 font-medium">
                      Il manque <strong>{formatEur(SEUIL_COMMANDE - totalHT)}</strong> HT pour valider la commande
                    </p>
                  ) : (
                    <p className="text-xs text-green-700 font-medium">&#x2705; Commande minimum atteinte !</p>
                  )}
                </div>
              )}

              {/* Formulaire commande — visible dès 500€ */}
              {seuilAtteint && !commandeEnvoyee && (
                <form onSubmit={handleCommande} className="space-y-3">
                  <input
                    type="email"
                    required
                    placeholder="Email professionnel"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                  />
                  <textarea
                    placeholder="Précisions sur votre commande (optionnel)"
                    rows={2}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none resize-none"
                  />
                  {commandeError && (
                    <p className="text-xs text-red-600 text-center">{commandeError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={commandeLoading}
                    className="w-full bg-green-700 hover:bg-green-800 disabled:bg-green-400 text-white font-bold py-4 rounded-lg transition-colors text-lg flex items-center justify-center gap-2"
                  >
                    {commandeLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Envoi en cours...
                      </>
                    ) : (
                      <>Envoyer ma commande &rarr;</>
                    )}
                  </button>
                  <p className="text-xs text-gray-500 text-center leading-relaxed">
                    Notre équipe vous appelle sous 2h pour confirmer votre commande
                  </p>
                </form>
              )}

              {/* Bouton grisé si < 500€ */}
              {!seuilAtteint && totalArticles > 0 && !commandeEnvoyee && (
                <button
                  disabled
                  className="w-full bg-gray-300 text-gray-500 font-bold py-4 rounded-lg text-lg cursor-not-allowed"
                >
                  Envoyer ma commande &rarr;
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══ MODAL CONFIRMATION POST-COMMANDE ═══ */}
      {showConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8">
            {/* Checkmark */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 text-center mb-1">Commande confirmée !</h2>
            <p className="text-sm text-gray-500 text-center mb-6">#{commandeNumero}</p>

            {/* Récap commande */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-1.5">
              {panierItems.length > 0 ? panierItems.map(item => {
                const pcb = num(item.pcb) || 1;
                return (
                  <div key={item.id} className="flex justify-between text-sm text-gray-700">
                    <span className="truncate flex-1 mr-2">
                      {normalizeName(item.nom)} &times; {item.nbCartons} carton{item.nbCartons > 1 ? 's' : ''}
                      {pcb > 1 && <span className="text-gray-400"> ({item.nbUnites} UVC)</span>}
                    </span>
                    <span className="font-medium whitespace-nowrap">{formatEur(item.total)}</span>
                  </div>
                );
              }) : (
                <p className="text-sm text-gray-500">Détail envoyé par email</p>
              )}
              <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
                <span>Total HT</span>
                <span>{formatEur(totalHT)}</span>
              </div>
            </div>

            {/* Étapes */}
            <div className="border-t border-gray-200 pt-5 mb-5">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>&#x1F552;</span> Et maintenant ?
              </h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-green-700">1</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Dans les 2 heures</p>
                    <p className="text-xs text-gray-500">Notre équipe vous contacte par téléphone ou email pour confirmer votre commande et les modalités de livraison.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-green-700">2</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Sous 24h</p>
                    <p className="text-xs text-gray-500">Vous recevez la confirmation écrite avec le bon de commande et la date de livraison prévue.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-green-700">3</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Livraison sous 5 jours</p>
                    <p className="text-xs text-gray-500">Votre commande est livrée en France entière. Facture pro jointe.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Email confirmation */}
            <div className="border-t border-gray-200 pt-4 mb-6">
              <p className="text-sm text-gray-600 text-center">
                &#x1F4E7; Un email de confirmation a été envoyé à <strong>{email}</strong>
              </p>
              <p className="text-sm text-gray-500 text-center mt-2">
                Une question ? &#x1F4DE; <a href="mailto:contact@willyantigaspi.fr" className="text-green-600 hover:text-green-700 font-medium">contact@willyantigaspi.fr</a>
              </p>
            </div>

            {/* CTA */}
            <button
              onClick={handleCloseConfirmation}
              className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3.5 rounded-lg transition-colors text-base"
            >
              Voir d&apos;autres produits &rarr;
            </button>
          </div>
        </div>
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
      {totalArticles > 0 && !panierOpen && !showConfirmation && (
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
