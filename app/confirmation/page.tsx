'use client'

import Link from 'next/link'

export default function ConfirmationPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full text-center space-y-4">
        <div className="text-4xl">&#9989;</div>
        <h1 className="text-xl font-bold text-gray-900">Offres envoy&eacute;es</h1>
        <p className="text-sm text-gray-600">
          Vos offres ont bien &eacute;t&eacute; envoy&eacute;es. WAG vous contacte sous 24h si elles sont retenues.
        </p>
        <Link
          href="/"
          className="inline-block bg-green-700 hover:bg-green-800 text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors"
        >
          Retour au catalogue
        </Link>
      </div>
    </div>
  )
}
