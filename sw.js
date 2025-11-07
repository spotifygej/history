// Define um nome e versão para o cache
const CACHE_NAME = 'nossa-musica-cache-v1';

// Lista de arquivos básicos (o "App Shell") para cachear na instalação.
// Mantemos isso mínimo, pois os assets pesados serão cacheados pelo botão.
const SHELL_FILES = [
    '/',
    'index.html',
    'https://cdn.tailwindcss.com', // CORREÇÃO: Atualizado de 'tailwind.js' para o CDN
    'manifest.json',
    'icons/icon-192x192.png',
    'favicon.png',
    'favicon.jpg'
];

/**
 * Evento: Install
 * Chamado quando o Service Worker (SW) é instalado pela primeira vez.
 * Cacheamos o "App Shell" básico aqui.
 */
self.addEventListener('install', event => {
    console.log('[SW] Evento: Install');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Cacheando o App Shell básico');
                // Tenta adicionar os arquivos do shell. Se falhar, não bloqueia,
                // pois o cache principal virá do botão.
                return cache.addAll(SHELL_FILES).catch(err => {
                    console.warn('[SW] Falha ao cachear parte do App Shell:', err);
                });
            })
            .then(() => {
                // Força o novo SW a se tornar ativo imediatamente
                return self.skipWaiting();
            })
    );
});

/**
 * Evento: Activate
 * Chamado quando o SW é ativado (após a instalação).
 * É um bom lugar para limpar caches antigos, se houver.
 */
self.addEventListener('activate', event => {
    console.log('[SW] Evento: Activate');
    // Faz com que o SW controle a página imediatamente, sem precisar recarregar
    event.waitUntil(self.clients.claim());
});

/**
 * Evento: Fetch
 * Intercepta TODAS as requisições de rede (imagens, scripts, áudio, etc.).
 * Estratégia: "Cache, caindo para a Rede" (Cache falling back to Network)
 */
self.addEventListener('fetch', event => {
    // Só nos importamos com requisições GET
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            // 1. Tenta encontrar a requisição no cache
            return cache.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    // console.log('[SW] Fetch: Encontrado no cache:', event.request.url);
                    return cachedResponse; // Retorna do cache se encontrar
                }

                // 2. Não está no cache, busca na rede
                // console.log('[SW] Fetch: Não encontrado no cache, buscando na rede:', event.request.url);
                return fetch(event.request).then(networkResponse => {
                    // 3. Salva a resposta da rede no cache para a próxima vez
                    // É importante clonar a resposta, pois ela é um "stream"
                    cache.put(event.request, networkResponse.clone());
                    
                    // 4. Retorna a resposta da rede para a página
                    return networkResponse;
                }).catch(error => {
                    console.error('[SW] Fetch: Falha na rede.', error, event.request.url);
                    // Em um app mais complexo, poderíamos retornar uma imagem/página offline placeholder
                });
            });
        })
    );
});

/**
 * Evento: Message
 * Ouve mensagens vindas da página (do nosso botão "Salvar para Offline").
 */
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'CACHE_ASSETS') {
        console.log('[SW] Evento: Message (CACHE_ASSETS)');
        const urlsToCache = event.data.urls;

        event.waitUntil(
            caches.open(CACHE_NAME)
                .then(cache => {
                    console.log(`[SW] Adicionando ${urlsToCache.length} assets ao cache...`);
                    // cache.addAll() é atômico. Se UM arquivo falhar, a promessa inteira falha.
                    return cache.addAll(urlsToCache);
                })
                .then(() => {
                    console.log('[SW] Todos os assets foram cacheados com sucesso.');
                    // Envia uma mensagem de sucesso de volta para a página
                    if(event.source) event.source.postMessage({ type: 'CACHE_COMPLETE' });
                })
                .catch(error => {
                    console.error('[SW] Falha ao cachear assets:', error);
                    // Envia uma mensagem de erro de volta para a página
                    if(event.source) event.source.postMessage({ type: 'CACHE_ERROR', error: error.message });
                })
        );
    }
});
