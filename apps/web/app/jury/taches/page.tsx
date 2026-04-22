'use client';

import { useState } from 'react';

interface TacheScore {
  tache: 'a' | 'b' | 'c' | 'd' | 'e';
  correct: boolean | null;
  points: number;
}

const TACHE_INFO = {
  a: { label: 'Justification', desc: 'Justifier la bonne réponse avec calcul + théorème', hasMalus: true },
  b: { label: '1er piège', desc: 'Choisir une mauvaise réponse et expliquer l\'erreur', hasMalus: true },
  c: { label: '2ème piège', desc: 'Choisir une autre mauvaise réponse et expliquer', hasMalus: true },
  d: { label: 'Méta-IA', desc: 'Sur quoi une IA se tromperait ici, et pourquoi ?', hasMalus: false },
  e: { label: 'Innovation', desc: 'Question qu\'aucune IA ne peut répondre correctement', hasMalus: false },
};

export default function JuryPage() {
  const [questionActuelle, setQuestionActuelle] = useState(1);
  const [difficulte] = useState(3);
  const [taches, setTaches] = useState<Record<string, TacheScore>>({});
  const [sliders, setSliders] = useState({ utilite: 0, creativite: 0, frugalite: 0, presentation: 0, potentiel: 0 });

  const pointsTache = (difficulte: number) => 50 + difficulte;
  const pointsTacheBonus = (difficulte: number) => 150 * difficulte;

  const scorerTache = (tache: 'a' | 'b' | 'c' | 'd' | 'e', correct: boolean) => {
    const info = TACHE_INFO[tache];
    let points = 0;

    if (tache === 'a' || tache === 'b' || tache === 'c') {
      points = correct ? pointsTache(difficulte) : -pointsTache(difficulte);
    } else {
      points = correct ? pointsTacheBonus(difficulte) : 0;
    }

    setTaches(prev => ({ ...prev, [`${questionActuelle}-${tache}`]: { tache, correct, points } }));
  };

  const scoreInnovation = Object.values(sliders).reduce((a, b) => a + b, 0) * 700;

  const scoreTotal = Object.values(taches).reduce((sum, t) => sum + t.points, 0);

  const getTacheScore = (tache: string) => taches[`${questionActuelle}-${tache}`];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-brand-900 text-white p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">Phase Validation — Jury</h1>
            <p className="text-blue-200 text-sm">Question {questionActuelle}/20</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-blue-300">Score jury</p>
            <p className={`text-2xl font-bold ${scoreTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {scoreTotal >= 0 ? '+' : ''}{scoreTotal} pts
            </p>
          </div>
        </div>
      </div>

      {/* Barre de progression */}
      <div className="bg-gray-200 h-1.5">
        <div
          className="bg-blue-500 h-1.5 transition-all"
          style={{ width: `${(questionActuelle / 20) * 100}%` }}
        />
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Tâches a, b, c, d, e */}
        {(['a', 'b', 'c', 'd', 'e'] as const).map(tache => {
          const info = TACHE_INFO[tache];
          const score = getTacheScore(tache);
          const pts = pointsTache(difficulte);
          const ptsBonus = pointsTacheBonus(difficulte);

          return (
            <div key={tache} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="inline-block bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded mr-2">
                    ({tache})
                  </span>
                  <span className="font-semibold text-gray-800">{info.label}</span>
                  {!info.hasMalus && (
                    <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                      Pas de malus
                    </span>
                  )}
                </div>
                {score && (
                  <span className={`text-sm font-bold ${score.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {score.points >= 0 ? '+' : ''}{score.points}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-3">{info.desc}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => scorerTache(tache, true)}
                  className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                    score?.correct === true
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                  }`}
                >
                  ✓ Correct
                  <span className="block text-xs font-normal">
                    +{tache === 'd' || tache === 'e' ? ptsBonus : pts} pts
                  </span>
                </button>
                <button
                  onClick={() => scorerTache(tache, false)}
                  className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                    score?.correct === false
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                  }`}
                >
                  {info.hasMalus ? '✗ Incorrect' : 'Pas de bonus'}
                  <span className="block text-xs font-normal">
                    {info.hasMalus ? `-${pts} pts` : '0 pt'}
                  </span>
                </button>
              </div>
            </div>
          );
        })}

        {/* Grille innovation (question 20 seulement) */}
        {questionActuelle === 20 && (
          <div className="card">
            <h3 className="font-bold text-gray-800 mb-4">
              Grille Innovation Frugale
              <span className="ml-2 text-blue-600">{scoreInnovation.toLocaleString()} RC</span>
            </h3>
            {Object.entries(sliders).map(([critere, val]) => (
              <div key={critere} className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize font-medium text-gray-700">{critere}</span>
                  <span className="text-blue-600 font-bold">{val}/2</span>
                </div>
                <div className="flex gap-2">
                  {[0, 1, 2].map(n => (
                    <button
                      key={n}
                      onClick={() => setSliders(prev => ({ ...prev, [critere]: n }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        val === n ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-blue-50'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-400 mt-2">Max : 5 critères × 2 = 10 pts → 7 000 RC</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          {questionActuelle > 1 && (
            <button
              onClick={() => setQuestionActuelle(q => q - 1)}
              className="btn-secondary flex-1"
            >
              ← Précédente
            </button>
          )}
          {questionActuelle < 20 ? (
            <button
              onClick={() => setQuestionActuelle(q => q + 1)}
              className="btn-primary flex-1"
            >
              Suivante →
            </button>
          ) : (
            <button className="btn-primary flex-1 bg-green-600 hover:bg-green-700">
              Valider la notation ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
