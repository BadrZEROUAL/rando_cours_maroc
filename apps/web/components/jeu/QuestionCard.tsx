'use client';

import { useState, useCallback } from 'react';
import DelaiTimer from './DelaiTimer';

interface Option {
  num: number;
  texte: string;
}

interface QuestionCardProps {
  questionNum: number;
  totalQuestions: number;
  enonce: string;
  options: Option[];
  groupeId: string;
  questionId: string;
  sessionId: string;
  essai: 1 | 2;
  onReponse: (result: ReponseResult) => void;
  onSuivante: () => void;
}

interface ReponseResult {
  correct: boolean;
  points: number;
  rcVariation: number;
  explication: string;
  penaliteRepetition: boolean;
  partageDetecte: boolean;
  choix: number;
}

export default function QuestionCard({
  questionNum,
  totalQuestions,
  enonce,
  options,
  groupeId,
  questionId,
  sessionId,
  essai,
  onReponse,
  onSuivante,
}: QuestionCardProps) {
  const [delaiExpire, setDelaiExpire] = useState(false);
  const [choixSelectionne, setChoixSelectionne] = useState<number | null>(null);
  const [resultat, setResultat] = useState<ReponseResult | null>(null);
  const [chargement, setChargement] = useState(false);

  const handleDelaiExpire = useCallback(() => {
    setDelaiExpire(true);
  }, []);

  const handleChoix = useCallback(async (num: number) => {
    if (!delaiExpire || choixSelectionne !== null || chargement) return;

    setChoixSelectionne(num);
    setChargement(true);

    const timestampDebut = Date.now() - 20_000; // approximation du début

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('rc_token');

      const res = await fetch(`${apiUrl}/api/v1/questions/${questionId}/reponse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ choix: num, essai, groupeId, timestampDebut }),
      });

      const data = await res.json();
      if (data.success) {
        const result: ReponseResult = { ...data.data, choix: num };
        setResultat(result);
        onReponse(result);

        // Passer à la question suivante après 3 secondes
        setTimeout(() => onSuivante(), 3000);
      }
    } catch (err) {
      console.error('Erreur réponse:', err);
    } finally {
      setChargement(false);
    }
  }, [delaiExpire, choixSelectionne, chargement, questionId, essai, groupeId, onReponse, onSuivante]);

  const getBtnClass = (num: number) => {
    if (resultat === null) {
      return choixSelectionne === num
        ? 'option-btn border-blue-500 bg-blue-50'
        : 'option-btn';
    }
    if (num === choixSelectionne) {
      return resultat.correct ? 'option-btn option-btn-correct' : 'option-btn option-btn-wrong';
    }
    return 'option-btn opacity-40';
  };

  return (
    <div className="card max-w-2xl mx-auto animate-fade-in">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
          Question {questionNum}/{totalQuestions}
        </span>
        {essai === 2 && (
          <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
            2ème essai
          </span>
        )}
      </div>

      {/* Délai anti-hasard */}
      {!delaiExpire && !resultat && (
        <DelaiTimer dureeSecondes={20} onExpire={handleDelaiExpire} />
      )}

      {/* Énoncé */}
      <p className="text-gray-800 font-medium text-base leading-relaxed mb-6">
        {enonce}
      </p>

      {/* Options */}
      <div className="grid grid-cols-1 gap-2">
        {options.map(opt => (
          <button
            key={opt.num}
            className={getBtnClass(opt.num)}
            onClick={() => handleChoix(opt.num)}
            disabled={!delaiExpire || choixSelectionne !== null}
            aria-label={`Option ${opt.num}`}
          >
            <span className="inline-flex items-center gap-3">
              <span className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-700 font-bold text-sm shrink-0">
                {opt.num}
              </span>
              <span>{opt.texte}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Feedback */}
      {resultat && (
        <div className={`mt-4 p-4 rounded-xl animate-slide-up ${
          resultat.correct
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{resultat.correct ? '✅' : '❌'}</span>
            <div>
              <span className={`font-bold ${resultat.correct ? 'text-green-700' : 'text-red-700'}`}>
                {resultat.correct ? 'Bonne réponse !' : 'Réponse incorrecte'}
              </span>
              <span className="ml-2 text-sm font-medium text-gray-600">
                {resultat.rcVariation >= 0 ? '+' : ''}{resultat.rcVariation} RC
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{resultat.explication}</p>
          {resultat.partageDetecte && (
            <p className="mt-2 text-xs text-red-600 font-medium">
              ⚠️ Partage de code détecté — pénalité -30% RC appliquée
            </p>
          )}
          <p className="text-xs text-gray-400 mt-2">Passage automatique dans 3 secondes…</p>
        </div>
      )}
    </div>
  );
}
