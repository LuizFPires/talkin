'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sidebar, Rotulo, Pilula } from '@talkin/ui';

const ITENS = [
  { key: '/biblioteca', label: 'Biblioteca' },
  { key: '/importar', label: 'Importar' },
  { key: '/bot', label: 'Bot de reunião' },
  { key: '/configuracoes', label: 'Configurações' },
];

export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeKey = ITENS.find((i) => pathname.startsWith(i.key))?.key ?? '/biblioteca';

  async function sair() {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', gap: 12, padding: 12 }}>
      <Sidebar
        items={ITENS}
        activeKey={activeKey}
        onSelect={(key) => router.push(key)}
        header={
          <div style={{ padding: '4px 8px 16px' }}>
            <Rotulo>Talkin</Rotulo>
          </div>
        }
        footer={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '0 4px' }}>
              {email}
            </span>
            <button
              type="button"
              onClick={sair}
              style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <Pilula>Sair</Pilula>
            </button>
          </div>
        }
      />
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  );
}
