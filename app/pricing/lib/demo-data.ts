import { Offre, Produit, ActionLog, Alerte, PmcSource, PmcType, calculerScoreUrgence, getPriorite, calculerScenario, calculerPrixVenteWag, calculerMargeWag, calculerRemiseVsGd, detecterPmcType, calculerFiabilitePmc } from './types';

function d(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

function dAgo(daysAgo: number): string {
  return d(-daysAgo);
}

function buildProduit(partial: Partial<Produit> & { nom: string; marque: string; ean: string; prix_achat_wag_ht?: number; prix_achat_ht?: number; pmc_ht: number }): Produit {
  const prixAchat = partial.prix_achat_wag_ht ?? partial.prix_achat_ht ?? 0;
  const scenario = calculerScenario(prixAchat, partial.pmc_ht);
  const flux = partial.flux ?? 'entrepot';
  const prixVente = calculerPrixVenteWag(prixAchat, flux);

  // Build PMC sources with type
  const defaultSources: PmcSource[] = [
    { enseigne: 'Carrefour', prix: partial.pmc_ht * 1.05, type: 'gd' as PmcType },
    { enseigne: 'Leclerc', prix: partial.pmc_ht * 0.95, type: 'gd' as PmcType },
    { enseigne: 'Lidl', prix: partial.pmc_ht * 0.98, type: 'gd' as PmcType },
  ];
  const sources = partial.pmc_sources ?? defaultSources;
  const pmcType = partial.pmc_type ?? detecterPmcType(sources);
  const fiabilite = partial.pmc_fiabilite ?? calculerFiabilitePmc(sources, pmcType);

  return {
    id: partial.id ?? crypto.randomUUID(),
    offre_id: partial.offre_id ?? '',
    nom: partial.nom,
    marque: partial.marque,
    ean: partial.ean,
    contenance: partial.contenance ?? '400g',
    stock_disponible: partial.stock_disponible ?? 500,
    flux,
    ddm: partial.ddm ?? d(60),
    etat: partial.etat ?? 'intact',
    photo_url: null,
    categorie: partial.categorie ?? 'Épicerie',
    prix_achat_wag_ht: prixAchat,
    pmc_ht: partial.pmc_ht,
    pmc_reference: partial.pmc_ht,
    pmc_ttc_gd: null,
    tva_taux: 5.5,
    pmc_type: pmcType,
    pmc_sources: sources,
    pmc_fiabilite: fiabilite,
    prix_vente_wag_ht: prixVente,
    marge_wag_pct: calculerMargeWag(prixAchat, prixVente),
    remise_vs_gd_pct: calculerRemiseVsGd(prixVente, partial.pmc_ht),
    scenario,
    statut: partial.statut ?? 'a_traiter',
    note_interne: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ═══ OFFRE 1 : Thai Union — 8 conserves poisson ═══
const produitsThaiUnion: Produit[] = [
  buildProduit({ id: 'p1', nom: 'Thon entier albacore huile olive', marque: 'Petit Navire', ean: '3023084034008', contenance: '200g', prix_achat_ht: 0.85, pmc_ht: 5.20, stock_disponible: 1200, ddm: d(25), categorie: 'Épicerie salée', pmc_fiabilite: 5 }),
  buildProduit({ id: 'p2', nom: 'Miettes de thon à la tomate', marque: 'Petit Navire', ean: '3023084034015', contenance: '160g', prix_achat_ht: 0.52, pmc_ht: 2.85, stock_disponible: 800, ddm: d(45), categorie: 'Épicerie salée', pmc_fiabilite: 4 }),
  buildProduit({ id: 'p3', nom: 'Sardines huile d\'olive vierge extra', marque: 'Parmentier', ean: '3263670017014', contenance: '135g', prix_achat_ht: 0.95, pmc_ht: 3.45, stock_disponible: 600, ddm: d(80), categorie: 'Épicerie salée', pmc_fiabilite: 4 }),
  buildProduit({ id: 'p4', nom: 'Maquereaux moutarde', marque: 'Petit Navire', ean: '3023084034022', contenance: '175g', prix_achat_ht: 1.40, pmc_ht: 3.10, stock_disponible: 400, ddm: d(15), etat: 'etiquette_abimee', categorie: 'Épicerie salée', pmc_fiabilite: 3 }),
  buildProduit({ id: 'p5', nom: 'Thon listao naturel', marque: 'John West', ean: '5000171043214', contenance: '200g', prix_achat_ht: 2.10, pmc_ht: 4.20, stock_disponible: 300, ddm: d(120), categorie: 'Épicerie salée', pmc_fiabilite: 3 }),
  buildProduit({ id: 'p6', nom: 'Rillettes de saumon', marque: 'Petit Navire', ean: '3023084034039', contenance: '125g', prix_achat_ht: 0.60, pmc_ht: 3.89, stock_disponible: 450, ddm: d(35), categorie: 'Épicerie salée', pmc_fiabilite: 5 }),
  buildProduit({ id: 'p7', nom: 'Filets de maquereaux sauce curry', marque: 'Saupiquet', ean: '3049580542103', contenance: '169g', prix_achat_ht: 1.80, pmc_ht: 3.25, stock_disponible: 350, ddm: d(55), etat: 'emballage_abime', categorie: 'Épicerie salée', pmc_fiabilite: 4 }),
  buildProduit({ id: 'p8', nom: 'Thon albacore huile tournesol', marque: 'Petit Navire', ean: '3023084034046', contenance: '140g', prix_achat_ht: 0.70, pmc_ht: 2.95, stock_disponible: 900, ddm: d(70), categorie: 'Épicerie salée', pmc_fiabilite: 5 }),
];

// ═══ OFFRE 2 : Bonduelle — 5 produits légumes ═══
const produitsBonduelle: Produit[] = [
  buildProduit({ id: 'p9', nom: 'Haricots verts extra-fins', marque: 'Bonduelle', ean: '3083681025064', contenance: '800g', prix_achat_ht: 0.45, pmc_ht: 2.75, stock_disponible: 2000, ddm: d(40), categorie: 'Épicerie salée', pmc_fiabilite: 5 }),
  buildProduit({ id: 'p10', nom: 'Maïs doux sous vide', marque: 'Bonduelle', ean: '3083681025071', contenance: '300g', prix_achat_ht: 0.80, pmc_ht: 1.95, stock_disponible: 1500, ddm: d(90), categorie: 'Épicerie salée', pmc_fiabilite: 5 }),
  buildProduit({ id: 'p11', nom: 'Petits pois carottes', marque: 'Bonduelle', ean: '3083681025088', contenance: '530g', prix_achat_ht: 1.20, pmc_ht: 2.30, stock_disponible: 800, ddm: d(10), categorie: 'Épicerie salée', pmc_fiabilite: 4 }),
  buildProduit({ id: 'p12', nom: 'Légumes pour couscous', marque: 'Bonduelle', ean: '3083681025095', contenance: '660g', prix_achat_ht: 0.55, pmc_ht: 3.15, stock_disponible: 600, ddm: d(65), categorie: 'Épicerie salée', flux: 'dropshipping', pmc_fiabilite: 3 }),
  buildProduit({ id: 'p13', nom: 'Champignons de Paris émincés', marque: 'Bonduelle', ean: '3083681025101', contenance: '400g', prix_achat_ht: 1.55, pmc_ht: 2.89, stock_disponible: 400, ddm: d(50), etat: 'declasse', categorie: 'Épicerie salée', pmc_fiabilite: 4 }),
];

// ═══ OFFRE 3 : Gerblé — 6 biscuits (mix GD + Pharma/Bio) ═══
const produitsGerble: Produit[] = [
  // Produits trouvés en GD classique
  buildProduit({ id: 'p14', nom: 'Biscuits sésame', marque: 'Gerblé', ean: '3175681105201', contenance: '230g', prix_achat_ht: 0.60, pmc_ht: 3.45, stock_disponible: 700, ddm: d(20), categorie: 'Épicerie sucrée' }),
  buildProduit({ id: 'p15', nom: 'Galettes riz complet chocolat', marque: 'Gerblé', ean: '3175681105218', contenance: '140g', prix_achat_ht: 0.85, pmc_ht: 2.79, stock_disponible: 500, ddm: d(100), categorie: 'Épicerie sucrée' }),
  // Produits trouvés uniquement en pharmacie/bio (pas en GD)
  buildProduit({
    id: 'p16', nom: 'Sablés nappés chocolat noir sans gluten', marque: 'Gerblé', ean: '3175681105225', contenance: '200g',
    prix_achat_ht: 1.90, pmc_ht: 4.85, stock_disponible: 300, ddm: d(30), etat: 'etiquette_abimee', categorie: 'Épicerie sucrée',
    pmc_type: 'pharma_bio' as PmcType,
    pmc_sources: [
      { enseigne: 'Cocooncenter.com', prix: 4.95, type: 'pharma_bio' as PmcType },
      { enseigne: 'Onatera.com', prix: 4.75, type: 'pharma_bio' as PmcType },
      { enseigne: 'Boutiquebio.fr', prix: 4.89, type: 'pharma_bio' as PmcType },
    ],
  }),
  buildProduit({ id: 'p17', nom: 'Biscuits lait amande', marque: 'Gerblé', ean: '3175681105232', contenance: '200g', prix_achat_ht: 0.40, pmc_ht: 3.25, stock_disponible: 1000, ddm: d(75), categorie: 'Épicerie sucrée' }),
  // Produit pharma/bio — barres diététiques
  buildProduit({
    id: 'p18', nom: 'Barres céréales chocolat protéinées', marque: 'Gerblé', ean: '3175681105249', contenance: '132g',
    prix_achat_ht: 1.65, pmc_ht: 5.20, stock_disponible: 450, ddm: d(55), categorie: 'Épicerie sucrée', flux: 'dropshipping',
    pmc_type: 'pharma_bio' as PmcType,
    pmc_sources: [
      { enseigne: 'Pharmaciedesdrakkars.com', prix: 5.30, type: 'pharma_bio' as PmcType },
      { enseigne: 'Cocooncenter.com', prix: 5.10, type: 'pharma_bio' as PmcType },
    ],
  }),
  // Produit avec PMC estimé (introuvable en GD et pharma)
  buildProduit({
    id: 'p19', nom: 'Cookies pépites chocolat sans gluten bio', marque: 'Gerblé', ean: '3175681105256', contenance: '150g',
    prix_achat_ht: 1.10, pmc_ht: 4.15, stock_disponible: 250, ddm: d(45), categorie: 'Épicerie sucrée',
    pmc_type: 'estime' as PmcType,
    pmc_sources: [
      { enseigne: 'Google Shopping', prix: 4.15, type: 'estime' as PmcType },
    ],
  }),
];

// Assign offre_ids
produitsThaiUnion.forEach(p => p.offre_id = 'o1');
produitsBonduelle.forEach(p => p.offre_id = 'o2');
produitsGerble.forEach(p => p.offre_id = 'o3');

function buildOffre(id: string, fournisseur: string, daysAgo: number, produits: Produit[], statut: Offre['statut']): Offre {
  const ddmMin = produits.reduce((min, p) => p.ddm < min ? p.ddm : min, produits[0].ddm);
  const valeur = produits.reduce((sum, p) => sum + p.prix_achat_wag_ht * p.stock_disponible, 0);
  const dateReception = dAgo(daysAgo);
  const score = calculerScoreUrgence({ ddm_min: ddmMin, valeur_estimee: valeur, date_reception: dateReception });
  return {
    id,
    fournisseur,
    date_reception: dateReception,
    nb_produits: produits.length,
    ddm_min: ddmMin,
    valeur_estimee: Math.round(valeur),
    statut,
    assigne_a: null,
    note_interne: '',
    score_urgence: Math.round(score),
    priorite: getPriorite(score),
    produits,
    created_at: dateReception,
    updated_at: new Date().toISOString(),
  };
}

export const DEMO_OFFRES: Offre[] = [
  buildOffre('o1', 'Thai Union (Petit Navire / Parmentier)', 1, produitsThaiUnion, 'nouvelle'),
  buildOffre('o2', 'Bonduelle', 3, produitsBonduelle, 'en_cours'),
  buildOffre('o3', 'Gerblé (Nutrition & Santé)', 0, produitsGerble, 'nouvelle'),
];

export const DEMO_ACTIONS: ActionLog[] = [
  { id: 'a1', type: 'offre_recue', description: 'Nouvelle offre reçue de Gerblé — 6 produits', offre_id: 'o3', created_at: dAgo(0) + 'T09:30:00Z' },
  { id: 'a2', type: 'traitement', description: 'Traitement en cours offre Bonduelle — 2/5 produits traités', offre_id: 'o2', created_at: dAgo(1) + 'T14:00:00Z' },
  { id: 'a3', type: 'offre_recue', description: 'Nouvelle offre reçue de Thai Union — 8 produits', offre_id: 'o1', created_at: dAgo(1) + 'T10:15:00Z' },
  { id: 'a4', type: 'prix_ajuste', description: 'PMC corrigé manuellement — Maïs doux Bonduelle', produit_id: 'p10', created_at: dAgo(2) + 'T16:45:00Z' },
  { id: 'a5', type: 'contre_offre', description: 'Contre-offre envoyée — Maquereaux moutarde Petit Navire', produit_id: 'p4', created_at: dAgo(2) + 'T11:20:00Z' },
  { id: 'a6', type: 'validation', description: 'Thon albacore Petit Navire validé et mis en ligne', produit_id: 'p8', created_at: dAgo(3) + 'T09:00:00Z' },
  { id: 'a7', type: 'refus', description: 'Thon listao John West — refusé (scénario D)', produit_id: 'p5', created_at: dAgo(3) + 'T10:30:00Z' },
  { id: 'a8', type: 'offre_recue', description: 'Offre Bonduelle assignée — 5 produits légumes', offre_id: 'o2', created_at: dAgo(3) + 'T08:00:00Z' },
  { id: 'a9', type: 'prix_ajuste', description: 'Prix de vente ajusté — Rillettes de saumon', produit_id: 'p6', created_at: dAgo(4) + 'T15:30:00Z' },
  { id: 'a10', type: 'validation', description: 'Sardines Parmentier validées et mises en ligne', produit_id: 'p3', created_at: dAgo(4) + 'T13:00:00Z' },
];

export const DEMO_ALERTES: Alerte[] = [
  { type: 'contre_offre_sans_reponse', message: 'Contre-offre Thai Union sans réponse depuis 26h', offre_id: 'o1', depuis: dAgo(1) + 'T10:00:00Z' },
  { type: 'pmc_degrade', message: 'PMC baissé de 12% sur Maïs doux Bonduelle', produit_id: 'p10', depuis: dAgo(0) + 'T08:00:00Z' },
  { type: 'fournisseur_sans_reponse', message: 'Bonduelle sans réponse depuis 52h', offre_id: 'o2', depuis: dAgo(2) + 'T14:00:00Z' },
];

export function getDemoKPIs(): { offres_a_traiter: number; produits_en_ligne: number; ca_potentiel: number; engagement_potentiel: number; marge_wag_moyenne: number; taux_acceptation_contre_offres: number } {
  const tousLesProduits = DEMO_OFFRES.flatMap(o => o.produits);
  const aTraiter = DEMO_OFFRES.filter(o => o.statut === 'nouvelle' || o.statut === 'en_cours').length;
  const enLigne = tousLesProduits.filter(p => p.statut === 'valide').length;
  const ca = tousLesProduits.reduce((s, p) => s + (p.prix_vente_wag_ht ?? 0) * p.stock_disponible, 0);
  const engagement = tousLesProduits.reduce((s, p) => s + p.prix_achat_wag_ht * p.stock_disponible, 0);
  const marges = tousLesProduits.filter(p => p.marge_wag_pct !== null).map(p => p.marge_wag_pct!);
  const margeMoy = marges.length ? marges.reduce((a, b) => a + b, 0) / marges.length : 0;
  return {
    offres_a_traiter: aTraiter,
    produits_en_ligne: enLigne || 3,
    ca_potentiel: Math.round(ca),
    engagement_potentiel: Math.round(engagement),
    marge_wag_moyenne: Math.round(margeMoy * 10) / 10,
    taux_acceptation_contre_offres: 42,
  };
}
