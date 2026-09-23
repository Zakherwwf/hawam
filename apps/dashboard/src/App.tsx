import { useState } from 'react';
import { RouteManager } from './components/RouteManager';
import { PhotoReviewQueue } from './components/PhotoReviewQueue';
import { DataExporter } from './components/DataExporter';

export function App() {
  const [activeTab, setActiveTab] = useState<'routes' | 'photos' | 'exports'>('exports');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🇹🇳</span>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 leading-tight">
                Observatoire National des Chiens & Chats Errants
              </h1>
              <p className="text-[11px] text-teal-700 font-semibold uppercase tracking-wider">
                Portail Chercheur • Institut Pasteur de Tunis & Services Vétérinaires
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-800">Dr. Chercheur Pasteur</div>
              <div className="text-[11px] text-teal-700 font-medium">Rôle : Chercheur Accrédité</div>
            </div>
            <div className="h-9 w-9 rounded-full bg-teal-800 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              IPT
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-8 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('exports')}
            className={`py-3 text-xs font-bold border-b-2 transition ${
              activeTab === 'exports'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            📊 Exportations Scientifiques (DwC / SECR / Distance)
          </button>

          <button
            onClick={() => setActiveTab('photos')}
            className={`py-3 text-xs font-bold border-b-2 transition ${
              activeTab === 'photos'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            📷 Validation Photo-ID (File de Correspondance)
          </button>

          <button
            onClick={() => setActiveTab('routes')}
            className={`py-3 text-xs font-bold border-b-2 transition ${
              activeTab === 'routes'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            🗺️ Gestion des Itinéraires Fixes (Routes)
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'exports' && <DataExporter />}
        {activeTab === 'photos' && <PhotoReviewQueue />}
        {activeTab === 'routes' && <RouteManager />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        Plateforme de Science Citoyenne • Protection éthique des données géospatiales conforme au protocole de non-divulgation.
      </footer>
    </div>
  );
}

export default App;
