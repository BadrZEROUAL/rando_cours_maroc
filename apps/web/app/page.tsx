export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-brand-900 to-brand-700 text-white p-6">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🎒</div>
        <h1 className="text-4xl font-bold mb-2">RandoCours</h1>
        <p className="text-blue-200 text-lg mb-8">
          L&apos;Escape Game éducatif du Maroc
        </p>
        <div className="space-y-3">
          <a
            href="/eleve"
            className="block w-full bg-blue-500 hover:bg-blue-400 text-white font-semibold py-4 px-6 rounded-2xl transition-colors text-lg"
          >
            Je suis élève
          </a>
          <a
            href="/jury"
            className="block w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-4 px-6 rounded-2xl transition-colors"
          >
            Je suis jury / enseignant
          </a>
          <a
            href="/admin"
            className="block w-full text-blue-300 hover:text-white py-2 transition-colors text-sm"
          >
            Administration
          </a>
        </div>
      </div>
    </main>
  );
}
