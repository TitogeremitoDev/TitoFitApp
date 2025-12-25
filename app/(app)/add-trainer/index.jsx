import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    ScrollView,
    Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';

export default function AddTrainerScreen() {
    const router = useRouter();
    const { token, refreshUser } = useAuth();
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [linking, setLinking] = useState(false);
    const [trainer, setTrainer] = useState(null);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    const searchTrainer = async () => {
        if (!code.trim()) {
            Alert.alert('Error', 'Por favor ingresa un código de entrenador');
            return;
        }

        setLoading(true);
        setTrainer(null);

        try {
            const response = await fetch(`${API_URL}/api/trainers/by-code/${code.trim()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success) {
                setTrainer(data.trainer);
            } else {
                Alert.alert('No Encontrado', data.message || 'No se encontró ningún entrenador con ese código');
            }
        } catch (error) {
            console.error('Error searching trainer:', error);
            Alert.alert('Error', 'No se pudo buscar el entrenador');
        } finally {
            setLoading(false);
        }
    };

    const linkWithTrainer = async () => {
        if (!trainer) return;

        // Check if trainer can accept clients
        if (!trainer.canAcceptClients) {
            if (!trainer.isAcceptingClients) {
                Alert.alert('No Disponible', 'Este entrenador no está aceptando nuevos clientes actualmente.');
            } else if (trainer.availableSlots === 0) {
                Alert.alert('Sin Espacios', `Este entrenador ha alcanzado su límite de ${trainer.maxClients} clientes.`);
            }
            return;
        }

        setLinking(true);

        try {
            const response = await fetch(`${API_URL}/api/clients/select-trainer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ trainerCode: code.trim() })
            });
            const data = await response.json();

            if (data.success) {
                console.log('[AddTrainer] 🎯 Entrenador vinculado exitosamente');

                // Refrescar datos del usuario para actualizar tipoUsuario
                try {
                    const updatedUser = await refreshUser();
                    console.log('[AddTrainer] ✅ Usuario actualizado. Nuevo tipo:', updatedUser?.tipoUsuario);
                } catch (refreshError) {
                    console.error('[AddTrainer] ❌ Error refreshing user:', refreshError);
                }

                Alert.alert(
                    'Éxito',
                    `¡Te has vinculado exitosamente con ${trainer.brandName}!`,
                    [
                        {
                            text: 'OK',
                            onPress: () => router.back()
                        }
                    ]
                );
            } else {
                Alert.alert('Error', data.message || 'No se pudo vincular con el entrenador');
            }
        } catch (error) {
            console.error('Error linking with trainer:', error);
            Alert.alert('Error', 'No se pudo completar la vinculación');
        } finally {
            setLinking(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.title}>Agregar Entrenador</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.searchSection}>
                    <Text style={styles.sectionTitle}>Código de Entrenador</Text>
                    <Text style={styles.sectionSubtitle}>
                        Ingresa el código único de tu entrenador para vincularte
                    </Text>

                    <View style={styles.searchRow}>
                        <TextInput
                            style={styles.input}
                            value={code}
                            onChangeText={setCode}
                            placeholder="Ej: TITO1234"
                            placeholderTextColor="#94a3b8"
                            autoCapitalize="characters"
                        />
                        <TouchableOpacity
                            style={styles.searchButton}
                            onPress={searchTrainer}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="search" size={20} color="#fff" />
                                    <Text style={styles.searchButtonText}>Buscar</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {trainer && (
                    <View style={styles.trainerCard}>
                        <View style={styles.trainerHeader}>
                            {trainer.logoUrl ? (
                                <Image
                                    source={{ uri: trainer.logoUrl }}
                                    style={styles.trainerLogo}
                                />
                            ) : (
                                <View style={styles.trainerLogoPlaceholder}>
                                    <Ionicons name="person" size={32} color="#64748b" />
                                </View>
                            )}
                            <View style={styles.trainerInfo}>
                                <Text style={styles.trainerBrand}>{trainer.brandName}</Text>
                                <Text style={styles.trainerName}>{trainer.nombre}</Text>
                                {trainer.instagramHandle && (
                                    <View style={styles.instagramRow}>
                                        <Ionicons name="logo-instagram" size={14} color="#e1306c" />
                                        <Text style={styles.instagramText}>@{trainer.instagramHandle}</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {trainer.bio && (
                            <View style={styles.bioSection}>
                                <Text style={styles.bioLabel}>Acerca de</Text>
                                <Text style={styles.bioText}>{trainer.bio}</Text>
                            </View>
                        )}

                        {trainer.specialties && trainer.specialties.length > 0 && (
                            <View style={styles.specialtiesSection}>
                                <Text style={styles.specialtiesLabel}>Especialidades</Text>
                                <View style={styles.specialtiesGrid}>
                                    {trainer.specialties.map((spec, index) => (
                                        <View key={index} style={styles.specialtyChip}>
                                            <Text style={styles.specialtyText}>{spec}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Ionicons name="cash-outline" size={20} color="#3b82f6" />
                                <Text style={styles.statLabel}>Precio</Text>
                                <Text style={styles.statValue}>€{trainer.pricePerMonth}/mes</Text>
                            </View>
                            <View style={styles.statItem}>
                                <Ionicons name="people-outline" size={20} color="#10b981" />
                                <Text style={styles.statLabel}>Clientes</Text>
                                <Text style={styles.statValue}>{trainer.currentClients}/{trainer.maxClients}</Text>
                            </View>
                            <View style={styles.statItem}>
                                <Ionicons name="checkmark-circle-outline" size={20} color={trainer.availableSlots > 0 ? '#10b981' : '#ef4444'} />
                                <Text style={styles.statLabel}>Disponibilidad</Text>
                                <Text style={[styles.statValue, { color: trainer.availableSlots > 0 ? '#10b981' : '#ef4444' }]}>
                                    {trainer.availableSlots > 0 ? `${trainer.availableSlots} espacios` : 'Sin espacios'}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.linkButton,
                                !trainer.canAcceptClients && styles.linkButtonDisabled
                            ]}
                            onPress={linkWithTrainer}
                            disabled={!trainer.canAcceptClients || linking}
                        >
                            {linking ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="link" size={20} color="#fff" />
                                    <Text style={styles.linkButtonText}>
                                        {trainer.canAcceptClients ? 'Vincularme con este Entrenador' : 'No Disponible'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    backButton: {
        padding: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    searchSection: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 16,
    },
    searchRow: {
        flexDirection: 'row',
        gap: 8,
    },
    input: {
        flex: 1,
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        color: '#1e293b',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    searchButton: {
        backgroundColor: '#3b82f6',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minWidth: 100,
        justifyContent: 'center',
    },
    searchButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    trainerCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    trainerHeader: {
        flexDirection: 'row',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    trainerLogo: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginRight: 16,
    },
    trainerLogoPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    trainerInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    trainerBrand: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4,
    },
    trainerName: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 4,
    },
    instagramRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    instagramText: {
        fontSize: 13,
        color: '#e1306c',
        fontWeight: '500',
    },
    bioSection: {
        marginBottom: 16,
    },
    bioLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 8,
    },
    bioText: {
        fontSize: 14,
        color: '#1e293b',
        lineHeight: 20,
    },
    specialtiesSection: {
        marginBottom: 16,
    },
    specialtiesLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 8,
    },
    specialtiesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    specialtyChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    specialtyText: {
        fontSize: 12,
        color: '#3b82f6',
        fontWeight: '500',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        gap: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    statValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
    },
    linkButton: {
        backgroundColor: '#10b981',
        paddingVertical: 14,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    linkButtonDisabled: {
        backgroundColor: '#94a3b8',
    },
    linkButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
