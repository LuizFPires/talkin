import AsyncStorage from '@react-native-async-storage/async-storage';
import { UploadQueue } from '@talkin/capture';
import { chunkUploader } from './upload';
import { queueStore } from './queue-store';
import { supabase } from './supabase';

const PREFIX = 'talkin:queue:';

/**
 * Retoma uploads pendentes ao abrir o app (SPEC 1 / CLAUDE.md "não perder áudio").
 * Varre as filas persistidas e reenvia o que não foi confirmado; limpa as já concluídas.
 */
export async function resumePendingUploads(): Promise<{ recordings: number; pending: number }> {
  const keys = await AsyncStorage.getAllKeys();
  const queueKeys = keys.filter((k) => k.startsWith(PREFIX));
  if (queueKeys.length === 0) return { recordings: 0, pending: 0 };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { recordings: 0, pending: 0 };
  const { data: membership } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const org = membership?.organization_id as string | undefined;
  if (!org) return { recordings: 0, pending: 0 };

  let pending = 0;
  for (const key of queueKeys) {
    const recordingId = key.slice(PREFIX.length);
    const q = new UploadQueue(chunkUploader(org, recordingId), queueStore(recordingId));
    await q.init();
    const r = await q.flush();
    if (q.allUploaded()) {
      await AsyncStorage.removeItem(key); // concluída: libera o espaço local
    } else {
      pending += r.pending;
    }
  }
  return { recordings: queueKeys.length, pending };
}
