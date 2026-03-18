import Link from 'next/link';

export default function ConfirmationPage() {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Confettis CSS */}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes confetti-fall-2 {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(-540deg); opacity: 0; }
        }
        @keyframes check-bounce {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes badge-appear {
          0% { transform: translateY(-10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes spin-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .confetti {
          position: fixed;
          width: 8px;
          height: 8px;
          top: -10px;
          z-index: 50;
          border-radius: 2px;
          pointer-events: none;
        }
        .confetti:nth-child(1) { left: 10%; background: #059669; animation: confetti-fall 3s ease-out 0.1s forwards; }
        .confetti:nth-child(2) { left: 20%; background: #34d399; animation: confetti-fall-2 2.8s ease-out 0.3s forwards; width: 6px; height: 10px; }
        .confetti:nth-child(3) { left: 35%; background: #6ee7b7; animation: confetti-fall 3.2s ease-out 0s forwards; }
        .confetti:nth-child(4) { left: 50%; background: #059669; animation: confetti-fall-2 2.6s ease-out 0.2s forwards; width: 10px; height: 6px; }
        .confetti:nth-child(5) { left: 65%; background: #34d399; animation: confetti-fall 3s ease-out 0.4s forwards; }
        .confetti:nth-child(6) { left: 75%; background: #6ee7b7; animation: confetti-fall-2 2.9s ease-out 0.1s forwards; width: 6px; height: 10px; }
        .confetti:nth-child(7) { left: 85%; background: #059669; animation: confetti-fall 3.1s ease-out 0.5s forwards; }
        .confetti:nth-child(8) { left: 45%; background: #a7f3d0; animation: confetti-fall-2 2.7s ease-out 0.15s forwards; width: 10px; height: 6px; }
        .confetti:nth-child(9) { left: 5%; background: #34d399; animation: confetti-fall 3.3s ease-out 0.35s forwards; }
        .confetti:nth-child(10) { left: 90%; background: #6ee7b7; animation: confetti-fall-2 2.5s ease-out 0.25s forwards; }
        .check-bounce { animation: check-bounce 0.6s ease-out 0.3s both; }
        .badge-appear { animation: badge-appear 0.5s ease-out 0.1s both; }
        .spin-slow { animation: spin-slow 2s linear infinite; }
      `}</style>

      {/* Confetti elements */}
      <div className="confetti" /><div className="confetti" /><div className="confetti" /><div className="confetti" /><div className="confetti" />
      <div className="confetti" /><div className="confetti" /><div className="confetti" /><div className="confetti" /><div className="confetti" />

      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 relative z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="18" cy="18" r="18" fill="#059669" />
              <path d="M18 8c-2 3-8 6-8 13a8 8 0 0016 0c0-2-1-4-3-6-1 2-3 3-5 3s-3-2-3-4c0-2 1-4 3-6z" fill="#fff" opacity=".9" />
            </svg>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Willy <span className="text-green-600">Anti-gaspi</span></h1>
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Marketplace BtoB</span>
            </div>
          </Link>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 px-4 relative z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-green-50 via-green-50/30 to-transparent pointer-events-none" />
        <div className="max-w-lg mx-auto w-full py-8 sm:py-12 relative">

          {/* Badge succès */}
          <div className="badge-appear text-center mb-6">
            <span className="inline-flex items-center gap-2 bg-green-100 text-green-800 text-sm font-semibold px-4 py-2 rounded-full">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Listing reçu avec succès
            </span>
          </div>

          {/* Check icon */}
          <div className="check-bounce w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>

          {/* Titre */}
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 text-center mb-3">
            C&apos;est dans la boîte&nbsp;! 🎉
          </h2>
          <p className="text-gray-600 text-center text-base sm:text-lg mb-8 max-w-sm mx-auto">
            Notre équipe analyse votre offre et vous contacte sous 24h sur le contact que vous avez indiqué.
          </p>

          {/* Timeline de progression */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 mb-6">
            <div className="space-y-0">
              {/* Étape 1 - Complétée */}
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div className="w-0.5 h-6 bg-green-300" />
                </div>
                <div className="pt-1">
                  <p className="font-semibold text-green-700 text-sm">Listing reçu</p>
                  <p className="text-xs text-gray-400">Il y a quelques instants</p>
                </div>
              </div>

              {/* Étape 2 - En cours */}
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-orange-100 border-2 border-orange-400 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-orange-500 spin-slow" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                    </svg>
                  </div>
                  <div className="w-0.5 h-6 bg-gray-200" />
                </div>
                <div className="pt-1">
                  <p className="font-semibold text-orange-600 text-sm">Analyse en cours</p>
                  <p className="text-xs text-gray-400">Dans les prochaines heures</p>
                </div>
              </div>

              {/* Étape 3 - À venir */}
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-gray-100 border-2 border-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">💸</span>
                  </div>
                </div>
                <div className="pt-1">
                  <p className="font-semibold text-gray-400 text-sm">Proposition de prix</p>
                  <p className="text-xs text-gray-400">Sous 24h garantis</p>
                </div>
              </div>
            </div>
          </div>

          {/* Chiffre clé */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-center mb-6">
            <p className="text-gray-700 font-medium">
              En moyenne, nos fournisseurs reçoivent une offre en <span className="font-extrabold text-green-600">4h</span> ⚡
            </p>
          </div>

          {/* Bloc réassurance */}
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6">
            <p className="text-sm text-green-800 leading-relaxed">
              <span className="font-bold">💡</span> Vos produits vont être proposés à nos <span className="font-bold">300+ acheteurs BtoB</span> (épiceries, magasins discount, revendeurs) dès validation de votre offre.
            </p>
          </div>

          {/* Témoignage */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center mb-8">
            <div className="text-yellow-400 text-base mb-2">⭐⭐⭐⭐⭐</div>
            <blockquote className="text-gray-700 italic text-sm mb-3">
              &laquo;&nbsp;Offre reçue en 2h, virement le lendemain. Je ne pensais pas que ce serait aussi simple.&nbsp;&raquo;
            </blockquote>
            <p className="text-sm font-semibold text-gray-900">— Sophie M., Responsable des ventes</p>
          </div>

          {/* Boutons */}
          <div className="space-y-3 mb-6">
            <Link
              href="/fournisseurs"
              className="block w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-3.5 text-base font-bold transition-colors text-center shadow-[0_4px_20px_rgba(5,150,105,0.4)]"
            >
              Envoyer un autre listing →
            </Link>
            <Link
              href="/"
              className="block text-sm text-gray-500 hover:text-gray-700 font-medium text-center py-2 transition-colors"
            >
              Retour à l&apos;accueil
            </Link>
          </div>

          {/* WhatsApp */}
          <p className="text-center text-sm text-gray-500">
            📲 Une question&nbsp;? WhatsApp : <span className="font-semibold text-gray-700">06 XX XX XX XX</span>
          </p>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-200 py-6 px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-700">Willy Anti-gaspi</span> &bull; contact@willyantigaspi.fr &bull; Marketplace anti-gaspi BtoB
          </p>
        </div>
      </footer>
    </div>
  );
}
