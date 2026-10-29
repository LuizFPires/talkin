// Página genérica mostrada quando a navegação falha offline (sem dados do usuário).
export const metadata = { title: 'Offline — Talkin' };

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        background: '#030707',
        color: '#f5f5f7',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div>
        <div
          style={{
            textTransform: 'uppercase',
            fontSize: 11,
            letterSpacing: '0.18em',
            color: '#798e91',
          }}
        >
          Talkin
        </div>
        <h1 style={{ fontSize: 22, margin: '8px 0' }}>Você está offline</h1>
        <p style={{ color: '#98989d', fontSize: 14, maxWidth: 360 }}>
          Reabra quando houver internet. Gravações já feitas continuam na fila e sobem sozinhas.
        </p>
      </div>
    </main>
  );
}
