// Types pour le back-office pricing WAG
export interface Produit {
  id: string;
  offre_id: string;
  nom: string;
  marque: string;
  ean: string;
  contenance: string;
  stock_disponible: number;
  flux: 'entrepot' | 'dropshipping' | 'transit';
  ddm: string; // ISO date
  etat: 'intact' | 'declasse' | 'etiquette_abimee' | 'emballage_abime';
  photo_url: string | null;
  categorie: string;
  prix_achat_ht: number;
  pmc_ht: number | null;
  pmc_sources: PmcSource[];
  pmc_fiabilite: number; // 1-5
  prix_vente_wag_ht: number | null;
  marge_wag_pct: number | null;
  remise_vs_gd_pct: number | null;
  scenario: 'A' | 'B' | 'C' | 'D' | null;
  statut: 'a_traiter' | 'valide' | 'contre_offre' | 'refuse' | 'passe';
  note_interne: string;
  created_at: string;
  updated_at: string;
}

export interface PmcSource {
  enseigne: string;
  prix: number;
}

export interface Offre {
  id: string;
  fournisseur: string;
  date_reception: string;
  nb_produits: number;
  ddm_min: string;
  valeur_estimee: number;
  statut: 'nouvelle' | 'en_cours' | 'traitee' | 'envoyee';
  assigne_a: string | null;
  note_interne: string;
  score_urgence: number;
  priorite: 'rouge' | 'orange' | 'vert';
  produits: Produit[];
  created_at: string;
  updated_at: string;
}

export interface ActionLog {
  id: string;
  type: string;
  description: string;
  offre_id?: string;
  produit_id?: string;
  created_at: string;
}

export interface KPIs {
  offres_a_traiter: number;
  produits_en_ligne: number;
  ca_potentiel: number;
  engagement_potentiel: number;
  marge_wag_moyenne: number;
  taux_acceptation_contre_offres: number;
}

export interface Alerte {
  type: 'contre_offre_sans_reponse' | 'pmc_degrade' | 'fournisseur_sans_reponse';
  message: string;
  offre_id?: string;
  produit_id?: string;
  depuis: string;
}

export function calculerScoreUrgence(offre: { ddm_min: string; valeur_estimee: number; date_reception: string }): number {
  const now = new Date();
  const ddm = new Date(offre.ddm_min);
  const reception = new Date(offre.date_reception);
  const joursDdm = Math.max(0, Math.floor((ddm.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const heuresReception = Math.floor((now.getTime() - reception.getTime()) / (1000 * 60 * 60));
  return Math.min(100, Math.max(0, (100 - joursDdm * 2) + (offre.valeur_estimee / 1000) + (heuresReception * 3)));
}

export function getPriorite(score: number): 'rouge' | 'orange' | 'vert' {
  if (score > 80) return 'rouge';
  if (score >= 50) return 'orange';
  return 'vert';
}

export function calculerScenario(prixAchat: number, pmcHt: number): 'A' | 'B' | 'C' | 'D' {
  const ratio = prixAchat / pmcHt;
  if (ratio < 0.20) return 'A';
  if (ratio < 0.43) return 'B';
  if (ratio < 0.50) return 'C';
  return 'D';
}

export function calculerPrixVenteWag(prixAchat: number, flux: string, margeMin?: number): number {
  const marge = margeMin ?? (flux === 'entrepot' ? 0.20 : flux === 'dropshipping' ? 0.15 : 0.10);
  return Math.round((prixAchat / (1 - marge)) * 100) / 100;
}

export function calculerMargeWag(prixAchat: number, prixVente: number): number {
  if (prixVente === 0) return 0;
  return Math.round(((prixVente - prixAchat) / prixVente) * 10000) / 100;
}

export function calculerRemiseVsGd(prixVente: number, pmcHt: number): number {
  if (pmcHt === 0) return 0;
  return Math.round(((pmcHt - prixVente) / pmcHt) * 10000) / 100;
}

export function joursRestantsDdm(ddm: string): number {
  return Math.max(0, Math.floor((new Date(ddm).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

export function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
}

export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}
