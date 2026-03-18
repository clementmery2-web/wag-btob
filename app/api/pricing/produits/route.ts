import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/app/pricing/lib/auth';
import { DEMO_OFFRES } from '@/app/pricing/lib/demo-data';
import { calculerScenario, calculerPrixVenteWag, calculerMargeWag, calculerRemiseVsGd, getRemiseLabel } from '@/app/pricing/lib/types';

export async function GET(req: NextRequest) {
  const auth = await verifySession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const offreId = req.nextUrl.searchParams.get('offre_id');
  const produitId = req.nextUrl.searchParams.get('id');

  let produits = DEMO_OFFRES.flatMap(o => o.produits);

  if (offreId) produits = produits.filter(p => p.offre_id === offreId);
  if (produitId) produits = produits.filter(p => p.id === produitId);

  // Enrich with computed pricing
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

  return NextResponse.json({ produits: enriched });
}
