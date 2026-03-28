import type { Produit, ScenarioResult } from './types'

export function getPMCEffectif(
  produit: Produit,
  pmcEdits: Record<string, number | null>
): number | null {
  if (produit.id in pmcEdits) {
    const edited = pmcEdits[produit.id]
    return (edited != null && edited > 0) ? edited : null
  }
  if (produit.pmc_fournisseur != null && produit.pmc_fournisseur > 0) {
    return produit.pmc_fournisseur
  }
  if (produit.pmc_reference != null && produit.pmc_reference > 0) {
    return produit.pmc_reference
  }
  return null
}

/**
 * K_dluo — coefficient de décote selon le flux et la durée de vie restante (DDM).
 *
 *  - Dropshipping : toujours 0.48 (pas de stock, pas de risque DDM)
 *  - Entrepôt / Transit :
 *      > 90 j → 0.48
 *      > 30 j → 0.40
 *      > 15 j → 0.32
 *      ≤ 15 j → 0.25
 *  - Pas de DDM renseignée → 0.48 par défaut
 */
export function calculerKDluo(flux: string | undefined, dluo: string | null): number {
  if (!flux || flux === 'dropshipping') return 0.48
  if (!dluo) return 0.48
  const jours = Math.floor((new Date(dluo).getTime() - Date.now()) / 86400000)
  if (jours > 90) return 0.48
  if (jours > 30) return 0.40
  if (jours > 15) return 0.32
  return 0.25
}

/**
 * Classification A / B / C / D et calcul du PV B2B.
 *
 * PMC issu de getPMCEffectif() est en HT (pmc_fournisseur provient de la
 * colonne « PMC HT » du fichier mercuriale ; pmc_reference est stocké HT
 * en base — cf. mapToBackofficeProduit qui calcule pmc_ttc_gd = pmc × (1 + TVA)).
 * Si un jour le PMC entrait en TTC, il faudrait diviser par (1 + tva_taux/100)
 * avant le calcul du ratio.
 *
 * ratio = PA / (PMC_HT × K_dluo)
 *   A  : ratio < 20 %  → PV = PMC_HT × K_dluo × 0.40
 *   B  : ratio < 43 %  → PV = PMC_HT × K_dluo × 0.48
 *   C  : ratio < 50 %  → cible = PMC_HT × K_dluo × (0.48 / 1.15)
 *   D  : ratio ≥ 50 %  → REFUS
 */
export function calculerScenarioResult(
  produit: Produit,
  pmcEdits: Record<string, number | null>
): ScenarioResult {
  const pa = produit.prix_achat_wag_ht
  const pmcHt = getPMCEffectif(produit, pmcEdits)
  const empty: ScenarioResult = { scenario: 'PMC_REQUIS', pmc: null, kdluo: null, ratio: null, gap: null, pv: null, multiplicateur: null, marge: null, cible: null }

  if (pmcHt === null) return empty

  const kdluo = calculerKDluo(produit.flux, produit.dluo)
  const prixRef = pmcHt * kdluo
  if (prixRef === 0) return empty

  const ratioRaw = pa / prixRef
  const ratio = Math.round(ratioRaw * 1000) / 10   // e.g. 0.1953 → 19.5 %
  const gap = Math.round((pa - pmcHt * 0.48) / pa * 100 * 10) / 10

  if (ratioRaw < 0.20) {
    let pv = Math.round(pmcHt * kdluo * 0.40 * 100) / 100
    pv = Math.max(pv, Math.round(pa * 1.01 * 100) / 100) // PV never below PA
    const multiplicateur = Math.round((pv / pa) * 100) / 100
    const marge = Math.round(((pv - pa) / pv * 100) * 10) / 10
    return { scenario: 'A', pmc: pmcHt, kdluo, ratio, gap, pv, multiplicateur, marge, cible: null }
  }
  if (ratioRaw < 0.43) {
    let pv = Math.round(pmcHt * kdluo * 0.48 * 100) / 100
    pv = Math.max(pv, Math.round(pa * 1.01 * 100) / 100) // PV never below PA
    const multiplicateur = Math.round((pv / pa) * 100) / 100
    const marge = Math.round(((pv - pa) / pv * 100) * 10) / 10
    return { scenario: 'B', pmc: pmcHt, kdluo, ratio, gap, pv, multiplicateur, marge, cible: null }
  }
  if (ratioRaw < 0.50) {
    let cible = Math.round(pmcHt * kdluo * (0.48 / 1.15) * 100) / 100
    cible = Math.max(cible, Math.round(pa * 1.01 * 100) / 100) // cible never below PA
    return { scenario: 'C', pmc: pmcHt, kdluo, ratio, gap, pv: null, multiplicateur: null, marge: null, cible }
  }
  return { scenario: 'D', pmc: pmcHt, kdluo, ratio, gap, pv: null, multiplicateur: null, marge: null, cible: null }
}

export function formaterDate(isoString: string | null): string {
  if (!isoString) return '\u2014'
  const [y, m, d] = isoString.split('-')
  return `${d}/${m}/${y}`
}

export function calculerJoursDDM(dluo: string | null): number | null {
  if (!dluo) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiration = new Date(dluo)
  expiration.setHours(0, 0, 0, 0)
  return Math.round((expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

// Plages raisonnables pour les prix WAG
export const PRIX_LIMITES = {
  PA_MIN: 0.10,
  PA_MAX: 500,
  PMC_MIN: 0.30,
  PMC_MAX: 50,
  PV_MIN: 0.10,
  PV_MAX: 300,
}

export const formaterPrixEuro = (val: number | null | undefined): string => {
  if (val == null) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

export const validerPrix = (
  val: number,
  type: 'PA' | 'PMC' | 'PV'
): { valide: boolean; warning: string | null } => {
  const limites = {
    PA:  { min: PRIX_LIMITES.PA_MIN,  max: PRIX_LIMITES.PA_MAX },
    PMC: { min: PRIX_LIMITES.PMC_MIN, max: PRIX_LIMITES.PMC_MAX },
    PV:  { min: PRIX_LIMITES.PV_MIN,  max: PRIX_LIMITES.PV_MAX },
  }
  const { min, max } = limites[type]
  if (val < min) return {
    valide: false,
    warning: `Valeur trop basse (${formaterPrixEuro(val)}) — minimum attendu ${formaterPrixEuro(min)}`
  }
  if (val > max) return {
    valide: false,
    warning: `Valeur inhabituelle (${formaterPrixEuro(val)}) — vérifier le séparateur décimal`
  }
  return { valide: true, warning: null }
}
