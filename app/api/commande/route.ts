import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

interface LigneCommande {
  produit_id: string;
  nom: string;
  marque: string;
  nb_cartons: number;
  nb_unites: number;
  prix_wag_ht: number;
  tva_taux: number;
  total_ligne_ht: number;
}

interface CommandeBody {
  email: string;
  telephone: string;
  note?: string;
  produits: LigneCommande[];
  total_ht: number;
  remise_pct: number;
  total_apres_remise_ht: number;
}

/**
 * POST /api/commande
 * Enregistre une commande complète dans Supabase :
 * 1. INSERT commandes
 * 2. INSERT commandes_lignes
 * 3. INSERT notifications
 *
 * Tables SQL requises (à exécuter sur Supabase si pas encore fait) :
 *
 * CREATE TABLE IF NOT EXISTS commandes (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   email_acheteur text NOT NULL,
 *   telephone_acheteur text NOT NULL,
 *   note text,
 *   total_ht numeric NOT NULL,
 *   remise_pct numeric DEFAULT 0,
 *   total_apres_remise_ht numeric NOT NULL,
 *   statut text DEFAULT 'nouvelle',
 *   created_at timestamptz DEFAULT now()
 * );
 *
 * CREATE TABLE IF NOT EXISTS commandes_lignes (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   commande_id uuid REFERENCES commandes(id) ON DELETE CASCADE,
 *   produit_id text NOT NULL,
 *   nom_produit text,
 *   marque text,
 *   nb_cartons integer NOT NULL,
 *   nb_unites integer NOT NULL,
 *   prix_unitaire_ht numeric NOT NULL,
 *   tva_taux numeric DEFAULT 5.5,
 *   total_ligne_ht numeric NOT NULL
 * );
 *
 * CREATE TABLE IF NOT EXISTS notifications (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   type text NOT NULL,
 *   titre text NOT NULL,
 *   contenu text,
 *   destinataire_type text DEFAULT 'wag',
 *   lu boolean DEFAULT false,
 *   created_at timestamptz DEFAULT now()
 * );
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 });
  }

  let body: CommandeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 });
  }

  const { email, telephone, note, produits, total_ht, remise_pct, total_apres_remise_ht } = body;

  // Validation
  if (!email || !telephone) {
    return NextResponse.json({ error: 'Email et téléphone requis' }, { status: 400 });
  }
  if (!Array.isArray(produits) || produits.length === 0) {
    return NextResponse.json({ error: 'Au moins un produit requis' }, { status: 400 });
  }

  // Generate order number
  const year = new Date().getFullYear();
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  const numero = `WAG-${year}-${rand}`;

  // 1. INSERT commande
  const { data: commande, error: errCommande } = await supabase
    .from('commandes')
    .insert({
      email_acheteur: email,
      telephone_acheteur: telephone,
      note: note || null,
      total_ht,
      remise_pct,
      total_apres_remise_ht,
      statut: 'nouvelle',
    })
    .select('id')
    .single();

  if (errCommande || !commande) {
    console.error('[commande] Erreur insertion commande :', errCommande?.message);
    return NextResponse.json({ error: errCommande?.message || 'Erreur insertion commande' }, { status: 500 });
  }

  const commandeId = commande.id;

  // 2. INSERT lignes
  const lignes = produits.map(p => ({
    commande_id: commandeId,
    produit_id: p.produit_id,
    nom_produit: p.nom,
    marque: p.marque,
    nb_cartons: p.nb_cartons,
    nb_unites: p.nb_unites,
    prix_unitaire_ht: p.prix_wag_ht,
    tva_taux: p.tva_taux,
    total_ligne_ht: p.total_ligne_ht,
  }));

  const { error: errLignes } = await supabase
    .from('commandes_lignes')
    .insert(lignes);

  if (errLignes) {
    console.error('[commande] Erreur insertion lignes :', errLignes.message);
    // Commande créée mais lignes en erreur — on continue quand même
  }

  // 3. INSERT notification
  const { error: errNotif } = await supabase
    .from('notifications')
    .insert({
      type: 'nouvelle_commande',
      titre: `Nouvelle commande — ${Math.round(total_apres_remise_ht)}€ HT`,
      contenu: `Client: ${email} | ${produits.length} produit${produits.length > 1 ? 's' : ''} | ${Math.round(total_apres_remise_ht)}€ HT | ${numero}`,
      destinataire_type: 'wag',
      lu: false,
    });

  if (errNotif) {
    console.error('[commande] Erreur insertion notification :', errNotif.message);
    // Non bloquant
  }

  return NextResponse.json({
    success: true,
    commande_id: commandeId,
    numero,
  });
}
