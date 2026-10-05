/**
 * Where the Supabase session (access and refresh tokens) is kept on the
 * phone: the encrypted keychain / keystore (expo-secure-store), not plain
 * app storage. Secure store values should stay under ~2 KB, so the session
 * JSON is split into chunks. A session saved by an older build in
 * AsyncStorage is moved over on first read, so nobody is signed out.
 * The web preview has no secure store and keeps using AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as SecureStoreType from 'expo-secure-store';

const CHUNK = 1800;

// Loaded lazily: the module is native-only
let secure: typeof SecureStoreType | null | undefined;
function secureStore(): typeof SecureStoreType | null {
  if (secure !== undefined) return secure;
  // EXPO_OS is set by Expo at build time (ios/android/web); unset in Node tests
  const os = typeof process !== 'undefined' ? process.env.EXPO_OS : undefined;
  if (os !== 'ios' && os !== 'android') return (secure = null);
  try {
    secure = require('expo-secure-store') as typeof SecureStoreType;
  } catch {
    secure = null;
  }
  return secure;
}

// Keys may only hold letters, digits, ".", "-" and "_"
const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

async function readSecure(store: typeof SecureStoreType, key: string): Promise<string | null> {
  const count = Number(await store.getItemAsync(`${safe(key)}.n`));
  if (!count) return null;
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const part = await store.getItemAsync(`${safe(key)}.${i}`);
    if (part == null) return null;
    parts.push(part);
  }
  return parts.join('');
}

async function removeSecure(store: typeof SecureStoreType, key: string) {
  const count = Number(await store.getItemAsync(`${safe(key)}.n`)) || 0;
  for (let i = 0; i < count; i++) await store.deleteItemAsync(`${safe(key)}.${i}`);
  await store.deleteItemAsync(`${safe(key)}.n`);
}

async function writeSecure(store: typeof SecureStoreType, key: string, value: string) {
  await removeSecure(store, key);
  const n = Math.max(1, Math.ceil(value.length / CHUNK));
  for (let i = 0; i < n; i++)
    await store.setItemAsync(`${safe(key)}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
  await store.setItemAsync(`${safe(key)}.n`, String(n));
}

export const authStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const store = secureStore();
    try {
      if (store) {
        const value = await readSecure(store, key);
        if (value != null) return value;
        // One-time move from the plain storage older builds used
        const legacy = await AsyncStorage.getItem(key);
        if (legacy != null) {
          await writeSecure(store, key, legacy);
          await AsyncStorage.removeItem(key);
        }
        return legacy;
      }
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const store = secureStore();
    try {
      if (store) await writeSecure(store, key, value);
      else await AsyncStorage.setItem(key, value);
    } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    const store = secureStore();
    try {
      if (store) await removeSecure(store, key);
      await AsyncStorage.removeItem(key);
    } catch {}
  },
};
