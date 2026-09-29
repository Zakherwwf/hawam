import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isBucketPath,
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
  const userId = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const path = buildStoragePath(userId, 'obs-cat-101-uuid', 'photo-left-flank-01');

  // First folder must be the uploader's user id (animal-photos bucket policy)
  assert.equal(
    path,
    '0f8fad5b-d9cb-469f-a165-70867728950e/obs-cat-101-uuid/photo-left-flank-01.jpg'
  );
});

test('storageService: buildStoragePath strips unsafe path traversal characters', () => {
  const path = buildStoragePath('../user', '../../../etc/passwd', 'test/photo#1');

  assert.equal(path, 'user/etcpasswd/testphoto1.jpg');
});

test('storageService: getAnimalPhotoUrl preserves existing web and local URIs', () => {
  assert.equal(getAnimalPhotoUrl(''), '');
  assert.equal(getAnimalPhotoUrl('https://example.com/cat.jpg'), 'https://example.com/cat.jpg');
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
  assert.equal(getAnimalPhotoUrl('0f8fad5b-d9cb-469f-a165-70867728950e/obs-1/photo-1.jpg'), '');
});

test('storageService: resolveAnimalPhotoUrl passes local URIs through without a network call', async () => {
  assert.equal(await resolveAnimalPhotoUrl('file:///tmp/cat.jpg'), 'file:///tmp/cat.jpg');
  assert.equal(await resolveAnimalPhotoUrl(null), '');
});

test('storageService: uploadAnimalPhoto returns immediately for already uploaded cloud paths', async () => {
  const result = await uploadAnimalPhoto(
    '0f8fad5b-d9cb-469f-a165-70867728950e/obs-100/photo-200.jpg',
    'obs-100',
    'photo-200'
  );

  assert.equal(result.success, true);
  assert.equal(result.storagePath, '0f8fad5b-d9cb-469f-a165-70867728950e/obs-100/photo-200.jpg');
});

test('storageService: uploadAnimalPhoto refuses a device photo it cannot re-encode', async () => {
  // No native image manipulator under Node, so scrubbing fails and must block the upload
  const result = await uploadAnimalPhoto('file:///tmp/raw-with-gps.jpg', 'obs-1', 'photo-1');

  assert.equal(result.success, false);
  assert.equal(result.storagePath, 'file:///tmp/raw-with-gps.jpg');
});

test('storageService: isBucketPath tells uploaded paths from device files', () => {
  assert.equal(isBucketPath('0f8fad5b-d9cb-469f-a165-70867728950e/obs/p.jpg'), true);
  assert.equal(isBucketPath('observations/obs/p.jpg'), true);
  assert.equal(isBucketPath('file:///var/mobile/p.jpg'), false);
  assert.equal(isBucketPath('content://media/external/images/1'), false);
  assert.equal(isBucketPath('data:image/jpeg;base64,AAAA'), false);
  assert.equal(isBucketPath(''), false);
});
