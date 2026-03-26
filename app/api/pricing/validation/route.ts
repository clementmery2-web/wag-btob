import { NextResponse } from 'next/server'
import { verifySession } from '@/app/pricing/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const auth = await verifySession()
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('produits')
    .select('*')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ produits: data ?? [] })
}
