# @talkin/desktop

App Tauri (bandeja/barra de menu) para **gravar reuniões online** — M3 (SPEC 2/3).

## Como roda

```bash
pnpm --filter @talkin/desktop tauri dev   # precisa de Rust + toolchain Tauri
```

Variáveis (frontend Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## O que tem

- **Janela compacta** (`src/main.ts`): detecta reunião (SPEC 3) e sugere gravar; indicador de gravação; faixas "você" × "outros".
- **Captura nativa isolada** (`src-tauri/src/capture/`): trait `AudioCapture` + `windows.rs` (WASAPI loopback) e `macos.rs` (ScreenCaptureKit/Core Audio), cada um atrás de `cfg`. Grava **duas faixas separadas**. As implementações nativas estão como stubs documentados — ver `CAPTURE-TESTS.md`.
- **Upload incremental** reutiliza `@talkin/capture` (`UploadQueue`): mesma garantia do mobile de **não perder bloco** e retomar ao reabrir.

> A parte nativa (Rust) **não entra no CI** (precisa de Rust + SO alvo); é testada manualmente por versão de SO. O frontend TS é verificável localmente (`tsc`), mas o app não roda no CI.
