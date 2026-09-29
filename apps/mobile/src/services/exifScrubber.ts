/**
 * EXIF Scrubber and Image Optimizer.
 *
 * Requirements:
 * 1. Strips all personal EXIF metadata (camera serial number, device owner, user notes).
 * 2. Extracts GPS coordinates to pass to the observation record before stripping.
 * 3. Compresses image while maintaining pattern matching resolution (longest side >= 1600 px).
 */

export interface ProcessedPhotoResult {
  cleanedUri: string;
  extractedGps?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  width: number;
  height: number;
}

export class PhotoScrubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhotoScrubError';
  }
}

/**
 * Re-encodes the photo via expo-image-manipulator, which drops every EXIF block
 * (GPS included) and caps the width at 1600 px for sync over poor networks.
 *
 * Fails closed: if the photo cannot be re-encoded this throws PhotoScrubError
 * instead of handing back the original file, so a raw photo with its GPS tags
 * can never reach the upload path.
 */
export async function processAndScrubPhoto(
  rawPhotoUri: string,
  deviceGpsFallback?: { latitude: number; longitude: number; accuracy: number }
): Promise<ProcessedPhotoResult> {
  let ImageManipulator: typeof import('expo-image-manipulator');
  try {
    ImageManipulator = await import('expo-image-manipulator');
  } catch {
    throw new PhotoScrubError('Image re-encoder unavailable');
  }
  if (!ImageManipulator?.manipulateAsync) {
    throw new PhotoScrubError('Image re-encoder unavailable');
  }

  try {
    const result = await ImageManipulator.manipulateAsync(
      rawPhotoUri,
      [{ resize: { width: 1600 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );
    return {
      cleanedUri: result.uri,
      extractedGps: deviceGpsFallback,
      width: result.width,
      height: result.height,
    };
  } catch (err: any) {
    throw new PhotoScrubError(`Photo re-encode failed: ${err?.message || 'unknown error'}`);
  }
}

/**
 * Returns true if the JPEG bytes carry an EXIF GPS block: an APP1 "Exif"
 * segment whose IFD0 contains the GPSInfo pointer (tag 0x8825).
 * Used as the last gate before upload so the privacy invariant is enforced
 * on the actual bytes, not on the assumption that re-encoding worked.
 */
export function jpegContainsGpsExif(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return false;
    const marker = bytes[offset + 1];
    // Start of scan or end of image: no more metadata segments
    if (marker === 0xda || marker === 0xd9) return false;
    // Standalone markers carry no length
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (segLen < 2) return false;
    const segStart = offset + 4;
    const segEnd = Math.min(bytes.length, offset + 2 + segLen);

    if (
      marker === 0xe1 &&
      segEnd - segStart >= 14 &&
      bytes[segStart] === 0x45 && // E
      bytes[segStart + 1] === 0x78 && // x
      bytes[segStart + 2] === 0x69 && // i
      bytes[segStart + 3] === 0x66 && // f
      bytes[segStart + 4] === 0 &&
      bytes[segStart + 5] === 0 &&
      tiffIfd0HasGpsPointer(bytes, segStart + 6, segEnd)
    ) {
      return true;
    }
    offset += 2 + segLen;
  }
  return false;
}

function tiffIfd0HasGpsPointer(bytes: Uint8Array, tiffStart: number, end: number): boolean {
  const little = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49;
  const big = bytes[tiffStart] === 0x4d && bytes[tiffStart + 1] === 0x4d;
  if (!little && !big) return false;

  const u16 = (at: number) =>
    little ? bytes[at] | (bytes[at + 1] << 8) : (bytes[at] << 8) | bytes[at + 1];
  const u32 = (at: number) =>
    little
      ? (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0
      : ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;

  const ifd0 = tiffStart + u32(tiffStart + 4);
  if (ifd0 + 2 > end) return false;
  const entries = u16(ifd0);
  for (let i = 0; i < entries; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > end) return false;
    if (u16(entry) === 0x8825) return true;
  }
  return false;
}

/**
 * Validates photo quality for individual re-identification.
 * Flags images that are too dark or likely blurry.
 */
export function checkPhotoQuality(
  brightnessEstimate: number, // 0 (black) to 255 (white)
  focusEstimate: number // sharpness score
): { isAcceptable: boolean; warningKey?: 'photo.quality_warning_dark' | 'photo.quality_warning_blur' } {
  if (brightnessEstimate < 40) {
    return { isAcceptable: false, warningKey: 'photo.quality_warning_dark' };
  }
  if (focusEstimate < 30) {
    return { isAcceptable: false, warningKey: 'photo.quality_warning_blur' };
  }
  return { isAcceptable: true };
}
