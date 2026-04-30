'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

type Mode = 'login' | 'register';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telephone, setTelephone] = useState('');
  const [isMineur, setIsMineur] = useState(false);
  const [parentEmail, setParentEmail] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async () => {
    setChargement(true);
    setErreur('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) {
        localStorage.setItem('rc_token', data.session.access_token);
        localStorage.setItem('rc_user_id', data.user.id);
        window.location.href = '/eleve';
      }
    } catch (err: any) {
      setErreur(err.message || 'Erreur de connexion');
    } finally {
      setChargement(false);
    }
  };

  const handleRegister = async () => {
    if (isMineur && !parentEmail) {
      setErreur('Email du parent obligatoire pour les mineurs');
      return;
    }
    setChargement(true);
    setErreur('');
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? 
            `${window.location.origin}/auth/callback`,
          data: { telephone, isMineur, parentEmail: isMineur ? parentEmail : null },
        },
      });
      if (error) throw error;
      setMessage('Compte créé ! Vérifie ton email pour confirmer ton inscription.');
      setMode('login');
    } catch (err: any) {
      setErreur(err.message || 'Erreur lors de la création du compte');
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🎒</div>
          <h1 className="text-2xl font-bold text-white">RandoCours Maroc</h1>
          <p className="text-blue-300 text-sm mt-1">Escape Game éducatif</p>
        </div>

        <div className="card">
          {/* Onglets */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-5">
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setErreur(''); }}
                className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                  mode === m ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {m === 'login' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mot de passe"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            {mode === 'register' && (
              <>
                <input
                  type="tel"
                  value={telephone}
                  onChange={e => setTelephone(e.target.value)}
                  placeholder="Téléphone (optionnel)"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMineur}
                    onChange={e => setIsMineur(e.target.checked)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-600">Je suis mineur(e) (moins de 18 ans)</span>
                </label>
                {isMineur && (
                  <input
                    type="email"
                    value={parentEmail}
                    onChange={e => setParentEmail(e.target.value)}
                    placeholder="Email du parent / tuteur *"
                    className="w-full border border-amber-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                )}
              </>
            )}

            {erreur && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{erreur}</p>
            )}
            {message && (
              <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">{message}</p>
            )}

            <button
              onClick={mode === 'login' ? handleLogin : handleRegister}
              disabled={chargement || !email || !password}
              className="btn-primary w-full"
            >
              {chargement ? '…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </div>

          {mode === 'register' && (
            <p className="text-xs text-gray-400 text-center mt-3">
              En vous inscrivant, vous acceptez notre politique de confidentialité (Loi 09-08 CNDP Maroc)
            </p>
          )}
        </div>

        <p className="text-center mt-4 text-blue-300 text-xs">
          randocours.ma · Mohammed Iguider · 2026
        </p>
      </div>
    </div>
  );
}
