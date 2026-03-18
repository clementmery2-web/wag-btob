'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CATEGORIES } from './lib/catalogue-data';
import type { CatalogueProduit } from './lib/catalogue-data';

const SEUIL_COMMANDE = 500;

export default function CataloguePage() {
  const [categorie, setCategorie] = useState<string>('Tout');
  const [produits, setProduits] = useState<CatalogueProduit[]>([]);
  const [allProduits, setAllProduits] = useState<CatalogueProduit[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>('');
  const [panier, setPanier] = useState<Record<string, number>>({});
  const [panierOpen, setPanierOpen] = useState(false);
  const [commandeOpen, setCommandeOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [commandeEnvoyee, setCommandeEnvoyee] = useState(false);

  const fetchProduits = useCallback(async (cat: string) => {
    setLoading(true);
    try {
      const params = cat && cat !== 'Tout' ? `?categorie=${encodeURIComponent(cat)}` : '';
      const res = await fetch(`/api/catalogue${params}`);
      const data = await res.json();
      setProduits(data.produits ?? []);
      setSource(data.source ?? '');
      // Store full list on first load for panier lookups
      if (cat === 'Tout') setAllProduits(data.produits ?? []);
    } catch {
      setProduits([]);
      setSource('erreur');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProduits(categorie);
  }, [categorie, fetchProduits]);

  const panierItems = useMemo(() => {
    const lookup = allProduits.length > 0 ? allProduits : produits;
    return Object.entries(panier)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const p = lookup.find(x => x.id === id);
        if (!p) return null;
        return { ...p, qty, total: p.prix_wag_ht * qty };
      })
      .filter(Boolean) as (CatalogueProduit & { qty: number; total: number })[];
  }, [panier, allProduits, produits]);

  const totalHT = panierItems.reduce((s, i) => s + i.total, 0);
  const nbArticles = panierItems.reduce((s, i) => s + i.qty, 0);
  const seuilAtteint = totalHT >= SEUIL_COMMANDE;

  function addToPanier(id: string, min: number) {
    setPanier(prev => ({
      ...prev,
      [id]: (prev[id] ?? 0) + Math.max(1, min),
    }));
  }

  function updateQty(id: string, qty: number) {
    if (qty <= 0) {
      setPanier(prev => { const n = { ...prev }; delete n[id]; return n; });
    } else {
      setPanier(prev => ({ ...prev, [id]: qty }));
    }
  }

  function handleCommande(e: React.FormEvent) {
    e.preventDefault();
    setCommandeEnvoyee(true);
  }

  function joursRestants(ddm: string): number {
    return Math.max(0, Math.floor((new Date(ddm).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  function formatEur(n: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
  }

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
              {nbArticles > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {nbArticles}
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

        {/* Filtres catégories */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategorie(cat)}
              className={`text-sm font-medium px-3 py-1.5 rounded-full border transition-colors ${
                categorie === cat
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Source indicator (dev) */}
        {source && (
          <p className="text-xs text-gray-400 mb-2">
            Source : {source === 'supabase' ? '🟢 Supabase' : source === 'demo' ? '🟡 Données de démo' : '🔴 Erreur'}
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
            const inPanier = panier[p.id] ?? 0;
            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                {/* Photo */}
                <div className="bg-gray-100 h-36 flex items-center justify-center relative">
                  <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91M18 13.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {/* Badge remise */}
                  <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    -{p.remise_pct}%
                  </span>
                  {/* Badge DDM */}
                  <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    jours < 30 ? 'bg-red-100 text-red-700' : jours < 90 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                  }`}>
                    DDM {jours}j
                  </span>
                </div>

                {/* Info */}
                <div className="p-4 flex-1 flex flex-col">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{p.marque}</p>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2 leading-snug">{p.nom}</h3>
                  <p className="text-xs text-gray-500 mb-3">{p.contenance}</p>

                  {/* Prix */}
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xl font-bold text-green-600">{formatEur(p.prix_wag_ht)}</span>
                    <span className="text-sm text-gray-400 line-through">{formatEur(p.prix_gd_ht)}</span>
                    <span className="text-xs text-gray-500">HT</span>
                  </div>

                  {/* Métriques */}
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                    <span className="text-green-600 font-medium">Marge retail ~{p.marge_retail_estimee}%</span>
                    <span>
                      {p.pmc_type === 'gd' ? 'vs GD' : p.pmc_type === 'pharma_bio' ? 'vs Pharma/Bio' : 'vs prix public'}
                    </span>
                  </div>

                  {/* Min commande */}
                  <p className="text-xs text-gray-400 mb-3">
                    Min. {p.min_commande} {p.min_commande_unite}{p.min_commande > 1 ? 's' : ''} &bull; {p.stock_disponible} dispo
                  </p>

                  {/* Bouton */}
                  <div className="mt-auto">
                    {inPanier > 0 ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQty(p.id, inPanier - 1)}
                          className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 text-sm font-bold"
                        >
                          -
                        </button>
                        <span className="text-sm font-semibold text-gray-900 flex-1 text-center">{inPanier}</span>
                        <button
                          onClick={() => updateQty(p.id, inPanier + 1)}
                          className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 text-sm font-bold"
                        >
                          +
                        </button>
                        <span className="text-xs text-gray-500">{formatEur(p.prix_wag_ht * inPanier)}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToPanier(p.id, p.min_commande)}
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
              <h2 className="text-lg font-bold text-gray-900">Panier ({nbArticles} article{nbArticles > 1 ? 's' : ''})</h2>
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
              {panierItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.nom}</p>
                    <p className="text-xs text-gray-500">{item.marque} — {formatEur(item.prix_wag_ht)} HT/u</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateQty(item.id, item.qty - 1)} className="w-6 h-6 rounded border border-gray-300 flex items-center justify-center text-xs text-gray-600 hover:bg-gray-100">-</button>
                    <span className="text-sm font-semibold w-6 text-center">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, item.qty + 1)} className="w-6 h-6 rounded border border-gray-300 flex items-center justify-center text-xs text-gray-600 hover:bg-gray-100">+</button>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 w-16 text-right">{formatEur(item.total)}</span>
                </div>
              ))}
            </div>

            {/* Total + seuil */}
            <div className="border-t border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-gray-900">Total HT</span>
                <span className="text-xl font-bold text-gray-900">{formatEur(totalHT)}</span>
              </div>

              {/* Barre de seuil */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Seuil minimum {formatEur(SEUIL_COMMANDE)} HT</span>
                  <span className={seuilAtteint ? 'text-green-600 font-medium' : 'text-gray-400'}>
                    {seuilAtteint ? '✓ Atteint' : `${formatEur(SEUIL_COMMANDE - totalHT)} restant`}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${seuilAtteint ? 'bg-green-500' : 'bg-amber-400'}`}
                    style={{ width: `${Math.min(100, (totalHT / SEUIL_COMMANDE) * 100)}%` }}
                  />
                </div>
              </div>

              {!commandeOpen ? (
                <button
                  onClick={() => setCommandeOpen(true)}
                  disabled={!seuilAtteint}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-bold py-3 rounded-lg transition-colors"
                >
                  {seuilAtteint ? 'Commander →' : `Minimum ${formatEur(SEUIL_COMMANDE)} HT requis`}
                </button>
              ) : commandeEnvoyee ? (
                <div className="text-center py-4">
                  <div className="text-3xl mb-2">🎉</div>
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
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-3 rounded-lg transition-colors"
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
      {nbArticles > 0 && !panierOpen && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-40">
          <button
            onClick={() => setPanierOpen(true)}
            className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            Voir le panier — {formatEur(totalHT)} HT ({nbArticles})
          </button>
        </div>
      )}
    </div>
  );
}
