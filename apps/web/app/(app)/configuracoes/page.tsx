'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildAtaHtml } from '@talkin/pdf/html';
import type { PdfTemplate } from '@talkin/core';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { ConfiguracoesView } from '@/components/configuracoes-view';
import { Rotulo } from '@talkin/ui';

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
        revisao: { conferidas: [], editadas: [] },
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
      <div className="cfg">
        <Rotulo>Configurações</Rotulo>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Conecte o Supabase para editar perfil e empresa.
        </p>
      </div>
    );
  }

  return (
    <ConfiguracoesView
      org={org}
      profile={profile}
      isAdmin={isAdmin}
      msg={msg}
      previewHtml={previewHtml}
      logoPreview={logoPreview}
      onProfile={(patch) => setProfile((p) => p && { ...p, ...patch })}
      onOrg={(patch) => setOrg((o) => o && { ...o, ...patch })}
      onSalvarPerfil={() => void salvarPerfil()}
      onSalvarEmpresa={() => void salvarEmpresa()}
      onLogo={(f) => void enviarLogo(f)}
    />
  );
}
