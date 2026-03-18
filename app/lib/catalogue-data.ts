// Types pour le catalogue public acheteur
export interface CatalogueProduit {
  id: string;
  nom: string;
  marque: string;
  photo_url: string | null;
  categorie: string;
  contenance: string;
  prix_wag_ht: number;
  prix_gd_ht: number;
  remise_pct: number;
  marge_retail_estimee: number;
  ddm: string;
  min_commande: number;
  min_commande_unite: 'carton' | 'palette';
  stock_disponible: number;
  pmc_type: 'gd' | 'pharma_bio' | 'estime';
}

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

export const DEMO_CATALOGUE: CatalogueProduit[] = [
  // Épicerie salée
  { id: 'c1', nom: 'Thon entier albacore huile olive', marque: 'Petit Navire', photo_url: null, categorie: 'Épicerie salée', contenance: '200g', prix_wag_ht: 1.06, prix_gd_ht: 5.20, remise_pct: 80, marge_retail_estimee: 55, ddm: d(25), min_commande: 1, min_commande_unite: 'carton', stock_disponible: 1200, pmc_type: 'gd' },
  { id: 'c2', nom: 'Miettes de thon à la tomate', marque: 'Petit Navire', photo_url: null, categorie: 'Épicerie salée', contenance: '160g', prix_wag_ht: 0.65, prix_gd_ht: 2.85, remise_pct: 77, marge_retail_estimee: 52, ddm: d(45), min_commande: 1, min_commande_unite: 'carton', stock_disponible: 800, pmc_type: 'gd' },
  { id: 'c3', nom: 'Haricots verts extra-fins', marque: 'Bonduelle', photo_url: null, categorie: 'Épicerie salée', contenance: '800g', prix_wag_ht: 0.56, prix_gd_ht: 2.75, remise_pct: 80, marge_retail_estimee: 58, ddm: d(40), min_commande: 1, min_commande_unite: 'palette', stock_disponible: 2000, pmc_type: 'gd' },
  { id: 'c4', nom: 'Sardines huile d\'olive vierge extra', marque: 'Parmentier', photo_url: null, categorie: 'Épicerie salée', contenance: '135g', prix_wag_ht: 1.19, prix_gd_ht: 3.45, remise_pct: 66, marge_retail_estimee: 42, ddm: d(80), min_commande: 3, min_commande_unite: 'carton', stock_disponible: 600, pmc_type: 'gd' },
  // Épicerie sucrée
  { id: 'c5', nom: 'Biscuits sésame', marque: 'Gerblé', photo_url: null, categorie: 'Épicerie sucrée', contenance: '230g', prix_wag_ht: 0.75, prix_gd_ht: 3.45, remise_pct: 78, marge_retail_estimee: 54, ddm: d(20), min_commande: 1, min_commande_unite: 'carton', stock_disponible: 700, pmc_type: 'gd' },
  { id: 'c6', nom: 'Biscuits lait amande', marque: 'Gerblé', photo_url: null, categorie: 'Épicerie sucrée', contenance: '200g', prix_wag_ht: 0.50, prix_gd_ht: 3.25, remise_pct: 85, marge_retail_estimee: 60, ddm: d(75), min_commande: 1, min_commande_unite: 'carton', stock_disponible: 1000, pmc_type: 'gd' },
  { id: 'c7', nom: 'Sablés chocolat noir sans gluten', marque: 'Gerblé', photo_url: null, categorie: 'Épicerie sucrée', contenance: '200g', prix_wag_ht: 2.38, prix_gd_ht: 4.85, remise_pct: 51, marge_retail_estimee: 34, ddm: d(30), min_commande: 1, min_commande_unite: 'carton', stock_disponible: 300, pmc_type: 'pharma_bio' },
  // Boissons
  { id: 'c8', nom: 'Jus d\'orange 100% pur jus', marque: 'Tropicana', photo_url: null, categorie: 'Boissons', contenance: '1L', prix_wag_ht: 0.85, prix_gd_ht: 2.49, remise_pct: 66, marge_retail_estimee: 42, ddm: d(18), min_commande: 1, min_commande_unite: 'palette', stock_disponible: 1500, pmc_type: 'gd' },
  // Hygiène
  { id: 'c9', nom: 'Gel douche surgras', marque: 'Le Petit Marseillais', photo_url: null, categorie: 'Hygiène & Beauté', contenance: '250ml', prix_wag_ht: 0.75, prix_gd_ht: 2.89, remise_pct: 74, marge_retail_estimee: 48, ddm: d(200), min_commande: 3, min_commande_unite: 'carton', stock_disponible: 500, pmc_type: 'gd' },
  { id: 'c10', nom: 'Shampoing huile d\'argan bio', marque: 'Natessance', photo_url: null, categorie: 'Hygiène & Beauté', contenance: '500ml', prix_wag_ht: 3.20, prix_gd_ht: 8.90, remise_pct: 64, marge_retail_estimee: 40, ddm: d(120), min_commande: 1, min_commande_unite: 'carton', stock_disponible: 350, pmc_type: 'pharma_bio' },
  // Bébé
  { id: 'c11', nom: 'Couches taille 4 Maxi Pack', marque: 'Pampers', photo_url: null, categorie: 'Bébé', contenance: '92 couches', prix_wag_ht: 8.50, prix_gd_ht: 24.90, remise_pct: 66, marge_retail_estimee: 42, ddm: d(365), min_commande: 1, min_commande_unite: 'palette', stock_disponible: 400, pmc_type: 'gd' },
  // Entretien
  { id: 'c12', nom: 'Lessive liquide Fraîcheur', marque: 'Le Chat', photo_url: null, categorie: 'Entretien', contenance: '2L - 40 lavages', prix_wag_ht: 2.80, prix_gd_ht: 8.50, remise_pct: 67, marge_retail_estimee: 43, ddm: d(180), min_commande: 1, min_commande_unite: 'carton', stock_disponible: 600, pmc_type: 'gd' },
];
