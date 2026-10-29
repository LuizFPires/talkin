//! Windows: captura do áudio do sistema via WASAPI em modo loopback (sem
//! permissão extra) + microfone. Duas faixas gravadas em paralelo.
//!
//! STUB documentado (teste manual por versão de Windows — ver CAPTURE-TESTS.md).
//! A implementação real abre dois `IAudioClient`: o dispositivo de render em
//! loopback (faixa "outros") e o dispositivo de captura padrão (faixa "eu"),
//! grava em blocos de ~45 s (AAC/M4A) e chama `on_chunk` para cada bloco.

use super::{AudioCapture, ChunkEvent};
use std::path::PathBuf;

pub struct WasapiCapture {
    out_dir: PathBuf,
    running: bool,
}

impl WasapiCapture {
    pub fn new(out_dir: PathBuf) -> Self {
        Self { out_dir, running: false }
    }
}

impl AudioCapture for WasapiCapture {
    fn start(&mut self, _on_chunk: Box<dyn Fn(ChunkEvent) + Send>) -> anyhow::Result<()> {
        // TODO(win): inicializar COM, abrir IAudioClient loopback (render) + captura (mic),
        // iniciar threads de leitura e rotação de blocos a cada ~45 s em `self.out_dir`.
        let _ = &self.out_dir;
        self.running = true;
        anyhow::bail!("captura WASAPI ainda não implementada (stub)")
    }

    fn stop(&mut self) -> anyhow::Result<()> {
        self.running = false;
        Ok(())
    }
}
