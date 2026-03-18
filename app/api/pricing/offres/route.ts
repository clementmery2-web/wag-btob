import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySession } from '@/app/pricing/lib/auth';
import { DEMO_OFFRES } from '@/app/pricing/lib/demo-data';
import { calculerScoreUrgence, getPriorite } from '@/app/pricing/lib/types';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Build "virtual offres" by grouping products by fournisseur_nom.
 * Each unique fournisseur becomes an offre.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function groupByFournisseur(produits: any[]) {
  const groups = new Map<string, typeof produits>();

  for (const p of produits) {
    const key = p.fournisseur_nom || 'Inconnu';
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  return Array.from(groups.entries()).map(([fournisseur, items]) => {
    // Use a stable ID from fournisseur name
    const id = Buffer.from(fournisseur).toString('base64url');

    const ddms = items
      .map(p => p.dluo ?? p.ddm)
      .filter(Boolean)
      .sort();
    const ddmMin = ddms[0] ?? new Date().toISOString();

    const dateReception = items
      .map(p => p.created_at)
      .filter(Boolean)
      .sort()
      .reverse()[0] ?? new Date().toISOString();

    const valeur = items.reduce(
      (s: number, p: { prix_achat_ht?: string | number; stock_disponible?: string | number }) =>
        s + (parseFloat(String(p.prix_achat_ht ?? 0)) || 0) * (parseInt(String(p.stock_disponible ?? 0)) || 0),
      0
    );

    // Determine statut based on product statuses
    const statuses = items.map(p => p.statut).filter(Boolean);
    let statut: string = 'nouvelle';
    if (statuses.length > 0) {
      const allTraitees = statuses.every((s: string) => s === 'valide' || s === 'refuse' || s === 'contre_offre');
      const someTraitees = statuses.some((s: string) => s === 'valide' || s === 'refuse' || s === 'contre_offre');
      if (allTraitees) statut = 'traitee';
      else if (someTraitees) statut = 'en_cours';
    }

    const score = calculerScoreUrgence({
      ddm_min: ddmMin,
      valeur_estimee: valeur,
      date_reception: dateReception,
    });

    return {
      id,
      fournisseur,
      date_reception: dateReception,
      nb_produits: items.length,
      ddm_min: ddmMin,
      valeur_estimee: Math.round(valeur),
      statut,
      assigne_a: null,
      note_interne: '',
      score_urgence: Math.round(score),
      priorite: getPriorite(score),
      created_at: dateReception,
      updated_at: new Date().toISOString(),
    };
  });
}

export async function GET(req: NextRequest) {
  const auth = await verifySession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const statut = req.nextUrl.searchParams.get('statut');
  const urgence = req.nextUrl.searchParams.get('urgence');

  // Try Supabase
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('produits')
        .select('id, nom, marque, ean, categorie, contenance, stock_disponible, flux, dluo, prix_achat_ht, prix_vente_wag_ht, pmc_reference, pmc_type, pmc_fiabilite, pmc_statut, statut, fournisseur_nom, created_at, visible_catalogue')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        let offres = groupByFournisseur(data);

        if (statut) offres = offres.filter(o => o.statut === statut);
        if (urgence) offres = offres.filter(o => o.priorite === urgence);
        offres.sort((a, b) => b.score_urgence - a.score_urgence);

        return NextResponse.json({ offres, source: 'supabase' });
      }
    } catch (err) {
      console.error('[offres] Supabase error:', err);
    }
  }

  // Fallback demo
  let offres = [...DEMO_OFFRES];
  if (statut) offres = offres.filter(o => o.statut === statut);
  if (urgence) offres = offres.filter(o => o.priorite === urgence);
  offres.sort((a, b) => b.score_urgence - a.score_urgence);

  return NextResponse.json({ offres, source: 'demo' });
}
