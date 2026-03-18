'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function FournisseursPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contact, setContact] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');
  const fichierNom = fichier?.name ?? '';
  const canSubmit = contact.trim() && fichier && !loading;

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-3xl">🌿</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Willy <span className="text-green-600">Anti-gaspi</span></h1>
              <p className="text-xs text-gray-500">Marketplace anti-gaspi BtoB</p>
            </div>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        {/* HERO */}
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-3">Vos surplus trouvent preneur en 24h</h2>
          <p className="text-lg text-gray-600 mb-6">On achete vos stocks proches DDM, surplus et declasses. Paiement garanti, zero invendu.</p>
          <div className="flex justify-center gap-6 flex-wrap">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-5 py-3 text-center">
              <p className="text-2xl font-bold text-green-600">50+</p>
              <p className="text-xs text-gray-500">fournisseurs</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-5 py-3 text-center">
              <p className="text-2xl font-bold text-green-600">300+</p>
              <p className="text-xs text-gray-500">acheteurs BtoB</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-5 py-3 text-center">
              <p className="text-2xl font-bold text-green-600">48h</p>
              <p className="text-xs text-gray-500">paiement</p>
            </div>
          </div>
        </div>

        {/* 3 ETAPES */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <span className="text-3xl mb-2 block">📎</span>
            <p className="font-semibold text-gray-900 mb-1">Envoyez votre listing</p>
            <p className="text-sm text-gray-600">2 minutes, n&apos;importe quel format</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <span className="text-3xl mb-2 block">🛒</span>
            <p className="font-semibold text-gray-900 mb-1">On trouve vos acheteurs</p>
            <p className="text-sm text-gray-600">Nos clients BtoB recoivent vos offres immediatement</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <span className="text-3xl mb-2 block">💸</span>
            <p className="font-semibold text-gray-900 mb-1">Vous etes paye</p>
            <p className="text-sm text-gray-600">Paiement garanti des accord, sous 48h</p>
          </div>
        </div>

        {/* FORMULAIRE */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
          <div>
            <label htmlFor="contact" className="block text-sm font-medium text-gray-700 mb-1.5">Comment vous joindre ?</label>
            <input id="contact" type="text" required placeholder="Votre email ou numero WhatsApp" value={contact} onChange={(e) => setContact(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-green-500 outline-none text-base" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Votre fichier</label>
            <input ref={fileInputRef} type="file" required onChange={(e) => setFichier(e.target.files?.[0] ?? null)} className="hidden" accept=".pdf,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.doc,.docx,.eml,.msg" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-green-500 transition-colors text-left flex items-center gap-3">
              <span className="text-sm text-gray-500">{fichierNom || 'Cliquez pour choisir un fichier'}</span>
            </button>
            <p className="text-xs text-gray-400 mt-1.5">Photo, Excel, PDF, email transfere — tout fonctionne</p>
          </div>
          {erreur && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{erreur}</div>}
          <button type="submit" disabled={!canSubmit} className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-4 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {loading ? 'Envoi en cours...' : 'Envoyer mon listing →'}
          </button>
          <p className="text-xs text-gray-400 text-center">🔒 Confidentiel &bull; Reponse sous 24h</p>
        </form>

        {/* FOOTER */}
        <div className="text-center mt-10 text-sm text-gray-500">
          Des questions ? Ecrivez-nous sur WhatsApp : <span className="font-semibold text-gray-700">06 XX XX XX XX</span>
        </div>
      </main>
    </div>
  );
}
