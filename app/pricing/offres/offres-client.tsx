'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { formatEur } from '../lib/types';

const OPERATEURS = ['Chloé', 'Juliette', 'Solène', 'Clément', 'Jonathan', 'Marc', 'Eva', 'Test'];

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
  const [error, setError] = useState<string | null>(null);
  const [filtrStatut, setFiltrStatut] = useState<string>('tous');
  const [filtrUrgence, setFiltrUrgence] = useState<string>('tous');
  const [noteModal, setNoteModal] = useState<string | null>(null);
  const [assignDropdown, setAssignDropdown] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Tooltip state: fixed position + offre data
  const [hoveredOffre, setHoveredOffre] = useState<OffreData | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  function handleMouseEnter(e: React.MouseEvent, offre: OffreData) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltipPos({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 280) });
    setHoveredOffre(offre);
  }

  function handleMouseLeave() {
    setHoveredOffre(null);
  }

  // Outside click to close dropdown
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setAssignDropdown(null);
    }
  }, []);

  useEffect(() => {
    if (assignDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [assignDropdown, handleClickOutside]);

  function handleAssign(offreId: string, nom: string) {
    setOffres(prev => prev.map(o => o.id === offreId ? { ...o, assigne_a: nom } : o));
    setAssignDropdown(null);
    fetch(`/api/pricing/produits/${offreId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigne_a: nom }),
    }).catch(err => console.error('[assigner] PATCH failed:', err));
  }

  const handleArchiverOffre = async (offreId: string) => {
    if (!window.confirm('Archiver cette offre ? Les produits en attente seront aussi archivés.')) return
    try {
      const res = await fetch('/api/pricing/check-archive-offre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offreId, force: true })
      })
      if (res.ok) setOffres(prev => prev.filter(o => o.id !== offreId))
    } catch (err) {
      console.error('[handleArchiverOffre]', err)
    }
  }

  useEffect(() => {
    fetch('/api/pricing/offres')
      .then(r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'Session expirée — reconnectez-vous' : `Erreur ${r.status}`);
        return r.json();
      })
      .then(data => {
        setOffres(data.offres ?? []);
        setSource(data.source ?? 'supabase');
      })
      .catch((err) => {
        setError(err.message || 'Impossible de charger les offres depuis Supabase');
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
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
                  <th className="text-center px-4 py-3 font-semibold text-gray-500">Références</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">DDM min</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500" title="PA × nb références estimée">Valeur est. HT</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-500">Statut</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-500">Assigné</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(offre => (
                  <tr
                    key={offre.id}
                    className="hover:bg-gray-50 transition-colors"
                    onMouseEnter={(e) => handleMouseEnter(e, offre)}
                    onMouseLeave={handleMouseLeave}
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
                      <button
                        onClick={(e) => {
                          if (assignDropdown === offre.id) {
                            setAssignDropdown(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setDropdownPos({ top: rect.bottom + 4, left: rect.left });
                            setAssignDropdown(offre.id);
                          }
                        }}
                        className={`text-xs font-medium px-2 py-1 rounded-md transition-colors ${
                          offre.assigne_a
                            ? 'text-gray-700 hover:bg-gray-100'
                            : 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50'
                        }`}
                      >
                        {offre.assigne_a ?? 'Assigner'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href="/pricing/validation-pricing"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                        >
                          Traiter
                        </Link>
                        <button
                          onClick={() => handleArchiverOffre(offre.id)}
                          className="text-gray-400 hover:text-red-500 text-xs px-2 py-1 border border-gray-200 rounded-md transition-colors"
                          title="Archiver cette offre"
                        >
                          Archiver
                        </button>
                      </div>
                    </td>
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

      {/* Tooltip portal — fixed position, never clipped */}
      {hoveredOffre && typeof document !== 'undefined' && createPortal(
        <div
          className="pointer-events-none"
          style={{
            position: 'fixed',
            top: tooltipPos.top,
            left: tooltipPos.left,
            zIndex: 9999,
          }}
        >
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs w-64">
            <p className="font-semibold text-gray-900 mb-1">{hoveredOffre.fournisseur}</p>
            <p className="text-gray-600">DDM min : {new Date(hoveredOffre.ddm_min).toLocaleDateString('fr-FR')}</p>
            <p className="text-gray-600">Valeur estimée : {formatEur(hoveredOffre.valeur_estimee)}</p>
            <p className="text-gray-600">Score urgence : {hoveredOffre.score_urgence}/100</p>
          </div>
        </div>,
        document.body
      )}

      {/* Dropdown assigner portal — fixed position, never clipped */}
      {assignDropdown && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            zIndex: 9999,
            minWidth: 160,
          }}
        >
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg py-1">
            {OPERATEURS.map(nom => {
              const offre = filtered.find(o => o.id === assignDropdown);
              return (
                <button
                  key={nom}
                  onClick={() => handleAssign(assignDropdown, nom)}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 transition-colors ${
                    offre?.assigne_a === nom ? 'font-bold text-indigo-600 bg-indigo-50' : 'text-gray-700'
                  }`}
                >
                  {nom}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
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
