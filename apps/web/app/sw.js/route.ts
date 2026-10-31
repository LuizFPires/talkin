/**
 * Service worker do Talkin (M9), servido por rota para carregar a versão do
 * build. Como o conteúdo muda a cada deploy, o navegador detecta a versão nova
 * e o app mostra o aviso "Atualizar" (components/sw-register.tsx).
 *
 * NÃO cacheia HTML/navegação autenticada nem /api — só estáticos públicos.
 * Offline mostra uma página genérica, sem dados do usuário.
 */
export const dynamic = 'force-static';

const VERSAO = process.env.NEXT_PUBLIC_VERSAO ?? 'dev';

const SCRIPT = `// Talkin SW · versão ${VERSAO}
const CACHE = 'talkin-${VERSAO}';
const PRECACHE = ['/offline', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Só estáticos públicos entram no cache (nunca HTML autenticado nem dados). */
function estaticoPublico(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/icon.svg' ||
    url.pathname === '/manifest.webmanifest'
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // uploads/POST sempre na rede
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // API nunca é cacheada

  // Navegação: só rede; offline → página genérica (não serve HTML de outro usuário).
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/offline')));
    return;
  }

  if (!estaticoPublico(url)) return; // demais (RSC, dados) passam direto

  // Estáticos: cache-first, só respostas básicas e OK.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      // O navegador precisa reler o sw.js para perceber a versão nova.
      'cache-control': 'no-cache, max-age=0',
      'service-worker-allowed': '/',
    },
  });
}
