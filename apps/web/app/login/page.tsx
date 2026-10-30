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
  const [senha2, setSenha2] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const configurado = isSupabaseConfigured();

  function limparMensagens() {
    setErro(null);
    setAviso(null);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    limparMensagens();
    if (!configurado) {
      setErro('Conecte o Supabase (variáveis de ambiente) para entrar.');
      return;
    }
    if (modo === 'criar' && senha !== senha2) {
      setErro('As senhas não conferem.');
      return;
    }
    setCarregando(true);
    const supabase = createClient();

    if (modo === 'criar') {
      const { data, error } = await supabase.auth.signUp({ email, password: senha });
      setCarregando(false);
      if (error) {
        setErro(error.message);
        return;
      }
      // Supabase devolve um usuário com identities vazio quando o e-mail já existe
      // (proteção contra enumeração) — tratamos como "já tem conta".
      if (data.user && (data.user.identities?.length ?? 1) === 0) {
        setModo('entrar');
        setAviso('Este e-mail já tem conta. Faça login abaixo.');
        return;
      }
      // Sem sessão = confirmação de e-mail obrigatória: não dá para entrar ainda.
      if (!data.session) {
        setModo('entrar');
        setAviso(
          'Conta criada. Enviamos um link de confirmação para o seu e-mail — confirme e depois entre.',
        );
        return;
      }
      // Confirmação desligada: a sessão já veio, segue direto.
      router.push('/biblioteca');
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    router.push('/biblioteca');
    router.refresh();
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
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
            autoComplete="email"
            placeholder="e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={campo}
          />

          <CampoSenha
            placeholder="senha"
            value={senha}
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            onChange={setSenha}
            mostrar={mostrarSenha}
            onToggle={() => setMostrarSenha((v) => !v)}
          />

          {modo === 'criar' && (
            <CampoSenha
              placeholder="confirmar senha"
              value={senha2}
              autoComplete="new-password"
              onChange={setSenha2}
              mostrar={mostrarSenha}
              onToggle={() => setMostrarSenha((v) => !v)}
            />
          )}

          {erro && (
            <span style={{ color: 'var(--danger)', fontSize: 13 }} role="alert">
              {erro}
            </span>
          )}
          {aviso && (
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }} role="status">
              {aviso}
            </span>
          )}

          <button type="submit" disabled={carregando} style={botao}>
            {carregando ? '...' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            limparMensagens();
            setSenha2('');
            setModo(modo === 'entrar' ? 'criar' : 'entrar');
          }}
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

type CampoSenhaProps = {
  placeholder: string;
  value: string;
  autoComplete: string;
  onChange: (v: string) => void;
  mostrar: boolean;
  onToggle: () => void;
};

/** Campo de senha com botão "olho" para mostrar/ocultar. */
function CampoSenha({
  placeholder,
  value,
  autoComplete,
  onChange,
  mostrar,
  onToggle,
}: CampoSenhaProps) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={mostrar ? 'text' : 'password'}
        required
        minLength={6}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...campo, width: '100%', paddingRight: 48 }}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={mostrar}
        style={olhoBtn}
      >
        {mostrar ? <OlhoFechado /> : <Olho />}
      </button>
    </div>
  );
}

function Olho() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function OlhoFechado() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.9 5.2A9.5 9.5 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4" />
      <path d="M6.5 6.5A17 17 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 3.5-.7" />
    </svg>
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

const olhoBtn: React.CSSProperties = {
  position: 'absolute',
  right: 6,
  top: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 40,
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  padding: 0,
};
