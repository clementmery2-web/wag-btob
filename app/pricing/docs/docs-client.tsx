'use client';

export function DocsClient() {
  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Comment fonctionne le pricing WAG&nbsp;?</h1>
        <p className="text-base text-gray-500">Guide simple pour comprendre nos décisions de prix</p>
      </div>

      {/* Section 1 */}
      <Section title="Le principe en une phrase">
        <p className="text-base text-gray-700 leading-relaxed">
          On achète des produits que les fournisseurs veulent écouler rapidement,
          et on les revend à nos acheteurs BtoB avec une marge qui couvre nos frais et notre travail.
        </p>
      </Section>

      {/* Section 2 */}
      <Section title="D'où vient le prix de référence (PMC)&nbsp;?">
        <p className="text-base text-gray-700 leading-relaxed mb-4">
          Pour chaque produit, on cherche automatiquement son prix dans les grandes surfaces
          (Carrefour, Leclerc, Lidl…). Ce prix s&apos;appelle le <strong>PMC</strong> (Prix Marché de référence).
          C&apos;est notre boussole : on vend toujours bien en dessous de ce prix pour que nos acheteurs
          puissent faire de bonnes affaires.
        </p>
        <h4 className="text-sm font-bold text-gray-900 mb-2">Score de fiabilité</h4>
        <div className="space-y-1.5">
          <FiabRow stars={5} text="Prix trouvé sur 5+ sources → très fiable" />
          <FiabRow stars={3} text="Prix trouvé sur 2-3 sources → acceptable" />
          <FiabRow stars={1} text="Prix estimé automatiquement → à vérifier manuellement" />
        </div>
      </Section>

      {/* Section 3 */}
      <Section title="Les 4 situations possibles">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ScenarioCard
            color="green"
            letter="A"
            label="JACKPOT"
            condition="Prix achat < 20% du PMC"
            text="Le fournisseur vend très peu cher. On peut vendre à -60% du prix GD et faire une très bonne marge."
            action="Valider immédiatement."
          />
          <ScenarioCard
            color="yellow"
            letter="B"
            label="NORMAL"
            condition="Prix achat entre 20% et 43% du PMC"
            text="Cas standard. On vend entre -30% et -50% du prix GD, notre marge est correcte."
            action="Valider."
          />
          <ScenarioCard
            color="orange"
            letter="C"
            label="TENDU"
            condition="Prix achat entre 43% et 50% du PMC"
            text="Le prix du fournisseur est un peu trop élevé. On propose un prix plus bas."
            action="Contre-offre automatique."
          />
          <ScenarioCard
            color="red"
            letter="D"
            label="REFUS"
            condition="Prix achat > 50% du PMC"
            text="Même en achetant moins cher, nos acheteurs ne pourraient pas revendre à un prix attractif."
            action="Refus poli."
          />
        </div>
      </Section>

      {/* Section 4 */}
      <Section title="Notre marge">
        <SimpleTable
          headers={['Flux', 'Marge minimum']}
          rows={[
            ['Entrepôt WAG', '20%'],
            ['Dropshipping standard', '15%'],
            ['Dropshipping > 3 palettes', '10%'],
          ]}
        />
      </Section>

      {/* Section 5 */}
      <Section title="Les réductions de volume">
        <SimpleTable
          headers={['Quantité', 'Réduction']}
          rows={[
            ['1 carton', 'Prix standard'],
            ['3-5 cartons', '-3%'],
            ['6-11 cartons', '-5%'],
            ['1 palette (12+ cartons)', '-8%'],
            ['3 palettes ou plus', '-12%'],
          ]}
        />
      </Section>

      {/* Section 6 */}
      <Section title="La DDM et les prix">
        <p className="text-base text-gray-700 leading-relaxed mb-4">
          <strong>DDM</strong> = Date de Durabilité Minimale. Plus la DDM est proche,
          plus on baisse le prix pour vendre rapidement.
        </p>
        <SimpleTable
          headers={['DDM restante', 'Ajustement prix']}
          rows={[
            ['> 90 jours', 'Prix normal'],
            ['30-90 jours', '-17%'],
            ['15-30 jours', '-33%'],
            ['< 15 jours', '-48%'],
          ]}
        />
        <p className="text-sm text-gray-500 mt-3">
          Cette règle s&apos;applique uniquement aux produits dans notre entrepôt. Pas au dropshipping.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-lg font-bold text-gray-900 mb-3">{title}</h3>
      {children}
    </section>
  );
}

function FiabRow({ stars, text }: { stars: number; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-amber-500 w-20 flex-shrink-0">{'⭐'.repeat(stars)}</span>
      <span className="text-gray-600">{text}</span>
    </div>
  );
}

function ScenarioCard({ color, letter, label, condition, text, action }: {
  color: string; letter: string; label: string; condition: string; text: string; action: string;
}) {
  const colorMap: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', badge: 'bg-green-100' },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', badge: 'bg-yellow-100' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', badge: 'bg-orange-100' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', badge: 'bg-red-100' },
  };
  const c = colorMap[color];
  return (
    <div className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge} ${c.text}`}>{letter}</span>
        <span className={`text-sm font-bold ${c.text}`}>{label}</span>
      </div>
      <p className="text-xs text-gray-500 mb-2">{condition}</p>
      <p className="text-sm text-gray-700 mb-2">{text}</p>
      <p className={`text-xs font-semibold ${c.text}`}>→ {action}</p>
    </div>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-4 py-2.5 font-semibold text-gray-600">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-2.5 ${j === 0 ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
