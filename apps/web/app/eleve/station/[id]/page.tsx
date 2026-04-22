'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import QuestionCard from '@/components/jeu/QuestionCard';
import VarFormulaire from '@/components/jeu/VarFormulaire';

type EtapeStation = 'scan' | 'questions' | 'code' | 'deuxieme_essai' | 'var' | 'succes';

interface QuestionPublique {
  id: string;
  stationNum: number;
  questionNum: number;
  enonce: string;
  options: { num: number; texte: string }[];
  chapitre: string;
}

interface ReponseResult {
  correct: boolean;
  points: number;
  rcVariation: number;
  explication: string;
  choix: number;
}

export default function StationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const stationId = params.id as string;
  const tokenUrl = searchParams.get('token');

  const [etape, setEtape] = useState<EtapeStation>(tokenUrl ? 'questions' : 'scan');
  const [questions, setQuestions] = useState<QuestionPublique[]>([]);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [reponses, setReponses] = useState<ReponseResult[]>([]);
  const [code, setCode] = useState('');
  const [codeErreur, setCodeErreur] = useState('');
  const [essai, setEssai] = useState<1 | 2>(1);
  const [indice, setIndice] = useState('');
  const [fragment, setFragment] = useState('');
  const [chargement, setChargement] = useState(false);
  const scannerRef = useRef<any>(null);

  const groupeId = typeof window !== 'undefined'
    ? localStorage.getItem('rc_groupe_id') || ''
    : '';
  const sessionId = typeof window !== 'undefined'
    ? localStorage.getItem('rc_session_id') || ''
    : '';

  // ── Charger les questions après scan QR ──────────────────────
  useEffect(() => {
    if (tokenUrl && etape === 'questions') {
      validerQRToken(tokenUrl);
    }
  }, [tokenUrl]);

  const validerQRToken = async (token: string) => {
    setChargement(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const authToken = localStorage.getItem('rc_token');

      const res = await fetch(`${apiUrl}/api/v1/qrcode/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token, groupeId }),
      });

      const data = await res.json();
      if (data.success) {
        setQuestions(data.data.questions);
        setEtape('questions');
      } else {
        const msgs: Record<string, string> = {
          QR_EXPIRED: 'Ce QR code a expiré (30 min max). Demandez-en un nouveau.',
          QR_WRONG_GROUPE: 'Ce QR code n\'appartient pas à votre groupe.',
          QR_ALREADY_USED: 'Ce QR code a déjà été utilisé.',
          QR_INVALID: 'QR code invalide.',
        };
        alert(msgs[data.code] || data.error);
      }
    } catch {
      alert('Erreur réseau lors de la validation du QR code.');
    } finally {
      setChargement(false);
    }
  };

  // ── Scanner QR avec caméra ───────────────────────────────────
  const demarrerScan = async () => {
    const { Html5Qrcode } = await import('html5-qrcode');
    scannerRef.current = new Html5Qrcode('qr-reader');

    await scannerRef.current.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText: string) => {
        await scannerRef.current?.stop();
        const url = new URL(decodedText);
        const token = url.searchParams.get('token');
        if (token) await validerQRToken(token);
      },
      () => {} // Erreur de scan — silencieuse
    );
  };

  // ── Réponse à une question ───────────────────────────────────
  const handleReponse = (result: ReponseResult) => {
    setReponses(prev => [...prev, result]);
  };

  const handleSuivante = () => {
    if (questionIdx + 1 < questions.length) {
      setQuestionIdx(prev => prev + 1);
    } else {
      setEtape('code');
    }
  };

  // ── Vérifier le code à 4 chiffres ────────────────────────────
  const verifierCode = async () => {
    if (code.length !== 4) return;
    setChargement(true);
    setCodeErreur('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const authToken = localStorage.getItem('rc_token');

      const res = await fetch(`${apiUrl}/api/v1/fragments/${groupeId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ code, sessionId, stationId }),
      });

      const data = await res.json();
      if (data.success && data.data.valid) {
        setFragment(data.data.fragment);
        setIndice(data.data.indiceSuivant || '');
        setEtape('succes');
      } else if (essai === 1) {
        setCodeErreur('Code incorrect. Un 2ème essai est possible.');
        setEtape('deuxieme_essai');
        setEssai(2);
      } else {
        setCodeErreur('Code incorrect — Voulez-vous demander une VAR ?');
      }
    } catch {
      setCodeErreur('Erreur réseau lors de la vérification.');
    } finally {
      setChargement(false);
    }
  };

  // ── Rendu selon l'étape ──────────────────────────────────────
  if (chargement) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-3">⏳</div>
          <p className="text-gray-500">Chargement…</p>
        </div>
      </div>
    );
  }

  if (etape === 'scan') {
    return (
      <div className="min-h-screen p-4 flex flex-col items-center justify-center bg-brand-900">
        <div className="card max-w-sm w-full text-center">
          <div className="text-5xl mb-4">📷</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Scanner le QR code</h2>
          <p className="text-sm text-gray-500 mb-6">
            Trouvez le QR code de votre station et scannez-le
          </p>
          <div id="qr-reader" className="w-full mb-4 rounded-xl overflow-hidden" />
          <button onClick={demarrerScan} className="btn-primary w-full">
            Ouvrir la caméra
          </button>
        </div>
      </div>
    );
  }

  if (etape === 'questions' && questions.length > 0) {
    const q = questions[questionIdx];
    return (
      <div className="min-h-screen p-4 bg-gray-50">
        <QuestionCard
          questionNum={questionIdx + 1}
          totalQuestions={questions.length}
          enonce={q.enonce}
          options={q.options}
          groupeId={groupeId}
          questionId={q.id}
          sessionId={sessionId}
          essai={essai}
          onReponse={handleReponse}
          onSuivante={handleSuivante}
        />
      </div>
    );
  }

  if (etape === 'code' || etape === 'deuxieme_essai') {
    return (
      <div className="min-h-screen p-4 flex flex-col items-center justify-center bg-gray-50">
        <div className="card max-w-sm w-full">
          <h2 className="text-xl font-bold text-gray-800 mb-1 text-center">
            {etape === 'deuxieme_essai' ? '2ème essai' : 'Code de la station'}
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            Saisissez le code à 4 chiffres formé par vos bonnes réponses
          </p>

          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="w-14 h-14 border-2 border-gray-300 rounded-xl flex items-center justify-center text-2xl font-bold text-brand-900">
                {code[i] || ''}
              </div>
            ))}
          </div>

          {/* Clavier numérique */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
              <button
                key={n}
                onClick={() => code.length < 4 && setCode(prev => prev + n)}
                className="h-14 rounded-xl bg-gray-100 hover:bg-blue-100 text-xl font-bold transition-colors"
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setCode('')}
              className="h-14 rounded-xl bg-gray-100 hover:bg-red-100 text-sm font-medium transition-colors"
            >
              Effacer
            </button>
            <button
              onClick={() => code.length < 4 && setCode(prev => prev + '0')}
              className="h-14 rounded-xl bg-gray-100 hover:bg-blue-100 text-xl font-bold transition-colors"
            >
              0
            </button>
            <button
              onClick={() => setCode(prev => prev.slice(0, -1))}
              className="h-14 rounded-xl bg-gray-100 hover:bg-amber-100 text-xl font-medium transition-colors"
            >
              ←
            </button>
          </div>

          {codeErreur && (
            <p className="text-sm text-red-600 text-center mb-3">{codeErreur}</p>
          )}

          <button
            onClick={verifierCode}
            disabled={code.length !== 4 || chargement}
            className="btn-primary w-full"
          >
            Valider le code
          </button>

          {essai === 2 && (
            <button
              onClick={() => setEtape('var')}
              className="btn-secondary w-full mt-2 text-sm"
            >
              Demander une VAR
            </button>
          )}
        </div>
      </div>
    );
  }

  if (etape === 'var') {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center bg-gray-50">
        <VarFormulaire
          questionId={questions[questions.length - 1]?.id || ''}
          onSoumis={() => setEtape('code')}
          onPasser={() => setEtape('code')}
        />
      </div>
    );
  }

  if (etape === 'succes') {
    return (
      <div className="min-h-screen p-4 flex flex-col items-center justify-center bg-brand-900 text-white">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4 animate-bounce">🎉</div>
          <h2 className="text-2xl font-bold mb-2">Station déverrouillée !</h2>
          {fragment && (
            <div className="bg-white/10 rounded-2xl p-4 my-4">
              <p className="text-xs text-blue-200 mb-1">Fragment du message secret :</p>
              <p className="text-3xl font-bold tracking-widest">{fragment}</p>
            </div>
          )}
          {indice && (
            <div className="bg-white/10 rounded-2xl p-4 my-3">
              <p className="text-xs text-blue-200 mb-1">Indice — Station suivante :</p>
              <p className="text-sm italic">{indice}</p>
            </div>
          )}
          <a href="/eleve" className="btn-primary inline-block mt-4 bg-white text-brand-900">
            Retour au dashboard
          </a>
        </div>
      </div>
    );
  }

  return null;
}
