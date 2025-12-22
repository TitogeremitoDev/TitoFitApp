/**
 * iapService.web.js - Stub para web
 * En web no hay compras in-app
 */

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

export const initIAPConnection = async () => false;
export const endIAPConnection = async () => { };
export const getIAPSubscriptions = async () => [];
export const purchaseIAPSubscription = async () => { throw new Error('IAP no disponible en web'); };
export const getIAPPurchaseHistory = async () => [];
export const acknowledgeIAPPurchase = async () => true;
export const finishIAPTransaction = async () => { };

export const getGoogleProductIdFromPlan = (plan) => {
    if (!plan) return null;
    const isAnual = plan.duracionMeses === 12;
    const period = isAnual ? 'anual' : 'mensual';
    if (plan.isCoach) {
        const clientRange = plan.clientRange || 10;
        if (clientRange >= 9999 || clientRange > 100) return `coach_unlimited_${period}`;
        return `coach_${clientRange}_${period}`;
    }
    return `premium_${period}`;
};

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
