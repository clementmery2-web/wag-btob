export type Statut = 'en_attente' | 'valide' | 'refuse' | 'nego_fournisseur' | 'en_nego' | 'archive'
export type Scenario = 'A' | 'B' | 'C' | 'D' | 'PMC_REQUIS'

export interface Produit {
  id: string
  nom: string
  marque: string | null
  ean: string | null
  categorie: string | null
  fournisseur_nom: string
  prix_achat_wag_ht: number
  prix_vente_wag_ht: number | null
  pmc_reference: number | null
  pmc_fournisseur: number | null
  dluo: string | null
  qmc: number | null
  stock_disponible: number | null
  statut: Statut
  visible_catalogue: boolean
  created_at: string
  offre_id: string | null
  archived_at: string | null
}

export interface ScenarioResult {
  scenario: Scenario
  pmc: number | null
  ratio: number | null
  gap: number | null
  pv: number | null
  multiplicateur: number | null
  marge: number | null
  cible: number | null
}

export interface GroupeFournisseur {
  nom: string
  offreId: string | null
  assigneA: string | null
  produits: Produit[]
  dateImport: Date
}
