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

  /* ══════════════════ SVG icon helpers ══════════════════ */
  const StarIcon = () => (
    <svg className="w-5 h-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );

  const CheckCircle = () => (
    <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ═══ 1. BANDEAU URGENCE ═══ */}
      <div className="bg-green-700 text-white text-center text-sm sm:text-base py-2.5 px-4 font-medium">
        <span className="inline-block w-2 h-2 bg-green-300 rounded-full mr-2 animate-pulse" />
        Nous achetons en ce moment — Offre sous 24h garantie
      </div>

      {/* ═══ 2. HEADER ═══ */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
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

      <main className="max-w-5xl mx-auto px-4 pb-32 sm:pb-16">

        {/* ═══ 3. HERO ═══ */}
        <div className="text-center py-12 sm:py-16">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
            Ces palettes qui dorment vous coûtent de l&apos;argent.<br />
            <span className="text-green-600">On les achète sous 24h.</span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-8">
            Stocks proches DDM, surplus, déclassés — on fait une offre sous 24h.
            <br />
            Paiement virement sous 48h dès accord.
          </p>

          {/* Barre crédibilité */}
          <div className="inline-flex flex-wrap justify-center items-center gap-x-6 gap-y-2 bg-green-50 rounded-full px-6 py-3 text-sm sm:text-base font-medium text-gray-700">
            <span>🏢 Entreprise française</span>
            <span className="hidden sm:inline text-green-300">|</span>
            <span>⚡ Offre sous 24h</span>
            <span className="hidden sm:inline text-green-300">|</span>
            <span>💸 Paiement sous 48h</span>
          </div>
        </div>

        {/* ═══ 4. FORMULAIRE — juste après le hero ═══ */}
        <div id="formulaire" className="scroll-mt-24 mb-16">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">

            {/* Colonne gauche : formulaire */}
            <div className="lg:col-span-7">
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8 space-y-5">
                <div className="text-center lg:text-left mb-1">
                  <h3 className="text-2xl font-bold text-gray-900">Déposer mon offre</h3>
                  <p className="text-sm text-gray-500 mt-1">Confidentiel &bull; Sans engagement &bull; Réponse sous 24h</p>
                </div>

                {/* Champ contact */}
                <div>
                  <label htmlFor="contact" className="block text-base font-semibold text-gray-900 mb-1">Comment vous joindre&nbsp;?</label>
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

                  {/* Mobile button */}
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

                  <p className="text-sm text-gray-500 mt-1.5">Photo WhatsApp, Excel, PDF — tout fonctionne</p>

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

                {/* Texte pré-bouton */}
                <p className="text-sm font-medium text-green-700 text-center">
                  👆 En moyenne nos fournisseurs reçoivent une offre en 4h
                </p>

                {/* Bouton submit */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full bg-green-700 hover:bg-green-800 text-white rounded-xl py-5 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_20px_rgba(21,128,61,0.45)] hover:shadow-[0_6px_28px_rgba(21,128,61,0.55)]"
                >
                  {loading ? 'Envoi en cours...' : 'Envoyer mon listing →'}
                </button>
                <p className="text-sm text-gray-500 text-center">🔒 Confidentiel &bull; Zéro engagement &bull; Réponse sous 24h garantie</p>
              </form>
            </div>

            {/* Colonne droite : réassurance (desktop only) */}
            <div className="hidden lg:flex lg:col-span-5 flex-col justify-center gap-5 pl-2">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle />
                  <p className="text-base text-gray-700 font-medium">Offre sous 24h garantie</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle />
                  <p className="text-base text-gray-700 font-medium">Paiement sous 48h dès accord</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle />
                  <p className="text-base text-gray-700 font-medium">Zéro engagement — vous refusez, point final</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle />
                  <p className="text-base text-gray-700 font-medium">100% confidentiel</p>
                </div>
              </div>

              {/* Mini témoignage */}
              <div className="bg-gray-50 rounded-xl p-5 mt-2 border border-gray-200">
                <div className="flex gap-0.5 mb-2">
                  {[...Array(5)].map((_, i) => <StarIcon key={i} />)}
                </div>
                <p className="text-base text-gray-700 italic leading-relaxed">
                  &laquo;&nbsp;J&apos;avais 3 palettes proches DDM. Offre en 3h, virement le lendemain.&nbsp;&raquo;
                </p>
                <p className="text-sm font-semibold text-gray-900 mt-2">— Thomas R., Directeur commercial</p>
              </div>
            </div>
          </div>

          {/* Réassurance mobile (sous le formulaire) */}
          <div className="lg:hidden mt-6 bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle />
              <p className="text-base text-gray-700 font-medium">Offre sous 24h garantie</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle />
              <p className="text-base text-gray-700 font-medium">Paiement sous 48h dès accord</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle />
              <p className="text-base text-gray-700 font-medium">Zéro engagement — vous refusez, point final</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle />
              <p className="text-base text-gray-700 font-medium">100% confidentiel</p>
            </div>
          </div>
        </div>

        {/* ═══ 5. LES 3 ÉTAPES ═══ */}
        <div className="mb-16">
          <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-8">Comment ça marche&nbsp;?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Étape 1 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">Aujourd&apos;hui</p>
              <p className="text-lg font-bold text-gray-900 mb-1">Vous envoyez votre listing</p>
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
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">Aujourd&apos;hui</p>
              <p className="text-lg font-bold text-gray-900 mb-1">Notre équipe analyse et fait une offre</p>
              <p className="text-sm text-gray-600 mb-3">On vous propose un prix d&apos;achat clair sous 24h</p>
              <span className="inline-block text-xs font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full">Sans engagement de votre côté</span>
            </div>

            {/* Étape 3 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">Demain</p>
              <p className="text-lg font-bold text-gray-900 mb-1">Virement reçu si accord</p>
              <p className="text-sm text-gray-600 mb-3">Paiement sous 48h dès votre accord — sans avance de frais</p>
              <span className="inline-block text-xs font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full">Paiement garanti</span>
            </div>
          </div>
        </div>

        {/* ═══ 6. RÉASSURANCE — points visibles sans clic ═══ */}
        <div className="mb-16">
          <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-8">Vos questions, nos réponses</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-start gap-3">
              <CheckCircle />
              <div>
                <p className="text-base font-semibold text-gray-900 mb-1">On achète tout</p>
                <p className="text-sm text-gray-600 leading-relaxed">Épicerie, hygiène, bébé, DDM courte, déclassé, fins de série, étiquettes abîmées</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-start gap-3">
              <CheckCircle />
              <div>
                <p className="text-base font-semibold text-gray-900 mb-1">Prix juste</p>
                <p className="text-sm text-gray-600 leading-relaxed">Basé sur le prix marché GD, expliqué clairement, pas de négociation interminable</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-start gap-3">
              <CheckCircle />
              <div>
                <p className="text-base font-semibold text-gray-900 mb-1">100% confidentiel</p>
                <p className="text-sm text-gray-600 leading-relaxed">Vos concurrents ne voient rien, vos produits présentés sous notre marque</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-start gap-3">
              <CheckCircle />
              <div>
                <p className="text-base font-semibold text-gray-900 mb-1">Zéro engagement</p>
                <p className="text-sm text-gray-600 leading-relaxed">Vous refusez notre offre, aucune pénalité, aucun contrat signé</p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ 7. POURQUOI NOUS ═══ */}
        <div className="mb-16">
          <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-4">Pourquoi nous plutôt qu&apos;un grossiste classique&nbsp;?</h3>
          <p className="text-base sm:text-lg text-gray-600 text-center max-w-2xl mx-auto mb-8 leading-relaxed">
            Les grossistes classiques vous font attendre 2 semaines et paient à 90 jours.
            Nous, on vous répond en 24h et on vire sous 48h. Sans contrat, sans engagement.
          </p>

          {/* 3 stats */}
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
              <div className="text-2xl mb-2">
                <svg className="w-8 h-8 text-green-600 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-3xl sm:text-4xl font-extrabold text-green-600">24h</p>
              <p className="text-sm text-gray-600 mt-1">Délai de réponse</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
              <div className="text-2xl mb-2">
                <svg className="w-8 h-8 text-green-600 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
              </div>
              <p className="text-3xl sm:text-4xl font-extrabold text-green-600">48h</p>
              <p className="text-sm text-gray-600 mt-1">Délai de paiement</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
              <div className="text-2xl mb-2">
                <svg className="w-8 h-8 text-green-600 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <p className="text-3xl sm:text-4xl font-extrabold text-green-600">0</p>
              <p className="text-sm text-gray-600 mt-1">Contrats à signer</p>
            </div>
          </div>

          {/* Bloc volume */}
          <div className="bg-green-50 rounded-2xl p-6 text-center max-w-2xl mx-auto">
            <p className="text-lg font-bold text-gray-900 mb-1">On traite tous les volumes</p>
            <p className="text-base text-gray-600 leading-relaxed">
              De 100€ à 500 000€ — palettes isolées, camions complets, conteneurs.
              <br />
              On s&apos;adapte à votre situation.
            </p>
          </div>
        </div>

        {/* ═══ 8. CATÉGORIES ═══ */}
        <div className="mb-16 text-center">
          <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">On achète dans toutes ces catégories</h3>
          <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
            {[
              { label: 'Épicerie salée', path: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
              { label: 'Épicerie sucrée', path: 'M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z' },
              { label: 'Boissons', path: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M5 14.5l3.5 3.5m0 0L12 21.5l3.5-3.5M8.5 18L5 14.5m14 0l-3.5 3.5' },
              { label: 'Hygiène & Beauté', path: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z' },
              { label: 'Bébé', path: 'M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z' },
              { label: 'Entretien', path: 'M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42' },
              { label: 'Animaux', path: 'M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z' },
              { label: 'Surgelés', path: 'M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15' },
              { label: 'Frais', path: 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z' },
            ].map(({ label, path }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 px-3 py-4 flex flex-col items-center gap-2">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={path} />
                </svg>
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ 9. TÉMOIGNAGE ═══ */}
        <div className="mb-16 bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 text-center max-w-2xl mx-auto">
          <div className="flex justify-center gap-0.5 mb-3">
            {[...Array(5)].map((_, i) => <StarIcon key={i} />)}
          </div>
          <blockquote className="text-base sm:text-lg text-gray-700 italic mb-4 leading-relaxed">
            &laquo;&nbsp;J&apos;avais 3 palettes de biscuits proches DDM. Offre reçue en 3h, virement le lendemain. Je les appelle maintenant en premier quand j&apos;ai un surplus.&nbsp;&raquo;
          </blockquote>
          <p className="text-base font-semibold text-gray-900">— Thomas R., Directeur commercial</p>
          <p className="text-sm text-gray-500">Industrie agroalimentaire</p>
        </div>
      </main>

      {/* ═══ 10. FOOTER ═══ */}
      <footer className="bg-white border-t border-gray-200 py-8 px-4">
        <div className="max-w-5xl mx-auto text-center">
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
          </p>
          <p className="text-sm text-gray-400 mt-4">CGV &bull; Mentions légales &bull; Politique de confidentialité</p>
        </div>
      </footer>

      {/* BOUTON STICKY MOBILE */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-50">
        <button
          type="button"
          onClick={scrollToForm}
          className="w-full bg-green-700 hover:bg-green-800 text-white rounded-xl py-3.5 text-base font-bold transition-all shadow-[0_4px_20px_rgba(21,128,61,0.45)]"
        >
          Déposer mon listing →
        </button>
      </div>
    </div>
  );
}
