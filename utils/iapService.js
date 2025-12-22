/**
 * iapService.js - In-App Purchase Service using expo-iap
 * Compatible con Expo SDK 53
 * 
 * Documentación: https://github.com/hyochan/expo-iap
 */

import { Platform } from 'react-native';
import * as ExpoIAP from 'expo-iap';

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT IDs - Deben coincidir EXACTAMENTE con Google Play Console
// ═══════════════════════════════════════════════════════════════════════════

export const PRODUCT_IDS = {
    PREMIUM_MENSUAL: 'premium_mensual',
    PREMIUM_ANUAL: 'premium_anual',
    COACH_5_MENSUAL: 'coach_5_mensual',
    COACH_5_ANUAL: 'coach_5_anual',
    COACH_10_MENSUAL: 'coach_10_mensual',
    COACH_10_ANUAL: 'coach_10_anual',
    COACH_20_MENSUAL: 'coach_20_mensual',
    COACH_20_ANUAL: 'coach_20_anual',
    COACH_50_MENSUAL: 'coach_50_mensual',
    COACH_50_ANUAL: 'coach_50_anual',
    COACH_100_MENSUAL: 'coach_100_mensual',
    COACH_100_ANUAL: 'coach_100_anual',
    COACH_UNLIMITED_MENSUAL: 'coach_unlimited_mensual',
    COACH_UNLIMITED_ANUAL: 'coach_unlimited_anual',
};

export const ALL_SUBSCRIPTION_IDS = Object.values(PRODUCT_IDS);

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES DE IAP usando expo-iap
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
        await ExpoIAP.initConnection();
        console.log('[IAP] Conexión iniciada');
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
        await ExpoIAP.endConnection();
        console.log('[IAP] Conexión cerrada');
    } catch (error) {
        console.error('[IAP] Error cerrando conexión:', error);
    }
};

/**
 * Obtiene las suscripciones disponibles desde la tienda
 */
export const getIAPSubscriptions = async (productIds = ALL_SUBSCRIPTION_IDS) => {
    if (Platform.OS === 'web') {
        console.log('[IAP] No disponible en web');
        return [];
    }

    try {
        const subscriptions = await ExpoIAP.getSubscriptions(productIds);
        console.log('[IAP] Suscripciones disponibles:', subscriptions?.length || 0);
        return subscriptions || [];
    } catch (error) {
        console.error('[IAP] Error obteniendo suscripciones:', error);
        return [];
    }
};

/**
 * Inicia el flujo de compra para una suscripción
 */
export const purchaseIAPSubscription = async (productId, offerToken = null) => {
    if (Platform.OS === 'web') {
        throw new Error('IAP no disponible en web');
    }

    try {
        console.log('[IAP] Iniciando compra:', productId);

        const purchase = await ExpoIAP.requestSubscription({
            sku: productId,
            ...(Platform.OS === 'android' && offerToken && {
                subscriptionOffers: [{ sku: productId, offerToken }]
            }),
        });

        console.log('[IAP] Compra completada:', purchase);
        return purchase;
    } catch (error) {
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
        const history = await ExpoIAP.getPurchaseHistory();
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
        await ExpoIAP.acknowledgePurchaseAndroid(purchaseToken);
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
        await ExpoIAP.finishTransaction({ purchase, isConsumable });
        console.log('[IAP] Transacción finalizada');
    } catch (error) {
        console.error('[IAP] Error finalizando transacción:', error);
    }
};

/**
 * Mapea un plan de MongoDB a un Product ID de Google Play
 */
export const getGoogleProductIdFromPlan = (plan) => {
    if (!plan) return null;

    if (plan.googleProductId) {
        return plan.googleProductId;
    }

    const isAnual = plan.duracionMeses === 12;
    const period = isAnual ? 'anual' : 'mensual';

    if (plan.isCoach) {
        const clientRange = plan.clientRange || 10;
        if (clientRange >= 9999 || clientRange > 100) {
            return `coach_unlimited_${period}`;
        }
        return `coach_${clientRange}_${period}`;
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
        const clientRange = plan.clientRange || 10;
        if (clientRange >= 9999 || clientRange > 100) {
            return `coach_unlimited_${period}`;
        }
        return `coach_${clientRange}_${period}`;
    }
    return `premium_${period}`;
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
    PRODUCT_IDS,
    ALL_SUBSCRIPTION_IDS,
};

export default IAPService;
