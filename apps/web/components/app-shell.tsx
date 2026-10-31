'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sidebar, Rotulo, Pilula } from '@talkin/ui';

const ITENS = [
  { key: '/gravar', label: 'Gravar reunião' },
  { key: '/biblioteca', label: 'Biblioteca' },
  { key: '/importar', label: 'Importar' },
  { key: '/bot', label: 'Bot de reunião' },
  { key: '/configuracoes', label: 'Configurações' },
];

// Barra inferior (mobile): dois botões de cada lado e Gravar no centro, elevado.
const ESQUERDA = [
  { key: '/biblioteca', label: 'Reuniões' },
  { key: '/importar', label: 'Importar' },
];
const DIREITA = [
  { key: '/bot', label: 'Bot' },
  { key: '/configuracoes', label: 'Config' },
];

/** Ícones de linha (coerentes com o tema Human), um por aba. */
function Icone({ nome }: { nome: string }) {
  if (nome === '/biblioteca') {
    return (
      <svg
        width={22}
        height={22}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (nome === '/importar') {
    return (
      <svg
        width={22}
        height={22}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 15V4" />
        <path d="M8 8l4-4 4 4" />
        <path d="M5 19h14" />
      </svg>
    );
  }
  if (nome === '/bot') {
    return (
      <svg
        width={22}
        height={22}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="5" y="8" width="14" height="11" rx="3" />
        <path d="M12 4v4" />
        <circle cx="9.5" cy="13" r="1" />
        <circle cx="14.5" cy="13" r="1" />
      </svg>
    );
  }
  // Configurações (sliders)
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h9" />
      <circle cx="16" cy="7" r="2.3" />
      <path d="M19 7h1" />
      <path d="M4 17h2" />
      <circle cx="8" cy="17" r="2.3" />
      <path d="M11 17h9" />
    </svg>
  );
}

function IconeMic({ tamanho = 26 }: { tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
      <path d="M6 11a6 6 0 0 0 12 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="9" y1="21" x2="15" y2="21" />
    </svg>
  );
}

export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeKey = ITENS.find((i) => pathname.startsWith(i.key))?.key ?? '/gravar';
  const gravando = pathname.startsWith('/gravar');

  // Prefetch das rotas do menu: o clique usa o payload já buscado (navegação instantânea).
  useEffect(() => {
    ITENS.forEach((i) => router.prefetch(i.key));
  }, [router]);

  async function sair() {
    await createClient().auth.signOut();
    // Limpa caches do PWA no logout (não deixa nada do usuário no dispositivo).
    if (typeof caches !== 'undefined') {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        // ignora
      }
    }
    router.push('/login');
    router.refresh();
  }

  const aba = (t: { key: string; label: string }) => {
    const active = t.key === activeKey;
    return (
      <button
        key={t.key}
        type="button"
        onClick={() => router.push(t.key)}
        className={active ? 'tab-active' : undefined}
        aria-current={active ? 'page' : undefined}
      >
        <Icone nome={t.key} />
        {t.label}
      </button>
    );
  };

  return (
    <div className="app-shell">
      {/* Desktop: barra lateral em painel */}
      <div className="app-sidebar">
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
      </div>

      {/* Mobile: topo fixo compacto */}
      <header className="app-topbar">
        <Rotulo>Talkin</Rotulo>
        <button
          type="button"
          onClick={sair}
          aria-label="Sair"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <Pilula>Sair</Pilula>
        </button>
      </header>

      <main className="app-main">{children}</main>

      {/* Mobile: barra inferior 2 + Gravar + 2 (padrão de app) */}
      <nav className="app-bottomnav" aria-label="Navegação principal">
        {ESQUERDA.map(aba)}
        <Link
          href="/gravar"
          className={`nav-gravar${gravando ? ' tab-active' : ''}`}
          aria-label="Gravar reunião"
          aria-current={gravando ? 'page' : undefined}
        >
          <span className="nav-gravar-bola">
            <IconeMic />
          </span>
          Gravar
        </Link>
        {DIREITA.map(aba)}
      </nav>
    </div>
  );
}
