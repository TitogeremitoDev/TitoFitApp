/**
 * SupplementDrawer.jsx
 * Drawer para añadir suplementos a una comida (Coach)
 */

import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Platform
} from 'react-native';
import { EnhancedTextInput } from '../../../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import {
    COMMON_SUPPLEMENTS,
    SUPPLEMENT_UNITS,
    SUPPLEMENT_TIMINGS,
    SUPPLEMENT_CATEGORIES
} from '../../../../src/constants/commonSupplements';

export default function SupplementDrawer({
    visible,
    onClose,
    onAdd,
    mealName = 'Comida'
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSupplement, setSelectedSupplement] = useState(null);
    const [amount, setAmount] = useState('');
    const [unit, setUnit] = useState('');
    const [timing, setTiming] = useState('con');
    const [customName, setCustomName] = useState('');
    const [showCustom, setShowCustom] = useState(false);

    // Filtrar suplementos
    const filteredSupplements = useMemo(() => {
        if (!searchQuery.trim()) return COMMON_SUPPLEMENTS;
        const query = searchQuery.toLowerCase();
        return COMMON_SUPPLEMENTS.filter(s =>
            s.name.toLowerCase().includes(query) ||
            s.category.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    // Agrupar por categoría
    const groupedSupplements = useMemo(() => {
        const groups = {};
        filteredSupplements.forEach(supp => {
            if (!groups[supp.category]) groups[supp.category] = [];
            groups[supp.category].push(supp);
        });
        return groups;
    }, [filteredSupplements]);

    const handleSelectSupplement = (supp) => {
        setSelectedSupplement(supp);
        setAmount(String(supp.defaultAmount));
        setUnit(supp.defaultUnit);
        setShowCustom(false);
    };

    const handleShowCustom = () => {
        setSelectedSupplement(null);
        setShowCustom(true);
        setCustomName('');
        setAmount('');
        setUnit('caps');
    };

    const handleAdd = () => {
        const name = showCustom ? customName.trim() : selectedSupplement?.name;
        if (!name) return;

        const supplement = {
            id: `supp_${Date.now()}`,
            name,
            amount: parseFloat(amount) || 0,
            unit: unit || 'caps',
            timing
        };

        onAdd(supplement);
        handleReset();
        onClose();
    };

    const handleReset = () => {
        setSearchQuery('');
        setSelectedSupplement(null);
        setAmount('');
        setUnit('');
        setTiming('con');
        setCustomName('');
        setShowCustom(false);
    };

    const canAdd = (showCustom ? customName.trim() : selectedSupplement) && amount;

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.drawer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>Añadir Suplemento</Text>
                            <Text style={styles.subtitle}>Para: {mealName}</Text>
                        </View>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Si hay suplemento seleccionado o modo custom, mostrar formulario */}
                    {(selectedSupplement || showCustom) ? (
                        <ScrollView style={styles.formContainer}>
                            {/* Nombre */}
                            <View style={styles.formSection}>
                                <Text style={styles.formLabel}>Suplemento</Text>
                                {showCustom ? (
                                    <EnhancedTextInput
                                        containerStyle={styles.inputContainer}
                                        style={styles.inputText}
                                        value={customName}
                                        onChangeText={setCustomName}
                                        placeholder="Nombre del suplemento..."
                                        placeholderTextColor="#94a3b8"
                                        autoFocus
                                    />
                                ) : (
                                    <View style={styles.selectedPill}>
                                        <Text style={styles.selectedPillEmoji}>
                                            {selectedSupplement?.emoji || '💊'}
                                        </Text>
                                        <Text style={styles.selectedPillText}>
                                            {selectedSupplement?.name}
                                        </Text>
                                        <TouchableOpacity onPress={() => setSelectedSupplement(null)}>
                                            <Ionicons name="close-circle" size={20} color="#94a3b8" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            {/* Cantidad y Unidad */}
                            <View style={styles.formRow}>
                                <View style={[styles.formSection, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>Cantidad</Text>
                                    <EnhancedTextInput
                                        containerStyle={styles.inputContainer}
                                        style={styles.inputText}
                                        value={amount}
                                        onChangeText={setAmount}
                                        keyboardType="numeric"
                                        placeholder="0"
                                        placeholderTextColor="#94a3b8"
                                    />
                                </View>
                                <View style={[styles.formSection, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>Unidad</Text>
                                    <View style={styles.unitSelector}>
                                        {SUPPLEMENT_UNITS.slice(0, 4).map(u => (
                                            <TouchableOpacity
                                                key={u.id}
                                                style={[
                                                    styles.unitOption,
                                                    unit === u.id && styles.unitOptionActive
                                                ]}
                                                onPress={() => setUnit(u.id)}
                                            >
                                                <Text style={[
                                                    styles.unitOptionText,
                                                    unit === u.id && styles.unitOptionTextActive
                                                ]}>
                                                    {u.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            {/* Timing */}
                            <View style={styles.formSection}>
                                <Text style={styles.formLabel}>Cuándo tomar</Text>
                                <View style={styles.timingSelector}>
                                    {SUPPLEMENT_TIMINGS.map(t => (
                                        <TouchableOpacity
                                            key={t.id}
                                            style={[
                                                styles.timingOption,
                                                timing === t.id && styles.timingOptionActive
                                            ]}
                                            onPress={() => setTiming(t.id)}
                                        >
                                            <Text style={styles.timingIcon}>{t.icon}</Text>
                                            <Text style={[
                                                styles.timingText,
                                                timing === t.id && styles.timingTextActive
                                            ]}>
                                                {t.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Botón Añadir */}
                            <TouchableOpacity
                                style={[styles.addBtn, !canAdd && styles.addBtnDisabled]}
                                onPress={handleAdd}
                                disabled={!canAdd}
                            >
                                <Ionicons name="add-circle" size={20} color="#fff" />
                                <Text style={styles.addBtnText}>Añadir a {mealName}</Text>
                            </TouchableOpacity>

                            {/* Botón Volver */}
                            <TouchableOpacity
                                style={styles.backBtn}
                                onPress={handleReset}
                            >
                                <Ionicons name="arrow-back" size={16} color="#64748b" />
                                <Text style={styles.backBtnText}>Elegir otro</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    ) : (
                        /* Lista de suplementos */
                        <>
                            {/* Search */}
                            <View style={styles.searchContainer}>
                                <Ionicons name="search" size={18} color="#94a3b8" />
                                <EnhancedTextInput
                                    containerStyle={styles.searchInputContainer}
                                    style={styles.searchInputText}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholder="Buscar suplemento..."
                                    placeholderTextColor="#94a3b8"
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <Ionicons name="close-circle" size={18} color="#94a3b8" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Custom Option */}
                            <TouchableOpacity
                                style={styles.customOption}
                                onPress={handleShowCustom}
                            >
                                <View style={styles.customIconCircle}>
                                    <Ionicons name="add" size={20} color="#3b82f6" />
                                </View>
                                <View>
                                    <Text style={styles.customTitle}>Añadir Personalizado</Text>
                                    <Text style={styles.customSubtitle}>Suplemento no listado</Text>
                                </View>
                            </TouchableOpacity>

                            {/* Lista agrupada */}
                            <ScrollView style={styles.listContainer}>
                                {Object.entries(groupedSupplements).map(([category, supps]) => (
                                    <View key={category} style={styles.categoryGroup}>
                                        <Text style={styles.categoryTitle}>{category}</Text>
                                        <View style={styles.supplementsGrid}>
                                            {supps.map(supp => (
                                                <TouchableOpacity
                                                    key={supp.id}
                                                    style={styles.supplementCard}
                                                    onPress={() => handleSelectSupplement(supp)}
                                                >
                                                    <Text style={styles.supplementEmoji}>{supp.emoji}</Text>
                                                    <Text style={styles.supplementName} numberOfLines={2}>
                                                        {supp.name}
                                                    </Text>
                                                    <Text style={styles.supplementDefault}>
                                                        {supp.defaultAmount}{SUPPLEMENT_UNITS.find(u => u.id === supp.defaultUnit)?.label || supp.defaultUnit}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                ))}

                                {filteredSupplements.length === 0 && (
                                    <View style={styles.emptyState}>
                                        <Ionicons name="search-outline" size={48} color="#cbd5e1" />
                                        <Text style={styles.emptyText}>No se encontraron suplementos</Text>
                                        <TouchableOpacity
                                            style={styles.emptyBtn}
                                            onPress={handleShowCustom}
                                        >
                                            <Text style={styles.emptyBtnText}>Añadir personalizado</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </ScrollView>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    drawer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
        minHeight: '50%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1e293b',
    },
    subtitle: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    closeBtn: {
        padding: 8,
    },

    // Search
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        marginHorizontal: 20,
        marginVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 15,
        color: '#1e293b',
    },
    searchInputContainer: {
        flex: 1,
        paddingVertical: 12,
    },
    searchInputText: {
        fontSize: 15,
        color: '#1e293b',
    },

    // Custom Option
    customOption: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        marginBottom: 16,
        padding: 12,
        backgroundColor: '#eff6ff',
        borderRadius: 12,
        gap: 12,
    },
    customIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#dbeafe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    customTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e40af',
    },
    customSubtitle: {
        fontSize: 12,
        color: '#3b82f6',
    },

    // List
    listContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    categoryGroup: {
        marginBottom: 20,
    },
    categoryTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    supplementsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    supplementCard: {
        width: '30%',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    supplementEmoji: {
        fontSize: 28,
        marginBottom: 6,
    },
    supplementName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
        textAlign: 'center',
        marginBottom: 4,
    },
    supplementDefault: {
        fontSize: 10,
        color: '#94a3b8',
    },

    // Form
    formContainer: {
        padding: 20,
    },
    formSection: {
        marginBottom: 20,
    },
    formRow: {
        flexDirection: 'row',
        gap: 12,
    },
    formLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#1e293b',
        fontWeight: '600',
    },
    inputContainer: {
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    inputText: {
        fontSize: 16,
        color: '#1e293b',
        fontWeight: '600',
    },
    selectedPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 10,
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    selectedPillEmoji: {
        fontSize: 24,
    },
    selectedPillText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
        color: '#166534',
    },

    // Unit Selector
    unitSelector: {
        flexDirection: 'row',
        gap: 6,
    },
    unitOption: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
    },
    unitOptionActive: {
        backgroundColor: '#3b82f6',
    },
    unitOptionText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
    },
    unitOptionTextActive: {
        color: '#fff',
    },

    // Timing Selector
    timingSelector: {
        flexDirection: 'row',
        gap: 8,
    },
    timingOption: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        gap: 4,
    },
    timingOptionActive: {
        backgroundColor: '#dbeafe',
        borderWidth: 2,
        borderColor: '#3b82f6',
    },
    timingIcon: {
        fontSize: 20,
    },
    timingText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
        textAlign: 'center',
    },
    timingTextActive: {
        color: '#1e40af',
    },

    // Add Button
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#22c55e',
        paddingVertical: 16,
        borderRadius: 14,
        gap: 8,
        marginTop: 10,
    },
    addBtnDisabled: {
        backgroundColor: '#cbd5e1',
    },
    addBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },

    // Back Button
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 6,
        marginTop: 8,
    },
    backBtnText: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 12,
    },
    emptyBtn: {
        marginTop: 16,
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: '#eff6ff',
        borderRadius: 8,
    },
    emptyBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#3b82f6',
    },
});
