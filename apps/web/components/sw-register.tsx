'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const CHECAGEM_MS = 5 * 60 * 1000;

/**
 * Registra o service worker (só em produção/HTTPS) e avisa quando há versão
 * nova, com um botão para recarregar. Nunca recarrega sozinho: o usuário pode
 * estar gravando. Em /gravar o aviso fica escondido pelo mesmo motivo.
 *
 * Como funciona: /sw.js carrega a versão do build; a cada deploy os bytes
 * mudam, o navegador instala o SW novo (que assume na hora) e dispara
 * `controllerchange` — é esse o sinal de "versão nova". Além do check que o
 * navegador faz ao abrir, pedimos `update()` ao voltar para o app e a cada
 * 5 min, porque PWAs instalados ficam dias sem reabrir.
 */
export function SWRegister() {
  const [novaVersao, setNovaVersao] = useState(false);
  const [dispensado, setDispensado] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const sw = navigator.serviceWorker;
    let reg: ServiceWorkerRegistration | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;

    // Só é "versão nova" se já havia um SW controlando esta página
    // (na primeira instalação o controllerchange também dispara).
    const tinhaControlador = Boolean(sw.controller);
    const onControllerChange = () => {
      if (tinhaControlador) setNovaVersao(true);
    };
    sw.addEventListener('controllerchange', onControllerChange);

    const checar = () => {
      if (document.visibilityState === 'visible') reg?.update().catch(() => {});
    };
    const onVisivel = () => checar();

    const onLoad = () => {
      sw.register('/sw.js')
        .then((r) => {
          reg = r;
          // SW novo já esperando (ex.: instalado em outra aba) → avisa.
          if (r.waiting && sw.controller) setNovaVersao(true);
          timer = setInterval(checar, CHECAGEM_MS);
          document.addEventListener('visibilitychange', onVisivel);
        })
        .catch(() => {});
    };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });

    return () => {
      window.removeEventListener('load', onLoad);
      sw.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisivel);
      if (timer) clearInterval(timer);
    };
  }, []);

  // Em /gravar nunca aparece: recarregar perderia o bloco em andamento.
  if (!novaVersao || dispensado || pathname?.startsWith('/gravar')) return null;

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
