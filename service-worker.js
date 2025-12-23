
// ===================================
// Service Worker Code
// ===================================

// 🛑 قم بزيادة رقم الإصدار إلى v5 لضمان تجاوز كل النسخ القديمة 🛑
const CACHE_NAME = 'nut-el-kalb-v5'; 

const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/icon.png' 
];

self.addEventListener('install', event => {
    console.log('[Service Worker] Installing Cache V5...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});

// تفعيل ملف الخدمة وحذف أي نسخ قديمة من الذاكرة المؤقتة
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating V5 and cleaning up old caches...');
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // حذف أي كاش لا يطابق اسم الإصدار الحالي (v5)
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// استراتيجية "Cache-first"
self.addEventListener('fetch', event => {
    if (event.request.url.includes('chrome-extension://')) return;

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});
