import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import {
  hapticModalClose,
  hapticButtonPress,
  hapticTabSwitch,
  hapticQuickLog,
  hapticWarning,
  hapticSuccess,
} from '../utils/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { SurveyProtocol, Species } from '@tunisia-survey/shared';
import { IOSColors, IOSTypography, IOSLayout } from '../theme/ios';
import {
  IOSNavigationBar,
  IOSGroupedList,
  IOSListRow,
  IOSSegmentedControl,
  IOSButton,
  IOSIcon,
} from '../components/ios';
import { InteractiveMap } from '../components/map/InteractiveMap';
import { WorkoutHUD } from '../components/survey/WorkoutHUD';
import { BearingDistanceInput } from '../components/survey/BearingDistanceInput';
import { AnimalMatcherModal } from '../components/animals/AnimalMatcherModal';
import { WelfareAlertModal } from '../components/welfare/WelfareAlertModal';
import { RoutePickerModal } from '../components/routes/RoutePickerModal';
import { ColonyInspectorModal } from '../components/colonies/ColonyInspectorModal';
import { SurveySummaryModal, SurveySummaryData } from '../components/survey/SurveySummaryModal';
import { AnimatedHeroBanner } from '../components/common/AnimatedHeroBanner';
import { useAnimalsStore, AnimalProfile } from '../features/animals/animalsStore';
import { useGamificationStore } from '../features/gamification/gamificationStore';
import { useRoutesStore, FixedRoute } from '../features/routes/routesStore';
import { useColoniesStore, CatColony } from '../features/colonies/coloniesStore';
import { useSyncStore } from '../features/sync/syncStore';
import { useSurveyStore } from '../features/survey/surveyStore';
import { generateUUID } from '../utils/uuid';
import { promptPhotoCaptureChoice } from '../services/cameraService';
import {
  calculateDistanceKm,
  simplifyGpsTrack,
  computeAnimalLocation,
} from '../services/georef/geoUtils';
import {
  generateScientificObservationCode,
  getNextSessionObservationCode,
} from '../utils/scientificCodes';

export interface SurveyDetection {
  id: string;
  species: Species;
  identifier?: string;
  group_size: number;
  distance_from_path_m: number;
  latitude: number;
  longitude: number;
  observed_at: string;
  notes?: string;
  photoUri?: string | null;
  photoUris?: string[];
  bearing_deg?: number;
  animalLat?: number;
  animalLon?: number;
  body_condition_score?: number;
  gps_accuracy_m?: number;
}

interface StructuredSurveyScreenProps {
  onBack: () => void;
  onFinishSurvey: (sessionData: any) => void;
  onLogAnimal: (animalData: any) => void;
  loggedAnimalsCount: number;
  activeDetections?: SurveyDetection[];
  onOpenPhotoCaptureModal?: () => void;
  initialRouteId?: string | null;
}

export const StructuredSurveyScreen: React.FC<StructuredSurveyScreenProps> = ({
  onBack,
  onFinishSurvey,
  onLogAnimal,
  loggedAnimalsCount,
  initialRouteId,
}) => {
  const { t } = useTranslation();

  const [protocol, setProtocol] = useState<SurveyProtocol>('transect');
  const [selectedRouteObj, setSelectedRouteObj] = useState<FixedRoute | null>(null);
  const [showRoutePicker, setShowRoutePicker] = useState<boolean>(false);
  const [isOffRoute, setIsOffRoute] = useState<boolean>(false);
  const [offRouteDistanceM, setOffRouteDistanceM] = useState<number>(0);

  // Routes and colonies stores
  const { routes, checkOffRoute, recordSurveyCompletion } = useRoutesStore();
  const { colonies } = useColoniesStore();
  const [selectedColony, setSelectedColony] = useState<CatColony | null>(null);

  // Preload initial route if requested from MapOverviewScreen
  useEffect(() => {
    if (initialRouteId) {
      const r = routes.find((item) => item.id === initialRouteId);
      if (r) {
        setSelectedRouteObj(r);
        setProtocol('transect');
      }
    }
  }, [initialRouteId, routes]);

  // Survey summary state
  const [showSummaryModal, setShowSummaryModal] = useState<boolean>(false);
  const [summaryData, setSummaryData] = useState<SurveySummaryData | null>(null);
  const [pendingSyncPayload, setPendingSyncPayload] = useState<{
    sessionId: string;
    totalXp: number;
    reason: string;
    completeChecklist: boolean;
  } | null>(null);

  const [isSurveyActive, setIsSurveyActive] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [distanceKm, setDistanceKm] = useState<number>(0.0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // In-session active detections list (In-Survey CRUD)
  const [sessionDetections, setSessionDetections] = useState<SurveyDetection[]>([]);
  const [editingDetection, setEditingDetection] = useState<SurveyDetection | null>(null);

  // Detection modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [sightingSpecies, setSightingSpecies] = useState<Species>('cat');
  const [sightingIdentifier, setSightingIdentifier] = useState<string>('');
  const [groupSize, setGroupSize] = useState<number>(1);
  const [distanceFromPathM, setDistanceFromPathM] = useState<string>('5.0');
  const [sightingBearing, setSightingBearing] = useState<number>(45);
  const [detectionNotes, setDetectionNotes] = useState<string>('');
  const [attachedPhotos, setAttachedPhotos] = useState<string[]>([]);
  const [bodyConditionScore, setBodyConditionScore] = useState<number>(3);
  const surveyStartedAtRef = useRef<string | null>(null);

  // Re-identification candidate matcher & Welfare Alert
  const [showMatcherModal, setShowMatcherModal] = useState<boolean>(false);
  const [showWelfareModal, setShowWelfareModal] = useState<boolean>(false);
  const [nearbyCandidates, setNearbyCandidates] = useState<AnimalProfile[]>([]);

  // Success banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Hardware GPS & Track state
  const [currentLat, setCurrentLat] = useState<number>(0);
  const [currentLon, setCurrentLon] = useState<number>(0);
  const [currentHeading, setCurrentHeading] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number>(0);
  const [activeTrack, setActiveTrack] = useState<[number, number][]>([]);
  const [gpsMode, setGpsMode] = useState<'hardware' | 'acquiring_fix'>('acquiring_fix');
  const [gpsPermissionGranted, setGpsPermissionGranted] = useState<boolean>(false);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const lastCoordRef = useRef<{ lat: number; lon: number; timestamp: number } | null>(null);

  // 1. Initial GPS setup & permission request
  useEffect(() => {
    let isMounted = true;
    async function initGps() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          if (!isMounted) return;
          setGpsPermissionGranted(true);
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          if (isMounted && loc?.coords) {
            setCurrentLat(loc.coords.latitude);
            setCurrentLon(loc.coords.longitude);
            if (
              loc.coords.heading !== null &&
              loc.coords.heading !== undefined &&
              loc.coords.heading >= 0
            ) {
              setCurrentHeading(loc.coords.heading);
            }
            setGpsAccuracy(loc.coords.accuracy || 3.0);
            setGpsMode('hardware');
            if (!isSurveyActive) {
              setActiveTrack([[loc.coords.latitude, loc.coords.longitude]]);
            }
          }
        } else {
          if (isMounted) {
            setGpsPermissionGranted(false);
            setGpsMode('acquiring_fix');
          }
        }
      } catch (err) {
        console.warn('[StructuredSurveyScreen] GPS initialization error:', err);
        if (isMounted) setGpsMode('acquiring_fix');
      }
    }
    initGps();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Real-time hardware GPS location watcher during active survey
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let isCancelled = false;

    if (isSurveyActive && !isPaused && gpsPermissionGranted) {
      (async () => {
        try {
          if (!lastCoordRef.current) {
            lastCoordRef.current = { lat: currentLat, lon: currentLon, timestamp: Date.now() };
          }

          sub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 1000,
              distanceInterval: 2, // minimum 2m displacement to filter out stationary jitter
            },
            (location) => {
              if (isCancelled || isPaused) return;
              const { latitude, longitude, accuracy } = location.coords;

              // Filter out low-confidence fixes (> 35m accuracy radius)
              if (accuracy && accuracy > 35) return;

              setCurrentLat(latitude);
              setCurrentLon(longitude);
              if (
                location.coords.heading !== null &&
                location.coords.heading !== undefined &&
                location.coords.heading >= 0
              ) {
                setCurrentHeading(location.coords.heading);
              }
              if (accuracy) setGpsAccuracy(accuracy);

              if (protocol === 'transect') {
                if (lastCoordRef.current) {
                  const deltaKm = calculateDistanceKm(
                    lastCoordRef.current.lat,
                    lastCoordRef.current.lon,
                    latitude,
                    longitude
                  );

                  // Threshold filter: Ignore micro-jitter (< 2m = 0.002 km)
                  // Velocity filter: Enforce ≤ 4.17 m/s (15 km/h) walking limit per CLAUDE.md §2.2
                  const timeDiffSec = (Date.now() - lastCoordRef.current.timestamp) / 1000;
                  const speedMs = timeDiffSec > 0 ? (deltaKm * 1000) / timeDiffSec : 0;

                  if (deltaKm >= 0.002 && speedMs <= 4.17) {
                    setDistanceKm((prev) => parseFloat((prev + deltaKm).toFixed(3)));
                    setActiveTrack((prev) => [...prev, [latitude, longitude]]);
                    lastCoordRef.current = { lat: latitude, lon: longitude, timestamp: Date.now() };

                    // Wire into centralized surveyStore
                    useSurveyStore
                      .getState()
                      .addTrackPoint(latitude, longitude, accuracy ?? undefined, speedMs);

                    // Off-route corridor check (> 50m deviation from fixed transect)
                    if (selectedRouteObj) {
                      const check = checkOffRoute(latitude, longitude, selectedRouteObj.id);
                      setIsOffRoute(check.isOffRoute);
                      setOffRouteDistanceM(check.distanceM);
                    }
                  }
                } else {
                  lastCoordRef.current = { lat: latitude, lon: longitude, timestamp: Date.now() };
                  setActiveTrack((prev) => [...prev, [latitude, longitude]]);
                  useSurveyStore
                    .getState()
                    .addTrackPoint(latitude, longitude, accuracy ?? undefined, 0);
                }
              }
            }
          );
          locationSubRef.current = sub;
        } catch (err) {
          console.warn('[StructuredSurveyScreen] Location watch error:', err);
          setGpsMode('acquiring_fix');
        }
      })();
    }

    return () => {
      isCancelled = true;
      if (sub) sub.remove();
      locationSubRef.current = null;
    };
  }, [isSurveyActive, isPaused, gpsPermissionGranted, protocol, selectedRouteObj, checkOffRoute]);

  // 3. Timer loop for active session (increments timer; distance is derived strictly from real GPS fixes)
  useEffect(() => {
    let timer: any;
    if (isSurveyActive && !isPaused) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
        useSurveyStore.getState().tickTimer();
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSurveyActive, isPaused]);

  // Haptic feedback alert on waypoint deviation (> 50m off route corridor)
  const prevOffRouteRef = useRef<boolean>(false);
  useEffect(() => {
    if (isOffRoute && !prevOffRouteRef.current && isSurveyActive) {
      hapticWarning();
    }
    prevOffRouteRef.current = isOffRoute;
  }, [isOffRoute, isSurveyActive]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    setIsSurveyActive(true);
    setIsPaused(false);
    setElapsedSeconds(0);
    setDistanceKm(0.0);
    setSessionDetections([]);
    setToastMessage(null);
    setIsOffRoute(false);
    setOffRouteDistanceM(0);
    surveyStartedAtRef.current = new Date().toISOString();
    lastCoordRef.current = { lat: currentLat, lon: currentLon, timestamp: Date.now() };
    setActiveTrack([[currentLat, currentLon]]);
    useSurveyStore.getState().startSurvey(protocol, selectedRouteObj?.id);
  };

  const openNewDetectionModalWithSpecies = (species: Species) => {
    // Default to current movement heading if available, or 0° (Straight Ahead along path)
    const initialHeading =
      currentHeading !== null && currentHeading >= 0 ? Math.round(currentHeading) : 0;
    const initialDist = 5.0;

    // Scientifically compute true animal location immediately
    const geo = computeAnimalLocation(
      currentLat,
      currentLon,
      initialDist,
      initialHeading,
      selectedRouteObj?.waypoints
    );

    const scientificCode = getNextSessionObservationCode(species, sessionDetections);

    const newDetection: SurveyDetection = {
      id: `det-${Date.now()}`,
      species,
      identifier: scientificCode,
      group_size: 1,
      distance_from_path_m: geo.perpendicularDistanceM ?? initialDist,
      bearing_deg: initialHeading,
      animalLat: geo.animalLat,
      animalLon: geo.animalLon,
      body_condition_score: 3,
      gps_accuracy_m: gpsAccuracy,
      latitude: currentLat,
      longitude: currentLon,
      observed_at: new Date().toISOString(),
      notes: '',
      photoUri: null,
      photoUris: [],
    };

    // Immediately save to local state and SQLite persistence so sighting is preserved even if sheet is dismissed
    setSessionDetections((prev) => [...prev, newDetection]);
    onLogAnimal({ ...newDetection, protocol });

    useSurveyStore.getState().logDetection({
      species,
      identifier: scientificCode,
      group_size: 1,
      distance_estimate_m: initialDist,
      bearing_deg: initialHeading,
      body_condition_score: 3,
      notes: '',
      photoUri: null,
      photoUris: [],
      observer_lat: currentLat,
      observer_lon: currentLon,
      gps_accuracy_m: gpsAccuracy,
    });

    // Populate editor sheet with this new detection for optional refinement
    setEditingDetection(newDetection);
    setSightingSpecies(species);
    setSightingIdentifier(scientificCode);
    setGroupSize(1);
    setDistanceFromPathM('5.0');
    setBodyConditionScore(3);
    setSightingBearing(initialHeading);
    setDetectionNotes('');
    setAttachedPhotos([]);

    // Look for known individuals within 350m
    const candidates = useAnimalsStore
      .getState()
      .findNearbyCandidates(species, currentLat, currentLon, 350);
    setNearbyCandidates(candidates);

    setIsModalOpen(true);
    showToast(`Recorded ${species} sighting`);
  };

  const openNewDetectionModal = () => {
    openNewDetectionModalWithSpecies('cat');
  };

  const openEditDetectionModal = (item: SurveyDetection) => {
    hapticButtonPress();
    setEditingDetection(item);
    setSightingSpecies(item.species);
    setSightingIdentifier(item.identifier || '');
    setGroupSize(item.group_size);
    setDistanceFromPathM(item.distance_from_path_m.toString());
    setSightingBearing(item.bearing_deg ?? 0);
    setBodyConditionScore(item.body_condition_score || 3);
    setDetectionNotes(item.notes || '');
    setAttachedPhotos(item.photoUris || (item.photoUri ? [item.photoUri] : []));
    setIsModalOpen(true);
  };

  const handleCloseObservationModal = () => {
    hapticModalClose();
    setIsModalOpen(false);
  };

  const handleAddInSurveyPhoto = async () => {
    const photo = await promptPhotoCaptureChoice(
      `Capture ${sightingSpecies === 'cat' ? 'Cat' : 'Dog'} Photo`,
      groupSize > 1
        ? `Take photo of animal #${attachedPhotos.length + 1} in the group, or a wide shot.`
        : 'Take a clear photo for identification.'
    );
    if (photo?.uri) {
      setAttachedPhotos((prev) => [...prev, photo.uri]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setAttachedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveDetection = () => {
    hapticQuickLog();
    const dist = parseFloat(distanceFromPathM) || 0;
    const primaryPhoto = attachedPhotos[0] || null;
    const cleanIdentifier = sightingIdentifier.trim() || undefined;

    // Scientifically compute true animal location and perpendicular distance
    const geo = computeAnimalLocation(
      currentLat,
      currentLon,
      dist,
      sightingBearing,
      selectedRouteObj?.waypoints
    );

    if (editingDetection) {
      // Update existing detection
      const updatedList = sessionDetections.map((d) =>
        d.id === editingDetection.id
          ? {
              ...d,
              species: sightingSpecies,
              identifier: cleanIdentifier,
              group_size: groupSize,
              distance_from_path_m: geo.perpendicularDistanceM ?? dist,
              bearing_deg: sightingBearing,
              animalLat: geo.animalLat,
              animalLon: geo.animalLon,
              body_condition_score: bodyConditionScore,
              gps_accuracy_m: gpsAccuracy,
              notes: detectionNotes,
              photoUri: primaryPhoto,
              photoUris: attachedPhotos,
            }
          : d
      );
      setSessionDetections(updatedList);
      showToast(`Updated detection: ${cleanIdentifier || sightingSpecies}`);
    } else {
      // Add new detection
      const newDetection: SurveyDetection = {
        id: `det-${Date.now()}`,
        species: sightingSpecies,
        identifier: cleanIdentifier,
        group_size: groupSize,
        distance_from_path_m: geo.perpendicularDistanceM ?? dist,
        bearing_deg: sightingBearing,
        animalLat: geo.animalLat,
        animalLon: geo.animalLon,
        body_condition_score: bodyConditionScore,
        gps_accuracy_m: gpsAccuracy,
        latitude: currentLat,
        longitude: currentLon,
        observed_at: new Date().toISOString(),
        notes: detectionNotes,
        photoUri: primaryPhoto,
        photoUris: attachedPhotos,
      };

      setSessionDetections((prev) => [...prev, newDetection]);
      onLogAnimal({
        ...newDetection,
        protocol,
      });

      // Synchronize with centralized surveyStore
      useSurveyStore.getState().logDetection({
        species: sightingSpecies,
        group_size: groupSize,
        distance_estimate_m: dist,
        bearing_deg: sightingBearing,
        body_condition_score: bodyConditionScore,
        notes: detectionNotes,
        photoUri: primaryPhoto,
        photoUris: attachedPhotos,
        observer_lat: currentLat,
        observer_lon: currentLon,
        gps_accuracy_m: gpsAccuracy,
      });

      showToast(
        `Recorded ${cleanIdentifier || (groupSize > 1 ? `group of ${groupSize} ${sightingSpecies}s` : sightingSpecies)}`
      );
    }

    setIsModalOpen(false);
  };

  const handleDeleteDetection = (id: string) => {
    Alert.alert(t('survey.delete_detection'), t('survey.confirm_delete_msg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          setSessionDetections((prev) => prev.filter((d) => d.id !== id));
          showToast('Observation removed from survey');
        },
      },
    ]);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const confirmEnd = (completeChecklist: boolean) => {
    hapticButtonPress();
    setIsSurveyActive(false);

    // Calculate scientifically calibrated XP
    // Effort: 10 XP per 10 mins (up to 60)
    const effortXp = Math.min(60, Math.max(10, Math.floor(elapsedSeconds / 600) * 10));
    // Complete checklist bonus (same +20 XP for 0-count non-detections!)
    const completeBonus = completeChecklist ? 20 : 0;
    // Animals logged (max 20)
    const animalsBonus = Math.min(20, sessionDetections.length * 2);
    // Adopted route repeat guardian bonus (+15 XP)
    const routeBonus = selectedRouteObj ? selectedRouteObj.bonusXp || 15 : 0;
    // Academy certification 10% multiplier
    const isCertified = useGamificationStore.getState().isAcademyCertified;
    const subtotal = effortXp + completeBonus + animalsBonus + routeBonus;
    const certifiedBonus = isCertified ? Math.round(subtotal * 0.1) : 0;
    const totalXp = subtotal + certifiedBonus;

    const reason =
      completeChecklist && sessionDetections.length === 0
        ? 'Completed Zero-Detection Survey (eBird scientific non-detection)'
        : 'Completed Structured Transect Survey';

    const sessionId = generateUUID();
    setPendingSyncPayload({
      sessionId,
      totalXp,
      reason,
      completeChecklist,
    });

    setSummaryData({
      protocol,
      durationSeconds: elapsedSeconds,
      distanceKm,
      detectionsCount: sessionDetections.length,
      catsCount: sessionDetections.filter((d) => d.species === 'cat').length,
      dogsCount: sessionDetections.filter((d) => d.species === 'dog').length,
      completeChecklist,
      selectedRoute: selectedRouteObj,
      isAcademyCertified: isCertified,
      effortXp,
      completeBonus,
      animalsBonus,
      routeBonus,
      certifiedBonus,
      totalXp,
    });

    setShowSummaryModal(true);
  };

  const handleFinalizeFromSummary = (checklistComplete?: boolean) => {
    if (!pendingSyncPayload) {
      setShowSummaryModal(false);
      return;
    }

    const effectiveChecklist =
      typeof checklistComplete === 'boolean'
        ? checklistComplete
        : pendingSyncPayload.completeChecklist;

    // Recalculate scientific XP based on final checklist verification
    const effortXp = Math.min(60, Math.max(10, Math.floor(elapsedSeconds / 600) * 10));
    const completeBonus = effectiveChecklist ? 20 : 0;
    const animalsBonus = Math.min(20, sessionDetections.length * 2);
    const routeBonus = selectedRouteObj ? selectedRouteObj.bonusXp || 15 : 0;
    const isCertified = useGamificationStore.getState().isAcademyCertified;
    const subtotal = effortXp + completeBonus + animalsBonus + routeBonus;
    const certifiedBonus = isCertified ? Math.round(subtotal * 0.1) : 0;
    const totalXp = subtotal + certifiedBonus;

    const reason =
      effectiveChecklist && sessionDetections.length === 0
        ? 'Completed Zero-Detection Survey (eBird scientific non-detection)'
        : 'Completed Structured Transect Survey';

    const { sessionId } = pendingSyncPayload;

    useSurveyStore.getState().setCompleteChecklist(effectiveChecklist);

    // 1. Award calibrated scientific XP
    useGamificationStore.getState().awardXp(totalXp, reason);

    // 2. Record survey completion in routes store if fixed route
    if (selectedRouteObj) {
      recordSurveyCompletion(selectedRouteObj.id);
    }

    // 3. Package and enqueue for live PostGIS/Supabase sync
    const simplifiedTrack = simplifyGpsTrack(activeTrack, 2.0);
    const trackCoords: [number, number][] =
      simplifiedTrack.length >= 2 ? simplifiedTrack.map(([lat, lon]) => [lon, lat]) : [];

    // Map detection local id to generated UUID
    const detectionUuidMap = new Map<string, string>();
    const observationsPayload = sessionDetections.map((d) => {
      const obsUuid = generateUUID();
      const animLon = d.animalLon ?? d.longitude ?? currentLon;
      const animLat = d.animalLat ?? d.latitude ?? currentLat;
      const obsLon = d.longitude ?? currentLon;
      const obsLat = d.latitude ?? currentLat;

      return {
        id: obsUuid,
        observed_at: d.observed_at || new Date().toISOString(),
        species: d.species,
        group_size: d.group_size || 1,
        distance_from_path_m: d.distance_from_path_m,
        body_condition_score: d.body_condition_score || 3,
        location: {
          latitude: animLat,
          longitude: animLon,
          type: 'Point' as const,
          coordinates: [animLon, animLat] as [number, number],
        },
        observer_location: {
          latitude: obsLat,
          longitude: obsLon,
          type: 'Point' as const,
          coordinates: [obsLon, obsLat] as [number, number],
        },
        bearing_deg: d.bearing_deg ?? null,
        distance_estimate_m: d.distance_from_path_m ?? null,
        gps_accuracy_m: d.gps_accuracy_m ?? (gpsAccuracy || null),
        notes: d.notes,
      };
    });

    const photosPayload: Array<{
      id: string;
      observation_id: string;
      storage_path: string;
      angle: 'left_flank' | 'right_flank' | 'face' | 'other';
      taken_at: string;
    }> = [];

    sessionDetections.forEach((d) => {
      const obsUuid = detectionUuidMap.get(d.id) || generateUUID();
      const allUris = d.photoUris || (d.photoUri ? [d.photoUri] : []);
      allUris.forEach((uri, idx) => {
        photosPayload.push({
          id: generateUUID(),
          observation_id: obsUuid,
          storage_path: uri,
          angle: idx === 0 ? 'face' : 'other',
          taken_at: d.observed_at,
        });
      });
    });

    const trueStartTime =
      surveyStartedAtRef.current || new Date(Date.now() - elapsedSeconds * 1000).toISOString();

    const rawPoints = useSurveyStore.getState().rawTrackPoints;
    const effectiveTrackPoints =
      rawPoints.length > 0
        ? rawPoints
        : activeTrack.map(([lat, lon]) => ({
            recorded_at: new Date().toISOString(),
            latitude: lat,
            longitude: lon,
            accuracy_m: gpsAccuracy || null,
          }));

    useSyncStore.getState().enqueueSurvey({
      session: {
        id: sessionId,
        protocol,
        start_time: trueStartTime,
        end_time: new Date().toISOString(),
        distance_km: parseFloat(distanceKm.toFixed(3)),
        complete_session: effectiveChecklist,
        number_of_observers: 1,
        app_version: '2.0.0',
        device_gps_accuracy_avg: gpsAccuracy || null,
      },
      track: trackCoords.length >= 2 ? { type: 'LineString', coordinates: trackCoords } : null,
      track_points: effectiveTrackPoints,
      observations: observationsPayload,
      photos: photosPayload,
    });

    useSurveyStore.getState().finishSurvey();

    hapticSuccess();
    setShowSummaryModal(false);

    onFinishSurvey({
      protocol,
      route_id: selectedRouteObj?.id || null,
      duration_min: parseFloat((elapsedSeconds / 60).toFixed(2)),
      distance_km: parseFloat(distanceKm.toFixed(3)),
      complete_session: effectiveChecklist,
      detections_count: sessionDetections.length,
      number_of_observers: 1,
      xp_earned: totalXp,
    });
  };

  return (
    <View style={styles.outerContainer}>
      <LinearGradient
        colors={['#FDF2EC', '#FAF5EE', '#F3F6F2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {isSurveyActive ? (
          <IOSNavigationBar
            title={
              protocol === 'transect'
                ? t('survey.active_title')
                : t('ui_structuredSurvey.point_count_in_progress')
            }
            onBack={undefined}
            backTitle={t('nav.home')}
          />
        ) : null}

        {!isSurveyActive ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* TripGlide Full-Bleed Video Background Hero */}
            <AnimatedHeroBanner
              height={290}
              variant="backgroundHero"
              scene={protocol === 'stationary_point' ? 'cat' : 'patrol'}
              titleBadge="TERRITORIAL SURVEY RADAR"
              headline={
                protocol === 'transect' ? 'Standardized Field Transect' : 'Stationary Point Count'
              }
              subheadline={
                protocol === 'transect'
                  ? 'Distance sampling & population telemetry • Tunis'
                  : 'Fixed 360° vantage occupancy census • Tunis'
              }
              onBack={onBack}
            />

            {/* Overlapping Content Sheet (TripGlide Pattern) */}
            <View style={styles.overlappingSheet}>
              {/* Protocol Selection Group */}
              <IOSGroupedList
                header={t('survey.protocol_label')}
                footer={
                  protocol === 'transect'
                    ? t('ui_structuredSurvey.linear_transects_estimate_density_via_perpendicu')
                    : t('ui_structuredSurvey.point_counts_evaluate_local_occupancy_relative')
                }
              >
                <View style={styles.protocolSelectionContainer}>
                  {/* Option 1: Linear Walking Transect */}
                  <TouchableOpacity
                    style={[
                      styles.protocolCard,
                      protocol === 'transect' && styles.protocolCardActive,
                    ]}
                    onPress={() => {
                      hapticTabSwitch();
                      setProtocol('transect');
                    }}
                    activeOpacity={0.82}
                  >
                    <View style={styles.protocolCardLeft}>
                      <View
                        style={[
                          styles.protocolIconCircle,
                          protocol === 'transect' && styles.protocolIconCircleActive,
                        ]}
                      >
                        <IOSIcon
                          name="compass"
                          size={20}
                          color={protocol === 'transect' ? '#0284C7' : '#64748B'}
                        />
                      </View>
                      <View style={styles.protocolTextCol}>
                        <View style={styles.protocolTitleRow}>
                          <Text
                            style={[
                              styles.protocolTitle,
                              protocol === 'transect' && styles.protocolTitleActive,
                            ]}
                          >
                            {t('ui_structuredSurvey.linear_walking_transect')}
                          </Text>
                          <View
                            style={[
                              styles.protocolBadge,
                              protocol === 'transect' && styles.protocolBadgeActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.protocolBadgeText,
                                protocol === 'transect' && styles.protocolBadgeTextActive,
                              ]}
                            >
                              {t('ui_structuredSurvey.distance_sampling')}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.protocolDescription}>
                          {t(
                            'ui_structuredSurvey.continuous_pace_along_path_perpendicular_distanc'
                          )}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.protocolRadio,
                        protocol === 'transect' && styles.protocolRadioActive,
                      ]}
                    >
                      {protocol === 'transect' ? (
                        <IOSIcon name="check" size={13} color="#FFFFFF" />
                      ) : null}
                    </View>
                  </TouchableOpacity>

                  {/* Option 2: Stationary Point Count */}
                  <TouchableOpacity
                    style={[
                      styles.protocolCard,
                      protocol === 'stationary_point' && styles.protocolCardActive,
                    ]}
                    onPress={() => {
                      hapticTabSwitch();
                      setProtocol('stationary_point');
                    }}
                    activeOpacity={0.82}
                  >
                    <View style={styles.protocolCardLeft}>
                      <View
                        style={[
                          styles.protocolIconCircle,
                          protocol === 'stationary_point' && styles.protocolIconCircleActive,
                        ]}
                      >
                        <IOSIcon
                          name="location"
                          size={20}
                          color={protocol === 'stationary_point' ? '#0284C7' : '#64748B'}
                        />
                      </View>
                      <View style={styles.protocolTextCol}>
                        <View style={styles.protocolTitleRow}>
                          <Text
                            style={[
                              styles.protocolTitle,
                              protocol === 'stationary_point' && styles.protocolTitleActive,
                            ]}
                          >
                            {t('ui_structuredSurvey.stationary_point_count')}
                          </Text>
                          <View
                            style={[
                              styles.protocolBadge,
                              protocol === 'stationary_point' && styles.protocolBadgeActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.protocolBadgeText,
                                protocol === 'stationary_point' && styles.protocolBadgeTextActive,
                              ]}
                            >
                              {t('ui_structuredSurvey.fixed_radius')}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.protocolDescription}>
                          {t('ui_structuredSurvey.fixed_360_observation_post_timed_local')}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.protocolRadio,
                        protocol === 'stationary_point' && styles.protocolRadioActive,
                      ]}
                    >
                      {protocol === 'stationary_point' ? (
                        <IOSIcon name="check" size={13} color="#FFFFFF" />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                </View>
              </IOSGroupedList>

              {/* Standardized Predefined Routes & Route Preview Carousel */}
              <IOSGroupedList
                header={t('survey.fixed_route')}
                footer={t('ui_structuredSurvey.swipe_to_preview_standardized_transects_for')}
              >
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.routeCarouselScroll}
                >
                  {/* Free Roam Unconstrained Transect Card */}
                  <TouchableOpacity
                    style={[
                      styles.routePreviewCard,
                      !selectedRouteObj && styles.routePreviewCardActive,
                    ]}
                    onPress={() => {
                      hapticButtonPress();
                      setSelectedRouteObj(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.routeCardTop}>
                      <View
                        style={[
                          styles.routeIconCircle,
                          !selectedRouteObj && { backgroundColor: '#E0F2FE' },
                        ]}
                      >
                        <IOSIcon
                          name="map"
                          size={16}
                          color={!selectedRouteObj ? '#0284C7' : '#64748B'}
                        />
                      </View>
                      <View style={styles.routePillTag}>
                        <Text style={styles.routePillTagText}>
                          {t('ui_structuredSurvey.unconstrained')}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.routeCardName} numberOfLines={1}>
                      {t('survey.free_route')}
                    </Text>
                    <Text style={styles.routeCardSub} numberOfLines={2}>
                      {t('survey.free_route_sub')}
                    </Text>

                    <View style={styles.routeCardFooter}>
                      <Text style={styles.routeFooterMetric}>
                        {t('ui_structuredSurvey.adaptive_gps')}
                      </Text>
                      {!selectedRouteObj && (
                        <View style={styles.activeCheckPill}>
                          <IOSIcon name="check" size={10} color="#0F172A" />
                          <Text style={styles.activeCheckText}>
                            {t('ui_structuredSurvey.active')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Standard Transect Route Cards */}
                  {routes.map((route) => {
                    const isSelected = selectedRouteObj?.id === route.id;
                    return (
                      <TouchableOpacity
                        key={route.id}
                        style={[
                          styles.routePreviewCard,
                          isSelected && styles.routePreviewCardActive,
                        ]}
                        onPress={() => {
                          hapticButtonPress();
                          setSelectedRouteObj(route);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.routeCardTop}>
                          <View
                            style={[
                              styles.routeIconCircle,
                              isSelected && { backgroundColor: '#EEF2FF' },
                            ]}
                          >
                            <IOSIcon
                              name="compass"
                              size={16}
                              color={isSelected ? IOSColors.systemIndigo : '#64748B'}
                            />
                          </View>
                          <View style={styles.routePillTag}>
                            <Text style={styles.routePillTagText}>{route.zone.toUpperCase()}</Text>
                          </View>
                        </View>

                        <Text style={styles.routeCardName} numberOfLines={1}>
                          {route.name}
                        </Text>
                        <Text style={styles.routeCardSub} numberOfLines={1}>
                          {route.zone}
                        </Text>

                        <View style={styles.routeMetricsRow}>
                          <Text style={styles.routeMetricVal}>
                            {t('ui_structuredSurvey.km', { distanceKm: route.distanceKm })}
                          </Text>
                          <Text style={styles.routeMetricDot}>•</Text>
                          <Text style={styles.routeMetricVal}>
                            {t('ui_structuredSurvey.km_h', { targetPaceKmH: route.targetPaceKmH })}
                          </Text>
                          <Text style={styles.routeMetricDot}>•</Text>
                          <Text
                            style={[styles.routeMetricVal, { color: '#059669', fontWeight: '700' }]}
                          >
                            {t('ui_structuredSurvey.xp', { bonusXp: route.bonusXp })}
                          </Text>
                        </View>

                        <View style={styles.routeCardFooter}>
                          {route.isAdopted ? (
                            <View style={styles.guardianTag}>
                              <IOSIcon name="shield" size={10} color="#4F46E5" />
                              <Text style={styles.guardianTagText}>
                                {t('ui_structuredSurvey.guardian')}
                              </Text>
                            </View>
                          ) : (
                            <Text style={styles.routeFooterMetric}>
                              {t('ui_structuredSurvey.standard')}
                            </Text>
                          )}

                          {isSelected && (
                            <View style={styles.activeCheckPill}>
                              <IOSIcon name="check" size={10} color="#0F172A" />
                              <Text style={styles.activeCheckText}>
                                {t('ui_structuredSurvey.active')}
                              </Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Browse All in Catalog Card */}
                  <TouchableOpacity
                    style={styles.browseAllCard}
                    onPress={() => {
                      hapticButtonPress();
                      setShowRoutePicker(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.browseAllIconCircle}>
                      <IOSIcon name="squareStack" size={20} color={IOSColors.systemTeal} />
                    </View>
                    <Text style={styles.browseAllTitle}>
                      {t('ui_structuredSurvey.browse_catalog')}
                    </Text>
                    <Text style={styles.browseAllSub}>
                      {t('ui_structuredSurvey.predefined_routes', { length: routes.length })}
                    </Text>
                    <View style={styles.browseAllActionRow}>
                      <Text style={styles.browseAllBtnText}>
                        {t('ui_structuredSurvey.view_all')}
                      </Text>
                      <IOSIcon name="chevronRight" size={11} color={IOSColors.systemTeal} />
                    </View>
                  </TouchableOpacity>
                </ScrollView>
              </IOSGroupedList>

              <View style={styles.actionContainer}>
                <IOSButton
                  title={
                    protocol === 'transect'
                      ? t('survey.start_btn')
                      : t('ui_structuredSurvey.start_point_count_session')
                  }
                  onPress={handleStart}
                />
              </View>
            </View>
          </ScrollView>
        ) : (
          /* Active Survey View with Live Transect Path & In-Survey CRUD */
          <ScrollView
            contentContainerStyle={styles.activeScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Toast Notification Banner */}
            {toastMessage ? (
              <View style={styles.toastBanner}>
                <IOSIcon name="check" size={16} color="#FFFFFF" />
                <Text style={styles.toastText}>{toastMessage}</Text>
              </View>
            ) : null}

            {/* Off-Route Corridor Warning Banner (> 50m deviation) */}
            {isOffRoute && selectedRouteObj ? (
              <View style={styles.offRouteBanner}>
                <IOSIcon name="shield" size={16} color="#DC2626" />
                <Text style={styles.offRouteBannerText}>
                  {t('ui_structuredSurvey.off_corridor_warning_m_from', {
                    v1: offRouteDistanceM.toFixed(0),
                    name: selectedRouteObj.name,
                  })}
                </Text>
              </View>
            ) : null}

            {/* Live Interactive Map with Real GPS Track & Plotted Pins */}
            <View style={styles.interactiveMapCard}>
              <InteractiveMap
                initialLat={currentLat}
                initialLon={currentLon}
                initialZoom={16}
                markers={sessionDetections.map((d, idx) => ({
                  id: d.id,
                  latitude: d.latitude,
                  longitude: d.longitude,
                  species: d.species,
                  identifier: d.identifier || generateScientificObservationCode(d.species, idx + 1),
                  distance_from_path_m: d.distance_from_path_m,
                }))}
                colonyMarkers={colonies.map((c) => ({
                  id: c.id,
                  name: c.name,
                  latitude: c.latitude,
                  longitude: c.longitude,
                  estimatedPopulation: c.estimatedPopulation,
                  tnrPercent: Math.round(
                    (c.tnrSterilizedCount / Math.max(1, c.estimatedPopulation)) * 100
                  ),
                  hasWaterStation: c.hasWaterStation,
                  hasShelter: c.hasShelter,
                }))}
                trackCoordinates={activeTrack}
                routeCorridorCoordinates={selectedRouteObj?.waypoints || []}
                showUserLocation={true}
                onColonyPress={(id) => {
                  const col = colonies.find((c) => c.id === id);
                  setSelectedColony(col || null);
                }}
                height={210}
              />
            </View>

            {/* Apple Fitness Workout HUD */}
            <WorkoutHUD
              elapsedSeconds={elapsedSeconds}
              distanceKm={distanceKm}
              detectionsCount={sessionDetections.length}
              catsCount={sessionDetections.filter((d) => d.species === 'cat').length}
              dogsCount={sessionDetections.filter((d) => d.species === 'dog').length}
              isPaused={isPaused}
              gpsAccuracyM={gpsAccuracy}
              onPauseToggle={() => setIsPaused(!isPaused)}
              onLogCat={() => openNewDetectionModalWithSpecies('cat')}
              onLogDog={() => openNewDetectionModalWithSpecies('dog')}
              onFinish={() => confirmEnd(true)}
            />

            {/* In-Survey Recorded Detections List (CRUD) */}
            <View style={styles.detectionsSection}>
              <View style={styles.detectionsSectionHeader}>
                <Text style={styles.detectionsSectionTitle}>
                  {t('survey.recorded_in_survey')} ({sessionDetections.length})
                </Text>
              </View>

              {sessionDetections.length === 0 ? (
                <View style={styles.emptyDetectionsBox}>
                  <IOSIcon name="paw" size={24} color={IOSColors.systemGray3} />
                  <Text style={styles.emptyDetectionsText}>{t('survey.no_detections_yet')}</Text>
                </View>
              ) : (
                sessionDetections.map((det, index) => {
                  const isCat = det.species === 'cat';
                  return (
                    <View key={det.id} style={styles.detectionRowCard}>
                      <View style={styles.detectionMainCol}>
                        <View style={styles.detectionTopLine}>
                          <View
                            style={[
                              styles.detectionBadge,
                              {
                                backgroundColor: isCat
                                  ? IOSColors.systemTeal
                                  : IOSColors.systemOrange,
                              },
                            ]}
                          >
                            <Text style={styles.detectionBadgeText}>
                              {det.identifier ||
                                generateScientificObservationCode(det.species, index + 1)}
                            </Text>
                          </View>
                          <Text style={styles.detectionSpecies}>
                            {isCat ? t('ui_structuredSurvey.cat') : t('ui_structuredSurvey.dog')}
                            {det.group_size > 1
                              ? t('ui_structuredSurvey.group', { v0: det.group_size })
                              : ''}
                          </Text>
                          <View style={styles.distanceTag}>
                            <Text style={styles.distanceTagText}>
                              {det.distance_from_path_m.toFixed(1)} m
                            </Text>
                          </View>
                          {det.bearing_deg !== undefined ? (
                            <View style={styles.bearingTag}>
                              <IOSIcon name="compass" size={10} color="#0284C7" />
                              <Text style={styles.bearingTagText}>
                                {Math.round(det.bearing_deg)}°
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <View style={styles.detectionCoordsLine}>
                          <IOSIcon name="location" size={11} color={IOSColors.secondaryLabel} />
                          <Text style={styles.detectionCoordsText}>
                            {det.latitude.toFixed(5)}° N, {det.longitude.toFixed(5)}° E
                          </Text>
                          {det.photoUri ? (
                            <View style={styles.photoAttachedBadge}>
                              <IOSIcon name="camera" size={11} color={IOSColors.systemTeal} />
                              <Text style={styles.photoAttachedText}>
                                {t('ui_structuredSurvey.photo')}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {det.notes ? (
                          <Text style={styles.detectionNotes} numberOfLines={1}>
                            "{det.notes}"
                          </Text>
                        ) : null}
                      </View>

                      {/* Inline Edit & Delete Actions */}
                      <View style={styles.detectionActionsCol}>
                        <TouchableOpacity
                          onPress={() => openEditDetectionModal(det)}
                          style={styles.actionBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <IOSIcon name="pencil" size={16} color={IOSColors.systemTeal} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteDetection(det.id)}
                          style={styles.actionBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <IOSIcon name="trash" size={16} color={IOSColors.systemRed} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        )}

        {/* Observation Modal Sheet (Supports Photo Capture directly inside survey) */}
        <Modal
          visible={isModalOpen}
          transparent
          animationType="slide"
          onRequestClose={handleCloseObservationModal}
        >
          <View style={styles.sheetOverlay}>
            <View style={styles.sheetContainer}>
              {/* Sticky Sheet Header with Safe Area and Close Button */}
              <View style={styles.sheetHeader}>
                <View style={IOSLayout.sheetHandle} />
                <View style={styles.sheetHeaderRow}>
                  <Text style={styles.sheetTitle}>
                    {editingDetection
                      ? t('survey.edit_detection')
                      : t('ui_structuredSurvey.record_animal_detection')}
                  </Text>
                  <TouchableOpacity
                    onPress={handleCloseObservationModal}
                    style={styles.sheetCloseBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <IOSIcon name="xmark" size={15} color={IOSColors.secondaryLabel} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Scrollable Form Body */}
              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetScrollContent}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
              >
                {/* Species Selector */}
                <View style={{ marginBottom: 16 }}>
                  <IOSSegmentedControl<Species>
                    selectedValue={sightingSpecies}
                    onValueChange={(val) => {
                      hapticTabSwitch();
                      setSightingSpecies(val);
                    }}
                    values={[
                      { label: t('animal.cat'), value: 'cat' },
                      { label: t('animal.dog'), value: 'dog' },
                    ]}
                  />
                </View>

                {/* Observation Identifier / Field Tag */}
                <View style={{ marginBottom: 14 }}>
                  <Text style={styles.fieldLabel}>
                    {t('ui_structuredSurvey.identifier_field_tag_optional')}
                  </Text>
                  <View style={styles.identifierInputBox}>
                    <IOSIcon
                      name="paw"
                      size={15}
                      color={sightingSpecies === 'cat' ? '#0284C7' : '#D97706'}
                    />
                    <TextInput
                      style={styles.identifierTextInput}
                      value={sightingIdentifier}
                      onChangeText={setSightingIdentifier}
                      placeholder={t('ui_structuredSurvey.e_g_or_tag', {
                        v0: sightingSpecies === 'cat' ? 'Bab Souika Tabby' : 'Rex (Corner)',
                      })}
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="words"
                    />
                    {sightingIdentifier.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setSightingIdentifier('')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <IOSIcon name="xmark" size={14} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Group Size & Quick Multi-Animal Presets */}
                <View style={{ marginBottom: 14 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <Text style={styles.fieldLabel}>{t('animal.group_size')}</Text>
                    <Text style={styles.groupSizeHint}>
                      {groupSize === 1
                        ? t('ui_structuredSurvey.individual')
                        : groupSize <= 3
                          ? t('ui_structuredSurvey.small_group')
                          : t('ui_structuredSurvey.pack_litter')}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.stepperContainer}>
                      <TouchableOpacity
                        onPress={() => {
                          hapticTabSwitch();
                          setGroupSize(Math.max(1, groupSize - 1));
                        }}
                        style={styles.stepBtn}
                      >
                        <IOSIcon name="minus" size={14} color={IOSColors.systemTeal} />
                      </TouchableOpacity>
                      <Text style={styles.stepVal}>{groupSize}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          hapticTabSwitch();
                          setGroupSize(groupSize + 1);
                        }}
                        style={styles.stepBtn}
                      >
                        <IOSIcon name="plus" size={14} color={IOSColors.systemTeal} />
                      </TouchableOpacity>
                    </View>

                    {/* Quick Multi-Animal Presets */}
                    <View style={styles.quickPresetRow}>
                      {[1, 2, 3, 5, 8].map((preset) => (
                        <TouchableOpacity
                          key={preset}
                          style={[
                            styles.quickPresetPill,
                            groupSize === preset && styles.quickPresetPillActive,
                          ]}
                          onPress={() => {
                            hapticTabSwitch();
                            setGroupSize(preset);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.quickPresetPillText,
                              groupSize === preset && styles.quickPresetPillTextActive,
                            ]}
                          >
                            {preset}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Scientific Distance Sampling & Compass Bearing Georeferencing */}
                <BearingDistanceInput
                  distanceMeters={parseFloat(distanceFromPathM) || 5}
                  onDistanceChange={(d) => setDistanceFromPathM(d.toString())}
                  bearingDeg={sightingBearing}
                  onBearingChange={setSightingBearing}
                  perpendicularDistanceM={parseFloat(distanceFromPathM) || 5}
                  species={sightingSpecies}
                />

                {/* Body Condition Score (BCS 1 to 5) */}
                <View style={{ marginBottom: 14 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <Text style={styles.fieldLabel}>
                      {t('ui_structuredSurvey.body_condition_score_bcs')}
                    </Text>
                    <Text style={styles.groupSizeHint}>
                      {bodyConditionScore === 1
                        ? t('ui_structuredSurvey.1_emaciated')
                        : bodyConditionScore === 2
                          ? t('ui_structuredSurvey.2_underweight')
                          : bodyConditionScore === 3
                            ? t('ui_structuredSurvey.3_ideal_normal')
                            : bodyConditionScore === 4
                              ? t('ui_structuredSurvey.4_overweight')
                              : t('ui_structuredSurvey.5_obese')}
                    </Text>
                  </View>
                  <View style={styles.quickPresetRow}>
                    {[1, 2, 3, 4, 5].map((bcs) => (
                      <TouchableOpacity
                        key={bcs}
                        style={[
                          styles.quickPresetPill,
                          bodyConditionScore === bcs && styles.quickPresetPillActive,
                        ]}
                        onPress={() => {
                          hapticTabSwitch();
                          setBodyConditionScore(bcs);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.quickPresetPillText,
                            bodyConditionScore === bcs && styles.quickPresetPillTextActive,
                          ]}
                        >
                          {t('ui_structuredSurvey.bcs', { bcs })}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Known Animals Nearby Candidate Link */}
                {nearbyCandidates.length > 0 ? (
                  <TouchableOpacity
                    style={styles.matchCandidateRow}
                    onPress={() => {
                      hapticButtonPress();
                      setShowMatcherModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <IOSIcon name="paw" size={16} color={IOSColors.systemTeal} />
                    <Text style={styles.matchCandidateText} numberOfLines={1}>
                      {t('ui_structuredSurvey.nearby_known_compare', {
                        length: nearbyCandidates.length,
                        v3: sightingSpecies === 'cat' ? 'Cats' : 'Dogs',
                      })}
                    </Text>
                    <IOSIcon name="chevronRight" size={14} color={IOSColors.secondaryLabel} />
                  </TouchableOpacity>
                ) : null}

                {/* In-Survey Photo Capture Section */}
                <View style={styles.photoCaptureSection}>
                  <View style={styles.photoCaptureHeader}>
                    <Text style={styles.fieldLabel}>
                      {groupSize > 1
                        ? t('ui_structuredSurvey.group_photos_attached', {
                            v0: attachedPhotos.length,
                          })
                        : t('ui_structuredSurvey.identification_photo')}
                    </Text>
                    {attachedPhotos.length > 0 ? (
                      <TouchableOpacity onPress={() => setAttachedPhotos([])}>
                        <Text style={styles.removePhotoText}>
                          {t('ui_structuredSurvey.clear_all')}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {attachedPhotos.length > 0 ? (
                    <View style={{ marginTop: 8 }}>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
                      >
                        {attachedPhotos.map((uri, idx) => (
                          <View key={`${uri}-${idx}`} style={styles.photoThumbContainer}>
                            <Image source={{ uri }} style={styles.photoThumbnail} />
                            <View style={styles.photoThumbBadge}>
                              <Text style={styles.photoThumbBadgeText}>
                                {groupSize > 1
                                  ? `${sightingSpecies === 'cat' ? 'Cat' : 'Dog'} #${idx + 1}`
                                  : t('ui_structuredSurvey.id_photo')}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => handleRemovePhoto(idx)}
                              style={styles.photoRemoveBtn}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <IOSIcon name="xmark" size={10} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        ))}

                        <TouchableOpacity
                          onPress={handleAddInSurveyPhoto}
                          style={styles.addMorePhotoBtn}
                        >
                          <IOSIcon name="plus" size={18} color={IOSColors.systemTeal} />
                          <Text style={styles.addMorePhotoText}>
                            {groupSize > 1
                              ? t('ui_structuredSurvey.add_animal')
                              : t('ui_structuredSurvey.add_photo')}
                          </Text>
                        </TouchableOpacity>
                      </ScrollView>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={handleAddInSurveyPhoto} style={styles.addPhotoBtn}>
                      <IOSIcon name="camera" size={18} color={IOSColors.systemTeal} />
                      <Text style={styles.addPhotoBtnText} numberOfLines={1}>
                        {groupSize > 1
                          ? t('ui_structuredSurvey.take_group_photos')
                          : t('ui_structuredSurvey.take_identification_photo')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Field Notes */}
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.fieldLabel}>{t('animal.notes')}</Text>
                  <TextInput
                    style={[styles.textInput, { height: 50, textAlignVertical: 'top' }]}
                    value={detectionNotes}
                    onChangeText={setDetectionNotes}
                    placeholder={t('ui_structuredSurvey.colour_collar_ear_tip_or_behavior')}
                  />
                </View>

                {/* Welfare Alert Trigger */}
                <TouchableOpacity
                  style={styles.welfareTriggerRow}
                  onPress={() => {
                    hapticButtonPress();
                    setShowWelfareModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <IOSIcon name="shield" size={16} color={IOSColors.systemRed} />
                  <Text style={styles.welfareTriggerText} numberOfLines={1}>
                    {t('ui_structuredSurvey.report_injured_or_distressed_animal')}
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Sticky Fixed Bottom Actions */}
              <View style={styles.sheetFixedFooter}>
                <View style={styles.sheetBtnRow}>
                  <View style={{ flex: 1 }}>
                    <IOSButton
                      title={t('common.cancel')}
                      variant="secondary"
                      onPress={handleCloseObservationModal}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <IOSButton
                      title={
                        editingDetection ? t('common.save') : t('ui_structuredSurvey.log_detection')
                      }
                      onPress={handleSaveDetection}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* 300m Spatial Candidate Matcher Modal */}
        <AnimalMatcherModal
          visible={showMatcherModal}
          species={sightingSpecies}
          candidates={nearbyCandidates}
          onSelectNew={() => {
            hapticButtonPress();
            setShowMatcherModal(false);
            showToast('Logging as new individual');
          }}
          onSelectExisting={(animal) => {
            hapticButtonPress();
            setShowMatcherModal(false);
            setDetectionNotes((prev) =>
              prev ? `${prev} (Matched: ${animal.nickname})` : `Matched: ${animal.nickname}`
            );
            showToast(`Linked to ${animal.nickname}`);
          }}
          onSelectUnsure={() => {
            hapticButtonPress();
            setShowMatcherModal(false);
            setDetectionNotes((prev) =>
              prev ? `${prev} (Candidate match unsure)` : `Candidate match unsure`
            );
          }}
          onClose={() => {
            hapticModalClose();
            setShowMatcherModal(false);
          }}
        />

        {/* Emergency Welfare Triage Alert Modal */}
        <WelfareAlertModal
          visible={showWelfareModal}
          species={sightingSpecies}
          latitude={currentLat}
          longitude={currentLon}
          onSubmitAlert={(data) => {
            hapticSuccess();
            useGamificationStore
              .getState()
              .awardXp(10, 'Submitted Welfare Alert for Distressed Animal');
            showToast('Priority Welfare Alert recorded');
          }}
          onClose={() => {
            hapticModalClose();
            setShowWelfareModal(false);
          }}
        />

        {/* Fixed Route Picker & "Adopt a Route" Catalog Modal */}
        <RoutePickerModal
          visible={showRoutePicker}
          selectedRouteId={selectedRouteObj?.id || null}
          onSelectRoute={(route) => setSelectedRouteObj(route)}
          onClose={() => {
            hapticModalClose();
            setShowRoutePicker(false);
          }}
        />

        {/* Post-Survey Workout Debrief Summary Card (Apple Fitness Style) */}
        {summaryData && (
          <SurveySummaryModal
            visible={showSummaryModal}
            data={summaryData}
            onConfirmAndClose={handleFinalizeFromSummary}
          />
        )}

        {/* Colony & Managed Feeding Station Dossier Inspector Modal */}
        <ColonyInspectorModal
          visible={!!selectedColony}
          colony={selectedColony}
          onClose={() => {
            hapticModalClose();
            setSelectedColony(null);
          }}
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  offRouteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  offRouteBannerText: {
    ...IOSTypography.caption1,
    fontWeight: '700',
    color: '#991B1B',
    flex: 1,
  },
  outerContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#F7F6F2',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingBottom: 110,
  },
  overlappingSheet: {
    marginTop: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: 'transparent',
    paddingTop: 14,
    zIndex: 20,
  },
  activeScrollContent: {
    paddingVertical: 12,
    paddingBottom: 120,
  },
  protocolSelectionContainer: {
    padding: 12,
    gap: 10,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
  },
  protocolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  protocolCardActive: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  protocolCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  protocolIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  protocolIconCircleActive: {
    backgroundColor: '#E0F2FE',
  },
  protocolTextCol: {
    flex: 1,
    gap: 3,
  },
  protocolTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  protocolTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  protocolTitleActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  protocolBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  protocolBadgeActive: {
    backgroundColor: '#BAE6FD',
  },
  protocolBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  protocolBadgeTextActive: {
    color: '#0369A1',
  },
  protocolDescription: {
    fontSize: 12,
    lineHeight: 16,
    color: '#64748B',
  },
  protocolRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  protocolRadioActive: {
    borderColor: '#0284C7',
    backgroundColor: '#0284C7',
  },
  actionContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: IOSColors.systemGreen,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  toastText: {
    ...IOSTypography.caption1,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  metricsCard: {
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryMetricVal: {
    fontSize: 48,
    fontWeight: '800',
    color: IOSColors.systemTeal,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  primaryMetricLabel: {
    ...IOSTypography.caption1,
    fontWeight: '700',
    color: IOSColors.secondaryLabel,
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  secondaryMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
  },
  secondaryMetricBox: {
    flex: 1,
    alignItems: 'center',
  },
  secondaryMetricVal: {
    fontSize: 24,
    fontWeight: '800',
    color: IOSColors.label,
  },
  secondaryMetricLabel: {
    ...IOSTypography.caption2,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
  },
  secondaryMetricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: IOSColors.separator,
  },
  inSurveyActionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  detectionsSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  detectionsSectionHeader: {
    marginBottom: 8,
  },
  detectionsSectionTitle: {
    ...IOSTypography.subheadline,
    fontWeight: '700',
    color: IOSColors.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyDetectionsBox: {
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.12)',
  },
  emptyDetectionsText: {
    ...IOSTypography.caption1,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
  },
  detectionRowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.12)',
  },
  detectionMainCol: {
    flex: 1,
    gap: 4,
  },
  detectionTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detectionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  detectionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  detectionSpecies: {
    ...IOSTypography.headline,
  },
  distanceTag: {
    backgroundColor: IOSColors.systemGray6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  distanceTagText: {
    ...IOSTypography.caption2,
    fontWeight: '700',
    color: IOSColors.systemTeal,
  },
  bearingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  bearingTagText: {
    ...IOSTypography.caption2,
    fontWeight: '700',
    color: '#0284C7',
  },
  detectionCoordsLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detectionCoordsText: {
    ...IOSTypography.caption2,
    color: IOSColors.secondaryLabel,
    fontVariant: ['tabular-nums'],
  },
  photoAttachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(48, 176, 199, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  photoAttachedText: {
    fontSize: 10,
    fontWeight: '700',
    color: IOSColors.systemTeal,
  },
  detectionNotes: {
    ...IOSTypography.caption2,
    fontStyle: 'italic',
    color: IOSColors.secondaryLabel,
  },
  detectionActionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 12,
  },
  actionBtn: {
    padding: 6,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: IOSColors.systemBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOSColors.separator,
    backgroundColor: IOSColors.systemBackground,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  sheetTitle: {
    ...IOSTypography.headline,
    fontWeight: '700',
    color: IOSColors.label,
  },
  sheetCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: IOSColors.systemGray6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: {
    flexGrow: 1,
    flexShrink: 1,
  },
  sheetScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },
  sheetFixedFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
    backgroundColor: IOSColors.systemBackground,
  },
  fieldLabel: {
    ...IOSTypography.caption1,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: IOSColors.systemGray6,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stepBtn: {
    padding: 6,
  },
  stepVal: {
    ...IOSTypography.headline,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
  },
  groupSizeHint: {
    fontSize: 12,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
  },
  quickPresetRow: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
    justifyContent: 'flex-end',
  },
  quickPresetPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 28,
    alignItems: 'center',
  },
  quickPresetPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  quickPresetPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  quickPresetPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  identifierInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOSColors.systemGray6,
    borderRadius: 9,
    paddingHorizontal: 12,
    height: 44,
    gap: 10,
  },
  identifierTextInput: {
    flex: 1,
    fontSize: 15,
    color: IOSColors.label,
    padding: 0,
  },
  textInput: {
    backgroundColor: IOSColors.systemGray6,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: IOSColors.label,
  },
  distanceHelperText: {
    ...IOSTypography.caption2,
    color: IOSColors.secondaryLabel,
    marginTop: 6,
    marginBottom: 14,
  },
  photoCaptureSection: {
    backgroundColor: IOSColors.systemGray6,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  photoCaptureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  removePhotoText: {
    ...IOSTypography.caption2,
    fontWeight: '600',
    color: IOSColors.systemRed,
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: IOSColors.systemBackground,
    borderRadius: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(48, 176, 199, 0.4)',
    borderStyle: 'dashed',
  },
  addPhotoBtnText: {
    ...IOSTypography.subheadline,
    fontWeight: '600',
    color: IOSColors.systemTeal,
  },
  photoThumbContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: IOSColors.systemGray5,
    borderWidth: 1,
    borderColor: IOSColors.separator,
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoThumbBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 4,
    paddingVertical: 1,
    alignItems: 'center',
  },
  photoThumbBadgeText: {
    ...IOSTypography.caption2,
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMorePhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: IOSColors.systemTeal,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(48, 176, 199, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  addMorePhotoText: {
    ...IOSTypography.caption2,
    fontWeight: '700',
    color: IOSColors.systemTeal,
    textAlign: 'center',
  },
  photoAttachedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: IOSColors.systemBackground,
    borderRadius: 8,
    padding: 10,
  },
  photoAttachedTitle: {
    ...IOSTypography.subheadline,
    fontWeight: '600',
  },
  photoAttachedSub: {
    ...IOSTypography.caption2,
    color: IOSColors.secondaryLabel,
  },
  retakeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: IOSColors.systemGray6,
  },
  retakeBtnText: {
    ...IOSTypography.caption2,
    fontWeight: '700',
    color: IOSColors.systemTeal,
  },
  sheetBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: IOSColors.systemBackground,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  alertIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(48, 176, 199, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertTitle: {
    ...IOSTypography.headline,
    textAlign: 'center',
    marginBottom: 8,
  },
  alertMessage: {
    ...IOSTypography.footnote,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  alertBtnStack: {
    width: '100%',
    gap: 10,
  },
  cancelEndSurveyBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cancelEndSurveyText: {
    ...IOSTypography.subheadline,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
  },
  interactiveMapCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    overflow: 'hidden',
    height: 210,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.15)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  matchCandidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(8, 145, 178, 0.08)',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  matchCandidateText: {
    ...IOSTypography.caption2,
    fontWeight: '700',
    color: IOSColors.systemTeal,
    flex: 1,
  },
  welfareTriggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    marginBottom: 8,
  },
  welfareTriggerText: {
    ...IOSTypography.caption1,
    fontWeight: '700',
    color: IOSColors.systemRed,
  },
  preSurveyHeroContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
  },
  preSurveyNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  radarDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  preSurveyNoticeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  routeCarouselScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
  },
  routePreviewCard: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  routePreviewCardActive: {
    borderColor: IOSColors.systemIndigo,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
  },
  routeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  routeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routePillTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  routePillTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  routeCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: IOSColors.label,
    marginBottom: 2,
  },
  routeCardSub: {
    fontSize: 11,
    color: IOSColors.secondaryLabel,
    marginBottom: 8,
    lineHeight: 15,
  },
  routeMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  routeMetricVal: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  routeMetricDot: {
    fontSize: 10,
    color: '#94A3B8',
  },
  routeCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  routeFooterMetric: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  activeCheckPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D9F944',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeCheckText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0F172A',
  },
  guardianTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  guardianTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
  },
  browseAllCard: {
    width: 170,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  browseAllIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(8, 145, 178, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  browseAllTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: IOSColors.label,
    textAlign: 'center',
  },
  browseAllSub: {
    fontSize: 10,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
  },
  browseAllActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  browseAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: IOSColors.systemTeal,
  },
});
