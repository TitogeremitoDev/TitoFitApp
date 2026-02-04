/* src/context/MealTrackingContext.js */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MealTrackingContext = createContext({});

const STORAGE_KEY = 'meal_tracking_v1';

export function MealTrackingProvider({ children }) {
    // Structure: { "YYYY-MM-DD": { "mealId_optionId": true, ... } }
    const [completedMeals, setCompletedMeals] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    // Load from storage on mount
    useEffect(() => {
        loadTrackingData();
    }, []);

    const loadTrackingData = async () => {
        try {
            const json = await AsyncStorage.getItem(STORAGE_KEY);
            if (json) {
                setCompletedMeals(JSON.parse(json));
            }
        } catch (e) {
            console.error('[MealTracking] Failed to load data:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const saveTrackingData = async (newData) => {
        try {
            const json = JSON.stringify(newData);
            await AsyncStorage.setItem(STORAGE_KEY, json);
        } catch (e) {
            console.error('[MealTracking] Failed to save data:', e);
        }
    };

    /**
     * Toggles the completion status of a meal option for a specific date.
     * @param {string} dateKey - Format "YYYY-MM-DD"
     * @param {string} mealId 
     * @param {string} optionId 
     */
    const toggleMealCompletion = useCallback((dateKey, mealId, optionId) => {
        if (!dateKey || mealId === undefined || mealId === null) return;

        setCompletedMeals(prev => {
            const dayData = prev[dateKey] || {};
            const key = `${mealId}_${optionId || 'default'}`;
            const isCompleted = !!dayData[key];

            const newDayData = {
                ...dayData,
                [key]: !isCompleted
            };

            // Clean up false values to save space? Optional. 
            // For now, simple toggle.

            const newData = {
                ...prev,
                [dateKey]: newDayData
            };

            saveTrackingData(newData);
            return newData;
        });
    }, []);

    const isMealCompleted = useCallback((dateKey, mealId, optionId) => {
        if (!completedMeals[dateKey]) return false;
        const key = `${mealId}_${optionId || 'default'}`;
        return !!completedMeals[dateKey][key];
    }, [completedMeals]);

    // Calculate progress for a specific day
    const getDailyProgress = useCallback((dateKey, totalMeals) => {
        if (!completedMeals[dateKey] || !totalMeals) return 0;
        const completedCount = Object.values(completedMeals[dateKey]).filter(v => v).length;
        // This is a rough estimate, assumes 1 completion per meal ID. 
        // If options are involved, might need refinement, but sufficient for visual progress.
        return Math.min(100, Math.round((completedCount / totalMeals) * 100));
    }, [completedMeals]);

    return (
        <MealTrackingContext.Provider value={{
            completedMeals,
            isLoading,
            toggleMealCompletion,
            isMealCompleted,
            getDailyProgress
        }}>
            {children}
        </MealTrackingContext.Provider>
    );
}

export const useMealTracking = () => useContext(MealTrackingContext);
