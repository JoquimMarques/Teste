// Service Worker para PWA Briolink
const CACHE_NAME = 'briolink-v1.0.0';
const APP_VERSION = '1.0.0'; // Atualizar este número a cada deploy
const urlsToCache = [
    '/',
    '/index.html',
    '/src/css/styles.css',
    '/src/css/auth-styles.css',
    '/src/js/script-corrected.js',
    '/src/js/supabase-config.js',
    '/favicon_io-22/android-chrome-192x192.png',
    '/favicon_io-22/android-chrome-512x512.png',
    '/favicon_io-22/apple-touch-icon.png',
    '/favicon_io-22/favicon.ico',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Audiowide&display=swap',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
    console.log('Service Worker: Instalando versão', APP_VERSION);
    // Forçar instalação imediata, sem esperar outros service workers
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Cache aberto');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker: Cache populado com sucesso');
                // Ativar imediatamente, sem esperar
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Erro ao popular cache:', error);
            })
    );
});

// Listener para mensagens do cliente (para forçar atualização)
self.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Ativando...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Removendo cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Ativado com sucesso');
            return self.clients.claim();
        })
    );
});

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Network-first para páginas HTML (garante atualização de conteúdo)
    const isDocument = req.mode === 'navigate' || req.destination === 'document' || (req.headers.get('accept') || '').includes('text/html');
    if (isDocument) {
        event.respondWith(
            fetch(req)
                .then((networkRes) => {
                    const resClone = networkRes.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put('/', resClone).catch(() => {}));
                    return networkRes;
                })
                .catch(() => caches.match(req).then(r => r || caches.match('/index.html')))
        );
        return;
    }

    // Network-first para APIs (Supabase)
    if (req.url.includes('supabase') || req.url.includes('api')) {
        event.respondWith(
            fetch(req).catch(() => new Response(JSON.stringify({ error: 'offline', offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
        );
        return;
    }

    // Cache-first para estáticos (CSS/JS/Ícones)
    event.respondWith(
        caches.match(req)
            .then((cacheRes) => cacheRes || fetch(req).then((networkRes) => {
                if (!networkRes || networkRes.status !== 200 || networkRes.type !== 'basic') return networkRes;
                const resClone = networkRes.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone).catch(() => {}));
                return networkRes;
            }))
            .catch(() => undefined)
    );
});

// Notificações push (opcional - para futuras funcionalidades)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/favicon_io-22/android-chrome-192x192.png',
            badge: '/favicon_io-22/android-chrome-192x192.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: 1
            },
            actions: [
                {
                    action: 'explore',
                    title: 'Ver detalhes',
                    icon: '/favicon_io-22/android-chrome-192x192.png'
                },
                {
                    action: 'close',
                    title: 'Fechar',
                    icon: '/favicon_io-22/android-chrome-192x192.png'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Clique em notificações
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Sincronização em background (para futuras funcionalidades)
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        event.waitUntil(
            // Aqui você pode implementar sincronização de dados offline
            console.log('Background sync executado')
        );
    }
});

console.log('Service Worker: Carregado com sucesso');
