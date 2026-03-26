'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase-client'

interface Props {
  produitId: string
}

export function MeilleureOffre({ produitId }: Props) {
  const [meilleure, setMeilleure] = useState<number | null>(null)

  const fetchMeilleure = useCallback(async () => {
    const { data } = await supabase
      .from('offres_acheteurs')
      .select('prix_offre_ht')
      .eq('produit_id', produitId)
      .eq('statut', 'en_attente')
      .order('prix_offre_ht', { ascending: false })
      .limit(1)
      .maybeSingle()

    setMeilleure(data?.prix_offre_ht ?? null)
  }, [produitId])

  useEffect(() => {
    fetchMeilleure()

    const channel = supabase
      .channel(`offres-${produitId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'offres_acheteurs',
        filter: `produit_id=eq.${produitId}`
      }, () => fetchMeilleure())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [produitId, fetchMeilleure])

  if (!meilleure) return (
    <p style={{ fontSize: 12, color: '#9ca3af' }}>
      Aucune offre
    </p>
  )

  return (
    <div>
      <p style={{ fontSize: 15, fontWeight: 500, color: '#3B6D11' }}>
        {meilleure.toFixed(2)} &euro; HT
      </p>
      <p style={{ fontSize: 11, color: '#9ca3af' }}>
        Mis &agrave; jour r&eacute;cemment
      </p>
    </div>
  )
}
