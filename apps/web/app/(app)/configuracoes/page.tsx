'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { buildAtaHtml } from '@talkin/pdf/html';
import type { PdfTemplate } from '@talkin/core';
import { Card, Rotulo } from '@talkin/ui';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';

type Org = {
  id: string;
  nome_fantasia: string;
  cnpj: string | null;
  cidade: string | null;
  uf: string | null;
  site: string | null;
  accent_color: string | null;
  pdf_template: PdfTemplate;
  logo_url: string | null;
};
type Profile = {
  id: string;
  full_name: string | null;
  cargo: string | null;
  telefone: string | null;
};

const campo: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 'var(--radius-menu)',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 14,
  width: '100%',
};
const botao: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--accent)',
  background: 'var(--accent)',
  color: 'var(--on-accent)',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};

export default function ConfiguracoesPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const configurado = isSupabaseConfigured();

  useEffect(() => {
    if (!configurado) return;
    const supabase = createClient();
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: m } = await supabase
        .from('memberships')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      setIsAdmin(m?.role === 'admin');
      const { data: p } = await supabase
        .from('profiles')
        .select('id, full_name, cargo, telefone')
        .eq('id', user.id)
        .maybeSingle();
      if (p) setProfile(p as Profile);
      if (m?.organization_id) {
        const { data: o } = await supabase
          .from('organizations')
          .select('id, nome_fantasia, cnpj, cidade, uf, site, accent_color, pdf_template, logo_url')
          .eq('id', m.organization_id)
          .maybeSingle();
        if (o) setOrg(o as Org);
      }
    })();
  }, [configurado]);

  const previewHtml = useMemo(() => {
    if (!org) return '';
    return buildAtaHtml({
      org: {
        nome_fantasia: org.nome_fantasia || 'Sua empresa',
        accent_color: org.accent_color,
        cnpj: org.cnpj,
        site: org.site,
        logo_url: logoPreview,
      },
      recording: {
        title: 'Reunião de obra semanal',
        date: new Date().toISOString(),
        durationS: 3600,
        source: 'Presencial',
        participants: ['Marcos', 'Júlio'],
        revisada: true,
      },
      ata: {
        resumo: 'Prévia da ata com os dados da sua empresa.',
        secoes: [{ key: 'resumo', title: 'Resumo', body: 'Exemplo de seção.', minutos_ms: [4000] }],
        extracao: {
          decisoes: [{ texto: 'Decisão de exemplo', minuto_ms: 4000, quem: 'Júlio' }],
          pendencias: [
            {
              texto: 'Pendência de exemplo',
              responsavel: 'Marcos',
              prazo: '2026-10-31',
              prazo_estimado: false,
              minuto_ms: 0,
            },
          ],
          valores: [{ descricao: 'Concreto', valor: 512, unidade: 'R$', minuto_ms: 1000 }],
          prazos: [],
          riscos: [],
        },
      },
      template: org.pdf_template,
    });
  }, [org, logoPreview]);

  async function salvarPerfil() {
    if (!profile) return;
    setMsg(null);
    const { error } = await createClient()
      .from('profiles')
      .update({ full_name: profile.full_name, cargo: profile.cargo, telefone: profile.telefone })
      .eq('id', profile.id);
    setMsg(error ? error.message : 'Perfil salvo.');
  }

  async function salvarEmpresa() {
    if (!org) return;
    setMsg(null);
    const { error } = await createClient()
      .from('organizations')
      .update({
        nome_fantasia: org.nome_fantasia,
        cnpj: org.cnpj,
        cidade: org.cidade,
        uf: org.uf,
        site: org.site,
        accent_color: org.accent_color,
        pdf_template: org.pdf_template,
      })
      .eq('id', org.id);
    setMsg(error ? error.message : 'Empresa salva.');
  }

  async function enviarLogo(file: File) {
    if (!org) return;
    const supabase = createClient();
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'png';
    const path = `${org.id}/logo.${ext}`;
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
    if (error) {
      setMsg(error.message);
      return;
    }
    await supabase.from('organizations').update({ logo_url: path }).eq('id', org.id);
    setLogoPreview(URL.createObjectURL(file)); // prévia local
    setMsg('Logo enviada.');
  }

  if (!configurado) {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto', padding: 24 }}>
        <Rotulo>Configurações</Rotulo>
        <p style={{ color: 'var(--text-secondary)' }}>
          Conecte o Supabase para editar perfil e empresa.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '8px 4px 40px' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 20,
        }}
      >
        <div>
          <Rotulo>Configurações</Rotulo>
          <h1 style={{ fontSize: 24, margin: '4px 0 0', fontWeight: 600 }}>Perfil e empresa</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/configuracoes/projetos" style={{ ...botao, textDecoration: 'none' }}>
            Projetos
          </Link>
          <Link href="/configuracoes/modelos" style={{ ...botao, textDecoration: 'none' }}>
            Modelos de ata
          </Link>
        </div>
      </header>
      {msg && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{msg}</p>}

      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <Card>
            <Rotulo>Meu perfil</Rotulo>
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              <input
                style={campo}
                placeholder="Nome"
                value={profile?.full_name ?? ''}
                onChange={(e) => setProfile((p) => p && { ...p, full_name: e.target.value })}
              />
              <input
                style={campo}
                placeholder="Cargo"
                value={profile?.cargo ?? ''}
                onChange={(e) => setProfile((p) => p && { ...p, cargo: e.target.value })}
              />
              <input
                style={campo}
                placeholder="Telefone"
                value={profile?.telefone ?? ''}
                onChange={(e) => setProfile((p) => p && { ...p, telefone: e.target.value })}
              />
              <button style={botao} onClick={() => void salvarPerfil()}>
                Salvar perfil
              </button>
            </div>
          </Card>

          <Card>
            <Rotulo>Empresa</Rotulo>
            {!isAdmin && (
              <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                Só administradores editam a empresa.
              </p>
            )}
            <div style={{ display: 'grid', gap: 10, marginTop: 10, opacity: isAdmin ? 1 : 0.6 }}>
              <input
                style={campo}
                disabled={!isAdmin}
                placeholder="Nome fantasia"
                value={org?.nome_fantasia ?? ''}
                onChange={(e) => setOrg((o) => o && { ...o, nome_fantasia: e.target.value })}
              />
              <input
                style={campo}
                disabled={!isAdmin}
                placeholder="CNPJ"
                value={org?.cnpj ?? ''}
                onChange={(e) => setOrg((o) => o && { ...o, cnpj: e.target.value })}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  style={campo}
                  disabled={!isAdmin}
                  placeholder="Cidade"
                  value={org?.cidade ?? ''}
                  onChange={(e) => setOrg((o) => o && { ...o, cidade: e.target.value })}
                />
                <input
                  style={{ ...campo, width: 80 }}
                  disabled={!isAdmin}
                  placeholder="UF"
                  maxLength={2}
                  value={org?.uf ?? ''}
                  onChange={(e) => setOrg((o) => o && { ...o, uf: e.target.value.toUpperCase() })}
                />
              </div>
              <input
                style={campo}
                disabled={!isAdmin}
                placeholder="Site"
                value={org?.site ?? ''}
                onChange={(e) => setOrg((o) => o && { ...o, site: e.target.value })}
              />
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                }}
              >
                Cor de destaque
                <input
                  type="color"
                  disabled={!isAdmin}
                  value={org?.accent_color ?? '#94efda'}
                  onChange={(e) => setOrg((o) => o && { ...o, accent_color: e.target.value })}
                />
              </label>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Modelo de PDF
                <select
                  style={{ ...campo, marginTop: 6 }}
                  disabled={!isAdmin}
                  value={org?.pdf_template ?? 'executiva'}
                  onChange={(e) =>
                    setOrg((o) => o && { ...o, pdf_template: e.target.value as PdfTemplate })
                  }
                >
                  <option value="executiva">Executiva</option>
                  <option value="formal">Formal</option>
                  <option value="painel">Painel</option>
                </select>
              </label>
              <input
                type="file"
                accept="image/*"
                disabled={!isAdmin}
                onChange={(e) => e.target.files?.[0] && void enviarLogo(e.target.files[0])}
                style={{ fontSize: 12, color: 'var(--text-secondary)' }}
              />
              <button style={botao} disabled={!isAdmin} onClick={() => void salvarEmpresa()}>
                Salvar empresa
              </button>
            </div>
          </Card>
        </div>

        <Card>
          <Rotulo>Prévia do PDF</Rotulo>
          <div
            style={{
              marginTop: 10,
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid var(--border)',
              background: '#fff',
            }}
          >
            <iframe
              title="Prévia da ata"
              srcDoc={previewHtml}
              sandbox=""
              style={{ width: '100%', height: 520, border: 'none' }}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
