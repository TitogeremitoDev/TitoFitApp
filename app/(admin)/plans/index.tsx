import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    TextInput,
    Alert,
    ActivityIndicator,
    Modal,
    Switch,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';

// API URL
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

interface Plan {
    id: string | number;
    nombre: string;
    precioActual: number;
    precioOriginal: number;
    etiquetaOferta?: string | null;
    textoAhorro?: string | null;
    destacado: boolean;
    activo: boolean;
    moneda: string;
    isCoach?: boolean;
    clientRange?: number | null;
}

interface PromoCode {
    _id: string;
    code: string;
    description: string;
    upgradeToType: string;
    maxUses: number;
    usedCount: number;
    usesRemaining: number | string;
    expiresAt: string | null;
    isExpired: boolean;
    active: boolean;
    createdAt: string;
}

export default function AdminPanel() {
    const { isDark, theme } = useTheme();
    const { user } = useAuth();
    const router = useRouter();

    // Plans state
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [saving, setSaving] = useState(false);

    // Promo codes state
    const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
    const [loadingCodes, setLoadingCodes] = useState(true);
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
    const [savingCode, setSavingCode] = useState(false);

    // Plan form state
    const [formData, setFormData] = useState({
        precioActual: '',
        precioOriginal: '',
        etiquetaOferta: '',
        textoAhorro: '',
        destacado: false,
        activo: true,
        isCoach: false,
        clientRange: ''
    });

    // Promo code form state
    const [codeFormData, setCodeFormData] = useState({
        code: '',
        description: '',
        upgradeToType: 'PREMIUM',
        maxUses: '50',
        expiresAt: ''
    });

    useEffect(() => {
        loadPlans();
        loadPromoCodes();
    }, []);

    // ═══════════════════════════════════════════════════════════════════════
    // PROMO CODES FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    const loadPromoCodes = async () => {
        try {
            setLoadingCodes(true);
            const token = await AsyncStorage.getItem('totalgains_token');
            const res = await fetch(`${API_URL}/api/promo-codes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setPromoCodes(data.codes);
            }
        } catch (error) {
            console.error('Error loading promo codes:', error);
        } finally {
            setLoadingCodes(false);
        }
    };

    const handleCreateCode = () => {
        setEditingCode(null);
        setCodeFormData({
            code: '',
            description: '',
            upgradeToType: 'PREMIUM',
            maxUses: '50',
            expiresAt: ''
        });
        setShowCodeModal(true);
    };

    const handleEditCode = (code: PromoCode) => {
        setEditingCode(code);
        setCodeFormData({
            code: code.code,
            description: code.description,
            upgradeToType: code.upgradeToType,
            maxUses: String(code.maxUses),
            expiresAt: code.expiresAt ? code.expiresAt.split('T')[0] : ''
        });
        setShowCodeModal(true);
    };

    const handleSaveCode = async () => {
        if (!codeFormData.code.trim()) {
            Alert.alert('Error', 'El código es obligatorio');
            return;
        }

        try {
            setSavingCode(true);
            const token = await AsyncStorage.getItem('totalgains_token');

            const payload = {
                code: codeFormData.code.toUpperCase().trim(),
                description: codeFormData.description,
                upgradeToType: codeFormData.upgradeToType,
                maxUses: parseInt(codeFormData.maxUses) || 50,
                expiresAt: codeFormData.expiresAt || null,
                active: true
            };

            const url = editingCode
                ? `${API_URL}/api/promo-codes/${editingCode._id}`
                : `${API_URL}/api/promo-codes`;

            const res = await fetch(url, {
                method: editingCode ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (data.success) {
                Alert.alert('Éxito', editingCode ? 'Código actualizado' : 'Código creado');
                setShowCodeModal(false);
                loadPromoCodes();
            } else {
                throw new Error(data.message || 'Error al guardar');
            }
        } catch (error) {
            console.error('Error saving code:', error);
            const message = error instanceof Error ? error.message : 'Error al guardar código';
            Alert.alert('Error', message);
        } finally {
            setSavingCode(false);
        }
    };

    const handleToggleCode = async (code: PromoCode) => {
        try {
            const token = await AsyncStorage.getItem('totalgains_token');
            const res = await fetch(`${API_URL}/api/promo-codes/${code._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ active: !code.active })
            });

            const data = await res.json();
            if (data.success) {
                loadPromoCodes();
            }
        } catch (error) {
            console.error('Error toggling code:', error);
        }
    };

    const handleDeleteCode = async (code: PromoCode) => {
        Alert.alert(
            'Eliminar Código',
            `¿Estás seguro de eliminar "${code.code}"?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('totalgains_token');
                            await fetch(`${API_URL}/api/promo-codes/${code._id}`, {
                                method: 'DELETE',
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            loadPromoCodes();
                        } catch (error) {
                            console.error('Error deleting code:', error);
                        }
                    }
                }
            ]
        );
    };

    const getCodeStatus = (code: PromoCode) => {
        if (!code.active) return { label: 'DESACTIVADO', color: '#6B7280' };
        if (code.isExpired) return { label: 'EXPIRADO', color: '#EF4444' };
        if (code.maxUses > 0 && code.usedCount >= code.maxUses) return { label: 'AGOTADO', color: '#F59E0B' };
        return { label: 'ACTIVO', color: '#10B981' };
    };

    // ═══════════════════════════════════════════════════════════════════════
    // PLANS FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    const loadPlans = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/api/plans`);
            const data = await res.json();
            if (data.success) {
                setPlans(data.plans);
            }
        } catch (error) {
            console.error('Error loading plans:', error);
            Alert.alert('Error', 'No se pudieron cargar los planes');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (plan: Plan) => {
        setEditingPlan(plan);
        setFormData({
            precioActual: String(plan.precioActual),
            precioOriginal: String(plan.precioOriginal),
            etiquetaOferta: plan.etiquetaOferta || '',
            textoAhorro: plan.textoAhorro || '',
            destacado: plan.destacado,
            activo: true,
            isCoach: plan.isCoach || false,
            clientRange: plan.clientRange ? String(plan.clientRange) : ''
        });
    };

    const handleSave = async () => {
        if (!editingPlan) return;
        try {
            setSaving(true);
            const token = await AsyncStorage.getItem('totalgains_token');

            const payload = {
                precioActual: parseFloat(formData.precioActual),
                precioOriginal: parseFloat(formData.precioOriginal),
                etiquetaOferta: formData.etiquetaOferta || null,
                textoAhorro: formData.textoAhorro || null,
                destacado: formData.destacado,
                activo: formData.activo,
                isCoach: formData.isCoach,
                clientRange: formData.clientRange ? parseInt(formData.clientRange) : null
            };

            const res = await fetch(`${API_URL}/api/plans/${editingPlan.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (data.success) {
                Alert.alert('Éxito', 'Plan actualizado correctamente');
                setEditingPlan(null);
                loadPlans();
            } else {
                throw new Error(data.error || 'Error al actualizar');
            }
        } catch (error) {
            console.error('Error saving plan:', error);
            const message = error instanceof Error ? error.message : 'No se pudo guardar el cambio';
            Alert.alert('Error', message);
        } finally {
            setSaving(false);
        }
    };

    const handleRefresh = () => {
        loadPlans();
        loadPromoCodes();
    };

    if (loading && loadingCodes) {
        return (
            <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f3f4f6', justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color="#10B981" />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f3f4f6' }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.title, { color: isDark ? '#FFF' : '#1f2937' }]}>
                    Panel de Administración
                </Text>
                <Pressable onPress={handleRefresh}>
                    <Ionicons name="refresh" size={24} color={isDark ? '#FFF' : '#000'} />
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* ═══════════════════════════════════════════════════════════════════
                    SECCIÓN: CÓDIGOS PREMIUM
                ═══════════════════════════════════════════════════════════════════ */}
                <View style={styles.sectionContainer}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                            <Ionicons name="gift" size={24} color="#FFD700" />
                            <Text style={[styles.sectionTitle, { color: isDark ? '#FFF' : '#1f2937' }]}>
                                Códigos Premium
                            </Text>
                        </View>
                        <Pressable
                            onPress={handleCreateCode}
                            style={[styles.addButton, { backgroundColor: '#10B981' }]}
                        >
                            <Ionicons name="add" size={20} color="#FFF" />
                            <Text style={styles.addButtonText}>Crear</Text>
                        </Pressable>
                    </View>

                    {loadingCodes ? (
                        <ActivityIndicator size="small" color="#10B981" />
                    ) : promoCodes.length === 0 ? (
                        <View style={[styles.emptyCard, { backgroundColor: isDark ? '#1f2937' : '#FFF' }]}>
                            <Ionicons name="gift-outline" size={40} color="#9CA3AF" />
                            <Text style={{ color: '#9CA3AF', marginTop: 8 }}>No hay códigos creados</Text>
                        </View>
                    ) : (
                        promoCodes.map((code) => {
                            const status = getCodeStatus(code);
                            return (
                                <View key={code._id} style={[styles.codeCard, { backgroundColor: isDark ? '#1f2937' : '#FFF' }]}>
                                    <View style={styles.codeHeader}>
                                        <View>
                                            <Text style={[styles.codeText, { color: isDark ? '#FFF' : '#000' }]}>
                                                {code.code}
                                            </Text>
                                            {code.description && (
                                                <Text style={{ color: '#9CA3AF', fontSize: 12 }}>{code.description}</Text>
                                            )}
                                        </View>
                                        <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
                                            <Text style={styles.statusText}>{status.label}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.codeStats}>
                                        <View style={styles.codeStat}>
                                            <Ionicons name="people" size={16} color="#6B7280" />
                                            <Text style={{ color: isDark ? '#D1D5DB' : '#4B5563', marginLeft: 4 }}>
                                                {code.usedCount} / {code.maxUses === 0 ? '∞' : code.maxUses} usos
                                            </Text>
                                        </View>
                                        {code.expiresAt && (
                                            <View style={styles.codeStat}>
                                                <Ionicons name="calendar" size={16} color="#6B7280" />
                                                <Text style={{ color: isDark ? '#D1D5DB' : '#4B5563', marginLeft: 4 }}>
                                                    Expira: {new Date(code.expiresAt).toLocaleDateString()}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.codeActions}>
                                        <Pressable onPress={() => handleEditCode(code)} style={styles.iconBtn}>
                                            <Ionicons name="pencil" size={18} color="#3B82F6" />
                                        </Pressable>
                                        <Pressable onPress={() => handleToggleCode(code)} style={styles.iconBtn}>
                                            <Ionicons
                                                name={code.active ? "pause" : "play"}
                                                size={18}
                                                color={code.active ? "#F59E0B" : "#10B981"}
                                            />
                                        </Pressable>
                                        <Pressable onPress={() => handleDeleteCode(code)} style={styles.iconBtn}>
                                            <Ionicons name="trash" size={18} color="#EF4444" />
                                        </Pressable>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>

                {/* ═══════════════════════════════════════════════════════════════════
                    SECCIÓN: PLANES
                ═══════════════════════════════════════════════════════════════════ */}
                <View style={[styles.sectionContainer, { marginTop: 24 }]}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                            <Ionicons name="card" size={24} color="#3B82F6" />
                            <Text style={[styles.sectionTitle, { color: isDark ? '#FFF' : '#1f2937' }]}>
                                Gestión de Planes
                            </Text>
                        </View>
                    </View>

                    <Text style={[styles.subtitle, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                        Edita los precios y ofertas en tiempo real.
                    </Text>

                    {plans.map((plan) => (
                        <View key={plan.id} style={[styles.card, { backgroundColor: isDark ? '#1f2937' : '#FFF' }]}>
                            <View style={styles.cardHeader}>
                                <View>
                                    <Text style={[styles.planName, { color: isDark ? '#FFF' : '#000' }]}>{plan.nombre}</Text>
                                    {plan.isCoach && plan.clientRange && (
                                        <Text style={{ color: '#8B5CF6', fontSize: 12, marginBottom: 4 }}>
                                            Hasta {plan.clientRange} clientes
                                        </Text>
                                    )}
                                    <Text style={{ color: '#10B981', fontWeight: 'bold' }}>
                                        {plan.moneda === 'EUR' ? '€' : '$'}{plan.precioActual}
                                    </Text>
                                </View>
                                <Pressable onPress={() => handleEdit(plan)} style={styles.editButton}>
                                    <Ionicons name="pencil" size={20} color="#FFF" />
                                </Pressable>
                            </View>

                            <View style={styles.cardDetails}>
                                {plan.isCoach && (
                                    <View style={[styles.badge, { backgroundColor: '#8B5CF6' }]}>
                                        <Text style={styles.badgeText}>ENTRENADOR</Text>
                                    </View>
                                )}
                                {plan.etiquetaOferta && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{plan.etiquetaOferta}</Text>
                                    </View>
                                )}
                                {plan.destacado && (
                                    <View style={[styles.badge, { backgroundColor: '#F59E0B' }]}>
                                        <Text style={styles.badgeText}>DESTACADO</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL: CREAR/EDITAR CÓDIGO PREMIUM
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal
                visible={showCodeModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowCodeModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: isDark ? '#1f2937' : '#FFF' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: isDark ? '#FFF' : '#000' }]}>
                                {editingCode ? 'Editar Código' : 'Crear Código Premium'}
                            </Text>
                            <Pressable onPress={() => setShowCodeModal(false)}>
                                <Ionicons name="close" size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
                            </Pressable>
                        </View>

                        <ScrollView>
                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#374151' }]}>
                                    Código *
                                </Text>
                                <TextInput
                                    style={[styles.input, {
                                        backgroundColor: isDark ? '#374151' : '#f9fafb',
                                        color: isDark ? '#FFF' : '#000'
                                    }]}
                                    value={codeFormData.code}
                                    onChangeText={(t) => setCodeFormData({ ...codeFormData, code: t.toUpperCase() })}
                                    placeholder="ej: PREMIUM2024"
                                    placeholderTextColor="#9CA3AF"
                                    autoCapitalize="characters"
                                    editable={!editingCode}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#374151' }]}>
                                    Descripción
                                </Text>
                                <TextInput
                                    style={[styles.input, {
                                        backgroundColor: isDark ? '#374151' : '#f9fafb',
                                        color: isDark ? '#FFF' : '#000'
                                    }]}
                                    value={codeFormData.description}
                                    onChangeText={(t) => setCodeFormData({ ...codeFormData, description: t })}
                                    placeholder="ej: Código para primeros 50 usuarios"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#374151' }]}>
                                    Máximo de usos (0 = ilimitado)
                                </Text>
                                <TextInput
                                    style={[styles.input, {
                                        backgroundColor: isDark ? '#374151' : '#f9fafb',
                                        color: isDark ? '#FFF' : '#000'
                                    }]}
                                    value={codeFormData.maxUses}
                                    onChangeText={(t) => setCodeFormData({ ...codeFormData, maxUses: t })}
                                    placeholder="50"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="numeric"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#374151' }]}>
                                    Fecha de expiración (opcional)
                                </Text>
                                <TextInput
                                    style={[styles.input, {
                                        backgroundColor: isDark ? '#374151' : '#f9fafb',
                                        color: isDark ? '#FFF' : '#000'
                                    }]}
                                    value={codeFormData.expiresAt}
                                    onChangeText={(t) => setCodeFormData({ ...codeFormData, expiresAt: t })}
                                    placeholder="YYYY-MM-DD (ej: 2025-01-31)"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#374151' }]}>
                                    Tipo de upgrade
                                </Text>
                                <View style={styles.upgradeTypeRow}>
                                    <Pressable
                                        style={[
                                            styles.upgradeTypeBtn,
                                            codeFormData.upgradeToType === 'PREMIUM' && styles.upgradeTypeBtnActive
                                        ]}
                                        onPress={() => setCodeFormData({ ...codeFormData, upgradeToType: 'PREMIUM' })}
                                    >
                                        <Text style={[
                                            styles.upgradeTypeBtnText,
                                            codeFormData.upgradeToType === 'PREMIUM' && { color: '#FFF' }
                                        ]}>PREMIUM</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[
                                            styles.upgradeTypeBtn,
                                            codeFormData.upgradeToType === 'CLIENTE' && styles.upgradeTypeBtnActive
                                        ]}
                                        onPress={() => setCodeFormData({ ...codeFormData, upgradeToType: 'CLIENTE' })}
                                    >
                                        <Text style={[
                                            styles.upgradeTypeBtnText,
                                            codeFormData.upgradeToType === 'CLIENTE' && { color: '#FFF' }
                                        ]}>CLIENTE</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </ScrollView>

                        <Pressable
                            onPress={handleSaveCode}
                            disabled={savingCode}
                            style={[styles.saveButton, savingCode && { opacity: 0.7 }]}
                        >
                            {savingCode ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.saveButtonText}>
                                    {editingCode ? 'Actualizar' : 'Crear Código'}
                                </Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL: EDITAR PLAN
            ═══════════════════════════════════════════════════════════════════ */}
            <Modal
                visible={!!editingPlan}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setEditingPlan(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: isDark ? '#1f2937' : '#FFF' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: isDark ? '#FFF' : '#000' }]}>
                                Editar {editingPlan?.nombre}
                            </Text>
                            <Pressable onPress={() => setEditingPlan(null)}>
                                <Ionicons name="close" size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
                            </Pressable>
                        </View>

                        <ScrollView>
                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#374151' }]}>Precio Actual</Text>
                                <TextInput
                                    style={[styles.input, {
                                        backgroundColor: isDark ? '#374151' : '#f9fafb',
                                        color: isDark ? '#FFF' : '#000'
                                    }]}
                                    keyboardType="numeric"
                                    value={formData.precioActual}
                                    onChangeText={(t) => setFormData({ ...formData, precioActual: t })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#374151' }]}>Precio Original (Tachado)</Text>
                                <TextInput
                                    style={[styles.input, {
                                        backgroundColor: isDark ? '#374151' : '#f9fafb',
                                        color: isDark ? '#FFF' : '#000'
                                    }]}
                                    keyboardType="numeric"
                                    value={formData.precioOriginal}
                                    onChangeText={(t) => setFormData({ ...formData, precioOriginal: t })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#374151' }]}>Etiqueta Oferta</Text>
                                <TextInput
                                    style={[styles.input, {
                                        backgroundColor: isDark ? '#374151' : '#f9fafb',
                                        color: isDark ? '#FFF' : '#000'
                                    }]}
                                    value={formData.etiquetaOferta}
                                    onChangeText={(t) => setFormData({ ...formData, etiquetaOferta: t })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#374151' }]}>Texto Ahorro</Text>
                                <TextInput
                                    style={[styles.input, {
                                        backgroundColor: isDark ? '#374151' : '#f9fafb',
                                        color: isDark ? '#FFF' : '#000'
                                    }]}
                                    value={formData.textoAhorro}
                                    onChangeText={(t) => setFormData({ ...formData, textoAhorro: t })}
                                />
                            </View>

                            <View style={styles.switchGroup}>
                                <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#374151' }]}>Destacado</Text>
                                <Switch
                                    value={formData.destacado}
                                    onValueChange={(v) => setFormData({ ...formData, destacado: v })}
                                    trackColor={{ false: "#767577", true: "#10B981" }}
                                />
                            </View>

                            <View style={styles.switchGroup}>
                                <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#374151' }]}>Es plan de Entrenador</Text>
                                <Switch
                                    value={formData.isCoach}
                                    onValueChange={(v) => setFormData({ ...formData, isCoach: v })}
                                    trackColor={{ false: "#767577", true: "#10B981" }}
                                />
                            </View>

                            {formData.isCoach && (
                                <View style={styles.inputGroup}>
                                    <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#374151' }]}>Rango de Clientes</Text>
                                    <TextInput
                                        style={[styles.input, {
                                            backgroundColor: isDark ? '#374151' : '#f9fafb',
                                            color: isDark ? '#FFF' : '#000'
                                        }]}
                                        keyboardType="numeric"
                                        value={formData.clientRange}
                                        onChangeText={(t) => setFormData({ ...formData, clientRange: t })}
                                        placeholder="5, 10 o 20"
                                        placeholderTextColor="#9ca3af"
                                    />
                                </View>
                            )}
                        </ScrollView>

                        <Pressable
                            onPress={handleSave}
                            disabled={saving}
                            style={[styles.saveButton, saving && { opacity: 0.7 }]}
                        >
                            {saving ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.saveButtonText}>Guardar Cambios</Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: Platform.OS === 'android' ? 40 : 50 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 16
    },
    title: { fontSize: 24, fontWeight: 'bold' },
    subtitle: { marginBottom: 16 },
    content: { paddingHorizontal: 20, paddingBottom: 40 },

    // Sections
    sectionContainer: {
        marginBottom: 8
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold'
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 4
    },
    addButtonText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 14
    },

    // Code cards
    codeCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2
    },
    codeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12
    },
    codeText: {
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 1
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4
    },
    statusText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold'
    },
    codeStats: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 12
    },
    codeStat: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    codeActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(150,150,150,0.2)',
        paddingTop: 12
    },
    iconBtn: {
        padding: 8
    },
    emptyCard: {
        borderRadius: 12,
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center'
    },

    // Plan cards
    card: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    planName: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    editButton: { backgroundColor: '#3b82f6', padding: 8, borderRadius: 8 },
    cardDetails: { flexDirection: 'row', gap: 8, marginTop: 12 },
    badge: { backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end'
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '85%'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 14, marginBottom: 8, fontWeight: '600' },
    input: {
        borderRadius: 8,
        padding: 12,
        fontSize: 16
    },
    switchGroup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
    },
    upgradeTypeRow: {
        flexDirection: 'row',
        gap: 12
    },
    upgradeTypeBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#6B7280',
        alignItems: 'center'
    },
    upgradeTypeBtnActive: {
        backgroundColor: '#10B981',
        borderColor: '#10B981'
    },
    upgradeTypeBtnText: {
        fontWeight: '600',
        color: '#6B7280'
    },
    saveButton: {
        backgroundColor: '#10B981',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8
    },
    saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
