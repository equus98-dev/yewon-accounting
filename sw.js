const CACHE_NAME = 'yewon-erp-v25.0';

// 서비스 워커 설치 시 즉시 활성화
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// 활성화 시 이전 캐시 삭제
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 네트워크 우선 전략 (또는 캐시 무시 전략 - 해시 파일 덕분에 항상 새 파일임)
self.addEventListener('fetch', (event) => {
    // 해시 파일은 브라우저 캐시를 써도 되지만, sw 캐시는 신중히 처리
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
