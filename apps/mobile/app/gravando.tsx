import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { formatMinute } from '@talkin/core';
import { MeetingRecorder } from '@/lib/recorder';
import { isConfigured, supabase } from '@/lib/supabase';

export default function Gravando() {
  useKeepAwake(); // não deixa a tela/CPU dormir durante a gravação
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const [marcas, setMarcas] = useState(0);
  const [status, setStatus] = useState('Preparando…');
  const recorderRef = useRef<MeetingRecorder | null>(null);
  const recordingIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isConfigured()) {
        setStatus('Supabase não configurado.');
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setStatus('Entre na sua conta para gravar.');
        return;
      }
      const { data: membership } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      const org = membership?.organization_id as string | undefined;
      if (!org) {
        setStatus('Empresa não encontrada.');
        return;
      }
      const { data: rec } = await supabase
        .from('recordings')
        .insert({ organization_id: org, created_by: user.id, source: 'presencial', title: '' })
        .select('id')
        .single();
      if (!rec || cancelled) return;
      recordingIdRef.current = rec.id;

      const recorder = new MeetingRecorder(org, rec.id, {
        onElapsed: (ms) => setElapsed(ms),
        onWarn: () => Alert.alert('Gravação longa', 'Faltam 15 minutos para o limite de 4 h.'),
        onLimit: () => Alert.alert('Limite de 4 h', 'A gravação foi encerrada.'),
      });
      recorderRef.current = recorder;
      await recorder.start();
      setStatus('Gravando — avise os participantes');
    })();
    return () => {
      cancelled = true;
      void recorderRef.current?.stop();
    };
  }, []);

  async function parar() {
    const recorder = recorderRef.current;
    const r = await recorder?.stop();
    recorderRef.current = null;
    // Persiste os momentos marcados (viram destaques na ata).
    if (recorder && recordingIdRef.current) {
      // Contrato do pipeline: highlights é lista de minutos (ms).
      await supabase
        .from('recordings')
        .update({ highlights: recorder.getMoments().map((m) => m.atMs) })
        .eq('id', recordingIdRef.current);
    }
    if (r && r.pending > 0) {
      Alert.alert(
        'Faltam blocos',
        `${r.pending} bloco(s) ainda não enviados. Serão reenviados ao reabrir o app com internet.`,
      );
    }
    router.back();
  }

  function marcar() {
    recorderRef.current?.markMoment('atencao');
    setMarcas((n) => n + 1);
  }

  return (
    <View style={styles.container}>
      <View style={styles.indicator}>
        <View style={styles.dot} />
        <Text style={styles.indicatorText}>{status}</Text>
      </View>
      <Text style={styles.timer}>{formatMinute(elapsed)}</Text>
      <Text style={styles.muted}>{marcas} momento(s) marcado(s)</Text>

      <View style={styles.actions}>
        <Pressable style={styles.mark} onPress={marcar} accessibilityLabel="Marcar momento">
          <Text style={styles.markText}>Marcar momento</Text>
        </Pressable>
        <Pressable style={styles.stop} onPress={parar} accessibilityLabel="Parar gravação">
          <Text style={styles.stopText}>Parar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030707',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  indicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff7a7a' },
  indicatorText: { color: '#98989d', fontSize: 13 },
  timer: { color: '#f5f5f7', fontSize: 56, fontVariant: ['tabular-nums'], fontWeight: '300' },
  muted: { color: '#98989d', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  mark: {
    borderColor: '#2b2b2b',
    borderWidth: 1,
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  markText: { color: '#f5f5f7', fontSize: 14 },
  stop: {
    backgroundColor: '#94efda',
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  stopText: { color: '#04221a', fontWeight: '700', fontSize: 14 },
});
