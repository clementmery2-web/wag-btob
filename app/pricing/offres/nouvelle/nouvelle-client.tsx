'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatEur } from '../../lib/types';
import { validerPrix } from '../../pricingUtils';

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
  pmc_fournisseur?: number | null;
  paSuspecte?: boolean;
  paWarning?: string | null;
}

type Etape = 'upload' | 'analyse' | 'mapping' | 'preview' | 'import';

const MAPPING_FIELDS = [
  { key: 'nom', label: 'Nom produit', required: true },
  { key: 'prix', label: 'PA WAG HT', required: true },
  { key: 'ean', label: 'EAN', required: false },
  { key: 'stock', label: 'Stock', required: false },
  { key: 'ddm', label: 'DDM / DLUO', required: false },
  { key: 'pcb', label: 'PCB / Colisage', required: false },
  { key: 'marque', label: 'Marque', required: false },
  { key: 'pmc_ht', label: 'PMC fourn.', required: false },
] as const;

export function NouvelleOffreClient() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // Form state
  const [flux, setFlux] = useState<string>('dropshipping');
  const [fichier, setFichier] = useState<File | null>(null);

  // Auto-detected from file by Claude
  const [fournisseur, setFournisseur] = useState('');
  const [emailFournisseur, setEmailFournisseur] = useState('');
  const [assigneA, setAssigneA] = useState('');

  // Workflow state
  const [etape, setEtape] = useState<Etape>('upload');
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');
  const [produits, setProduits] = useState<ProduitParse[]>([]);
  const [alertes, setAlertes] = useState<string[]>([]);
  const [colonnes, setColonnes] = useState<string[]>([]);
  const [nbTotal, setNbTotal] = useState(0);
  const [importResult, setImportResult] = useState<{ nb_importes: number; fournisseur_nom: string } | null>(null);

  // Mapping state
  const [mapping, setMapping] = useState<Record<string, number | ''>>({});
  const [autoMapping, setAutoMapping] = useState<Record<string, number>>({});

  // Editing state
  const [editCell, setEditCell] = useState<{ row: number; col: keyof ProduitParse } | null>(null);
  const [nomFichierAffiche, setNomFichierAffiche] = useState('');

  // ── SessionStorage persistence ──
  const WIZARD_KEY = 'wag_wizard_state';

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(WIZARD_KEY);
      if (!saved) return;
      const data = JSON.parse(saved);
      if (data.nomFournisseur) setFournisseur(data.nomFournisseur);
      if (data.assigneA) setAssigneA(data.assigneA);
      if (data.mapping) setMapping(data.mapping);
      if (data.produits?.length > 0) setProduits(data.produits);
      if (data.etape && data.etape !== 'import') setEtape(data.etape);
      if (data.nomFichier) setNomFichierAffiche(data.nomFichier);
      if (data.colonnes) setColonnes(data.colonnes);
    } catch (e) {
      console.warn('[wizard] sessionStorage restore failed', e);
    }
  }, []);

  useEffect(() => {
    if (etape === 'upload') return;
    try {
      sessionStorage.setItem(WIZARD_KEY, JSON.stringify({
        nomFichier: fichier?.name ?? nomFichierAffiche ?? '',
        nomFournisseur: fournisseur,
        assigneA,
        mapping,
        produits,
        colonnes,
        etape,
      }));
    } catch (e) {
      console.warn('[wizard] sessionStorage save failed', e);
    }
  }, [fournisseur, assigneA, mapping, produits, colonnes, etape, fichier, nomFichierAffiche]);

  // ── ÉTAPE 1: Upload & Parse ──
  const handleAnalyse = useCallback(async () => {
    if (!fichier) { setErreur('Fichier requis'); return; }

    // #5: Clear stale data before API call so old columns/mapping don't persist on failure
    setColonnes([]);
    setMapping({});
    setAutoMapping({});
    setProduits([]);
    setAlertes([]);
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

      console.log('[wizard] Réponse brute API analyse:', JSON.stringify(data));
      console.log('[client] réponse API analyse:', JSON.stringify(data));
      console.log('[client] colonnes settées:', data.colonnes);

      const apiColonnes: string[] = data.colonnes || [];
      const apiAutoMapping: Record<string, number> = data.auto_mapping || {};
      console.log('[wizard] colonnes après parsing:', apiColonnes);
      console.log('[wizard] mapping après parsing:', apiAutoMapping);

      setColonnes(apiColonnes);
      setNbTotal(data.nb_total || 0);
      // Auto-fill fournisseur info from Claude detection
      if (data.fournisseur_nom) setFournisseur(data.fournisseur_nom);
      // Always set mapping from auto_mapping (even if empty)
      setAutoMapping(apiAutoMapping);
      setMapping(apiAutoMapping);
      setEtape('mapping');
    } catch {
      setErreur('Erreur réseau. Veuillez réessayer.');
      setEtape('upload');
    } finally {
      setLoading(false);
    }
  }, [fichier]);

  // ── ÉTAPE 2.5: Confirm mapping & re-parse ──
  const handleConfirmMapping = useCallback(async () => {
    // Build clean mapping (only fields with a selected column)
    const cleanMapping: Record<string, number> = {};
    for (const [k, v] of Object.entries(mapping)) {
      if (v !== '' && v !== undefined) cleanMapping[k] = v as number;
    }

    if (cleanMapping.nom === undefined || cleanMapping.prix === undefined) {
      setErreur('Les champs "Nom produit" et "Prix achat WAG HT" sont obligatoires.');
      return;
    }

    // If produits already exist (restored from sessionStorage), skip API call
    if (!fichier && produits.length > 0) {
      setEtape('preview');
      return;
    }

    if (!fichier) {
      setErreur('Fichier requis — veuillez re-sélectionner le fichier.');
      return;
    }

    console.log('[mapping] envoyé:', JSON.stringify(cleanMapping));
    setErreur('');
    setLoading(true);
    setEtape('analyse');

    try {
      const formData = new FormData();
      formData.append('fichier', fichier);
      formData.append('columnMapping', JSON.stringify(cleanMapping));

      const res = await fetch('/api/pricing/mercuriale', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErreur(data.error || 'Erreur lors de l\'analyse');
        setEtape('mapping');
        return;
      }

      setProduits(data.produits);
      setAlertes(data.alertes || []);
      setNbTotal(data.nb_total || 0);
      if (data.fournisseur_nom) setFournisseur(data.fournisseur_nom);
      setEtape('preview');
    } catch {
      setErreur('Erreur réseau. Veuillez réessayer.');
      setEtape('mapping');
    } finally {
      setLoading(false);
    }
  }, [fichier, mapping]);

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
          assigned_to: assigneA || null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErreur(data.error || 'Erreur lors de l\'import');
        setEtape('preview');
        return;
      }

      setImportResult(data);
      sessionStorage.removeItem(WIZARD_KEY);
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
        const numVal = parseFloat(value) || 0;
        const updated = { ...p, [col]: numVal };
        if (col === 'prix_achat_ht' && numVal > 0) {
          const v = validerPrix(numVal, 'PA');
          updated.paSuspecte = !v.valide;
          updated.paWarning = v.warning;
        }
        return updated;
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
            <button onClick={() => setEtape('upload')} className="text-sm text-gray-500 hover:text-indigo-600 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              &larr; Offres
            </button>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle mercuriale</h1>
          <p className="text-sm text-gray-500 mt-1">Importez un fichier Excel fournisseur pour créer une offre</p>
        </div>
      </div>

      {/* Étapes indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['upload', 'analyse', 'mapping', 'preview', 'import'] as Etape[]).map((e, i) => {
          const labels = ['Upload', 'Analyse IA', 'Mapping colonnes', 'Vérification', 'Import'];
          const current = ['upload', 'analyse', 'mapping', 'preview', 'import'].indexOf(etape);
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Fichier mercuriale</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
              onDrop={(e) => {
                e.preventDefault(); e.stopPropagation()
                const file = e.dataTransfer.files[0]
                if (!file) return
                setFichier(file)
                setNomFichierAffiche(file.name)
                if (!fournisseur) setFournisseur(file.name.replace(/\.[^/.]+$/, ''))
              }}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                fichier ? 'border-indigo-300 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={e => {
                  const f = e.target.files?.[0] ?? null
                  setFichier(f)
                  if (f) setNomFichierAffiche(f.name)
                  if (f && !fournisseur) setFournisseur(f.name.replace(/\.[^/.]+$/, ''))
                }}
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
          </div>

          <div style={{ marginTop: '12px' }}>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
              Nom du fournisseur
            </label>
            <input type="text" value={fournisseur} onChange={e => setFournisseur(e.target.value)}
              placeholder="Extrait automatiquement ou à saisir manuellement"
              style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '0.5px solid #d1d5db', borderRadius: '8px', background: 'white', color: '#111827' }} />
          </div>

          <div style={{ marginTop: '12px' }}>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
              Assigné à
            </label>
            <select value={assigneA} onChange={e => setAssigneA(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '0.5px solid #d1d5db', borderRadius: '8px', background: 'white', color: '#111827' }}>
              <option value="">— Non assigné</option>
              {['Chloé','Juliette','Solène','Clément','Jon','Marc','Eva'].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleAnalyse}
            disabled={!fichier || loading}
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

      {/* ═══ ÉTAPE 2.5: MAPPING COLONNES ═══ */}
      {etape === 'mapping' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 max-w-2xl">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Mapping des colonnes</h2>
            <p className="text-sm text-gray-500 mt-1">
              Vérifiez et ajustez la correspondance entre les colonnes du fichier et les champs attendus.
            </p>
          </div>

          {/* Field mapping dropdowns */}
          <div className="space-y-3">
            {MAPPING_FIELDS.map(({ key, label, required }) => (
              <div key={key} className="flex items-center gap-3">
                <label className="w-44 text-sm text-gray-700 flex items-center gap-1.5">
                  {label}
                  {required && <span className="text-red-500 text-xs">*</span>}
                </label>
                <select
                  value={String(mapping[key] ?? '')}
                  onChange={e => setMapping(prev => ({ ...prev, [key]: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className={`flex-1 px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100 ${
                    required && (mapping[key] === '' || mapping[key] === undefined)
                      ? 'border-red-300 focus:border-red-400'
                      : 'border-gray-300 focus:border-indigo-500'
                  }`}
                >
                  <option value="">— Non mappé —</option>
                  {colonnes.map((col, i) => (
                    <option key={i} value={String(i)}>{col}</option>
                  ))}
                </select>
                {/* Show auto-detected badge */}
                {autoMapping[key] !== undefined && mapping[key] === autoMapping[key] && (
                  <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded whitespace-nowrap">auto</span>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => { setEtape('upload'); setFichier(null); setColonnes([]); setMapping({}); setAutoMapping({}); setProduits([]); setAlertes([]); sessionStorage.removeItem(WIZARD_KEY); }}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              &larr; Recommencer
            </button>
            <button
              onClick={handleConfirmMapping}
              disabled={mapping.nom === '' || mapping.nom === undefined || mapping.prix === '' || mapping.prix === undefined}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Confirmer le mapping
            </button>
          </div>
        </div>
      )}

      {/* ═══ ÉTAPE 3: PREVIEW ═══ */}
      {etape === 'preview' && (() => {
        // Calculs
        const joursRestants = (ddmStr: string | null): number => {
          if (!ddmStr) return 9999;
          try {
            const dt = new Date(ddmStr);
            if (isNaN(dt.getTime())) return 9999;
            return Math.floor((dt.getTime() - Date.now()) / 86400000);
          } catch { return 9999; }
        };

        const eanCount: Record<string, number> = {};
        produits.forEach(p => { if (p.ean) eanCount[p.ean] = (eanCount[p.ean] || 0) + 1; });
        const isEanDuplique = (ean: string | null | undefined) => !!ean && eanCount[ean] > 1;
        const eanFirstLine: Record<string, number> = {};
        produits.forEach((p, i) => { if (p.ean && !(p.ean in eanFirstLine)) eanFirstLine[p.ean] = i + 1; });

        type RowStatus = 'ok' | 'warn' | 'error';
        const getStatus = (p: ProduitParse): RowStatus => {
          if (isEanDuplique(p.ean)) return 'error';
          if (!p.pmc_fournisseur || joursRestants(p.ddm) < 30) return 'warn';
          return 'ok';
        };

        const nbPmcManquant = produits.filter(p => !p.pmc_fournisseur).length;
        const nbEanDouble = produits.filter(p => isEanDuplique(p.ean)).length;
        const nbAnomalies = produits.filter(p => getStatus(p) !== 'ok').length;
        const stockTotal = produits.reduce((s, p) => s + (p.stock || 0), 0);
        const valeurTotale = produits.reduce((s, p) => s + (p.prix_achat_ht || 0) * (p.stock || 0), 0);

        // Local filter/search state managed via closure — use produits directly
        // Note: we can't use useState inside the IIFE, so we render without filter/search for now
        // and add it as a separate enhancement if needed

        const produitsFiltres = produits;

        return (
          <div style={{ background: 'var(--color-background-primary, white)', border: '0.5px solid var(--color-border-tertiary, #e5e7eb)', borderRadius: '12px', padding: '24px' }}>
            {/* Header */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-text-primary, #111827)', marginBottom: '4px' }}>Vérification avant import</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #6b7280)' }}>{fournisseur || 'Fournisseur inconnu'}</div>
            </div>

            {/* Bannière anomalies */}
            {nbAnomalies > 0 && (
              <div style={{ background: nbEanDouble > 0 ? '#FCEBEB' : '#FAEEDA', border: `0.5px solid ${nbEanDouble > 0 ? '#E24B4A' : '#EF9F27'}`, color: nbEanDouble > 0 ? '#791F1F' : '#633806', borderRadius: '8px', padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
                ⚠ {nbAnomalies} anomalie{nbAnomalies > 1 ? 's' : ''} détectée{nbAnomalies > 1 ? 's' : ''} —
                {nbPmcManquant > 0 && ` ${nbPmcManquant} ligne${nbPmcManquant > 1 ? 's' : ''} sans PMC fournisseur`}
                {nbPmcManquant > 0 && nbEanDouble > 0 && ','}
                {nbEanDouble > 0 && ` ${nbEanDouble} EAN en double`}.
                {' '}Vous pouvez importer quand même ou supprimer les lignes concernées.
              </div>
            )}

            {/* 5 KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Produits détectés', value: String(produits.length), sub: 'lignes valides', borderColor: 'transparent', valueColor: 'var(--color-text-primary, #111827)' },
                { label: 'Stock total', value: Math.round(stockTotal).toLocaleString('fr-FR'), sub: 'cartons', borderColor: 'transparent', valueColor: 'var(--color-text-primary, #111827)' },
                { label: 'Valeur est. PA', value: Math.round(valeurTotale).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }), sub: 'PA × stock', borderColor: 'transparent', valueColor: 'var(--color-text-primary, #111827)' },
                { label: 'PMC fourn. manquant', value: String(nbPmcManquant), sub: null, borderColor: nbPmcManquant > 0 ? '#EF9F27' : 'transparent', valueColor: nbPmcManquant > 0 ? '#EF9F27' : 'var(--color-text-tertiary, #9ca3af)' },
                { label: 'EAN en double', value: String(nbEanDouble), sub: null, borderColor: nbEanDouble > 0 ? '#E24B4A' : 'transparent', valueColor: nbEanDouble > 0 ? '#E24B4A' : 'var(--color-text-tertiary, #9ca3af)' },
              ].map(({ label, value, sub, borderColor, valueColor }) => (
                <div key={label} style={{ background: 'var(--color-background-secondary, #f9fafb)', borderRadius: '8px', padding: '12px 14px', border: `0.5px solid ${borderColor}` }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary, #9ca3af)', marginBottom: '4px' }}>{label}</div>
                  <div style={{ fontSize: '22px', fontWeight: 500, color: valueColor }}>{value}</div>
                  {sub && <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary, #9ca3af)' }}>{sub}</div>}
                </div>
              ))}
            </div>

            {/* Card tableau */}
            <div style={{ border: '0.5px solid var(--color-border-tertiary, #e5e7eb)', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
              {/* Table header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '0.5px solid var(--color-border-tertiary, #e5e7eb)' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--color-text-primary, #111827)' }}>Produits à importer</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary, #6b7280)' }}>Cliquez × pour exclure une ligne</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, background: '#EEEDFE', color: '#3C3489', padding: '3px 10px', borderRadius: 20 }}>
                  {fournisseur || '—'}
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed', minWidth: '900px' }}>
                  <colgroup>
                    <col style={{ width: '28px' }} />
                    <col style={{ width: '220px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '85px' }} />
                    <col style={{ width: '65px' }} />
                    <col style={{ width: '45px' }} />
                    <col style={{ width: '85px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '28px' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'var(--color-background-secondary, #f9fafb)' }}>
                      {['#', 'Produit', 'EAN', 'PA WAG HT', 'Stock', 'PCB', 'Valeur PA', 'DDM', 'PMC fourn.', ''].map((h, idx) => (
                        <th key={idx} style={{ padding: '8px 6px', textAlign: idx >= 3 && idx <= 6 ? 'right' : 'left', fontSize: '10px', fontWeight: 500, color: 'var(--color-text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {produitsFiltres.map((p, i) => {
                      const status = getStatus(p);
                      const jours = joursRestants(p.ddm);
                      const valeurPA = Math.round((p.prix_achat_ht || 0) * (p.stock || 0));
                      const rowBg = status === 'error' ? 'rgba(252,235,235,0.2)' : status === 'warn' ? 'rgba(250,238,218,0.13)' : undefined;

                      return (
                        <tr key={i} style={{ borderTop: '0.5px solid var(--color-border-tertiary, #f3f4f6)', background: rowBg }}>
                          <td style={{ padding: '8px 6px', fontSize: '11px', color: 'var(--color-text-tertiary, #9ca3af)' }}>{i + 1}</td>

                          {/* Produit */}
                          <td style={{ padding: '8px 6px' }}>
                            <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--color-text-primary, #111827)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nom || '—'}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #6b7280)' }}>{p.marque || fournisseur || ''}</div>
                            {!p.pmc_fournisseur && <span style={{ fontSize: 10, background: '#FAEEDA', color: '#633806', padding: '1px 6px', borderRadius: 20, display: 'inline-block', marginTop: 2 }}>⚠ PMC manquant</span>}
                            {jours < 30 && jours >= 0 && jours !== 9999 && <span style={{ fontSize: 10, background: '#FAEEDA', color: '#633806', padding: '1px 6px', borderRadius: 20, display: 'inline-block', marginTop: 2, marginLeft: 2 }}>⚠ DDM {jours}j</span>}
                            {isEanDuplique(p.ean) && <span style={{ fontSize: 10, background: '#FCEBEB', color: '#791F1F', padding: '1px 6px', borderRadius: 20, display: 'inline-block', marginTop: 2 }}>✕ EAN doublon ligne {eanFirstLine[p.ean!]}</span>}
                          </td>

                          {/* EAN */}
                          <td style={{ padding: '8px 6px' }}>
                            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: isEanDuplique(p.ean) ? '#E24B4A' : 'var(--color-text-secondary, #6b7280)' }}>
                              {p.ean || <span style={{ color: 'var(--color-text-tertiary, #9ca3af)' }}>—</span>}
                            </span>
                          </td>

                          {/* PA WAG HT */}
                          <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {p.prix_achat_ht ? (
                              <span style={{ fontWeight: 500, color: p.paSuspecte ? '#d97706' : 'var(--color-text-primary, #111827)' }}>
                                {p.prix_achat_ht.toFixed(2)} €
                                {p.paSuspecte && <span title={p.paWarning ?? ''} style={{ cursor: 'help', color: '#d97706', marginLeft: '2px' }}>⚠</span>}
                              </span>
                            ) : <span style={{ color: 'var(--color-text-tertiary, #9ca3af)' }}>—</span>}
                          </td>

                          {/* Stock */}
                          <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary, #111827)' }}>{p.stock || '—'}</td>

                          {/* PCB */}
                          <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--color-text-secondary, #6b7280)' }}>{p.pcb || '—'}</td>

                          {/* Valeur PA */}
                          <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary, #111827)' }}>
                            {valeurPA > 0 ? `${valeurPA.toLocaleString('fr-FR')} €` : '—'}
                          </td>

                          {/* DDM */}
                          <td style={{ padding: '8px 6px' }}>
                            {p.ddm ? (
                              <>
                                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary, #111827)' }}>
                                  {(() => { try { const d = new Date(p.ddm); return isNaN(d.getTime()) ? p.ddm : d.toLocaleDateString('fr-FR'); } catch { return p.ddm; } })()}
                                </div>
                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, display: 'inline-block', marginTop: 2, background: jours > 90 ? '#EAF3DE' : jours >= 30 ? '#FAEEDA' : jours >= 0 ? '#FCEBEB' : '#FCEBEB', color: jours > 90 ? '#27500A' : jours >= 30 ? '#633806' : '#791F1F' }}>
                                  {jours >= 0 && jours !== 9999 ? `${jours}j` : jours < 0 ? 'expiré' : '—'}
                                </span>
                              </>
                            ) : <span style={{ color: 'var(--color-text-tertiary, #9ca3af)', fontSize: 12 }}>—</span>}
                          </td>

                          {/* PMC fourn. */}
                          <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                            {p.pmc_fournisseur != null && p.pmc_fournisseur > 0
                              ? <span style={{ fontWeight: 500, color: '#185FA5' }}>{p.pmc_fournisseur.toFixed(2)} €</span>
                              : <span style={{ fontSize: 12, background: '#FAEEDA', color: '#B85000', padding: '1px 7px', borderRadius: 20 }}>— manquant</span>
                            }
                          </td>

                          {/* Supprimer */}
                          <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                            <button onClick={() => removeProduit(i)} style={{ color: 'var(--color-text-tertiary, #9ca3af)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: '0 4px' }}>×</button>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Ligne total */}
                    <tr style={{ background: 'var(--color-background-secondary, #f9fafb)', borderTop: '0.5px solid var(--color-border-secondary, #d1d5db)' }}>
                      <td colSpan={6} style={{ textAlign: 'right', fontSize: 11, color: 'var(--color-text-secondary, #6b7280)', fontWeight: 500, padding: '10px 10px' }}>Total</td>
                      <td style={{ textAlign: 'right', fontWeight: 500, fontSize: 13, fontVariantNumeric: 'tabular-nums', padding: '10px 10px', color: 'var(--color-text-primary, #111827)' }}>
                        {produits.reduce((s, p) => s + Math.round((p.prix_achat_ht || 0) * (p.stock || 0)), 0).toLocaleString('fr-FR')} €
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tbody>
                </table>
              </div>

              {produits.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-tertiary, #9ca3af)', fontSize: '13px' }}>Aucun produit détecté</div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 4 }}>
              <button onClick={() => { setEtape('upload'); setFichier(null); setColonnes([]); setMapping({}); setAutoMapping({}); setProduits([]); setAlertes([]); sessionStorage.removeItem(WIZARD_KEY); }} style={{ fontSize: '13px', color: 'var(--color-text-secondary, #6b7280)', background: 'none', border: 'none', cursor: 'pointer' }}>
                ← Recommencer
              </button>
              <div style={{ textAlign: 'right' }}>
                <button onClick={handleImport} disabled={produits.length === 0}
                  style={{ background: produits.length === 0 ? '#e5e7eb' : '#533AB7', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: produits.length === 0 ? 'not-allowed' : 'pointer' }}>
                  Importer {produits.length} produit{produits.length > 1 ? 's' : ''} →
                </button>
                {nbAnomalies > 0 && <div style={{ fontSize: 12, color: 'var(--color-text-secondary, #6b7280)', marginTop: 4 }}>{nbAnomalies} anomalie{nbAnomalies > 1 ? 's' : ''} · import possible</div>}
              </div>
            </div>
          </div>
        );
      })()}

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
            <p className="text-xs text-gray-400 mt-1">Les produits sont maintenant disponibles dans Validation pricing.</p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/pricing/offres"
              className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Voir les offres
            </Link>
            <button
              onClick={() => router.push('/pricing/validation-pricing')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              Voir dans Validation pricing &rarr;
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
