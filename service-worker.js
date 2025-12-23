// ===================================
// Service Worker Code
// ===================================

// 🛑 تم تحديث اسم الكاش لإجبار المتصفح على تحميل الملفات الجديدة 🛑
const CACHE_NAME = 'nut-el-kalb-v3'; 

const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/icon.png' // لتخزين الأيقونة مؤقتاً
];

// تثبيت ملف الخدمة وتخزين الأصول (Assets)
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Opened cache, adding core assets.');
                return cache.addAll(urlsToCache);
            })
            .catch(err => {
                console.error('[Service Worker] Cache installation failed:', err);
            })
    );
});

// تفعيل ملف الخدمة وحذف أي نسخ قديمة من الذاكرة المؤقتة
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating and cleaning up old cache...');
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // حذف أي كاش لا يطابق اسم الإصدار الحالي (v3)
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // ضمان التفعيل الفوري للملف الجديد
    return self.clients.claim();
});

// استراتيجية "Cache-first, then Network"
self.addEventListener('fetch', event => {
    // تجاهل طلبات الأيقونة إذا لم تكن موجودة في الكاش
    if (event.request.url.includes('chrome-extension://')) return;

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // الكاش موجود، قم بعرضه
                if (response) {
                    return response;
                }
                
                // إذا لم يكن الكاش موجوداً، اذهب إلى الشبكة
                return fetch(event.request).catch(error => {
                    console.log('Fetch failed for:', event.request.url, error);
                    // يمكنك هنا عرض صفحة "غير متصل" إذا أردت
                });
            })
    );
});

