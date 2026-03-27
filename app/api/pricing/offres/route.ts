import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/app/pricing/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const auth = await verifySession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const statut = req.nextUrl.searchParams.get('statut');
  const urgence = req.nextUrl.searchParams.get('urgence');

  let query = supabaseAdmin
    .from('produits_offres')
    .select('*')
    .neq('statut', 'archivée')
    .order('created_at', { ascending: false });

  if (statut) {
    query = query.eq('statut', statut);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[offres] Supabase error:', error.message);
    return NextResponse.json({ error: 'Erreur Supabase', details: error.message }, { status: 500 });
  }

  const offres = (data ?? []).map(o => {
    // Calcul score urgence simplifié
    const ddmMin = o.ddm_min ? new Date(o.ddm_min) : new Date();
    const joursDdm = Math.max(0, Math.floor((ddmMin.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    const valeur = parseFloat(o.valeur_estimee) || 0;
    const score = Math.min(100, Math.max(0, (100 - joursDdm * 2) + (valeur / 1000)));
    const priorite = score > 80 ? 'rouge' : score >= 50 ? 'orange' : 'vert';

    return {
      id: o.id,
      fournisseur: o.source ?? o.fournisseur_nom ?? 'Sans nom',
      date_reception: o.created_at,
      nb_produits: o.nb_references ?? '-',
      ddm_min: o.ddm_min ?? new Date().toISOString(),
      valeur_estimee: valeur,
      statut: o.statut ?? 'nouvelle',
      assigne_a: o.assigne_a ?? null,
      note_interne: o.note_operateur ?? '',
      score_urgence: Math.round(score),
      priorite,
    };
  });

  const filtered = urgence ? offres.filter(o => o.priorite === urgence) : offres;
  filtered.sort((a, b) => b.score_urgence - a.score_urgence);

  return NextResponse.json({ offres: filtered, source: 'supabase' });
}
