/* 出走前チェックリスト - オフラインキャッシュ
   更新時は CACHE のバージョン番号を上げてから再デプロイすること
   (pre.html の画面下に出る「版」の表示も同じ番号に合わせる) */
const CACHE = "checklist-v70";
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
      /* addAll は1つでも取得に失敗すると install ごと失敗し、古いSWが
         残り続けて更新が止まる。1件ずつ入れて失敗は握りつぶす。
         cache:"reload" でHTTPキャッシュを迂回し、必ず新しい実体を取る */
      .then(c => Promise.all(
        ASSETS.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {}))
      ))
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

  /* 外部への通信(気象API など)はSWを素通りさせる。
     ここで扱うと失敗時に index.html を返してしまい、JSONとして読めなくなる */
  if (new URL(e.request.url).origin !== self.location.origin) return;

  /* index.html と pre.html はどちらもネットワーク優先で最新を即反映する。
     pre.html は iframe のサブ文書だが同じく navigate なので同じ扱いにする。
     取得したものは「そのページ自身のキー」に保存する
     (以前はどちらも ./index.html のキーに入れていたため、pre.html を
      ネットワーク優先にできず、キャッシュが入れ替わるまで古いままだった) */
  if (e.request.mode === "navigate") {
    const key = /pre\.html$/.test(new URL(e.request.url).pathname)
      ? "./pre.html" : "./index.html";
    /* 毎回ユニークなクエリを付けてCDN・HTTPキャッシュを完全に素通りし、
       デプロイ直後でも即座に最新を取得する */
    const bustURL = new URL(e.request.url);
    bustURL.searchParams.set("t", Date.now());
    e.respondWith(
      Promise.race([
        fetch(bustURL, { cache: "no-store" }).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(key, copy));
          return res;
        }),
        new Promise(resolve => setTimeout(() => resolve(null), 2500))
      ])
        .then(res => res || caches.match(key, { ignoreSearch: true }))
        .catch(() => caches.match(key, { ignoreSearch: true }))
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
