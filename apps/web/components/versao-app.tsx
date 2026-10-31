'use client';

import { useState } from 'react';
import { Card, Pilula, Rotulo } from '@talkin/ui';

const VERSAO_LOCAL = process.env.NEXT_PUBLIC_VERSAO ?? 'dev';

type Estado =
  | { tipo: 'parado' }
  | { tipo: 'verificando' }
  | { tipo: 'atual' }
  | { tipo: 'nova'; versao: string }
  | { tipo: 'erro' };

/**
 * Card "Versão do app" em Configurações: mostra a versão carregada e um botão
 * para verificar na hora. Compara a versão embutida neste JS com a que o
 * servidor está servindo em /sw.js (muda a cada deploy); se diferem, oferece
 * Atualizar (recarrega). Complementa o aviso automático do sw-register.
 */
export function VersaoApp() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'parado' });

  async function verificar() {
    setEstado({ tipo: 'verificando' });
    try {
      // Pede ao navegador que reinstale o SW se houver um novo (acelera o aviso automático).
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update().catch(() => {});
      }
      const res = await fetch(`/sw.js?v=${Date.now()}`, { cache: 'no-store' });
      const texto = await res.text();
      const m = /versão\s+(\S+)/.exec(texto);
      const remota = m?.[1];
      if (!remota) throw new Error('sem versão');
      setEstado(remota === VERSAO_LOCAL ? { tipo: 'atual' } : { tipo: 'nova', versao: remota });
    } catch {
      setEstado({ tipo: 'erro' });
    }
  }

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Rotulo>Versão do app</Rotulo>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Pilula mono>{VERSAO_LOCAL}</Pilula>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1, minWidth: 160 }}>
          {estado.tipo === 'parado' && 'Versão carregada neste aparelho.'}
          {estado.tipo === 'verificando' && 'Verificando…'}
          {estado.tipo === 'atual' && 'Você já está na versão mais recente.'}
          {estado.tipo === 'nova' && (
            <>
              Nova versão disponível:{' '}
              <strong style={{ color: 'var(--text)' }}>{estado.versao}</strong>
            </>
          )}
          {estado.tipo === 'erro' && 'Não consegui verificar agora. Tente de novo.'}
        </span>
        {estado.tipo === 'nova' ? (
          <button
            type="button"
            className="versao-atualizar"
            onClick={() => window.location.reload()}
          >
            Atualizar
          </button>
        ) : (
          <button
            type="button"
            className="versao-verificar"
            onClick={verificar}
            disabled={estado.tipo === 'verificando'}
          >
            Verificar atualização
          </button>
        )}
      </div>
    </Card>
  );
}
