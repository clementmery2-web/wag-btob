import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

interface ProduitParse {
  ref: string;
  nom: string;
  marque: string;
  ean: string;
  prix_achat_ht: number;
  pcb: number;
  stock: number;
  ddm: string | null;
  tva: number;
  poids: number | null;
}

// Map Excel column headers to known fields via keyword matching
const COLUMN_PATTERNS: Record<string, RegExp> = {
  ref: /r[ée]f|code.?art|sku|reference/i,
  nom: /nom|d[ée]sign|libell[ée]|produit|article/i,
  marque: /marque|brand|fabricant/i,
  ean: /ean|gtin|code.?bar/i,
  pcb: /pcb|colis|colisage|lot|uvs/i,
  stock: /stock|qt[ée]|quantit[ée]|dispo/i,
  ddm: /ddm|dluo|dlc|date.*limite|expir|perem/i,
  poids: /poids|kg|gramm|weight|net/i,
  tva: /tva|taxe/i,
  pmc_ht: /pmc|prix\s*moyen\s*constat[ée]/i,
};

// prix_achat_wag_ht patterns in priority order (first match wins)
const PRIX_PATTERNS: RegExp[] = [
  /prix\s*anti[\s-]*gaspi/i,
  /prix\s*achat|pa[\s.]?ht|achat[\s.]?ht/i,
  /prix|tarif|cost|p\.?u/i,
];

function matchColumns(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  for (const [field, pattern] of Object.entries(COLUMN_PATTERNS)) {
    const idx = headers.findIndex(h => pattern.test(h));
    if (idx !== -1) mapping[field] = idx;
  }
  // Match prix with priority: antigaspi > prix achat/pa ht > prix generic
  // Exclude columns already mapped (e.g. pmc_ht) to avoid false matches
  const usedIndices = new Set(Object.values(mapping));
  for (const pattern of PRIX_PATTERNS) {
    const idx = headers.findIndex((h, i) => !usedIndices.has(i) && pattern.test(h));
    if (idx !== -1) {
      mapping.prix = idx;
      break;
    }
  }
  return mapping;
}

/**
 * POST /api/pricing/mercuriale
 * action=parse  → Parse Excel via XLSX + column matching → return products
 * action=import → Insert parsed products into Supabase
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';

  // ── ACTION: IMPORT ──
  if (contentType.includes('application/json')) {
    const body = await req.json();
    if (body.action === 'import') {
      return handleImport(body);
    }
    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
  }

  // ── ACTION: PARSE ──
  if (contentType.includes('multipart/form-data')) {
    return handleParse(req);
  }

  return NextResponse.json({ error: 'Content-Type non supporté' }, { status: 400 });
}

async function handleParse(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('fichier') as File | null;
  const columnMappingStr = formData.get('columnMapping') as string | null;
  let userMapping: Record<string, number> | null = null;
  if (columnMappingStr) {
    try { userMapping = JSON.parse(columnMappingStr); } catch { /* ignore */ }
  }
  console.log('[mercuriale] columnMapping reçu:', JSON.stringify(userMapping));

  if (!file) {
    return NextResponse.json({ error: 'Fichier requis' }, { status: 400 });
  }

  console.log('[mercuriale] Fichier reçu:', file.name, file.size, 'bytes');
  const isLargeFile = file.size > 2 * 1024 * 1024; // > 2MB

  // 1. Parse Excel → extract columns via pattern matching
  const buffer = await file.arrayBuffer();
  let totalRows = 0;
  let colonnes: string[] = [];
  const cleanProduits: ProduitParse[] = [];
  let fournisseurNomDetecte: string | null = null;
  let autoMapping: Record<string, number> = {};

  try {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

    // Use only the first non-"Légende" sheet
    const mainSheetName = workbook.SheetNames.find(s => !/l[ée]gende/i.test(s));
    const sheetsToProcess = mainSheetName ? [mainSheetName] : workbook.SheetNames.slice(0, 1);

    for (const sheetName of sheetsToProcess) {
      const sheet = workbook.Sheets[sheetName];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (rows.length < 2) continue;

      const headers = (rows[0] as unknown[]).map(c => String(c ?? '').trim());
      if (colonnes.length === 0) colonnes = headers;

      const autoMap = matchColumns(headers);
      if (Object.keys(autoMapping).length === 0) autoMapping = autoMap;
      const colMap = userMapping || autoMap;
      console.log('[mercuriale] Feuille', sheetName, '— colonnes mappées:', JSON.stringify(colMap));
      console.log('[mercuriale] colMap final utilisé:', JSON.stringify(colMap));

      // Try to detect supplier name from sheet name or first cell area
      if (!fournisseurNomDetecte && sheetName && !/airtable|sheet|feuil|csv/i.test(sheetName)) {
        fournisseurNomDetecte = sheetName;
      }

      totalRows += Math.max(0, rows.length - 1);
      const dataRows = rows.slice(1);

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const nom = colMap.nom !== undefined ? String(row[colMap.nom] ?? '').trim() : '';
        if (i === 0) {
          console.log('[mercuriale] Valeur brute index 14:', row[14], typeof row[14]);
        }
        const prix = colMap.prix !== undefined ? parseFloat(String(row[colMap.prix] ?? 0).replace(',', '.')) || 0 : 0;

        // Skip empty rows
        if (!nom && !prix) continue;

        if (i === 0) {
          const ean = colMap.ean !== undefined ? String(row[colMap.ean] ?? '').trim() : '';
          const stock = colMap.stock !== undefined ? Math.max(0, Math.round(Number(row[colMap.stock]) || 0)) : 0;
          console.log('[mercuriale] Ligne 1 extraite:', JSON.stringify({nom, prix, ean, stock}));
        }

        const tvaRaw = colMap.tva !== undefined ? Number(row[colMap.tva]) : NaN;
        const ddmRaw = colMap.ddm !== undefined ? String(row[colMap.ddm] ?? '').trim() : '';

        cleanProduits.push({
          ref: colMap.ref !== undefined ? String(row[colMap.ref] ?? '').trim() || `REF-${cleanProduits.length + 1}` : `REF-${cleanProduits.length + 1}`,
          nom,
          marque: colMap.marque !== undefined ? String(row[colMap.marque] ?? '').trim() : '',
          ean: colMap.ean !== undefined ? String(row[colMap.ean] ?? '').trim() : '',
          prix_achat_ht: Math.max(0, prix),
          pcb: colMap.pcb !== undefined ? Math.max(1, Math.round(Number(row[colMap.pcb]) || 1)) : 1,
          stock: colMap.stock !== undefined ? Math.max(0, Math.round(Number(row[colMap.stock]) || 0)) : 0,
          ddm: ddmRaw || null,
          tva: [5.5, 20].includes(tvaRaw) ? tvaRaw : 5.5,
          poids: colMap.poids !== undefined ? Number(row[colMap.poids]) || null : null,
        });
      }
    }
  } catch (err) {
    console.error('[mercuriale] Erreur parsing Excel:', err);
    return NextResponse.json({ error: 'Impossible de lire le fichier Excel' }, { status: 400 });
  }

  // Fallback: if sheet name was generic, use first product's marque
  if (!fournisseurNomDetecte && cleanProduits.length > 0 && cleanProduits[0].marque) {
    fournisseurNomDetecte = cleanProduits[0].marque;
  }

  if (totalRows === 0) {
    return NextResponse.json({ error: 'Fichier vide' }, { status: 400 });
  }

  // 2. Filter valid products and build response
  const validProduits = cleanProduits.filter(p => p.nom && p.nom.length > 2 && p.nom.length <= 80 && !/^\d+$/.test(p.nom));

  const alertes: string[] = [];
  if (validProduits.every(p => !p.ean)) alertes.push('Aucun code EAN détecté');
  if (validProduits.every(p => p.stock === 0)) alertes.push('Aucun stock détecté');
  if (validProduits.every(p => !p.ddm)) alertes.push('Aucune DDM/DLUO détectée');
  if (validProduits.every(p => p.pcb === 1)) alertes.push('Aucun PCB/colisage détecté');

  console.log('[mercuriale] Produits valides:', validProduits.length, '/', totalRows, '| Alertes:', alertes);

  if (isLargeFile) {
    alertes.push('Fichier volumineux');
  }

  return NextResponse.json({
    success: true,
    produits: validProduits,
    nb_total: totalRows,
    nb_parses: validProduits.length,
    colonnes,
    alertes,
    fournisseur_nom: fournisseurNomDetecte,
    auto_mapping: autoMapping,
  });
}

async function handleImport(body: {
  action: string;
  fournisseur_nom: string;
  flux: string;
  produits: ProduitParse[];
}) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 });
  }

  const { fournisseur_nom, flux, produits } = body;
  if (!produits || produits.length === 0) {
    return NextResponse.json({ error: 'Aucun produit à importer' }, { status: 400 });
  }

  console.log('[mercuriale] Import:', produits.length, 'produits pour', fournisseur_nom);

  // Lookup or create fournisseur
  let fournisseurId: string | null = null;
  if (fournisseur_nom) {
    const { data: existing } = await supabase
      .from('fournisseurs')
      .select('id')
      .eq('nom', fournisseur_nom)
      .limit(1)
      .single();

    if (existing?.id) {
      fournisseurId = existing.id;
      console.log('[mercuriale] Fournisseur existant:', fournisseurId);
    } else {
      const { data: created, error: createErr } = await supabase
        .from('fournisseurs')
        .insert({ nom: fournisseur_nom, statut: 'actif', email: 'contact@' + fournisseur_nom.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com' })
        .select('id')
        .single();

      if (createErr) {
        console.error('[mercuriale] Erreur création fournisseur:', createErr.message);
        return NextResponse.json({ error: `Erreur création fournisseur: ${createErr.message}` }, { status: 500 });
      }
      fournisseurId = created?.id ?? null;
      console.log('[mercuriale] Fournisseur créé:', fournisseurId);
    }
  }

  // Build insert rows using only valid produits columns
  const rows = produits.map(p => ({
    nom: p.nom,
    marque: p.marque,
    ean: p.ean || null,
    prix_achat_wag_ht: p.prix_achat_ht,
    stock_disponible: p.stock,
    conditionnement: p.pcb,
    flux: flux === 'stock_wag' ? 'entrepot' : flux,
    dluo: p.ddm ? (() => { try { return new Date(String(p.ddm)).toISOString().slice(0,10); } catch(e) { return null; } })() : null,
    tva_taux: p.tva,
    visible_catalogue: false,
    statut: 'en_attente',
    photo_statut: 'non_trouvee',
    ...(fournisseurId ? { fournisseur_id: fournisseurId } : {}),
  }));

  console.log('[mercuriale] Insert payload sample:', JSON.stringify(rows[0]));

  const { data, error } = await supabase
    .from('produits')
    .insert(rows)
    .select('id');

  if (error) {
    console.error('[mercuriale] Erreur INSERT:', error.message, error.code, error.details);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const insertedIds = (data || []).map(r => r.id);
  console.log('[mercuriale] Insérés:', insertedIds.length, 'produits');

  // Create notification
  try {
    await supabase.from('notifications').insert({
      type: 'import_mercuriale',
      titre: `Mercuriale importée — ${fournisseur_nom} (${produits.length} produits)`,
      contenu: `${produits.length} produits importés depuis la mercuriale de ${fournisseur_nom}. Flux: ${flux}.`,
      destinataire_type: 'wag',
      lu: false,
    });
  } catch {
    // Non bloquant
  }

  return NextResponse.json({
    success: true,
    nb_importes: insertedIds.length,
    fournisseur_nom,
    offre_id: fournisseur_nom, // Used as redirect param
  });
}
