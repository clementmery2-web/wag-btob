import Link from 'next/link';

export default function ConfirmationPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">W</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">WAG <span className="text-green-600">BtoB</span></h1>
              <p className="text-xs text-gray-500 -mt-0.5">Espace fournisseur</p>
            </div>
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center py-12">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Merci !</h2>
          <p className="text-gray-600 text-lg mb-2">Votre fichier a bien été reçu.</p>
          <p className="text-gray-500 mb-8">On vous répond sous 24h.</p>
          <div className="space-y-3">
            <Link href="/" className="block bg-green-600 hover:bg-green-700 text-white rounded-xl py-3 text-base font-semibold transition-colors">
              Découvrir le catalogue
            </Link>
            <Link href="/fournisseurs" className="block text-sm text-green-600 hover:text-green-700 font-medium">
              Envoyer un autre fichier
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
