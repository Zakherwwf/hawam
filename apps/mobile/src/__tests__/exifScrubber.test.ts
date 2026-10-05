import test from 'node:test';
import assert from 'node:assert/strict';
import { jpegContainsGpsExif, processAndScrubPhoto, PhotoScrubError } from '../services/exifScrubber.ts';

// Minimal JPEG: SOI, APP1 Exif with a one-entry IFD0, SOS, EOI
function buildJpegWithIfd0Tag(tag: number, littleEndian: boolean): Uint8Array {
  const tiff: number[] = littleEndian
    ? [0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]
    : [0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08];
  const u16 = (v: number) => (littleEndian ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) =>
    littleEndian
      ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff]
      : [(v >>> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
  const ifd = [...u16(1), ...u16(tag), ...u16(4), ...u32(1), ...u32(26), ...u32(0)];
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff, ...ifd];
  const len = payload.length + 2;
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe1, len >> 8, len & 0xff, ...payload,
    0xff, 0xda, 0x00, 0x02,
    0xff, 0xd9,
  ]);
}

test('exifScrubber: detects GPSInfo pointer in little-endian EXIF', () => {
  assert.equal(jpegContainsGpsExif(buildJpegWithIfd0Tag(0x8825, true)), true);
});

test('exifScrubber: detects GPSInfo pointer in big-endian EXIF', () => {
  assert.equal(jpegContainsGpsExif(buildJpegWithIfd0Tag(0x8825, false)), true);
});

test('exifScrubber: EXIF without GPS (e.g. Orientation only) passes', () => {
  assert.equal(jpegContainsGpsExif(buildJpegWithIfd0Tag(0x0112, true)), false);
});

test('exifScrubber: JPEG with no APP1 segment passes', () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);
  assert.equal(jpegContainsGpsExif(bytes), false);
});

test('exifScrubber: non-JPEG and truncated input do not throw', () => {
  assert.equal(jpegContainsGpsExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), false);
  assert.equal(jpegContainsGpsExif(buildJpegWithIfd0Tag(0x8825, true).slice(0, 20)), false);
  assert.equal(jpegContainsGpsExif(new Uint8Array()), false);
});

test('exifScrubber: processAndScrubPhoto fails closed when the re-encoder is unavailable', async () => {
  await assert.rejects(() => processAndScrubPhoto('file:///tmp/raw.jpg'), PhotoScrubError);
});
