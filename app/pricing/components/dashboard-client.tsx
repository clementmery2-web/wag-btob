'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatEur, formatPct } from '../lib/types';

interface KPIs {
  offres_a_traiter: number;
  produits_en_ligne: number;
  ca_potentiel: number;
  engagement_potentiel: number;
  marge_wag_moyenne: number;
  taux_acceptation_contre_offres: number;
  pmc_manuel_requis?: number;
}

interface AlerteData {
  type: string;
  message: string;
  produit_id?: string;
  depuis?: string;
}

interface ActionData {
  id: string;
  type: string;
  description: string;
  created_at: string;
}

export function DashboardClient() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [alertes, setAlertes] = useState<AlerteData[]>([]);
  const [actions, setActions] = useState<ActionData[]>([]);
  const [source, setSource] = useState<string>('');
  const [photosAVerifier, setPhotosAVerifier] = useState(0);
  const [pmcManuelRequis, setPmcManuelRequis] = useState(0);

  useEffect(() => {
    // Fetch dashboard data from Supabase
    fetch('/api/pricing/dashboard')
      .then(r => r.json())
      .then(data => {
        if (data.kpis) {
          setKpis(data.kpis);
          setPmcManuelRequis(data.kpis.pmc_manuel_requis ?? 0);
        }
        setAlertes(data.alertes ?? []);
        setActions(data.activite ?? []);
        if (data.source) setSource(data.source);
      })
      .catch(() => {
        setSource('demo');
      });

    // Fetch photos count
    fetch('/api/pricing/photos')
      .then(r => r.json())
      .then(data => {
        if (data.stats) setPhotosAVerifier(data.stats.a_verifier ?? 0);
      })
      .catch(() => {});
  }, []);

  if (!kpis) {
    return (
      <div className="text-center py-16">
        <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 mt-2">Chargement du dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          {source && (
            <p className="text-[10px] text-gray-400 mt-0.5">
              Source : {source === 'supabase' ? '🟢 Supabase' : '🟡 Démo'}
            </p>
          )}
        </div>
        <Link
          href="/pricing/offres"
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Voir les offres →
        </Link>
      </div>

      {/* Alerte photos */}
      {photosAVerifier > 0 && (
        <Link href="/pricing/photos" className="block">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 hover:bg-amber-100 transition-colors">
            <span className="inline-flex items-center justify-center w-8 h-8 bg-amber-100 text-amber-600 rounded-full text-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-bold text-amber-800">{photosAVerifier} photo{photosAVerifier > 1 ? 's' : ''} a verifier</p>
              <p className="text-xs text-amber-600">Cliquez pour gerer les photos produits →</p>
            </div>
          </div>
        </Link>
      )}

      {/* Alerte PMC manquants */}
      {pmcManuelRequis > 0 && (
        <Link href="/pricing/offres?pmc=manuel_requis" className="block">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3 hover:bg-orange-100 transition-colors">
            <span className="inline-flex items-center justify-center w-8 h-8 bg-orange-100 text-orange-600 rounded-full text-lg">
              💰
            </span>
            <div>
              <p className="text-sm font-bold text-orange-800">{pmcManuelRequis} produit{pmcManuelRequis > 1 ? 's' : ''} sans PMC fiable</p>
              <p className="text-xs text-orange-600">Saisie manuelle requise →</p>
            </div>
          </div>
        </Link>
      )}

      {/* Alertes */}
      {alertes.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full">{alertes.length}</span>
            <h2 className="text-sm font-bold text-red-800">Action requise</h2>
          </div>
          <div className="space-y-2">
            {alertes.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-red-700">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <span>{a.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Offres à traiter" value={String(kpis.offres_a_traiter)} color="indigo" />
        <KpiCard label="Produits en ligne" value={String(kpis.produits_en_ligne)} color="green" />
        <KpiCard label="CA potentiel" value={formatEur(kpis.ca_potentiel)} color="blue" />
        <KpiCard label="Engagement" value={formatEur(kpis.engagement_potentiel)} color="amber" />
        <KpiCard label="Marge WAG moy." value={formatPct(kpis.marge_wag_moyenne)} color="emerald" />
        <KpiCard label="Taux accept. CO" value={formatPct(kpis.taux_acceptation_contre_offres)} color="purple" />
      </div>

      {/* Activité récente */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Activité récente</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {actions.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Aucune activité récente</div>
          )}
          {actions.map(a => (
            <div key={a.id} className="px-4 py-3 flex items-start gap-3">
              <ActionIcon type={a.type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">{a.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(a.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  const bgMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700',
    green: 'bg-green-50 text-green-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    purple: 'bg-purple-50 text-purple-700',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${bgMap[color]?.split(' ')[1] ?? 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function ActionIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    offre_recue: 'bg-blue-100 text-blue-600',
    traitement: 'bg-amber-100 text-amber-600',
    validation: 'bg-green-100 text-green-600',
    refus: 'bg-red-100 text-red-600',
    contre_offre: 'bg-orange-100 text-orange-600',
    prix_ajuste: 'bg-purple-100 text-purple-600',
    pmc_manquant: 'bg-orange-100 text-orange-600',
    info: 'bg-gray-100 text-gray-500',
  };
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${colors[type] ?? 'bg-gray-100 text-gray-500'}`}>
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5" />
      </svg>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Il y a ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `Il y a ${days}j`;
}
