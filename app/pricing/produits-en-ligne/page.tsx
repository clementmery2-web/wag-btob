import { supabaseAdmin } from '@/lib/supabase-admin'
import { AuthGuard } from '../components/auth-guard'

interface ProduitEnLigne {
  id: string
  nom: string
  dluo?: string | null
  stock_disponible?: number | null
  prix_vente_wag_ht?: number | null
  fournisseur_nom?: string | null
  pcb?: number | null
}

const formatDate = (d?: string | null): string => {
  if (!d) return '—'
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('fr-FR')
}

async function getProduitsEnLigne(): Promise<{ produits: ProduitEnLigne[]; error: string | null }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('produits')
      .select('id, nom, dluo, stock_disponible, prix_vente_wag_ht, fournisseur_nom, pcb')
      .eq('statut', 'valide')
      .eq('visible_catalogue', true)
      .not('prix_vente_wag_ht', 'is', null)
      .order('dluo', { ascending: true })

    if (error) {
      console.error('[produits-en-ligne] error:', error.message)
      return { produits: [], error: error.message }
    }
    return { produits: (data ?? []) as ProduitEnLigne[], error: null }
  } catch (err) {
    console.error('[produits-en-ligne] crash:', err)
    return { produits: [], error: 'Erreur inattendue' }
  }
}

export default async function ProduitsEnLignePage() {
  const { produits, error } = await getProduitsEnLigne()

  return (
    <AuthGuard>
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 500, margin: 0, color: '#111827' }}>
            Produits en ligne
          </h1>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            {produits.length} référence{produits.length > 1 ? 's' : ''} visibles par les acheteurs
          </span>
          <a href="/" target="_blank" rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: '12px', color: '#16a34a', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Voir le catalogue acheteur
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <path d="M7 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M10 2h4v4M14 2L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </a>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', border: '0.5px solid #fca5a5', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#991b1b' }}>
            Erreur de chargement — {error}
          </div>
        )}

        <div style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ width: '30%', padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase' }}>Produit</th>
                <th style={{ width: '10%', padding: '10px 8px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase' }}>DDM</th>
                <th style={{ width: '12%', padding: '10px 8px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase' }}>Stock</th>
                <th style={{ width: '12%', padding: '10px 8px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase' }}>Plancher HT</th>
                <th style={{ width: '10%', padding: '10px 8px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase' }}>PCB</th>
                <th style={{ width: '26%', padding: '10px 8px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase' }}>Fournisseur</th>
              </tr>
            </thead>
            <tbody>
              {produits.map((p, i) => (
                <tr key={p.id} style={{
                  borderTop: '0.5px solid #e5e7eb',
                  background: i % 2 === 0 ? 'white' : '#f9fafb'
                }}>
                  <td style={{ padding: '10px 16px', fontWeight: 500, color: '#111827' }}>{p.nom}</td>
                  <td style={{ padding: '10px 8px', color: '#6b7280' }}>{formatDate(p.dluo)}</td>
                  <td style={{ padding: '10px 8px', color: '#111827' }}>
                    {p.stock_disponible != null ? `${p.stock_disponible} ctn` : '—'}
                  </td>
                  <td style={{ padding: '10px 8px', fontWeight: 500, color: '#16a34a' }}>
                    {p.prix_vente_wag_ht != null ? `${Number(p.prix_vente_wag_ht).toFixed(2)} €` : '—'}
                  </td>
                  <td style={{ padding: '10px 8px', color: '#6b7280' }}>
                    {p.pcb ?? '—'}
                  </td>
                  <td style={{ padding: '10px 8px', color: '#6b7280' }}>
                    {p.fournisseur_nom ?? '—'}
                  </td>
                </tr>
              ))}
              {produits.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                    Aucun produit en ligne pour le moment
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AuthGuard>
  )
}
