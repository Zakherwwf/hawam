import test from 'node:test';
import assert from 'node:assert/strict';
import {
  base64ToUint8Array,
  buildStoragePath,
  getAnimalPhotoUrl,
  resolveAnimalPhotoUrl,
  uploadAnimalPhoto,
  ANIMAL_PHOTOS_BUCKET,
} from '../services/storageService.ts';

test('storageService: base64ToUint8Array decodes standard base64 correctly', () => {
  // 'Hello' in base64 is 'SGVsbG8='
  const base64Str = 'SGVsbG8=';
  const bytes = base64ToUint8Array(base64Str);

  assert.equal(bytes.length, 5);
  assert.equal(bytes[0], 72); // 'H'
  assert.equal(bytes[1], 101); // 'e'
  assert.equal(bytes[2], 108); // 'l'
  assert.equal(bytes[3], 108); // 'l'
  assert.equal(bytes[4], 111); // 'o'
});

test('storageService: base64ToUint8Array strips data URL prefix safely', () => {
  const dataUrl = 'data:image/jpeg;base64,SGVsbG8=';
  const bytes = base64ToUint8Array(dataUrl);

  assert.equal(bytes.length, 5);
  assert.equal(bytes[0], 72);
});

test('storageService: buildStoragePath constructs clean, sanitized S3 keys', () => {
  const obsId = 'obs-cat-101-uuid';
  const photoId = 'photo-left-flank-01';
  const path = buildStoragePath(obsId, photoId);

  assert.equal(path, 'observations/obs-cat-101-uuid/photo-left-flank-01.jpg');
});

test('storageService: buildStoragePath strips unsafe path traversal characters', () => {
  const obsId = '../../../etc/passwd';
  const photoId = 'test/photo#1';
  const path = buildStoragePath(obsId, photoId);

  assert.equal(path, 'observations/etcpasswd/testphoto1.jpg');
});

test('storageService: getAnimalPhotoUrl preserves existing web and local URIs', () => {
  assert.equal(getAnimalPhotoUrl(''), '');
  assert.equal(
    getAnimalPhotoUrl('https://example.com/cat.jpg'),
    'https://example.com/cat.jpg'
  );
  assert.equal(
    getAnimalPhotoUrl('file:///var/mobile/Containers/Data/temp.jpg'),
    'file:///var/mobile/Containers/Data/temp.jpg'
  );
  assert.equal(
    getAnimalPhotoUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg=='),
    'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
  );
});

test('storageService: getAnimalPhotoUrl never builds a public URL for private bucket paths', () => {
  assert.equal(getAnimalPhotoUrl('observations/obs-1/photo-1.jpg'), '');
});

test('storageService: resolveAnimalPhotoUrl passes local URIs through without a network call', async () => {
  assert.equal(await resolveAnimalPhotoUrl('file:///tmp/cat.jpg'), 'file:///tmp/cat.jpg');
  assert.equal(await resolveAnimalPhotoUrl(null), '');
});

test('storageService: uploadAnimalPhoto returns immediately for already uploaded cloud paths', async () => {
  const result = await uploadAnimalPhoto(
    'observations/obs-100/photo-200.jpg',
    'obs-100',
    'photo-200'
  );

  assert.equal(result.success, true);
  assert.equal(result.storagePath, 'observations/obs-100/photo-200.jpg');
});

test('storageService: uploadAnimalPhoto refuses a device photo it cannot re-encode', async () => {
  // No native image manipulator under Node, so scrubbing fails and must block the upload
  const result = await uploadAnimalPhoto('file:///tmp/raw-with-gps.jpg', 'obs-1', 'photo-1');

  assert.equal(result.success, false);
  assert.equal(result.storagePath, 'file:///tmp/raw-with-gps.jpg');
});
