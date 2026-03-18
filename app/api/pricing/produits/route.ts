import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySession } from '@/app/pricing/lib/auth';
import { DEMO_OFFRES } from '@/app/pricing/lib/demo-data';
import { calculerScenario, calculerPrixVenteWag, calculerMargeWag, calculerRemiseVsGd, getRemiseLabel } from '@/app/pricing/lib/types';
import type { PmcType, PmcSource } from '@/app/pricing/lib/types';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Map a Supabase produit row to the back-office Produit format.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToBackofficeProduit(row: any) {
  const prixAchat = parseFloat(row.prix_achat_ht) || 0;
  const pmcHt = parseFloat(row.pmc_reference) || null;
  const flux = row.flux || 'entrepot';
  const pmcType: PmcType = row.pmc_type || 'gd';
  const pmcFiabilite = parseInt(row.pmc_fiabilite) || 0;

  const prixVente = parseFloat(row.prix_vente_wag_ht) || (prixAchat > 0 ? calculerPrixVenteWag(prixAchat, flux) : 0);
  const scenario = pmcHt && pmcHt > 0 && prixAchat > 0 ? calculerScenario(prixAchat, pmcHt) : null;
  const margeWag = prixVente > 0 ? calculerMargeWag(prixAchat, prixVente) : null;
  const remiseGd = pmcHt && pmcHt > 0 ? calculerRemiseVsGd(prixVente, pmcHt) : 0;

  // Build PMC sources from Supabase JSON field or empty array
  let pmcSources: PmcSource[] = [];
  if (row.pmc_sources) {
    try {
      pmcSources = typeof row.pmc_sources === 'string' ? JSON.parse(row.pmc_sources) : row.pmc_sources;
    } catch { /* ignore */ }
  }

  return {
    id: row.id,
    offre_id: row.fournisseur_nom ? Buffer.from(row.fournisseur_nom).toString('base64url') : '',
    nom: row.nom ?? '',
    marque: row.marque ?? '',
    ean: row.ean ?? '',
    contenance: row.contenance ?? '',
    stock_disponible: parseInt(row.stock_disponible) || 0,
    flux,
    ddm: row.dluo ?? '',
    etat: row.etat ?? 'intact',
    photo_url: row.photo_url ?? null,
    categorie: row.categorie ?? '',
    prix_achat_ht: prixAchat,
    pmc_ht: pmcHt,
    pmc_type: pmcType,
    pmc_sources: pmcSources,
    pmc_fiabilite: pmcFiabilite,
    pmc_statut: row.pmc_statut ?? 'non_trouve',
    prix_vente_wag_ht: prixVente,
    marge_wag_pct: margeWag,
    remise_vs_gd_pct: remiseGd,
    remise_label: pmcHt ? getRemiseLabel(pmcType, remiseGd) : '',
    scenario,
    statut: row.statut ?? 'a_traiter',
    note_interne: row.note_interne ?? '',
    fournisseur_nom: row.fournisseur_nom ?? null,
    visible_catalogue: row.visible_catalogue ?? false,
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

  // Try Supabase
  const supabase = getSupabase();
  if (supabase) {
    try {
      let query = supabase.from('produits').select('*');

      if (produitId) {
        query = query.eq('id', produitId);
      } else if (fournisseur) {
        query = query.eq('fournisseur_nom', fournisseur);
      } else if (offreId) {
        // offreId is base64url-encoded fournisseur_nom
        try {
          const decoded = Buffer.from(offreId, 'base64url').toString('utf-8');
          query = query.eq('fournisseur_nom', decoded);
        } catch {
          // If decode fails, try as literal
          query = query.eq('fournisseur_nom', offreId);
        }
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        const enriched = data.map(mapToBackofficeProduit);
        return NextResponse.json({ produits: enriched, source: 'supabase' });
      }
    } catch (err) {
      console.error('[produits] Supabase error:', err);
    }
  }

  // Fallback demo
  let produits = DEMO_OFFRES.flatMap(o => o.produits);

  if (offreId) produits = produits.filter(p => p.offre_id === offreId);
  if (produitId) produits = produits.filter(p => p.id === produitId);

  const enriched = produits.map(p => {
    const pmcHt = p.pmc_ht ?? 0;
    const scenario = pmcHt > 0 ? calculerScenario(p.prix_achat_ht, pmcHt) : null;
    const prixVente = p.prix_vente_wag_ht ?? calculerPrixVenteWag(p.prix_achat_ht, p.flux);
    const margeWag = calculerMargeWag(p.prix_achat_ht, prixVente);
    const remiseGd = pmcHt > 0 ? calculerRemiseVsGd(prixVente, pmcHt) : 0;
    return {
      ...p,
      scenario,
      prix_vente_wag_ht: prixVente,
      marge_wag_pct: margeWag,
      remise_vs_gd_pct: remiseGd,
      remise_label: getRemiseLabel(p.pmc_type, remiseGd),
    };
  });

  return NextResponse.json({ produits: enriched, source: 'demo' });
}
