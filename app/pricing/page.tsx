import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import PricingClient from './PricingClient'
import type { Produit } from './types'

export default async function PricingPage() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // Server Component read-only
        },
      },
    }
  )

  const { data: produits, error } = await supabase
    .from('produits')
    .select('*')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erreur fetch produits:', error)
  }

  return <PricingClient initialProduits={(produits ?? []) as Produit[]} />
}
