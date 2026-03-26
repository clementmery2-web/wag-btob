export interface LignePanier {
  produitId: string
  nom: string
  marque: string
  fournisseurId: string | null
  prixPlancher: number
  qmc: number
  dluo: string | null
  prixOffre: number | null
  quantite: number | null
}

const KEY = 'wag_panier'

export const panier = {
  get(): LignePanier[] {
    if (typeof window === 'undefined') return []
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]')
    } catch {
      return []
    }
  },

  add(ligne: LignePanier) {
    const items = panier.get()
    const idx = items.findIndex(i => i.produitId === ligne.produitId)
    if (idx >= 0) items[idx] = ligne
    else items.push(ligne)
    localStorage.setItem(KEY, JSON.stringify(items))
  },

  remove(produitId: string) {
    localStorage.setItem(KEY, JSON.stringify(panier.get().filter(i => i.produitId !== produitId)))
  },

  clear() {
    localStorage.removeItem(KEY)
  }
}
