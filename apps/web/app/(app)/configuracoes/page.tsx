import { Card, Rotulo } from '@talkin/ui';

export default function ConfiguracoesPage() {
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '8px 4px 40px' }}>
      <header style={{ marginBottom: 20 }}>
        <Rotulo>Configurações</Rotulo>
        <h1 style={{ fontSize: 24, margin: '4px 0 0', fontWeight: 600 }}>Perfil e empresa</h1>
      </header>
      <Card>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
          Perfil, empresa, logomarca, cor de destaque e modelo de PDF entram no M4 (SPEC 27).
        </p>
      </Card>
    </div>
  );
}
