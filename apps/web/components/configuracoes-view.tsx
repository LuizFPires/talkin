'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PdfTemplate } from '@talkin/core';
import { Card, Pilula, Rotulo } from '@talkin/ui';
import { VersaoApp } from './versao-app';

export type OrgForm = {
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
export type ProfileForm = {
  id: string;
  full_name: string | null;
  cargo: string | null;
  telefone: string | null;
};

type Props = {
  org: OrgForm | null;
  profile: ProfileForm | null;
  isAdmin: boolean;
  msg: string | null;
  previewHtml: string;
  logoPreview: string | null;
  onProfile: (patch: Partial<ProfileForm>) => void;
  onOrg: (patch: Partial<OrgForm>) => void;
  onSalvarPerfil: () => void;
  onSalvarEmpresa: () => void;
  onLogo: (file: File) => void;
};

const SECOES = [
  { href: '/configuracoes/projetos', nome: 'Projetos e obras', desc: 'Para filtrar e sugerir' },
  { href: '/configuracoes/pessoas', nome: 'Pessoas', desc: 'Participantes e responsáveis' },
  { href: '/configuracoes/modelos', nome: 'Modelos de ata', desc: 'Seções por tipo de reunião' },
  {
    href: '/configuracoes/integracoes',
    nome: 'Integrações',
    desc: 'Webhook, calendário, importação',
  },
];

/**
 * Tela de Configurações em estilo app: lista de seções com seta, formulários com
 * rótulos e campos altos, prévia do PDF recolhida no celular. A lógica de dados
 * fica em app/(app)/configuracoes/page.tsx.
 */
export function ConfiguracoesView({
  org,
  profile,
  isAdmin,
  msg,
  previewHtml,
  logoPreview,
  onProfile,
  onOrg,
  onSalvarPerfil,
  onSalvarEmpresa,
  onLogo,
}: Props) {
  const [previaAberta, setPreviaAberta] = useState(false);
  const iniciais = (org?.nome_fantasia || 'T')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="cfg">
      <header className="cfg-cabecalho">
        <Rotulo>Configurações</Rotulo>
        <h1>Perfil e empresa</h1>
      </header>

      {msg && (
        <p role="status" className="cfg-msg">
          {msg}
        </p>
      )}

      <nav aria-label="Seções de configuração" className="cfg-lista">
        {SECOES.map((s) => (
          <Link key={s.href} href={s.href} className="cfg-item">
            <span className="cfg-item-texto">
              <span className="cfg-item-nome">{s.nome}</span>
              <span className="cfg-item-desc">{s.desc}</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M9 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        ))}
      </nav>

      <div className="cfg-grid">
        <div className="cfg-coluna">
          <Card className="cfg-card">
            <Rotulo>Meu perfil</Rotulo>
            <label className="cfg-campo">
              <span>Nome</span>
              <input
                id="cfg-nome"
                value={profile?.full_name ?? ''}
                onChange={(e) => onProfile({ full_name: e.target.value })}
                autoComplete="name"
              />
            </label>
            <label className="cfg-campo">
              <span>Cargo</span>
              <input
                id="cfg-cargo"
                value={profile?.cargo ?? ''}
                onChange={(e) => onProfile({ cargo: e.target.value })}
                autoComplete="organization-title"
              />
            </label>
            <label className="cfg-campo">
              <span>Telefone</span>
              <input
                id="cfg-telefone"
                type="tel"
                inputMode="tel"
                value={profile?.telefone ?? ''}
                onChange={(e) => onProfile({ telefone: e.target.value })}
                autoComplete="tel"
              />
            </label>
            <button type="button" className="cfg-botao" onClick={onSalvarPerfil}>
              Salvar perfil
            </button>
          </Card>

          <Card className="cfg-card">
            <div className="cfg-card-topo">
              <Rotulo>Empresa</Rotulo>
              {!isAdmin && <Pilula>Só admin edita</Pilula>}
            </div>
            <fieldset disabled={!isAdmin} className="cfg-fieldset">
              <label className="cfg-campo">
                <span>Nome fantasia</span>
                <input
                  id="cfg-fantasia"
                  value={org?.nome_fantasia ?? ''}
                  onChange={(e) => onOrg({ nome_fantasia: e.target.value })}
                />
              </label>
              <label className="cfg-campo">
                <span>CNPJ</span>
                <input
                  id="cfg-cnpj"
                  inputMode="numeric"
                  value={org?.cnpj ?? ''}
                  onChange={(e) => onOrg({ cnpj: e.target.value })}
                />
              </label>
              <div className="cfg-linha">
                <label className="cfg-campo">
                  <span>Cidade</span>
                  <input
                    id="cfg-cidade"
                    value={org?.cidade ?? ''}
                    onChange={(e) => onOrg({ cidade: e.target.value })}
                  />
                </label>
                <label className="cfg-campo">
                  <span>UF</span>
                  <input
                    id="cfg-uf"
                    maxLength={2}
                    value={org?.uf ?? ''}
                    onChange={(e) => onOrg({ uf: e.target.value.toUpperCase() })}
                  />
                </label>
              </div>
              <label className="cfg-campo">
                <span>Site</span>
                <input
                  id="cfg-site"
                  type="url"
                  inputMode="url"
                  value={org?.site ?? ''}
                  onChange={(e) => onOrg({ site: e.target.value })}
                />
              </label>

              <div className="cfg-campo">
                <span>Cor de destaque</span>
                <label className="cfg-cor">
                  <span
                    className="cfg-cor-amostra"
                    style={{ background: org?.accent_color ?? '#94efda' }}
                  />
                  <Pilula mono>{(org?.accent_color ?? '#94efda').toUpperCase()}</Pilula>
                  <span className="cfg-cor-dica">Toque para trocar</span>
                  <input
                    id="cfg-cor"
                    type="color"
                    value={org?.accent_color ?? '#94efda'}
                    onChange={(e) => onOrg({ accent_color: e.target.value })}
                  />
                </label>
              </div>

              <label className="cfg-campo">
                <span>Modelo de PDF</span>
                <select
                  id="cfg-modelo"
                  value={org?.pdf_template ?? 'executiva'}
                  onChange={(e) => onOrg({ pdf_template: e.target.value as PdfTemplate })}
                >
                  <option value="executiva">Executiva (padrão)</option>
                  <option value="formal">Formal</option>
                  <option value="painel">Painel</option>
                </select>
              </label>

              <div className="cfg-campo">
                <span>Logomarca</span>
                <div className="cfg-logo">
                  {logoPreview ? (
                    <img src={logoPreview} alt="" className="cfg-logo-thumb" />
                  ) : (
                    <span className="cfg-logo-thumb cfg-logo-iniciais" aria-hidden="true">
                      {iniciais}
                    </span>
                  )}
                  <label className="cfg-botao-sec">
                    {logoPreview || org?.logo_url ? 'Trocar logomarca' : 'Enviar logomarca'}
                    <input
                      id="cfg-logo"
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])}
                    />
                  </label>
                  <span className="cfg-cor-dica">PNG ou SVG; aparece no PDF da ata</span>
                </div>
              </div>

              <button type="button" className="cfg-botao" onClick={onSalvarEmpresa}>
                Salvar empresa
              </button>
            </fieldset>
          </Card>
        </div>

        <Card className="cfg-card cfg-previa">
          <div className="cfg-card-topo">
            <Rotulo>Prévia do PDF</Rotulo>
            <button
              type="button"
              className="cfg-previa-toggle"
              aria-expanded={previaAberta}
              onClick={() => setPreviaAberta((v) => !v)}
            >
              {previaAberta ? 'Ocultar' : 'Ver prévia'}
            </button>
          </div>
          <div className={previaAberta ? 'cfg-previa-corpo aberta' : 'cfg-previa-corpo'}>
            {previewHtml ? (
              <iframe title="Prévia da ata" srcDoc={previewHtml} sandbox="" />
            ) : (
              <p className="cfg-cor-dica" style={{ padding: 16 }}>
                A prévia aparece quando os dados da empresa carregarem.
              </p>
            )}
          </div>
        </Card>
      </div>

      <VersaoApp />
    </div>
  );
}
