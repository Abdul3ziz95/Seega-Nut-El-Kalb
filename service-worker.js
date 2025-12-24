
const CACHE_NAME = 'nut-el-kalb-v2'; // 🛑 تم تغيير اسم الكاش لإجبار المتصفح على التحديث 🛑
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/icon.png' // 🟢 تم إضافة مسار الأيقونة (كما هو محدد في manifest.json) 🟢
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

// تفعيل ملف الخدمة وحذف أي نسخ قديمة من الذاكرة المؤقتة
self.addEventListener('activate', event => {
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
});

// استراتيجية "Cache-first" (الاستخدام من الكاش أولاً، ثم الشبكة إذا لم يكن متوفراً)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // الكاش موجود، قم بعرضه
                if (response) {
                    return response;
                }
                // الكاش غير موجود، اذهب للشبكة
                return fetch(event.request);
            })
    );
});
