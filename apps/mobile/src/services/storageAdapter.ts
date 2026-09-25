import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryFallback = new Map<string, string>();

/**
 * Universal AsyncStorage adapter ensuring seamless CJS/ESM interop
 * across React Native Hermes runtime and Node.js test environments.
 */
export const storage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const client = (AsyncStorage as any)?.default?.getItem ? (AsyncStorage as any).default : AsyncStorage;
      if (typeof client?.getItem === 'function') {
        const val = await client.getItem(key);
        if (val !== undefined && val !== null) return val;
      }
      return memoryFallback.get(key) ?? null;
    } catch {
      return memoryFallback.get(key) ?? null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    memoryFallback.set(key, value);
    try {
      const client = (AsyncStorage as any)?.default?.setItem ? (AsyncStorage as any).default : AsyncStorage;
      if (typeof client?.setItem === 'function') {
        await client.setItem(key, value);
      }
    } catch {}
  },

  removeItem: async (key: string): Promise<void> => {
    memoryFallback.delete(key);
    try {
      const client = (AsyncStorage as any)?.default?.removeItem ? (AsyncStorage as any).default : AsyncStorage;
      if (typeof client?.removeItem === 'function') {
        await client.removeItem(key);
      }
    } catch {}
  },
};
