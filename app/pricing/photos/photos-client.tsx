'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { CATEGORY_EMOJI } from '@/app/lib/catalogue-data';

type Filter = 'tout' | 'auto_trouvee' | 'validee' | 'non_trouvee';

interface Produit {
  id: string;
  nom: string;
  marque: string;
  ean: string | null;
  categorie: string;
  photo_url: string | null;
  photo_statut: string | null;
  photo_source: string | null;
  visible_catalogue: boolean;
}

interface Stats {
  validees: number;
  a_verifier: number;
  manquantes: number;
  total: number;
}

const SOURCE_LABELS: Record<string, string> = {
  off: 'Open Food Facts',
  obf: 'Open Beauty Facts',
  opf: 'Open Products Facts',
  upload: 'Upload manuel',
};

const STATUT_LABELS: Record<string, string> = {
  auto_trouvee: 'Auto-trouvee',
  validee: 'Validee',
  upload_manuel: 'Upload manuel',
  non_trouvee: 'Non trouvee',
};

export function PhotosClient() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [stats, setStats] = useState<Stats>({ validees: 0, a_verifier: 0, manquantes: 0, total: 0 });
  const [filter, setFilter] = useState<Filter>('tout');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchProduits = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== 'tout' ? `?statut=${filter}` : '';
      const res = await fetch(`/api/pricing/photos${params}`);
      const data = await res.json();
      setProduits(data.produits ?? []);
      setStats(data.stats ?? { validees: 0, a_verifier: 0, manquantes: 0, total: 0 });
    } catch {
      setProduits([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchProduits(); }, [fetchProduits]);

  async function handleAction(action: string, productId: string) {
    setActionLoading(productId);
    try {
      await fetch('/api/pricing/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, product_id: productId }),
      });
      await fetchProduits();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSearchAll() {
    setSearching(true);
    try {
      await fetch('/api/pricing/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search_all' }),
      });
      await fetchProduits();
    } finally {
      setSearching(false);
    }
  }

  async function handleUpload(productId: string, file: File) {
    setActionLoading(productId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('product_id', productId);
      await fetch('/api/pricing/photos/upload', { method: 'POST', body: formData });
      await fetchProduits();
    } finally {
      setActionLoading(null);
    }
  }

  const filters: { key: Filter; label: string; count?: number }[] = [
    { key: 'auto_trouvee', label: 'A verifier', count: stats.a_verifier },
    { key: 'validee', label: 'Validees', count: stats.validees },
    { key: 'non_trouvee', label: 'Sans photo', count: stats.manquantes },
    { key: 'tout', label: 'Tout', count: stats.total },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Gestion des photos produits</h1>
        <button
          onClick={handleSearchAll}
          disabled={searching}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          {searching ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          )}
          {searching ? 'Recherche en cours...' : 'Rechercher toutes les photos'}
        </button>
      </div>

      {/* Stats banner */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <span className="text-green-600 text-lg">&#10003;</span>
          <span className="text-sm text-gray-700"><strong>{stats.validees}</strong> validees</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-amber-500 text-lg">&#x1F504;</span>
          <span className="text-sm text-gray-700"><strong>{stats.a_verifier}</strong> a verifier</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-500 text-lg">&#10007;</span>
          <span className="text-sm text-gray-700"><strong>{stats.manquantes}</strong> manquantes</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-sm font-medium px-3 py-1.5 rounded-full border transition-colors ${
              filter === f.key
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400 hover:text-indigo-700'
            }`}
          >
            {f.label}{f.count !== undefined ? ` (${f.count})` : ''}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 mt-2">Chargement...</p>
        </div>
      )}

      {/* Product grid */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {produits.map(p => {
            const isLoading = actionLoading === p.id;
            const emoji = CATEGORY_EMOJI[p.categorie] || '\u{1F4E6}';
            const statut = p.photo_statut || 'non_trouvee';

            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                {/* Photo area */}
                <div className="bg-gray-100 h-40 flex items-center justify-center relative">
                  {p.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.photo_url}
                      alt={p.nom}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-5xl">{emoji}</span>
                  )}
                  {/* Status badge */}
                  <span className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    statut === 'validee' || statut === 'upload_manuel'
                      ? 'bg-green-100 text-green-700'
                      : statut === 'auto_trouvee'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                  }`}>
                    {STATUT_LABELS[statut] || statut}
                  </span>
                </div>

                {/* Info */}
                <div className="p-3 flex-1 flex flex-col">
                  <h3 className="text-sm font-semibold text-gray-900 leading-snug mb-1">{p.nom}</h3>
                  <p className="text-xs text-gray-500 mb-1">{p.marque} {p.ean ? `\u00B7 ${p.ean}` : ''}</p>
                  {p.photo_source && (
                    <p className="text-xs text-indigo-600 mb-2">
                      Source : {SOURCE_LABELS[p.photo_source] || p.photo_source}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    {isLoading ? (
                      <div className="w-full flex justify-center py-2">
                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <>
                        {statut === 'auto_trouvee' && (
                          <>
                            <button
                              onClick={() => handleAction('validate', p.id)}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
                            >
                              Valider
                            </button>
                            <button
                              onClick={() => handleAction('reject', p.id)}
                              className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold py-2 rounded-lg border border-red-200 transition-colors"
                            >
                              Rejeter
                            </button>
                          </>
                        )}
                        {statut === 'non_trouvee' && p.ean && (
                          <button
                            onClick={() => handleAction('search', p.id)}
                            className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold py-2 rounded-lg border border-indigo-200 transition-colors"
                          >
                            Rechercher
                          </button>
                        )}
                        {(statut === 'validee' || statut === 'upload_manuel') && (
                          <span className="text-xs text-green-600 font-medium py-2">Photo validee</span>
                        )}
                        {/* Upload button - always available */}
                        <button
                          onClick={() => fileInputRefs.current[p.id]?.click()}
                          className="bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold py-2 px-3 rounded-lg border border-gray-200 transition-colors"
                        >
                          Uploader
                        </button>
                        <input
                          ref={el => { fileInputRefs.current[p.id] = el; }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload(p.id, file);
                            e.target.value = '';
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && produits.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500">Aucun produit dans cette categorie.</p>
        </div>
      )}
    </div>
  );
}
