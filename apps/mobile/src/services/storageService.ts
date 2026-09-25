/**
 * Supabase Storage Service for Animal Field Photos
 * Hawem (حايم) Citizen-Science Platform
 *
 * Implements:
 * - Binary photo uploads to Supabase Storage ('animal-photos' bucket)
 * - Standardized storage path generation: observations/{observation_id}/{photo_id}.jpg
 * - Offline-first resilience: preserves local URI on network/bucket error
 * - Public URL resolution for dashboards and UI image views
 */

import { supabase } from './supabase.ts';
import { processAndScrubPhoto } from './exifScrubber.ts';

export const ANIMAL_PHOTOS_BUCKET = 'animal-photos';

export interface UploadPhotoResult {
  success: boolean;
  storagePath: string;
  publicUrl?: string;
  error?: string;
}

/**
 * Converts a base64 string to a Uint8Array byte buffer
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
  const binaryStr =
    typeof atob === 'function'
      ? atob(clean)
      : typeof (globalThis as any).Buffer !== 'undefined'
      ? (globalThis as any).Buffer.from(clean, 'base64').toString('binary')
      : clean;
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * Constructs a standardized, unique storage object path
 */
export function buildStoragePath(observationId: string, photoId: string): string {
  const cleanObsId = observationId.replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanPhotoId = photoId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `observations/${cleanObsId}/${cleanPhotoId}.jpg`;
}

/**
 * Resolves a storage path or local URI to a displayable URL
 */
export function getAnimalPhotoUrl(storagePath?: string | null): string {
  if (!storagePath) return '';

  // Return directly if already a full web URL, local file, or data URI
  if (
    storagePath.startsWith('http://') ||
    storagePath.startsWith('https://') ||
    storagePath.startsWith('file://') ||
    storagePath.startsWith('content://') ||
    storagePath.startsWith('ph://') ||
    storagePath.startsWith('data:')
  ) {
    return storagePath;
  }

  // Resolve cloud storage bucket path to public CDN URL
  try {
    const { data } = supabase.storage
      .from(ANIMAL_PHOTOS_BUCKET)
      .getPublicUrl(storagePath);
    return data?.publicUrl || storagePath;
  } catch (e) {
    return storagePath;
  }
}

/**
 * Uploads a local photo to the Supabase Storage bucket ('animal-photos')
 */
export async function uploadAnimalPhoto(
  localUri: string,
  observationId: string,
  photoId: string
): Promise<UploadPhotoResult> {
  const targetPath = buildStoragePath(observationId, photoId);

  // If already uploaded to cloud
  if (
    localUri.startsWith('http://') ||
    localUri.startsWith('https://') ||
    localUri.startsWith('observations/')
  ) {
    return {
      success: true,
      storagePath: localUri,
      publicUrl: getAnimalPhotoUrl(localUri),
    };
  }

  try {
    let uploadBody: ArrayBuffer | FormData | Uint8Array;
    let contentType = 'image/jpeg';

    let activeUri = localUri;
    if (localUri.startsWith('data:image/')) {
      const mimeMatch = localUri.match(/^data:(image\/[a-zA-Z+]+);base64,/);
      if (mimeMatch) contentType = mimeMatch[1];
      uploadBody = base64ToUint8Array(localUri);
    } else {
      // Local filesystem URI: Strip EXIF metadata and resize before uploading
      try {
        const scrubbed = await processAndScrubPhoto(localUri);
        activeUri = scrubbed.cleanedUri;
      } catch (scrubErr) {
        console.warn('[storageService] EXIF scrub exception, continuing with localUri:', scrubErr);
      }

      try {
        const response = await fetch(activeUri);
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer && arrayBuffer.byteLength > 0) {
          uploadBody = arrayBuffer;
        } else {
          throw new Error('Empty arrayBuffer from local URI');
        }
      } catch (fetchErr) {
        // Fallback: React Native FormData
        const formData = new FormData();
        formData.append('file', {
          uri: activeUri,
          name: `${photoId}.jpg`,
          type: contentType,
        } as any);
        uploadBody = formData;
      }
    }

    const { data, error } = await supabase.storage
      .from(ANIMAL_PHOTOS_BUCKET)
      .upload(targetPath, uploadBody as any, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.warn(
        `[storageService] Upload failed for ${targetPath}:`,
        error.message
      );
      return {
        success: false,
        storagePath: localUri, // Preserve local URI so observation is not lost
        error: error.message,
      };
    }

    const publicUrl = supabase.storage
      .from(ANIMAL_PHOTOS_BUCKET)
      .getPublicUrl(targetPath).data.publicUrl;

    return {
      success: true,
      storagePath: targetPath,
      publicUrl,
    };
  } catch (err: any) {
    console.warn(`[storageService] Exception during photo upload:`, err);
    return {
      success: false,
      storagePath: localUri,
      error: err?.message || 'Storage upload error',
    };
  }
}
