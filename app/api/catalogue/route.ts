import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DEMO_CATALOGUE } from '@/app/lib/catalogue-data';
import type { CatalogueProduit } from '@/app/lib/catalogue-data';

/**
 * Mapping colonnes Supabase → CatalogueProduit.
 * Supabase :  prix_vente_wag_ht, pmc_reference, remise_vs_gd, dluo, qmc
 * Interface : prix_wag_ht, prix_gd_ht, remise_pct, ddm, min_commande
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSupabaseToCatalogue(row: any): CatalogueProduit {
  return {
    id: row.id ?? '',
    nom: row.nom ?? '',
    marque: row.marque ?? '',
    photo_url: row.photo_url ?? null,
    categorie: row.categorie ?? '',
    contenance: row.contenance ?? '',
    prix_wag_ht: parseFloat(row.prix_vente_wag_ht) || 0,
    prix_gd_ht: parseFloat(row.pmc_reference) || 0,
    remise_pct: parseFloat(row.remise_vs_gd) || 0,
    marge_retail_estimee: parseFloat(row.marge_retail_estimee) || 0,
    ddm: row.dluo ?? '',
    min_commande: parseInt(row.qmc, 10) || 1,
    min_commande_unite: row.min_commande_unite ?? 'carton',
    stock_disponible: parseInt(row.stock_disponible, 10) || 0,
    pmc_type: row.pmc_type ?? 'gd',
  };
}

export async function GET(req: NextRequest) {
  const categorie = req.nextUrl.searchParams.get('categorie');

  // Try Supabase first
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key) {
    try {
      console.log('[catalogue] Connexion Supabase :', url);
      const supabase = createClient(url, key);

      // First: check if table exists and has any visible products at all
      const { count, error: countError } = await supabase
        .from('produits')
        .select('*', { count: 'exact', head: true })
        .eq('visible_catalogue', true);

      if (countError) {
        console.error('[catalogue] Erreur Supabase (count) :', countError.message, countError.code, countError.details);
        // Fall through to demo
      } else {
        console.log('[catalogue] Produits visible_catalogue=true dans Supabase :', count);

        if (count && count > 0) {
          // Supabase has data — query with optional category filter
          let query = supabase
            .from('produits')
            .select('*')
            .eq('visible_catalogue', true)
            .order('created_at', { ascending: false });

          if (categorie && categorie !== 'Tout') {
            query = query.eq('categorie', categorie);
          }

          const { data, error } = await query;

          if (error) {
            console.error('[catalogue] Erreur Supabase (query) :', error.message, error.code, error.details);
          } else {
            console.log('[catalogue] Supabase retourne', data?.length ?? 0, 'produits');
            if (data && data.length > 0) {
              console.log('[catalogue] Colonnes premier produit :', Object.keys(data[0]).join(', '));
            }
            const mapped = (data ?? []).map(mapSupabaseToCatalogue);
            return NextResponse.json({ produits: mapped, source: 'supabase' });
          }
        } else {
          console.log('[catalogue] Supabase OK mais 0 produits visible_catalogue=true — fallback démo');
        }
      }
    } catch (err) {
      console.error('[catalogue] Exception Supabase :', err instanceof Error ? err.message : err);
    }
  } else {
    console.log('[catalogue] Variables Supabase manquantes — NEXT_PUBLIC_SUPABASE_URL:', !!url, 'NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!key);
  }

  // Fallback to demo data
  console.log('[catalogue] Utilisation des données de démo');
  let produits = [...DEMO_CATALOGUE];
  if (categorie && categorie !== 'Tout') {
    produits = produits.filter(p => p.categorie === categorie);
  }

  return NextResponse.json({ produits, source: 'demo' });
}
