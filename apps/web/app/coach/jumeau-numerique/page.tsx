'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';

interface LacuneTendance {
  notion: string;
  total: number;
}

interface JumeauData {
  groupeId: string;
  nbSessions: number;
  tendances: LacuneTendance[];
  alertes: string[];
  historiqueComplet: {
    sessionId: string;
    createdAt: string;
    lacunes: { notion: string; frequence: number; typeErreur: string }[];
    exercices: { titre: string; questionSocrate: string }[];
    messageEncouragement: string;
    alerteCoachHumain: string | null;
  }[];
}

export default function JumeauNumeriquePage() {
  const [data, setData] = useState<JumeauData | null>(null);
  const [chargement, setChargement] = useState(true);
  const [sessionSelectee, setSessionSelectee] = useState(0);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    const groupeId = localStorage.getItem('rc_groupe_coach_id');
    const token = localStorage.getItem('rc_token');
    if (!groupeId || !token) return;

    fetch(`${API}/api/v1/coach/jumeau/${groupeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data); })
      .catch(console.error)
      .finally(() => setChargement(false));
  }, []);

  if (chargement) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl animate-spin mb-3">🤖</div>
          <p className="text-gray-500">Chargement du Jumeau Numérique…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card text-center p-8">
          <div className="text-4xl mb-3">📊</div>
          <h2 className="font-bold text-gray-700">Aucune donnée disponible</h2>
          <p className="text-sm text-gray-400 mt-1">Complétez au moins une session pour voir le Jumeau Numérique</p>
        </div>
      </div>
    );
  }

  // Préparer données graphique de progression (score moyen par session)
  const progressionData = data.historiqueComplet.slice().reverse().map((s, i) => ({
    session: `S${i + 1}`,
    lacunes: s.lacunes.length,
    date: new Date(s.createdAt).toLocaleDateString('fr-MA'),
  }));

  const sessionActuelle = data.historiqueComplet[sessionSelectee];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-brand-900 text-white px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-bold text-lg">🤖 Jumeau Numérique</h1>
          <p className="text-blue-200 text-sm">{data.nbSessions} sessions analysées · Coach IA Socrate</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">

        {/* Alertes urgentes */}
        {data.alertes.length > 0 && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-4">
            <h3 className="font-bold text-red-700 mb-2">🚨 Alertes persistantes</h3>
            {data.alertes.map((a, i) => (
              <p key={i} className="text-sm text-red-600">{a}</p>
            ))}
          </div>
        )}

        {/* Graphique tendances lacunes */}
        <div className="card">
          <h2 className="font-bold text-gray-800 mb-4">Évolution des lacunes par session</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={progressionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="session" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(val: number) => [`${val} lacunes`, 'Nombre de lacunes']}
                labelFormatter={(l) => `Session : ${l}`}
              />
              <Line
                type="monotone" dataKey="lacunes"
                stroke="#7C3AED" strokeWidth={2}
                dot={{ fill: '#7C3AED', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top lacunes globales */}
        {data.tendances.length > 0 && (
          <div className="card">
            <h2 className="font-bold text-gray-800 mb-4">Top notions à travailler</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.tendances} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="notion" width={130} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#2563EB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Détail session sélectionnée */}
        {sessionActuelle && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800">Détail session</h2>
              <select
                value={sessionSelectee}
                onChange={e => setSessionSelectee(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1"
              >
                {data.historiqueComplet.map((s, i) => (
                  <option key={i} value={i}>
                    Session {data.historiqueComplet.length - i} — {new Date(s.createdAt).toLocaleDateString('fr-MA')}
                  </option>
                ))}
              </select>
            </div>

            {/* Message encouragement */}
            <div className="bg-green-50 rounded-xl p-3 mb-4">
              <p className="text-sm text-green-700 italic">{sessionActuelle.messageEncouragement}</p>
            </div>

            {/* Exercices Socrate */}
            <h3 className="font-semibold text-gray-700 mb-2 text-sm">Exercices Socrate proposés :</h3>
            <div className="space-y-2">
              {sessionActuelle.exercices.map((ex, i) => (
                <div key={i} className="bg-purple-50 rounded-lg p-3">
                  <p className="font-medium text-purple-800 text-sm">{ex.titre}</p>
                  <p className="text-xs text-purple-600 mt-1 italic">
                    « {ex.questionSocrate} »
                  </p>
                </div>
              ))}
            </div>

            {/* Alerte coach humain */}
            {sessionActuelle.alerteCoachHumain && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 mb-1">📋 Note pour l'enseignant :</p>
                <p className="text-sm text-amber-700">{sessionActuelle.alerteCoachHumain}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
