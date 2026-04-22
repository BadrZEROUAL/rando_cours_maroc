'use client';

import { useState, useEffect } from 'react';

interface SessionGroupe {
  sessionId: string;
  scoreQcm: number;
  scoreValidation: number;
  randoCoins: number;
  progressionStations: { stationNum: number; complete: boolean; fragmentLettre?: string }[];
}

interface WalletInfo {
  soldeRc: number;
  capitalInvestiDh: number;
}

export default function EleveDashboard() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [sessionActuelle, setSessionActuelle] = useState<SessionGroupe | null>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [lacunes, setLacunes] = useState<any[]>([]);
  const [chargement, setChargement] = useState(true);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    const token = localStorage.getItem('rc_token');
    if (!token) { window.location.href = '/login'; return; }
    chargerDonnees(token);
  }, []);

  const chargerDonnees = async (token: string) => {
    try {
      const [walletRes, badgesRes, coachRes] = await Promise.all([
        fetch(`${API}/api/v1/wallet/me`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/v1/badges/mes-badges`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/v1/coach/me`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (walletRes.ok) {
        const w = await walletRes.json();
        setWallet(w.data);
      }
      if (badgesRes.ok) {
        const b = await badgesRes.json();
        setBadges(b.data || []);
      }
      if (coachRes.ok) {
        const c = await coachRes.json();
        if (c.data?.length > 0) {
          setLacunes((c.data[0].lacunes || []).slice(0, 3));
        }
      }
    } catch (err) {
      console.error('Erreur chargement dashboard:', err);
    } finally {
      setChargement(false);
    }
  };

  const groupeId = typeof window !== 'undefined' ? localStorage.getItem('rc_groupe_id') : null;
  const sessionId = typeof window !== 'undefined' ? localStorage.getItem('rc_session_id') : null;

  if (chargement) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-spin">⏳</div>
          <p className="text-gray-500">Chargement de ton espace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-brand-900 text-white px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">🎒 RandoCours</h1>
            <p className="text-blue-200 text-xs">Espace élève</p>
          </div>
          {wallet && (
            <div className="text-right">
              <p className="text-xs text-blue-300">Mes RandoCoins</p>
              <p className="text-xl font-bold text-amber-300">
                {wallet.soldeRc.toLocaleString()} RC
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">

        {/* Carte session en cours */}
        {sessionId && groupeId ? (
          <div className="card border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-800">Session en cours</h2>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                Active
              </span>
            </div>
            <div className="flex gap-3">
              {[1, 2, 3, 4, 5].map(n => (
                <div key={n} className="flex-1 text-center">
                  <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center text-sm font-bold ${
                    n <= 2
                      ? 'bg-green-500 text-white'
                      : n === 3
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-400'
                  }`}>
                    {n <= 2 ? '✓' : n}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">S{n}</p>
                </div>
              ))}
            </div>
            <a
              href={`/eleve/station/${sessionId}`}
              className="btn-primary w-full mt-3 text-center block"
            >
              Continuer la station →
            </a>
          </div>
        ) : (
          <div className="card text-center py-8">
            <div className="text-4xl mb-3">🔒</div>
            <h2 className="font-bold text-gray-700 mb-1">Aucune session active</h2>
            <p className="text-sm text-gray-400">Attends que ton enseignant lance une session</p>
          </div>
        )}

        {/* Wallet */}
        {wallet && (
          <div className="card">
            <h2 className="font-bold text-gray-800 mb-3">💰 Mon Wallet</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">
                  {wallet.soldeRc.toLocaleString()}
                </p>
                <p className="text-xs text-amber-500 mt-1">RandoCoins disponibles</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {wallet.capitalInvestiDh.toLocaleString()} DH
                </p>
                <p className="text-xs text-blue-500 mt-1">Capital investi</p>
              </div>
            </div>
          </div>
        )}

        {/* Lacunes prioritaires (Coach IA) */}
        {lacunes.length > 0 && (
          <div className="card border-l-4 border-purple-400">
            <h2 className="font-bold text-gray-800 mb-3">🤖 Coach IA — Tes priorités</h2>
            <div className="space-y-2">
              {lacunes.map((l: any, i: number) => (
                <div key={i} className="flex items-start gap-2 bg-purple-50 rounded-lg p-3">
                  <span className="text-purple-500 font-bold text-sm shrink-0">#{i + 1}</span>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{l.notion}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{l.typeErreur}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-purple-400 mt-2 italic">
              Analyse de ta dernière session — Coach en mode Socrate
            </p>
          </div>
        )}

        {/* Badges */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800">🏅 Mes Badges</h2>
            <span className="text-xs text-gray-400">{badges.length} obtenu(s)</span>
          </div>
          {badges.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              Complète une session pour obtenir ton premier badge !
            </p>
          ) : (
            <div className="space-y-2">
              {badges.map((b: any) => (
                <div key={b.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className="text-2xl">
                    {'★'.repeat(b.niveau)}{'☆'.repeat(5 - b.niveau)}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 text-sm">{b.matiere}</p>
                    <p className="text-xs text-gray-400">
                      {b.score} / {b.scoreMax} pts · {new Date(b.issuedOn).toLocaleDateString('fr-MA')}
                    </p>
                  </div>
                  {b.pdfUrl && (
                    <a href={b.pdfUrl} target="_blank" rel="noopener"
                       className="text-xs text-blue-600 hover:underline">
                      PDF
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Déconnexion */}
        <button
          onClick={() => { localStorage.clear(); window.location.href = '/'; }}
          className="w-full text-sm text-gray-400 hover:text-gray-600 py-2"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
