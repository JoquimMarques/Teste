// Service Worker para PWA Briolink
const CACHE_NAME = 'briolink-v1.0.1';
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
    console.log('Service Worker: Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Cache aberto');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker: Cache populado com sucesso');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Erro ao popular cache:', error);
            })
    );
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
    // Estratégia: Cache First para recursos estáticos, Network First para API
    if (event.request.url.includes('supabase') || event.request.url.includes('api')) {
        // Para requisições de API, usar Network First
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Se a rede funcionar, retornar a resposta
                    return response;
                })
                .catch(() => {
                    // Se a rede falhar, mostrar mensagem offline
                    return new Response(
                        JSON.stringify({
                            error: 'Você está offline. Verifique sua conexão com a internet.',
                            offline: true
                        }),
                        {
                            status: 503,
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                })
        );
    } else {
        // Para recursos estáticos, usar Cache First
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    // Se encontrar no cache, retornar
                    if (response) {
                        return response;
                    }
                    
                    // Se não encontrar, buscar na rede
                    return fetch(event.request).then((response) => {
                        // Verificar se a resposta é válida
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clonar a resposta para o cache
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    });
                })
                .catch(() => {
                    // Se tudo falhar, retornar página offline para navegação
                    if (event.request.destination === 'document') {
                        return caches.match('/index.html');
                    }
                })
        );
    }
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
