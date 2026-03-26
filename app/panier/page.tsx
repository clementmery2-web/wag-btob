'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { panier, LignePanier } from '@/lib/panier'
import { supabase } from '@/lib/supabase-client'
import { MeilleureOffre } from '@/components/MeilleureOffre'

export default function PanierPage() {
  const router = useRouter()
  const [lignes, setLignes] = useState<LignePanier[]>([])
  const [enseigne, setEnseigne] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setLignes(panier.get())
  }, [])

  function updateLigne(produitId: string, updates: Partial<LignePanier>) {
    setLignes(prev => {
      const next = prev.map(l => l.produitId === produitId ? { ...l, ...updates } : l)
      const updated = next.find(l => l.produitId === produitId)
      if (updated) panier.add(updated)
      return next
    })
  }

  function removeLigne(produitId: string) {
    panier.remove(produitId)
    setLignes(panier.get())
  }

  const groupes = lignes.reduce((acc, l) => {
    const key = l.marque || 'Autres'
    if (!acc[key]) acc[key] = []
    acc[key].push(l)
    return acc
  }, {} as Record<string, LignePanier[]>)

  const allValid = lignes.every(l => l.prixOffre && l.prixOffre >= l.prixPlancher && l.quantite && l.quantite >= l.qmc)
  const formValid = allValid && enseigne.trim() !== '' && email.includes('@')

  const handleSubmit = async () => {
    // Validate
    const newErrors: Record<string, string> = {}
    for (const l of lignes) {
      if (!l.prixOffre || l.prixOffre < l.prixPlancher) newErrors[`prix-${l.produitId}`] = `Min. ${l.prixPlancher.toFixed(2)} \u20ac HT`
      if (!l.quantite || l.quantite < l.qmc) newErrors[`qty-${l.produitId}`] = `Min. ${l.qmc} cartons`
    }
    if (!enseigne.trim()) newErrors.enseigne = 'Requis'
    if (!email.includes('@')) newErrors.email = 'Email invalide'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }

    setLoading(true)
    setErrors({})
    try {
      for (const ligne of lignes) {
        const jours = ligne.dluo
          ? Math.ceil((new Date(ligne.dluo).getTime() - Date.now()) / 86400000)
          : 999
        const expiresAt = jours < 15
          ? new Date(Date.now() + 6 * 3600000).toISOString()
          : jours < 30
            ? new Date(Date.now() + 24 * 3600000).toISOString()
            : new Date(Date.now() + 48 * 3600000).toISOString()
        const mode = jours < 15 ? 'prix_plancher_uniquement' : 'enchere'

        const { error } = await supabase.from('offres_acheteurs').insert({
          produit_id: ligne.produitId,
          fournisseur_id: ligne.fournisseurId,
          marque: ligne.marque,
          nom_produit: ligne.nom,
          acheteur_enseigne: enseigne,
          acheteur_email: email,
          prix_offre_ht: ligne.prixOffre,
          quantite: ligne.quantite,
          expires_at: expiresAt,
          mode: mode,
        })

        if (error) throw new Error(`Insert failed: ${error.message}`)
      }

      panier.clear()
      router.push('/confirmation')
    } catch (e) {
      console.error('Erreur soumission:', e)
      setErrors({ global: 'Erreur lors de l\'envoi. Veuillez reessayer.' })
      setLoading(false)
    }
  }

  if (lignes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-gray-500">Panier vide</p>
          <Link href="/" className="text-green-700 font-medium text-sm hover:underline">
            &#8592; Retour au catalogue
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">&#8592; Catalogue</Link>
          <h1 className="text-lg font-bold text-gray-900">Mes offres ({lignes.length})</h1>
          <div />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {Object.entries(groupes).map(([marque, items]) => (
          <div key={marque} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-bold text-gray-900">{marque}</h2>
              <p className="text-xs text-gray-500">{items.length} reference{items.length > 1 ? 's' : ''}</p>
            </div>

            <div className="divide-y divide-gray-100">
              {items.map(l => {
                const jours = l.dluo ? Math.ceil((new Date(l.dluo).getTime() - Date.now()) / 86400000) : null
                const ddmCls = jours === null ? 'bg-gray-100 text-gray-500'
                  : jours < 10 ? 'bg-red-100 text-red-700'
                  : jours < 30 ? 'bg-orange-100 text-orange-700'
                  : 'bg-green-100 text-green-700'

                return (
                  <div key={l.produitId} className="px-4 py-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{l.nom}</p>
                        <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 ${ddmCls}`}>
                          {jours !== null ? `DDM ${jours}j` : 'DDM inconnue'}
                        </span>
                      </div>
                      <button
                        onClick={() => removeLigne(l.produitId)}
                        className="text-gray-400 hover:text-red-500 text-lg leading-none"
                      >
                        &times;
                      </button>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Prix plancher : {l.prixPlancher.toFixed(2)} &euro; HT</span>
                      <MeilleureOffre produitId={l.produitId} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Votre prix (&euro; HT)</label>
                        <input
                          type="number"
                          step="0.01"
                          min={l.prixPlancher}
                          value={l.prixOffre ?? ''}
                          onChange={e => {
                            const v = parseFloat(e.target.value) || null
                            updateLigne(l.produitId, { prixOffre: v })
                            if (v && v >= l.prixPlancher) {
                              setErrors(prev => { const n = { ...prev }; delete n[`prix-${l.produitId}`]; return n })
                            }
                          }}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                        />
                        {errors[`prix-${l.produitId}`] && (
                          <p className="text-xs text-red-500 mt-1">{errors[`prix-${l.produitId}`]}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Quantite (cartons, min {l.qmc})</label>
                        <input
                          type="number"
                          min={l.qmc}
                          value={l.quantite ?? ''}
                          onChange={e => {
                            const v = parseInt(e.target.value) || null
                            updateLigne(l.produitId, { quantite: v })
                            if (v && v >= l.qmc) {
                              setErrors(prev => { const n = { ...prev }; delete n[`qty-${l.produitId}`]; return n })
                            }
                          }}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                        />
                        {errors[`qty-${l.produitId}`] && (
                          <p className="text-xs text-red-500 mt-1">{errors[`qty-${l.produitId}`]}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Coordonnees */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-900">Vos coordonnees</h2>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Enseigne *</label>
            <input
              type="text"
              value={enseigne}
              onChange={e => { setEnseigne(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.enseigne; return n }) }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
            />
            {errors.enseigne && <p className="text-xs text-red-500 mt-1">{errors.enseigne}</p>}
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Email *</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.email; return n }) }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>
        </div>

        {errors.global && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {errors.global}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !formValid}
          className="w-full bg-green-700 hover:bg-green-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {loading ? 'Envoi en cours...' : `Envoyer mes ${lignes.length} offre${lignes.length > 1 ? 's' : ''} \u2192`}
        </button>
      </div>
    </div>
  )
}
