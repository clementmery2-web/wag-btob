import { AuthGuard } from '../components/auth-guard'
import { supabaseAdmin } from '@/lib/supabase-admin'
import PricingClient from '../PricingClient'
import type { Produit } from '../types'

export default async function ValidationPricingPage() {
  const [{ data: produits }, { data: offres }] = await Promise.all([
    supabaseAdmin
      .from('produits')
      .select('*')
      .eq('statut', 'en_attente')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('produits_offres')
      .select('id, source, assigned_to')
      .neq('statut_traitement', 'archivée'),
  ])

  const assigneParFournisseur: Record<string, string | null> = {}
  const offreIdParFournisseur: Record<string, string> = {}
  for (const offre of offres ?? []) {
    if (offre.source) {
      assigneParFournisseur[offre.source] = offre.assigned_to ?? null
      offreIdParFournisseur[offre.source] = offre.id
    }
  }

  return (
    <AuthGuard>
      <PricingClient
        initialProduits={(produits ?? []) as Produit[]}
        assigneParFournisseur={assigneParFournisseur}
        offreIdParFournisseur={offreIdParFournisseur}
      />
    </AuthGuard>
  )
}
