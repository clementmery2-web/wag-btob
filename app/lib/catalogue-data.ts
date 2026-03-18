// Types pour le catalogue public acheteur
export type PhotoStatut = 'non_trouvee' | 'auto_trouvee' | 'validee' | 'upload_manuel';
export type PhotoSource = 'off' | 'obf' | 'opf' | 'upload' | null;
export type FluxType = 'stock_wag' | 'dropshipping' | 'transit';

export const DEFAULT_PALLETISATION = 40; // cartons/palette par défaut

export interface CatalogueProduit {
  id: string;
  nom: string;
  marque: string;
  photo_url: string | null;
  photo_statut: PhotoStatut;
  photo_source: PhotoSource;
  ean: string | null;
  categorie: string;
  contenance: string;
  prix_wag_ht: number;
  prix_gd_ht: number;
  remise_pct: number;
  marge_retail_estimee: number;
  ddm: string;
  // Logistique & QMC
  flux: FluxType;
  pcb: number;                      // unités par carton
  palletisation: number;            // cartons par palette
  min_commande: number;             // QMC calculé (en unité min_commande_unite)
  min_commande_unite: 'carton' | 'palette';
  min_cartons: number;              // pour affichage palette : nb cartons
  min_unites: number;               // total unités pour le minimum
  qmc_fournisseur: number;          // QMC fournisseur brut (palettes) — dropshipping
  fournisseur_nom: string | null;   // nom fournisseur — grouper dans panier
  stock_disponible: number;
  pmc_type: 'gd' | 'pharma_bio' | 'estime';
}

/** Emoji fallback par catégorie quand pas de photo */
export const CATEGORY_EMOJI: Record<string, string> = {
  'Épicerie salée': '\u{1F96B}',
  'Épicerie sucrée': '\u{1F96B}',
  'Boissons': '\u{1F964}',
  'Hygiène & Beauté': '\u{1F9F4}',
  'Bébé': '\u{1F37C}',
  'Entretien': '\u{1F9F9}',
  'Animaux': '\u{1F43E}',
  'Surgelés': '\u{1F96B}',
  'Frais': '\u{1F96B}',
};

export const CATEGORIES = [
  'Tout',
  'Épicerie salée',
  'Épicerie sucrée',
  'Boissons',
  'Hygiène & Beauté',
  'Bébé',
  'Entretien',
  'Animaux',
  'Surgelés',
  'Frais',
] as const;

function d(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

// Helper pour construire un produit démo avec calcul QMC automatique
function demoProd(base: {
  id: string; nom: string; marque: string; categorie: string; contenance: string;
  prix_wag_ht: number; prix_gd_ht: number; remise_pct: number; marge_retail_estimee: number;
  ddm: string; pcb: number; palletisation?: number; flux: FluxType;
  qmc_fournisseur?: number; fournisseur_nom?: string | null;
  stock_disponible: number; pmc_type: 'gd' | 'pharma_bio' | 'estime';
}): CatalogueProduit {
  const pall = base.palletisation || DEFAULT_PALLETISATION;
  const flux = base.flux;
  const qmcFourn = base.qmc_fournisseur || 1;

  let min_commande: number;
  let min_commande_unite: 'carton' | 'palette';
  let min_cartons: number;
  let min_unites: number;

  if (flux === 'dropshipping') {
    const palettes = Math.max(qmcFourn, 1);
    // Si stock < 1 palette → tout le stock
    const stockEnPalettes = Math.floor(base.stock_disponible / (pall * base.pcb));
    if (stockEnPalettes < 1) {
      min_commande_unite = 'carton';
      min_cartons = Math.ceil(base.stock_disponible / base.pcb);
      min_commande = min_cartons;
      min_unites = base.stock_disponible;
    } else {
      min_commande = palettes;
      min_commande_unite = 'palette';
      min_cartons = palettes * pall;
      min_unites = min_cartons * base.pcb;
    }
  } else {
    // stock_wag ou transit → 1 carton minimum
    min_commande = 1;
    min_commande_unite = 'carton';
    min_cartons = 1;
    min_unites = base.pcb;
  }

  return {
    id: base.id,
    nom: base.nom,
    marque: base.marque,
    photo_url: null,
    photo_statut: 'non_trouvee',
    photo_source: null,
    ean: null,
    categorie: base.categorie,
    contenance: base.contenance,
    prix_wag_ht: base.prix_wag_ht,
    prix_gd_ht: base.prix_gd_ht,
    remise_pct: base.remise_pct,
    marge_retail_estimee: base.marge_retail_estimee,
    ddm: base.ddm,
    flux,
    pcb: base.pcb,
    palletisation: pall,
    min_commande,
    min_commande_unite,
    min_cartons,
    min_unites,
    qmc_fournisseur: qmcFourn,
    fournisseur_nom: base.fournisseur_nom ?? null,
    stock_disponible: base.stock_disponible,
    pmc_type: base.pmc_type,
  };
}

export const DEMO_CATALOGUE: CatalogueProduit[] = [
  // Épicerie salée — Stock WAG
  demoProd({ id: 'c1', nom: 'Thon entier albacore huile olive', marque: 'Petit Navire', categorie: 'Épicerie salée', contenance: '200g', prix_wag_ht: 1.06, prix_gd_ht: 5.20, remise_pct: 80, marge_retail_estimee: 55, ddm: d(25), pcb: 12, flux: 'stock_wag', stock_disponible: 1200, pmc_type: 'gd' }),
  demoProd({ id: 'c2', nom: 'Miettes de thon à la tomate', marque: 'Petit Navire', categorie: 'Épicerie salée', contenance: '160g', prix_wag_ht: 0.65, prix_gd_ht: 2.85, remise_pct: 77, marge_retail_estimee: 52, ddm: d(45), pcb: 24, flux: 'stock_wag', stock_disponible: 800, pmc_type: 'gd' }),
  // Épicerie salée — Dropshipping
  demoProd({ id: 'c3', nom: 'Haricots verts extra-fins', marque: 'Bonduelle', categorie: 'Épicerie salée', contenance: '800g', prix_wag_ht: 0.56, prix_gd_ht: 2.75, remise_pct: 80, marge_retail_estimee: 58, ddm: d(40), pcb: 12, palletisation: 80, flux: 'dropshipping', qmc_fournisseur: 1, fournisseur_nom: 'Bonduelle Logistique', stock_disponible: 2000, pmc_type: 'gd' }),
  demoProd({ id: 'c4', nom: 'Sardines huile d\'olive vierge extra', marque: 'Parmentier', categorie: 'Épicerie salée', contenance: '135g', prix_wag_ht: 1.19, prix_gd_ht: 3.45, remise_pct: 66, marge_retail_estimee: 42, ddm: d(80), pcb: 30, palletisation: 60, flux: 'dropshipping', qmc_fournisseur: 1, fournisseur_nom: 'Parmentier Distribution', stock_disponible: 600, pmc_type: 'gd' }),
  // Épicerie sucrée — Transit WAG
  demoProd({ id: 'c5', nom: 'Biscuits sésame', marque: 'Gerblé', categorie: 'Épicerie sucrée', contenance: '230g', prix_wag_ht: 0.75, prix_gd_ht: 3.45, remise_pct: 78, marge_retail_estimee: 54, ddm: d(20), pcb: 8, flux: 'transit', fournisseur_nom: 'Nutrition & Santé', stock_disponible: 700, pmc_type: 'gd' }),
  demoProd({ id: 'c6', nom: 'Biscuits lait amande', marque: 'Gerblé', categorie: 'Épicerie sucrée', contenance: '200g', prix_wag_ht: 0.50, prix_gd_ht: 3.25, remise_pct: 85, marge_retail_estimee: 60, ddm: d(75), pcb: 8, flux: 'transit', fournisseur_nom: 'Nutrition & Santé', stock_disponible: 1000, pmc_type: 'gd' }),
  demoProd({ id: 'c7', nom: 'Sablés chocolat noir sans gluten', marque: 'Gerblé', categorie: 'Épicerie sucrée', contenance: '200g', prix_wag_ht: 2.38, prix_gd_ht: 4.85, remise_pct: 51, marge_retail_estimee: 34, ddm: d(30), pcb: 6, flux: 'stock_wag', stock_disponible: 300, pmc_type: 'pharma_bio' }),
  // Boissons — Dropshipping
  demoProd({ id: 'c8', nom: 'Jus d\'orange 100% pur jus', marque: 'Tropicana', categorie: 'Boissons', contenance: '1L', prix_wag_ht: 0.85, prix_gd_ht: 2.49, remise_pct: 66, marge_retail_estimee: 42, ddm: d(18), pcb: 6, palletisation: 100, flux: 'dropshipping', qmc_fournisseur: 1, fournisseur_nom: 'PepsiCo France', stock_disponible: 1500, pmc_type: 'gd' }),
  // Hygiène — Stock WAG
  demoProd({ id: 'c9', nom: 'Gel douche surgras', marque: 'Le Petit Marseillais', categorie: 'Hygiène & Beauté', contenance: '250ml', prix_wag_ht: 0.75, prix_gd_ht: 2.89, remise_pct: 74, marge_retail_estimee: 48, ddm: d(200), pcb: 12, flux: 'stock_wag', stock_disponible: 500, pmc_type: 'gd' }),
  demoProd({ id: 'c10', nom: 'Shampoing huile d\'argan bio', marque: 'Natessance', categorie: 'Hygiène & Beauté', contenance: '500ml', prix_wag_ht: 3.20, prix_gd_ht: 8.90, remise_pct: 64, marge_retail_estimee: 40, ddm: d(120), pcb: 6, flux: 'stock_wag', stock_disponible: 350, pmc_type: 'pharma_bio' }),
  // Bébé — Dropshipping
  demoProd({ id: 'c11', nom: 'Couches taille 4 Maxi Pack', marque: 'Pampers', categorie: 'Bébé', contenance: '92 couches', prix_wag_ht: 8.50, prix_gd_ht: 24.90, remise_pct: 66, marge_retail_estimee: 42, ddm: d(365), pcb: 4, palletisation: 48, flux: 'dropshipping', qmc_fournisseur: 1, fournisseur_nom: 'P&G Distribution', stock_disponible: 400, pmc_type: 'gd' }),
  // Entretien — Stock WAG
  demoProd({ id: 'c12', nom: 'Lessive liquide Fraîcheur', marque: 'Le Chat', categorie: 'Entretien', contenance: '2L - 40 lavages', prix_wag_ht: 2.80, prix_gd_ht: 8.50, remise_pct: 67, marge_retail_estimee: 43, ddm: d(180), pcb: 6, flux: 'stock_wag', stock_disponible: 600, pmc_type: 'gd' }),
];
