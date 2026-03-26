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
    await fetch(`/api/pricing/offres-acheteurs/${id}`, { method: 'PATCH' })
    setAttribues(prev => new Set([...prev, id]))
  }

  const getExpire = (expiresAt: string | null) => {
    if (!expiresAt) return 'Sans delai'
    const h = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 3600000)
    return h > 0 ? `${h}h` : 'Expire'
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

      {vue === 'fournisseur' && Object.entries(parMarque).map(([marque, items]) => (
        <div key={marque} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-900">{marque}</h2>
            <p className="text-xs text-gray-500">{items.length} offre{items.length > 1 ? 's' : ''}</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Produit</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Acheteur</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Prix offre</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Quantite</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Expire</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{o.nom_produit ?? o.produits?.nom ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-600">{o.acheteur_enseigne}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{o.prix_offre_ht.toFixed(2)} &euro;</td>
                  <td className="px-4 py-2 text-right text-gray-700">{o.quantite}</td>
                  <td className="px-4 py-2 text-center text-xs text-gray-500">{getExpire(o.expires_at)}</td>
                  <td className="px-4 py-2 text-center">
                    {attribues.has(o.id) || o.attribue ? (
                      <span className="text-xs font-medium text-green-600">Attribue</span>
                    ) : (
                      <button
                        onClick={() => handleAttribuer(o.id)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1 rounded-md transition-colors"
                      >
                        Attribuer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {vue === 'acheteur' && Object.entries(parAcheteur).map(([enseigne, items]) => {
        const ca = items.reduce((s, o) => s + o.prix_offre_ht * o.quantite, 0)
        return (
          <div key={enseigne} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900">{enseigne}</h2>
                <p className="text-xs text-gray-500">{items.length} offre{items.length > 1 ? 's' : ''}</p>
              </div>
              <span className="text-sm font-bold text-indigo-600">CA pot. {ca.toFixed(0)} &euro;</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Produit</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Marque</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Prix offre</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Quantite</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">{o.nom_produit ?? '-'}</td>
                    <td className="px-4 py-2 text-gray-600">{o.marque ?? '-'}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">{o.prix_offre_ht.toFixed(2)} &euro;</td>
                    <td className="px-4 py-2 text-right text-gray-700">{o.quantite}</td>
                    <td className="px-4 py-2 text-center">
                      {attribues.has(o.id) || o.attribue ? (
                        <span className="text-xs font-medium text-green-600">Attribue</span>
                      ) : (
                        <button
                          onClick={() => handleAttribuer(o.id)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1 rounded-md transition-colors"
                        >
                          Attribuer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
