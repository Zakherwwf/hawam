import i18n from '../i18n';
/**
 * Camera & Photo Capture Service
 * Hawem (حايم) Citizen-Science Platform
 *
 * Implements:
 * - Real hardware camera capture via expo-image-picker (launchCameraAsync)
 * - Photo library selection for existing field photos (launchImageLibraryAsync)
 * - Permission checks & user prompts
 * - Base64 extraction for Gemini Multimodal Vision analysis
 */

import * as ImagePicker from 'expo-image-picker';
import { Alert, ActionSheetIOS, Platform } from 'react-native';

export interface PhotoCaptureResult {
  uri: string;
  base64?: string | null;
  width?: number;
  height?: number;
  fileName?: string | null;
}

/**
 * Checks and requests camera hardware permission
 */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Hawem requires camera access to document animal sightings and perform AI identification.'
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Error requesting camera permission:', error);
    return false;
  }
}

/**
 * Checks and requests photo library read permission
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photo Library Permission Required',
        'Hawem requires photo library access to import field photos.'
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Error requesting media library permission:', error);
    return false;
  }
}

/**
 * Launches the native camera and returns the captured photo
 */
export async function capturePhotoFromCamera(options?: {
  quality?: number;
  base64?: boolean;
}): Promise<PhotoCaptureResult | null> {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) return null;

  try {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: options?.quality ?? 0.8,
      base64: options?.base64 ?? true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      base64: asset.base64 || null,
      width: asset.width,
      height: asset.height,
      fileName: asset.fileName || `animal_${Date.now()}.jpg`,
    };
  } catch (error) {
    console.error('Failed to capture photo with camera:', error);
    Alert.alert(
      i18n.t('ui_cameraService.camera_error'),
      i18n.t('ui_cameraService.camera_error_body')
    );
    return null;
  }
}

/**
 * Launches the photo gallery and returns the selected photo
 */
export async function pickPhotoFromLibrary(options?: {
  quality?: number;
  base64?: boolean;
}): Promise<PhotoCaptureResult | null> {
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) return null;

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: options?.quality ?? 0.8,
      base64: options?.base64 ?? true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      base64: asset.base64 || null,
      width: asset.width,
      height: asset.height,
      fileName: asset.fileName || `animal_${Date.now()}.jpg`,
    };
  } catch (error) {
    console.error('Failed to pick photo from library:', error);
    return null;
  }
}

/**
 * Prompts the surveyor with native dialog options:
 * 1. Take Photo with Camera
 * 2. Choose from Photo Library
 */
export function promptPhotoCaptureChoice(
  title: string = 'Add Animal Photo',
  message: string = 'Capture a clear photo of the cat or dog in the field.'
): Promise<PhotoCaptureResult | null> {
  return new Promise((resolve) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          message,
          options: [
            i18n.t('ui_cameraService.cancel'),
            i18n.t('ui_cameraService.take_photo_with_camera'),
            i18n.t('ui_cameraService.choose_from_photo_library'),
          ],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            const photo = await capturePhotoFromCamera();
            resolve(photo);
          } else if (buttonIndex === 2) {
            const photo = await pickPhotoFromLibrary();
            resolve(photo);
          } else {
            resolve(null);
          }
        }
      );
    } else {
      Alert.alert(title, message, [
        {
          text: i18n.t('ui_cameraService.cancel'),
          style: 'cancel',
          onPress: () => resolve(null),
        },
        {
          text: i18n.t('ui_cameraService.camera'),
          onPress: async () => {
            const photo = await capturePhotoFromCamera();
            resolve(photo);
          },
        },
        {
          text: i18n.t('ui_cameraService.gallery'),
          onPress: async () => {
            const photo = await pickPhotoFromLibrary();
            resolve(photo);
          },
        },
      ]);
    }
  });
}
