/** Esqueleto instantâneo ao navegar (feedback imediato enquanto o servidor responde). */
export default function Loading() {
  return (
    <div
      style={{
        maxWidth: 980,
        margin: '0 auto',
        padding: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
      aria-busy="true"
      aria-label="Carregando"
    >
      <div className="sk" style={{ height: 14, width: 120, borderRadius: 6 }} />
      <div className="sk" style={{ height: 30, width: 240, borderRadius: 8 }} />
      <div className="sk" style={{ height: 110, borderRadius: 'var(--radius-card)' }} />
      <div className="sk" style={{ height: 110, borderRadius: 'var(--radius-card)' }} />
    </div>
  );
}
