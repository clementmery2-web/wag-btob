import { NextResponse } from 'next/server';
import { verifySession } from '@/app/pricing/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const auth = await verifySession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  // ── KPIs ──
  const [
    { count: offresATraiter },
    { count: produitsEnLigne },
    { data: produitsEnLigneData },
    { data: activiteRecente },
  ] = await Promise.all([
    supabaseAdmin
      .from('produits_offres')
      .select('*', { count: 'exact', head: true })
      .in('statut', ['nouvelle', 'en_cours']),
    supabaseAdmin
      .from('produits')
      .select('*', { count: 'exact', head: true })
      .eq('statut', 'en_ligne'),
    supabaseAdmin
      .from('produits')
      .select('prix_achat_ht, prix_wag_ht, quantite_disponible')
      .eq('statut', 'en_ligne'),
    supabaseAdmin
      .from('produits_offres')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const produits = produitsEnLigneData ?? [];

  // CA potentiel
  const caPotentiel = produits.reduce(
    (s, p) => s + (parseFloat(p.prix_wag_ht) || 0) * (parseInt(p.quantite_disponible) || 0),
    0
  );

  // Marge WAG moyenne
  const marges = produits
    .map(p => {
      const achat = parseFloat(p.prix_achat_ht) || 0;
      const vente = parseFloat(p.prix_wag_ht) || 0;
      return achat > 0 && vente > 0 ? ((vente - achat) / vente) * 100 : 0;
    })
    .filter(m => m > 0);
  const margeMoy = marges.length ? marges.reduce((a, b) => a + b, 0) / marges.length : 0;

  const kpis = {
    offres_a_traiter: offresATraiter ?? 0,
    produits_en_ligne: produitsEnLigne ?? 0,
    ca_potentiel: Math.round(caPotentiel),
    engagement_potentiel: 0,
    marge_wag_moyenne: Math.round(margeMoy * 10) / 10,
    taux_acceptation_contre_offres: 0,
    pmc_manuel_requis: 0,
  };

  // ── Activité récente (depuis produits_offres) ──
  const activite = (activiteRecente ?? []).map(o => ({
    id: o.id,
    type: o.statut === 'nouvelle' ? 'offre_recue' : 'traitement',
    description: `Offre ${o.fournisseur_nom ?? 'fournisseur inconnu'} — ${o.nb_produits ?? 0} produit(s)`,
    created_at: o.created_at,
  }));

  return NextResponse.json({ kpis, alertes: [], activite, source: 'supabase' });
}
