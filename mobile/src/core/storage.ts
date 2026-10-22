import AsyncStorage from '@react-native-async-storage/async-storage';

/** Small JSON values kept on the device (progress, settings). Large data lives in files: see src/offline. */
export const storage = {
  async get<T>(key: string, fallback: T): Promise<T> {
    try {
      const raw = await AsyncStorage.getItem(`zema.${key}`);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  async set(key: string, value: unknown) {
    await AsyncStorage.setItem(`zema.${key}`, JSON.stringify(value));
  },
  async remove(key: string) {
    await AsyncStorage.removeItem(`zema.${key}`);
  },
};
