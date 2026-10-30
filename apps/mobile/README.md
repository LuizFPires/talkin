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

## Build instalável (Android APK via EAS)

Caminho mais rápido de testar no celular — grátis, sem loja e sem conta Apple. O build roda na nuvem do EAS (não precisa de toolchain Android local).

**Pré-requisitos (uma vez):**

1. Conta grátis em **expo.dev**.
2. `npm i -g eas-cli` e `eas login`.
3. Na pasta do app: `eas init` (cria o projeto EAS e grava `extra.eas.projectId` no `app.json`).

**Variáveis (públicas — as mesmas do web):**

```bash
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://lgzhpfakajyhzfbvfjvt.supabase.co
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <sua anon/publishable key>
```

(Ou crie um `apps/mobile/.env` local com as duas, para `expo start`.)

**Gerar o APK:**

```bash
cd apps/mobile
eas build -p android --profile preview
```

No fim, o EAS dá um link para baixar o **`.apk`** → instale no Android (permita "fontes desconhecidas"). O perfil `preview` já sai como APK (não AAB), distribuição interna.

**iOS** (mais pesado): exige **Apple Developer Program** (US$99/ano) → `eas build -p ios --profile preview` → TestFlight.

### Gravação em segundo plano (tela bloqueada)

- `app.json`: `UIBackgroundModes: ["audio"]` (iOS) + `FOREGROUND_SERVICE_MICROPHONE`/`POST_NOTIFICATIONS` (Android).
- `recorder.ts`: `staysActiveInBackground`, modos de interrupção (pausa em ligação) e **notificação permanente** (`lib/notify.ts`).
- **Teste em device real** (o emulador não reflete o comportamento de background) e registre o resultado por versão de SO, como o desktop faz em `CAPTURE-TESTS.md`.
