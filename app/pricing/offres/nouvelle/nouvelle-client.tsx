'use client';
import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatEur } from '../../lib/types';

interface ProduitParse {
  ref: string;
  nom: string;
  marque: string;
  ean: string;
  prix_achat_ht: number;
  pcb: number;
  stock: number;
  ddm: string | null;
  tva: number;
  poids: number | null;
}

type Etape = 'upload' | 'analyse' | 'preview' | 'import';

export function NouvelleOffreClient() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // Form state
  const [flux, setFlux] = useState<string>('dropshipping');
  const [fichier, setFichier] = useState<File | null>(null);

  // Auto-detected from file by Claude
  const [fournisseur, setFournisseur] = useState('');
  const [emailFournisseur, setEmailFournisseur] = useState('');

  // Workflow state
  const [etape, setEtape] = useState<Etape>('upload');
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');
  const [produits, setProduits] = useState<ProduitParse[]>([]);
  const [alertes, setAlertes] = useState<string[]>([]);
  const [colonnes, setColonnes] = useState<string[]>([]);
  const [nbTotal, setNbTotal] = useState(0);
  const [importResult, setImportResult] = useState<{ nb_importes: number; fournisseur_nom: string } | null>(null);

  // Editing state
  const [editCell, setEditCell] = useState<{ row: number; col: keyof ProduitParse } | null>(null);

  // ── ÉTAPE 1: Upload & Parse ──
  const handleAnalyse = useCallback(async () => {
    if (!fichier) { setErreur('Fichier requis'); return; }

    setErreur('');
    setLoading(true);
    setEtape('analyse');

    try {
      const formData = new FormData();
      formData.append('fichier', fichier);

      const res = await fetch('/api/pricing/mercuriale', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErreur(data.error || 'Erreur lors de l\'analyse');
        setEtape('upload');
        return;
      }

      setProduits(data.produits);
      setAlertes(data.alertes || []);
      setColonnes(data.colonnes || []);
      setNbTotal(data.nb_total || 0);
      // Auto-fill fournisseur info from Claude detection
      if (data.fournisseur_nom) setFournisseur(data.fournisseur_nom);
      setEtape('preview');
    } catch {
      setErreur('Erreur réseau. Veuillez réessayer.');
      setEtape('upload');
    } finally {
      setLoading(false);
    }
  }, [fichier]);

  // ── ÉTAPE 3: Import into Supabase ──
  const handleImport = useCallback(async () => {
    setErreur('');
    setLoading(true);
    setEtape('import');

    try {
      const res = await fetch('/api/pricing/mercuriale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          fournisseur_nom: fournisseur || fichier?.name?.replace(/\.[^.]+$/, '') || 'Fournisseur inconnu',
          flux,
          produits,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErreur(data.error || 'Erreur lors de l\'import');
        setEtape('preview');
        return;
      }

      setImportResult(data);
    } catch {
      setErreur('Erreur réseau. Veuillez réessayer.');
      setEtape('preview');
    } finally {
      setLoading(false);
    }
  }, [fournisseur, emailFournisseur, flux, produits, fichier]);

  // ── Inline edit handlers ──
  function updateProduit(index: number, col: keyof ProduitParse, value: string) {
    setProduits(prev => prev.map((p, i) => {
      if (i !== index) return p;
      const numCols: (keyof ProduitParse)[] = ['prix_achat_ht', 'pcb', 'stock', 'tva', 'poids'];
      if (numCols.includes(col)) {
        return { ...p, [col]: parseFloat(value) || 0 };
      }
      return { ...p, [col]: value };
    }));
  }

  function removeProduit(index: number) {
    setProduits(prev => prev.filter((_, i) => i !== index));
  }

  // ── Render ──
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/pricing/offres" className="text-sm text-gray-500 hover:text-indigo-600 transition-colors">
              &larr; Offres
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle mercuriale</h1>
          <p className="text-sm text-gray-500 mt-1">Importez un fichier Excel fournisseur pour créer une offre</p>
        </div>
      </div>

      {/* Étapes indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['upload', 'analyse', 'preview', 'import'] as Etape[]).map((e, i) => {
          const labels = ['Upload', 'Analyse IA', 'Vérification', 'Import'];
          const current = ['upload', 'analyse', 'preview', 'import'].indexOf(etape);
          const step = i;
          return (
            <div key={e} className="flex items-center gap-2">
              {i > 0 && <div className={`w-8 h-0.5 ${step <= current ? 'bg-indigo-600' : 'bg-gray-200'}`} />}
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                step < current ? 'bg-green-100 text-green-700' :
                step === current ? 'bg-indigo-100 text-indigo-700' :
                'bg-gray-100 text-gray-400'
              }`}>
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold bg-current/10">
                  {step < current ? '✓' : i + 1}
                </span>
                {labels[i]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Error banner */}
      {erreur && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {erreur}
          <button onClick={() => setErreur('')} className="ml-2 text-red-500 hover:text-red-700 font-bold">&times;</button>
        </div>
      )}

      {/* ═══ ÉTAPE 1: FORMULAIRE UPLOAD ═══ */}
      {etape === 'upload' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Flux par défaut</label>
            <select
              value={flux}
              onChange={e => setFlux(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
            >
              <option value="dropshipping">Dropshipping</option>
              <option value="stock_wag">Stock WAG (entrepôt)</option>
              <option value="transit">Transit</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fichier mercuriale</label>
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                fichier ? 'border-indigo-300 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={e => setFichier(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              {fichier ? (
                <div>
                  <p className="text-indigo-700 font-medium">{fichier.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{(fichier.size / 1024).toFixed(0)} Ko</p>
                  <button
                    onClick={e => { e.stopPropagation(); setFichier(null); }}
                    className="text-xs text-red-500 hover:text-red-700 mt-2"
                  >
                    Supprimer
                  </button>
                </div>
              ) : (
                <div>
                  <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-sm text-gray-600 mt-2">Cliquez pour sélectionner un fichier</p>
                  <p className="text-xs text-gray-400 mt-1">.xlsx, .xls ou .csv</p>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">Le nom du fournisseur et l&apos;email sont extraits automatiquement du fichier.</p>
          </div>

          <button
            onClick={handleAnalyse}
            disabled={!fichier}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Analyser la mercuriale
          </button>
        </div>
      )}

      {/* ═══ ÉTAPE 2: ANALYSE EN COURS ═══ */}
      {etape === 'analyse' && loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="inline-block w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-lg font-semibold text-gray-900">Analyse en cours...</p>
          <p className="text-sm text-gray-500 mt-2">Claude analyse votre mercuriale et extrait les produits.</p>
          <p className="text-xs text-gray-400 mt-1">Cela peut prendre 10 à 30 secondes.</p>
        </div>
      )}

      {/* ═══ ÉTAPE 3: PREVIEW ═══ */}
      {etape === 'preview' && (
        <div className="space-y-4">
          {/* Stats bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-6">
            <div>
              <p className="text-2xl font-bold text-gray-900">{produits.length}</p>
              <p className="text-xs text-gray-500">produits détectés</p>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{nbTotal}</p>
              <p className="text-xs text-gray-500">lignes dans le fichier</p>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div>
              <p className="text-2xl font-bold text-indigo-600">{colonnes.length}</p>
              <p className="text-xs text-gray-500">colonnes détectées</p>
            </div>
            {fournisseur && (
              <>
                <div className="w-px h-10 bg-gray-200" />
                <div>
                  <p className="text-sm font-bold text-gray-900">{fournisseur}</p>
                  <p className="text-xs text-gray-500">fournisseur détecté{emailFournisseur ? ` — ${emailFournisseur}` : ''}</p>
                </div>
              </>
            )}
            <div className="flex-1" />
            <div className="text-xs text-gray-400">
              Colonnes : {colonnes.join(', ')}
            </div>
          </div>

          {/* Alertes */}
          {alertes.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-1">
              <p className="text-sm font-medium text-amber-800">Colonnes manquantes :</p>
              {alertes.map((a, i) => (
                <p key={i} className="text-xs text-amber-700">&#x26A0; {a}</p>
              ))}
              <p className="text-xs text-amber-600 mt-1">Vous pouvez corriger manuellement dans le tableau ci-dessous.</p>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 w-8">#</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 min-w-[200px]">Nom</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 min-w-[120px]">Marque</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 min-w-[120px]">EAN</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Prix achat</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-500">PCB</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-500">Stock</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-500">DDM</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-500 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-900">
                  {produits.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                      <EditableCell
                        value={p.nom}
                        editing={editCell?.row === i && editCell?.col === 'nom'}
                        onStartEdit={() => setEditCell({ row: i, col: 'nom' })}
                        onSave={v => { updateProduit(i, 'nom', v); setEditCell(null); }}
                        onCancel={() => setEditCell(null)}
                      />
                      <EditableCell
                        value={p.marque}
                        editing={editCell?.row === i && editCell?.col === 'marque'}
                        onStartEdit={() => setEditCell({ row: i, col: 'marque' })}
                        onSave={v => { updateProduit(i, 'marque', v); setEditCell(null); }}
                        onCancel={() => setEditCell(null)}
                      />
                      <EditableCell
                        value={p.ean}
                        editing={editCell?.row === i && editCell?.col === 'ean'}
                        onStartEdit={() => setEditCell({ row: i, col: 'ean' })}
                        onSave={v => { updateProduit(i, 'ean', v); setEditCell(null); }}
                        onCancel={() => setEditCell(null)}
                        className="font-mono text-xs"
                      />
                      <EditableCell
                        value={String(p.prix_achat_ht)}
                        editing={editCell?.row === i && editCell?.col === 'prix_achat_ht'}
                        onStartEdit={() => setEditCell({ row: i, col: 'prix_achat_ht' })}
                        onSave={v => { updateProduit(i, 'prix_achat_ht', v); setEditCell(null); }}
                        onCancel={() => setEditCell(null)}
                        render={() => formatEur(p.prix_achat_ht)}
                        align="right"
                      />
                      <EditableCell
                        value={String(p.pcb)}
                        editing={editCell?.row === i && editCell?.col === 'pcb'}
                        onStartEdit={() => setEditCell({ row: i, col: 'pcb' })}
                        onSave={v => { updateProduit(i, 'pcb', v); setEditCell(null); }}
                        onCancel={() => setEditCell(null)}
                        align="center"
                      />
                      <EditableCell
                        value={String(p.stock)}
                        editing={editCell?.row === i && editCell?.col === 'stock'}
                        onStartEdit={() => setEditCell({ row: i, col: 'stock' })}
                        onSave={v => { updateProduit(i, 'stock', v); setEditCell(null); }}
                        onCancel={() => setEditCell(null)}
                        align="center"
                      />
                      <td className="px-3 py-2 text-center text-xs">
                        {p.ddm ? new Date(p.ddm).toLocaleDateString('fr-FR') : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => removeProduit(i)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="Supprimer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {produits.length === 0 && (
              <div className="text-center py-8 text-sm text-gray-400">Aucun produit détecté</div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setEtape('upload'); setProduits([]); }}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              &larr; Recommencer
            </button>
            <button
              onClick={handleImport}
              disabled={produits.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-semibold px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
            >
              Importer {produits.length} produit{produits.length > 1 ? 's' : ''} &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ═══ ÉTAPE 4: IMPORT EN COURS / RÉSULTAT ═══ */}
      {etape === 'import' && loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="inline-block w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-lg font-semibold text-gray-900">Import en cours...</p>
          <p className="text-sm text-gray-500 mt-2">{produits.length} produits en cours d&apos;insertion dans Supabase.</p>
        </div>
      )}

      {etape === 'import' && !loading && importResult && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{importResult.nb_importes} produits importés !</p>
            <p className="text-sm text-gray-500 mt-1">Fournisseur : {importResult.fournisseur_nom}</p>
            <p className="text-xs text-gray-400 mt-1">Les produits sont en statut &laquo; à traiter &raquo; — passez-les en mode swipe.</p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/pricing/offres"
              className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Voir les offres
            </Link>
            <button
              onClick={() => router.push('/pricing/offres')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              Traiter les produits &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Editable Cell Component ──
function EditableCell({
  value,
  editing,
  onStartEdit,
  onSave,
  onCancel,
  render,
  align = 'left',
  className = '',
}: {
  value: string;
  editing: boolean;
  onStartEdit: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
  render?: () => string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  if (editing) {
    return (
      <td className="px-1 py-1">
        <input
          autoFocus
          type="text"
          defaultValue={value}
          onBlur={e => onSave(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') onSave((e.target as HTMLInputElement).value);
            if (e.key === 'Escape') onCancel();
          }}
          className={`w-full px-2 py-1 border border-indigo-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 ${alignCls}`}
        />
      </td>
    );
  }

  return (
    <td
      className={`px-3 py-2 cursor-pointer hover:bg-indigo-50 transition-colors ${alignCls} ${className}`}
      onClick={onStartEdit}
      title="Cliquer pour modifier"
    >
      {render ? render() : value || <span className="text-gray-300">—</span>}
    </td>
  );
}
