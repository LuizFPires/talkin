'use client';

import { useEffect, useState } from 'react';
import { VERSAO_LOCAL, versaoNoServidor } from '@/lib/versao';

const CHECAGEM_MS = 5 * 60 * 1000;

/**
 * Registra o service worker (só em produção/HTTPS) e avisa quando há versão
 * nova, com um botão para recarregar. Nunca recarrega sozinho: o usuário pode
 * estar gravando — enquanto uma gravação está em andamento (o /gravar marca
 * `data-gravando` no <html> e dispara `talkin:gravacao`), o aviso fica escondido.
 *
 * Como detecta: (1) compara a versão embutida neste JS com a que o servidor
 * está servindo em /sw.js — ao abrir, ao voltar para o app e a cada 5 min;
 * (2) escuta o `controllerchange` do SW (instalação de um SW novo); (3) aceita
 * o evento `talkin:versao-nova` disparado pelo botão de versão no topo.
 */
export function SWRegister() {
  const [novaVersao, setNovaVersao] = useState(false);
  const [dispensado, setDispensado] = useState(false);
  const [gravando, setGravando] = useState(false);

  useEffect(() => {
    const onGravacao = (ev: Event) => setGravando(Boolean((ev as CustomEvent<boolean>).detail));
    const onNova = () => setNovaVersao(true);
    window.addEventListener('talkin:gravacao', onGravacao);
    window.addEventListener('talkin:versao-nova', onNova);
    setGravando(document.documentElement.dataset.gravando === '1');
    return () => {
      window.removeEventListener('talkin:gravacao', onGravacao);
      window.removeEventListener('talkin:versao-nova', onNova);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    let reg: ServiceWorkerRegistration | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let ativo = true;

    // Comparação direta de versão: independe do tempo do navegador instalar o SW.
    const compararVersao = async () => {
      if (document.visibilityState !== 'visible') return;
      const remota = await versaoNoServidor();
      if (ativo && remota && remota !== VERSAO_LOCAL) setNovaVersao(true);
    };

    const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
    // Só é "versão nova" se já havia um SW controlando esta página
    // (na primeira instalação o controllerchange também dispara).
    const tinhaControlador = Boolean(sw?.controller);
    const onControllerChange = () => {
      if (tinhaControlador) setNovaVersao(true);
    };
    sw?.addEventListener('controllerchange', onControllerChange);

    const checar = () => {
      if (document.visibilityState !== 'visible') return;
      reg?.update().catch(() => {});
      void compararVersao();
    };
    const onVisivel = () => checar();

    const onLoad = () => {
      void compararVersao();
      timer = setInterval(checar, CHECAGEM_MS);
      document.addEventListener('visibilitychange', onVisivel);
      sw
        ?.register('/sw.js')
        .then((r) => {
          reg = r;
          // SW novo já esperando (ex.: instalado em outra aba) → avisa.
          if (r.waiting && sw.controller) setNovaVersao(true);
        })
        .catch(() => {});
    };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });

    return () => {
      ativo = false;
      window.removeEventListener('load', onLoad);
      sw?.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisivel);
      if (timer) clearInterval(timer);
    };
  }, []);

  // Durante uma gravação nunca aparece: recarregar perderia o bloco em andamento.
  if (!novaVersao || dispensado || gravando) return null;

  return (
    <div className="sw-atualizar" role="status" aria-live="polite">
      <span>Nova versão disponível</span>
      <button type="button" onClick={() => window.location.reload()}>
        Atualizar
      </button>
      <button type="button" className="depois" onClick={() => setDispensado(true)}>
        Depois
      </button>
    </div>
  );
}
