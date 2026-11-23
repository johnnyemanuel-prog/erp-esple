/* Esplêndida: service worker. Deixa o app abrir e funcionar sem internet.
 * Os dados ficam no IndexedDB (Dexie); aqui só guardamos as telas e seus arquivos. */
const VERSAO = new URL(self.location).searchParams.get("v") || "dev";
const CACHE = `esplendida-${VERSAO}`;
// Modelo de IA e motor (~50 MB): cache próprio, que não é apagado a cada versão do app.
// O nome da pasta muda se o modelo mudar (ver scripts/preparar-ia.mjs).
const CACHE_IA = "esplendida-ia-v1";
const ROTAS = ["/", "/entrar", "/nova-senha", "/sessoes", "/sessao", "/cadastro", "/pendencias", "/modelo", "/consulta", "/etiquetas", "/mais"];
const EXTRAS = ["/manifest.webmanifest", "/icone-192.png", "/icone-512.png", "/logo.png", "/apple-touch-icon.png"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const arquivos = new Set(EXTRAS);
      for (const rota of ROTAS) {
        try {
          const resp = await fetch(rota, { cache: "reload", credentials: "same-origin" });
          if (!resp.ok) continue;
          const html = await resp.clone().text();
          await cache.put(rota, resp);
          for (const m of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) arquivos.add(m[0]);
        } catch {}
      }
      // Os CSS citam as fontes (/_next/static/media/...): guarda também.
      for (const u of [...arquivos].filter((a) => a.endsWith(".css"))) {
        try {
          const css = await (await fetch(u)).text();
          for (const m of css.matchAll(/\/_next\/static\/media\/[^"'\s)]+/g)) arquivos.add(m[0]);
        } catch {}
      }
      await Promise.all(
        [...arquivos].map((u) =>
          fetch(u).then((r) => (r.ok ? cache.put(u, r) : null)).catch(() => null),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      for (const nome of await caches.keys()) if (nome !== CACHE && nome !== CACHE_IA) await caches.delete(nome);
      await self.clients.claim();
    })(),
  );
});

function comTempo(promessa, ms) {
  return Promise.race([promessa, new Promise((_, erro) => setTimeout(() => erro(new Error("tempo")), ms))]);
}

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase e afins: direto para a rede
  if (url.pathname.startsWith("/api/")) return;

  // Navegação entre telas: tenta a rede (versão nova), cai para a guardada sem internet.
  if (req.mode === "navigate") {
    evento.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const resp = await comTempo(fetch(req), 4000);
          if (resp.ok) cache.put(url.pathname, resp.clone());
          return resp;
        } catch {
          return (await cache.match(url.pathname)) || (await cache.match("/")) || Response.error();
        }
      })(),
    );
    return;
  }

  // Dados de navegação do Next (RSC): sem internet, falha e o Next recarrega a tela (vinda do cache).
  if (req.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  // Arquivos com hash no nome, o modelo de IA e o motor nunca mudam: primeiro o cache.
  const ehIA = url.pathname.startsWith("/modelos/") || url.pathname.startsWith("/ort/");
  if (url.pathname.startsWith("/_next/static/") || ehIA) {
    evento.respondWith(
      (async () => {
        const cache = await caches.open(ehIA ? CACHE_IA : CACHE);
        const guardado = await cache.match(url.pathname);
        if (guardado) return guardado;
        const resp = await fetch(req);
        if (resp.ok) cache.put(url.pathname, resp.clone());
        return resp;
      })(),
    );
    return;
  }

  // Ícones, manifesto e outros: usa o guardado e atualiza por trás.
  evento.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const guardado = await cache.match(url.pathname);
      const rede = fetch(req)
        .then((r) => {
          if (r.ok) cache.put(url.pathname, r.clone());
          return r;
        })
        .catch(() => guardado || Response.error());
      return guardado || rede;
    })(),
  );
});
