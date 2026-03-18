'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function FournisseursPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');
  const fichierNom = fichier?.name ?? '';
  const canSubmit = prenom.trim() && email.trim() && fichier && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setErreur('');
    try {
      const formData = new FormData();
      formData.append('prenom', prenom.trim());
      formData.append('email', email.trim());
      if (telephone.trim()) formData.append('telephone', telephone.trim());
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">W</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">WAG <span className="text-green-600">BtoB</span></h1>
              <p className="text-xs text-gray-500">Espace fournisseur</p>
            </div>
          </Link>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Transformez vos surplus en cash en 24h</h2>
          <p className="text-gray-600">Envoyez votre listing, on calcule nos prix d&apos;achat et on vous répond sous 24h.</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6 space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">1</span>
            <p className="text-sm text-gray-700 pt-0.5">Vous envoyez votre liste (2 min)</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">2</span>
            <p className="text-sm text-gray-700 pt-0.5">On calcule nos prix d&apos;achat (24h)</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">3</span>
            <p className="text-sm text-gray-700 pt-0.5">Vous acceptez ou refusez — sans engagement</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
          <div>
            <label htmlFor="prenom" className="block text-sm font-medium text-gray-700 mb-1.5">Prénom</label>
            <input id="prenom" type="text" required placeholder="Votre prénom" value={prenom} onChange={(e) => setPrenom(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-green-500 outline-none text-base" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input id="email" type="email" required placeholder="votre@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-green-500 outline-none text-base" />
          </div>
          <div>
            <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone (pour vous répondre plus vite)</label>
            <input id="telephone" type="tel" placeholder="06 12 34 56 78" value={telephone} onChange={(e) => setTelephone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-green-500 outline-none text-base" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Votre fichier (PDF, Excel, photo...)</label>
            <input ref={fileInputRef} type="file" required onChange={(e) => setFichier(e.target.files?.[0] ?? null)} className="hidden" accept=".pdf,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.doc,.docx" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-green-500 transition-colors text-left flex items-center gap-3">
              <span className="text-sm text-gray-500">{fichierNom || 'Cliquez pour choisir un fichier'}</span>
            </button>
          </div>
          {erreur && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{erreur}</div>}
          <button type="submit" disabled={!canSubmit} className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-3.5 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {loading ? 'Envoi en cours...' : 'Envoyer'}
          </button>
          <p className="text-xs text-gray-400 text-center">Déjà 50+ fournisseurs nous font confiance 🌿</p>
        </form>
      </main>
    </div>
  );
}
