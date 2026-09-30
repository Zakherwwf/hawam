import React, { useState, useEffect } from 'react';
import { getLiveRoutes, createRoute } from '../services/supabase';

interface FixedRoute {
  id: string;
  name: string;
  governorate: string;
  delegation: string;
  lengthKm: number;
  habitatNotes: string;
  surveyCount: number;
}

// Routes come from the database; nothing is pre-filled
const INITIAL_ROUTES: FixedRoute[] = [];

export const RouteManager: React.FC = () => {
  const [routes, setRoutes] = useState<FixedRoute[]>(INITIAL_ROUTES);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [newGov, setNewGov] = useState('');
  const [newDelegation, setNewDelegation] = useState('');
  const [newLength, setNewLength] = useState('2.0');
  const [newHabitat, setNewHabitat] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadRoutes() {
      try {
        const live = await getLiveRoutes();
        if (live.length > 0) {
          const mapped: FixedRoute[] = live.map((r: any) => ({
            id: r.id,
            name: r.name,
            governorate: r.governorate || '',
            delegation: r.delegation || 'Centre',
            lengthKm: r.length_km || 1.8,
            habitatNotes: r.habitat_notes || 'Transect urbain',
            surveyCount: 0,
          }));
          setRoutes([...mapped, ...INITIAL_ROUTES]);
        }
      } catch (err) {
        console.warn('Error loading live routes:', err);
      }
    }
    loadRoutes();
  }, []);

  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRouteName) return;

    setIsSubmitting(true);
    const lengthVal = parseFloat(newLength) || 1.5;

    try {
      await createRoute({
        name: newRouteName,
        length_km: lengthVal,
        governorate: newGov,
        delegation: newDelegation || 'Centre',
        habitat_notes: newHabitat || 'Urban street transect',
        geometry: {
          type: 'LineString',
          coordinates: [
            [10.1695, 36.8028],
            [10.1712, 36.8042],
          ],
        },
      });
    } catch (err) {
      console.warn('Failed creating route in DB, saving locally:', err);
    }

    const newR: FixedRoute = {
      id: `route-${Date.now()}`,
      name: newRouteName,
      governorate: newGov,
      delegation: newDelegation || 'Centre',
      lengthKm: lengthVal,
      habitatNotes: newHabitat || 'Urban street transect',
      surveyCount: 0,
    };

    setRoutes([newR, ...routes]);
    setShowAddModal(false);
    setNewRouteName('');
    setNewHabitat('');
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Itinéraires Fixes de Transect (Fixed Routes)
          </h2>
          <p className="text-sm text-slate-500">
            Tracés standardisés créés par les chercheurs pour permettre la répétition temporelle
            (Occupancy & N-Mixture models).
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg shadow-sm transition"
        >
          + Créer un nouvel itinéraire
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {routes.map((route) => (
          <div
            key={route.id}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-teal-300 transition space-y-3"
          >
            <div className="flex items-start justify-between">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
                {route.governorate} • {route.delegation}
              </span>
              <span className="text-xs text-slate-400 font-mono">{route.id}</span>
            </div>

            <h3 className="text-base font-bold text-slate-800">{route.name}</h3>

            <p className="text-xs text-slate-600 line-clamp-2">{route.habitatNotes}</p>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Longueur : <strong>{route.lengthKm} km</strong>
              </span>
              <span>
                Répétitions : <strong>{route.surveyCount} enquêtes</strong>
              </span>
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Définir un nouvel itinéraire de transect
            </h3>
            <form onSubmit={handleAddRoute} className="space-y-4">
              <div>
                <label
                  htmlFor="route-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nom de l'itinéraire
                </label>
                <input
                  id="route-name"
                  name="routeName"
                  autoComplete="off"
                  type="text"
                  required
                  placeholder="ex. Marché central - Port…"
                  value={newRouteName}
                  onChange={(e) => setNewRouteName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:border-teal-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="route-region"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Région
                  </label>
                  <input
                    id="route-region"
                    name="region"
                    type="text"
                    autoComplete="off"
                    placeholder="ex. ville ou district…"
                    value={newGov}
                    onChange={(e) => setNewGov(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:border-teal-600 outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="route-delegation"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Délégation
                  </label>
                  <input
                    id="route-delegation"
                    name="delegation"
                    autoComplete="off"
                    type="text"
                    placeholder="ex. Centre-ville…"
                    value={newDelegation}
                    onChange={(e) => setNewDelegation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:border-teal-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="route-length"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Longueur estimée (km)
                </label>
                <input
                  id="route-length"
                  name="lengthKm"
                  inputMode="decimal"
                  type="number"
                  step="0.1"
                  value={newLength}
                  onChange={(e) => setNewLength(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:border-teal-600 outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="route-habitat"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Notes sur l'habitat & caractéristiques
                </label>
                <textarea
                  id="route-habitat"
                  name="habitatNotes"
                  rows={3}
                  placeholder="Zones de déchets, points de nourrissage, types de bâtis…"
                  value={newHabitat}
                  onChange={(e) => setNewHabitat(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:border-teal-600 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-sm"
                >
                  {isSubmitting ? 'Enregistrement…' : "Enregistrer l'itinéraire"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
