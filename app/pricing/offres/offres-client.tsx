'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DEMO_OFFRES } from '../lib/demo-data';
import { formatEur } from '../lib/types';

interface OffreData {
  id: string;
  fournisseur: string;
  date_reception: string;
  nb_produits: number;
  ddm_min: string;
  valeur_estimee: number;
  statut: string;
  assigne_a: string | null;
  score_urgence: number;
  priorite: string;
}

const STATUT_LABELS: Record<string, { label: string; cls: string }> = {
  nouvelle: { label: 'Nouvelle', cls: 'bg-blue-100 text-blue-700' },
  en_cours: { label: 'En cours', cls: 'bg-amber-100 text-amber-700' },
  traitee: { label: 'Traitée', cls: 'bg-green-100 text-green-700' },
  envoyee: { label: 'Envoyée', cls: 'bg-gray-100 text-gray-600' },
};

const PRIORITE_ICONS: Record<string, string> = {
  rouge: '🔴',
  orange: '🟠',
  vert: '🟢',
};

const PRIORITE_LABELS: Record<string, string> = {
  rouge: 'Traiter aujourd\'hui',
  orange: 'Cette semaine',
  vert: 'Pas urgent',
};

export function OffresClient() {
  const [offres, setOffres] = useState<OffreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>('');
  const [filtrStatut, setFiltrStatut] = useState<string>('tous');
  const [filtrUrgence, setFiltrUrgence] = useState<string>('tous');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [noteModal, setNoteModal] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/pricing/offres')
      .then(r => r.json())
      .then(data => {
        if (data.offres) {
          setOffres(data.offres);
          setSource(data.source ?? 'supabase');
        } else {
          // Fallback to demo
          setOffres(DEMO_OFFRES.map(o => ({
            id: o.id,
            fournisseur: o.fournisseur,
            date_reception: o.date_reception,
            nb_produits: o.nb_produits,
            ddm_min: o.ddm_min,
            valeur_estimee: o.valeur_estimee,
            statut: o.statut,
            assigne_a: o.assigne_a,
            score_urgence: o.score_urgence,
            priorite: o.priorite,
          })));
          setSource('demo');
        }
      })
      .catch(() => {
        setOffres(DEMO_OFFRES.map(o => ({
          id: o.id,
          fournisseur: o.fournisseur,
          date_reception: o.date_reception,
          nb_produits: o.nb_produits,
          ddm_min: o.ddm_min,
          valeur_estimee: o.valeur_estimee,
          statut: o.statut,
          assigne_a: o.assigne_a,
          score_urgence: o.score_urgence,
          priorite: o.priorite,
        })));
        setSource('demo');
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = offres.filter(o => {
    if (filtrStatut !== 'tous' && o.statut !== filtrStatut) return false;
    if (filtrUrgence !== 'tous' && o.priorite !== filtrUrgence) return false;
    return true;
  }).sort((a, b) => b.score_urgence - a.score_urgence);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Offres fournisseurs</h1>
          {source && (
            <p className="text-[10px] text-gray-400 mt-0.5">
              Source : {source === 'supabase' ? '🟢 Supabase' : '🟡 Démo'}
            </p>
          )}
        </div>
        <Link
          href="/pricing/offres/nouvelle"
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvelle offre
        </Link>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filtrStatut}
          onChange={e => setFiltrStatut(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700"
        >
          <option value="tous">Tous les statuts</option>
          <option value="nouvelle">Nouvelle</option>
          <option value="en_cours">En cours</option>
          <option value="traitee">Traitée</option>
          <option value="envoyee">Envoyée</option>
        </select>
        <select
          value={filtrUrgence}
          onChange={e => setFiltrUrgence(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700"
        >
          <option value="tous">Toutes les urgences</option>
          <option value="rouge">🔴 Traiter aujourd&apos;hui</option>
          <option value="orange">🟠 Cette semaine</option>
          <option value="vert">🟢 Pas urgent</option>
        </select>
        <span className="text-sm text-gray-500">{filtered.length} offre{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 mt-2">Chargement des offres...</p>
        </div>
      )}

      {/* Tableau */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-500 w-12">Prio</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">Fournisseur</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">Réception</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-500">Produits</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">DDM min</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500">Valeur</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-500">Statut</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-500">Assigné</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(offre => (
                  <tr
                    key={offre.id}
                    className="hover:bg-gray-50 transition-colors relative"
                    onMouseEnter={() => setHoveredId(offre.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <td className="px-4 py-3">
                      <span title={PRIORITE_LABELS[offre.priorite]}>{PRIORITE_ICONS[offre.priorite]}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{offre.fournisseur}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(offre.date_reception).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{offre.nb_produits}</td>
                    <td className="px-4 py-3">
                      <DdmBadge ddm={offre.ddm_min} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatEur(offre.valeur_estimee)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUT_LABELS[offre.statut]?.cls ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUT_LABELS[offre.statut]?.label ?? offre.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {offre.assigne_a ?? (
                        <button className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                          Assigner
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/pricing/traitement/${offre.id}`}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                        >
                          Traiter
                        </Link>
                        <button
                          onClick={() => setNoteModal(noteModal === offre.id ? null : offre.id)}
                          className="text-gray-400 hover:text-gray-600 p-1"
                          title="Note interne"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                          </svg>
                        </button>
                      </div>
                    </td>

                    {/* Preview tooltip */}
                    {hoveredId === offre.id && (
                      <td className="absolute right-0 top-full z-30 mt-1 mr-4" colSpan={9}>
                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs w-64">
                          <p className="font-semibold text-gray-900 mb-1">{offre.fournisseur}</p>
                          <p className="text-gray-600">DDM min : {new Date(offre.ddm_min).toLocaleDateString('fr-FR')}</p>
                          <p className="text-gray-600">Valeur estimée : {formatEur(offre.valeur_estimee)}</p>
                          <p className="text-gray-600">Score urgence : {offre.score_urgence}/100</p>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && !loading && (
            <div className="text-center py-8 text-sm text-gray-400">Aucune offre trouvée</div>
          )}
        </div>
      )}
    </div>
  );
}

function DdmBadge({ ddm }: { ddm: string }) {
  const days = Math.max(0, Math.floor((new Date(ddm).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  let cls = 'bg-green-100 text-green-700';
  if (days < 30) cls = 'bg-red-100 text-red-700';
  else if (days < 90) cls = 'bg-amber-100 text-amber-700';
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {days}j
    </span>
  );
}
