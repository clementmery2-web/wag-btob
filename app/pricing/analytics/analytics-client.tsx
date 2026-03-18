'use client';
import { DEMO_OFFRES } from '../lib/demo-data';
import { formatPct } from '../lib/types';

export function AnalyticsClient() {
  const tousLesProduits = DEMO_OFFRES.flatMap(o => o.produits);
  const scenarioA = tousLesProduits.filter(p => p.scenario === 'A').length;
  const scenarioB = tousLesProduits.filter(p => p.scenario === 'B').length;
  const scenarioC = tousLesProduits.filter(p => p.scenario === 'C').length;
  const scenarioD = tousLesProduits.filter(p => p.scenario === 'D').length;
  const total = tousLesProduits.length;

  const fournisseurs = DEMO_OFFRES.map(o => ({
    nom: o.fournisseur,
    produits: o.nb_produits,
    valeur: o.valeur_estimee,
  })).sort((a, b) => b.valeur - a.valeur);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

      {/* KPIs performance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Taux accept. CO" value="42%" target="> 40%" ok />
        <MetricCard label="Marge WAG réalisée" value="24.3%" target="vs 22% prévu" ok />
        <MetricCard label="Délai moy. traitement" value="1h45" target="< 2h" ok />
        <MetricCard label="Délai moy. réponse fourn." value="18h" target="< 24h" ok />
      </div>

      {/* Répartition scénarios */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Répartition scénarios A/B/C/D</h3>
        <div className="space-y-3">
          <ScenarioBar label="🟢 A — JACKPOT" count={scenarioA} total={total} color="bg-green-500" />
          <ScenarioBar label="🟡 B — NORMAL" count={scenarioB} total={total} color="bg-yellow-400" />
          <ScenarioBar label="🟠 C — CONTRE-OFFRE" count={scenarioC} total={total} color="bg-orange-400" />
          <ScenarioBar label="🔴 D — REFUS" count={scenarioD} total={total} color="bg-red-500" />
        </div>
      </div>

      {/* Évolution marge (simulée) */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Évolution marge WAG — 30 derniers jours</h3>
        <div className="flex items-end gap-1 h-32">
          {Array.from({ length: 30 }, (_, i) => {
            const h = 30 + Math.sin(i * 0.5) * 15 + Math.random() * 20;
            return (
              <div
                key={i}
                className="flex-1 bg-indigo-400 hover:bg-indigo-500 rounded-t transition-colors"
                style={{ height: `${h}%` }}
                title={`Jour ${i + 1} : ${h.toFixed(0)}%`}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span>Il y a 30j</span>
          <span>Aujourd&apos;hui</span>
        </div>
      </div>

      {/* Top fournisseurs */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Top fournisseurs par volume</h3>
        <div className="space-y-2">
          {fournisseurs.map((f, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                <span className="text-sm font-medium text-gray-900">{f.nom}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium text-gray-700">{f.produits} produits</span>
                <span className="text-xs text-gray-400 ml-2">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(f.valeur)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights prédictifs */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Insights prédictifs</h3>
        <div className="space-y-3">
          <InsightRow
            label="Fournisseurs sans offre depuis > 30j"
            action="Relancer"
            type="warning"
          />
          <InsightRow
            label="3 produits en ligne depuis > 14j non vendus"
            action="Revoir le prix ?"
            type="info"
          />
        </div>
      </div>

      {/* Benchmark */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Benchmark concurrentiel</h3>
        <p className="text-sm text-gray-500 mb-3">Prix WAG vs concurrents anti-gaspi sur produits communs</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 pr-4 font-medium text-gray-500">Produit</th>
                <th className="text-right py-2 px-3 font-medium text-indigo-600">WAG</th>
                <th className="text-right py-2 px-3 font-medium text-gray-400">Concurrent A</th>
                <th className="text-right py-2 px-3 font-medium text-gray-400">Concurrent B</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-2 pr-4 text-gray-700">Thon albacore 200g</td>
                <td className="py-2 px-3 text-right font-semibold text-indigo-600">1,25€</td>
                <td className="py-2 px-3 text-right text-gray-500">1,45€</td>
                <td className="py-2 px-3 text-right text-gray-500">1,35€</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-gray-700">Haricots verts 800g</td>
                <td className="py-2 px-3 text-right font-semibold text-indigo-600">0,89€</td>
                <td className="py-2 px-3 text-right text-gray-500">0,95€</td>
                <td className="py-2 px-3 text-right text-gray-500">1,10€</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-gray-700">Biscuits sésame 230g</td>
                <td className="py-2 px-3 text-right font-semibold text-indigo-600">1,15€</td>
                <td className="py-2 px-3 text-right text-gray-500">—</td>
                <td className="py-2 px-3 text-right text-gray-500">1,30€</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, target, ok }: { label: string; value: string; target: string; ok: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className={`text-xs mt-1 ${ok ? 'text-green-600' : 'text-red-600'}`}>
        {ok ? '✓' : '✗'} {target}
      </p>
    </div>
  );
}

function ScenarioBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-gray-700 w-40 flex-shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-600 w-16 text-right">{count} ({formatPct(pct)})</span>
    </div>
  );
}

function InsightRow({ label, action, type }: { label: string; action: string; type: 'warning' | 'info' }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg ${type === 'warning' ? 'bg-amber-50' : 'bg-blue-50'}`}>
      <p className={`text-sm ${type === 'warning' ? 'text-amber-700' : 'text-blue-700'}`}>{label}</p>
      <button className={`text-xs font-medium px-3 py-1 rounded-md ${
        type === 'warning' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
      }`}>
        {action}
      </button>
    </div>
  );
}
