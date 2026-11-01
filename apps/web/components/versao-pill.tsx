'use client';

import { useEffect, useState } from 'react';
import { VERSAO_LOCAL, versaoNoServidor } from '@/lib/versao';

type Estado = 'parado' | 'verificando' | 'atual' | 'nova' | 'erro';

/**
 * Versão do app sempre à vista (topo da tela). Um toque verifica na hora:
 * se há versão nova, dispara o aviso "Nova versão disponível · Atualizar";
 * se não, confirma por alguns segundos que esta é a mais recente.
 */
export function VersaoPill() {
  const [estado, setEstado] = useState<Estado>('parado');

  useEffect(() => {
    if (estado !== 'atual' && estado !== 'erro') return;
    const t = setTimeout(() => setEstado('parado'), 2500);
    return () => clearTimeout(t);
  }, [estado]);

  async function verificar() {
    if (estado === 'verificando') return;
    setEstado('verificando');
    const remota = await versaoNoServidor();
    if (!remota) return setEstado('erro');
    if (remota === VERSAO_LOCAL) return setEstado('atual');
    setEstado('nova');
    window.dispatchEvent(new CustomEvent('talkin:versao-nova'));
  }

  const texto =
    estado === 'verificando'
      ? 'verificando…'
      : estado === 'atual'
        ? 'versão mais recente ✓'
        : estado === 'nova'
          ? 'versão nova disponível'
          : estado === 'erro'
            ? 'sem conexão'
            : VERSAO_LOCAL;

  return (
    <button
      type="button"
      className={`versao-pill${estado !== 'parado' ? ' ativa' : ''}`}
      onClick={() => void verificar()}
      title="Versão do app · toque para verificar atualização"
      aria-label={`Versão ${VERSAO_LOCAL}. Toque para verificar atualização.`}
    >
      {texto}
    </button>
  );
}
