// Service worker: permite usar o app offline.
// Arquivos do app: rede primeiro (sempre atualizado), cache como reserva.
// CDN (Hanzi Writer, dados de traços, fontes): cache primeiro.
const CACHE = 'hanziquest-v1';
const SHELL = [
  './', 'index.html', 'css/styles.css', 'manifest.webmanifest', 'icon.svg',
  'js/app.js', 'js/util.js', 'js/data.js', 'js/pinyin.js', 'js/state.js', 'js/srs.js', 'js/game.js',
  'js/audio.js', 'js/speech.js', 'js/pitch.js', 'js/writer.js', 'js/ui.js', 'js/exercises.js',
  'js/builder.js', 'js/session.js', 'js/screens.js', 'js/guide.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const cdn = /cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (cdn) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') caches.open(CACHE).then((c) => c.put(req, res.clone()));
      return res;
    })));
  } else if (url.origin === location.origin) {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('index.html'))));
  }
});
