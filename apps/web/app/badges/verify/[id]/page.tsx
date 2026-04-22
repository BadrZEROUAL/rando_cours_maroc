import { Metadata } from 'next';

interface BadgeVerif {
  valide: boolean;
  revoque?: boolean;
  id?: string;
  niveau?: number;
  matiere?: string;
  score?: number;
  scoreMax?: number;
  competences?: string[];
  date?: string;
  issuer?: string;
  error?: string;
}

async function getBadgeData(id: string): Promise<BadgeVerif> {
  try {
    const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.randocours.ma';
    const res = await fetch(`${API}/api/v1/badges/verify/${id}`, {
      next: { revalidate: 3600 },
    });
    return res.json();
  } catch {
    return { valide: false, error: 'Erreur de vérification' };
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const badge = await getBadgeData(params.id);
  if (badge.valide) {
    return {
      title: `Badge RandoCours — Niveau ${badge.niveau} ${badge.matiere}`,
      description: `Badge de compétences validé sur RandoCours Maroc`,
    };
  }
  return { title: 'Vérification badge — RandoCours' };
}

export default async function BadgeVerifyPage({ params }: { params: { id: string } }) {
  const badge = await getBadgeData(params.id);

  const etoiles = badge.niveau
    ? '★'.repeat(badge.niveau) + '☆'.repeat(5 - badge.niveau)
    : '';

  const competenceLabels: Record<string, string> = {
    pensee_critique: 'Pensée critique',
    debat: 'Capacité à débattre',
    creativite: 'Créativité profonde',
    cooperation: 'Coopération',
    meta_apprentissage: 'Méta-apprentissage',
  };

  return (
    <div className="min-h-screen bg-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎒</div>
          <h1 className="text-xl font-bold text-white">RandoCours Maroc</h1>
          <p className="text-blue-300 text-xs">Vérification de badge</p>
        </div>

        <div className="card">
          {badge.valide ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-xl">✅</span>
                </div>
                <div>
                  <p className="font-bold text-green-700">Badge valide</p>
                  <p className="text-xs text-gray-400">ID : {badge.id?.slice(0, 8).toUpperCase()}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs text-blue-400 mb-1">Niveau validé</p>
                  <p className="font-bold text-blue-700 text-lg">{etoiles}</p>
                  <p className="text-sm text-blue-600">{badge.matiere}</p>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400">Score</p>
                    <p className="font-bold text-gray-800">
                      {badge.score} / {badge.scoreMax}
                    </p>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400">Délivré le</p>
                    <p className="font-bold text-gray-800 text-sm">
                      {badge.date ? new Date(badge.date).toLocaleDateString('fr-MA') : '—'}
                    </p>
                  </div>
                </div>

                {badge.competences && badge.competences.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Compétences démontrées</p>
                    <div className="flex flex-wrap gap-1">
                      {badge.competences.map(c => (
                        <span key={c}
                          className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                          {competenceLabels[c] || c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-400 text-center">
                  {badge.issuer}
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">{badge.revoque ? '🚫' : '❓'}</div>
              <h2 className="font-bold text-gray-700 mb-1">
                {badge.revoque ? 'Badge révoqué' : 'Badge invalide'}
              </h2>
              <p className="text-sm text-gray-400">
                {badge.revoque
                  ? 'Ce badge a été révoqué par l\'émetteur.'
                  : 'Ce badge n\'existe pas ou est introuvable.'}
              </p>
            </div>
          )}
        </div>

        <p className="text-center mt-4 text-blue-300 text-xs">
          randocours.ma · Loi 09-08 CNDP Maroc
        </p>
      </div>
    </div>
  );
}
