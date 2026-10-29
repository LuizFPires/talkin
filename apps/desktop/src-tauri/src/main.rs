// Talkin desktop — backend Tauri. A captura nativa fica em `capture/` (isolada).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod capture;
mod meeting;

use std::sync::Mutex;
use tauri::{Emitter, Manager, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use capture::{new_capture, AudioCapture};

#[derive(Default)]
struct CaptureState(Mutex<Option<Box<dyn AudioCapture>>>);

/// Inicia a captura das duas faixas; cada bloco vira um evento "chunk".
#[tauri::command]
fn start_capture(
    recording_id: String,
    app: tauri::AppHandle,
    state: State<'_, CaptureState>,
) -> Result<(), String> {
    // Grava sob o diretório de dados do app (coberto pelo escopo do plugin-fs),
    // não em $TEMP — assim o frontend consegue ler os blocos para enviar.
    let base = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let out_dir = base.join("recordings").join(&recording_id);
    std::fs::create_dir_all(&out_dir).map_err(|e| e.to_string())?;

    let mut capture = new_capture(out_dir).map_err(|e| e.to_string())?;
    let handle = app.clone();
    capture
        .start(Box::new(move |chunk| {
            // Entrega o bloco ao frontend, que o enfileira (@talkin/capture).
            let _ = handle.emit("chunk", chunk);
        }))
        .map_err(|e| e.to_string())?;

    *state.0.lock().unwrap() = Some(capture);
    Ok(())
}

#[tauri::command]
fn stop_capture(state: State<'_, CaptureState>) -> Result<(), String> {
    if let Some(mut c) = state.0.lock().unwrap().take() {
        c.stop().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Sugestão de reunião detectada (ou null). Nunca grava sozinho.
#[tauri::command]
fn detect_meeting() -> Option<meeting::Meeting> {
    meeting::detect()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(CaptureState::default())
        .setup(|app| {
            // Atalho global iniciar/parar (⌘⇧R / Ctrl+Shift+R) → evento ao frontend.
            let handle = app.handle().clone();
            app.global_shortcut().on_shortcut("CmdOrCtrl+Shift+R", move |_app, _sc, event| {
                if event.state == ShortcutState::Pressed {
                    let _ = handle.emit("shortcut-toggle", ());
                }
            })?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_capture,
            stop_capture,
            detect_meeting
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Talkin desktop");
}
