import { supabaseAdmin } from '@/lib/supabase-admin'
import { AuthGuard } from '../components/auth-guard'
import ProduitsEnLigneClient from './ProduitsEnLigneClient'

async function getProduitsEnLigne() {
  try {
    const { data, error } = await supabaseAdmin
      .from('produits')
      .select('id, nom, dluo, stock_disponible, prix_vente_wag_ht, fournisseur_nom, qmc')
      .eq('statut', 'valide')
      .eq('visible_catalogue', true)
      .not('prix_vente_wag_ht', 'is', null)
      .order('dluo', { ascending: true })

    if (error) {
      console.error('[produits-en-ligne] error:', error.message)
      return { produits: [], error: error.message }
    }
    return { produits: data ?? [], error: null }
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

        <ProduitsEnLigneClient produits={produits} />
      </div>
    </AuthGuard>
  )
}
