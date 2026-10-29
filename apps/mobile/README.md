# @talkin/mobile

App Expo (React Native) — **gravação presencial em segundo plano** (M2, SPEC 1/5/6).

## Como roda

```bash
pnpm --filter @talkin/mobile start   # Expo dev server (precisa de device/emulador)
```

Variáveis: `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## O que tem

- **Gravar** (tela Gravando): grava em blocos de ~45 s (`expo-av`), com indicador permanente e lembrete de avisar os participantes (sem modo oculto). `expo-keep-awake` mantém a captura com a tela bloqueada.
- **Blocos + fila de upload**: cada bloco sobe de forma incremental via `@talkin/capture` (`UploadQueue`), que **nunca descarta um bloco sem confirmação do servidor** e **retoma** a fila após queda/fechamento (persistida no AsyncStorage).
- **Marcar momento**: vira destaque na ata (`recordings.highlights`).
- **Limites** (SPEC 1): aviso aos 3h45 e corte aos 4 h (`RecordingSession`).

> A lógica crítica (fila, sessão) está em `packages/capture` e é testada no CI. O app nativo é exercitado via Expo; captura de reuniões online (desktop) é o M3.
