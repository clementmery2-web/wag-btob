import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DEMO_CATALOGUE } from '@/app/lib/catalogue-data';

export async function GET(req: NextRequest) {
  const categorie = req.nextUrl.searchParams.get('categorie');

  // Try Supabase first
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key) {
    try {
      const supabase = createClient(url, key);
      let query = supabase
        .from('produits')
        .select('*')
        .eq('visible_catalogue', true)
        .order('created_at', { ascending: false });

      if (categorie && categorie !== 'Tout') {
        query = query.eq('categorie', categorie);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        return NextResponse.json({ produits: data, source: 'supabase' });
      }
    } catch {
      // Fall through to demo data
    }
  }

  // Fallback to demo data
  let produits = [...DEMO_CATALOGUE];
  if (categorie && categorie !== 'Tout') {
    produits = produits.filter(p => p.categorie === categorie);
  }

  return NextResponse.json({ produits, source: 'demo' });
}
