# @talkin/desktop

App Tauri (barra de menu no macOS / bandeja no Windows) para **gravar reuniões online** — milestone **M3**.

O módulo de captura nativa fica isolado (ScreenCaptureKit/Core Audio no macOS, WASAPI loopback no Windows), capturando **duas faixas separadas** ("eu" × "outros"), com testes manuais documentados por versão de SO. No M0 é apenas o esqueleto no monorepo. Ver `SPEC.md` itens 2 e 3.
