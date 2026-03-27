import { AuthGuard } from '../components/auth-guard'
import { supabaseAdmin } from '@/lib/supabase-admin'

export default async function HistoriquePage() {
  const { data: offres } = await supabaseAdmin
    .from('produits_offres')
    .select('*')
    .eq('statut', 'archivée')
    .order('created_at', { ascending: false })

  // Fetch archived products separately (no FK join needed)
  const { data: allProduits } = await supabaseAdmin
    .from('produits')
    .select('id, statut, prix_vente_wag_ht, prix_achat_wag_ht, stock_disponible, offre_id')
    .in('statut', ['valide', 'refuse', 'archive'])

  const stats = (offres ?? []).map(offre => {
    const prods = (allProduits ?? []).filter(p => p.offre_id === offre.id)
    const nb_valides = prods.filter(p => p.statut === 'valide').length
    const nb_refuses = prods.filter(p => p.statut === 'refuse').length
    const nb_archives = prods.filter(p => p.statut === 'archive').length
    const marge = prods
      .filter(p => p.statut === 'valide' && p.prix_vente_wag_ht && p.prix_achat_wag_ht && (p.stock_disponible ?? 0) > 0)
      .reduce((s: number, p: { prix_vente_wag_ht: number; prix_achat_wag_ht: number; stock_disponible: number }) =>
        s + (p.prix_vente_wag_ht - p.prix_achat_wag_ht) * p.stock_disponible, 0)
    const delai = offre.archived_at && offre.created_at
      ? Math.round((new Date(offre.archived_at).getTime() - new Date(offre.created_at).getTime()) / 86400000)
      : null
    return { ...offre, nb_valides, nb_refuses, nb_archives, marge, delai }
  })

  return (
    <AuthGuard>
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 500, margin: 0 }}>Historique</h1>
          <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '12px' }}>
            {stats.length} offre{stats.length > 1 ? 's' : ''} archivée{stats.length > 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Fournisseur', 'Importé le', 'Archivé le', 'Délai', '✓ Validés', '✗ Refusés', 'Archivés', 'Marge *'].map((col, i) => (
                  <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map((o, i) => (
                <tr key={o.id} style={{ borderTop: '0.5px solid #e5e7eb', background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500, color: '#111827' }}>{o.fournisseur_nom ?? o.source ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR') : '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{o.archived_at ? new Date(o.archived_at).toLocaleDateString('fr-FR') : '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{o.delai !== null ? `${o.delai}j` : '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#16a34a', fontWeight: 500 }}>{o.nb_valides}</td>
                  <td style={{ padding: '10px 12px', color: '#dc2626' }}>{o.nb_refuses}</td>
                  <td style={{ padding: '10px 12px', color: '#9ca3af' }}>{o.nb_archives}</td>
                  <td style={{ padding: '10px 12px', color: o.marge > 0 ? '#16a34a' : '#9ca3af' }}>
                    {o.marge > 0 ? `${o.marge.toFixed(0)} €` : 'N/D'}
                  </td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>Aucune offre archivée</td></tr>
              )}
            </tbody>
          </table>
          {stats.length > 0 && (
            <div style={{ padding: '8px 12px', fontSize: '11px', color: '#9ca3af', borderTop: '0.5px solid #e5e7eb' }}>
              * Marge calculée sur le stock actuel — peut être sous-estimée si produits déjà écoulés
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
