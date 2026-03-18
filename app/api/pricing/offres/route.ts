import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/app/pricing/lib/auth';
import { DEMO_OFFRES } from '@/app/pricing/lib/demo-data';

export async function GET(req: NextRequest) {
  const auth = await verifySession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const statut = req.nextUrl.searchParams.get('statut');
  const urgence = req.nextUrl.searchParams.get('urgence');

  let offres = [...DEMO_OFFRES];

  if (statut) offres = offres.filter(o => o.statut === statut);
  if (urgence) offres = offres.filter(o => o.priorite === urgence);

  // Sort by urgency score desc
  offres.sort((a, b) => b.score_urgence - a.score_urgence);

  return NextResponse.json({ offres });
}
