import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/app/pricing/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifySession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Tenter la mise à jour sur produits d'abord
  const allowedProduitFields = ['statut', 'prix_wag_ht', 'pmc', 'tva_taux'];
  const produitUpdates: Record<string, unknown> = {};
  for (const field of allowedProduitFields) {
    if (field in body) produitUpdates[field] = body[field];
  }
  // Mapper les anciens noms de champs
  if ('prix_vente_wag_ht' in body) produitUpdates.prix_wag_ht = body.prix_vente_wag_ht;
  if ('prix_achat_wag_ht' in body) produitUpdates.prix_achat_ht = body.prix_achat_wag_ht;

  if (Object.keys(produitUpdates).length > 0) {
    produitUpdates.updated_at = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('produits')
      .update(produitUpdates)
      .eq('id', id);

    if (!error) {
      return NextResponse.json({ success: true });
    }
  }

  // Si pas dans produits, tenter sur produits_offres
  const offreUpdates: Record<string, unknown> = {};
  if ('statut' in body) offreUpdates.statut = body.statut === 'valide' ? 'traitee' : body.statut;
  if ('note_operateur' in body) offreUpdates.note_operateur = body.note_operateur;
  if ('assigne_a' in body) offreUpdates.assigne_a = body.assigne_a;

  if (Object.keys(offreUpdates).length > 0) {
    offreUpdates.updated_at = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('produits_offres')
      .update(offreUpdates)
      .eq('id', id);

    if (error) {
      console.error('[produits PATCH] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
