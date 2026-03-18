import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySession } from '@/app/pricing/lib/auth';

// ─── Supabase ───────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── Fallback coefficient matrix ────────────────────────────────

const RATIOS: Record<string, Record<string, number>> = {
  alimentaire:   { standard: 3.5, bio_premium: 5.0 },
  conserves:     { standard: 3.2, bio_premium: 4.5 },
  boissons:      { standard: 2.8, bio_premium: 4.2 },
  thes_infusions:{ standard: 3.5, bio_premium: 5.0 },
  complements:   { standard: 5.0, bio_premium: 7.0 },
  hygiene:       { standard: 4.0, bio_premium: 6.0 },
  entretien:     { standard: 3.2, bio_premium: 4.5 },
  bebe:          { standard: 4.5, bio_premium: 6.5 },
  animaux:       { standard: 3.5, bio_premium: 5.0 },
  chocolat:      { standard: 3.0, bio_premium: 5.0 },
};

// Map real Supabase categories → RATIOS keys
const CAT_MAP: Record<string, string> = {
  'Épicerie salée': 'alimentaire',
  'Épicerie sucrée': 'alimentaire',
  'Boissons': 'boissons',
  'Hygiène & Beauté': 'hygiene',
  'Bébé': 'bebe',
  'Entretien': 'entretien',
  'Animaux': 'animaux',
};

// Store name → group mapping for Open Prices
const STORE_PATTERNS: [RegExp, string][] = [
  [/carrefour|auchan|leclerc|intermarch|casino/i, 'gd'],
  [/lidl|aldi|leader|netto/i, 'discount'],
  [/pharma|bio|nature|sant[eé]|parapharma/i, 'pharma'],
];

// Keywords for pharma/bio detection
const PHARMA_KEYWORDS = /\b(bio|organic|pagode|compl[eé]ment|g[eé]lule|infusion|tisane)\b/i;

// ─── Helpers ────────────────────────────────────────────────────

interface OpenPriceEntry {
  price: number;
  price_per: string;
  currency: string;
  date: string;
  location_osm_name?: string;
}

interface PmcResult {
  pmc_ht: number;
  pmc_type: 'gd' | 'pharma_bio' | 'estime';
  pmc_fiabilite: number;
  pmc_statut: string;
  pmc_sources: { enseigne: string; prix: number; type: string }[];
  alertes: string[];
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function detectType(produit: { nom: string; marque: string; categorie: string; prix_achat_ht: number; contenance?: string }): {
  type: 'gd' | 'pharma_bio';
  positionnement: 'standard' | 'bio_premium';
} {
  const combined = `${produit.nom} ${produit.marque}`.toLowerCase();
  const catKey = CAT_MAP[produit.categorie] ?? 'alimentaire';

  let type: 'gd' | 'pharma_bio' = 'gd';

  if (catKey === 'hygiene' || catKey === 'bebe') {
    type = 'pharma_bio';
  } else if (PHARMA_KEYWORDS.test(combined)) {
    type = 'pharma_bio';
  } else if (
    produit.prix_achat_ht > 4 &&
    catKey === 'alimentaire' &&
    produit.contenance &&
    parseWeight(produit.contenance) < 200
  ) {
    type = 'pharma_bio';
  }

  const positionnement = /\bbio\b/i.test(combined) ? 'bio_premium' : 'standard';
  return { type, positionnement };
}

function parseWeight(contenance: string): number {
  const match = contenance.match(/(\d+)\s*(g|ml)/i);
  return match ? parseInt(match[1]) : 999;
}

/** Compute percentile from sorted array */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Remove IQR outliers and return cleaned array */
function removeOutliers(values: number[]): number[] {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return sorted.filter(v => v >= lo && v <= hi);
}

function classifyStore(name: string | undefined): string | null {
  if (!name) return null;
  for (const [re, group] of STORE_PATTERNS) {
    if (re.test(name)) return group;
  }
  return null;
}

// ─── Open Prices API ────────────────────────────────────────────

async function fetchOpenPrices(ean: string): Promise<{
  groups: Record<string, number[]>;
  sources: { enseigne: string; prix: number; type: string }[];
  validCount: number;
}> {
  const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  const url = `https://prices.openfoodfacts.org/api/v1/prices?product_code=${ean}&currency=EUR&price_per=UNIT&page_size=50`;

  const groups: Record<string, number[]> = { gd: [], discount: [], pharma: [] };
  const sources: { enseigne: string; prix: number; type: string }[] = [];
  let validCount = 0;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { groups, sources, validCount };

    const data = await res.json();
    const items: OpenPriceEntry[] = data.items ?? data.results ?? [];

    for (const item of items) {
      if (item.price_per !== 'UNIT') continue;
      if (item.currency !== 'EUR') continue;
      if (item.date < sixMonthsAgo) continue;

      const group = classifyStore(item.location_osm_name);
      if (group && groups[group]) {
        groups[group].push(item.price);
        validCount++;
        sources.push({
          enseigne: item.location_osm_name ?? 'Inconnu',
          prix: item.price,
          type: group === 'pharma' ? 'pharma_bio' : 'gd',
        });
      }
    }
  } catch {
    // Timeout or network error — continue with fallback
  }

  return { groups, sources, validCount };
}

// ─── Fallback coefficient ───────────────────────────────────────

function fallbackPmc(prixAchat: number, categorie: string, positionnement: 'standard' | 'bio_premium'): number {
  const catKey = CAT_MAP[categorie] ?? 'alimentaire';
  const ratioMap = RATIOS[catKey] ?? RATIOS.alimentaire;
  const ratio = ratioMap[positionnement] ?? ratioMap.standard;
  return Math.round(prixAchat * ratio * 100) / 100;
}

// ─── Main PMC calculation ───────────────────────────────────────

async function calculatePmc(produit: {
  id: string;
  ean: string | null;
  nom: string;
  marque: string;
  categorie: string;
  prix_achat_ht: number;
  contenance?: string;
  pmc_ht?: number | null;
  pmc_fiabilite?: number;
  pmc_updated_at?: string | null;
  pmc_statut?: string;
}): Promise<PmcResult> {
  const alertes: string[] = [];
  const { type, positionnement } = detectType(produit);

  if (type === 'pharma_bio') {
    alertes.push('Produit hors GD — PMC pharmacie/bio');
  }

  // ── STEP 0: Check cache ──
  const daysOld = daysSince(produit.pmc_updated_at ?? null);
  const fiab = produit.pmc_fiabilite ?? 0;

  if (daysOld < 1 && produit.pmc_ht && produit.pmc_ht > 0) {
    return {
      pmc_ht: produit.pmc_ht,
      pmc_type: type,
      pmc_fiabilite: fiab,
      pmc_statut: produit.pmc_statut ?? 'cache',
      pmc_sources: [],
      alertes,
    };
  }
  if (daysOld < 7 && fiab >= 4 && produit.pmc_ht && produit.pmc_ht > 0) {
    return {
      pmc_ht: produit.pmc_ht,
      pmc_type: type,
      pmc_fiabilite: fiab,
      pmc_statut: produit.pmc_statut ?? 'cache',
      pmc_sources: [],
      alertes,
    };
  }

  // ── STEP 2: Open Prices API ──
  let pmcHt = 0;
  let pmcFiabilite = 0;
  let pmcStatut = 'non_trouve';
  let pmcSources: { enseigne: string; prix: number; type: string }[] = [];

  if (produit.ean) {
    const { groups, sources, validCount } = await fetchOpenPrices(produit.ean);
    pmcSources = sources;

    // Compute P75 per group
    const groupP75: Record<string, number> = {};
    for (const [group, prices] of Object.entries(groups)) {
      if (prices.length < 2) continue;
      const cleaned = removeOutliers(prices);
      if (cleaned.length === 0) continue;
      const sorted = [...cleaned].sort((a, b) => a - b);
      groupP75[group] = percentile(sorted, 0.75);
    }

    // Pick best reference price
    const targetGroup = type === 'pharma_bio' ? 'pharma' : 'gd';
    const refPriceTTC = groupP75[targetGroup] ?? groupP75.gd ?? groupP75.discount ?? groupP75.pharma ?? 0;

    if (refPriceTTC > 0) {
      // Convert TTC → HT (assume 20% TVA for non-food, 5.5% for food)
      const tvaRate = type === 'pharma_bio' ? 0.20 : 0.055;
      pmcHt = Math.round((refPriceTTC / (1 + tvaRate)) * 100) / 100;
    }

    // Fiability score
    if (validCount >= 10) pmcFiabilite = 5;
    else if (validCount >= 5) pmcFiabilite = 4;
    else if (validCount >= 2) pmcFiabilite = 3;
    else if (validCount >= 1) pmcFiabilite = 2;
    else pmcFiabilite = 0;

    if (pmcFiabilite >= 3 && pmcHt > 0) {
      pmcStatut = 'auto_trouve';
    }
  }

  // ── STEP 3: If score < 3, flag for manual entry + use fallback ──
  if (pmcFiabilite < 3 || pmcHt === 0) {
    pmcHt = fallbackPmc(produit.prix_achat_ht, produit.categorie, positionnement);
    pmcFiabilite = 1;
    pmcStatut = 'manuel_requis';
  }

  // ── Validation alerts ──
  if (pmcHt > 0 && pmcHt < produit.prix_achat_ht * 1.3) {
    alertes.push('PMC suspect — trop proche du prix achat');
  }
  if (pmcHt > 0 && pmcHt > produit.prix_achat_ht * 10) {
    alertes.push('PMC suspect — ratio anormalement élevé');
  }
  if (pmcFiabilite <= 2) {
    alertes.push('PMC peu fiable — validation recommandée');
  }

  return {
    pmc_ht: pmcHt,
    pmc_type: type,
    pmc_fiabilite: pmcFiabilite,
    pmc_statut: pmcStatut,
    pmc_sources: pmcSources,
    alertes,
  };
}

// ─── GET: Calculate PMC for a product ───────────────────────────

export async function GET(req: NextRequest) {
  const auth = await verifySession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const id = searchParams.get('id');
  const ean = searchParams.get('ean');

  if (!id && !ean) {
    return NextResponse.json({ error: 'Paramètre id ou ean requis' }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 });
  }

  // Fetch product
  let query = supabase.from('produits').select('*');
  if (id) query = query.eq('id', id);
  else if (ean) query = query.eq('ean', ean);
  const { data: rows, error } = await query.limit(1);

  if (error || !rows || rows.length === 0) {
    return NextResponse.json({ error: 'Produit non trouvé' }, { status: 404 });
  }

  const produit = rows[0];
  const result = await calculatePmc({
    id: produit.id,
    ean: produit.ean,
    nom: produit.nom,
    marque: produit.marque,
    categorie: produit.categorie,
    prix_achat_ht: produit.prix_achat_wag_ht ?? produit.prix_vente_wag_ht ?? 0,
    contenance: produit.contenance,
    pmc_ht: produit.pmc_reference,
    pmc_fiabilite: produit.pmc_fiabilite,
    pmc_updated_at: produit.pmc_updated_at,
    pmc_statut: produit.pmc_statut,
  });

  // Update Supabase
  const updateData: Record<string, unknown> = {
    pmc_reference: result.pmc_ht,
    pmc_type: result.pmc_type,
    pmc_fiabilite: result.pmc_fiabilite,
    pmc_statut: result.pmc_statut,
    pmc_updated_at: new Date().toISOString(),
  };

  await supabase.from('produits').update(updateData).eq('id', produit.id);

  // Insert into pmc_historique
  await supabase.from('pmc_historique').insert({
    produit_id: produit.id,
    pmc_ht: result.pmc_ht,
    pmc_type: result.pmc_type,
    pmc_fiabilite: result.pmc_fiabilite,
    pmc_statut: result.pmc_statut,
    pmc_sources: result.pmc_sources,
    alertes: result.alertes,
    created_at: new Date().toISOString(),
  });

  // If manuel_requis → create notification
  if (result.pmc_statut === 'manuel_requis') {
    await supabase.from('notifications').insert({
      type: 'pmc_manquant',
      destinataire_type: 'wag',
      contenu: `PMC manquant pour ${produit.nom} (${produit.ean ?? 'sans EAN'}) — saisie manuelle requise`,
      produit_id: produit.id,
      lu: false,
      created_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    produit_id: produit.id,
    ...result,
  });
}

// ─── POST: Manual PMC validation ────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await verifySession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const body = await req.json();
  const { produit_id, pmc_ttc, source, tva_rate } = body;

  if (!produit_id || typeof pmc_ttc !== 'number' || pmc_ttc <= 0) {
    return NextResponse.json({ error: 'produit_id et pmc_ttc (> 0) requis' }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 });
  }

  const tva = typeof tva_rate === 'number' ? tva_rate : 20;
  const pmc_ht = Math.round((pmc_ttc / (1 + tva / 100)) * 100) / 100;

  const updateData = {
    pmc_reference: pmc_ht,
    pmc_ht: pmc_ht,
    pmc_source_niveau: 1,
    pmc_fiabilite: 5,
    pmc_statut: 'valide_manuellement',
    pmc_type: 'gd',
    pmc_updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('produits').update(updateData).eq('id', produit_id);

  if (error) {
    return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 });
  }

  // Insert into pmc_historique
  await supabase.from('pmc_historique').insert({
    produit_id,
    pmc_ht,
    pmc_type: 'gd',
    pmc_fiabilite: 5,
    pmc_statut: 'valide_manuellement',
    pmc_sources: [{ enseigne: source ?? 'Saisie manuelle', prix: pmc_ttc, type: 'gd' }],
    alertes: [],
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, pmc_ht, pmc_statut: 'valide_manuellement' });
}
