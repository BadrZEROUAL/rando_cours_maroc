'use client';

import { useState } from 'react';

interface VarFormulaireProps {
  questionId: string;
  onSoumis: () => void;
  onPasser: () => void;
}

export default function VarFormulaire({ questionId, onSoumis, onPasser }: VarFormulaireProps) {
  const [numQuestion, setNumQuestion] = useState<number | ''>('');
  const [numReponse, setNumReponse] = useState<number | ''>('');
  const [commentaire, setCommentaire] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [succes, setSucces] = useState(false);
  const [erreur, setErreur] = useState('');

  const MIN_COMMENTAIRE = 20;
  const valide =
    numQuestion !== '' &&
    numReponse !== '' &&
    commentaire.length >= MIN_COMMENTAIRE;

  const handleSoumettre = async () => {
    if (!valide || envoi) return;
    setEnvoi(true);
    setErreur('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('rc_token');

      const res = await fetch(`${apiUrl}/api/v1/questions/${questionId}/var`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          numQuestion,
          numReponseContestee: numReponse,
          commentaire,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSucces(true);
        setTimeout(onSoumis, 1500);
      } else {
        setErreur(data.error || 'Erreur lors de la soumission');
      }
    } catch {
      setErreur('Erreur réseau — réessayez');
    } finally {
      setEnvoi(false);
    }
  };

  if (succes) {
    return (
      <div className="card max-w-lg mx-auto text-center animate-fade-in">
        <div className="text-4xl mb-3">📋</div>
        <h3 className="font-bold text-gray-800 mb-1">VAR soumise !</h3>
        <p className="text-sm text-gray-500">L'enseignant examinera votre contestation.</p>
      </div>
    );
  }

  return (
    <div className="card max-w-lg mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-2xl">🎥</span>
        <div>
          <h3 className="font-bold text-gray-800">Demande de VAR</h3>
          <p className="text-xs text-gray-500">
            Contestez une question — 2ème essai échoué
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Numéro de question */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Numéro de question contestée *
          </label>
          <select
            value={numQuestion}
            onChange={e => setNumQuestion(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">Sélectionner…</option>
            {[1, 2, 3, 4].map(n => (
              <option key={n} value={n}>Question {n}</option>
            ))}
          </select>
        </div>

        {/* Numéro de réponse contestée */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Réponse contestée (1 à 9) *
          </label>
          <select
            value={numReponse}
            onChange={e => setNumReponse(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">Sélectionner…</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Commentaire */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Explication de la contestation *
          </label>
          <textarea
            value={commentaire}
            onChange={e => setCommentaire(e.target.value)}
            placeholder="Expliquez pourquoi cette réponse vous semble incorrecte…"
            rows={4}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
          <div className={`text-right text-xs mt-1 ${
            commentaire.length >= MIN_COMMENTAIRE ? 'text-green-600' : 'text-gray-400'
          }`}>
            {commentaire.length}/{MIN_COMMENTAIRE} caractères minimum
          </div>
        </div>

        {erreur && (
          <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{erreur}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSoumettre}
            disabled={!valide || envoi}
            className="btn-primary flex-1"
          >
            {envoi ? 'Envoi…' : 'Soumettre la VAR'}
          </button>
          <button onClick={onPasser} className="btn-secondary">
            Passer
          </button>
        </div>
      </div>
    </div>
  );
}
