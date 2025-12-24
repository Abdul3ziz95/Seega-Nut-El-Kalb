
// ===================================
// Service Worker Code
// ===================================

// 🛑 العودة إلى الإصدار الأصلي (الأكثر أماناً للعودة) 🛑
const CACHE_NAME = 'nut-el-kalb-v1'; 

const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/icon.png' 
];

// تثبيت ملف الخدمة وتخزين الأصول (Assets)
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// تفعيل ملف الخدمة وحذف أي نسخ جديدة
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // حذف أي كاش لا يطابق اسم الإصدار الحالي (v1)
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
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
