/* src/context/ShoppingListContext.js */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ShoppingListContext = createContext({});

const STORAGE_KEY = 'shopping_list_v1';
const HISTORY_KEY = 'shopping_list_history_v1';
const MAX_HISTORY = 10; // Máximo de listas en historial

export function ShoppingListProvider({ children }) {
    // Lista activa: { items: [...], createdAt, planId }
    const [activeList, setActiveList] = useState(null);
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Cargar datos al montar
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [listJson, historyJson] = await Promise.all([
                AsyncStorage.getItem(STORAGE_KEY),
                AsyncStorage.getItem(HISTORY_KEY)
            ]);

            if (listJson) {
                setActiveList(JSON.parse(listJson));
            }
            if (historyJson) {
                setHistory(JSON.parse(historyJson));
            }
        } catch (e) {
            console.error('[ShoppingList] Failed to load:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const saveActiveList = async (list) => {
        try {
            if (list) {
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
            } else {
                await AsyncStorage.removeItem(STORAGE_KEY);
            }
        } catch (e) {
            console.error('[ShoppingList] Failed to save:', e);
        }
    };

    const saveHistory = async (newHistory) => {
        try {
            await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
        } catch (e) {
            console.error('[ShoppingList] Failed to save history:', e);
        }
    };

    /**
     * Establece una nueva lista de compras (desde el backend)
     */
    const setList = useCallback((items, planId = null) => {
        const newList = {
            items: items.map((item, idx) => ({
                ...item,
                id: item.id || `item_${idx}_${Date.now()}`,
                checked: false
            })),
            createdAt: new Date().toISOString(),
            planId
        };

        setActiveList(newList);
        saveActiveList(newList);
    }, []);

    /**
     * Toggle checked de un item
     */
    const toggleItem = useCallback((itemId) => {
        setActiveList(prev => {
            if (!prev) return prev;

            const newList = {
                ...prev,
                items: prev.items.map(item =>
                    item.id === itemId
                        ? { ...item, checked: !item.checked }
                        : item
                )
            };

            saveActiveList(newList);
            return newList;
        });
    }, []);

    /**
     * Actualiza la cantidad de un item
     */
    const updateItemAmount = useCallback((itemId, newAmount) => {
        setActiveList(prev => {
            if (!prev) return prev;

            const newList = {
                ...prev,
                items: prev.items.map(item =>
                    item.id === itemId
                        ? { ...item, amount: newAmount }
                        : item
                )
            };

            saveActiveList(newList);
            return newList;
        });
    }, []);

    /**
     * Elimina un item de la lista
     */
    const removeItem = useCallback((itemId) => {
        setActiveList(prev => {
            if (!prev) return prev;

            const newList = {
                ...prev,
                items: prev.items.filter(item => item.id !== itemId)
            };

            saveActiveList(newList);
            return newList;
        });
    }, []);

    /**
     * Añade un item manual a la lista
     */
    const addItem = useCallback((name, amount = 1, unit = 'unidad') => {
        setActiveList(prev => {
            const baseList = prev || {
                items: [],
                createdAt: new Date().toISOString(),
                planId: null
            };

            const newItem = {
                id: `manual_${Date.now()}`,
                name,
                amount,
                unit,
                checked: false,
                isManual: true
            };

            const newList = {
                ...baseList,
                items: [...baseList.items, newItem]
            };

            saveActiveList(newList);
            return newList;
        });
    }, []);

    /**
     * Marca la lista como completada y la mueve al historial
     */
    const completeList = useCallback(() => {
        if (!activeList) return;

        const completedList = {
            ...activeList,
            completedAt: new Date().toISOString(),
            status: 'completed'
        };

        // Añadir al historial (máximo MAX_HISTORY)
        const newHistory = [completedList, ...history].slice(0, MAX_HISTORY);
        setHistory(newHistory);
        saveHistory(newHistory);

        // Limpiar lista activa
        setActiveList(null);
        saveActiveList(null);
    }, [activeList, history]);

    /**
     * Descarta la lista actual sin guardar en historial
     */
    const clearList = useCallback(() => {
        setActiveList(null);
        saveActiveList(null);
    }, []);

    /**
     * Restaura una lista del historial como activa
     */
    const restoreFromHistory = useCallback((historyIndex) => {
        const listToRestore = history[historyIndex];
        if (!listToRestore) return;

        // Reset checked status
        const restoredList = {
            ...listToRestore,
            items: listToRestore.items.map(item => ({ ...item, checked: false })),
            createdAt: new Date().toISOString(),
            restoredFrom: listToRestore.createdAt
        };

        setActiveList(restoredList);
        saveActiveList(restoredList);
    }, [history]);

    // Estadísticas útiles
    const stats = activeList ? {
        total: activeList.items.length,
        checked: activeList.items.filter(i => i.checked).length,
        progress: activeList.items.length > 0
            ? Math.round((activeList.items.filter(i => i.checked).length / activeList.items.length) * 100)
            : 0
    } : null;

    const value = {
        // Estado
        activeList,
        history,
        isLoading,
        stats,

        // Acciones
        setList,
        toggleItem,
        updateItemAmount,
        removeItem,
        addItem,
        completeList,
        clearList,
        restoreFromHistory
    };

    return (
        <ShoppingListContext.Provider value={value}>
            {children}
        </ShoppingListContext.Provider>
    );
}

export function useShoppingList() {
    const context = useContext(ShoppingListContext);
    if (!context) {
        throw new Error('useShoppingList must be used within ShoppingListProvider');
    }
    return context;
}

export default ShoppingListContext;
