import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySession } from '@/app/pricing/lib/auth';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const auth = await verifySession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 });
  }

  // ── KPIs ──
  const [
    { count: produitsEnLigne },
    { count: pmcManuelRequis },
    { data: allProduits },
    { data: notifications },
  ] = await Promise.all([
    supabase.from('produits').select('*', { count: 'exact', head: true }).eq('visible_catalogue', true),
    supabase.from('produits').select('*', { count: 'exact', head: true }).lt('pmc_fiabilite', 3),
    supabase.from('produits').select('prix_achat_wag_ht, prix_vente_wag_ht, stock_disponible, statut, fournisseur_id, visible_catalogue'),
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(20),
  ]);

  const produits = allProduits ?? [];

  // Count distinct fournisseurs with unprocessed products
  const fournisseursATraiter = new Set(
    produits.filter(p => p.statut === 'a_traiter' || p.statut === 'nouvelle' || !p.statut).map(p => p.fournisseur_id)
  );

  const enLigne = produits.filter(p => p.visible_catalogue === true);
  const caPotentiel = enLigne.reduce((s, p) => s + (parseFloat(p.prix_vente_wag_ht) || 0) * (parseInt(p.stock_disponible) || 0), 0);
  const engagement = produits.reduce((s, p) => s + (parseFloat(p.prix_achat_wag_ht) || 0) * (parseInt(p.stock_disponible) || 0), 0);

  // Compute marge from prix_achat and prix_vente
  const marges = produits
    .map(p => {
      const achat = parseFloat(p.prix_achat_wag_ht) || 0;
      const vente = parseFloat(p.prix_vente_wag_ht) || 0;
      return achat > 0 && vente > 0 ? ((vente - achat) / vente) * 100 : 0;
    })
    .filter(m => m > 0);
  const margeMoy = marges.length ? marges.reduce((a, b) => a + b, 0) / marges.length : 0;

  const kpis = {
    offres_a_traiter: fournisseursATraiter.size,
    produits_en_ligne: produitsEnLigne ?? 0,
    ca_potentiel: Math.round(caPotentiel),
    engagement_potentiel: Math.round(engagement),
    marge_wag_moyenne: Math.round(margeMoy * 10) / 10,
    taux_acceptation_contre_offres: 0,
    pmc_manuel_requis: pmcManuelRequis ?? 0,
  };

  // ── Alertes from notifications ──
  const alertes = (notifications ?? [])
    .filter(n => !n.lu)
    .slice(0, 5)
    .map(n => ({
      type: n.type ?? 'info',
      message: n.contenu ?? n.message ?? '',
      produit_id: n.produit_id,
      depuis: n.created_at,
    }));

  // ── Activité récente ──
  const activite = (notifications ?? []).slice(0, 10).map(n => ({
    id: n.id,
    type: n.type ?? 'info',
    description: n.contenu ?? n.message ?? '',
    created_at: n.created_at,
  }));

  return NextResponse.json({ kpis, alertes, activite, source: 'supabase' });
}
