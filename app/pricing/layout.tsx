import { supabaseAdmin } from '@/lib/supabase-admin'
import NavBar from './components/NavBar'

export const metadata = { title: 'WAG Pricing — Back-office' }

export default async function PricingLayout({ children }: { children: React.ReactNode }) {
  const [
    { count: nbValider },
    { count: nbLigne },
    { count: nbOffresAcheteurs },
    { count: nbMercuriales },
  ] = await Promise.all([
    supabaseAdmin.from('produits').select('*', { count: 'exact', head: true }).eq('statut', 'en_attente'),
    supabaseAdmin.from('produits').select('*', { count: 'exact', head: true }).eq('statut', 'valide'),
    supabaseAdmin.from('offres_acheteurs').select('*', { count: 'exact', head: true }).eq('statut', 'en_attente'),
    supabaseAdmin.from('produits_offres').select('*', { count: 'exact', head: true }).in('statut_traitement', ['nouvelle', 'en_cours']),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        nbMercuriales={nbMercuriales ?? 0}
        nbProduitsValider={nbValider ?? 0}
        nbProduitsLigne={nbLigne ?? 0}
        nbOffresAcheteurs={nbOffresAcheteurs ?? 0}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  )
}
