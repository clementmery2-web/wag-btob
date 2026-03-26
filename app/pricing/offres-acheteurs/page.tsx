import { supabaseAdmin } from '@/lib/supabase-admin'
import { AuthGuard } from '../components/auth-guard'
import { OffresAcheteursClient } from './OffresAcheteursClient'

export default async function Page() {
  const { data: offres } = await supabaseAdmin
    .from('offres_acheteurs')
    .select(`
      *,
      produits (
        nom,
        stock_disponible,
        prix_vente_wag_ht
      )
    `)
    .eq('statut', 'en_attente')
    .order('prix_offre_ht', { ascending: false })

  return (
    <AuthGuard>
      <OffresAcheteursClient offres={offres ?? []} />
    </AuthGuard>
  )
}
