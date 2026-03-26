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

  const ratio = pa / pmc * 100
  const gap = (pa - pmc * 0.55) / pa * 100

  if (ratio < 30) {
    const pv = pmc * 0.40
    return { scenario: 'A', pmc, ratio, gap, pv, multiplicateur: pv / pa, marge: (pv - pa) / pv * 100, cible: null }
  }
  if (ratio <= 55) {
    const pv = pmc * 0.55
    return { scenario: 'B', pmc, ratio, gap, pv, multiplicateur: pv / pa, marge: (pv - pa) / pv * 100, cible: null }
  }
  if (gap <= 50) {
    return { scenario: 'C', pmc, ratio, gap, pv: null, multiplicateur: null, marge: null, cible: pmc * 0.55 / 1.15 }
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
