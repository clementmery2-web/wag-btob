import { useState, useEffect, useCallback } from 'react'
import { panier, LignePanier } from './panier'

const PANIER_EVENT = 'panier-updated'

const dispatchUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PANIER_EVENT))
  }
}

export function usePanier() {
  const [lignes, setLignes] = useState<LignePanier[]>([])

  const refresh = useCallback(() => {
    setLignes(panier.get())
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener(PANIER_EVENT, refresh)
    return () => window.removeEventListener(PANIER_EVENT, refresh)
  }, [refresh])

  const add = useCallback((ligne: LignePanier) => {
    panier.add(ligne)
    dispatchUpdate()
  }, [])

  const remove = useCallback((produitId: string) => {
    panier.remove(produitId)
    dispatchUpdate()
  }, [])

  return { lignes, add, remove, count: lignes.length }
}
