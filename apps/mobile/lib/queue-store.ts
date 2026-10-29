import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueueItem, QueueStore } from '@talkin/capture';

/** Persiste a fila de upload de uma gravação (retomada offline). */
export function queueStore(recordingId: string): QueueStore {
  const key = `talkin:queue:${recordingId}`;
  return {
    async load() {
      const raw = await AsyncStorage.getItem(key);
      return raw ? (JSON.parse(raw) as QueueItem[]) : [];
    },
    async save(items: QueueItem[]) {
      await AsyncStorage.setItem(key, JSON.stringify(items));
    },
  };
}
