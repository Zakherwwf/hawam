/**
 * Supabase Storage Service for Animal Field Photos
 * Hawem (حايم) Citizen-Science Platform
 *
 * Implements:
 * - Binary photo uploads to Supabase Storage ('animal-photos' bucket)
 * - Standardized storage path generation: observations/{observation_id}/{photo_id}.jpg
 * - Offline-first resilience: preserves local URI on network/bucket error
 * - Private bucket: cloud photos are read through short-lived signed URLs
 * - Fails closed on privacy: a photo that cannot be re-encoded, or whose bytes
 *   still carry an EXIF GPS block, is never uploaded
 */

import { supabase } from './supabase.ts';
import { processAndScrubPhoto, jpegContainsGpsExif } from './exifScrubber.ts';

export const ANIMAL_PHOTOS_BUCKET = 'animal-photos';
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

export interface UploadPhotoResult {
  success: boolean;
  storagePath: string;
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
 * True for URIs the UI can display directly (web, device file, data URI).
 */
function isDirectlyDisplayable(uri: string): boolean {
  return (
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('ph://') ||
    uri.startsWith('data:')
  );
}

/**
 * Resolves a local URI synchronously. Bucket paths return '' because the
 * bucket is private; use resolveAnimalPhotoUrl for those.
 */
export function getAnimalPhotoUrl(storagePath?: string | null): string {
  if (!storagePath) return '';
  return isDirectlyDisplayable(storagePath) ? storagePath : '';
}

/**
 * Resolves a storage path or local URI to a displayable URL. Bucket paths get
 * a short-lived signed URL; RLS decides whether the caller may read the object.
 */
export async function resolveAnimalPhotoUrl(
  storagePath?: string | null,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS
): Promise<string> {
  if (!storagePath) return '';
  if (isDirectlyDisplayable(storagePath)) return storagePath;

  try {
    const { data, error } = await supabase.storage
      .from(ANIMAL_PHOTOS_BUCKET)
      .createSignedUrl(storagePath, ttlSeconds);
    if (error || !data?.signedUrl) return '';
    return data.signedUrl;
  } catch {
    return '';
  }
}

/**
 * Uploads a local photo to the private Supabase Storage bucket ('animal-photos')
 */
export async function uploadAnimalPhoto(
  localUri: string,
  observationId: string,
  photoId: string
): Promise<UploadPhotoResult> {
  const targetPath = buildStoragePath(observationId, photoId);

  // Already uploaded to cloud
  if (
    localUri.startsWith('http://') ||
    localUri.startsWith('https://') ||
    localUri.startsWith('observations/')
  ) {
    return { success: true, storagePath: localUri };
  }

  try {
    let uploadBody: ArrayBuffer | FormData | Uint8Array;
    let contentType = 'image/jpeg';

    if (localUri.startsWith('data:image/')) {
      const mimeMatch = localUri.match(/^data:(image\/[a-zA-Z+]+);base64,/);
      if (mimeMatch) contentType = mimeMatch[1];
      // Base64 photos cannot be re-encoded here; verify the bytes instead
      const bytes = base64ToUint8Array(localUri);
      if (jpegContainsGpsExif(bytes)) {
        return {
          success: false,
          storagePath: localUri,
          error: 'Photo still contains GPS metadata; upload blocked',
        };
      }
      uploadBody = bytes;
    } else {
      // Re-encode to strip EXIF. Throws rather than returning the raw file.
      let scrubbedUri: string;
      try {
        scrubbedUri = (await processAndScrubPhoto(localUri)).cleanedUri;
      } catch (scrubErr: any) {
        return {
          success: false,
          storagePath: localUri, // Keep the local file so the outbox retries later
          error: scrubErr?.message || 'Photo could not be stripped of metadata',
        };
      }

      let bytes: Uint8Array | null = null;
      try {
        const response = await fetch(scrubbedUri);
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer && arrayBuffer.byteLength > 0) {
          bytes = new Uint8Array(arrayBuffer);
        }
      } catch {
        bytes = null;
      }

      if (bytes) {
        if (jpegContainsGpsExif(bytes)) {
          return {
            success: false,
            storagePath: localUri,
            error: 'Photo still contains GPS metadata; upload blocked',
          };
        }
        uploadBody = bytes;
      } else {
        // Some RN runtimes cannot read file:// into an ArrayBuffer. The file
        // was re-encoded above, so upload it through FormData.
        const formData = new FormData();
        formData.append('file', {
          uri: scrubbedUri,
          name: `${photoId}.jpg`,
          type: contentType,
        } as any);
        uploadBody = formData;
      }
    }

    const { error } = await supabase.storage
      .from(ANIMAL_PHOTOS_BUCKET)
      .upload(targetPath, uploadBody as any, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.warn(`[storageService] Upload failed for ${targetPath}:`, error.message);
      return {
        success: false,
        storagePath: localUri, // Preserve local URI so observation is not lost
        error: error.message,
      };
    }

    return { success: true, storagePath: targetPath };
  } catch (err: any) {
    console.warn(`[storageService] Exception during photo upload:`, err);
    return {
      success: false,
      storagePath: localUri,
      error: err?.message || 'Storage upload error',
    };
  }
}
