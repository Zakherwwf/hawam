import { useState } from 'react';
import { Camera, ChartColumn, PawPrint, Route } from 'lucide-react';
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
            <PawPrint className="w-7 h-7 text-teal-700" aria-hidden />
            <div>
              <h1 className="text-base font-extrabold text-slate-900 leading-tight">Hawem</h1>
              <p className="text-[11px] text-teal-700 font-semibold uppercase tracking-wider">
                Portail chercheur
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-8 border-t border-slate-100"
          role="tablist"
          aria-label="Sections"
        >
          <button
            onClick={() => setActiveTab('exports')}
            role="tab"
            aria-selected={activeTab === 'exports'}
            className={`py-3 text-xs font-bold border-b-2 transition inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
              activeTab === 'exports'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ChartColumn className="w-4 h-4" aria-hidden />
            Exportations Scientifiques (DwC / SECR / Distance)
          </button>

          <button
            onClick={() => setActiveTab('photos')}
            role="tab"
            aria-selected={activeTab === 'photos'}
            className={`py-3 text-xs font-bold border-b-2 transition inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
              activeTab === 'photos'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Camera className="w-4 h-4" aria-hidden />
            Validation Photo-ID (File de Correspondance)
          </button>

          <button
            onClick={() => setActiveTab('routes')}
            role="tab"
            aria-selected={activeTab === 'routes'}
            className={`py-3 text-xs font-bold border-b-2 transition inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
              activeTab === 'routes'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Route className="w-4 h-4" aria-hidden />
            Gestion des Itinéraires Fixes (Routes)
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
        Plateforme de Science Citoyenne • Protection éthique des données géospatiales conforme au
        protocole de non-divulgation.
      </footer>
    </div>
  );
}

export default App;
