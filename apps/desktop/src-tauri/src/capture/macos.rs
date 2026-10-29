//! macOS: captura do áudio do sistema via ScreenCaptureKit (áudio da tela) +
//! microfone via Core Audio. Exige a permissão "Gravação de áudio do sistema"
//! (o app guia o usuário no primeiro uso).
//!
//! STUB documentado (teste manual por versão de macOS — ver CAPTURE-TESTS.md).
//! A implementação real cria um `SCStream` só de áudio (faixa "outros") e uma
//! `AudioQueue`/`AVAudioEngine` para o microfone (faixa "eu"), grava em blocos
//! de ~45 s e chama `on_chunk` para cada bloco.

use super::{AudioCapture, ChunkEvent};
use std::path::PathBuf;

pub struct ScreenCaptureKitCapture {
    out_dir: PathBuf,
    running: bool,
}

impl ScreenCaptureKitCapture {
    pub fn new(out_dir: PathBuf) -> Self {
        Self { out_dir, running: false }
    }
}

impl AudioCapture for ScreenCaptureKitCapture {
    fn start(&mut self, _on_chunk: Box<dyn Fn(ChunkEvent) + Send>) -> anyhow::Result<()> {
        // TODO(macos): checar/solicitar permissão, iniciar SCStream de áudio +
        // captura do microfone, rotacionar blocos em `self.out_dir`.
        let _ = &self.out_dir;
        self.running = true;
        anyhow::bail!("captura ScreenCaptureKit ainda não implementada (stub)")
    }

    fn stop(&mut self) -> anyhow::Result<()> {
        self.running = false;
        Ok(())
    }
}
