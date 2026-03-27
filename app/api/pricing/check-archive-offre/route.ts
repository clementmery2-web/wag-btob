import { NextResponse, NextRequest } from 'next/server'
import { verifySession } from '@/app/pricing/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const auth = await verifySession()
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { offreId, force } = await req.json()
    if (!offreId) return NextResponse.json({ error: 'offreId requis' }, { status: 400 })

    if (!force) {
      const { data: produitsActifs, error: queryError } = await supabaseAdmin
        .from('produits')
        .select('id')
        .eq('offre_id', offreId)
        .in('statut', ['en_attente', 'en_nego', 'nego_fournisseur'])

      if (queryError) {
        console.error('[check-archive-offre]', queryError.message)
        return NextResponse.json({ error: queryError.message }, { status: 500 })
      }

      if (produitsActifs && produitsActifs.length > 0) {
        return NextResponse.json({ archived: false, remaining: produitsActifs.length })
      }
    }

    // Archive orphan products
    const { error: err1 } = await supabaseAdmin
      .from('produits')
      .update({ statut: 'archive', archived_at: new Date().toISOString() })
      .eq('offre_id', offreId)
      .in('statut', ['en_attente', 'en_nego', 'nego_fournisseur'])

    if (err1) {
      console.error('[check-archive-offre] produits:', err1.message)
      return NextResponse.json({ error: err1.message }, { status: 500 })
    }

    // Archive the offre itself
    const { error: err2 } = await supabaseAdmin
      .from('produits_offres')
      .update({ statut_traitement: 'archivée', archived_at: new Date().toISOString() })
      .eq('id', offreId)

    if (err2) {
      console.error('[check-archive-offre] offre:', err2.message)
      return NextResponse.json({ error: err2.message }, { status: 500 })
    }

    return NextResponse.json({ archived: true })
  } catch (err) {
    console.error('[check-archive-offre]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
