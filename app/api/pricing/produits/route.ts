import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/app/pricing/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { calculerScenario, calculerPrixVenteWag, calculerMargeWag, calculerRemiseVsGd, getRemiseLabel } from '@/app/pricing/lib/types';

/**
 * Map a Supabase produit row to the back-office Produit format.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToBackofficeProduit(row: any) {
  const prixAchat = parseFloat(row.prix_achat_ht) || 0;
  const prixWag = parseFloat(row.prix_wag_ht) || 0;
  const pmc = parseFloat(row.pmc) || null;
  const tvaTaux = parseFloat(row.tva_taux) || 5.5;
  const flux = row.flux || 'dropshipping';

  const prixVente = prixWag > 0 ? prixWag : (prixAchat > 0 ? calculerPrixVenteWag(prixAchat, flux) : 0);
  const scenario = pmc && pmc > 0 && prixAchat > 0 ? calculerScenario(prixAchat, pmc) : null;
  const margeWag = prixVente > 0 ? calculerMargeWag(prixAchat, prixVente) : null;
  const remiseGd = pmc && pmc > 0 ? calculerRemiseVsGd(prixVente, pmc) : 0;

  return {
    id: row.id,
    offre_id: row.fournisseur_id ?? '',
    nom: row.nom ?? '',
    marque: row.marque ?? '',
    ean: row.ean ?? '',
    contenance: '',
    stock_disponible: parseInt(row.quantite_disponible) || 0,
    flux,
    ddm: row.ddm ?? '',
    etat: 'intact',
    photo_url: null,
    categorie: row.categorie ?? '',
    prix_achat_wag_ht: prixAchat,
    pmc_ht: pmc,
    pmc_reference: pmc,
    pmc_ttc_gd: pmc ? pmc * (1 + tvaTaux / 100) : null,
    tva_taux: tvaTaux,
    pmc_fiabilite: 0,
    pmc_statut: pmc ? 'valide' : 'non_trouve',
    prix_vente_wag_ht: prixVente,
    marge_wag_pct: margeWag,
    remise_vs_gd_pct: remiseGd,
    remise_label: pmc ? getRemiseLabel('gd', remiseGd) : '',
    scenario,
    statut: row.statut ?? 'a_traiter',
    note_interne: '',
    fournisseur_id: row.fournisseur_id ?? null,
    visible_catalogue: row.statut === 'en_ligne',
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
  };
}

export async function GET(req: NextRequest) {
  const auth = await verifySession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const offreId = req.nextUrl.searchParams.get('offre_id');
  const produitId = req.nextUrl.searchParams.get('id');
  const fournisseur = req.nextUrl.searchParams.get('fournisseur');

  // Si offre_id fourni, chercher l'offre dans produits_offres
  // puis les produits liés via fournisseur_id
  if (offreId) {
    // D'abord récupérer l'offre
    const { data: offre } = await supabaseAdmin
      .from('produits_offres')
      .select('*')
      .eq('id', offreId)
      .single();

    if (offre?.fournisseur_id) {
      // Chercher les produits du même fournisseur
      const { data: produits } = await supabaseAdmin
        .from('produits')
        .select('*')
        .eq('fournisseur_id', offre.fournisseur_id)
        .order('created_at', { ascending: false });

      if (produits && produits.length > 0) {
        const enriched = produits.map(mapToBackofficeProduit);
        return NextResponse.json({
          produits: enriched,
          fournisseur_nom: offre.fournisseur_nom,
          source: 'supabase',
        });
      }
    }

    // Pas de produits liés — renvoyer un produit virtuel depuis l'offre
    if (offre) {
      return NextResponse.json({
        produits: [{
          id: offre.id,
          offre_id: offre.id,
          nom: `Offre ${offre.fournisseur_nom ?? 'fournisseur'}`,
          marque: offre.fournisseur_nom ?? '-',
          ean: '',
          contenance: '',
          stock_disponible: 0,
          flux: 'dropshipping',
          ddm: offre.ddm_min ?? '',
          etat: 'intact',
          photo_url: null,
          categorie: '',
          prix_achat_wag_ht: 0,
          pmc_ht: offre.pmc ?? null,
          pmc_reference: offre.pmc ?? null,
          pmc_ttc_gd: null,
          tva_taux: 5.5,
          pmc_fiabilite: 0,
          pmc_statut: 'non_trouve',
          prix_vente_wag_ht: 0,
          marge_wag_pct: null,
          remise_vs_gd_pct: null,
          remise_label: '',
          scenario: null,
          statut: offre.statut ?? 'a_traiter',
          note_interne: offre.note_operateur ?? '',
          fournisseur_id: offre.fournisseur_id ?? null,
          fournisseur_nom: offre.fournisseur_nom ?? '',
          visible_catalogue: false,
          created_at: offre.created_at ?? '',
          updated_at: offre.updated_at ?? '',
        }],
        fournisseur_nom: offre.fournisseur_nom,
        source: 'supabase',
      });
    }

    return NextResponse.json({ produits: [], source: 'supabase' });
  }

  // Requête standard sur produits
  let query = supabaseAdmin.from('produits').select('*');

  if (produitId) {
    query = query.eq('id', produitId);
  } else if (fournisseur) {
    query = query.eq('fournisseur_id', fournisseur);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('[produits] Supabase error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enriched = (data ?? []).map(mapToBackofficeProduit);
  return NextResponse.json({ produits: enriched, source: 'supabase' });
}
