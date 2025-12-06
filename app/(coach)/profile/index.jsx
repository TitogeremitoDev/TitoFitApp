import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Switch,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import CoachHeader from '../components/CoachHeader';

const SPECIALTIES_LIST = [
    'Hipertrofia',
    'Pérdida de Grasa',
    'Fuerza',
    'Salud y Bienestar',
    'Rendimiento Deportivo',
    'Calistenia',
    'Powerlifting',
    'Crossfit',
    'Rehabilitación'
];

export default function ProfileScreen() {
    const router = useRouter();
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [brandName, setBrandName] = useState('');
    const [trainerCode, setTrainerCode] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [bio, setBio] = useState('');
    const [instagramHandle, setInstagramHandle] = useState('');
    const [pricePerMonth, setPricePerMonth] = useState('');
    const [maxClients, setMaxClients] = useState('');
    const [isAcceptingClients, setIsAcceptingClients] = useState(true);
    const [specialties, setSpecialties] = useState([]);
    const [customSpecialty, setCustomSpecialty] = useState('');

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await fetch(`${API_URL}/api/trainers/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success) {
                const p = data.profile;
                setBrandName(p.brandName || '');
                setTrainerCode(p.trainerCode || '');
                setLogoUrl(p.logoUrl || '');
                setBio(p.bio || '');
                setInstagramHandle(p.instagramHandle || '');
                setPricePerMonth(p.pricePerMonth?.toString() || '0');
                setMaxClients(p.maxClients?.toString() || '5');
                setIsAcceptingClients(p.isAcceptingClients ?? true);
                setSpecialties(p.specialties || []);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            Alert.alert('Error', 'No se pudo cargar el perfil');
        } finally {
            setLoading(false);
        }
    };

    const toggleSpecialty = (specialty) => {
        if (specialties.includes(specialty)) {
            setSpecialties(specialties.filter(s => s !== specialty));
        } else {
            setSpecialties([...specialties, specialty]);
        }
    };

    const addCustomSpecialty = () => {
        if (customSpecialty.trim() && !specialties.includes(customSpecialty.trim())) {
            setSpecialties([...specialties, customSpecialty.trim()]);
            setCustomSpecialty('');
        }
    };

    const generateCode = async () => {
        console.log('🔴 GENERATE CODE BUTTON CLICKED!');
        console.log('API_URL:', API_URL);
        console.log('Token:', token ? 'EXISTS' : 'MISSING');
        try {
            console.log('📡 Fetching from:', `${API_URL}/api/trainers/generate-code`);
            const response = await fetch(`${API_URL}/api/trainers/generate-code`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('📥 Response status:', response.status);
            const data = await response.json();
            console.log('📦 Response data:', data);

            if (data.success) {
                console.log('✅ Success! Code:', data.code);
                // Usar window.confirm para web compatibility
                const useCode = window.confirm(
                    `Código Generado: ${data.code}\n\n¿Quieres usar este código?\n\nPresiona OK para usarlo, o Cancelar para generar otro.`
                );

                if (useCode) {
                    setTrainerCode(data.code);
                    window.alert('Código aplicado! Ahora presiona "Guardar" para guardarlo.');
                }
            } else {
                console.log('❌ Error from API:', data.message);
                window.alert('Error: ' + (data.message || 'No se pudo generar el código'));
            }
        } catch (error) {
            console.error('💥 Catch error:', error);
            window.alert('Error: No se pudo generar el código - ' + error.message);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. Update Profile Info
            const profileRes = await fetch(`${API_URL}/api/trainers/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    brandName,
                    bio,
                    instagramHandle,
                    pricePerMonth: parseFloat(pricePerMonth) || 0,
                    specialties,
                    trainerCode: trainerCode.trim() || undefined
                })
            });

            const profileData = await profileRes.json();

            // Check for duplicate code error
            if (!profileRes.ok) {
                if (profileRes.status === 400 && profileData.message?.includes('código')) {
                    Alert.alert('Error', 'Este código ya está en uso. Por favor, elige otro.');
                    setSaving(false);
                    return;
                }
                throw new Error(profileData.message || 'Error en la actualización');
            }

            // 2. Update Settings
            const settingsRes = await fetch(`${API_URL}/api/trainers/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    maxClients: parseInt(maxClients) || 5,
                    isAcceptingClients
                })
            });

            // 3. Update Logo (only if changed/present)
            if (logoUrl) {
                await fetch(`${API_URL}/api/trainers/profile/logo`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ logoUrl })
                });
            }

            if (profileRes.ok && settingsRes.ok) {
                Alert.alert('Éxito', 'Perfil actualizado correctamente');
                router.back();
            } else {
                throw new Error('Error en la actualización');
            }

        } catch (error) {
            console.error('Error saving profile:', error);
            Alert.alert('Error', 'No se pudieron guardar los cambios');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <CoachHeader
                title="Mi Perfil"
                subtitle="Configuración profesional"
                icon="person"
                iconColor="#3b82f6"
                rightContent={
                    <TouchableOpacity
                        onPress={handleSave}
                        style={styles.saveButton}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.saveButtonText}>Guardar</Text>
                        )}
                    </TouchableOpacity>
                }
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

                    {/* Marca Personal */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Marca Personal</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Nombre de Marca / Empresa</Text>
                            <TextInput
                                style={styles.input}
                                value={brandName}
                                onChangeText={setBrandName}
                                placeholder="Ej: TitoFit Coaching"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Código de Entrenador (Único)</Text>
                            <View style={styles.codeInputRow}>
                                <TextInput
                                    style={[styles.input, styles.codeInput]}
                                    value={trainerCode}
                                    onChangeText={setTrainerCode}
                                    placeholder="EJ: TITO-1234"
                                    placeholderTextColor="#94a3b8"
                                    autoCapitalize="characters"
                                />
                                <TouchableOpacity
                                    style={styles.generateButton}
                                    onPress={generateCode}
                                >
                                    <Ionicons name="refresh" size={20} color="#fff" />
                                    <Text style={styles.generateButtonText}>Generar</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.helperText}>Este código será usado por tus clientes para vincularse.</Text>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>URL del Logo (Imagen)</Text>
                            <TextInput
                                style={styles.input}
                                value={logoUrl}
                                onChangeText={setLogoUrl}
                                placeholder="https://..."
                                placeholderTextColor="#94a3b8"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Instagram (sin @)</Text>
                            <TextInput
                                style={styles.input}
                                value={instagramHandle}
                                onChangeText={setInstagramHandle}
                                placeholder="usuario_fit"
                                placeholderTextColor="#94a3b8"
                                autoCapitalize="none"
                            />
                        </View>
                    </View>

                    {/* Información Profesional */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Información Profesional</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Biografía</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={bio}
                                onChangeText={setBio}
                                placeholder="Cuéntales a tus clientes sobre tu experiencia y metodología..."
                                placeholderTextColor="#94a3b8"
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                <Text style={styles.label}>Precio Mensual (€)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={pricePerMonth}
                                    onChangeText={setPricePerMonth}
                                    placeholder="0.00"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="numeric"
                                />
                            </View>

                            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                <Text style={styles.label}>Máx. Clientes</Text>
                                <TextInput
                                    style={styles.input}
                                    value={maxClients}
                                    onChangeText={setMaxClients}
                                    placeholder="5"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={styles.switchRow}>
                            <Text style={styles.label}>¿Aceptando nuevos clientes?</Text>
                            <Switch
                                value={isAcceptingClients}
                                onValueChange={setIsAcceptingClients}
                                trackColor={{ false: "#cbd5e1", true: "#10b981" }}
                                thumbColor="#fff"
                            />
                        </View>
                    </View>

                    {/* Especialidades */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Especialidades</Text>
                        <Text style={styles.sectionSubtitle}>Selecciona tus áreas de enfoque:</Text>

                        <View style={styles.specialtiesGrid}>
                            {SPECIALTIES_LIST.map((spec) => (
                                <TouchableOpacity
                                    key={spec}
                                    style={[
                                        styles.specialtyChip,
                                        specialties.includes(spec) && styles.specialtyChipActive
                                    ]}
                                    onPress={() => toggleSpecialty(spec)}
                                >
                                    <Text style={[
                                        styles.specialtyText,
                                        specialties.includes(spec) && styles.specialtyTextActive
                                    ]}>
                                        {spec}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Custom Specialty */}
                        <View style={styles.customSpecialtyContainer}>
                            <TextInput
                                style={styles.customInput}
                                value={customSpecialty}
                                onChangeText={setCustomSpecialty}
                                placeholder="Otra especialidad..."
                                placeholderTextColor="#94a3b8"
                            />
                            <TouchableOpacity
                                style={styles.addButton}
                                onPress={addCustomSpecialty}
                            >
                                <Ionicons name="add" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        {/* Selected Custom Specialties */}
                        <View style={styles.selectedCustoms}>
                            {specialties
                                .filter(s => !SPECIALTIES_LIST.includes(s))
                                .map((spec) => (
                                    <TouchableOpacity
                                        key={spec}
                                        style={[styles.specialtyChip, styles.specialtyChipActive]}
                                        onPress={() => toggleSpecialty(spec)}
                                    >
                                        <Text style={styles.specialtyTextActive}>{spec}</Text>
                                        <Ionicons name="close-circle" size={16} color="#fff" style={{ marginLeft: 4 }} />
                                    </TouchableOpacity>
                                ))}
                        </View>
                    </View>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
    saveButton: {
        backgroundColor: '#3b82f6',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        minWidth: 80,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    section: {
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
        marginBottom: 16,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 12,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        color: '#1e293b',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    textArea: {
        minHeight: 100,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        paddingVertical: 8,
    },
    specialtiesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    specialtyChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        flexDirection: 'row',
        alignItems: 'center',
    },
    specialtyChipActive: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
    },
    specialtyText: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    specialtyTextActive: {
        color: '#fff',
    },
    customSpecialtyContainer: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    customInput: {
        flex: 1,
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        color: '#1e293b',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    addButton: {
        width: 48,
        height: 48,
        backgroundColor: '#10b981',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectedCustoms: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    helperText: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
        fontStyle: 'italic'
    },
    codeInputRow: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    codeInput: {
        flex: 1,
    },
    generateButton: {
        backgroundColor: '#10b981',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minWidth: 100,
        justifyContent: 'center',
    },
    generateButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    }
});
