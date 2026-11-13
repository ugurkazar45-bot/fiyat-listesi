// MESAN Fiyat Asistanı — service worker (V24)
// Amaç: uygulama internetsiz de açılsın. Fiyat ve maliyet verisi burada saklanmaz;
// onlar girişten sonra Firestore'dan gelir ve sayfanın kendi cihaz önbelleğinde durur.
// • Sayfa (index.html): önce ağ, yoksa son kopya → yeni sürüm hemen gelir.
// • CDN kütüphaneleri ve yazı tipleri: önce önbellek (sürüm numaralı adresler, değişmez).
// • Firestore / giriş istekleri: hiç dokunulmaz.
const SURUM = 'v24-1';
const SAYFA_ONBELLEK = 'sayfa-' + SURUM;
const KUTUPHANE_ONBELLEK = 'kutuphane-v1';
const KABUK = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const KUTUPHANE_KAYNAKLARI = ['cdnjs.cloudflare.com', 'www.gstatic.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SAYFA_ONBELLEK).then(c => c.addAll(KABUK)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(adlar => Promise.all(adlar
        .filter(ad => ad !== SAYFA_ONBELLEK && ad !== KUTUPHANE_ONBELLEK)
        .map(ad => caches.delete(ad))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const istek = e.request;
  if (istek.method !== 'GET') return;
  const url = new URL(istek.url);

  // Sayfanın kendisi ve aynı klasördeki dosyalar: önce ağ
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(istek)
        .then(yanit => {
          if (yanit.ok) {
            const kopya = yanit.clone();
            caches.open(SAYFA_ONBELLEK).then(c => c.put(istek.mode === 'navigate' ? './' : istek, kopya));
          }
          return yanit;
        })
        .catch(() => caches.match(istek.mode === 'navigate' ? './' : istek, { ignoreSearch: true }))
    );
    return;
  }

  // Sürüm numaralı kütüphaneler: önce önbellek
  if (KUTUPHANE_KAYNAKLARI.includes(url.hostname)) {
    e.respondWith(
      caches.match(istek).then(kayit => kayit || fetch(istek).then(yanit => {
        if (yanit.ok || yanit.type === 'opaque') {
          const kopya = yanit.clone();
          caches.open(KUTUPHANE_ONBELLEK).then(c => c.put(istek, kopya));
        }
        return yanit;
      }))
    );
  }
  // Diğer her şey (Firestore, giriş, WhatsApp): tarayıcıya bırakılır
});
