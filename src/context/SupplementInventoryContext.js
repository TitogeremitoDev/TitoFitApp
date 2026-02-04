/**
 * SupplementInventoryContext.js
 * Context para gestionar el inventario de suplementos del cliente
 * Persiste en AsyncStorage
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'supplement_inventory_v1';

const SupplementInventoryContext = createContext(null);

export const useSupplementInventory = () => {
    const context = useContext(SupplementInventoryContext);
    if (!context) {
        throw new Error('useSupplementInventory must be used within SupplementInventoryProvider');
    }
    return context;
};

export const SupplementInventoryProvider = ({ children }) => {
    const [inventory, setInventory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Cargar inventario al iniciar
    useEffect(() => {
        loadInventory();
    }, []);

    // Persistir cambios
    useEffect(() => {
        if (!isLoading) {
            saveInventory();
        }
    }, [inventory, isLoading]);

    const loadInventory = async () => {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            if (stored) {
                setInventory(JSON.parse(stored));
            }
        } catch (error) {
            console.error('[SupplementInventory] Error loading:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const saveInventory = async () => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
        } catch (error) {
            console.error('[SupplementInventory] Error saving:', error);
        }
    };

    /**
     * Añadir nuevo suplemento al inventario
     */
    const addSupplement = useCallback((supplement) => {
        const newItem = {
            id: `supp_${Date.now()}`,
            name: supplement.name,
            currentAmount: supplement.currentAmount || supplement.productSize || 0,
            unit: supplement.unit || 'caps',
            productSize: supplement.productSize || supplement.currentAmount || 0,
            brand: supplement.brand || '',
            alertDays: supplement.alertDays || 7,
            lastRestocked: new Date().toISOString(),
            restockHistory: [{
                date: new Date().toISOString(),
                amount: supplement.currentAmount || supplement.productSize || 0
            }]
        };

        setInventory(prev => [...prev, newItem]);
        return newItem;
    }, []);

    /**
     * Actualizar suplemento existente
     */
    const updateSupplement = useCallback((id, updates) => {
        setInventory(prev => prev.map(item =>
            item.id === id ? { ...item, ...updates } : item
        ));
    }, []);

    /**
     * Eliminar suplemento del inventario
     */
    const removeSupplement = useCallback((id) => {
        setInventory(prev => prev.filter(item => item.id !== id));
    }, []);

    /**
     * Rellenar stock (añadir cantidad)
     */
    const restockSupplement = useCallback((id, amount) => {
        setInventory(prev => prev.map(item => {
            if (item.id !== id) return item;

            const newAmount = (item.currentAmount || 0) + amount;
            const newHistory = [
                ...(item.restockHistory || []),
                { date: new Date().toISOString(), amount }
            ];

            return {
                ...item,
                currentAmount: newAmount,
                lastRestocked: new Date().toISOString(),
                restockHistory: newHistory
            };
        }));
    }, []);

    /**
     * Establecer stock exacto
     */
    const setSupplementStock = useCallback((id, amount) => {
        setInventory(prev => prev.map(item =>
            item.id === id ? { ...item, currentAmount: amount } : item
        ));
    }, []);

    /**
     * Buscar suplemento por nombre (para matching con plan)
     */
    const findByName = useCallback((name) => {
        const normalized = name.toLowerCase().trim();
        return inventory.find(item =>
            item.name.toLowerCase().trim() === normalized ||
            item.name.toLowerCase().includes(normalized) ||
            normalized.includes(item.name.toLowerCase())
        );
    }, [inventory]);

    /**
     * Obtener suplementos que necesitan reposición
     */
    const getLowStockItems = useCallback((planConsumption, thresholdDays = 14) => {
        return inventory.filter(item => {
            const consumption = planConsumption?.[item.name.toLowerCase().trim()];
            if (!consumption?.dailyAmount) return false;

            const daysRemaining = item.currentAmount / consumption.dailyAmount;
            return daysRemaining <= thresholdDays;
        });
    }, [inventory]);

    /**
     * Limpiar todo el inventario
     */
    const clearInventory = useCallback(async () => {
        setInventory([]);
        await AsyncStorage.removeItem(STORAGE_KEY);
    }, []);

    /**
     * Inicializar inventario desde suplementos del plan
     * (para onboarding cuando el cliente no tiene inventario)
     */
    const initializeFromPlan = useCallback((planSupplements) => {
        if (inventory.length > 0) return; // No sobrescribir si ya tiene

        const newItems = planSupplements.map(supp => ({
            id: `supp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: supp.name,
            currentAmount: 0, // El cliente debe indicar cuánto tiene
            unit: supp.unit || 'caps',
            productSize: 0,
            brand: '',
            alertDays: 7,
            lastRestocked: null,
            restockHistory: [],
            needsSetup: true // Flag para indicar que necesita configuración
        }));

        setInventory(newItems);
    }, [inventory]);

    const value = {
        inventory,
        isLoading,
        addSupplement,
        updateSupplement,
        removeSupplement,
        restockSupplement,
        setSupplementStock,
        findByName,
        getLowStockItems,
        clearInventory,
        initializeFromPlan
    };

    return (
        <SupplementInventoryContext.Provider value={value}>
            {children}
        </SupplementInventoryContext.Provider>
    );
};

export default SupplementInventoryContext;
