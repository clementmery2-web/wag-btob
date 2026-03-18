import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// Vercel Pro: extend timeout to 30s (default is 10s)
export const maxDuration = 30;

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

const CLAUDE_PROMPT = `Tu es un expert en import de mercuriales fournisseurs.
Analyse ce tableau de données (extrait d'un fichier Excel) et extrait tous les produits.
Pour chaque produit, retourne un objet JSON avec :
{
  ref: string (référence produit),
  nom: string (nom complet du produit),
  marque: string (marque du produit),
  ean: string (code barre EAN13, "" si absent),
  prix_achat_ht: number (prix d'achat HT unitaire),
  pcb: number (colisage, unités par carton, 1 si non trouvé),
  stock: number (quantité disponible, 0 si non trouvé),
  ddm: string (format YYYY-MM-DD) ou null,
  tva: number (5.5 pour alimentaire, 20 pour non-alimentaire),
  poids: number (en kg) ou null
}
Colonnes possibles dans les mercuriales :
- Prix : 'prix', 'prix_uc', 'prix unitaire', 'prix achat', 'prix_antigaspi', 'tarif', 'pu', 'pa'
- Stock : 'stock', 'qté', 'quantite', 'disponible', 'qty'
- PCB : 'pcb', 'colisage', 'colis', 'carton', 'qmc', 'uvc'
- DDM : 'ddm', 'dluo', 'dlc', 'date limite', 'date'
- EAN : 'ean', 'code barre', 'barcode', 'gtin', 'ean13'
- Poids : 'poids', 'poids_net', 'grammage', 'contenance'
Si une colonne est ambiguë, faire la meilleure interprétation possible.

Extrait aussi si possible :
- fournisseur_nom : nom de l'entreprise fournisseur (souvent en en-tête du fichier, ou dans le nom de fichier, ou déduit des marques)
- fournisseur_email : email de contact si présent dans le fichier

Retourne UNIQUEMENT un objet JSON valide avec cette structure :
{
  "fournisseur_nom": string ou null,
  "fournisseur_email": string ou null,
  "produits": [{"ref":"...","nom":"..."}]
}
Pas d'explication, pas de markdown.`;

/**
 * POST /api/pricing/mercuriale
 * action=parse  → Parse Excel + Claude API → return products
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

  if (!file) {
    return NextResponse.json({ error: 'Fichier requis' }, { status: 400 });
  }

  console.log('[mercuriale] Fichier reçu:', file.name, file.size, 'bytes');
  const isLargeFile = file.size > 2 * 1024 * 1024; // > 2MB

  // 1. Parse Excel → CSV text (léger, pas de binaire vers Claude)
  const buffer = await file.arrayBuffer();
  let csvText: string;
  let totalRows = 0;
  let colonnes: string[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

    const allSheets: { feuille: string; csv: string; nbRows: number }[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      totalRows += Math.max(0, rows.length - 1); // exclude header
      const sample = rows.slice(0, 201); // header + 200 lignes max
      const sheetCsv = sample
        .map((r: unknown[]) => r.map(c => String(c ?? '').replace(/,/g, ';')).join(','))
        .join('\n');
      allSheets.push({ feuille: sheetName, csv: sheetCsv, nbRows: rows.length });

      // Extract column names from first sheet header
      if (colonnes.length === 0 && rows.length > 0) {
        colonnes = (rows[0] as unknown[]).map(c => String(c ?? ''));
      }
    }

    console.log('[mercuriale] Feuilles:', allSheets.map(s => `${s.feuille}(${s.nbRows} lignes)`).join(', '));

    // Merge sheets into one CSV text for Claude
    if (allSheets.length === 1) {
      csvText = allSheets[0].csv;
    } else {
      csvText = allSheets.map(s => `=== Feuille: ${s.feuille} ===\n${s.csv}`).join('\n\n');
    }

    console.log('[mercuriale] CSV text:', csvText.length, 'chars pour Claude');
  } catch (err) {
    console.error('[mercuriale] Erreur parsing Excel:', err);
    return NextResponse.json({ error: 'Impossible de lire le fichier Excel' }, { status: 400 });
  }

  if (totalRows === 0) {
    return NextResponse.json({ error: 'Fichier vide' }, { status: 400 });
  }

  // 2. Send CSV text to Claude API (pas de binaire)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[mercuriale] ANTHROPIC_API_KEY manquante');
    return NextResponse.json({ error: 'Clé API Claude non configurée' }, { status: 500 });
  }

  try {
    const truncNote = totalRows > 200 ? `\n⚠️ Fichier tronqué : ${totalRows} lignes totales, seules les 200 premières par feuille sont incluses.` : '';
    console.log('[mercuriale] Envoi à Claude API:', csvText.length, 'chars,', totalRows, 'lignes totales');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s max

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `${CLAUDE_PROMPT}\n\nNom du fichier: ${file.name}\nColonnes détectées: ${colonnes.join(', ')}${truncNote}\n\nDonnées CSV:\n${csvText}`,
        }],
      }),
    });

    clearTimeout(timeout);

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error('[mercuriale] Claude API error:', claudeRes.status, errText);
      return NextResponse.json({ error: `Erreur Claude API: ${claudeRes.status}` }, { status: 500 });
    }

    const claudeData = await claudeRes.json();
    const responseText = claudeData.content?.[0]?.text || '';
    console.log('[mercuriale] Réponse Claude:', responseText.length, 'chars');

    // Parse JSON from Claude response — expects { fournisseur_nom, fournisseur_email, produits: [...] }
    let produits: ProduitParse[];
    let fournisseurNomDetecte: string | null = null;
    let fournisseurEmailDetecte: string | null = null;
    try {
      // Try object format first: { fournisseur_nom, fournisseur_email, produits: [...] }
      const objMatch = responseText.match(/\{[\s\S]*\}/);
      if (objMatch) {
        const parsed = JSON.parse(objMatch[0]);
        if (parsed.produits && Array.isArray(parsed.produits)) {
          produits = parsed.produits;
          fournisseurNomDetecte = parsed.fournisseur_nom || null;
          fournisseurEmailDetecte = parsed.fournisseur_email || null;
        } else if (Array.isArray(parsed)) {
          produits = parsed;
        } else {
          throw new Error('Format inattendu');
        }
      } else {
        // Fallback: try array format
        const arrMatch = responseText.match(/\[[\s\S]*\]/);
        if (!arrMatch) throw new Error('Pas de JSON trouvé');
        produits = JSON.parse(arrMatch[0]);
      }
    } catch (parseErr) {
      console.error('[mercuriale] Erreur parsing réponse Claude:', parseErr);
      console.error('[mercuriale] Réponse brute:', responseText.slice(0, 500));
      return NextResponse.json({
        error: 'Impossible de parser la réponse de Claude',
        raw_response: responseText.slice(0, 1000),
      }, { status: 500 });
    }

    // Validate and clean products
    const cleanProduits = produits.map((p, i) => ({
      ref: String(p.ref || `REF-${i + 1}`),
      nom: String(p.nom || ''),
      marque: String(p.marque || ''),
      ean: String(p.ean || ''),
      prix_achat_ht: Math.max(0, Number(p.prix_achat_ht) || 0),
      pcb: Math.max(1, Math.round(Number(p.pcb) || 1)),
      stock: Math.max(0, Math.round(Number(p.stock) || 0)),
      ddm: p.ddm || null,
      tva: [5.5, 20].includes(Number(p.tva)) ? Number(p.tva) : 5.5,
      poids: p.poids ? Number(p.poids) : null,
    })).filter(p => p.nom && p.prix_achat_ht > 0);

    // Detect missing columns
    const alertes: string[] = [];
    if (cleanProduits.every(p => !p.ean)) alertes.push('Aucun code EAN détecté');
    if (cleanProduits.every(p => p.stock === 0)) alertes.push('Aucun stock détecté');
    if (cleanProduits.every(p => !p.ddm)) alertes.push('Aucune DDM/DLUO détectée');
    if (cleanProduits.every(p => p.pcb === 1)) alertes.push('Aucun PCB/colisage détecté');

    console.log('[mercuriale] Produits valides:', cleanProduits.length, '| Alertes:', alertes);

    if (isLargeFile) {
      alertes.push('Fichier volumineux — analyse limitée aux 200 premières lignes par feuille');
    }

    return NextResponse.json({
      success: true,
      produits: cleanProduits,
      nb_total: totalRows,
      nb_parses: cleanProduits.length,
      colonnes,
      alertes,
      fournisseur_nom: fournisseurNomDetecte,
      fournisseur_email: fournisseurEmailDetecte,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error('[mercuriale] Timeout Claude API (25s)');
      return NextResponse.json({ error: 'Timeout — le fichier est trop volumineux. Réessayez avec un fichier plus petit.' }, { status: 504 });
    }
    console.error('[mercuriale] Erreur générale:', err);
    return NextResponse.json({ error: 'Erreur lors de l\'analyse' }, { status: 500 });
  }
}

async function handleImport(body: {
  action: string;
  fournisseur_nom: string;
  fournisseur_email: string;
  flux: string;
  produits: ProduitParse[];
}) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 });
  }

  const { fournisseur_nom, fournisseur_email, flux, produits } = body;
  if (!produits || produits.length === 0) {
    return NextResponse.json({ error: 'Aucun produit à importer' }, { status: 400 });
  }

  console.log('[mercuriale] Import:', produits.length, 'produits pour', fournisseur_nom);

  // Calculate WAG pricing for each product
  const now = new Date().toISOString();
  const rows = produits.map(p => {
    const prixAchat = p.prix_achat_ht;
    const margeMin = flux === 'stock_wag' ? 0.20 : flux === 'dropshipping' ? 0.15 : 0.10;
    const prixVenteWag = Math.round((prixAchat / (1 - margeMin)) * 100) / 100;
    const margeWag = prixVenteWag > 0 ? Math.round(((prixVenteWag - prixAchat) / prixVenteWag) * 10000) / 100 : 0;

    return {
      nom: p.nom,
      marque: p.marque,
      ean: p.ean || null,
      contenance: p.poids ? `${p.poids}kg` : '',
      categorie: p.tva === 5.5 ? 'Alimentaire' : 'Hygiène & Entretien',
      prix_achat_ht: prixAchat,
      prix_vente_wag_ht: prixVenteWag,
      marge_wag_pct: margeWag,
      stock_disponible: p.stock,
      flux: flux === 'stock_wag' ? 'entrepot' : flux,
      dluo: p.ddm || null,
      tva_taux: p.tva,
      qmc: p.pcb,
      pcb: p.pcb,
      fournisseur_nom,
      fournisseur_email: fournisseur_email || null,
      visible_catalogue: false,
      statut: 'a_traiter',
      photo_statut: 'non_trouvee',
      created_at: now,
    };
  });

  const { data, error } = await supabase
    .from('produits')
    .insert(rows)
    .select('id, fournisseur_nom');

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
