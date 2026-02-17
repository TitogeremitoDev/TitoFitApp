/**
 * SignedImage.jsx
 * 
 * Componente compartido para renderizar imágenes almacenadas en R2.
 * Resuelve R2 keys a URLs firmadas on-demand con cache en memoria.
 * 
 * Features:
 * - Cache en memoria con TTL de 12 min (margen de 3 min sobre los 15 min del presign)
 * - Tap-to-retry en caso de error
 * - Fallback para URLs legacy (mensajes antiguos sin R2 key)
 * - Consume token directamente de useAuth() (sin prop drilling)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Image,
    ActivityIndicator,
    TouchableOpacity,
    Text,
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

// ═══════════════════════════════════════════════════════════════════════════
// IN-MEMORY CACHE (shared across all SignedImage instances)
// ═══════════════════════════════════════════════════════════════════════════

const CACHE_TTL_MS = 12 * 60 * 1000; // 12 minutes (3 min margin on 15 min presign)

/** @type {Map<string, { url: string, expiresAt: number }>} */
const signedUrlCache = new Map();

/**
 * Get a cached signed URL if it exists and hasn't expired.
 * @param {string} key - The R2 key
 * @returns {string|null} The cached URL or null
 */
export const getCachedUrl = (key) => {
    const entry = signedUrlCache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
        return entry.url;
    }
    // Clean up expired entry
    if (entry) signedUrlCache.delete(key);
    return null;
};

/**
 * Store a signed URL in cache with TTL.
 * @param {string} key - The R2 key
 * @param {string} url - The signed URL
 */
const setCachedUrl = (key, url) => {
    signedUrlCache.set(key, {
        url,
        expiresAt: Date.now() + CACHE_TTL_MS,
    });
};

/**
 * Clear all cached URLs. Useful for logout or cache invalidation.
 */
export const clearSignedUrlCache = () => {
    signedUrlCache.clear();
};

// ═══════════════════════════════════════════════════════════════════════════
// SIGNED IMAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {Object} props
 * @param {string} props.r2Key - The R2 object key (persistent identifier)
 * @param {string} [props.fallbackUrl] - Legacy URL fallback (for old messages)
 * @param {Object} [props.style] - Image style
 * @param {string} [props.resizeMode] - Image resize mode (default: 'cover')
 * @param {string} [props.spinnerColor] - Loading spinner color
 * @param {number} [props.errorIconSize] - Error icon size
 */
const SignedImage = ({
    r2Key,
    fallbackUrl,
    style,
    resizeMode = 'cover',
    spinnerColor = '#8b5cf6',
    errorIconSize = 28,
}) => {
    const { token } = useAuth();
    const [imageUrl, setImageUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    // Determine the effective key to resolve
    const effectiveKey = r2Key || fallbackUrl;

    const fetchSignedUrl = useCallback(async (key) => {
        if (!key || !token) return;

        setLoading(true);
        setError(false);

        try {
            // If key is a full URL (legacy), use it directly
            if (key.startsWith('http')) {
                setImageUrl(key);
                setLoading(false);
                return;
            }

            // Check cache first
            const cached = getCachedUrl(key);
            if (cached) {
                setImageUrl(cached);
                setLoading(false);
                return;
            }

            // Fetch fresh signed URL from API
            const res = await fetch(`${API_URL}/api/chat/media-url`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ key }),
            });

            const data = await res.json();

            if (data.success && data.url) {
                setCachedUrl(key, data.url);
                setImageUrl(data.url);
            } else {
                console.warn('[SignedImage] API returned error for key:', key);
                setError(true);
            }
        } catch (err) {
            console.error('[SignedImage] Fetch error:', err.message);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (effectiveKey) {
            fetchSignedUrl(effectiveKey);
        } else {
            setLoading(false);
            setError(true);
        }
    }, [effectiveKey, retryCount, fetchSignedUrl]);

    // ─── Retry handler ───
    const handleRetry = useCallback(() => {
        // Invalidate cache for this key so we get a fresh URL
        if (effectiveKey && !effectiveKey.startsWith('http')) {
            signedUrlCache.delete(effectiveKey);
        }
        setRetryCount(prev => prev + 1);
    }, [effectiveKey]);

    // ─── Loading state ───
    if (loading) {
        return (
            <View style={[style, localStyles.centered, { backgroundColor: '#e2e8f0' }]}>
                <ActivityIndicator size="small" color={spinnerColor} />
            </View>
        );
    }

    // ─── Error state (tap to retry) ───
    if (error || !imageUrl) {
        return (
            <TouchableOpacity
                style={[style, localStyles.centered, { backgroundColor: '#fee2e2' }]}
                onPress={handleRetry}
                activeOpacity={0.7}
            >
                <Ionicons name="image-outline" size={errorIconSize} color="#ef4444" />
                <Text style={localStyles.retryText}>Toca para reintentar</Text>
            </TouchableOpacity>
        );
    }

    // ─── Success: render image ───
    return (
        <Image
            source={{ uri: imageUrl }}
            style={style}
            resizeMode={resizeMode}
            onError={() => {
                console.warn('[SignedImage] Image load failed for key:', effectiveKey);
                setError(true);
                setImageUrl(null);
                // Invalidar cache para que el retry pida URL fresca
                if (effectiveKey && !effectiveKey.startsWith('http')) {
                    signedUrlCache.delete(effectiveKey);
                }
            }}
        />
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const localStyles = StyleSheet.create({
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    retryText: {
        fontSize: 9,
        color: '#ef4444',
        marginTop: 2,
        textAlign: 'center',
    },
});

export default SignedImage;
