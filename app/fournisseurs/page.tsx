'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const CHANNELS = [
  { id: 'whatsapp', icon: '📱', label: 'WhatsApp', placeholder: 'Votre numéro WhatsApp...' },
  { id: 'email', icon: '📧', label: 'Email', placeholder: 'Votre email pro...' },
  { id: 'telephone', icon: '📞', label: 'Téléphone', placeholder: 'Votre numéro de téléphone...' },
] as const;

export default function FournisseursPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contact, setContact] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');
  const [dragging, setDragging] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const fichierNom = fichier?.name ?? '';
  const canSubmit = contact.trim() && fichier && !loading;

  // Animated placeholder rotation (only when no channel is manually selected)
  useEffect(() => {
    if (selectedChannel) return;
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % CHANNELS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedChannel]);

  // Auto-detect channel from input
  const detectedChannel = contact.includes('@')
    ? 'email'
    : /\d{6,}/.test(contact.replace(/[\s\-.()]/g, ''))
    ? 'whatsapp'
    : null;

  const activePlaceholder = selectedChannel
    ? CHANNELS.find((c) => c.id === selectedChannel)!.placeholder
    : CHANNELS[placeholderIndex].placeholder;

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
      formData.append('fichier', fichier!);
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
      q: 'Quels produits acceptez-vous\u00a0?',
      a: 'Tous les produits alimentaires, hygiène, bébé, entretien proches DDM, surplus ou déclassés.',
    },
    {
      q: 'Comment se passe le paiement\u00a0?',
      a: 'Virement bancaire sous 48h après accord. Aucune avance de frais.',
    },
    {
      q: 'Est-ce que je m\'engage à quelque chose\u00a0?',
      a: 'Non. Vous envoyez votre listing, on fait une offre. Vous êtes libre d\'accepter ou de refuser.',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* BANDEAU URGENCE */}
      <div className="bg-green-700 text-white text-center text-sm py-2 px-4 font-medium">
        <span className="inline-block w-2 h-2 bg-green-300 rounded-full mr-2 animate-pulse" />
        Nous achetons en ce moment — Réponse garantie sous 24h
      </div>

      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
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
          <button onClick={scrollToForm} className="hidden sm:inline-flex bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            Déposer mon listing
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pb-32 sm:pb-16">
        {/* HERO */}
        <div className="relative text-center py-12 sm:py-16 mb-8">
          <div className="absolute inset-0 bg-gradient-to-b from-green-50 to-transparent rounded-3xl -mx-4" />
          <div className="relative">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">
              Vos surplus trouvent<br className="hidden sm:block" /> preneur en <span className="text-green-600">24h</span>
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-xl mx-auto mb-8">
              On achète vos stocks proches DDM, surplus et déclassés.<br className="hidden sm:block" />
              Paiement garanti, zéro invendu.
            </p>

            {/* STATS */}
            <div className="inline-flex items-center bg-white rounded-2xl shadow-sm border border-gray-200 divide-x divide-gray-200">
              <div className="px-6 sm:px-8 py-4 text-center">
                <div className="text-2xl mb-1">🏭</div>
                <p className="text-2xl sm:text-3xl font-extrabold text-green-600">50+</p>
                <p className="text-xs text-gray-500 mt-0.5">fournisseurs</p>
              </div>
              <div className="px-6 sm:px-8 py-4 text-center">
                <div className="text-2xl mb-1">🛒</div>
                <p className="text-2xl sm:text-3xl font-extrabold text-green-600">300+</p>
                <p className="text-xs text-gray-500 mt-0.5">acheteurs BtoB</p>
              </div>
              <div className="px-6 sm:px-8 py-4 text-center">
                <div className="text-2xl mb-1">⚡</div>
                <p className="text-2xl sm:text-3xl font-extrabold text-green-600">48h</p>
                <p className="text-xs text-gray-500 mt-0.5">paiement</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Dernière offre reçue il y a 12 minutes</p>
          </div>
        </div>

        {/* 3 ÉTAPES */}
        <div className="mb-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 sm:gap-0 relative">
            {/* Ligne de connexion desktop */}
            <div className="hidden sm:block absolute top-10 left-[calc(16.67%+20px)] right-[calc(16.67%+20px)] h-0.5 bg-green-300 z-0" />
            {/* Ligne de connexion mobile */}
            <div className="sm:hidden absolute top-0 bottom-0 left-6 w-0.5 bg-green-300 z-0" />

            <div className="relative z-10 flex sm:flex-col items-start sm:items-center gap-4 sm:gap-0 py-4 sm:py-0 sm:text-center px-2">
              <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-green-600 text-white rounded-full flex items-center justify-center text-lg sm:text-xl font-bold shadow-md sm:mb-3">1</div>
              <div>
                <p className="font-bold text-gray-900 mb-0.5">Envoyez votre listing</p>
                <p className="text-sm text-gray-600">2 minutes — photo, Excel, PDF, n&apos;importe quel format</p>
              </div>
            </div>

            <div className="relative z-10 flex sm:flex-col items-start sm:items-center gap-4 sm:gap-0 py-4 sm:py-0 sm:text-center px-2">
              <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-green-600 text-white rounded-full flex items-center justify-center text-lg sm:text-xl font-bold shadow-md sm:mb-3">2</div>
              <div>
                <p className="font-bold text-gray-900 mb-0.5">On propose vos produits</p>
                <p className="text-sm text-gray-600">300+ acheteurs BtoB reçoivent vos offres en quelques heures</p>
              </div>
            </div>

            <div className="relative z-10 flex sm:flex-col items-start sm:items-center gap-4 sm:gap-0 py-4 sm:py-0 sm:text-center px-2">
              <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-green-600 text-white rounded-full flex items-center justify-center text-lg sm:text-xl font-bold shadow-md sm:mb-3">3</div>
              <div>
                <p className="font-bold text-gray-900 mb-0.5">Vous êtes payé</p>
                <p className="text-sm text-gray-600">Paiement sous 48h dès accord — sans avance de frais</p>
              </div>
            </div>
          </div>
        </div>

        {/* FORMULAIRE */}
        <div id="formulaire" className="scroll-mt-24">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8 space-y-5">
            <h3 className="text-xl font-bold text-gray-900 text-center">Déposer mon offre maintenant</h3>

            <div>
              <label htmlFor="contact" className="block text-sm font-medium text-gray-700">Comment vous joindre&nbsp;?</label>
              <p className="text-xs text-gray-400 mb-2">On vous répond sur le même canal que vous utilisez</p>
              <input
                id="contact"
                type="text"
                required
                placeholder={activePlaceholder}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none text-base transition-all"
              />
              {/* Channel selector */}
              <div className="flex items-center gap-1 mt-2.5">
                {CHANNELS.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedChannel(selectedChannel === ch.id ? null : ch.id)}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                      (selectedChannel ?? detectedChannel) === ch.id
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <span>{ch.icon}</span>
                    {ch.label}
                  </button>
                ))}
              </div>
              {/* Auto-detection message */}
              {detectedChannel && contact.trim() && (
                <p className="text-xs font-medium mt-2 text-green-600">
                  {detectedChannel === 'email' ? '📧 Nous vous répondrons par email' : '📱 Nous vous répondrons sur WhatsApp'}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2">Pas de démarchage. On vous contacte uniquement pour répondre à votre listing.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Votre catalogue ou listing produits</label>
              <input
                ref={fileInputRef}
                type="file"
                required
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
                className={`hidden sm:flex cursor-pointer flex-col items-center justify-center w-full py-8 rounded-xl border-2 border-dashed transition-all ${
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
                    <p className="text-sm font-medium text-green-700">{fichierNom}</p>
                    <p className="text-xs text-gray-400 mt-1">Cliquez pour changer de fichier</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <svg className="w-10 h-10 text-gray-400 mx-auto mb-2 animate-bounce" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-sm font-medium text-gray-600">Glissez votre fichier ici ou cliquez pour parcourir</p>
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
                <span className="text-sm text-gray-500">{fichierNom || 'Choisir un fichier'}</span>
              </button>
              <p className="text-xs text-gray-400 mt-1.5">Photo WhatsApp, Excel, PDF, email transféré, message vocal — tout fonctionne</p>
            </div>

            {erreur && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{erreur}</div>}

            {/* Bouton desktop */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-4 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_20px_rgba(5,150,105,0.4)] hover:shadow-[0_6px_24px_rgba(5,150,105,0.5)] animate-[pulse_3s_ease-in-out_infinite]"
              style={{ animationDuration: '3s' }}
            >
              {loading ? 'Envoi en cours...' : 'Envoyer mon listing →'}
            </button>
            <p className="text-xs text-gray-400 text-center">🔒 Confidentiel &bull; Zéro engagement &bull; Réponse sous 24h garantie</p>
          </form>
        </div>

        {/* TÉMOIGNAGE */}
        <div className="mt-8 bg-white rounded-2xl border border-gray-200 p-6 text-center">
          <div className="text-yellow-400 text-lg mb-2">⭐⭐⭐⭐⭐</div>
          <blockquote className="text-gray-700 italic mb-3">
            &laquo;&nbsp;Réponse en 2h, paiement le lendemain. Exactement ce dont j&apos;avais besoin pour écouler mes surplus.&nbsp;&raquo;
          </blockquote>
          <p className="text-sm font-semibold text-gray-900">— Marc D., Responsable logistique</p>
        </div>

        {/* TYPES DE FOURNISSEURS */}
        <div className="mt-8 text-center">
          <p className="text-sm font-semibold text-gray-700 mb-3">Ils nous font confiance</p>
          <div className="flex flex-wrap justify-center gap-2">
            {['Industriels', 'Grossistes', 'Producteurs', 'Importateurs', 'Distributeurs'].map((type) => (
              <span key={type} className="inline-flex items-center gap-1 text-sm text-gray-600 bg-white border border-gray-200 rounded-full px-3 py-1.5">
                <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {type}
              </span>
            ))}
          </div>
        </div>

        {/* PRODUITS ACCEPTÉS */}
        <div className="mt-6 text-center">
          <p className="text-sm font-semibold text-gray-700 mb-3">Produits acceptés</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { icon: '🥫', label: 'Épicerie' },
              { icon: '🧴', label: 'Hygiène' },
              { icon: '🍼', label: 'Bébé' },
              { icon: '🧹', label: 'Entretien' },
              { icon: '🐾', label: 'Animaux' },
              { icon: '🥤', label: 'Boissons' },
            ].map(({ icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-full px-3 py-1.5">
                <span>{icon}</span>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-10 mb-8">
          <h3 className="text-lg font-bold text-gray-900 text-center mb-4">Questions fréquentes</h3>
          <div className="space-y-2">
            {faqItems.map((item, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
                >
                  <span className="text-sm font-semibold text-gray-900">{item.q}</span>
                  <svg
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${faqOpen === i ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {faqOpen === i && (
                  <div className="px-5 pb-4">
                    <p className="text-sm text-gray-600">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-200 py-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <svg width="24" height="24" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="18" cy="18" r="18" fill="#059669" />
              <path d="M18 8c-2 3-8 6-8 13a8 8 0 0016 0c0-2-1-4-3-6-1 2-3 3-5 3s-3-2-3-4c0-2 1-4 3-6z" fill="#fff" opacity=".9" />
            </svg>
            <span className="font-bold text-gray-900">Willy Anti-gaspi</span>
          </div>
          <p className="text-sm text-gray-600 mb-1">
            <a href="mailto:contact@willyantigaspi.fr" className="hover:text-green-600 transition-colors">contact@willyantigaspi.fr</a>
          </p>
          <p className="text-sm text-gray-600 mb-4">
            WhatsApp : <span className="font-semibold">06 XX XX XX XX</span>
          </p>
          <p className="text-xs text-gray-400">Mentions légales &bull; Politique de confidentialité</p>
        </div>
      </footer>

      {/* BOUTON STICKY MOBILE */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-50">
        <button
          type="button"
          onClick={scrollToForm}
          className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-3.5 text-base font-bold transition-all shadow-[0_4px_20px_rgba(5,150,105,0.4)]"
        >
          Envoyer mon listing →
        </button>
      </div>
    </div>
  );
}
