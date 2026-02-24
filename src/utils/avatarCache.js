/**
 * Avatar URL Cache — prevents re-downloading the same avatar images
 * when signed URLs change between API calls.
 *
 * Signed R2 URLs change signature on every request, so the browser
 * treats them as new resources. This cache maps clientId → first avatarUrl
 * seen, so subsequent calls reuse the same URL (browser-cached).
 *
 * Cache auto-expires entries after 50 minutes (signed URLs last 1 hour).
 */

const CACHE_TTL = 50 * 60 * 1000; // 50 minutes

// Map<clientId, { url, timestamp }>
const cache = new Map();

/**
 * Get a stable avatar URL for a client.
 * If we've seen this client before and the cache isn't expired, return the cached URL.
 * Otherwise cache the new URL and return it.
 */
export const getCachedAvatarUrl = (clientId, avatarUrl) => {
    if (!clientId || !avatarUrl) return avatarUrl;

    const entry = cache.get(clientId);
    const now = Date.now();

    if (entry && (now - entry.timestamp) < CACHE_TTL) {
        return entry.url; // Use cached URL (already in browser cache)
    }

    // Cache new URL
    cache.set(clientId, { url: avatarUrl, timestamp: now });
    return avatarUrl;
};

/**
 * Apply avatar caching to a list of clients.
 * Mutates avatarUrl in-place for efficiency.
 */
export const cacheClientAvatars = (clients) => {
    if (!clients || !Array.isArray(clients)) return clients;
    return clients.map(client => {
        if (client.avatarUrl && client._id) {
            return {
                ...client,
                avatarUrl: getCachedAvatarUrl(client._id, client.avatarUrl),
            };
        }
        return client;
    });
};

/**
 * Clear the cache (e.g., on logout)
 */
export const clearAvatarCache = () => {
    cache.clear();
};
