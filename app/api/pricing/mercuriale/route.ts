import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import * as XLSX from 'xlsx';


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
  pmc_fournisseur?: number | null;
}

// ── Normalize header text: lowercase, collapse whitespace, strip accents ──
const normalize = (s: string) =>
  s.toLowerCase().trim()
    .replace(/\s+/g, ' ')
    .replace(/[àáâ]/g, 'a').replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i').replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u').replace(/[ç]/g, 'c');

// Map Excel column headers to known fields via keyword matching (on normalized text)
const COLUMN_PATTERNS: Record<string, RegExp> = {
  ref: /ref|code.?art|sku|reference/,
  nom: /nom|designation|libelle|produit|article/,
  marque: /marque|brand|fabricant/,
  ean: /ean|gtin|code.?bar/,
  pcb: /pcb|colis|colisage|lot|uvs/,
  stock: /stock|qte|quantite|dispo|uc[\s/]*box|total uc|total cartons|uc disponible/,
  ddm: /ddm|dluo|dlc|date.*limite|expir|perem/,
  poids: /poids|kg|gramm|weight|net (?:g|kg|poids)/,
  tva: /tva|taxe/,
  pmc_ht: /pmc|prix moyen constate|mktg conseill|prix conseill/,
};

// prix_achat_wag_ht patterns in priority order (first match wins, on normalized text)
// "PA B2B SANS ECO" is a computed price, not the raw PA → excluded via PRIX_EXCLUDE
const PRIX_EXCLUDE = /b2b sans eco|eco[\s-]*emb/;
const PRIX_PATTERNS: RegExp[] = [
  /prix anti[\s-]*gaspi/,
  /prix net facture(?:e)? uc|net facture(?:e)? uc/,
  /prix net factur|net factur/,
  /prix achat|pa[\s.]?ht|achat[\s.]?ht/,
  /prix|tarif|cost|p\.?u/,
];

/**
 * Detect the real header row in the first N rows of the sheet.
 *
 * With xlsx + defval:'', every cell is present (never null), so we count
 * cells that are non-empty strings (length > 0 after trim) AND not formulas.
 * The header = first row with ≥ 4 such cells.
 */
function detectHeaderRow(rows: unknown[][], maxScan = 15): number {
  const limit = Math.min(rows.length, maxScan);
  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    let stringCount = 0;
    for (const cell of row) {
      const s = String(cell ?? '').trim();
      // Must be a non-empty string that isn't a formula and isn't purely a number
      if (s.length === 0) continue;
      if (s.startsWith('=')) continue;
      if (/^\d+([.,]\d+)?$/.test(s)) continue; // pure numeric string
      stringCount++;
    }
    if (stringCount >= 4) return i;
  }
  return 0; // fallback: first row
}

/** Read a cell as a number, ignoring Excel formula strings like "=I6+J6". */
function safeNum(cell: unknown): number {
  if (cell == null || cell === '') return 0;
  if (typeof cell === 'number') return cell;
  const s = String(cell).trim();
  if (s.startsWith('=')) return 0; // unresolved formula
  return parseFloat(s.replace(',', '.')) || 0;
}

/** Returns true if a cell contains an unresolved Excel formula. */
function isFormula(cell: unknown): boolean {
  if (cell == null || cell === '') return false;
  if (typeof cell !== 'string') return false;
  return cell.trim().startsWith('=');
}

/**
 * Normalize EAN: strip whitespace, trailing ".0", keep only 8-14 digit codes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeEan(v: any): string | null {
  if (v == null || v === '') return null;
  // Handle float numbers (e.g. 4062300032842.0 → '4062300032842')
  const s = (typeof v === 'number' ? Math.round(v).toString() : String(v))
    .replace(/\s/g, '')
    .replace(/\.0+$/, '')
    .trim();
  return /^\d{8,14}$/.test(s) ? s : null;
}

/**
 * Parse DDM (date de durabilité minimale) from heterogeneous formats:
 *  - JS Date / datetime  → DD/MM/YYYY
 *  - String "01/08/2026" → kept as-is
 *  - String "12 mois"    → today + N months → DD/MM/YYYY
 *  - Anything else        → null
 */
function parseDdm(cell: unknown): string | null {
  if (cell == null || cell === '') return null;

  // JS Date from cellDates:true
  if (cell instanceof Date) {
    if (isNaN(cell.getTime())) return null;
    const d = cell.getDate().toString().padStart(2, '0');
    const m = (cell.getMonth() + 1).toString().padStart(2, '0');
    const y = cell.getFullYear();
    return `${d}/${m}/${y}`;
  }

  const s = String(cell).trim();
  if (!s || s.startsWith('=')) return null;

  // "12 mois", "6 mois", etc. → approximate date
  const moisMatch = s.match(/^(\d{1,3})\s*mois$/i);
  if (moisMatch) {
    const n = parseInt(moisMatch[1], 10);
    const future = new Date();
    future.setMonth(future.getMonth() + n);
    const d = future.getDate().toString().padStart(2, '0');
    const m = (future.getMonth() + 1).toString().padStart(2, '0');
    const y = future.getFullYear();
    return `${d}/${m}/${y}`;
  }

  // Already formatted string (DD/MM/YYYY, YYYY-MM-DD, etc.)
  // Try native parse first
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
    const d = parsed.getDate().toString().padStart(2, '0');
    const m = (parsed.getMonth() + 1).toString().padStart(2, '0');
    const y = parsed.getFullYear();
    return `${d}/${m}/${y}`;
  }

  // DD/MM/YYYY manual parse (Date constructor reads it as MM/DD)
  const frMatch = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (frMatch) {
    const [, dd, mm, yyyy] = frMatch;
    return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}`;
  }

  return null; // unparseable → null, no crash
}

function matchColumns(headers: string[]): Record<string, number> {
  const normalized = headers.map(normalize);
  const mapping: Record<string, number> = {};
  for (const [field, pattern] of Object.entries(COLUMN_PATTERNS)) {
    const idx = normalized.findIndex(h => pattern.test(h));
    if (idx !== -1) mapping[field] = idx;
  }
  // Match prix with priority: antigaspi > prix net facturé UC > prix achat > generic
  // Exclude columns already mapped (e.g. pmc_ht) and computed prices (PA B2B SANS ECO)
  const usedIndices = new Set(Object.values(mapping));
  for (const pattern of PRIX_PATTERNS) {
    const idx = normalized.findIndex((h, i) => !usedIndices.has(i) && !PRIX_EXCLUDE.test(h) && pattern.test(h));
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
  let formulaAlertNeeded = false;

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

      // Auto-detect real header row (skip title / blank rows)
      const headerIdx = detectHeaderRow(rows);
      console.log('[mercuriale] headerRow index:', headerIdx);

      // colonnes = ALL header names from the file (not filtered by pattern matching)
      const rawHeaders = (rows[headerIdx] as unknown[]).map(c => String(c ?? '').trim());
      // Trim trailing empty columns (XLSX pads with defval to full sheet width)
      let lastNonEmpty = rawHeaders.length - 1;
      while (lastNonEmpty >= 0 && rawHeaders[lastNonEmpty] === '') lastNonEmpty--;
      const headers = rawHeaders.slice(0, lastNonEmpty + 1);

      if (colonnes.length === 0) colonnes = headers;
      console.log('[mercuriale] colonnes trouvées:', colonnes);

      const autoMap = matchColumns(headers);
      if (Object.keys(autoMapping).length === 0) autoMapping = autoMap;
      const colMap = userMapping || autoMap;
      console.log('[mercuriale] Feuille', sheetName, '— colonnes mappées:', JSON.stringify(colMap));
      console.log('[mercuriale] colMap final utilisé:', JSON.stringify(colMap));

      // Try to detect supplier name from sheet name or first cell area
      if (!fournisseurNomDetecte && sheetName && !/airtable|sheet|feuil|csv/i.test(sheetName)) {
        fournisseurNomDetecte = sheetName;
      }

      // Skip blank lines between header and first data row
      let dataStart = headerIdx + 1;
      while (dataStart < rows.length) {
        const r = rows[dataStart];
        if (Array.isArray(r) && r.some(c => c != null && c !== '')) break;
        dataStart++;
      }

      const dataRows = rows.slice(dataStart);
      totalRows += dataRows.length;
      console.log('[mercuriale] Données à partir de la ligne', dataStart, '(', dataRows.length, 'lignes)');

      let consecutiveEmpty = 0;
      let loggedFirst = false;
      let formulaInPrix = false;
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const nom = colMap.nom !== undefined ? String(row[colMap.nom] ?? '').trim() : '';
        const prixRaw = colMap.prix !== undefined ? row[colMap.prix] : 0;
        const prix = safeNum(prixRaw);

        // Track unresolved formulas in PA column (#6)
        if (colMap.prix !== undefined && isFormula(prixRaw)) formulaInPrix = true;

        // Tolerate mid-table blank lines; stop after 3 consecutive
        if (!nom && !prix) {
          consecutiveEmpty++;
          if (consecutiveEmpty >= 3) break;
          continue;
        }
        consecutiveEmpty = 0;

        if (!loggedFirst) {
          const ean = colMap.ean !== undefined ? normalizeEan(row[colMap.ean]) : null;
          const stock = colMap.stock !== undefined ? Math.max(0, Math.round(safeNum(row[colMap.stock]))) : 0;
          console.log('[mercuriale] Ligne 1 extraite:', JSON.stringify({nom, prix, ean, stock}));
          loggedFirst = true;
        }

        const tvaRaw = colMap.tva !== undefined ? safeNum(row[colMap.tva]) : NaN;

        cleanProduits.push({
          ref: colMap.ref !== undefined ? String(row[colMap.ref] ?? '').trim() || `REF-${cleanProduits.length + 1}` : `REF-${cleanProduits.length + 1}`,
          nom,
          marque: colMap.marque !== undefined ? String(row[colMap.marque] ?? '').trim() : '',
          ean: colMap.ean !== undefined ? normalizeEan(row[colMap.ean]) ?? '' : '',
          prix_achat_ht: Math.max(0, prix),
          pcb: colMap.pcb !== undefined ? Math.max(1, Math.round(safeNum(row[colMap.pcb]) || 1)) : 1,
          stock: colMap.stock !== undefined ? Math.max(0, Math.round(safeNum(row[colMap.stock]))) : 0,
          ddm: colMap.ddm !== undefined ? parseDdm(row[colMap.ddm]) : null,
          tva: [5.5, 20].includes(tvaRaw) ? tvaRaw : 5.5,
          poids: colMap.poids !== undefined ? safeNum(row[colMap.poids]) || null : null,
          pmc_fournisseur: colMap.pmc_ht !== undefined ? safeNum(row[colMap.pmc_ht]) || null : null,
        });
      }

      // #6: Alert if PA column contained formulas
      if (formulaInPrix) {
        formulaAlertNeeded = true;
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
  if (formulaAlertNeeded) alertes.push('Colonne PA contient des formules Excel non résolues — vérifiez que le fichier est exporté avec les valeurs calculées');
  if (validProduits.every(p => !p.ean)) alertes.push('Aucun code EAN détecté');
  if (validProduits.every(p => p.stock === 0)) alertes.push('Aucun stock détecté');
  if (validProduits.every(p => !p.ddm)) alertes.push('Aucune DDM/DLUO détectée');
  if (validProduits.every(p => p.pcb === 1)) alertes.push('Aucun PCB/colisage détecté');

  console.log('[mercuriale] Produits valides:', validProduits.length, '/', totalRows, '| Alertes:', alertes);
  console.log('[mercuriale] colonnes détectées:', colonnes);
  console.log('[mercuriale] auto_mapping:', JSON.stringify(autoMapping));
  console.log('[mercuriale] nb produits parsés:', validProduits.length);

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
  assigned_to?: string | null;
}) {
  const supabase = supabaseAdmin;

  const { fournisseur_nom, flux, produits, assigned_to } = body;
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

  // 1. Create produits_offres entry FIRST to get offre_id
  let offreId: string | null = null;
  let offreCreatedAt: string | null = null;

  // Calculate valeur_estimee and ddm_min for the offre
  const valeurEstimee = produits.reduce((s, p) => s + (p.prix_achat_ht || 0) * (p.stock || 0), 0);
  const ddmDates = produits
    .map(p => p.ddm ? new Date(String(p.ddm)) : null)
    .filter((d): d is Date => d !== null && !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  const ddmMin = ddmDates.length > 0 ? ddmDates[0].toISOString().slice(0, 10) : null;

  // #3: nb_references = valid products only (have nom AND prix_achat_ht)
  const nbReferences = produits.filter(p => p.nom && p.prix_achat_ht > 0).length;
  console.log('[mercuriale] Creating produits_offres with:', { source: fournisseur_nom, nb_references: nbReferences, valeur_estimee: Math.round(valeurEstimee), ddm_min: ddmMin, assigned_to });

  try {
    const { data: offreData, error: offreErr } = await supabase
      .from('produits_offres')
      .insert({
        source: fournisseur_nom,
        statut_traitement: 'nouvelle',
        nb_references: nbReferences,
        valeur_estimee: Math.round(valeurEstimee) || null,
        ddm_min: ddmMin,
        assigned_to: assigned_to || null,
      })
      .select('id, created_at')
      .single();

    console.log('[mercuriale] produits_offres INSERT result:', { offreData, offreErr: offreErr?.message ?? null });

    if (offreErr) {
      console.error('[mercuriale] produits_offres insert error:', offreErr.message, offreErr.code, offreErr.details);
      return NextResponse.json({ error: `Erreur création offre: ${offreErr.message}` }, { status: 500 });
    }
    offreId = offreData?.id ?? null;
    offreCreatedAt = offreData?.created_at ?? null;
    console.log('[mercuriale] offreId after INSERT:', offreId);
  } catch (e) {
    console.error('[mercuriale] produits_offres insert EXCEPTION:', e);
    return NextResponse.json({ error: 'Erreur création offre' }, { status: 500 });
  }

  if (!offreId) {
    console.error('[mercuriale] ABORT: offreId is null after successful INSERT — this should not happen');
    return NextResponse.json({ error: 'Impossible de créer l\'offre — offre_id null' }, { status: 500 });
  }

  // 2. Deduplicate — remove existing en_attente products for this offre
  if (offreId) {
    const { count } = await supabase
      .from('produits')
      .select('*', { count: 'exact', head: true })
      .eq('offre_id', offreId)
      .eq('statut', 'en_attente');
    if ((count ?? 0) > 0) {
      await supabase.from('produits').delete().eq('offre_id', offreId).eq('statut', 'en_attente');
    }
  } else if (offreCreatedAt && fournisseur_nom) {
    // Fallback: deduplicate by fournisseur_nom + created_at
    await supabase
      .from('produits')
      .delete()
      .eq('fournisseur_nom', fournisseur_nom)
      .eq('statut', 'en_attente')
      .gte('created_at', offreCreatedAt);
  }

  // 3. Build insert rows (normalize EAN before storage)
  const rows = produits.map(p => ({
    nom: p.nom,
    marque: p.marque,
    ean: normalizeEan(p.ean),
    prix_achat_wag_ht: p.prix_achat_ht,
    stock_disponible: p.stock,
    conditionnement: p.pcb,
    flux: flux === 'stock_wag' ? 'entrepot' : flux,
    dluo: p.ddm ? (() => { try { return new Date(String(p.ddm)).toISOString().slice(0,10); } catch { return null; } })() : null,
    tva_taux: p.tva,
    visible_catalogue: false,
    statut: 'en_attente',
    photo_statut: 'non_trouvee',
    fournisseur_nom: fournisseur_nom,
    ...(p.pmc_fournisseur ? { pmc_fournisseur: p.pmc_fournisseur } : {}),
    ...(fournisseurId ? { fournisseur_id: fournisseurId } : {}),
    offre_id: offreId,
  }));

  console.log('[mercuriale] offreId before upsert:', offreId, '| typeof:', typeof offreId);
  console.log('[mercuriale] rows[0].offre_id:', rows[0]?.offre_id, '| typeof:', typeof rows[0]?.offre_id);
  console.log('[mercuriale] rows with offre_id:', rows.filter(r => r.offre_id).length, '/', rows.length);
  console.log('[mercuriale] Insert payload sample:', JSON.stringify(rows[0]).slice(0, 500));

  // 4. Separate rows with EAN (can upsert) from rows without EAN (must deduplicate by nom)
  const rowsWithEan = rows.filter(r => !!r.ean);
  const rowsWithoutEan = rows.filter(r => !r.ean);

  const insertedIds: string[] = [];

  // 4a. Upsert rows with EAN — constraint produits_ean_offre_unique handles duplicates
  if (rowsWithEan.length > 0) {
    const { data: upserted, error: upsertErr } = await supabase
      .from('produits')
      .upsert(rowsWithEan, { onConflict: 'ean,offre_id', ignoreDuplicates: true })
      .select('id');
    if (upsertErr) {
      console.error('[mercuriale] Upsert error:', upsertErr.message);
      // Fallback: try plain insert if constraint doesn't exist yet
      const { data: fallback, error: fallbackErr } = await supabase
        .from('produits')
        .insert(rowsWithEan)
        .select('id');
      if (fallbackErr) {
        console.error('[mercuriale] Fallback insert error:', fallbackErr.message);
        return NextResponse.json({ error: fallbackErr.message }, { status: 500 });
      }
      insertedIds.push(...(fallback ?? []).map(r => r.id));
    } else {
      insertedIds.push(...(upserted ?? []).map(r => r.id));
    }
  }

  // 4b. Rows without EAN — deduplicate by (nom, offre_id) before inserting
  if (rowsWithoutEan.length > 0 && offreId) {
    const nomsToCheck = rowsWithoutEan.map(r => r.nom).filter(Boolean);
    const { data: existingNoms } = await supabase
      .from('produits')
      .select('nom')
      .eq('offre_id', offreId)
      .in('nom', nomsToCheck);
    const existingSet = new Set((existingNoms ?? []).map(e => e.nom));
    const newRows = rowsWithoutEan.filter(r => !existingSet.has(r.nom));
    if (newRows.length > 0) {
      const { data: inserted, error: insertErr } = await supabase
        .from('produits')
        .insert(newRows)
        .select('id');
      if (insertErr) {
        console.error('[mercuriale] Insert no-EAN error:', insertErr.message);
      } else {
        insertedIds.push(...(inserted ?? []).map(r => r.id));
      }
    }
  } else if (rowsWithoutEan.length > 0) {
    const { data: inserted, error: insertErr } = await supabase
      .from('produits')
      .insert(rowsWithoutEan)
      .select('id');
    if (!insertErr) {
      insertedIds.push(...(inserted ?? []).map(r => r.id));
    }
  }

  if (insertedIds.length === 0 && rows.length > 0) {
    return NextResponse.json({ success: true, nb_importes: 0, fournisseur_nom, offre_id: offreId });
  }

  console.log('[mercuriale] Insérés:', insertedIds.length, 'produits');

  // Update offre statut to 'en_cours' after successful import
  if (offreId && insertedIds.length > 0) {
    await supabase
      .from('produits_offres')
      .update({ statut_traitement: 'en_cours' })
      .eq('id', offreId);
  }

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
    offre_id: offreId,
  });
}
