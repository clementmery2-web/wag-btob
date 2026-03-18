'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function FournisseursPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
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
      formData.append('fichier', fichier!);
      const res = await fetch('/api/fournisseurs', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur lors de l\'envoi');
      }
      router.push('/fournisseurs/confirmation');
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Une erreur est survenue. Reessayez.');
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
              <h1 className="text-xl font-bold text-gray-900 leading-tight">WAG <span className="text-green-600">BtoB</span></h1>
              <p className="text-xs text-gray-500 -mt-0.5">Espace fournisseur</p>
            </div>
          </Link>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Vous avez du stock a ecouler ?</h2>
          <p className="text-gray-600">Envoyez-nous votre listing, on s&apos;occupe du reste.</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
          <div>
            <label htmlFor="prenom" className="block text-sm font-medium text-gray-700 mb-1.5">Prenom</label>
            <input id="prenom" type="text" required autoComplete="given-name" placeholder="Votre prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-colors text-base" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input id="email" type="email" required autoComplete="email" placeholder="votre@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-colors text-base" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Votre fichier (PDF, Excel, photo...)</label>
            <input ref={fileInputRef} type="file" required onChange={(e) => setFichier(e.target.files?.[0] ?? null)} className="hidden" accept=".pdf,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-green-500 transition-colors text-left flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
