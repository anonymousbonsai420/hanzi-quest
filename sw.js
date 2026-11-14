// Service worker: permite usar o app offline.
// Arquivos do app: rede primeiro (sempre atualizado), cache como reserva.
// CDN (Hanzi Writer, dados de traços, fontes): cache primeiro.
const CACHE = 'hanziquest-v4';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'icon.svg',
  'css/base.css', 'css/components.css', 'css/exercises/blocks.css', 'css/exercises/build.css',
  'css/exercises/intro.css', 'css/exercises/match.css', 'css/exercises/pinyin.css', 'css/exercises/speak.css',
  'css/exercises/tone.css', 'css/exercises/write.css', 'css/friend-mode.css', 'css/guide.css',
  'css/layout.css', 'css/screens/collection.css', 'css/screens/onboarding.css', 'css/screens/path.css',
  'css/screens/practice.css', 'css/screens/profile.css', 'css/screens/review.css', 'css/session/results.css',
  'css/session/session.css', 'css/session/speed.css', 'css/session/tone-mirror.css', 'css/writer.css',
  'js/app.js', 'js/audio.js', 'js/builder.js', 'js/data.js',
  'js/exercises/blocks.js', 'js/exercises/build.js', 'js/exercises/index.js', 'js/exercises/intro.js',
  'js/exercises/listen.js', 'js/exercises/match.js', 'js/exercises/meaning.js', 'js/exercises/pinyin.js',
  'js/exercises/speak.js', 'js/exercises/tone.js', 'js/exercises/write.js', 'js/friend-mode/actions.js',
  'js/friend-mode/admin.js', 'js/friend-mode/cloud.js', 'js/friend-mode/compare.js', 'js/friend-mode/config.js',
  'js/friend-mode/forms.js', 'js/friend-mode/screen.js', 'js/game.js', 'js/guide.js',
  'js/lib/dom.js', 'js/lib/events.js', 'js/lib/random.js', 'js/lib/time.js',
  'js/pinyin.js', 'js/pitch.js', 'js/screens/collection.js', 'js/screens/onboarding.js',
  'js/screens/path.js', 'js/screens/practice.js', 'js/screens/profile.js', 'js/screens/rerender.js',
  'js/screens/review.js', 'js/session/overlay.js', 'js/session/runner.js', 'js/session/speed.js',
  'js/session/tone-mirror.js', 'js/speech.js', 'js/srs.js', 'js/state.js',
  'js/theme.js', 'js/ui/confetti.js', 'js/ui/heatmap.js', 'js/ui/modal.js',
  'js/ui/share.js', 'js/ui/toast.js', 'js/writer.js',
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
