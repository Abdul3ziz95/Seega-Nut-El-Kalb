
// ===================================
// Service Worker Code
// ===================================

// 🛑 قم بزيادة رقم الإصدار إلى v10 لضمان تجاوز كل النسخ القديمة بقوة 🛑
const CACHE_NAME = 'nut-el-kalb-v10'; 

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
    console.log('[Service Worker V10] Installing new cache...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});

// تفعيل ملف الخدمة وحذف أي نسخ قديمة من الذاكرة المؤقتة
self.addEventListener('activate', event => {
    console.log('[Service Worker V10] Activating and cleaning up old caches...');
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // لضمان التفعيل الفوري للملف الجديد
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
