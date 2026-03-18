import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Categories that should check specialized databases
const HYGIENE_CATS = ['Hygiène & Beauté'];
const ENTRETIEN_CATS = ['Entretien'];

interface PhotoResult {
  photo_url: string | null;
  photo_statut: string;
  photo_source: string | null;
}

/** Search Open Food Facts for a product image by EAN */
async function searchOpenFoodFacts(ean: string): Promise<string | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${ean}.json`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === 1 && data.product?.image_front_url) {
      return data.product.image_front_url;
    }
  } catch { /* timeout or network error */ }
  return null;
}

/** Search Open Beauty Facts for a product image by EAN */
async function searchOpenBeautyFacts(ean: string): Promise<string | null> {
  try {
    const res = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${ean}.json`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === 1 && data.product?.image_front_url) {
      return data.product.image_front_url;
    }
  } catch { /* timeout or network error */ }
  return null;
}

/** Search Open Products Facts for a product image by EAN */
async function searchOpenProductsFacts(ean: string): Promise<string | null> {
  try {
    const res = await fetch(`https://world.openproductsfacts.org/api/v0/product/${ean}.json`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === 1 && data.product?.image_front_url) {
      return data.product.image_front_url;
    }
  } catch { /* timeout or network error */ }
  return null;
}

/** Search all relevant sources for a product photo */
async function findPhoto(ean: string, categorie: string): Promise<PhotoResult> {
  // Source 1: Open Food Facts (always try)
  const offUrl = await searchOpenFoodFacts(ean);
  if (offUrl) return { photo_url: offUrl, photo_statut: 'auto_trouvee', photo_source: 'off' };

  // Source 2: Open Beauty Facts (hygiene categories)
  if (HYGIENE_CATS.some(c => categorie.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(categorie.toLowerCase()))) {
    const obfUrl = await searchOpenBeautyFacts(ean);
    if (obfUrl) return { photo_url: obfUrl, photo_statut: 'auto_trouvee', photo_source: 'obf' };
  }

  // Source 3: Open Products Facts (entretien categories)
  if (ENTRETIEN_CATS.some(c => categorie.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(categorie.toLowerCase()))) {
    const opfUrl = await searchOpenProductsFacts(ean);
    if (opfUrl) return { photo_url: opfUrl, photo_statut: 'auto_trouvee', photo_source: 'opf' };
  }

  // Source 4: Fallback — no photo found
  return { photo_url: null, photo_statut: 'non_trouvee', photo_source: null };
}

/**
 * GET /api/pricing/photos
 * Returns all products with their photo status for the management page.
 * Optional ?statut= filter: auto_trouvee | validee | upload_manuel | non_trouvee
 */
export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 });
  }

  const statut = req.nextUrl.searchParams.get('statut');

  let query = supabase
    .from('produits')
    .select('id, nom, marque, ean, categorie, photo_url, photo_statut, photo_source, visible_catalogue')
    .order('created_at', { ascending: false });

  if (statut && statut !== 'tout') {
    query = query.eq('photo_statut', statut);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[photos] Erreur Supabase :', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Compute stats
  const all = data ?? [];
  const stats = {
    validees: all.filter(p => p.photo_statut === 'validee' || p.photo_statut === 'upload_manuel').length,
    a_verifier: all.filter(p => p.photo_statut === 'auto_trouvee').length,
    manquantes: all.filter(p => p.photo_statut === 'non_trouvee' || !p.photo_statut).length,
    total: all.length,
  };

  return NextResponse.json({ produits: all, stats });
}

/**
 * POST /api/pricing/photos
 * Actions:
 * - { action: 'search', product_id } → search photo for one product
 * - { action: 'search_all' } → search photos for all visible products without validated photo
 * - { action: 'validate', product_id } → mark photo as validated
 * - { action: 'reject', product_id } → reject photo, try next source or fallback
 * - { action: 'upload', product_id, photo_url } → set manually uploaded photo
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 });
  }

  const body = await req.json();
  const { action, product_id, photo_url } = body;

  if (action === 'validate') {
    const { error } = await supabase
      .from('produits')
      .update({ photo_statut: 'validee' })
      .eq('id', product_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'upload') {
    const { error } = await supabase
      .from('produits')
      .update({ photo_url, photo_statut: 'upload_manuel', photo_source: 'upload' })
      .eq('id', product_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'reject') {
    // Reset to non_trouvee — clear photo
    const { error } = await supabase
      .from('produits')
      .update({ photo_url: null, photo_statut: 'non_trouvee', photo_source: null })
      .eq('id', product_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'search') {
    // Fetch product details
    const { data: product, error: fetchError } = await supabase
      .from('produits')
      .select('id, ean, categorie')
      .eq('id', product_id)
      .single();
    if (fetchError || !product) {
      return NextResponse.json({ error: 'Produit non trouvé' }, { status: 404 });
    }
    if (!product.ean) {
      return NextResponse.json({ error: 'Pas de code EAN pour ce produit' }, { status: 400 });
    }

    const result = await findPhoto(product.ean, product.categorie ?? '');
    const { error: updateError } = await supabase
      .from('produits')
      .update(result)
      .eq('id', product_id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'search_all') {
    // Search for all visible products that don't have a validated photo
    const { data: products, error: fetchError } = await supabase
      .from('produits')
      .select('id, ean, categorie, photo_statut')
      .eq('visible_catalogue', true)
      .in('photo_statut', ['non_trouvee', ''])
      .not('ean', 'is', null);

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

    let found = 0;
    let notFound = 0;

    for (const product of products ?? []) {
      if (!product.ean) { notFound++; continue; }
      const result = await findPhoto(product.ean, product.categorie ?? '');
      await supabase.from('produits').update(result).eq('id', product.id);
      if (result.photo_statut === 'auto_trouvee') found++;
      else notFound++;
    }

    return NextResponse.json({ ok: true, searched: (products ?? []).length, found, notFound });
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
}
