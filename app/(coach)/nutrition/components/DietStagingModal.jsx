import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StagingIdentityCard from './StagingIdentityCard';

export default function DietStagingModal({ visible, onClose, plan, onConfirm, isSaving }) {
    if (!plan) return null;

    // Active Day State (Tabs)
    const [activeDayId, setActiveDayId] = useState(null);

    // Initialize active day when plan loads
    useEffect(() => {
        if (plan?.dayTemplates?.length > 0) {
            setActiveDayId(0); // Default to index 0
        }
    }, [plan]);

    // Helper: Calculate Stats across ALL days and options
    const stats = useMemo(() => {
        const s = { green: 0, yellow: 0, red: 0, total: 0 };
        if (!plan?.dayTemplates) return s;

        plan.dayTemplates.forEach(day => {
            day.meals?.forEach(meal => {
                // Determine if structure is old (direct ingredients) or new (options)
                const options = meal.options || (meal.ingredients ? [{ ingredients: meal.ingredients }] : []);

                options.forEach(option => {
                    option.ingredients?.forEach(ing => {
                        s.total++;
                        if (ing.matchStatus === 'EXACT_MATCH') s.green++;
                        else if (ing.matchStatus === 'AMBIGUOUS') s.red++;
                        else s.yellow++;
                    });
                });
            });
        });
        return s;
    }, [plan]);

    // Get current day data
    const currentDay = plan.dayTemplates?.[activeDayId] || plan.dayTemplates?.[0];

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Revisión de Dieta IA</Text>
                        <Text style={styles.subtitle}>Verifica los alimentos detectados</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color="#64748b" />
                    </TouchableOpacity>
                </View>

                {/* Stats Bar */}
                <View style={styles.statsBar}>
                    <View style={styles.statItem}>
                        <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                        <Text style={[styles.statValue, { color: '#22c55e' }]}>{stats.green}</Text>
                        <Text style={styles.statLabel}>Verificados</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.statItem}>
                        <Ionicons name="flash" size={16} color="#f59e0b" />
                        <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.yellow}</Text>
                        <Text style={styles.statLabel}>Nuevos (IA)</Text>
                    </View>
                    {stats.red > 0 && (
                        <>
                            <View style={styles.divider} />
                            <View style={styles.statItem}>
                                <Ionicons name="warning" size={16} color="#ef4444" />
                                <Text style={[styles.statValue, { color: '#ef4444' }]}>{stats.red}</Text>
                                <Text style={styles.statLabel}>Revisar</Text>
                            </View>
                        </>
                    )}
                </View>

                {/* Day Tabs (Only if multiple days) */}
                {plan.dayTemplates?.length > 1 && (
                    <View style={styles.tabsContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
                            {plan.dayTemplates.map((day, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[styles.tab, activeDayId === index && styles.tabActive]}
                                    onPress={() => setActiveDayId(index)}
                                >
                                    <Text style={[styles.tabText, activeDayId === index && styles.tabTextActive]}>
                                        {day.name || `Día ${index + 1}`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Content */}
                <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
                    {currentDay && (
                        <View style={styles.daySection}>
                            {/* If single day, show title here since no tabs */}
                            {(!plan.dayTemplates || plan.dayTemplates.length <= 1) && (
                                <View style={styles.dayHeader}>
                                    <Text style={styles.dayTitle}>{currentDay.name || 'Plan General'}</Text>
                                </View>
                            )}

                            {currentDay.meals?.map((meal, mealIndex) => {
                                // Normalize options vs ingredients
                                const options = meal.options?.length > 0
                                    ? meal.options
                                    : (meal.ingredients ? [{ name: 'Única Opción', ingredients: meal.ingredients }] : []);

                                return (
                                    <View key={mealIndex} style={styles.mealSection}>
                                        <View style={styles.mealHeader}>
                                            <Text style={styles.mealTitle}>
                                                {meal.name} <Text style={styles.mealTime}>{meal.time || ''}</Text>
                                            </Text>
                                        </View>

                                        {options.map((option, optIndex) => (
                                            <View key={optIndex} style={styles.optionBlock}>
                                                {/* Option Header (Only if multiple options) */}
                                                {options.length > 1 && (
                                                    <Text style={styles.optionTitle}>{option.name || `Opción ${optIndex + 1}`}</Text>
                                                )}

                                                {option.ingredients?.map((ing, ingIndex) => (
                                                    <StagingIdentityCard
                                                        key={ingIndex}
                                                        ingredient={ing}
                                                        onPress={() => Alert.alert('Detalle', `Detectado: ${ing.rawText}\nInterpretado: ${ing.detectedName}`)}
                                                    />
                                                ))}
                                            </View>
                                        ))}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </ScrollView>

                {/* Footer Actions */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.confirmBtn, isSaving && { opacity: 0.7 }]}
                        onPress={onConfirm}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="save-outline" size={20} color="#fff" />
                                <Text style={styles.confirmText}>Confirmar e Importar</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 2,
    },
    closeBtn: {
        padding: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 20,
    },
    statsBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 12,
        marginBottom: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    divider: {
        width: 1,
        height: 20,
        backgroundColor: '#e2e8f0',
    },
    // Tabs
    tabsContainer: {
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    tabsContent: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    tab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
    },
    tabActive: {
        backgroundColor: '#3b82f6',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    tabTextActive: {
        color: '#fff',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    daySection: {
        marginBottom: 24,
    },
    dayHeader: {
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#3b82f6',
        paddingLeft: 10,
    },
    dayTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    mealSection: {
        marginBottom: 16,
        backgroundColor: '#f8fafc',
    },
    mealHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        paddingTop: 8,
    },
    mealTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#334155',
    },
    mealTime: {
        fontWeight: '400',
        color: '#94a3b8',
        fontSize: 13,
    },
    optionBlock: {
        marginBottom: 12,
        paddingLeft: 8, // Indent options slightly
        borderLeftWidth: 2,
        borderLeftColor: '#e2e8f0',
    },
    optionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 6,
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    footer: {
        padding: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingBottom: 40,
    },
    confirmBtn: {
        backgroundColor: '#22c55e',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 14,
        gap: 8,
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    confirmText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    }
});
