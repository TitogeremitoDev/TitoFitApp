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
    Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';

// API URL (debería venir de config)
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

export default function AdminPanel() {
    const { isDark, theme } = useTheme();
    const { user } = useAuth();
    const router = useRouter();

    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [saving, setSaving] = useState(false);

    // Form state
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

    useEffect(() => {
        loadPlans();
    }, []);

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
            setRefreshing(false);
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

    if (loading) {
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
                    Gestión de Planes
                </Text>
                <Pressable onPress={loadPlans}>
                    <Ionicons name="refresh" size={24} color={isDark ? '#FFF' : '#000'} />
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
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
            </ScrollView>

            {/* Modal de Edición */}
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
                                <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#374151' }]}>Etiqueta Oferta (ej. BLACK FRIDAY)</Text>
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
                                <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#374151' }]}>Texto Ahorro (ej. AHORRA 20€)</Text>
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
                                    <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#374151' }]}>Rango de Clientes (5, 10 o 20)</Text>
                                    <TextInput
                                        style={[styles.input, {
                                            backgroundColor: isDark ? '#374151' : '#f9fafb',
                                            color: isDark ? '#FFF' : '#000'
                                        }]}
                                        keyboardType="numeric"
                                        value={formData.clientRange}
                                        onChangeText={(t) => setFormData({ ...formData, clientRange: t })}
                                        placeholder="5, 10 o 20"
                                        placeholderTextColor={isDark ? '#9ca3af' : '#9ca3af'}
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
    container: { flex: 1, paddingTop: 50 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 20
    },
    backButton: {
        padding: 4,
    },
    title: { fontSize: 24, fontWeight: 'bold' },
    subtitle: { paddingHorizontal: 20, marginBottom: 20 },
    content: { paddingHorizontal: 20 },
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
        maxHeight: '80%'
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
    saveButton: {
        backgroundColor: '#10B981',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8
    },
    saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
