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
 * Classification A / B / C / D et calcul du PV WAG.
 *
 * - PA = toujours HT
 * - PMC = toujours TTC (pmc_fournisseur stocké en TTC, pas de conversion)
 * - Ratio = PA / PMC TTC (division directe)
 * - Prix retail discounter = PMC TTC × 0.70 (fixe, tous scénarios)
 *
 * Seuils :
 *   A (jackpot)  : ratio < 0.33  → PV WAG = PMC TTC × 0.467
 *   B (normal)   : ratio < 0.55  → PV WAG = PA × 1.25 (marge WAG 25%)
 *   C (négo)     : ratio < 0.70  → PV WAG cible = PA × 1.10 (marge WAG 10%)
 *   D (refus)    : ratio ≥ 0.70  → pas de PV
 *
 * Marges :
 *   Marge WAG = (PV - PA) / PA × 100
 *   Marge discounter = (Prix retail - PV) / PV × 100
 */
export function calculerScenarioResult(
  produit: Produit,
  pmcEdits: Record<string, number | null>
): ScenarioResult {
  const pa = produit.prix_achat_wag_ht
  const pmcTtc = getPMCEffectif(produit, pmcEdits)

  const empty: ScenarioResult = {
    scenario: 'PMC_REQUIS', pmc: null, ratio: null,
    pv: null, cible: null, prixRetail: null,
    margeWag: null, margeDiscounter: null
  }

  if (!pmcTtc || pmcTtc <= 0) return empty
  if (!pa || pa <= 0) return empty

  const ratioRaw = pa / pmcTtc
  const ratio = Math.round(ratioRaw * 1000) / 10
  const prixRetail = Math.round(pmcTtc * 0.70 * 100) / 100

  if (ratioRaw < 0.33) {
    const pv = Math.round(pmcTtc * 0.467 * 100) / 100
    const margeWag = Math.round(((pv - pa) / pa) * 1000) / 10
    const margeDiscounter = Math.round(((prixRetail - pv) / pv) * 1000) / 10
    return { scenario: 'A', pmc: pmcTtc, ratio, pv, cible: null, prixRetail, margeWag, margeDiscounter }
  }
  if (ratioRaw < 0.55) {
    const pv = Math.round(pa * 1.25 * 100) / 100
    const margeWag = 25.0
    const margeDiscounter = Math.round(((prixRetail - pv) / pv) * 1000) / 10
    return { scenario: 'B', pmc: pmcTtc, ratio, pv, cible: null, prixRetail, margeWag, margeDiscounter }
  }
  if (ratioRaw < 0.70) {
    const cible = Math.round(pa * 1.10 * 100) / 100
    const margeWag = 10.0
    const margeDiscounter = Math.round(((prixRetail - cible) / cible) * 1000) / 10
    return { scenario: 'C', pmc: pmcTtc, ratio, pv: null, cible, prixRetail, margeWag, margeDiscounter }
  }
  return { scenario: 'D', pmc: pmcTtc, ratio, pv: null, cible: null, prixRetail, margeWag: null, margeDiscounter: null }
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
