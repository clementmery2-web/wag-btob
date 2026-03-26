import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { DEFAULT_PALLETISATION } from '@/app/lib/catalogue-data';
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

/** Safe parsers — never throw on null/undefined */
function safeFloat(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}
function safeInt(v: unknown): number {
  if (v == null) return 0;
  const n = parseInt(String(v), 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Mapping colonnes Supabase → CatalogueProduit.
 * Compatible avec l'ancien ET le nouveau schéma produits.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSupabaseToCatalogue(row: any): CatalogueProduit {
  const flux: FluxType = row.flux || 'stock_wag';
  const pcb = Math.max(1, safeInt(row.qmc) || safeInt(row.pcb) || 1);
  const palletisation = safeInt(row.palletisation) || DEFAULT_PALLETISATION;
  const qmcFourn = safeInt(row.qmc_fournisseur) || 1;
  const stockDispo = safeInt(row.stock_disponible) || 0;

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
    prix_wag_ht: safeFloat(row.prix_vente_wag_ht) || safeFloat(row.prix_wag_ht) || 0,
    prix_gd_ht: safeFloat(row.pmc_reference) || safeFloat(row.pmc_fournisseur) || 0,
    remise_pct: safeFloat(row.remise_vs_gd) || 0,
    marge_retail_estimee: safeFloat(row.marge_retail_estimee) || 0,
    ddm: row.dluo ?? row.ddm ?? '',
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
    tva_taux: safeFloat(row.tva_taux) || tvaPourCategorie(row.categorie ?? ''),
    prix_revente_conseille_ttc: safeFloat(row.prix_revente_conseille_ttc) || null,
  };
}

export async function GET(req: NextRequest) {
  const categorie = req.nextUrl.searchParams.get('categorie');

  // Supabase via supabaseAdmin (service role, bypasse RLS)
  try {
    let query = supabaseAdmin
      .from('produits')
      .select('*')
      .or('statut.eq.valide,visible_catalogue.eq.true')
      .order('created_at', { ascending: false })
      .limit(500);

    if (categorie && categorie !== 'Tout') {
      query = query.eq('categorie', categorie);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[catalogue] Erreur Supabase :', error.message);
      return NextResponse.json({ produits: [], source: 'supabase', error: error.message });
    }

    if (data && data[0]) {
      const r = data[0];
      console.log('[catalogue] RAW first row prix columns:', {
        prix_vente_wag_ht: r.prix_vente_wag_ht,
        prix_wag_ht: r.prix_wag_ht,
        prix_achat_wag_ht: r.prix_achat_wag_ht,
        type_prix_vente: typeof r.prix_vente_wag_ht,
        all_keys: Object.keys(r).filter(k => k.includes('prix')).join(', '),
      });
    }
    const mapped = (data ?? []).map(r => {
      try {
        const m = mapSupabaseToCatalogue(r);
        const prixVente = safeFloat(r.prix_vente_wag_ht) || safeFloat(r.prix_wag_ht) || 0;
        return { ...m, plancher_ht: prixVente, created_at: r.created_at };
      } catch (e) {
        console.error('[catalogue] Erreur mapping produit:', r.id, e);
        return null;
      }
    }).filter(Boolean);
    console.log('[catalogue] Retourne', mapped.length, 'produits, premier prix_wag_ht:', mapped[0] && 'prix_wag_ht' in mapped[0] ? (mapped[0] as Record<string, unknown>).prix_wag_ht : 'N/A');
    return NextResponse.json({ produits: mapped, source: 'supabase' });
  } catch (err) {
    console.error('[catalogue] Exception Supabase :', err instanceof Error ? err.message : err);
    return NextResponse.json({ produits: [], source: 'error' });
  }
}
