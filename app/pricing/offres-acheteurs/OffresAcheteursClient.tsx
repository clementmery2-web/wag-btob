'use client'

import { useState } from 'react'

interface Offre {
  id: string
  marque: string | null
  nom_produit: string | null
  acheteur_enseigne: string
  acheteur_email: string
  prix_offre_ht: number
  quantite: number
  attribue: boolean
  expires_at: string | null
  produits: {
    nom: string
    stock_disponible: number
    prix_vente_wag_ht: number
  } | null
}

interface Props {
  offres: Offre[]
}

export function OffresAcheteursClient({ offres }: Props) {
  const [vue, setVue] = useState<'fournisseur' | 'acheteur'>('fournisseur')
  const [attribues, setAttribues] = useState<Set<string>>(new Set())

  const handleAttribuer = async (id: string) => {
    try {
      const res = await fetch(`/api/pricing/offres-acheteurs/${id}`, {
        method: 'PATCH'
      })
      if (!res.ok) {
        const data = await res.json()
        console.error('Erreur attribution:', data.error)
        return
      }
      setAttribues(prev => new Set([...prev, id]))
    } catch (e) {
      console.error('Erreur reseau attribution:', e)
    }
  }

  const parMarque = offres.reduce((acc, o) => {
    const key = o.marque || 'Sans marque'
    if (!acc[key]) acc[key] = []
    acc[key].push(o)
    return acc
  }, {} as Record<string, Offre[]>)

  const parAcheteur = offres.reduce((acc, o) => {
    const key = o.acheteur_enseigne
    if (!acc[key]) acc[key] = []
    acc[key].push(o)
    return acc
  }, {} as Record<string, Offre[]>)

  const qteLabel = (q: number) => `${q} carton${q > 1 ? 's' : ''}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Offres acheteurs</h1>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setVue('fournisseur')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              vue === 'fournisseur' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Par fournisseur
          </button>
          <button
            onClick={() => setVue('acheteur')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              vue === 'acheteur' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Par acheteur
          </button>
        </div>
      </div>

      {offres.length === 0 && (
        <div className="text-center py-16 text-sm text-gray-400">Aucune offre en attente</div>
      )}

      {/* ═══ VUE PAR FOURNISSEUR ═══ */}
      {vue === 'fournisseur' && Object.entries(parMarque).map(([marque, items]) => {
        const total = items.reduce((s, o) => s + o.prix_offre_ht * o.quantite, 0)
        return (
          <div key={marque} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900">{marque}</h2>
                <p className="text-xs text-gray-500">{items.length} offre{items.length > 1 ? 's' : ''}</p>
              </div>
              <span className="text-sm font-bold text-indigo-600">Total offres : {total.toFixed(0)} &euro; HT</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Produit</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Acheteur</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Prix offert</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Quantite</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(o => {
                  const estAttribue = attribues.has(o.id) || o.attribue
                  const txtCls = estAttribue ? 'text-gray-400' : ''
                  return (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className={`px-4 py-2 ${estAttribue ? 'text-gray-400' : 'text-gray-900'}`}>{o.nom_produit ?? o.produits?.nom ?? '-'}</td>
                      <td className={`px-4 py-2 ${estAttribue ? 'text-gray-400' : 'text-gray-600'}`}>{o.acheteur_enseigne}</td>
                      <td className={`px-4 py-2 text-right font-medium ${txtCls || 'text-gray-900'}`}>{o.prix_offre_ht.toFixed(2)} &euro;</td>
                      <td className={`px-4 py-2 text-right ${txtCls || 'text-gray-700'}`}>{qteLabel(o.quantite ?? 0)}</td>
                      <td className="px-4 py-2 text-center">
                        {estAttribue ? (
                          <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 500 }}>
                            &#10003; Attribuee
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAttribuer(o.id)}
                            style={{
                              background: '#4f46e5', color: 'white', border: 'none',
                              borderRadius: '6px', padding: '4px 10px',
                              fontSize: '12px', fontWeight: 500, cursor: 'pointer'
                            }}
                          >
                            Attribuer
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}

      {/* ═══ VUE PAR ACHETEUR ═══ */}
      {vue === 'acheteur' && Object.entries(parAcheteur).map(([enseigne, items]) => {
        const total = items.reduce((s, o) => s + o.prix_offre_ht * o.quantite, 0)
        return (
          <div key={enseigne} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900">{enseigne}</h2>
                <p className="text-xs text-gray-500">{items.length} offre{items.length > 1 ? 's' : ''}</p>
              </div>
              <span className="text-sm font-bold text-indigo-600">Total offre : {total.toFixed(0)} &euro; HT</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Produit</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Marque</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Prix offert</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Quantite</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(o => {
                  const estAttribue = attribues.has(o.id) || o.attribue
                  const txtCls = estAttribue ? 'text-gray-400' : ''
                  return (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className={`px-4 py-2 ${estAttribue ? 'text-gray-400' : 'text-gray-900'}`}>{o.nom_produit ?? '-'}</td>
                      <td className={`px-4 py-2 ${estAttribue ? 'text-gray-400' : 'text-gray-600'}`}>{o.marque ?? '-'}</td>
                      <td className={`px-4 py-2 text-right font-medium ${txtCls || 'text-gray-900'}`}>{o.prix_offre_ht.toFixed(2)} &euro;</td>
                      <td className={`px-4 py-2 text-right ${txtCls || 'text-gray-700'}`}>{qteLabel(o.quantite ?? 0)}</td>
                      <td className="px-4 py-2 text-center">
                        {estAttribue ? (
                          <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 500 }}>
                            &#10003; Attribuee
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAttribuer(o.id)}
                            style={{
                              background: '#4f46e5', color: 'white', border: 'none',
                              borderRadius: '6px', padding: '4px 10px',
                              fontSize: '12px', fontWeight: 500, cursor: 'pointer'
                            }}
                          >
                            Attribuer
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
