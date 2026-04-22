'use client';

import { useState } from 'react';

interface ReçuData {
  transactionId: string;
  userId: string;
  montantDh: number;
  montantRc: number;
  soldeApres: number;
  date: string;
}

export default function PaiementPage() {
  const [userId, setUserId] = useState('');
  const [montantDh, setMontantDh] = useState('');
  const [chargement, setChargement] = useState(false);
  const [recu, setRecu] = useState<ReçuData | null>(null);
  const [erreur, setErreur] = useState('');

  const montantRcPreview = montantDh ? parseInt(montantDh) * 100 : 0;

  const handleCrediter = async () => {
    if (!userId || !montantDh || parseInt(montantDh) <= 0) return;
    setChargement(true);
    setErreur('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('rc_token');

      const res = await fetch(`${apiUrl}/api/v1/wallet/credit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, montantDh: parseInt(montantDh) }),
      });

      const data = await res.json();
      if (data.success) {
        setRecu({
          transactionId: data.data.transactionId,
          userId,
          montantDh: parseInt(montantDh),
          montantRc: data.data.montantRc,
          soldeApres: data.data.soldeApres,
          date: new Date().toLocaleString('fr-MA'),
        });
        setUserId('');
        setMontantDh('');
      } else {
        setErreur(data.error || 'Erreur lors du crédit');
      }
    } catch {
      setErreur('Erreur réseau');
    } finally {
      setChargement(false);
    }
  };

  const imprimerRecu = () => {
    if (!recu) return;
    const contenu = `
      <html><head><title>Reçu RandoCours</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 40px auto; }
        h1 { color: #1A2B4A; } .ligne { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee; }
        .total { font-weight:bold; font-size:1.2em; } .footer { text-align:center; color:#999; font-size:0.8em; margin-top:20px; }
      </style></head><body>
      <h1>🎒 RandoCours Maroc</h1>
      <h2>Reçu de paiement</h2>
      <div class="ligne"><span>N° Transaction</span><span>${recu.transactionId.slice(0, 8).toUpperCase()}</span></div>
      <div class="ligne"><span>Date</span><span>${recu.date}</span></div>
      <div class="ligne"><span>ID Utilisateur</span><span>${recu.userId.slice(0, 8)}…</span></div>
      <div class="ligne"><span>Montant payé</span><span>${recu.montantDh} DH</span></div>
      <div class="ligne total"><span>RandoCoins crédités</span><span>${recu.montantRc.toLocaleString()} RC</span></div>
      <div class="ligne"><span>Nouveau solde</span><span>${recu.soldeApres.toLocaleString()} RC</span></div>
      <div class="footer">Taux : 1 DH = 100 RC · randocours.ma</div>
      </body></html>
    `;
    const win = window.open('', '_blank');
    win?.document.write(contenu);
    win?.document.close();
    win?.print();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-brand-900">Paiement cash DH → RC</h1>
          <p className="text-sm text-gray-500 mt-1">Administration · Taux : 1 DH = 100 RC</p>
        </div>

        {!recu ? (
          <div className="card space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID de l'utilisateur *
              </label>
              <input
                type="text"
                value={userId}
                onChange={e => setUserId(e.target.value)}
                placeholder="UUID de l'élève (affiché dans l'app)"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Montant en DH *
              </label>
              <input
                type="number"
                min="1"
                value={montantDh}
                onChange={e => setMontantDh(e.target.value)}
                placeholder="Ex: 30"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {montantRcPreview > 0 && (
                <p className="text-xs text-blue-600 mt-1 font-medium">
                  → {montantRcPreview.toLocaleString()} RandoCoins seront crédités
                </p>
              )}
            </div>

            {erreur && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{erreur}</p>
            )}

            <button
              onClick={handleCrediter}
              disabled={!userId || !montantDh || parseInt(montantDh) <= 0 || chargement}
              className="btn-primary w-full"
            >
              {chargement ? 'Traitement…' : 'Créditer le wallet'}
            </button>
          </div>
        ) : (
          <div className="card animate-fade-in">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">✅</div>
              <h2 className="font-bold text-green-700 text-lg">Crédit effectué !</h2>
            </div>

            <div className="space-y-2 text-sm">
              {[
                ['N° Transaction', recu.transactionId.slice(0, 8).toUpperCase()],
                ['Date', recu.date],
                ['Montant payé', `${recu.montantDh} DH`],
                ['RC crédités', `${recu.montantRc.toLocaleString()} RC`],
                ['Nouveau solde', `${recu.soldeApres.toLocaleString()} RC`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              <button onClick={imprimerRecu} className="btn-secondary w-full">
                🖨️ Imprimer le reçu
              </button>
              <button onClick={() => setRecu(null)} className="btn-primary w-full">
                Nouveau paiement
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
