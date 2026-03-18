import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DEMO_CATALOGUE, DEFAULT_PALLETISATION } from '@/app/lib/catalogue-data';
import type { CatalogueProduit, FluxType } from '@/app/lib/catalogue-data';

/** Mapping nom produit → vraie marque (quand marque = nom fournisseur) */
const BRAND_MAP: [RegExp, string][] = [
  [/^CAROLIN/i, 'Carolin'],
  [/^COLGATE/i, 'Colgate'],
  [/^CALV[EÉ]/i, 'Calvé'],
  [/^ELEPHANT/i, 'Elephant'],
  [/^LIPTON/i, 'Lipton'],
  [/^ORAL[\s-]?B/i, 'Oral-B'],
  [/^FA\s/i, 'Fa'],
  [/^MIR\s/i, 'Mir'],
  [/^WC\s?NET/i, 'WC Net'],
  [/^G[EÉ]NIE/i, 'Génie'],
  [/^OURAGAN/i, 'Ouragan'],
  [/^SIGNAL/i, 'Signal'],
  [/^NAIR/i, 'Nair'],
  [/^CHANTECLAIR/i, 'Chanteclair'],
  [/^KLEENEX/i, 'Kleenex'],
  [/^MAILLE/i, 'Maille'],
  [/^RIO\s?MARE/i, 'Rio Mare'],
  [/^WILLIAMS/i, 'Williams'],
  [/^ST[EÉ]RADENT/i, 'Stéradent'],
  [/^COBRA/i, 'Cobra'],
  [/^XTRA/i, 'Xtra'],
  [/^TERRA/i, 'Terra'],
  [/^VIGOR/i, 'Vigor'],
  [/^D[EÉ]COLOR\s?STOP/i, 'Décolor Stop'],
  [/^ZIP/i, 'Zip'],
  [/^SANOGYL/i, 'Sanogyl'],
  [/^BRASSES/i, 'Blédina'],
  [/^PETIT\s?NAVIRE/i, 'Petit Navire'],
  [/^BONDUELLE/i, 'Bonduelle'],
  [/^GERBL[EÉ]/i, 'Gerblé'],
  [/^TROPICANA/i, 'Tropicana'],
  [/^BL[EÉ]DINA/i, 'Blédina'],
  [/^PAMPERS/i, 'Pampers'],
  [/^LE\s?CHAT/i, 'Le Chat'],
  [/^LE\s?PETIT\s?MARSEILLAIS/i, 'Le Petit Marseillais'],
  [/^NATESSANCE/i, 'Natessance'],
  [/^PARMENTIER/i, 'Parmentier'],
];

const SUPPLIER_KEYWORDS = /trading|distribution|import|logistique|grossiste/i;

/** Extract real brand from product name when marque looks like a supplier */
function extractBrand(marque: string, nom: string): string {
  if (!SUPPLIER_KEYWORDS.test(marque)) return marque;
  for (const [regex, brand] of BRAND_MAP) {
    if (regex.test(nom)) return brand;
  }
  // Fallback: first word of product name in Title Case
  const firstWord = nom.trim().split(/\s+/)[0] || marque;
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
}

/** TVA par catégorie : 5.5% alimentaire, 20% non-alimentaire */
function tvaPourCategorie(cat: string): number {
  const lc = (cat || '').toLowerCase();
  if (lc.includes('épicerie') || lc.includes('boisson') || lc.includes('bébé') || lc.includes('animaux')) return 5.5;
  return 20;
}

/**
 * Mapping colonnes Supabase → CatalogueProduit.
 * Calcule le QMC selon le flux physique :
 *   stock_wag / transit → 1 carton (PCB)
 *   dropshipping → MAX(qmc_fournisseur, 1) palette
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSupabaseToCatalogue(row: any): CatalogueProduit {
  const flux: FluxType = row.flux || 'stock_wag';
  const pcb = parseInt(row.pcb, 10) || 1;
  const palletisation = parseInt(row.palletisation, 10) || DEFAULT_PALLETISATION;
  const qmcFourn = parseInt(row.qmc_fournisseur ?? row.qmc, 10) || 1;
  const stockDispo = parseInt(row.stock_disponible, 10) || 0;

  let min_commande: number;
  let min_commande_unite: 'carton' | 'palette';
  let min_cartons: number;
  let min_unites: number;

  if (flux === 'dropshipping') {
    const palettes = Math.max(qmcFourn, 1);
    const stockEnPalettes = Math.floor(stockDispo / (palletisation * pcb));
    if (stockEnPalettes < 1) {
      // Stock < 1 palette → tout le stock disponible en cartons
      min_commande_unite = 'carton';
      min_cartons = Math.max(1, Math.ceil(stockDispo / pcb));
      min_commande = min_cartons;
      min_unites = stockDispo;
    } else {
      min_commande = palettes;
      min_commande_unite = 'palette';
      min_cartons = palettes * palletisation;
      min_unites = min_cartons * pcb;
    }
  } else {
    // stock_wag ou transit → 1 carton
    min_commande = 1;
    min_commande_unite = 'carton';
    min_cartons = 1;
    min_unites = pcb;
  }

  return {
    id: row.id ?? '',
    nom: row.nom ?? '',
    marque: extractBrand(row.marque ?? '', row.nom ?? ''),
    photo_url: row.photo_url ?? null,
    photo_statut: row.photo_statut ?? 'non_trouvee',
    photo_source: row.photo_source ?? null,
    ean: row.ean ?? null,
    categorie: row.categorie ?? '',
    contenance: row.contenance ?? '',
    prix_wag_ht: parseFloat(row.prix_vente_wag_ht) || 0,
    prix_gd_ht: parseFloat(row.pmc_reference) || 0,
    remise_pct: parseFloat(row.remise_vs_gd) || 0,
    marge_retail_estimee: parseFloat(row.marge_retail_estimee) || 0,
    ddm: row.dluo ?? '',
    flux,
    pcb,
    palletisation,
    min_commande,
    min_commande_unite,
    min_cartons,
    min_unites,
    qmc_fournisseur: qmcFourn,
    fournisseur_nom: row.fournisseur_nom ?? null,
    stock_disponible: stockDispo,
    pmc_type: row.pmc_type ?? 'gd',
    tva_taux: parseFloat(row.tva_taux) || tvaPourCategorie(row.categorie ?? ''),
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
            const mapped = (data ?? []).map(r => ({ ...mapSupabaseToCatalogue(r), created_at: r.created_at }));
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
