'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { Card, Pilula, Rotulo } from '@talkin/ui';

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const configurado = isSupabaseConfigured();

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!configurado) {
      setErro('Conecte o Supabase (variáveis de ambiente) para entrar.');
      return;
    }
    setCarregando(true);
    const supabase = createClient();
    const fn =
      modo === 'entrar'
        ? supabase.auth.signInWithPassword({ email, password: senha })
        : supabase.auth.signUp({ email, password: senha });
    const { error } = await fn;
    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    router.push('/biblioteca');
    router.refresh();
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <Card style={{ width: 'min(100%, 380px)', padding: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
          <Rotulo>Talkin</Rotulo>
          <h1 style={{ fontSize: 22, margin: 0, fontWeight: 600 }}>
            {modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </h1>
        </div>

        {!configurado && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 0 }}>
            Supabase ainda não conectado. Preencha <code>.env</code> a partir de{' '}
            <code>.env.example</code>.
          </p>
        )}

        <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            required
            placeholder="e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={campo}
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            style={campo}
          />
          {erro && (
            <span style={{ color: 'var(--danger)', fontSize: 13 }} role="alert">
              {erro}
            </span>
          )}
          <button type="submit" disabled={carregando} style={botao}>
            {carregando ? '...' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setModo(modo === 'entrar' ? 'criar' : 'entrar')}
          style={{
            marginTop: 16,
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          {modo === 'entrar' ? (
            <>
              Não tem conta? <Pilula>Criar conta</Pilula>
            </>
          ) : (
            <>
              Já tem conta? <Pilula>Entrar</Pilula>
            </>
          )}
        </button>
      </Card>
    </main>
  );
}

const campo: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 'var(--radius-menu)',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 14,
};

const botao: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--accent)',
  background: 'var(--accent)',
  color: 'var(--on-accent)',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
};
