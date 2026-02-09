/**
 * SupplementManagerScreen.jsx
 * Pantalla de gestión de suplementos del cliente
 * - Inventario con barras de progreso
 * - Calculadora de reposición
 * - Lista de compra auto-generada
 */

import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    Alert,
    Share,
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EnhancedTextInput } from '../../../../../components/ui';
import { useTheme } from '../../../../../context/ThemeContext';
import { useSupplementInventory } from '../../../../../src/context/SupplementInventoryContext';
import {
    calculatePlanConsumption,
    calculateRestockInfo,
    generateSupplementShoppingList,
    formatAmount
} from '../../../../../src/utils/supplementCalculator';
import { COMMON_SUPPLEMENTS, SUPPLEMENT_UNITS } from '../../../../../src/constants/commonSupplements';

export default function SupplementManagerScreen({ plan }) {
    const { theme } = useTheme();
    const {
        inventory,
        isLoading,
        addSupplement,
        updateSupplement,
        removeSupplement,
        restockSupplement,
        setSupplementStock
    } = useSupplementInventory();

    const [showAddModal, setShowAddModal] = useState(false);
    const [showRestockModal, setShowRestockModal] = useState(null); // supplement id
    const [restockAmount, setRestockAmount] = useState('');

    // Calcular consumo desde el plan
    const planConsumption = useMemo(() => {
        if (!plan) return {};
        return calculatePlanConsumption(plan);
    }, [plan]);

    // Generar lista de compra
    const shoppingList = useMemo(() => {
        return generateSupplementShoppingList(inventory, planConsumption);
    }, [inventory, planConsumption]);

    // Handler para añadir suplemento
    const handleAddSupplement = (suppData) => {
        addSupplement(suppData);
        setShowAddModal(false);
    };

    // Handler para rellenar stock
    const handleRestock = () => {
        if (!showRestockModal || !restockAmount) return;
        const amount = parseFloat(restockAmount);
        if (isNaN(amount) || amount <= 0) return;

        restockSupplement(showRestockModal, amount);
        setShowRestockModal(null);
        setRestockAmount('');
    };

    // Handler para compartir lista de compra
    const handleShareShoppingList = async () => {
        if (shoppingList.length === 0) return;

        let text = '💊 LISTA DE SUPLEMENTOS\n';
        text += '━━━━━━━━━━━━━━━━━━━━\n\n';

        shoppingList.forEach(item => {
            const urgency = item.status === 'critical' ? '🔴' :
                item.status === 'warning' ? '🟡' : '🟢';
            text += `${urgency} ${item.name}\n`;
            text += `   Comprar: ${item.suggestedPurchase.amount} ${item.suggestedPurchase.unit}\n`;
            text += `   Se acaba en: ${item.daysRemaining} días\n\n`;
        });

        text += '━━━━━━━━━━━━━━━━━━━━\n';
        text += '📱 Generado con TotalGains';

        try {
            await Share.share({ message: text, title: 'Lista de Suplementos' });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    if (isLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
                <Text style={{ color: theme.textSecondary }}>Cargando...</Text>
            </View>
        );
    }

    const urgentCount = shoppingList.filter(i => i.status === 'critical').length;

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingBottom: 100 }}
        >
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>💊 Mis Suplementos</Text>
                <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: theme.primary }]}
                    onPress={() => setShowAddModal(true)}
                >
                    <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Alerta urgente */}
            {urgentCount > 0 && (
                <View style={[styles.urgentAlert, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                    <Ionicons name="warning" size={20} color="#ef4444" />
                    <Text style={[styles.urgentText, { color: '#991b1b' }]}>
                        {urgentCount} suplemento{urgentCount > 1 ? 's' : ''} por agotarse
                    </Text>
                </View>
            )}

            {/* Lista de inventario */}
            {inventory.length === 0 ? (
                <View style={[styles.emptyState, { backgroundColor: theme.cardBackground }]}>
                    <Text style={{ fontSize: 48, marginBottom: 16 }}>💊</Text>
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin suplementos</Text>
                    <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                        Añade los suplementos que usas para hacer seguimiento del stock
                    </Text>
                    <TouchableOpacity
                        style={[styles.emptyBtn, { backgroundColor: theme.primary }]}
                        onPress={() => setShowAddModal(true)}
                    >
                        <Ionicons name="add" size={18} color="#fff" />
                        <Text style={styles.emptyBtnText}>Añadir primer suplemento</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.inventoryList}>
                    {inventory.map(item => {
                        const consumption = planConsumption[item.name.toLowerCase().trim()];
                        const restockInfo = calculateRestockInfo(item, consumption);

                        return (
                            <SupplementCard
                                key={item.id}
                                item={item}
                                restockInfo={restockInfo}
                                consumption={consumption}
                                theme={theme}
                                onRestock={() => {
                                    setShowRestockModal(item.id);
                                    setRestockAmount('');
                                }}
                                onRemove={() => {
                                    Alert.alert(
                                        'Eliminar',
                                        `¿Eliminar ${item.name} del inventario?`,
                                        [
                                            { text: 'Cancelar', style: 'cancel' },
                                            { text: 'Eliminar', style: 'destructive', onPress: () => removeSupplement(item.id) }
                                        ]
                                    );
                                }}
                            />
                        );
                    })}
                </View>
            )}

            {/* Lista de compra */}
            {shoppingList.length > 0 && (
                <View style={styles.shoppingSection}>
                    <View style={styles.shoppingSectionHeader}>
                        <Text style={[styles.shoppingTitle, { color: theme.text }]}>
                            🛒 Lista de Compra
                        </Text>
                        <TouchableOpacity onPress={handleShareShoppingList}>
                            <Ionicons name="share-outline" size={20} color={theme.primary} />
                        </TouchableOpacity>
                    </View>

                    {shoppingList.map((item, idx) => (
                        <View
                            key={idx}
                            style={[
                                styles.shoppingItem,
                                { backgroundColor: theme.cardBackground, borderLeftColor: item.statusColor }
                            ]}
                        >
                            <View style={styles.shoppingItemMain}>
                                <Text style={styles.shoppingItemIcon}>{item.statusIcon}</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.shoppingItemName, { color: theme.text }]}>
                                        {item.name}
                                    </Text>
                                    <Text style={[styles.shoppingItemSub, { color: theme.textSecondary }]}>
                                        Se acaba en {item.daysRemaining} días
                                    </Text>
                                </View>
                                <Text style={[styles.shoppingItemAmount, { color: item.statusColor }]}>
                                    {item.suggestedPurchase.amount} {item.suggestedPurchase.unit}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Modal Añadir Suplemento */}
            <AddSupplementModal
                visible={showAddModal}
                onClose={() => setShowAddModal(false)}
                onAdd={handleAddSupplement}
                theme={theme}
            />

            {/* Modal Rellenar Stock */}
            <Modal
                visible={!!showRestockModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowRestockModal(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>
                            Rellenar Stock
                        </Text>

                        <EnhancedTextInput
                            style={{ fontSize: 16, color: theme.text }}
                            containerStyle={{ borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16, backgroundColor: theme.inputBackground }}
                            value={restockAmount}
                            onChangeText={setRestockAmount}
                            keyboardType="numeric"
                            placeholder="Cantidad a añadir..."
                            placeholderTextColor={theme.textSecondary}
                            autoFocus
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.inputBackground }]}
                                onPress={() => setShowRestockModal(null)}
                            >
                                <Text style={{ color: theme.text }}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                                onPress={handleRestock}
                            >
                                <Text style={{ color: '#fff', fontWeight: '700' }}>Añadir</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

// Componente de tarjeta de suplemento
function SupplementCard({ item, restockInfo, consumption, theme, onRestock, onRemove }) {
    const progressPercentage = restockInfo.stockPercentage || 0;

    return (
        <View style={[styles.suppCard, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.suppCardHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.suppName, { color: theme.text }]}>{item.name}</Text>
                    {item.brand && (
                        <Text style={[styles.suppBrand, { color: theme.textSecondary }]}>{item.brand}</Text>
                    )}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: restockInfo.statusColor + '20' }]}>
                    <Text style={[styles.statusText, { color: restockInfo.statusColor }]}>
                        {restockInfo.statusIcon} {restockInfo.statusMessage}
                    </Text>
                </View>
            </View>

            {/* Barra de progreso */}
            <View style={styles.progressContainer}>
                <View style={[styles.progressTrack, { backgroundColor: theme.inputBackground }]}>
                    <View
                        style={[
                            styles.progressFill,
                            {
                                width: `${Math.min(progressPercentage, 100)}%`,
                                backgroundColor: restockInfo.statusColor
                            }
                        ]}
                    />
                </View>
                <Text style={[styles.progressText, { color: theme.textSecondary }]}>
                    {formatAmount(item.currentAmount, item.unit)} / {formatAmount(item.productSize, item.unit)}
                </Text>
            </View>

            {/* Info de consumo */}
            {consumption && (
                <View style={styles.consumptionInfo}>
                    <Text style={[styles.consumptionText, { color: theme.textSecondary }]}>
                        Consumo: {consumption.dailyAmount} {consumption.unit}/día
                    </Text>
                </View>
            )}

            {/* Acciones */}
            <View style={styles.suppActions}>
                <TouchableOpacity
                    style={[styles.suppActionBtn, { backgroundColor: theme.primary + '15' }]}
                    onPress={onRestock}
                >
                    <Ionicons name="add-circle-outline" size={16} color={theme.primary} />
                    <Text style={[styles.suppActionText, { color: theme.primary }]}>Rellenar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.suppActionBtn, { backgroundColor: '#fef2f2' }]}
                    onPress={onRemove}
                >
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

// Modal para añadir suplemento
function AddSupplementModal({ visible, onClose, onAdd, theme }) {
    const [name, setName] = useState('');
    const [currentAmount, setCurrentAmount] = useState('');
    const [productSize, setProductSize] = useState('');
    const [unit, setUnit] = useState('caps');
    const [brand, setBrand] = useState('');

    const handleAdd = () => {
        if (!name.trim()) return;

        onAdd({
            name: name.trim(),
            currentAmount: parseFloat(currentAmount) || 0,
            productSize: parseFloat(productSize) || parseFloat(currentAmount) || 0,
            unit,
            brand: brand.trim()
        });

        // Reset
        setName('');
        setCurrentAmount('');
        setProductSize('');
        setUnit('caps');
        setBrand('');
    };

    const selectPredefined = (supp) => {
        setName(supp.name);
        setUnit(supp.defaultUnit);
        if (supp.commonSizes?.length > 0) {
            setProductSize(String(supp.commonSizes[0]));
            setCurrentAmount(String(supp.commonSizes[0]));
        }
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.addModalContent, { backgroundColor: theme.cardBackground }]}>
                    <View style={styles.addModalHeader}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Añadir Suplemento</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ maxHeight: 400 }}>
                        {/* Sugerencias rápidas */}
                        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                            SELECCIÓN RÁPIDA
                        </Text>
                        <View style={styles.quickSelect}>
                            {COMMON_SUPPLEMENTS.slice(0, 8).map(supp => (
                                <TouchableOpacity
                                    key={supp.id}
                                    style={[styles.quickOption, { backgroundColor: theme.inputBackground }]}
                                    onPress={() => selectPredefined(supp)}
                                >
                                    <Text>{supp.emoji}</Text>
                                    <Text style={[styles.quickOptionText, { color: theme.text }]} numberOfLines={1}>
                                        {supp.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Formulario */}
                        <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 16 }]}>
                            DETALLES
                        </Text>

                        <EnhancedTextInput
                            style={{ fontSize: 15, color: theme.text }}
                            containerStyle={{ borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12, backgroundColor: theme.inputBackground }}
                            value={name}
                            onChangeText={setName}
                            placeholder="Nombre del suplemento..."
                            placeholderTextColor={theme.textSecondary}
                        />

                        <View style={styles.inputRow}>
                            <EnhancedTextInput
                                style={{ fontSize: 15, color: theme.text }}
                                containerStyle={{ borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12, flex: 1, backgroundColor: theme.inputBackground }}
                                value={currentAmount}
                                onChangeText={setCurrentAmount}
                                keyboardType="numeric"
                                placeholder="Stock actual"
                                placeholderTextColor={theme.textSecondary}
                            />
                            <EnhancedTextInput
                                style={{ fontSize: 15, color: theme.text }}
                                containerStyle={{ borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12, flex: 1, backgroundColor: theme.inputBackground }}
                                value={productSize}
                                onChangeText={setProductSize}
                                keyboardType="numeric"
                                placeholder="Tamaño bote"
                                placeholderTextColor={theme.textSecondary}
                            />
                        </View>

                        <View style={styles.unitSelector}>
                            {['caps', 'gramos', 'ml', 'scoop'].map(u => (
                                <TouchableOpacity
                                    key={u}
                                    style={[
                                        styles.unitOption,
                                        { backgroundColor: unit === u ? theme.primary : theme.inputBackground }
                                    ]}
                                    onPress={() => setUnit(u)}
                                >
                                    <Text style={{ color: unit === u ? '#fff' : theme.text, fontWeight: '600' }}>
                                        {SUPPLEMENT_UNITS.find(su => su.id === u)?.label || u}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <EnhancedTextInput
                            style={{ fontSize: 15, color: theme.text }}
                            containerStyle={{ borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12, backgroundColor: theme.inputBackground }}
                            value={brand}
                            onChangeText={setBrand}
                            placeholder="Marca (opcional)"
                            placeholderTextColor={theme.textSecondary}
                        />
                    </ScrollView>

                    <TouchableOpacity
                        style={[styles.addModalBtn, { backgroundColor: theme.primary, opacity: name.trim() ? 1 : 0.5 }]}
                        onPress={handleAdd}
                        disabled={!name.trim()}
                    >
                        <Ionicons name="add-circle" size={20} color="#fff" />
                        <Text style={styles.addModalBtnText}>Añadir al Inventario</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingTop: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
    },
    addBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    urgentAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        gap: 10,
    },
    urgentText: {
        fontSize: 14,
        fontWeight: '600',
    },
    emptyState: {
        margin: 16,
        padding: 32,
        borderRadius: 20,
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
    },
    emptyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        gap: 8,
    },
    emptyBtnText: {
        color: '#fff',
        fontWeight: '700',
    },
    inventoryList: {
        paddingHorizontal: 16,
        gap: 12,
    },
    suppCard: {
        borderRadius: 16,
        padding: 16,
    },
    suppCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    suppName: {
        fontSize: 16,
        fontWeight: '700',
    },
    suppBrand: {
        fontSize: 12,
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
    },
    progressContainer: {
        marginBottom: 12,
    },
    progressTrack: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 6,
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    progressText: {
        fontSize: 12,
    },
    consumptionInfo: {
        marginBottom: 12,
    },
    consumptionText: {
        fontSize: 12,
    },
    suppActions: {
        flexDirection: 'row',
        gap: 8,
    },
    suppActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        gap: 6,
    },
    suppActionText: {
        fontSize: 13,
        fontWeight: '600',
    },
    shoppingSection: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
    shoppingSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    shoppingTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    shoppingItem: {
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        borderLeftWidth: 4,
    },
    shoppingItemMain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    shoppingItemIcon: {
        fontSize: 20,
    },
    shoppingItemName: {
        fontSize: 15,
        fontWeight: '600',
    },
    shoppingItemSub: {
        fontSize: 12,
        marginTop: 2,
    },
    shoppingItemAmount: {
        fontSize: 14,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 20,
        padding: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    modalInput: {
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        marginBottom: 16,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    addModalContent: {
        width: '100%',
        maxWidth: 400,
        maxHeight: Dimensions.get('window').height * 0.8,
        borderRadius: 20,
        padding: 20,
    },
    addModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 10,
    },
    quickSelect: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    quickOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        gap: 6,
    },
    quickOptionText: {
        fontSize: 12,
        fontWeight: '600',
    },
    input: {
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        marginBottom: 12,
    },
    inputRow: {
        flexDirection: 'row',
        gap: 12,
    },
    inputHalf: {
        flex: 1,
    },
    unitSelector: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    unitOption: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    addModalBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 14,
        gap: 8,
        marginTop: 16,
    },
    addModalBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
