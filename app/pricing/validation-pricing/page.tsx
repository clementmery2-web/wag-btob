import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { AuthGuard } from '../components/auth-guard'
import PricingClient from '../PricingClient'
import type { Produit } from '../types'

export default async function ValidationPricingPage() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {}
      }
    }
  )

  const { data: produits } = await supabase
    .from('produits')
    .select('*')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: false })

  return (
    <AuthGuard>
      <PricingClient initialProduits={(produits ?? []) as Produit[]} />
    </AuthGuard>
  )
}
