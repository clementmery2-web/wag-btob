import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySession } from '@/app/pricing/lib/auth';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifySession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 });
  }

  const body = await req.json();
  const allowedFields = ['statut', 'prix_vente_wag_ht', 'pmc_ttc_gd', 'pmc_ht', 'pmc_statut', 'k_dluo', 'scenario', 'prix_achat_wag_ht'];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('produits')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('[produits PATCH] Supabase error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
