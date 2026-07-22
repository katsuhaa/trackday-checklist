/* 出走前チェックリスト - オフラインキャッシュ
   更新時は CACHE のバージョン番号を上げてから再デプロイすること */
const CACHE = "checklist-v51";
const ASSETS = [
  "./",
  "./index.html",
  "./pre.html",
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

  /* アプリ本体(index.html)だけネットワーク優先で最新を即反映。
     pre.html は iframe のサブ文書なのでシェル扱いにしない
     (ここでネットワーク優先にすると index.html のキャッシュを上書きしてしまう) */
  const isSubDoc = /pre\.html$/.test(new URL(e.request.url).pathname);
  if (e.request.mode === "navigate" && !isSubDoc) {
    /* 毎回ユニークなクエリを付けてCDN・HTTPキャッシュを完全に素通りし、
       デプロイ直後でも即座に最新を取得する */
    const bustURL = new URL(e.request.url);
    bustURL.searchParams.set("t", Date.now());
    e.respondWith(
      Promise.race([
        fetch(bustURL, { cache: "no-store" }).then(res => {
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
