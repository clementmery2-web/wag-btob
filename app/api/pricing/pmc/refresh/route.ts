import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySession } from '@/app/pricing/lib/auth';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const BATCH_SIZE = 10;

/**
 * POST /api/pricing/pmc/refresh
 * Batch refresh PMC for products by priority.
 * Processes up to 10 products per call to stay within Vercel timeouts.
 */
export async function POST(req: NextRequest) {
  const auth = await verifySession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const priorite = (body as { priorite?: string }).priorite ?? 'auto';

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

  let query = supabase.from('produits').select('id, ean, nom, marque, categorie, prix_achat_ht, prix_vente_wag_ht, contenance, pmc_reference, pmc_fiabilite, pmc_updated_at, pmc_statut, dluo');

  if (priorite === 'haute') {
    // Priority HIGH: pmc_fiabilite < 3 OR ddm < 60j OR pmc_updated > 3 days
    query = query.or(`pmc_fiabilite.lt.3,pmc_updated_at.lt.${threeDaysAgo},pmc_updated_at.is.null`);
  } else if (priorite === 'normale') {
    // Priority NORMAL: pmc_updated > 14 days
    query = query.or(`pmc_updated_at.lt.${fourteenDaysAgo},pmc_updated_at.is.null`);
  } else if (priorite === 'basse') {
    // Priority LOW: pmc_updated > 30 days AND fiabilite >= 4
    query = query.lt('pmc_updated_at', thirtyDaysAgo).gte('pmc_fiabilite', 4);
  } else {
    // Auto: high priority first, then normal
    query = query.or(`pmc_fiabilite.lt.3,pmc_updated_at.lt.${threeDaysAgo},pmc_updated_at.is.null`);
  }

  query = query.order('pmc_fiabilite', { ascending: true, nullsFirst: true }).limit(BATCH_SIZE);

  const { data: produits, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Erreur requête Supabase', details: error.message }, { status: 500 });
  }

  if (!produits || produits.length === 0) {
    return NextResponse.json({ processed: 0, message: 'Aucun produit à rafraîchir' });
  }

  // Call the PMC engine for each product
  const baseUrl = req.nextUrl.origin;
  const cookieHeader = req.headers.get('cookie') ?? '';
  const results: { id: string; pmc_statut: string; pmc_fiabilite: number }[] = [];

  for (const p of produits) {
    try {
      const res = await fetch(`${baseUrl}/api/pricing/pmc?id=${p.id}`, {
        headers: { cookie: cookieHeader },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        results.push({
          id: p.id,
          pmc_statut: data.pmc_statut,
          pmc_fiabilite: data.pmc_fiabilite,
        });
      }
    } catch {
      // Individual product failure shouldn't stop the batch
      results.push({ id: p.id, pmc_statut: 'erreur', pmc_fiabilite: 0 });
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
}
