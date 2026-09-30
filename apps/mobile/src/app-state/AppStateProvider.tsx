/**
 * App-wide session state shared by every route: auth, consent, the signed-in
 * account, local sightings, captured photos and headline stats. Previously
 * this lived in App.tsx and was passed down as props; Expo Router routes read
 * it with useAppState().
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import i18n, { setAppLanguage } from '../i18n';
import { useToast } from '../ui/Toast';
import { quickSightingXp } from '../features/gamification/progress';
import { CURRENT_CONSENT_VERSION } from '../screens/ConsentScreen';
import type { SightingItem } from './types';
import type { UserAccount } from './types';
import { useSyncStore } from '../features/sync/syncStore';
import { useSurveyStore } from '../features/survey/surveyStore';
import { useGamificationStore } from '../features/gamification/gamificationStore';
import {
  supabase,
  SurveyBundlePayload,
  ensureUserConsentAccepted,
  pullMapObservations,
  type MapObservationRow,
} from '../services/supabase';
import { labelOwnSightings, mergeForMap } from './mergeSightings';
import { PREVIEW_ACCOUNT, PREVIEW_MODE, PREVIEW_SIGHTINGS, PREVIEW_STATS } from './previewData';
import { handleAuthUrl } from '../services/deepLinkAuth';
import { startOutboxWorker } from '../services/sync/outboxWorker';
import {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
} from '../services/location/backgroundLocation';
import { generateUUID } from '../utils/uuid';
import { hapticModalClose } from '../utils/haptics';

export interface SurveyStats {
  sessionsCompleted: number;
  kmWalked: number;
  animalsRecorded: number;
}

const EMPTY_STATS: SurveyStats = { sessionsCompleted: 0, kmWalked: 0, animalsRecorded: 0 };

interface AppState {
  isAuthChecking: boolean;
  consentAccepted: boolean;
  userAccount: UserAccount | null;
  /** This phone's sightings, labelled with their server code once synced */
  sightings: SightingItem[];
  /** Everyone's observations plus this phone's unsynced ones */
  mapSightings: SightingItem[];
  refreshMapObservations: () => Promise<void>;
  capturedPhotos: any[];
  stats: SurveyStats;
  selectedRouteForSurvey: string | null;
  setCapturedPhotos: (photos: any[]) => void;
  setSelectedRouteForSurvey: (routeId: string | null) => void;
  closeModal: () => void;
  acceptConsent: (version?: string) => Promise<void>;
  changeLanguage: (lng: 'ar' | 'fr' | 'en') => void;
  saveAccount: (account: UserAccount) => Promise<void>;
  signOut: () => Promise<void>;
  saveOpportunistic: (observation: any) => void;
  logAnimalInSurvey: (animal: any) => void;
  updateSighting: (updated: SightingItem) => void;
  deleteSighting: (id: string) => void;
  finishStructuredSurvey: (sessionData: any) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside <AppStateProvider>');
  return ctx;
}

async function persistStatsForCurrentUser(stats: SurveyStats) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user?.id) {
    await AsyncStorage.setItem(`hawem_stats_${session.user.id}`, JSON.stringify(stats));
  }
}

function accountFromSession(
  user: { id: string; email?: string; created_at?: string; user_metadata?: any },
  savedLocal: Partial<UserAccount> | null
): UserAccount {
  const userMeta = user.user_metadata || {};
  return {
    name:
      savedLocal?.name ||
      userMeta.full_name ||
      userMeta.name ||
      user.email?.split('@')[0] ||
      'Surveyor',
    email: user.email || '',
    organization: savedLocal?.organization || userMeta.organization || '',
    role: (savedLocal?.role as any) || userMeta.role || 'surveyor',
    governorate: savedLocal?.governorate || userMeta.governorate || '',
    surveyorId:
      savedLocal?.surveyorId || userMeta.surveyor_id || `OBS-${user.id.slice(0, 6).toUpperCase()}`,
    avatarUri: savedLocal?.avatarUri || userMeta.avatar_url || undefined,
    createdAt: savedLocal?.createdAt || user.created_at || new Date().toISOString(),
  };
}

async function readSavedAccount(userId: string): Promise<Partial<UserAccount> | null> {
  try {
    const raw =
      (await AsyncStorage.getItem(`hawem_account_${userId}`)) ||
      (await AsyncStorage.getItem('hawem_account_v1'));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [sightings, setSightings] = useState<SightingItem[]>([]);
  const [capturedPhotos, setCapturedPhotos] = useState<any[]>([]);
  const [stats, setStats] = useState<SurveyStats>(EMPTY_STATS);
  const [selectedRouteForSurvey, setSelectedRouteForSurvey] = useState<string | null>(null);
  const [remoteObservations, setRemoteObservations] = useState<MapObservationRow[]>([]);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);

  const refreshMapObservations = useCallback(async () => {
    if (PREVIEW_MODE) return;
    const rows = await pullMapObservations();
    if (rows) setRemoteObservations(rows);
  }, []);

  // Everyone's observations: on sign-in and after each sync
  useEffect(() => {
    if (userAccount) refreshMapObservations();
    else setRemoteObservations([]);
  }, [userAccount?.email, lastSyncedAt, refreshMapObservations]);

  // Preview sample data already carries its codes; there is no server to label from
  const ownSightings = useMemo(
    () => (PREVIEW_MODE ? sightings : labelOwnSightings(sightings, remoteObservations)),
    [sightings, remoteObservations]
  );
  const mapSightings = useMemo(
    () => (PREVIEW_MODE ? sightings : mergeForMap(sightings, remoteObservations)),
    [sightings, remoteObservations]
  );

  const surveyStatus = useSurveyStore((s) => s.status);
  const isSurveyActive = surveyStatus === 'recording' || surveyStatus === 'acquiring_fix';

  // Background location tracking during active survey
  useEffect(() => {
    if (isSurveyActive) {
      startBackgroundLocationTracking().catch(() => {});
    } else {
      stopBackgroundLocationTracking().catch(() => {});
    }
  }, [isSurveyActive]);

  // Outbox worker and survey crash recovery on cold start
  useEffect(() => {
    const stopWorker = startOutboxWorker(() => useSyncStore.getState().wifiOnly);
    useSurveyStore
      .getState()
      .restoreDraft()
      .catch(() => {});
    return () => {
      stopWorker();
    };
  }, []);

  // Load persisted account, Supabase session, sightings and consent on mount
  useEffect(() => {
    let isMounted = true;

    const loadUserData = async (userId: string) => {
      const storedStats = await AsyncStorage.getItem(`hawem_stats_${userId}`);
      setStats(storedStats ? JSON.parse(storedStats) : EMPTY_STATS);
      useGamificationStore.getState().loadGamification(userId);
      const storedSightings = await AsyncStorage.getItem(`hawem_sightings_${userId}`);
      if (storedSightings) {
        const parsed = JSON.parse(storedSightings);
        if (Array.isArray(parsed)) setSightings(parsed);
      } else {
        setSightings([]);
      }
    };

    const clearUserData = () => {
      setUserAccount(null);
      setSightings([]);
      setStats(EMPTY_STATS);
      useGamificationStore.getState().resetGamification();
    };

    const loadLocalData = async () => {
      if (PREVIEW_MODE) {
        // Design review in a browser: signed in with sample data, no network
        setUserAccount(PREVIEW_ACCOUNT);
        setSightings(PREVIEW_SIGHTINGS);
        setStats(PREVIEW_STATS);
        setConsentAccepted(true);
        setIsAuthChecking(false);
        return;
      }
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          const account = accountFromSession(session.user, await readSavedAccount(session.user.id));
          if (isMounted) {
            setUserAccount(account);
            await loadUserData(session.user.id);
          }
        } else {
          if (isMounted) clearUserData();
          await AsyncStorage.removeItem('hawem_account_v1');
        }

        // Consent defaults to unaccepted if absent or outdated
        const storedConsent = await AsyncStorage.getItem('hawem_consent_version');
        if (storedConsent === CURRENT_CONSENT_VERSION) {
          if (isMounted) setConsentAccepted(true);
          if (session?.user?.id) ensureUserConsentAccepted().catch(() => {});
        } else if (isMounted) {
          setConsentAccepted(false);
        }

        await useSyncStore.getState().loadOutbox();
      } catch (err) {
        console.warn('Error reading from AsyncStorage or Supabase:', err);
      } finally {
        if (isMounted) setIsAuthChecking(false);
      }
    };
    loadLocalData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        ensureUserConsentAccepted().catch(() => {});
        const account = accountFromSession(session.user, await readSavedAccount(session.user.id));
        if (isMounted) {
          setUserAccount(account);
          try {
            await loadUserData(session.user.id);
          } catch {
            setStats(EMPTY_STATS);
            setSightings([]);
          }
        }
        AsyncStorage.setItem(`hawem_account_${session.user.id}`, JSON.stringify(account)).catch(
          () => {}
        );
        AsyncStorage.setItem('hawem_account_v1', JSON.stringify(account)).catch(() => {});
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) clearUserData();
        AsyncStorage.removeItem('hawem_account_v1').catch(() => {});
      }
    });

    // Email confirmation / OAuth redirects arrive as hawem:// auth links
    Linking.getInitialURL().then((url) => {
      if (url && isMounted) handleAuthUrl(url);
    });
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      if (url && isMounted) handleAuthUrl(url);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  const closeModal = () => {
    hapticModalClose();
    if (router.canGoBack()) router.back();
  };

  const acceptConsent = async (version: string = CURRENT_CONSENT_VERSION) => {
    try {
      await AsyncStorage.setItem('hawem_consent_version', version);
      await AsyncStorage.setItem('hawem_consent_accepted_at', new Date().toISOString());
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase
          .from('users')
          .update({ consent_version: 1, consent_accepted_at: new Date().toISOString() })
          .eq('id', session.user.id);
      }
    } catch (err) {
      console.warn('Failed to save consent status:', err);
    }
    setConsentAccepted(true);
  };

  const saveAccount = async (input: UserAccount) => {
    let account = input;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      // A new profile gets an observer ID derived from the auth user, once
      if (!account.surveyorId) {
        account = {
          ...account,
          surveyorId: session?.user?.id
            ? `OBS-${session.user.id.slice(0, 6).toUpperCase()}`
            : `OBS-${Math.floor(100000 + Math.random() * 900000)}`,
        };
      }
      setUserAccount(account);
      await AsyncStorage.setItem('hawem_account_v1', JSON.stringify(account));
      if (session?.user?.id) {
        await AsyncStorage.setItem(`hawem_account_${session.user.id}`, JSON.stringify(account));
        supabase.auth
          .updateUser({
            data: {
              full_name: account.name,
              name: account.name,
              organization: account.organization,
              role: account.role,
              governorate: account.governorate,
              surveyor_id: account.surveyorId,
              avatar_url: account.avatarUri,
            },
          })
          .catch(() => {});

        const storedStats = await AsyncStorage.getItem(`hawem_stats_${session.user.id}`);
        setStats(storedStats ? JSON.parse(storedStats) : EMPTY_STATS);
        useGamificationStore.getState().loadGamification(session.user.id);
      }
    } catch (err) {
      setUserAccount(account);
      console.warn('Error saving account:', err);
    }
  };

  const signOut = async () => {
    setUserAccount(null);
    setSightings([]);
    setStats(EMPTY_STATS);
    useGamificationStore.getState().resetGamification();
    try {
      await supabase.auth.signOut();
      await AsyncStorage.removeItem('hawem_account_v1');
    } catch (err) {
      console.warn('Error removing account:', err);
    }
  };

  const persistSightings = async (newList: SightingItem[]) => {
    setSightings(newList);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const storageKey = session?.user?.id
        ? `hawem_sightings_${session.user.id}`
        : 'hawem_sightings_guest';
      await AsyncStorage.setItem(storageKey, JSON.stringify(newList));
    } catch (err) {
      console.warn('Error saving sightings:', err);
    }
  };

  const bumpStats = (update: (prev: SurveyStats) => SurveyStats) => {
    setStats((prev) => {
      const next = update(prev);
      persistStatsForCurrentUser(next).catch(() => {});
      return next;
    });
  };

  const saveOpportunistic = (observation: any) => {
    // Never substitute a placeholder position for a missing GPS fix
    if (!Number.isFinite(observation.latitude) || !Number.isFinite(observation.longitude)) {
      console.warn('Opportunistic sighting without coordinates was not saved');
      return;
    }
    // One photo per observation: the quick sighting passes it directly
    const photosToSave: any[] = observation.photos ?? capturedPhotos;
    const newItem: SightingItem = {
      id: generateUUID(),
      species: observation.species,
      identifier: observation.identifier || undefined,
      observer_name: userAccount?.name || 'You',
      group_size: observation.group_size || 1,
      latitude: observation.latitude,
      longitude: observation.longitude,
      observed_at: observation.observed_at || new Date().toISOString(),
      body_condition_score: observation.body_condition_score,
      protocol: 'incidental',
      notes: observation.notes,
      photos: photosToSave.map((p) => p.uri),
    };

    persistSightings([newItem, ...sightings]);
    setStats((prev) => ({
      ...prev,
      animalsRecorded: prev.animalsRecorded + (observation.group_size || 1),
    }));

    // Enqueue incidental survey bundle into the transactional outbox
    const point = {
      latitude: newItem.latitude,
      longitude: newItem.longitude,
      type: 'Point' as const,
      coordinates: [newItem.longitude, newItem.latitude] as [number, number],
    };
    const bundle: SurveyBundlePayload = {
      session: {
        id: generateUUID(),
        observer_id: userAccount?.surveyorId,
        protocol: 'incidental',
        start_time: newItem.observed_at,
        end_time: newItem.observed_at,
        complete_session: false,
        number_of_observers: 1,
        notes: 'Incidental observation via Quick Log',
      },
      track: null,
      observations: [
        {
          id: newItem.id,
          observed_at: newItem.observed_at,
          species: newItem.species,
          group_size: newItem.group_size,
          body_condition_score: newItem.body_condition_score,
          location: point,
          observer_location: point,
          notes: newItem.notes,
          // Details from the sighting form; the server defaults any left out
          // to 'unknown' rather than guessing
          sex: observation.sex,
          age_class: observation.age_class,
          reproductive_status: observation.reproductive_status,
          visible_health_issues: observation.visible_health_issues,
          ear_tip_or_notch: observation.ear_tip_or_notch,
          collar_or_tag: observation.collar_or_tag,
          behaviour: observation.behaviour,
          habitat_type: observation.habitat_type,
          gps_accuracy_m: observation.gps_accuracy_m,
        },
      ],
      photos: photosToSave.map((p) => ({
        id: generateUUID(),
        observation_id: newItem.id,
        storage_path: p.uri,
        angle: p.angle || 'other',
        taken_at: p.timestamp || new Date().toISOString(),
      })),
    };

    useSyncStore.getState().enqueueSurvey(bundle);
    useGamificationStore.getState().awardXp(10, 'Incidental field observation logged');
    useToast.getState().show({
      title: i18n.t('ui_quick.saved'),
      detail: i18n.t('ui_quick.saved_detail'),
      xp: quickSightingXp({ animals: newItem.group_size || 1, hasPhoto: photosToSave.length > 0 }),
      icon: 'paw',
    });

    setCapturedPhotos([]);
    router.dismissAll();
    router.navigate('/activity');
  };

  const logAnimalInSurvey = (animal: any) => {
    if (!Number.isFinite(animal.latitude) || !Number.isFinite(animal.longitude)) {
      console.warn('Survey sighting without coordinates was not added to the sightings list');
      return;
    }
    const newItem: SightingItem = {
      id: animal.id || generateUUID(),
      species: animal.species,
      identifier: animal.identifier || undefined,
      observer_name: userAccount?.name || 'You',
      group_size: animal.group_size || 1,
      distance_from_path_m: animal.distance_from_path_m,
      latitude: animal.latitude,
      longitude: animal.longitude,
      observed_at: animal.observed_at || new Date().toISOString(),
      body_condition_score: 3,
      protocol: animal.protocol || 'transect',
      notes: animal.notes,
      photos:
        animal.photoUris && animal.photoUris.length > 0
          ? animal.photoUris
          : animal.photoUri
            ? [animal.photoUri]
            : [],
    };

    persistSightings([newItem, ...sightings]);
    bumpStats((prev) => ({
      ...prev,
      animalsRecorded: prev.animalsRecorded + (animal.group_size || 1),
    }));
  };

  const updateSighting = (updated: SightingItem) => {
    persistSightings(sightings.map((item) => (item.id === updated.id ? updated : item)));
  };

  const deleteSighting = (id: string) => {
    persistSightings(sightings.filter((item) => item.id !== id));
    bumpStats((prev) => ({ ...prev, animalsRecorded: Math.max(0, prev.animalsRecorded - 1) }));
  };

  const finishStructuredSurvey = (sessionData: any) => {
    bumpStats((prev) => ({
      ...prev,
      sessionsCompleted: prev.sessionsCompleted + 1,
      kmWalked: Number((prev.kmWalked + (sessionData.distance_km || 0)).toFixed(2)),
    }));
    router.navigate('/activity');
  };

  const value: AppState = {
    isAuthChecking,
    consentAccepted,
    userAccount,
    sightings: ownSightings,
    mapSightings,
    refreshMapObservations,
    capturedPhotos,
    stats,
    selectedRouteForSurvey,
    setCapturedPhotos,
    setSelectedRouteForSurvey,
    closeModal,
    acceptConsent,
    changeLanguage: (lng) => setAppLanguage(lng),
    saveAccount,
    signOut,
    saveOpportunistic,
    logAnimalInSurvey,
    updateSighting,
    deleteSighting,
    finishStructuredSurvey,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
