//! Captura de áudio isolada (CLAUDE.md): módulo pequeno, com implementação por
//! SO atrás de `cfg`. Duas faixas separadas — "eu" (microfone) e "outros"
//! (áudio do sistema) — para que o que você disse nunca seja atribuído a outro.
//!
//! Testes manuais por versão de SO ficam em `apps/desktop/CAPTURE-TESTS.md`.
//! Este código não roda no CI (precisa de Rust + SO alvo).

use serde::Serialize;

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Track {
    Eu,
    Outros,
}

/// Um bloco gravado em disco, pronto para o frontend enfileirar.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkEvent {
    pub index: u64,
    pub track: Track,
    pub path: String,
    pub duration_ms: u64,
    pub bytes: u64,
}

/// Contrato da captura nativa. Cada SO implementa; o resto do app não muda.
pub trait AudioCapture: Send {
    /// Começa a capturar as duas faixas, chamando `on_chunk` a cada bloco (~45 s).
    fn start(&mut self, on_chunk: Box<dyn Fn(ChunkEvent) + Send>) -> anyhow::Result<()>;
    /// Encerra e finaliza o último bloco de cada faixa.
    fn stop(&mut self) -> anyhow::Result<()>;
}

#[cfg(windows)]
mod windows;
#[cfg(target_os = "macos")]
mod macos;

/// Fábrica por SO.
pub fn new_capture(out_dir: std::path::PathBuf) -> anyhow::Result<Box<dyn AudioCapture>> {
    #[cfg(windows)]
    {
        Ok(Box::new(windows::WasapiCapture::new(out_dir)))
    }
    #[cfg(target_os = "macos")]
    {
        Ok(Box::new(macos::ScreenCaptureKitCapture::new(out_dir)))
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = out_dir;
        anyhow::bail!("captura de áudio do sistema não suportada neste SO")
    }
}
