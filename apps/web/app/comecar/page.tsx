'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, Rotulo } from '@talkin/ui';

export default function ComecarPage() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('create_organization', { p_nome_fantasia: nome });
    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    router.push('/gravar');
    router.refresh();
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <Card style={{ width: 'min(100%, 420px)', padding: 28 }}>
        <Rotulo>Primeiro acesso</Rotulo>
        <h1 style={{ fontSize: 22, margin: '4px 0 6px', fontWeight: 600 }}>Criar sua empresa</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 0 }}>
          Você será o administrador. Dá para completar os dados depois em Configurações.
        </p>
        <form onSubmit={criar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            required
            placeholder="Nome fantasia"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-menu)',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 14,
            }}
          />
          {erro && (
            <span style={{ color: 'var(--danger)', fontSize: 13 }} role="alert">
              {erro}
            </span>
          )}
          <button
            type="submit"
            disabled={carregando}
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--accent)',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {carregando ? '...' : 'Criar empresa'}
          </button>
        </form>
      </Card>
    </main>
  );
}
