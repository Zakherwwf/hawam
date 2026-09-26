import './src/polyfills';
import React, { useState, useEffect } from 'react';
import { registerRootComponent } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity, Platform, ActivityIndicator, Linking, Image, Alert, Modal } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import './src/i18n';
import { setAppLanguage } from './src/i18n';
import { IOSColors, IOSTypography } from './src/theme/ios';
import { LinearGradient } from 'expo-linear-gradient';
import { IOSIcon } from './src/components/ios';
import { Icon } from './src/components/design-system/Icon';
import { RecordActionSheet } from './src/components/survey/RecordActionSheet';

// Screens
import { AuthGateScreen } from './src/screens/AuthGateScreen';
import { ConsentScreen, CURRENT_CONSENT_VERSION } from './src/screens/ConsentScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MapOverviewScreen } from './src/screens/MapOverviewScreen';
import { StructuredSurveyScreen, SurveyDetection } from './src/screens/StructuredSurveyScreen';
import { SightingsScreen, SightingItem } from './src/screens/SightingsScreen';
import { AccountScreen, UserAccount } from './src/screens/AccountScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { OpportunisticScreen } from './src/screens/OpportunisticScreen';
import { GuidedPhotoScreen } from './src/screens/GuidedPhotoScreen';
import { TrainingScreen } from './src/screens/TrainingScreen';

import { AnimalsScreen } from './src/screens/AnimalsScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { useSyncStore } from './src/features/sync/syncStore';
import { useSurveyStore } from './src/features/survey/surveyStore';
import { useGamificationStore } from './src/features/gamification/gamificationStore';
import { useThemeStore } from './src/features/theme/themeStore';
import { supabase, SurveyBundlePayload, ensureUserConsentAccepted } from './src/services/supabase';
import { handleAuthUrl } from './src/services/deepLinkAuth';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/services/queries/useSurveyQueries';
import { startOutboxWorker } from './src/services/sync/outboxWorker';
import { startBackgroundLocationTracking, stopBackgroundLocationTracking } from './src/services/location/backgroundLocation';
import { generateUUID } from './src/utils/uuid';
import {
  hapticTabSwitch,
  hapticModalClose,
  hapticQuickLog,
  hapticButtonPress,
} from './src/utils/haptics';

export type TabType = 'explore' | 'animals' | 'activity' | 'me';
export type ModalType = 'none' | 'opportunistic' | 'guided_photo' | 'training' | 'settings';


function AppContent() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { themeMode, colors } = useThemeStore();
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [consentAccepted, setConsentAccepted] = useState<boolean>(false);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('explore');
  const [activeModal, setActiveModal] = useState<ModalType>('none');
  const [isRecordSheetVisible, setIsRecordSheetVisible] = useState<boolean>(false);
  const [meSubView, setMeSubView] = useState<'profile' | 'leaderboard'>('profile');
  const [primaryViewMode, setPrimaryViewMode] = useState<'map' | 'dashboard'>('map');
  const [selectedRouteForSurvey, setSelectedRouteForSurvey] = useState<string | null>(null);

  const pendingSyncCount = useSyncStore((s) => s.pendingCount);
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
    useSurveyStore.getState().restoreDraft().catch(() => {});
    return () => {
      stopWorker();
    };
  }, []);

  const handleTabPress = (tab: TabType) => {
    if (activeTab !== tab) {
      hapticTabSwitch();
      setActiveTab(tab);
    } else if (tab === 'explore' && primaryViewMode === 'dashboard') {
      hapticTabSwitch();
      setPrimaryViewMode('map');
    }
  };

  const handleCloseModal = () => {
    hapticModalClose();
    setActiveModal('none');
  };

  // Master Sightings State (CRUD) - Starts clean for new surveyors
  const [sightings, setSightings] = useState<SightingItem[]>([]);
  const [capturedPhotos, setCapturedPhotos] = useState<any[]>([]);

  // Mobile App Research Stats - Default to 0 for new surveyors
  const [stats, setStats] = useState({
    sessionsCompleted: 0,
    kmWalked: 0,
    animalsRecorded: 0,
  });

  // Load persisted user account, Supabase cloud session, and sightings on mount
  useEffect(() => {
    let isMounted = true;
    const loadLocalData = async () => {
      try {
        // Inspect live Supabase cloud session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const userMeta = session.user.user_metadata || {};
          let savedLocal: Partial<UserAccount> | null = null;
          try {
            const raw = (await AsyncStorage.getItem(`hawem_account_${session.user.id}`)) || (await AsyncStorage.getItem('hawem_account_v1'));
            if (raw) savedLocal = JSON.parse(raw);
          } catch {}

          const effectiveId =
            savedLocal?.surveyorId ||
            userMeta.surveyor_id ||
            `TUN-OBS-${session.user.id.slice(0, 6).toUpperCase()}`;

          const effectiveAvatar =
            savedLocal?.avatarUri ||
            userMeta.avatar_url ||
            undefined;

          const cloudAccount: UserAccount = {
            name: savedLocal?.name || userMeta.full_name || userMeta.name || session.user.email?.split('@')[0] || 'Surveyor',
            email: session.user.email || '',
            organization: savedLocal?.organization || userMeta.organization || 'Tunisia Fauna Observatory',
            role: (savedLocal?.role as any) || userMeta.role || 'surveyor',
            governorate: savedLocal?.governorate || userMeta.governorate || 'Tunis',
            surveyorId: effectiveId,
            avatarUri: effectiveAvatar,
            createdAt: savedLocal?.createdAt || session.user.created_at || new Date().toISOString(),
          };
          if (isMounted) {
            setUserAccount(cloudAccount);
            // Load user-specific survey stats
            const storedStats = await AsyncStorage.getItem(`hawem_stats_${session.user.id}`);
            if (storedStats) {
              setStats(JSON.parse(storedStats));
            } else {
              setStats({ sessionsCompleted: 0, kmWalked: 0, animalsRecorded: 0 });
            }
            // Load user-specific gamification (XP, level, quests)
            useGamificationStore.getState().loadGamification(session.user.id);

            // Load user-specific sightings (scoped per account so new accounts start clean)
            const storedSightings = await AsyncStorage.getItem(`hawem_sightings_${session.user.id}`);
            if (storedSightings) {
              const parsed = JSON.parse(storedSightings);
              if (Array.isArray(parsed)) {
                setSightings(parsed);
              }
            } else {
              setSightings([]);
            }
          }
        } else {
          // No active Supabase cloud session: User is NOT connected!
          if (isMounted) {
            setUserAccount(null);
            setSightings([]);
            setStats({ sessionsCompleted: 0, kmWalked: 0, animalsRecorded: 0 });
            useGamificationStore.getState().resetGamification();
          }
          await AsyncStorage.removeItem('hawem_account_v1');
        }

        // Check stored consent version (defaults to unaccepted if absent or outdated)
        const storedConsent = await AsyncStorage.getItem('hawem_consent_version');
        if (storedConsent === CURRENT_CONSENT_VERSION || storedConsent === 'v1.0') {
          if (isMounted) setConsentAccepted(true);
          if (session?.user?.id) {
            ensureUserConsentAccepted().catch(() => {});
          }
        } else {
          if (isMounted) setConsentAccepted(false);
        }

        // Initialize persistent transactional outbox queue
        await useSyncStore.getState().loadOutbox();
      } catch (err) {
        console.warn('Error reading from AsyncStorage or Supabase:', err);
      } finally {
        if (isMounted) setIsAuthChecking(false);
      }
    };
    loadLocalData();

    // Listen to real-time sign-in / sign-out events from Supabase Cloud
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        ensureUserConsentAccepted().catch(() => {});
        const userMeta = session.user.user_metadata || {};
        let savedLocal: Partial<UserAccount> | null = null;
        try {
          const raw = (await AsyncStorage.getItem(`hawem_account_${session.user.id}`)) || (await AsyncStorage.getItem('hawem_account_v1'));
          if (raw) savedLocal = JSON.parse(raw);
        } catch {}

        const cloudAccount: UserAccount = {
          name: savedLocal?.name || userMeta.full_name || userMeta.name || session.user.email?.split('@')[0] || 'Surveyor',
          email: session.user.email || '',
          organization: savedLocal?.organization || userMeta.organization || 'Tunisia Fauna Observatory',
          role: (savedLocal?.role as any) || userMeta.role || 'surveyor',
          governorate: savedLocal?.governorate || userMeta.governorate || 'Tunis',
          surveyorId: savedLocal?.surveyorId || userMeta.surveyor_id || `TUN-OBS-${session.user.id.slice(0, 6).toUpperCase()}`,
          avatarUri: savedLocal?.avatarUri || userMeta.avatar_url || undefined,
          createdAt: savedLocal?.createdAt || session.user.created_at || new Date().toISOString(),
        };
        if (isMounted) {
          setUserAccount(cloudAccount);
          // Load user-specific stats
          try {
            const storedStats = await AsyncStorage.getItem(`hawem_stats_${session.user.id}`);
            if (storedStats) {
              setStats(JSON.parse(storedStats));
            } else {
              setStats({ sessionsCompleted: 0, kmWalked: 0, animalsRecorded: 0 });
            }
            useGamificationStore.getState().loadGamification(session.user.id);
            const storedSightings = await AsyncStorage.getItem(`hawem_sightings_${session.user.id}`);
            if (storedSightings) {
              const parsed = JSON.parse(storedSightings);
              if (Array.isArray(parsed)) setSightings(parsed);
            } else {
              setSightings([]);
            }
          } catch (e) {
            setStats({ sessionsCompleted: 0, kmWalked: 0, animalsRecorded: 0 });
            setSightings([]);
          }
        }
        AsyncStorage.setItem(`hawem_account_${session.user.id}`, JSON.stringify(cloudAccount)).catch(() => {});
        AsyncStorage.setItem('hawem_account_v1', JSON.stringify(cloudAccount)).catch(() => {});
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setUserAccount(null);
          setSightings([]);
          setStats({ sessionsCompleted: 0, kmWalked: 0, animalsRecorded: 0 });
          useGamificationStore.getState().resetGamification();
        }
        AsyncStorage.removeItem('hawem_account_v1').catch(() => {});
      }
    });

    // Handle incoming deep links (from email confirmation or OAuth redirect)
    Linking.getInitialURL().then((url) => {
      if (url && isMounted) {
        handleAuthUrl(url);
      }
    });

    const linkSub = Linking.addEventListener('url', ({ url }) => {
      if (url && isMounted) {
        handleAuthUrl(url);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  const handleAcceptConsent = async (version: string = CURRENT_CONSENT_VERSION) => {
    try {
      await AsyncStorage.setItem('hawem_consent_version', version);
      await AsyncStorage.setItem('hawem_consent_accepted_at', new Date().toISOString());
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase
          .from('users')
          .update({
            consent_version: 1,
            consent_accepted_at: new Date().toISOString(),
          })
          .eq('id', session.user.id);
      }
    } catch (err) {
      console.warn('Failed to save consent status:', err);
    }
    setConsentAccepted(true);
  };

  const handleLanguageChange = (lng: 'ar' | 'fr' | 'en') => {
    setAppLanguage(lng);
  };

  const handleSaveAccount = async (account: UserAccount) => {
    setUserAccount(account);
    try {
      await AsyncStorage.setItem('hawem_account_v1', JSON.stringify(account));
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await AsyncStorage.setItem(`hawem_account_${session.user.id}`, JSON.stringify(account));
        // Update user metadata in Supabase Cloud
        supabase.auth.updateUser({
          data: {
            full_name: account.name,
            name: account.name,
            organization: account.organization,
            role: account.role,
            governorate: account.governorate,
            surveyor_id: account.surveyorId,
            avatar_url: account.avatarUri,
          },
        }).catch(() => {});

        const storedStats = await AsyncStorage.getItem(`hawem_stats_${session.user.id}`);
        if (storedStats) {
          setStats(JSON.parse(storedStats));
        } else {
          setStats({ sessionsCompleted: 0, kmWalked: 0, animalsRecorded: 0 });
        }
        useGamificationStore.getState().loadGamification(session.user.id);
      }
    } catch (err) {
      console.warn('Error saving account:', err);
    }
  };

  const handleSignOut = async () => {
    setUserAccount(null);
    setSightings([]);
    setStats({ sessionsCompleted: 0, kmWalked: 0, animalsRecorded: 0 });
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
      const { data: { session } } = await supabase.auth.getSession();
      const storageKey = session?.user?.id ? `hawem_sightings_${session.user.id}` : 'hawem_sightings_guest';
      await AsyncStorage.setItem(storageKey, JSON.stringify(newList));
    } catch (err) {
      console.warn('Error saving sightings:', err);
    }
  };

  // Add sighting from Opportunistic form
  const handleSaveOpportunistic = (observation: any) => {
    const obsId = generateUUID();
    const newItem: SightingItem = {
      id: obsId,
      species: observation.species,
      identifier: observation.identifier || undefined,
      observer_name: userAccount?.name || 'You',
      group_size: observation.group_size || 1,
      latitude: observation.latitude || 36.8065,
      longitude: observation.longitude || 10.1815,
      observed_at: observation.observed_at || new Date().toISOString(),
      body_condition_score: observation.body_condition_score,
      protocol: 'incidental',
      notes: observation.notes,
      photos: capturedPhotos.map((p) => p.uri),
    };

    const updated = [newItem, ...sightings];
    persistSightings(updated);
    setStats((prev) => ({
      ...prev,
      animalsRecorded: prev.animalsRecorded + (observation.group_size || 1),
    }));

    // Enqueue incidental survey bundle into transactional outbox for PostgreSQL sync
    const sessionId = generateUUID();
    const bundle: SurveyBundlePayload = {
      session: {
        id: sessionId,
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
          location: {
            latitude: newItem.latitude,
            longitude: newItem.longitude,
            type: 'Point',
            coordinates: [newItem.longitude, newItem.latitude],
          },
          observer_location: {
            latitude: newItem.latitude,
            longitude: newItem.longitude,
            type: 'Point',
            coordinates: [newItem.longitude, newItem.latitude],
          },
          notes: newItem.notes,
        },
      ],
      photos: capturedPhotos.map((p) => ({
        id: generateUUID(),
        observation_id: newItem.id,
        storage_path: p.uri,
        angle: p.angle || 'other',
        taken_at: p.timestamp || new Date().toISOString(),
      })),
    };

    useSyncStore.getState().enqueueSurvey(bundle);
    useGamificationStore.getState().awardXp(10, 'Incidental field observation logged');

    setActiveModal('none');
    setCapturedPhotos([]);
    setActiveTab('animals');
  };

  // Log sighting from Structured Survey session
  const handleLogAnimalInSurvey = (animal: any) => {
    const newItem: SightingItem = {
      id: animal.id || generateUUID(),
      species: animal.species,
      identifier: animal.identifier || undefined,
      observer_name: userAccount?.name || 'You',
      group_size: animal.group_size || 1,
      distance_from_path_m: animal.distance_from_path_m,
      latitude: animal.latitude || 36.8065,
      longitude: animal.longitude || 10.1815,
      observed_at: animal.observed_at || new Date().toISOString(),
      body_condition_score: 3,
      protocol: animal.protocol || 'transect',
      notes: animal.notes,
      photos: animal.photoUris && animal.photoUris.length > 0 ? animal.photoUris : (animal.photoUri ? [animal.photoUri] : []),
    };

    const updated = [newItem, ...sightings];
    persistSightings(updated);
    setStats((prev) => {
      const updatedStats = {
        ...prev,
        animalsRecorded: prev.animalsRecorded + (animal.group_size || 1),
      };
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.id) {
          AsyncStorage.setItem(`hawem_stats_${session.user.id}`, JSON.stringify(updatedStats)).catch(() => {});
        }
      });
      return updatedStats;
    });
  };

  // Update existing sighting (CRUD Update)
  const handleUpdateSighting = (updated: SightingItem) => {
    const updatedList = sightings.map((item) => (item.id === updated.id ? updated : item));
    persistSightings(updatedList);
  };

  // Delete sighting (CRUD Delete)
  const handleDeleteSighting = (id: string) => {
    const updatedList = sightings.filter((item) => item.id !== id);
    persistSightings(updatedList);
    setStats((prev) => {
      const updatedStats = {
        ...prev,
        animalsRecorded: Math.max(0, prev.animalsRecorded - 1),
      };
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.id) {
          AsyncStorage.setItem(`hawem_stats_${session.user.id}`, JSON.stringify(updatedStats)).catch(() => {});
        }
      });
      return updatedStats;
    });
  };

  const handleFinishStructuredSurvey = (sessionData: any) => {
    setStats((prev) => {
      const updatedStats = {
        ...prev,
        sessionsCompleted: prev.sessionsCompleted + 1,
        kmWalked: Number((prev.kmWalked + (sessionData.distance_km || 0)).toFixed(2)),
      };
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.id) {
          AsyncStorage.setItem(`hawem_stats_${session.user.id}`, JSON.stringify(updatedStats)).catch(() => {});
        }
      });
      return updatedStats;
    });
    setActiveTab('activity');
  };

  // Initial loading splash while verifying cloud session
  if (isAuthChecking) {
    return (
      <SafeAreaView style={[styles.safeContainer, styles.centeredLoading]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={IOSColors.systemTeal} />
      </SafeAreaView>
    );
  }

  // Mandatory Authentication Gate: User MUST be connected to an account before accessing the app or map
  if (!userAccount) {
    return (
      <SafeAreaView style={styles.modalRoot} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <AuthGateScreen
          onAuthenticated={(account) => {
            handleSaveAccount(account);
            setActiveTab('explore');
          }}
        />
      </SafeAreaView>
    );
  }

  // Render modal views
  if (!consentAccepted) {
    return (
      <SafeAreaView style={styles.modalRoot} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <ConsentScreen
          onAccept={handleAcceptConsent}
          onLanguageChange={handleLanguageChange}
        />
      </SafeAreaView>
    );
  }

  if (activeModal === 'opportunistic') {
    return (
      <SafeAreaView style={[styles.modalRoot, { backgroundColor: colors.screenBg }]} edges={['top', 'left', 'right']}>
        <StatusBar style={colors.statusBarStyle} />
        <OpportunisticScreen
          onBack={handleCloseModal}
          onOpenPhotoCapture={() => setActiveModal('guided_photo')}
          onSaveObservation={handleSaveOpportunistic}
          capturedPhotosCount={capturedPhotos.length}
          capturedPhotos={capturedPhotos}
          onClearPhotos={() => setCapturedPhotos([])}
        />
      </SafeAreaView>
    );
  }

  if (activeModal === 'guided_photo') {
    return (
      <SafeAreaView style={[styles.modalRoot, { backgroundColor: '#000000' }]} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />
        <GuidedPhotoScreen
          onBack={() => {
            hapticModalClose();
            setActiveModal('opportunistic');
          }}
          onFinishCapture={(photos) => {
            setCapturedPhotos(photos);
            setActiveModal('opportunistic');
          }}
        />
      </SafeAreaView>
    );
  }

  if (activeModal === 'training') {
    return (
      <SafeAreaView style={[styles.modalRoot, { backgroundColor: colors.screenBg }]} edges={['top', 'left', 'right']}>
        <StatusBar style={colors.statusBarStyle} />
        <TrainingScreen onBack={handleCloseModal} />
      </SafeAreaView>
    );
  }

  if (activeModal === 'settings') {
    return (
      <SafeAreaView style={[styles.modalRoot, { backgroundColor: colors.screenBg }]} edges={['top', 'left', 'right']}>
        <StatusBar style={colors.statusBarStyle} />
        <SettingsScreen
          onBack={handleCloseModal}
          onLanguageChange={handleLanguageChange}
          sightings={sightings}
          userAccount={userAccount}
        />
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.appRoot, { backgroundColor: colors.screenBg }]}>
      <LinearGradient
        colors={colors.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right']}>
        <StatusBar style={colors.statusBarStyle} />

      {/* Main Tab Content */}
      <View style={styles.screenContent}>
        {activeTab === 'explore' ? (
          primaryViewMode === 'dashboard' ? (
            <HomeScreen
              onStartSurvey={() => {
                setSelectedRouteForSurvey(null);
                useSurveyStore.getState().startSurvey('transect');
              }}
              onQuickSighting={() => {
                hapticQuickLog();
                setActiveModal('opportunistic');
              }}
              onOpenTraining={() => {
                hapticButtonPress();
                setActiveModal('training');
              }}
              onOpenSettings={() => {
                hapticButtonPress();
                setActiveModal('settings');
              }}
              onToggleMap={() => setPrimaryViewMode('map')}
              stats={stats}
              userAccount={userAccount}
            />
          ) : (
            <MapOverviewScreen
              sightings={sightings}
              onQuickSighting={() => {
                hapticQuickLog();
                setActiveModal('opportunistic');
              }}
              onOpenAccount={() => handleTabPress('me')}
              onToggleDashboard={() => setPrimaryViewMode('dashboard')}
              onStartSurvey={(routeId) => {
                setSelectedRouteForSurvey(routeId);
                useSurveyStore.getState().startSurvey('transect', routeId);
              }}
            />
          )
        ) : activeTab === 'animals' ? (
          <AnimalsScreen
            sightings={sightings}
            onAddNewSighting={() => {
              hapticQuickLog();
              setActiveModal('opportunistic');
            }}
            onUpdateSighting={handleUpdateSighting}
            onDeleteSighting={handleDeleteSighting}
          />
        ) : activeTab === 'activity' ? (
          <SightingsScreen
            sightings={sightings}
            onAddNew={() => {
              hapticQuickLog();
              setActiveModal('opportunistic');
            }}
            onUpdateSighting={handleUpdateSighting}
            onDeleteSighting={handleDeleteSighting}
          />
        ) : activeTab === 'me' ? (
          meSubView === 'leaderboard' ? (
            <ProgressScreen
              userAccount={userAccount}
              stats={stats}
            />
          ) : (
            <AccountScreen
              userAccount={userAccount}
              onSaveAccount={handleSaveAccount}
              onSignOut={handleSignOut}
              onOpenTraining={() => {
                hapticButtonPress();
                setActiveModal('training');
              }}
              onOpenSettings={() => {
                hapticButtonPress();
                setActiveModal('settings');
              }}
              sightings={sightings}
              stats={stats}
            />
          )
        ) : null}
      </View>

      {/* Paused Survey Banner (if survey is paused in background) */}
      {surveyStatus === 'paused' && (
        <View style={styles.pausedBannerContainer}>
          <TouchableOpacity
            style={styles.pausedBanner}
            onPress={() => useSurveyStore.getState().resumeSurvey()}
            activeOpacity={0.8}
          >
            <View style={styles.pausedIndicator} />
            <Text style={styles.pausedBannerText}>Survey Paused — Tap to Resume</Text>
            <Icon name="play" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Full-Screen Survey Modal (Tab Bar Unreachable While Active) */}
      {isSurveyActive && (
        <Modal
          visible={true}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => {
            Alert.alert(
              'Survey in Progress',
              'Do you want to pause your survey session?',
              [
                { text: 'Keep Surveying', style: 'cancel' },
                {
                  text: 'Pause Survey',
                  onPress: () => {
                    useSurveyStore.getState().pauseSurvey();
                  },
                },
              ]
            );
          }}
        >
          <SafeAreaView style={styles.modalRoot} edges={['top', 'left', 'right', 'bottom']}>
            <StructuredSurveyScreen
              onBack={() => {
                useSurveyStore.getState().pauseSurvey();
              }}
              onFinishSurvey={(summary) => {
                handleFinishStructuredSurvey(summary);
                setActiveTab('activity');
              }}
              onLogAnimal={handleLogAnimalInSurvey}
              loggedAnimalsCount={stats.animalsRecorded}
              initialRouteId={selectedRouteForSurvey}
            />
          </SafeAreaView>
        </Modal>
      )}

      {/* Record Action Sheet Modal */}
      <RecordActionSheet
        visible={isRecordSheetVisible}
        onClose={() => setIsRecordSheetVisible(false)}
        onSelectTransect={() => {
          setSelectedRouteForSurvey(null);
          useSurveyStore.getState().startSurvey('transect');
        }}
        onSelectStationary={() => {
          setSelectedRouteForSurvey(null);
          useSurveyStore.getState().startSurvey('stationary_point');
        }}
        onSelectQuickSighting={() => {
          hapticQuickLog();
          setActiveModal('opportunistic');
        }}
      />

      {/* Floating 4-Tab + 1-Record Navigation Bar */}
      {!isSurveyActive && (
        <View
          style={[
            styles.floatingTabBarContainer,
            { bottom: Math.max(insets.bottom + 8, 16) },
          ]}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.floatingTabBar,
              {
                backgroundColor: themeMode === 'night' ? 'rgba(15, 23, 42, 0.94)' : 'rgba(15, 23, 42, 0.95)',
                borderColor: themeMode === 'night' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.15)',
              },
            ]}
          >
            {/* Tab 1: Explore */}
            <TouchableOpacity
              style={[
                styles.tabPill,
                activeTab === 'explore' && styles.tabPillActive,
              ]}
              onPress={() => handleTabPress('explore')}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityLabel="Explore Map"
              accessibilityState={{ selected: activeTab === 'explore' }}
            >
              <Icon
                name="map"
                size={20}
                color={activeTab === 'explore' ? '#0F172A' : '#94A3B8'}
              />
            </TouchableOpacity>

            {/* Tab 2: Animals */}
            <TouchableOpacity
              style={[
                styles.tabPill,
                activeTab === 'animals' && styles.tabPillActive,
              ]}
              onPress={() => handleTabPress('animals')}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityLabel="Animals"
              accessibilityState={{ selected: activeTab === 'animals' }}
            >
              <Icon
                name="animals"
                size={20}
                color={activeTab === 'animals' ? '#0F172A' : '#94A3B8'}
              />
            </TouchableOpacity>

            {/* Center Quick Action: (+) Record */}
            <TouchableOpacity
              style={styles.recordActionPill}
              onPress={() => {
                hapticQuickLog();
                setIsRecordSheetVisible(true);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Record Survey or Sighting"
            >
              <LinearGradient
                colors={['#0284C7', '#0369A1']}
                style={styles.recordActionGradient}
              >
                <Icon name="record" size={24} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

            {/* Tab 3: Activity */}
            <TouchableOpacity
              style={[
                styles.tabPill,
                activeTab === 'activity' && styles.tabPillActive,
              ]}
              onPress={() => handleTabPress('activity')}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityLabel="Activity"
              accessibilityState={{ selected: activeTab === 'activity' }}
            >
              <Icon
                name="activity"
                size={20}
                color={activeTab === 'activity' ? '#0F172A' : '#94A3B8'}
              />
              {pendingSyncCount > 0 && (
                <View style={styles.syncBadge}>
                  <Text style={styles.syncBadgeText}>{pendingSyncCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Tab 4: Me */}
            <TouchableOpacity
              style={[
                styles.tabPill,
                activeTab === 'me' && styles.tabPillActive,
              ]}
              onPress={() => handleTabPress('me')}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityLabel="Profile and Progress"
              accessibilityState={{ selected: activeTab === 'me' }}
            >
              <Icon
                name="profile"
                size={20}
                color={activeTab === 'me' ? '#0F172A' : '#94A3B8'}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  </View>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#F7F6F2',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: '#F7F6F2',
  },
  safeContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centeredLoading: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenContent: {
    flex: 1,
  },
  floatingTabBarContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  floatingTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 36,
    paddingVertical: 6,
    paddingHorizontal: 10,
    width: '100%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  tabPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 4,
  },
  recordActionPill: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  recordActionGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  syncBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  pausedBannerContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9000,
  },
  pausedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  pausedIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
    marginRight: 10,
  },
  pausedBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 10,
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

registerRootComponent(App);
