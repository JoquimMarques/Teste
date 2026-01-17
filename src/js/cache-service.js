/**
 * CacheService - Serviço de cache local para reduzir chamadas ao Supabase
 * Usa localStorage com TTL (Time To Live) para invalidação automática
 */

const CacheService = {
    PREFIX: 'briolink_cache_',

    // Tempos de cache padrão (em minutos)
    TTL: {
        publications: 5,
        advertisements: 15,
        profiles: 10,
        ranking: 5,
        userInteractions: 3
    },

    /**
     * Armazena dados no cache com TTL
     * @param {string} key - Chave do cache
     * @param {any} data - Dados a armazenar
     * @param {number} ttlMinutes - Tempo de vida em minutos (opcional)
     */
    set(key, data, ttlMinutes = 5) {
        try {
            const cacheItem = {
                data: data,
                timestamp: Date.now(),
                expiresAt: Date.now() + (ttlMinutes * 60 * 1000)
            };
            localStorage.setItem(this.PREFIX + key, JSON.stringify(cacheItem));
        } catch (error) {
            console.warn('[Cache] Erro ao armazenar:', error);
            // Se localStorage estiver cheio, limpar caches antigos
            if (error.name === 'QuotaExceededError') {
                this.clearExpired();
            }
        }
    },

    /**
     * Recupera dados do cache se ainda válidos
     * @param {string} key - Chave do cache
     * @returns {any|null} - Dados ou null se expirado/inexistente
     */
    get(key) {
        try {
            const item = localStorage.getItem(this.PREFIX + key);
            if (!item) return null;

            const cacheItem = JSON.parse(item);

            // Verificar se expirou
            if (Date.now() > cacheItem.expiresAt) {
                this.invalidate(key);
                return null;
            }


            return cacheItem.data;
        } catch (error) {
            console.warn('[Cache] Erro ao recuperar:', error);
            return null;
        }
    },

    /**
     * Verifica se o cache está válido sem retornar os dados
     * @param {string} key - Chave do cache
     * @returns {boolean}
     */
    isValid(key) {
        try {
            const item = localStorage.getItem(this.PREFIX + key);
            if (!item) return false;

            const cacheItem = JSON.parse(item);
            return Date.now() < cacheItem.expiresAt;
        } catch {
            return false;
        }
    },

    /**
     * Invalida (remove) um cache específico
     * @param {string} key - Chave do cache
     */
    invalidate(key) {
        localStorage.removeItem(this.PREFIX + key);
    },

    /**
     * Invalida múltiplos caches de uma vez
     * @param {string[]} keys - Array de chaves
     */
    invalidateMultiple(keys) {
        keys.forEach(key => this.invalidate(key));
    },

    /**
     * Limpa todos os caches do Briolink
     */
    clear() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.PREFIX)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    },

    /**
     * Limpa apenas caches expirados
     */
    clearExpired() {
        let removed = 0;
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.PREFIX)) {
                try {
                    const item = JSON.parse(localStorage.getItem(key));
                    if (Date.now() > item.expiresAt) {
                        localStorage.removeItem(key);
                        removed++;
                    }
                } catch {
                    localStorage.removeItem(key);
                    removed++;
                }
            }
        }
    },

    /**
     * Retorna estatísticas do cache
     * @returns {object}
     */
    getStats() {
        let count = 0;
        let totalSize = 0;
        let valid = 0;
        let expired = 0;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.PREFIX)) {
                count++;
                const value = localStorage.getItem(key);
                totalSize += value.length * 2; // UTF-16 = 2 bytes per char

                try {
                    const item = JSON.parse(value);
                    if (Date.now() < item.expiresAt) {
                        valid++;
                    } else {
                        expired++;
                    }
                } catch {
                    expired++;
                }
            }
        }

        return {
            totalItems: count,
            validItems: valid,
            expiredItems: expired,
            totalSizeKB: (totalSize / 1024).toFixed(2)
        };
    }
};

// Limpar caches expirados ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    CacheService.clearExpired();
});

// Expor globalmente
window.CacheService = CacheService;
