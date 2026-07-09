import * as SecureStore from 'expo-secure-store';

type CacheEnvelope<T> = {
  value: T;
  updatedAt: number;
};

export const readCachedValue = async <T>(key: string, fallback: T): Promise<CacheEnvelope<T>> => {
  try {
    const raw = await SecureStore.getItemAsync(key);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      if ('value' in parsed) {
        return {
          value: (parsed.value as T) ?? fallback,
          updatedAt: Number(parsed.updatedAt || 0) || 0,
        };
      }
      if ('items' in parsed) {
        return {
          value: (parsed.items as T) ?? fallback,
          updatedAt: Number(parsed.updatedAt || 0) || 0,
        };
      }
    }
  } catch {
    // ignore cache read errors
  }
  return { value: fallback, updatedAt: 0 };
};

export const writeCachedValue = async <T>(key: string, value: T) => {
  try {
    await SecureStore.setItemAsync(
      key,
      JSON.stringify({
        value,
        updatedAt: Date.now(),
      })
    );
  } catch {
    // ignore cache write errors
  }
};

export const removeCachedValue = async (key: string) => {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore cache delete errors
  }
};
