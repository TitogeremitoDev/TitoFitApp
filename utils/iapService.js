/**
 * iapService.js - In-App Purchase Service using expo-iap
 * Compatible con Expo SDK 53 y expo-iap 3.3.2+
 * 
 * IMPORTANTE: expo-iap usa fetchProducts(), NO getSubscriptions()
 * Documentación: https://hyochan.github.io/expo-iap/
 */

import { Platform } from 'react-native';
import {
    initConnection,
    endConnection,
    fetchProducts,
    requestPurchase,
    getPurchaseHistory,
    finishTransaction as finishTransactionNative,
    acknowledgePurchaseAndroid,
} from 'expo-iap';

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT IDs - Solo los que EXISTEN en Google Play Console
// ═══════════════════════════════════════════════════════════════════════════

export const PRODUCT_IDS = {
    PREMIUM_MENSUAL: 'premium_mensual',
    PREMIUM_ANUAL: 'premium_anual',
    COACH_UNLIMITED_MENSUAL: 'coach_unlimited_mensual',
    COACH_UNLIMITED_ANUAL: 'coach_unlimited_anual',
};

export const ALL_SUBSCRIPTION_IDS = Object.values(PRODUCT_IDS);

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES DE IAP usando expo-iap API correcta
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Inicializa la conexión con la tienda
 */
export const initIAPConnection = async () => {
    if (Platform.OS === 'web') {
        console.log('[IAP] No disponible en web');
        return false;
    }

    try {
        const result = await initConnection();
        console.log('[IAP] Conexión iniciada:', result);
        return true;
    } catch (error) {
        console.error('[IAP] Error iniciando conexión:', error);
        return false;
    }
};

/**
 * Cierra la conexión con la tienda
 */
export const endIAPConnection = async () => {
    if (Platform.OS === 'web') return;

    try {
        await endConnection();
        console.log('[IAP] Conexión cerrada');
    } catch (error) {
        console.error('[IAP] Error cerrando conexión:', error);
    }
};

/**
 * Obtiene las suscripciones disponibles desde la tienda
 * IMPORTANTE: expo-iap usa fetchProducts con type: 'subs'
 */
export const getIAPSubscriptions = async (productIds = ALL_SUBSCRIPTION_IDS) => {
    if (Platform.OS === 'web') {
        console.log('[IAP] No disponible en web');
        return [];
    }

    try {
        console.log('[IAP] Solicitando suscripciones:', productIds);

        // expo-iap usa fetchProducts con type: 'subs' para suscripciones
        const products = await fetchProducts({
            skus: productIds,
            type: 'subs', // 'subs' para suscripciones, 'in-app' para productos únicos
        });

        console.log('[IAP] Productos encontrados:', products?.length || 0);
        if (products?.length > 0) {
            products.forEach((p, i) => {
                console.log(`[IAP] Producto ${i}:`, p.id || p.productId, p.displayPrice || p.price);
            });
        }

        return products || [];
    } catch (error) {
        console.error('[IAP] Error obteniendo suscripciones:', error.message);
        console.error('[IAP] Error code:', error.code);
        return [];
    }
};

/**
 * Inicia el flujo de compra para una suscripción
 * IMPORTANTE: Debe incluir type: 'subs' para que expo-iap devuelva jwsRepresentationIos
 * MEJORADO: Maneja la respuesta si llega como Array o como Objeto
 */
export const purchaseIAPSubscription = async (productId, offerToken = null) => {
    if (Platform.OS === 'web') {
        throw new Error('IAP no disponible en web');
    }

    try {
        console.log('[IAP] Iniciando compra de suscripción:', productId);

        // API de expo-iap: type: 'subs' es CRÍTICO para obtener jwsRepresentationIos en iOS
        const purchaseRequest = {
            request: {
                apple: {
                    sku: productId,
                },
                google: {
                    skus: [productId],
                    subscriptionOffers: offerToken ? [{ sku: productId, offerToken }] : undefined,
                },
            },
            type: 'subs', // ← CRÍTICO: Sin esto, no se devuelve jwsRepresentationIos
        };

        console.log('[IAP] Enviando requestPurchase con type: subs');
        const result = await requestPurchase(purchaseRequest);

        // NORMALIZACIÓN: Convertimos Array -> Objeto único
        // Si expo-iap devuelve un array (pasa en algunas versiones), cogemos el primero
        let purchase;
        if (Array.isArray(result)) {
            if (result.length === 0) {
                throw new Error('Compra cancelada o array vacío');
            }
            purchase = result[0];
            console.log('[IAP] Resultado era Array, normalizado a Objeto');
        } else {
            purchase = result;
        }

        // Log detallado para debug
        console.log('[IAP] Compra completada (Normalizada):', {
            transactionId: purchase?.transactionId,
            productId: purchase?.productId,
            hasJws: !!purchase?.jwsRepresentationIos,
            hasReceipt: !!purchase?.transactionReceipt,
        });

        return purchase; // Siempre devolvemos un OBJETO
    } catch (error) {
        // Normalizar error de cancelación para que payment.jsx lo detecte fácilmente
        const errorMsg = error?.message?.toLowerCase() || '';
        const errorCode = error?.code || '';

        if (errorMsg.includes('cancel') || errorCode === 'E_USER_CANCELLED' || errorCode === 'user-cancelled') {
            console.log('[IAP] Compra cancelada por usuario');
            const cancelError = new Error('User canceled');
            cancelError.code = 'E_USER_CANCELLED';
            throw cancelError;
        }

        console.error('[IAP] Error en compra:', error);
        throw error;
    }
};

/**
 * Obtiene las compras del usuario (para restaurar)
 */
export const getIAPPurchaseHistory = async () => {
    if (Platform.OS === 'web') return [];

    try {
        const history = await getPurchaseHistory();
        console.log('[IAP] Historial de compras:', history?.length || 0);
        return history || [];
    } catch (error) {
        console.error('[IAP] Error obteniendo historial:', error);
        return [];
    }
};

/**
 * Acknowledge una compra (requerido en Android)
 */
export const acknowledgeIAPPurchase = async (purchaseToken) => {
    if (Platform.OS !== 'android') return true;

    try {
        await acknowledgePurchaseAndroid({ token: purchaseToken });
        console.log('[IAP] Compra acknowledged');
        return true;
    } catch (error) {
        console.error('[IAP] Error en acknowledge:', error);
        return false;
    }
};

/**
 * Finaliza una transacción
 */
export const finishIAPTransaction = async (purchase, isConsumable = false) => {
    if (Platform.OS === 'web') return;

    try {
        await finishTransactionNative({ purchase, isConsumable });
        console.log('[IAP] Transacción finalizada');
    } catch (error) {
        console.error('[IAP] Error finalizando transacción:', error);
    }
};

/**
 * Mapea un plan de MongoDB a un Product ID de Google Play
 * IMPORTANTE: Solo existen 4 productos en Google Play Console:
 * - premium_mensual, premium_anual
 * - coach_unlimited_mensual, coach_unlimited_anual
 */
export const getGoogleProductIdFromPlan = (plan) => {
    if (!plan) return null;

    // Si el plan tiene un googleProductId explícito, usarlo
    if (plan.googleProductId) {
        return plan.googleProductId;
    }

    const isAnual = plan.duracionMeses === 12;
    const period = isAnual ? 'anual' : 'mensual';

    if (plan.isCoach) {
        // Todos los planes de coach usan coach_unlimited_*
        return `coach_unlimited_${period}`;
    }

    return `premium_${period}`;
};

/**
 * Mapea un plan de MongoDB a un Product ID de Apple App Store
 */
export const getAppleProductIdFromPlan = (plan) => {
    if (!plan) return null;
    if (plan.appleProductId) return plan.appleProductId;

    const isAnual = plan.duracionMeses === 12;
    const period = isAnual ? 'anual' : 'mensual';

    if (plan.isCoach) {
        return `coach_unlimited_${period}_v3`;
    }
    return `premium_${period}_v3`;
};

// ═══════════════════════════════════════════════════════════════════════════
// SERVICIO EXPORTADO
// ═══════════════════════════════════════════════════════════════════════════

const IAPService = {
    initConnection: initIAPConnection,
    endConnection: endIAPConnection,
    getSubscriptions: getIAPSubscriptions,
    purchaseSubscription: purchaseIAPSubscription,
    getPurchaseHistory: getIAPPurchaseHistory,
    acknowledgePurchase: acknowledgeIAPPurchase,
    finishTransaction: finishIAPTransaction,
    getGoogleProductIdFromPlan,
    getAppleProductIdFromPlan,
    PRODUCT_IDS,
    ALL_SUBSCRIPTION_IDS,
};

export default IAPService;
