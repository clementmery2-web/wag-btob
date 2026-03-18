'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DEMO_OFFRES } from '../../lib/demo-data';
import { formatEur, formatPct } from '../../lib/types';

interface ProduitData {
  id: string;
  nom: string;
  marque: string;
  contenance: string;
  prix_achat_ht: number;
  prix_vente_wag_ht: number | null;
  stock_disponible: number;
  statut: string;
  fournisseur_nom?: string;
}

export function ValidationClient({ offreId }: { offreId: string }) {
  const [produits, setProduits] = useState<ProduitData[]>([]);
  const [fournisseur, setFournisseur] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState<'maintenant' | 'programme' | 'manuelle'>('maintenant');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    fetch(`/api/pricing/produits?offre_id=${encodeURIComponent(offreId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.produits && data.produits.length > 0) {
          setProduits(data.produits);
          setFournisseur(data.produits[0].fournisseur_nom ?? '');
        } else {
          // Fallback demo
          const offre = DEMO_OFFRES.find(o => o.id === offreId);
          if (offre) {
            setProduits(offre.produits);
            setFournisseur(offre.fournisseur);
          }
        }
      })
      .catch(() => {
        const offre = DEMO_OFFRES.find(o => o.id === offreId);
        if (offre) {
          setProduits(offre.produits);
          setFournisseur(offre.fournisseur);
        }
      })
      .finally(() => setLoading(false));
  }, [offreId]);

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 mt-2">Chargement...</p>
      </div>
    );
  }

  if (produits.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Offre introuvable</p>
        <Link href="/pricing/offres" className="text-indigo-600 text-sm mt-2 inline-block">← Retour</Link>
      </div>
    );
  }

  const valides = produits.filter(p => p.statut === 'valide');
  const contreOffres = produits.filter(p => p.statut === 'contre_offre');
  const refuses = produits.filter(p => p.statut === 'refuse');
  const passes = produits.filter(p => p.statut === 'passe' || p.statut === 'a_traiter');

  const valeurAchat = produits.reduce((s, p) => s + p.prix_achat_ht * p.stock_disponible, 0);
  const caPotentiel = valides.reduce((s, p) => s + (p.prix_vente_wag_ht ?? 0) * p.stock_disponible, 0);
  const margeEstimee = caPotentiel - valides.reduce((s, p) => s + p.prix_achat_ht * p.stock_disponible, 0);
  const margePct = caPotentiel > 0 ? (margeEstimee / caPotentiel) * 100 : 0;

  if (confirmed) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="text-5xl">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900">Offre validée et envoyée</h2>
        <p className="text-gray-600 max-w-md mx-auto">
          {valides.length} produit{valides.length > 1 ? 's' : ''} mis en ligne.
          {contreOffres.length > 0 && ` ${contreOffres.length} contre-offre${contreOffres.length > 1 ? 's' : ''} envoyée${contreOffres.length > 1 ? 's' : ''}.`}
          {refuses.length > 0 && ` ${refuses.length} refus notifié${refuses.length > 1 ? 's' : ''}.`}
        </p>
        <Link href="/pricing" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors mt-4">
          Retour au dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/pricing/traitement/${offreId}`} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Validation — {fournisseur}</h1>
      </div>

      {/* Résumé 3 colonnes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard icon="✅" count={valides.length} label="En ligne" cls="bg-green-50 border-green-200" />
        <SummaryCard icon="📩" count={contreOffres.length} label="Contre-offre" cls="bg-orange-50 border-orange-200" />
        <SummaryCard icon="❌" count={refuses.length} label="Refusés" cls="bg-red-50 border-red-200" />
      </div>
      {passes.length > 0 && (
        <p className="text-sm text-gray-500">⏭️ {passes.length} produit{passes.length > 1 ? 's' : ''} non traité{passes.length > 1 ? 's' : ''}</p>
      )}

      {/* Récapitulatif financier */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3">Récapitulatif financier</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-400">Valeur achat total</p>
            <p className="text-lg font-bold text-gray-900">{formatEur(valeurAchat)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">CA potentiel (validés)</p>
            <p className="text-lg font-bold text-indigo-600">{formatEur(caPotentiel)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Marge WAG estimée</p>
            <p className="text-lg font-bold text-green-600">{formatEur(margeEstimee)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Marge %</p>
            <p className="text-lg font-bold text-green-600">{formatPct(margePct)}</p>
          </div>
        </div>
      </div>

      {/* Preview email */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900">Preview email — {fournisseur}</h3>
          <button className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Modifier le message</button>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-2 font-mono">
          <p><strong>Objet :</strong> Retour sur votre offre — Willy Anti-gaspi</p>
          <p>Bonjour,</p>
          <p>Suite à l&apos;analyse de votre listing :</p>
          {valides.length > 0 && <p>✅ {valides.length} produit{valides.length > 1 ? 's' : ''} accepté{valides.length > 1 ? 's' : ''} — mise en ligne immédiate</p>}
          {contreOffres.length > 0 && <p>📩 {contreOffres.length} produit{contreOffres.length > 1 ? 's' : ''} — contre-offre jointe</p>}
          {refuses.length > 0 && <p>❌ {refuses.length} produit{refuses.length > 1 ? 's' : ''} que nous ne pouvons pas reprendre cette fois</p>}
          <p>Cordialement,<br />L&apos;équipe Willy Anti-gaspi</p>
        </div>
      </div>

      {/* Planning mise en ligne */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3">Planning de mise en ligne</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="planning" checked={planning === 'maintenant'} onChange={() => setPlanning('maintenant')} className="accent-indigo-600" />
            <span className="text-sm text-gray-700">Mettre en ligne maintenant</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="planning" checked={planning === 'programme'} onChange={() => setPlanning('programme')} className="accent-indigo-600" />
            <span className="text-sm text-gray-700">Programmer (date + heure)</span>
          </label>
          {planning === 'programme' && (
            <input type="datetime-local" className="ml-6 text-sm border border-gray-300 rounded-lg px-3 py-1.5" />
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="planning" checked={planning === 'manuelle'} onChange={() => setPlanning('manuelle')} className="accent-indigo-600" />
            <span className="text-sm text-gray-700">Attendre validation manuelle</span>
          </label>
        </div>
      </div>

      {/* Bouton final */}
      <button
        onClick={() => setConfirmed(true)}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-4 text-lg font-bold transition-colors shadow-lg"
      >
        Valider et envoyer
      </button>
    </div>
  );
}

function SummaryCard({ icon, count, label, cls }: { icon: string; count: number; label: string; cls: string }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${cls}`}>
      <span className="text-2xl">{icon}</span>
      <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );
}
