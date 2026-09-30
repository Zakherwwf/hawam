/**
 * Background Location Tracking Engine for Hawem
 * Powered by expo-location and expo-task-manager.
 * Ensures continuous transect track recording while the screen is locked or app is backgrounded.
 */

import { AppState } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useSurveyStore } from '../../features/survey/surveyStore.ts';

export const HAWEM_BACKGROUND_LOCATION_TASK = 'HAWEM_BACKGROUND_LOCATION_TASK';

// Define the background task handler
try {
  TaskManager.defineTask(HAWEM_BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
    if (error) {
      console.warn('[backgroundLocation] Task error:', error);
      return;
    }

    if (data && data.locations && Array.isArray(data.locations)) {
      const store = useSurveyStore.getState();
      if (store.status !== 'recording') return;
      // While the app is open the walk screen's own watcher records the
      // track; taking both would count every metre twice
      if (AppState.currentState === 'active') return;

      for (const loc of data.locations) {
        if (!loc || !loc.coords) continue;
        const { latitude, longitude, accuracy, speed, heading } = loc.coords;
        const isMocked = Boolean((loc as any).mocked || (loc.coords as any).mocked);

        store.addTrackPoint(latitude, longitude, accuracy, speed, isMocked);
        store.updateLocation(latitude, longitude, accuracy, heading);
      }
    }
  });
} catch (err) {
  console.warn('[backgroundLocation] Could not define TaskManager task:', err);
}

export async function requestLocationPermissions(): Promise<{
  foregroundGranted: boolean;
  backgroundGranted: boolean;
}> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      return { foregroundGranted: false, backgroundGranted: false };
    }

    const bg = await Location.requestBackgroundPermissionsAsync();
    return {
      foregroundGranted: true,
      backgroundGranted: bg.status === 'granted',
    };
  } catch (err) {
    console.warn('[backgroundLocation] Error requesting permissions:', err);
    return { foregroundGranted: false, backgroundGranted: false };
  }
}

export async function startBackgroundLocationTracking(): Promise<boolean> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(HAWEM_BACKGROUND_LOCATION_TASK);
    if (!isRegistered) {
      console.warn('[backgroundLocation] Task not registered, skipping');
      return false;
    }

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(
      HAWEM_BACKGROUND_LOCATION_TASK
    );
    if (hasStarted) {
      return true;
    }

    await Location.startLocationUpdatesAsync(HAWEM_BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 2000,
      distanceInterval: 3,
      deferredUpdatesInterval: 2000,
      deferredUpdatesDistance: 3,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Hawem Survey Active',
        notificationBody: 'Recording scientific GPS transect track...',
        notificationColor: '#0F172A',
      },
    });

    return true;
  } catch (err) {
    console.warn('[backgroundLocation] Failed to start location updates:', err);
    return false;
  }
}

export async function stopBackgroundLocationTracking(): Promise<void> {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(
      HAWEM_BACKGROUND_LOCATION_TASK
    );
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(HAWEM_BACKGROUND_LOCATION_TASK);
    }
  } catch (err) {
    console.warn('[backgroundLocation] Failed to stop location updates:', err);
  }
}
