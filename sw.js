/* 出走前チェックリスト - オフラインキャッシュ
   更新時は CACHE のバージョン番号を上げてから再デプロイすること */
const CACHE = "checklist-v22";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  /* ページ本体はネットワーク優先(最新をすぐ反映)。
     2.5秒以内に取れない・圏外のときはキャッシュで表示 */
  if (e.request.mode === "navigate") {
    e.respondWith(
      Promise.race([
        fetch(e.request).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put("./index.html", copy));
          return res;
        }),
        new Promise(resolve => setTimeout(() => resolve(null), 2500))
      ])
        .then(res => res || caches.match("./index.html", { ignoreSearch: true }))
        .catch(() => caches.match("./index.html", { ignoreSearch: true }))
    );
    return;
  }

  /* その他のファイルは従来どおりキャッシュ優先 */
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit =>
      hit || fetch(e.request).catch(() => caches.match("./index.html"))
    )
  );
});
