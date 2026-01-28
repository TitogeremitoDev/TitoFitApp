import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface FilterState {
    onlyFavorites: boolean;
    types: string[]; // Desayuno, Comida, etc.
    goals: string[]; // Volumen, Definición...
    macros: string[]; // Alta Proteína...
}

interface SidebarProps {
    filters: FilterState;
    onUpdate: (newFilters: FilterState) => void;
    onClose?: () => void; // For mobile
}

export default function FoodLibrarySidebar({ filters, onUpdate, onClose }: SidebarProps) {

    const toggleFilter = (category: keyof FilterState, value: string) => {
        const currentList = filters[category] as string[];
        const exists = currentList.includes(value);

        const newList = exists
            ? currentList.filter(item => item !== value)
            : [...currentList, value];

        onUpdate({ ...filters, [category]: newList });
    };

    const toggleFavorite = () => {
        onUpdate({ ...filters, onlyFavorites: !filters.onlyFavorites });
    };

    const resetFilters = () => {
        onUpdate({
            onlyFavorites: false,
            types: [],
            goals: [],
            macros: []
        });
    };

    const isAllActive = !filters.onlyFavorites && filters.types.length === 0 && filters.goals.length === 0 && filters.macros.length === 0;

    return (
        <View style={styles.container}>
            {/* Mobile Header (Only visible if onClose provided) */}
            {onClose && (
                <View style={styles.mobileHeader}>
                    <Text style={styles.headerTitle}>Filtros</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color="#1e293b" />
                    </TouchableOpacity>
                </View>
            )}

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* 🏠 PRINCIPAL */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Navegación</Text>

                    <FilterItem
                        label="Todo"
                        icon="home-outline"
                        isActive={isAllActive}
                        onPress={resetFilters}
                    />
                    <FilterItem
                        label="Favoritos"
                        icon="heart-outline"
                        activeIcon="heart"
                        isActive={filters.onlyFavorites}
                        onPress={toggleFavorite}
                    />
                </View>

                {/* ☕ TIPO DE COMIDA */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Tipo de Comida</Text>
                    {['Desayuno', 'Almuerzo', 'Cena', 'Snack'].map(type => (
                        <CheckboxItem
                            key={type}
                            label={type}
                            isChecked={filters.types.includes(type)}
                            onPress={() => toggleFilter('types', type)}
                        />
                    ))}
                </View>

                {/* 📉 OBJETIVO / ETAPA */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Objetivo</Text>
                    {[
                        { id: 'DEFINICION', label: 'Definición' },
                        { id: 'VOLUMEN', label: 'Volumen' },
                        { id: 'MANTENIMIENTO', label: 'Mantenimiento' }
                    ].map(goal => (
                        <CheckboxItem
                            key={goal.id}
                            label={goal.label}
                            isChecked={filters.goals.includes(goal.id)}
                            onPress={() => toggleFilter('goals', goal.id)}
                        />
                    ))}
                </View>

                {/* 💪 MACROS */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Macros</Text>
                    {[
                        { id: 'ALTA_PROTEINA', label: 'Alta Proteína' },
                        { id: 'LOW_CARB', label: 'Low Carb' },
                        { id: 'BAJO_GRASA', label: 'Bajo Grasa' },
                        { id: 'VEGANO', label: 'Vegano' }
                    ].map(macro => (
                        <CheckboxItem
                            key={macro.id}
                            label={macro.label}
                            isChecked={filters.macros.includes(macro.id)}
                            onPress={() => toggleFilter('macros', macro.id)}
                        />
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

// ─────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────

const FilterItem = ({ label, icon, activeIcon, isActive, onPress }: any) => (
    <TouchableOpacity
        style={[styles.item, isActive && styles.itemActive]}
        onPress={onPress}
    >
        <Ionicons
            name={isActive && activeIcon ? activeIcon : icon}
            size={18}
            color={isActive ? '#2563eb' : '#64748b'}
        />
        <Text style={[styles.itemLabel, isActive && styles.itemLabelActive]}>{label}</Text>
    </TouchableOpacity>
);

const CheckboxItem = ({ label, isChecked, onPress }: any) => (
    <TouchableOpacity style={styles.checkboxRow} onPress={onPress}>
        <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
            {isChecked && <Ionicons name="checkmark" size={12} color="#fff" />}
        </View>
        <Text style={[styles.checkboxLabel, isChecked && styles.checkboxLabelChecked]}>{label}</Text>
    </TouchableOpacity>
);

// ─────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        borderRightWidth: 1,
        borderColor: '#f1f5f9',
        minWidth: 240,
        maxWidth: 280,
    },
    mobileHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderColor: '#f1f5f9'
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700'
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40
    },
    section: {
        marginBottom: 24
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94a3b8',
        textTransform: 'uppercase',
        marginBottom: 12,
        letterSpacing: 0.5
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 4
    },
    itemActive: {
        backgroundColor: '#eff6ff' // Blue-50
    },
    itemLabel: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500'
    },
    itemLabelActive: {
        color: '#2563eb', // Blue-600
        fontWeight: '600'
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
        paddingHorizontal: 8
    },
    checkbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff'
    },
    checkboxChecked: {
        backgroundColor: '#2563eb',
        borderColor: '#2563eb'
    },
    checkboxLabel: {
        fontSize: 14,
        color: '#475569'
    },
    checkboxLabelChecked: {
        color: '#1e293b',
        fontWeight: '600'
    }
});
