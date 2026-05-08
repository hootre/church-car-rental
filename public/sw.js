// =====================================================
// Service Worker - 한국중앙교회 차량부
//
// 캐싱 전략:
// - HTML 페이지(navigation)  : Network First  -> 항상 최신 코드 적용
// - API / Supabase           : 네트워크만     -> 캐시 안 함
// - 정적 자원(이미지, 아이콘) : Cache First   -> 빠른 로딩
// - JS/CSS 청크              : Cache First   -> Next.js 가 파일명에 hash 를 넣어주므로 안전
//
// 캐시 이름은 새 배포에서 변경 사항이 있을 때 v3, v4, ... 로 올려 주세요.
// (이전 캐시는 activate 시 자동 삭제됩니다)
// =====================================================
const CACHE_NAME = "church-car-v2";

// 사전 캐시할 자원 (HTML 페이지는 의도적으로 제외 - 항상 네트워크에서 받기)
const PRECACHE_ASSETS = [
  "/manifest.json",
  "/logo.png",
  "/logo_dark.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// 설치 - 정적 자원 캐시
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch(() => {
            /* 일부 자원 누락은 치명적이지 않음 */
          })
        )
      )
    )
  );
  self.skipWaiting();
});

// 활성화 - 이전 캐시 정리
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// fetch 핸들러
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // GET 만 캐시 (POST/PUT 등은 네트워크 직행)
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 동일 출처가 아니면 SW 가 관여하지 않음 (Supabase, 외부 CDN 등)
  if (url.origin !== self.location.origin) return;

  // /api/* 는 항상 네트워크
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // HTML 페이지 (navigation) -> Network First, 실패 시 캐시
  const acceptHeader = request.headers.get("accept") || "";
  const isNavigation =
    request.mode === "navigate" || acceptHeader.includes("text/html");

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  // 그 외 정적 자원(이미지, JS, CSS, 폰트 등) -> Cache First
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// 페이지에서 즉시 활성화를 요청할 때
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
