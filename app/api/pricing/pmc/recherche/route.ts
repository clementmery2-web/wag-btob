import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function verifySessionCookie(): boolean {
  try {
    const cookieStore = cookies();
    const session = cookieStore.get('wag_pricing_session');
    if (!session?.value) return false;
    const decoded = JSON.parse(Buffer.from(session.value, 'base64').toString('utf-8'));
    return decoded.expires > Date.now();
  } catch {
    return false;
  }
}

export async function GET() {
  if (!verifySessionCookie()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('produits')
    .select('id, ean, nom, marque, tva_taux, prix_achat_wag_ht, dluo, flux')
    .or('pmc_statut.is.null,pmc_statut.eq.manuel_requis')
    .order('ean');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ produits: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!verifySessionCookie()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 500 });
  }

  const body = await request.json();
  const pmcs: Array<{
    ean: string;
    pmc_leclerc: number | null;
    pmc_carrefour: number | null;
    pmc_auchan: number | null;
    pmc_intermarche: number | null;
    pmc_lidl: number | null;
    pmc_concurrent_antigaspi: number | null;
    pmc_grossiste: number | null;
    pmc_retenu: number | null;
    pmc_ht: number | null;
    source_niveau: string;
    source_url: string;
    flag_anomalie: boolean;
    k_dluo: number;
    scenario: string | null;
    prix_vente_wag_ht: number | null;
    prix_revente_conseille_ttc: number | null;
  }> = body.pmcs ?? [];

  let totalUpdated = 0;
  let totalInserted = 0;

  for (const pmc of pmcs) {
    // Find all product rows with this EAN
    const { data: rows } = await supabase
      .from('produits')
      .select('id')
      .eq('ean', pmc.ean);

    if (!rows || rows.length === 0) continue;

    // Insert pmc_historique for each product row
    for (const row of rows) {
      const { error: insertError } = await supabase.from('pmc_historique').insert({
        produit_id: row.id,
        date: new Date().toISOString(),
        pmc_carrefour: pmc.pmc_carrefour,
        pmc_leclerc: pmc.pmc_leclerc,
        pmc_lidl: pmc.pmc_lidl,
        pmc_auchan: pmc.pmc_auchan,
        pmc_intermarche: pmc.pmc_intermarche,
        pmc_concurrent_antigaspi: pmc.pmc_concurrent_antigaspi,
        pmc_grossiste: pmc.pmc_grossiste,
        pmc_retenu: pmc.pmc_retenu,
        source_niveau: pmc.source_niveau,
        flag_anomalie: pmc.flag_anomalie,
      });
      if (!insertError) totalInserted++;
    }

    // Update all produits with this EAN
    const { count } = await supabase
      .from('produits')
      .update({
        pmc_ttc_gd: pmc.pmc_retenu,
        pmc_ttc_discount: pmc.pmc_lidl,
        pmc_ttc_antigaspi: pmc.pmc_concurrent_antigaspi,
        pmc_ttc_grossiste: pmc.pmc_grossiste,
        pmc_ht: pmc.pmc_ht,
        pmc_statut: 'valide',
        pmc_fiabilite: pmc.source_niveau,
        pmc_source_niveau: pmc.source_niveau,
        pmc_reference: pmc.source_url,
        pmc_updated_at: new Date().toISOString(),
        k_dluo: pmc.k_dluo,
        scenario: pmc.scenario,
        prix_vente_wag_ht: pmc.prix_vente_wag_ht,
        prix_revente_conseille_ttc: pmc.prix_revente_conseille_ttc,
      })
      .eq('ean', pmc.ean);

    totalUpdated += count ?? rows.length;
  }

  return NextResponse.json({ updated: totalUpdated, inserted: totalInserted });
}
