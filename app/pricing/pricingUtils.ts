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

export function calculerScenarioResult(
  produit: Produit,
  pmcEdits: Record<string, number | null>
): ScenarioResult {
  const pa = produit.prix_achat_wag_ht
  const pmc = getPMCEffectif(produit, pmcEdits)

  if (pmc === null) {
    return { scenario: 'PMC_REQUIS', pmc: null, ratio: null, gap: null, pv: null, multiplicateur: null, marge: null, cible: null }
  }

  const ratio = Math.round(pa / pmc * 100 * 10) / 10
  const gap = Math.round((pa - pmc * 0.55) / pa * 100 * 10) / 10

  if (ratio < 30) {
    const pv = Math.round(pmc * 0.40 * 100) / 100
    const multiplicateur = Math.round((pv / pa) * 100) / 100
    const marge = Math.round(((pv - pa) / pv * 100) * 10) / 10
    return { scenario: 'A', pmc, ratio, gap, pv, multiplicateur, marge, cible: null }
  }
  if (ratio <= 55) {
    const pv = Math.round(pmc * 0.55 * 100) / 100
    const multiplicateur = Math.round((pv / pa) * 100) / 100
    const marge = Math.round(((pv - pa) / pv * 100) * 10) / 10
    return { scenario: 'B', pmc, ratio, gap, pv, multiplicateur, marge, cible: null }
  }
  if (gap <= 50) {
    const cible = Math.round(pmc * 0.55 / 1.15 * 100) / 100
    return { scenario: 'C', pmc, ratio, gap, pv: null, multiplicateur: null, marge: null, cible }
  }
  return { scenario: 'D', pmc, ratio, gap, pv: null, multiplicateur: null, marge: null, cible: null }
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
