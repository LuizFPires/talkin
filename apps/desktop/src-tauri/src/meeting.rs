//! Detecção de reunião (SPEC 3): percebe que uma reunião começou por processo
//! em execução ou janela ativa (Teams, Zoom, Meet, WhatsApp). Só SUGERE gravar;
//! nunca grava sozinho sem a opção automática ligada.

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Meeting {
    pub app: String,
    pub title: String,
}

const APPS: &[(&str, &str)] = &[
    ("Teams", "teams"),
    ("Zoom", "zoom"),
    ("Google Meet", "meet.google.com"),
    ("WhatsApp", "whatsapp"),
];

/// Procura um app/aba de reunião ativo. STUB: a implementação real varre a
/// lista de processos e o título da janela em foco por SO. Retorna `None`
/// quando nada é detectado.
pub fn detect() -> Option<Meeting> {
    // TODO: enumerar processos (sysinfo) e janela ativa por SO; casar com APPS.
    let _ = APPS;
    None
}
