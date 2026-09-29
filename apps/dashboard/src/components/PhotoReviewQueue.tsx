import React, { useState } from 'react';
import { Check, CircleCheckBig, X } from 'lucide-react';

interface ProposedMatch {
  id: string;
  species: 'cat' | 'dog';
  score: number;
  method: 'algorithm' | 'human';
  angleA: string;
  dateA: string;
  locationA: string;
  imageA: string;
  angleB: string;
  dateB: string;
  locationB: string;
  imageB: string;
  coatPattern: string;
}

const SAMPLE_MATCHES: ProposedMatch[] = [
  {
    id: 'match-101',
    species: 'cat',
    score: 0.942,
    method: 'algorithm',
    angleA: 'Flanc Gauche',
    dateA: '2026-09-18 08:30',
    locationA: 'Tunis Médina (1km grid)',
    imageA: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80',
    angleB: 'Flanc Gauche',
    dateB: '2026-09-22 17:15',
    locationB: 'Tunis Médina (1km grid)',
    imageB: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=600&q=80',
    coatPattern: 'Tabby avec plastron blanc asymétrique',
  },
  {
    id: 'match-102',
    species: 'dog',
    score: 0.887,
    method: 'algorithm',
    angleA: 'Face',
    dateA: '2026-09-15 09:10',
    locationA: 'Ariana Centre (1km grid)',
    imageA: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80',
    angleB: 'Face',
    dateB: '2026-09-23 07:45',
    locationB: 'Ariana Centre (1km grid)',
    imageB: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&w=600&q=80',
    coatPattern: 'Fauve uni avec cicatrice sur l\'oreille gauche',
  },
];

export const PhotoReviewQueue: React.FC = () => {
  const [queue, setQueue] = useState<ProposedMatch[]>(SAMPLE_MATCHES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(18);
  const [rejectedCount, setRejectedCount] = useState(4);

  const currentMatch = queue[currentIndex];

  const handleDecision = (decision: 'confirm' | 'reject') => {
    if (decision === 'confirm') {
      setConfirmedCount((c) => c + 1);
    } else {
      setRejectedCount((r) => r + 1);
    }

    if (currentIndex < queue.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Completed current queue
      setQueue([]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">File de Validation Photo-Identification (Mark-Resight)</h2>
          <p className="text-sm text-slate-500">
            Comparaison côte à côte des paires candidates pour attribuer ou rejeter l'identité d'un individu unique.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" aria-hidden />{confirmedCount} Individus Confirmés
          </span>
          <span className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg inline-flex items-center gap-1.5">
            <X className="w-3.5 h-3.5" aria-hidden />{rejectedCount} Paires Rejetées
          </span>
        </div>
      </div>

      {!currentMatch ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
          <CircleCheckBig className="w-12 h-12 mx-auto text-teal-600" aria-hidden />
          <h3 className="text-lg font-bold text-slate-900">File de validation à jour !</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Toutes les paires de photos proposées ont été examinées. De nouvelles paires apparaîtront dès que de nouvelles observations avec photos seront synchronisées.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Metadata bar */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-teal-100 text-teal-800">
                {currentMatch.species === 'cat' ? 'Felis catus' : 'Canis lupus familiaris'}
              </span>
              <span className="text-xs text-slate-600">
                Méthode : <strong>{currentMatch.method === 'algorithm' ? 'Algorithme HotSpotter / AI' : 'Observateur'}</strong>
              </span>
              <span className="text-xs text-slate-600">
                Motif : <strong>{currentMatch.coatPattern}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Score de similarité :</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-teal-700 text-white">
                {(currentMatch.score * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Side-by-Side Photos */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 p-6 gap-6">
            {/* Photo A */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Observation A (Historique)</span>
                <span>{currentMatch.dateA}</span>
              </div>
              <div className="h-72 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-200">
                <img
                  src={currentMatch.imageA}
                  alt="Observation A"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Angle : <strong>{currentMatch.angleA}</strong></span>
                <span>Lieu : {currentMatch.locationA}</span>
              </div>
            </div>

            {/* Photo B */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Observation B (Nouvelle détection)</span>
                <span>{currentMatch.dateB}</span>
              </div>
              <div className="h-72 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-200">
                <img
                  src={currentMatch.imageB}
                  alt="Observation B"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Angle : <strong>{currentMatch.angleB}</strong></span>
                <span>Lieu : {currentMatch.locationB}</span>
              </div>
            </div>
          </div>

          {/* Decision Buttons */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Paire {currentIndex + 1} sur {queue.length}
            </span>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDecision('reject')}
                className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-sm font-semibold rounded-xl transition inline-flex items-center gap-2"
              >
                <X className="w-4 h-4" aria-hidden />
                Rejeter (Individus Différents)
              </button>

              <button
                onClick={() => handleDecision('confirm')}
                className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-xl shadow-sm transition inline-flex items-center gap-2"
              >
                <Check className="w-4 h-4" aria-hidden />
                Confirmer le Match (Même Individu)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
