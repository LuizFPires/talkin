/**
 * Design system Human (AI Video Lab · Human Academy) — tokens do tema escuro.
 * Fonte única de verdade das cores/raios/rótulos. Nunca inventar cores fora daqui.
 */
export const tokens = {
  color: {
    bg: '#030707',
    card: '#060606',
    border: '#2b2b2b',
    text: '#f5f5f7',
    textSecondary: '#98989d',
    accent: '#94efda', // menta — uma ocorrência por região
    label: '#798e91',
  },
  gradient: {
    sidebar: 'linear-gradient(to bottom, #0f1c1d, #070f11)',
    activeItem: 'linear-gradient(to bottom, #283334, #1b2728)',
    pdfHeader: 'linear-gradient(to bottom, #071416, #172a2b)',
  },
  radius: {
    panel: '24px',
    card: '16px',
    search: '16px',
    menu: '12px',
    pill: '9999px',
  },
  label: {
    textTransform: 'uppercase',
    fontSize: '11px',
    fontWeight: 500,
    letterSpacing: '0.18em',
    color: '#798e91',
  },
  font: {
    ui: "'Inter', system-ui, sans-serif",
    doc: "'Sora', system-ui, sans-serif", // documentos (PDF da ata)
    mono: "'Geist Mono', ui-monospace, monospace", // minutos do áudio
  },
} as const;

export type Tokens = typeof tokens;

/** Emite as CSS variables do tema a partir dos tokens. */
export function cssVariables(): string {
  return [
    `--bg: ${tokens.color.bg}`,
    `--card: ${tokens.color.card}`,
    `--border: ${tokens.color.border}`,
    `--text: ${tokens.color.text}`,
    `--text-secondary: ${tokens.color.textSecondary}`,
    `--accent: ${tokens.color.accent}`,
    `--label: ${tokens.color.label}`,
    `--gradient-sidebar: ${tokens.gradient.sidebar}`,
    `--gradient-active: ${tokens.gradient.activeItem}`,
    `--radius-panel: ${tokens.radius.panel}`,
    `--radius-card: ${tokens.radius.card}`,
    `--radius-menu: ${tokens.radius.menu}`,
    `--font-ui: ${tokens.font.ui}`,
    `--font-doc: ${tokens.font.doc}`,
    `--font-mono: ${tokens.font.mono}`,
  ].join(';\n  ');
}
