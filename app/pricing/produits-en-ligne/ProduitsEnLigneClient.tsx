'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface ProduitEnLigne {
  id: string
  nom: string
  dluo?: string | null
  stock_disponible?: number | null
  prix_vente_wag_ht?: number | null
  fournisseur_nom?: string | null
  qmc?: number | null
}

const formatDate = (d?: string | null): string => {
  if (!d) return '—'
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('fr-FR')
}

export default function ProduitsEnLigneClient({ produits: initialProduits }: { produits: ProduitEnLigne[] }) {
  const [produits, setProduits] = useState(initialProduits)

  const handleRetirerCatalogue = async (produitId: string) => {
    const { error } = await supabase
      .from('produits')
      .update({ visible_catalogue: false, statut: 'valide' })
      .eq('id', produitId)
    if (!error) {
      setProduits(prev => prev.filter(p => p.id !== produitId))
    } else {
      console.error('[handleRetirerCatalogue]', error.message)
    }
  }

  return (
    <div style={{ background: 'white', border: '0.5px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            <th style={{ width: '25%', padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase' }}>Produit</th>
            <th style={{ width: '10%', padding: '10px 8px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase' }}>DDM</th>
            <th style={{ width: '10%', padding: '10px 8px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase' }}>Stock</th>
            <th style={{ width: '12%', padding: '10px 8px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase' }}>Plancher HT</th>
            <th style={{ width: '8%', padding: '10px 8px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase' }}>PCB</th>
            <th style={{ width: '20%', padding: '10px 8px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase' }}>Fournisseur</th>
            <th style={{ width: '15%', padding: '10px 8px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {produits.map((p, i) => (
            <tr key={p.id} style={{ borderTop: '0.5px solid #e5e7eb', background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
              <td style={{ padding: '10px 16px', fontWeight: 500, color: '#111827' }}>{p.nom}</td>
              <td style={{ padding: '10px 8px', color: '#6b7280' }}>{formatDate(p.dluo)}</td>
              <td style={{ padding: '10px 8px', color: '#111827' }}>{p.stock_disponible != null ? `${p.stock_disponible} ctn` : '—'}</td>
              <td style={{ padding: '10px 8px', fontWeight: 500, color: '#16a34a' }}>{p.prix_vente_wag_ht != null ? `${Number(p.prix_vente_wag_ht).toFixed(2)} €` : '—'}</td>
              <td style={{ padding: '10px 8px', color: '#6b7280' }}>{p.qmc ?? '—'}</td>
              <td style={{ padding: '10px 8px', color: '#6b7280' }}>{p.fournisseur_nom ?? '—'}</td>
              <td style={{ padding: '10px 8px' }}>
                <button onClick={() => handleRetirerCatalogue(p.id)}
                  style={{ fontSize: '11px', padding: '3px 8px', color: '#dc2626', background: 'none', border: '0.5px solid #fca5a5', borderRadius: '6px', cursor: 'pointer' }}>
                  Retirer
                </button>
              </td>
            </tr>
          ))}
          {produits.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                Aucun produit en ligne pour le moment
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
