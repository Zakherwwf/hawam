import './src/polyfills';
import React, { useState, useEffect } from 'react';
import { registerRootComponent } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity, Platform, ActivityIndicator, Linking, Image } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import './src/i18n';
import { setAppLanguage } from './src/i18n';
import { IOSColors, IOSTypography } from './src/theme/ios';
import { LinearGradient } from 'expo-linear-gradient';
import { IOSIcon } from './src/components/ios';

// Screens
import { AuthGateScreen } from './src/screens/AuthGateScreen';
import { ConsentScreen } from './src/screens/ConsentScreen';
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
import { useGamificationStore } from './src/features/gamification/gamificationStore';
import { useThemeStore } from './src/features/theme/themeStore';
import { supabase, SurveyBundlePayload } from './src/services/supabase';
import { handleAuthUrl } from './src/services/deepLinkAuth';
import {
  hapticTabSwitch,
  hapticModalClose,
  hapticQuickLog,
  hapticButtonPress,
} from './src/utils/haptics';

type TabType = 'map' | 'survey' | 'animals' | 'progress' | 'profile';
type ModalType = 'none' | 'opportunistic' | 'guided_photo' | 'training' | 'settings';

function AppContent() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { themeMode, colors } = useThemeStore();
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [consentAccepted, setConsentAccepted] = useState(true);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('map');
  const [activeModal, setActiveModal] = useState<ModalType>('none');
  const [primaryViewMode, setPrimaryViewMode] = useState<'map' | 'dashboard'>('map');
  const [selectedRouteForSurvey, setSelectedRouteForSurvey] = useState<string | null>(null);

  const handleTabPress = (tab: TabType) => {
    if (activeTab !== tab) {
      hapticTabSwitch();
      setActiveTab(tab);
    } else if (tab === 'map' && primaryViewMode === 'dashboard') {
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
          const cloudAccount: UserAccount = {
            name: userMeta.full_name || userMeta.name || session.user.email?.split('@')[0] || 'Surveyor',
            email: session.user.email || '',
            organization: userMeta.organization || 'Tunisia Fauna Observatory',
            role: userMeta.role || 'surveyor',
            governorate: userMeta.governorate || 'Tunis',
            surveyorId: `TUN-OBS-${session.user.id.slice(0, 6).toUpperCase()}`,
            createdAt: session.user.created_at || new Date().toISOString(),
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
          }
        } else {
          // No active Supabase cloud session: User is NOT connected!
          if (isMounted) {
            setUserAccount(null);
            setStats({ sessionsCompleted: 0, kmWalked: 0, animalsRecorded: 0 });
            useGamificationStore.getState().resetGamification();
          }
          await AsyncStorage.removeItem('hawem_account_v1');
        }

        const storedSightings = await AsyncStorage.getItem('hawem_sightings_v1');
        if (storedSightings && isMounted) {
          const parsed = JSON.parse(storedSightings);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSightings(parsed);
          }
        }
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
        const userMeta = session.user.user_metadata || {};
        const cloudAccount: UserAccount = {
          name: userMeta.full_name || userMeta.name || session.user.email?.split('@')[0] || 'Surveyor',
          email: session.user.email || '',
          organization: userMeta.organization || 'Tunisia Fauna Observatory',
          role: userMeta.role || 'surveyor',
          governorate: userMeta.governorate || 'Tunis',
          surveyorId: `TUN-OBS-${session.user.id.slice(0, 6).toUpperCase()}`,
          createdAt: session.user.created_at || new Date().toISOString(),
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
          } catch (e) {
            setStats({ sessionsCompleted: 0, kmWalked: 0, animalsRecorded: 0 });
          }
        }
        AsyncStorage.setItem('hawem_account_v1', JSON.stringify(cloudAccount)).catch(() => {});
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setUserAccount(null);
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

  const handleAcceptConsent = () => {
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
      await AsyncStorage.setItem('hawem_sightings_v1', JSON.stringify(newList));
    } catch (err) {
      console.warn('Error saving sightings:', err);
    }
  };

  // Add sighting from Opportunistic form
  const handleSaveOpportunistic = (observation: any) => {
    const newItem: SightingItem = {
      id: `sighting-${Date.now()}`,
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
    const sessionId = `incidental-sess-${Date.now()}`;
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
            type: 'Point',
            coordinates: [newItem.longitude, newItem.latitude],
          },
          notes: newItem.notes,
        },
      ],
      photos: capturedPhotos.map((p, idx) => ({
        id: `photo-${newItem.id}-${idx}`,
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
      id: animal.id || `sighting-${Date.now()}`,
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
    setActiveTab('progress');
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
            setActiveTab('map');
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
        {activeTab === 'map' ? (
          primaryViewMode === 'dashboard' ? (
            <HomeScreen
              onStartSurvey={() => handleTabPress('survey')}
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
              onOpenAccount={() => handleTabPress('profile')}
              onToggleDashboard={() => setPrimaryViewMode('dashboard')}
              onStartSurvey={(routeId) => {
                setSelectedRouteForSurvey(routeId);
                handleTabPress('survey');
              }}
            />
          )
        ) : activeTab === 'survey' ? (
          <StructuredSurveyScreen
            onBack={() => handleTabPress('map')}
            onFinishSurvey={handleFinishStructuredSurvey}
            onLogAnimal={handleLogAnimalInSurvey}
            loggedAnimalsCount={stats.animalsRecorded}
            initialRouteId={selectedRouteForSurvey}
          />
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
        ) : activeTab === 'progress' ? (
          <ProgressScreen userAccount={userAccount} />
        ) : activeTab === 'profile' ? (
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
        ) : null}
      </View>

      {/* TripGlide Floating Dark Capsule Navigation Bar (Ref: TripGlide mobile UI) */}
      <View
        style={[
          styles.floatingTabBarContainer,
          { bottom: Math.max(insets.bottom + 8, 16) },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.floatingTabBar}>
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'map' && styles.tabPillActive,
            ]}
            onPress={() => handleTabPress('map')}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityLabel={t('nav.map')}
            accessibilityState={{ selected: activeTab === 'map' }}
          >
            <IOSIcon
              name="map"
              size={20}
              color={activeTab === 'map' ? '#0F172A' : '#94A3B8'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'survey' && styles.tabPillActive,
            ]}
            onPress={() => handleTabPress('survey')}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityLabel={t('nav.survey')}
            accessibilityState={{ selected: activeTab === 'survey' }}
          >
            <IOSIcon
              name="compass"
              size={20}
              color={activeTab === 'survey' ? '#0F172A' : '#94A3B8'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'animals' && styles.tabPillActive,
            ]}
            onPress={() => handleTabPress('animals')}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityLabel={t('nav.animals')}
            accessibilityState={{ selected: activeTab === 'animals' }}
          >
            <IOSIcon
              name="paw"
              size={20}
              color={activeTab === 'animals' ? '#0F172A' : '#94A3B8'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'progress' && styles.tabPillActive,
            ]}
            onPress={() => handleTabPress('progress')}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityLabel={t('nav.progress')}
            accessibilityState={{ selected: activeTab === 'progress' }}
          >
            <IOSIcon
              name="chart"
              size={20}
              color={activeTab === 'progress' ? '#0F172A' : '#94A3B8'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'profile' && styles.tabPillActive,
            ]}
            onPress={() => handleTabPress('profile')}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityLabel={t('nav.profile')}
            accessibilityState={{ selected: activeTab === 'profile' }}
          >
            <IOSIcon
              name="person"
              size={20}
              color={activeTab === 'profile' ? '#0F172A' : '#94A3B8'}
            />
          </TouchableOpacity>
        </View>
      </View>
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
    maxWidth: 340,
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
  },
  tabPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 4,
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

registerRootComponent(App);
