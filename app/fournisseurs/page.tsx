'use client';
import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function FournisseursPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contact, setContact] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');
  const [dragging, setDragging] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [showDescription, setShowDescription] = useState(false);
  const [description, setDescription] = useState('');
  const fichierNom = fichier?.name ?? '';
  const canSubmit = contact.trim() && (fichier || description.trim()) && !loading;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setFichier(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setErreur('');
    try {
      const formData = new FormData();
      formData.append('contact', contact.trim());
      if (fichier) formData.append('fichier', fichier);
      if (description.trim()) formData.append('description', description.trim());
      const res = await fetch('/api/fournisseurs', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur lors de l\'envoi');
      }
      router.push('/fournisseurs/confirmation');
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Une erreur est survenue.');
      setLoading(false);
    }
  }

  function scrollToForm() {
    document.getElementById('formulaire')?.scrollIntoView({ behavior: 'smooth' });
  }

  const faqItems = [
    {
      q: 'Est-ce que vous achetez vraiment tous les produits\u00a0?',
      a: 'Oui — épicerie, hygiène, bébé, entretien, boissons, animaux. Produits proches DDM, surplus de production, déclassés, fins de série, étiquettes abîmées. Si vous avez un doute, envoyez — on vous dit oui ou non en 24h.',
    },
    {
      q: 'Comment est calculé votre prix d\'achat\u00a0?',
      a: 'On se base sur le prix marché grande distribution et on propose un prix qui vous permet d\'écouler rapidement tout en étant juste. Pas de négociation longue — une offre claire, vous acceptez ou refusez.',
    },
    {
      q: 'Mes concurrents peuvent-ils voir mes produits et mes prix\u00a0?',
      a: 'Non. Vos produits sont présentés en exclusivité à nos acheteurs sous notre marque. Aucune information sur votre identité ou vos prix n\'est partagée.',
    },
    {
      q: 'Et si je refuse votre offre\u00a0?',
      a: 'Vous êtes entièrement libre. Zéro engagement, zéro pénalité. On vous propose un prix, vous dites oui ou non, c\'est tout.',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 1. BANDEAU URGENCE */}
      <div className="bg-green-700 text-white text-center text-sm sm:text-base py-2.5 px-4 font-medium">
        <span className="inline-block w-2 h-2 bg-green-300 rounded-full mr-2 animate-pulse" />
        Nous achetons en ce moment — Offre sous 24h garantie
      </div>

      {/* 2. HEADER */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="18" cy="18" r="18" fill="#16a34a" />
              <path d="M18 8c-2 3-8 6-8 13a8 8 0 0016 0c0-2-1-4-3-6-1 2-3 3-5 3s-3-2-3-4c0-2 1-4 3-6z" fill="#fff" opacity=".9" />
            </svg>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">Willy <span className="text-green-600">Anti-gaspi</span></h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Marketplace anti-gaspi BtoB</span>
                <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Réservé aux professionnels</span>
              </div>
            </div>
          </Link>
          <button onClick={scrollToForm} className="hidden sm:inline-flex bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            Déposer mon listing →
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pb-32 sm:pb-16">
        {/* 3. HERO */}
        <div className="text-center py-14 sm:py-20 mb-4">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
            Transformez vos surplus en cash<br className="hidden sm:block" /> — <span className="text-green-600">sans effort</span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            On achète vos stocks proches DDM, surplus et déclassés.
            <br />
            Vous envoyez votre listing, on fait une offre sous 24h.
            <br />
            Paiement garanti, zéro négociation.
          </p>
        </div>

        {/* 4. BARRE DE CRÉDIBILITÉ */}
        <div className="bg-green-50 rounded-2xl px-4 py-4 mb-12">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm sm:text-base text-gray-700 font-medium">
            <span>🏢 Entreprise française</span>
            <span>📦 1 000+ références achetées</span>
            <span>⚡ Offre sous 24h</span>
            <span>💸 Paiement sous 48h</span>
            <span>♻️ Impact RSE certifié</span>
          </div>
        </div>

        {/* 5. LES 3 ÉTAPES */}
        <div className="mb-14">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Étape 1 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-lg font-bold text-gray-900 mb-1">1. Envoyez votre listing</p>
              <p className="text-sm text-gray-600 mb-3">2 minutes — photo WhatsApp, Excel, PDF, n&apos;importe quoi</p>
              <span className="inline-block text-xs font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full">Zéro formulaire complexe</span>
            </div>

            {/* Étape 2 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 7.756a4.5 4.5 0 100 8.488M7.5 10.5h5.25m-5.25 3h5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-lg font-bold text-gray-900 mb-1">2. On fait une offre</p>
              <p className="text-sm text-gray-600 mb-3">Notre équipe analyse et vous propose un prix d&apos;achat sous 24h</p>
              <span className="inline-block text-xs font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full">Sans engagement de votre côté</span>
            </div>

            {/* Étape 3 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
              </div>
              <p className="text-lg font-bold text-gray-900 mb-1">3. Vous êtes payé</p>
              <p className="text-sm text-gray-600 mb-3">Virement bancaire sous 48h dès accord</p>
              <span className="inline-block text-xs font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full">Paiement garanti</span>
            </div>
          </div>
        </div>

        {/* 6. FAQ / OBJECTIONS */}
        <div className="mb-14">
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-6">Vos questions, nos réponses</h3>
          <div className="space-y-2">
            {faqItems.map((item, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
                >
                  <span className="text-base font-semibold text-gray-900">{item.q}</span>
                  <svg
                    className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${faqOpen === i ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {faqOpen === i && (
                  <div className="px-5 pb-4">
                    <p className="text-base text-gray-600 leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 7. TABLEAU COMPARATIF */}
        <div className="mb-14">
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-6">Pourquoi nous plutôt qu&apos;un autre&nbsp;?</h3>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-2xl border border-gray-200 overflow-hidden text-sm sm:text-base">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-500"></th>
                  <th className="px-4 py-3 font-bold text-green-700 bg-green-50">Willy Anti-gaspi</th>
                  <th className="px-4 py-3 font-semibold text-gray-500">Grossiste classique</th>
                  <th className="px-4 py-3 font-semibold text-gray-500">Destruction</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-700">Délai d&apos;offre</td>
                  <td className="px-4 py-3 text-center font-bold text-green-700 bg-green-50">24h</td>
                  <td className="px-4 py-3 text-center text-gray-500">1-2 semaines</td>
                  <td className="px-4 py-3 text-center text-gray-400">—</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-700">Paiement</td>
                  <td className="px-4 py-3 text-center font-bold text-green-700 bg-green-50">48h</td>
                  <td className="px-4 py-3 text-center text-gray-500">30-90 jours</td>
                  <td className="px-4 py-3 text-center text-red-500">Coût</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-700">Engagement</td>
                  <td className="px-4 py-3 text-center font-bold text-green-700 bg-green-50">Aucun</td>
                  <td className="px-4 py-3 text-center text-gray-500">Contrat</td>
                  <td className="px-4 py-3 text-center text-gray-400">—</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-700">Confidentialité</td>
                  <td className="px-4 py-3 text-center bg-green-50"><span className="text-green-600 text-lg">✓</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-red-400 text-lg">✗</span></td>
                  <td className="px-4 py-3 text-center text-gray-400">—</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-gray-700">Impact environnemental</td>
                  <td className="px-4 py-3 text-center bg-green-50"><span className="text-green-600 text-lg">✓</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-red-400 text-lg">✗</span></td>
                  <td className="px-4 py-3 text-center"><span className="text-red-400 text-lg">✗</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 8. CATÉGORIES ACCEPTÉES */}
        <div className="mb-14 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">On achète dans toutes ces catégories</h3>
          <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
            {[
              { icon: '🥫', label: 'Épicerie salée' },
              { icon: '🍫', label: 'Épicerie sucrée' },
              { icon: '🥤', label: 'Boissons' },
              { icon: '🧴', label: 'Hygiène & Beauté' },
              { icon: '🍼', label: 'Bébé' },
              { icon: '🧹', label: 'Entretien' },
              { icon: '🐾', label: 'Animaux' },
              { icon: '❄️', label: 'Surgelés' },
              { icon: '🥗', label: 'Frais' },
            ].map(({ icon, label }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 px-3 py-3 flex flex-col items-center gap-1">
                <span className="text-2xl">{icon}</span>
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 9. TÉMOIGNAGE */}
        <div className="mb-14 bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 text-center max-w-2xl mx-auto">
          <div className="text-yellow-400 text-xl mb-3">⭐⭐⭐⭐⭐</div>
          <blockquote className="text-base sm:text-lg text-gray-700 italic mb-4 leading-relaxed">
            &laquo;&nbsp;J&apos;avais 3 palettes de biscuits proches DDM. Offre reçue en 3h, virement le lendemain. Je les appelle maintenant en premier quand j&apos;ai un surplus.&nbsp;&raquo;
          </blockquote>
          <p className="text-base font-semibold text-gray-900">— Thomas R., Directeur commercial</p>
          <p className="text-sm text-gray-500">Industrie agroalimentaire</p>
        </div>

        {/* 10. FORMULAIRE */}
        <div id="formulaire" className="scroll-mt-24 max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8 space-y-5">
            <div className="text-center mb-2">
              <h3 className="text-2xl font-bold text-gray-900">Déposer mon offre</h3>
              <p className="text-sm text-gray-500 mt-1">Confidentiel &bull; Sans engagement &bull; Réponse sous 24h</p>
            </div>

            {/* Champ contact */}
            <div>
              <label htmlFor="contact" className="block text-base font-semibold text-gray-900 mb-0.5">Comment vous joindre&nbsp;?</label>
              <input
                id="contact"
                type="text"
                required
                placeholder="Email ou numéro WhatsApp"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none text-base text-gray-900 placeholder:text-gray-400 transition-all"
              />
              <p className="text-sm text-gray-500 mt-1.5">On vous répond sur le même canal — pas de démarchage</p>
            </div>

            {/* Champ fichier */}
            <div>
              <label className="block text-base font-semibold text-gray-900 mb-1.5">Votre catalogue ou listing produits</label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
                className="hidden"
                accept=".pdf,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.doc,.docx,.eml,.msg,.ogg,.mp3,.m4a"
              />
              {/* Desktop drag & drop */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`hidden sm:flex cursor-pointer flex-col items-center justify-center w-full py-10 rounded-xl border-2 border-dashed transition-all ${
                  dragging
                    ? 'border-green-500 bg-green-50'
                    : fichierNom
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300 hover:border-green-500 hover:bg-green-50/50'
                }`}
              >
                {fichierNom ? (
                  <div className="text-center">
                    <svg className="w-8 h-8 text-green-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <p className="text-base font-medium text-green-700">{fichierNom}</p>
                    <p className="text-sm text-gray-500 mt-1">Cliquez pour changer de fichier</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-base font-medium text-gray-700">Glissez votre fichier ici</p>
                    <p className="text-sm text-gray-500 mt-1">ou cliquez pour parcourir</p>
                  </div>
                )}
              </div>
              {/* Mobile simple button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`sm:hidden w-full px-4 py-3.5 rounded-xl border-2 border-dashed transition-colors text-left flex items-center gap-3 ${
                  fichierNom ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-500'
                }`}
              >
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span className="text-sm text-gray-600">{fichierNom || 'Choisir un fichier'}</span>
              </button>
              <p className="text-sm text-gray-500 mt-1.5">Photo WhatsApp, Excel, PDF, message vocal — tout fonctionne</p>

              {/* Lien description alternative */}
              {!showDescription && (
                <button
                  type="button"
                  onClick={() => setShowDescription(true)}
                  className="text-sm text-green-600 hover:text-green-700 font-medium mt-2 underline underline-offset-2"
                >
                  Pas de fichier&nbsp;? Décrivez vos produits par message
                </button>
              )}
              {showDescription && (
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez vos produits ici (ex: 500 boîtes de thon Petit Navire DDM mars 2026)"
                  className="w-full mt-3 px-4 py-3 rounded-xl border border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none text-base text-gray-900 placeholder:text-gray-400 transition-all resize-none"
                  rows={3}
                />
              )}
            </div>

            {erreur && <div className="bg-red-50 text-red-700 text-base px-4 py-3 rounded-xl">{erreur}</div>}

            {/* Bouton submit */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-4 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_20px_rgba(22,163,74,0.4)] hover:shadow-[0_6px_24px_rgba(22,163,74,0.5)]"
            >
              {loading ? 'Envoi en cours...' : 'Envoyer mon listing →'}
            </button>
            <p className="text-sm text-gray-500 text-center">🔒 Confidentiel &bull; Zéro engagement &bull; Réponse sous 24h garantie</p>
          </form>
        </div>
      </main>

      {/* 11. FOOTER */}
      <footer className="bg-white border-t border-gray-200 py-8 px-4 mt-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <svg width="24" height="24" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="18" cy="18" r="18" fill="#16a34a" />
              <path d="M18 8c-2 3-8 6-8 13a8 8 0 0016 0c0-2-1-4-3-6-1 2-3 3-5 3s-3-2-3-4c0-2 1-4 3-6z" fill="#fff" opacity=".9" />
            </svg>
            <span className="font-bold text-gray-900">Willy Anti-gaspi</span>
            <span className="text-sm text-gray-500">— Marketplace anti-gaspi BtoB</span>
          </div>
          <p className="text-base text-gray-600 mb-1">
            <a href="mailto:contact@willyantigaspi.fr" className="hover:text-green-600 transition-colors">contact@willyantigaspi.fr</a>
            <span className="mx-2 text-gray-300">|</span>
            Une question&nbsp;? WhatsApp : <span className="font-semibold">06 XX XX XX XX</span>
          </p>
          <p className="text-sm text-gray-400 mt-4">CGV &bull; Mentions légales &bull; Politique de confidentialité</p>
        </div>
      </footer>

      {/* BOUTON STICKY MOBILE */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-50">
        <button
          type="button"
          onClick={scrollToForm}
          className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-3.5 text-base font-bold transition-all shadow-[0_4px_20px_rgba(22,163,74,0.4)]"
        >
          Déposer mon listing →
        </button>
      </div>
    </div>
  );
}
