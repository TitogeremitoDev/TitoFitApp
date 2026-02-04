/**
 * supplementCalculator.js
 * Cálculos de consumo y reposición de suplementos
 */

/**
 * Calcula el consumo diario de suplementos basado en el plan de nutrición
 * @param {Object} nutritionPlan - Plan de nutrición con dayTemplates
 * @returns {Object} - Consumo por suplemento { [name]: { dailyAmount, unit, weeklyAmount, meals } }
 */
export const calculatePlanConsumption = (nutritionPlan) => {
    if (!nutritionPlan?.dayTemplates) return {};

    const consumption = {};

    // Iterar por cada template de día
    nutritionPlan.dayTemplates.forEach(dayTemplate => {
        if (!dayTemplate.meals) return;

        dayTemplate.meals.forEach(meal => {
            if (!meal.supplements || meal.supplements.length === 0) return;

            meal.supplements.forEach(supp => {
                const key = supp.name.toLowerCase().trim();

                if (!consumption[key]) {
                    consumption[key] = {
                        name: supp.name,
                        dailyAmount: 0,
                        unit: supp.unit,
                        meals: [],
                        timings: []
                    };
                }

                // Sumar cantidad (asumimos una vez por comida por día)
                consumption[key].dailyAmount += supp.amount || 0;

                // Registrar en qué comidas se toma
                if (!consumption[key].meals.includes(meal.name)) {
                    consumption[key].meals.push(meal.name);
                }

                // Registrar timings
                if (supp.timing && !consumption[key].timings.includes(supp.timing)) {
                    consumption[key].timings.push(supp.timing);
                }
            });
        });
    });

    // Calcular consumo semanal y mensual
    Object.keys(consumption).forEach(key => {
        consumption[key].weeklyAmount = consumption[key].dailyAmount * 7;
        consumption[key].monthlyAmount = Math.round(consumption[key].dailyAmount * 30);
    });

    return consumption;
};

/**
 * Calcula cuántos días quedan de stock para un suplemento
 * @param {Object} stockItem - Item del inventario { currentAmount, unit }
 * @param {Object} consumption - Consumo del suplemento { dailyAmount, unit }
 * @returns {number} - Días restantes
 */
export const calculateDaysRemaining = (stockItem, consumption) => {
    if (!stockItem || !consumption) return Infinity;
    if (!consumption.dailyAmount || consumption.dailyAmount <= 0) return Infinity;
    if (!stockItem.currentAmount || stockItem.currentAmount <= 0) return 0;

    // TODO: Convertir unidades si son diferentes
    // Por ahora asumimos misma unidad
    return Math.floor(stockItem.currentAmount / consumption.dailyAmount);
};

/**
 * Calcula la fecha en que se acabará el suplemento
 * @param {number} daysRemaining - Días restantes
 * @returns {Date} - Fecha estimada
 */
export const calculateRunOutDate = (daysRemaining) => {
    if (daysRemaining === Infinity) return null;
    const date = new Date();
    date.setDate(date.getDate() + daysRemaining);
    return date;
};

/**
 * Determina el estado de un suplemento basado en días restantes
 * @param {number} daysRemaining - Días restantes
 * @param {number} alertDays - Días de alerta configurados (default 7)
 * @returns {Object} - { status, color, icon, message }
 */
export const getStockStatus = (daysRemaining, alertDays = 7) => {
    if (daysRemaining === Infinity || daysRemaining > 30) {
        return {
            status: 'ok',
            color: '#22c55e',
            icon: '✅',
            message: 'Stock OK'
        };
    }

    if (daysRemaining > alertDays * 2) {
        return {
            status: 'good',
            color: '#22c55e',
            icon: '✅',
            message: `${daysRemaining} días`
        };
    }

    if (daysRemaining > alertDays) {
        return {
            status: 'warning',
            color: '#f59e0b',
            icon: '⚠️',
            message: `${daysRemaining} días`
        };
    }

    if (daysRemaining > 0) {
        return {
            status: 'critical',
            color: '#ef4444',
            icon: '🔴',
            message: `${daysRemaining} días`
        };
    }

    return {
        status: 'empty',
        color: '#ef4444',
        icon: '❌',
        message: 'Agotado'
    };
};

/**
 * Calcula información completa de reposición para un suplemento
 * @param {Object} stockItem - Item del inventario
 * @param {Object} consumption - Consumo calculado del plan
 * @returns {Object} - Información completa de reposición
 */
export const calculateRestockInfo = (stockItem, consumption) => {
    const daysRemaining = calculateDaysRemaining(stockItem, consumption);
    const runOutDate = calculateRunOutDate(daysRemaining);
    const status = getStockStatus(daysRemaining, stockItem?.alertDays || 7);

    // Calcular fecha de alerta (X días antes de quedarse sin stock)
    const alertDays = stockItem?.alertDays || 7;
    let alertDate = null;
    if (runOutDate) {
        alertDate = new Date(runOutDate);
        alertDate.setDate(alertDate.getDate() - alertDays);
    }

    // Determinar si debe alertar ahora
    const shouldAlert = alertDate && new Date() >= alertDate;

    // Calcular cantidad sugerida de compra (1 mes de stock)
    const suggestedPurchase = consumption?.monthlyAmount || 0;

    // Calcular porcentaje de stock restante
    const stockPercentage = stockItem?.productSize
        ? Math.round((stockItem.currentAmount / stockItem.productSize) * 100)
        : null;

    return {
        daysRemaining,
        runOutDate,
        alertDate,
        shouldAlert,
        status: status.status,
        statusColor: status.color,
        statusIcon: status.icon,
        statusMessage: status.message,
        suggestedPurchase: {
            amount: suggestedPurchase,
            unit: consumption?.unit || stockItem?.unit
        },
        stockPercentage,
        consumption: {
            daily: consumption?.dailyAmount || 0,
            weekly: consumption?.weeklyAmount || 0,
            monthly: consumption?.monthlyAmount || 0,
            unit: consumption?.unit
        }
    };
};

/**
 * Genera lista de compra de suplementos basada en inventario y consumo
 * @param {Array} inventory - Array de items del inventario
 * @param {Object} planConsumption - Consumo del plan { [name]: consumption }
 * @returns {Array} - Lista de suplementos a comprar ordenada por urgencia
 */
export const generateSupplementShoppingList = (inventory, planConsumption) => {
    const shoppingList = [];

    // Revisar cada suplemento en el consumo del plan
    Object.entries(planConsumption).forEach(([key, consumption]) => {
        // Buscar en inventario (match por nombre normalizado)
        const stockItem = inventory.find(item =>
            item.name.toLowerCase().trim() === key
        );

        const restockInfo = calculateRestockInfo(stockItem, consumption);

        // Añadir a lista si necesita reposición (menos de 14 días o shouldAlert)
        if (restockInfo.shouldAlert || restockInfo.daysRemaining <= 14) {
            shoppingList.push({
                name: consumption.name,
                ...restockInfo,
                inStock: !!stockItem,
                currentAmount: stockItem?.currentAmount || 0,
                brand: stockItem?.brand,
                productSize: stockItem?.productSize
            });
        }
    });

    // Ordenar por urgencia (menos días primero)
    shoppingList.sort((a, b) => a.daysRemaining - b.daysRemaining);

    return shoppingList;
};

/**
 * Formatea la fecha de forma legible
 * @param {Date} date - Fecha a formatear
 * @returns {string} - Fecha formateada
 */
export const formatDate = (date) => {
    if (!date) return '---';
    return new Intl.DateTimeFormat('es-ES', {
        day: 'numeric',
        month: 'short'
    }).format(date);
};

/**
 * Formatea cantidad con unidad
 * @param {number} amount - Cantidad
 * @param {string} unit - Unidad
 * @returns {string} - Cantidad formateada
 */
export const formatAmount = (amount, unit) => {
    if (!amount && amount !== 0) return '---';

    const unitLabels = {
        'gramos': 'g',
        'mg': 'mg',
        'caps': 'caps',
        'scoop': 'scoop',
        'ml': 'ml'
    };

    return `${amount}${unitLabels[unit] || unit || ''}`;
};

export default {
    calculatePlanConsumption,
    calculateDaysRemaining,
    calculateRunOutDate,
    getStockStatus,
    calculateRestockInfo,
    generateSupplementShoppingList,
    formatDate,
    formatAmount
};
