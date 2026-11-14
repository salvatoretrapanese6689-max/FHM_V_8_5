/* Family Hub Manager - service worker (v7.1)
   Non tocca mai i dati dell'app (localStorage / IndexedDB): serve solo per
   rendere l'app installabile e farla aprire anche senza rete. */
const VER = 'fhm-7.2';
const FONTS = 'fhm-fonts';
const SHELL = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VER)
      .then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VER && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function openApp(req) {
  const c = await caches.open(VER);
  try {
    const res = await Promise.race([
      fetch(req.url, { cache: 'no-cache' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
    ]);
    if (res && res.ok) { await c.put('./index.html', res.clone()); return res; }
  } catch (err) { /* offline o rete lenta: uso la copia salvata */ }
  return (await c.match('./index.html')) || Response.error();
}

async function staticFirst(req) {
  const c = await caches.open(VER);
  const hit = await c.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) c.put(req, res.clone());
  return res;
}

async function fontsSWR(req) {
  const c = await caches.open(FONTS);
  const hit = await c.match(req);
  const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (req.mode === 'navigate' && u.origin === location.origin) { e.respondWith(openApp(req)); return; }
  if (u.origin === location.origin) { e.respondWith(staticFirst(req)); return; }
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') { e.respondWith(fontsSWR(req)); }
});
