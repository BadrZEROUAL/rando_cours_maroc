'use client';

import { useState, useEffect } from 'react';

interface SessionData {
  id: string;
  niveau: string;
  matiere: string;
  theme: string;
  difficulte: number;
  status: string;
  nbGroupes: number;
  createdAt: string;
}

const NIVEAUX = ['AC1','AC2','AC3','TC','BAC1_SE','BAC1_SM','BAC2_SP','BAC2_SMA','BAC2_SVT'];
const MATIERES = ['Maths','Physique_Chimie','SVT','Sciences_Ingenieur','Arabe','Francais','Histoire_Geo'];
const THEMES_PREDEFS = [
  'Intelligence Artificielle', 'Gaming & E-Sport', 'TikTok & Réseaux Sociaux',
  'Coupe du Monde 2030', 'Énergies Renouvelables', 'Startups & Entrepreneuriat',
  'TGV & Infrastructure', 'Concours ENSA/Médecine', 'Changement Climatique',
  'E-commerce', 'Stress Hydrique', 'Musique & Streaming',
];

export default function AdminDashboard() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [form, setForm] = useState({
    niveau: 'BAC2_SMA', matiere: 'Maths', theme: '', difficulte: 3,
    nbGroupes: 3, themePersonnalise: '',
  });
  const [creation, setCreation] = useState(false);
  const [generation, setGeneration] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    chargerSessions();
  }, []);

  const chargerSessions = async () => {
    setChargement(true);
    try {
      const token = localStorage.getItem('rc_token');
      const res = await fetch(`${API}/api/v1/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setSessions(d.data || []);
      }
    } catch (err) { console.error(err); }
    finally { setChargement(false); }
  };

  const creerEtGenerer = async () => {
    setCreation(true);
    const token = localStorage.getItem('rc_token');
    const theme = form.themePersonnalise || form.theme;

    try {
      // 1. Créer la session
      const createRes = await fetch(`${API}/api/v1/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, theme }),
      });
      const createData = await createRes.json();
      if (!createData.success) throw new Error(createData.error);

      const sessionId = createData.data.id;
      setGeneration(sessionId);

      // 2. Déclencher la génération IA
      const genRes = await fetch(`${API}/api/v1/sessions/${sessionId}/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const genData = await genRes.json();
      if (!genData.success) throw new Error(genData.error);

      await chargerSessions();
      setGeneration(null);
      alert(`✅ Session créée et 20 questions générées ! ID : ${sessionId}`);
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
      setGeneration(null);
    } finally {
      setCreation(false);
    }
  };

  const statusColor: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    configured: 'bg-blue-100 text-blue-700',
    generated: 'bg-purple-100 text-purple-700',
    active: 'bg-green-100 text-green-700',
    validation: 'bg-amber-100 text-amber-700',
    completed: 'bg-teal-100 text-teal-700',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-brand-900 text-white px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">⚙️ Administration</h1>
            <p className="text-blue-200 text-xs">Gestion des sessions RandoCours</p>
          </div>
          <a href="/admin/paiement"
             className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
            💰 Paiements
          </a>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-5">

        {/* Créer une nouvelle session */}
        <div className="card">
          <h2 className="font-bold text-gray-800 mb-4">Nouvelle session</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Niveau</label>
              <select value={form.niveau}
                onChange={e => setForm(f => ({...f, niveau: e.target.value}))}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm">
                {NIVEAUX.map(n => <option key={n} value={n}>{n.replace('_',' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Matière</label>
              <select value={form.matiere}
                onChange={e => setForm(f => ({...f, matiere: e.target.value}))}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm">
                {MATIERES.map(m => <option key={m} value={m}>{m.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Thème</label>
              <select value={form.theme}
                onChange={e => setForm(f => ({...f, theme: e.target.value, themePersonnalise: ''}))}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm">
                <option value="">Sélectionner…</option>
                {THEMES_PREDEFS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Thème libre</label>
              <input type="text" value={form.themePersonnalise}
                onChange={e => setForm(f => ({...f, themePersonnalise: e.target.value, theme: ''}))}
                placeholder="Ex: Festival Mawazine"
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Difficulté : {'★'.repeat(form.difficulte)}{'☆'.repeat(5-form.difficulte)}
              </label>
              <input type="range" min="1" max="5" value={form.difficulte}
                onChange={e => setForm(f => ({...f, difficulte: Number(e.target.value)}))}
                className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre de groupes</label>
              <select value={form.nbGroupes}
                onChange={e => setForm(f => ({...f, nbGroupes: Number(e.target.value)}))}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm">
                <option value={3}>3 groupes</option>
                <option value={4}>4 groupes</option>
                <option value={5}>5 groupes</option>
              </select>
            </div>
          </div>

          {generation && (
            <div className="mt-3 bg-purple-50 rounded-lg p-3 flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              <p className="text-sm text-purple-700">Génération IA en cours (15-45s)…</p>
            </div>
          )}

          <button
            onClick={creerEtGenerer}
            disabled={creation || (!form.theme && !form.themePersonnalise)}
            className="btn-primary w-full mt-4"
          >
            {creation ? '⏳ Création + génération IA…' : '✨ Créer & Générer (Claude Sonnet)'}
          </button>
        </div>

        {/* Liste des sessions */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">Sessions</h2>
            <button onClick={chargerSessions} className="text-xs text-blue-600 hover:underline">
              ↺ Actualiser
            </button>
          </div>

          {chargement ? (
            <p className="text-sm text-gray-400 text-center py-4">Chargement…</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Aucune session créée</p>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => (
                <div key={s.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 text-sm truncate">{s.theme}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[s.status] || 'bg-gray-100'}`}>
                        {s.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.niveau.replace('_',' ')} · {s.matiere.replace(/_/g,' ')} · {'★'.repeat(s.difficulte)} · {s.nbGroupes} groupes
                    </p>
                  </div>
                  {s.status === 'generated' && (
                    <button
                      onClick={() => {
                        localStorage.setItem('rc_session_id', s.id);
                        window.location.href = '/eleve';
                      }}
                      className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200">
                      Lancer
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
