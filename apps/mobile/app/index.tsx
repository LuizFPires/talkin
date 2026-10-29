import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { isConfigured, supabase } from '@/lib/supabase';

type Row = { id: string; title: string; status: string; created_at: string };

export default function Biblioteca() {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured()) {
      setMsg('Conecte o Supabase (EXPO_PUBLIC_SUPABASE_URL/ANON_KEY).');
      return;
    }
    void supabase
      .from('recordings')
      .select('id, title, status, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setRows((data as Row[] | null) ?? []));
  }, []);

  return (
    <View style={styles.container}>
      {msg && <Text style={styles.muted}>{msg}</Text>}
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={<Text style={styles.muted}>Nenhuma gravação ainda.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title?.trim() || 'Sem título'}</Text>
            <Text style={styles.muted}>{item.status}</Text>
          </View>
        )}
        contentContainerStyle={{ gap: 10, paddingBottom: 120 }}
      />
      <Link href="/gravando" asChild>
        <Pressable style={styles.recordBtn} accessibilityLabel="Gravar reunião">
          <View style={styles.recordDot} />
          <Text style={styles.recordText}>Gravar</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030707', padding: 16 },
  card: {
    backgroundColor: '#060606',
    borderColor: '#2b2b2b',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  title: { color: '#f5f5f7', fontSize: 15 },
  muted: { color: '#98989d', fontSize: 13, marginBottom: 8 },
  recordBtn: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#94efda',
    borderRadius: 9999,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  recordDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#8a1f1f' },
  recordText: { color: '#04221a', fontWeight: '700', fontSize: 16 },
});
