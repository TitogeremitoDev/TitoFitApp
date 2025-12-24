/**
 * BroadcastModal.jsx
 * Modal para enviar mensajes masivos a grupos de clientes
 * Permite seleccionar: Todos, Activos, Inactivos, o Selección manual
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    FlatList,
    ActivityIndicator,
    Platform,
    ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// Opciones de audiencia
const AUDIENCE_OPTIONS = [
    { id: 'all', label: '👥 Todos', desc: 'Todos tus clientes', icon: 'people' },
    { id: 'active', label: '🟢 Activos', desc: 'Con actividad < 7 días', icon: 'pulse' },
    { id: 'inactive', label: '🔴 Inactivos', desc: 'Sin actividad > 14 días', icon: 'alert-circle' },
    { id: 'selected', label: '✅ Seleccionar', desc: 'Elegir manualmente', icon: 'checkbox' }
];

export default function BroadcastModal({ visible, onClose }) {
    const { token } = useAuth();
    const [step, setStep] = useState(1); // 1: audience, 2: message, 3: schedule
    const [audienceType, setAudienceType] = useState('all');
    const [clients, setClients] = useState([]);
    const [selectedClients, setSelectedClients] = useState([]);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('general');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [scheduledDate, setScheduledDate] = useState(null);
    const [clientStats, setClientStats] = useState({ total: 0, filtered: 0 });

    // Custom date picker state
    const [showCustomPicker, setShowCustomPicker] = useState(false);
    const [customDay, setCustomDay] = useState(0); // 0=hoy, 1=mañana, etc
    const [customHour, setCustomHour] = useState(8);
    const [customMinute, setCustomMinute] = useState(0);

    // Cargar clientes cuando se selecciona "selected"
    useEffect(() => {
        if (visible && audienceType === 'selected') {
            loadClients();
        }
    }, [visible, audienceType]);

    // Cargar stats cuando se abre
    useEffect(() => {
        if (visible) {
            loadClientStats();
        }
    }, [visible]);

    const loadClientStats = async () => {
        try {
            const res = await fetch(`${API_URL}/api/broadcast/clients?filter=all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setClientStats({ total: data.totalClients, filtered: data.filteredCount });
            }
        } catch (error) {
            console.error('[Broadcast] Error loading stats:', error);
        }
    };

    const loadClients = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/broadcast/clients?filter=all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setClients(data.clients || []);
            }
        } catch (error) {
            console.error('[Broadcast] Error loading clients:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleClient = (clientId) => {
        setSelectedClients(prev =>
            prev.includes(clientId)
                ? prev.filter(id => id !== clientId)
                : [...prev, clientId]
        );
    };

    const selectAll = () => {
        setSelectedClients(clients.map(c => c._id));
    };

    const clearSelection = () => {
        setSelectedClients([]);
    };

    const handleSend = async () => {
        if (!message.trim()) return;

        setSending(true);
        try {
            const payload = {
                audienceType,
                message: message.trim(),
                type: messageType
            };

            if (audienceType === 'selected') {
                payload.selectedClients = selectedClients;
            }

            if (scheduledDate) {
                payload.sendAt = scheduledDate.toISOString();
            }

            const res = await fetch(`${API_URL}/api/broadcast`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                const count = data.broadcast.totalRecipients;
                const scheduled = data.broadcast.isScheduled;
                alert(
                    scheduled
                        ? `✅ Mensaje programado para ${count} clientes`
                        : `✅ Mensaje enviado a ${count} clientes`
                );
                handleClose();
            } else {
                alert(`Error: ${data.message}`);
            }
        } catch (error) {
            console.error('[Broadcast] Error sending:', error);
            alert('Error al enviar mensaje');
        } finally {
            setSending(false);
        }
    };

    const handleClose = () => {
        setStep(1);
        setAudienceType('all');
        setSelectedClients([]);
        setMessage('');
        setMessageType('general');
        setScheduledDate(null);
        onClose();
    };

    const getRecipientCount = () => {
        if (audienceType === 'selected') return selectedClients.length;
        return clientStats.total;
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={handleClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={step > 1 ? () => setStep(step - 1) : handleClose}>
                        <Ionicons name={step > 1 ? "arrow-back" : "close"} size={24} color="#1e293b" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>📣 Mensaje Masivo</Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Progress */}
                <View style={styles.progress}>
                    {[1, 2, 3].map(s => (
                        <View key={s} style={[styles.progressDot, s <= step && styles.progressDotActive]} />
                    ))}
                </View>

                <ScrollView style={styles.content}>
                    {/* Step 1: Audience */}
                    {step === 1 && (
                        <View>
                            <Text style={styles.stepTitle}>¿A quién enviar?</Text>
                            <Text style={styles.stepSubtitle}>
                                Tienes {clientStats.total} clientes en total
                            </Text>

                            {AUDIENCE_OPTIONS.map(opt => (
                                <TouchableOpacity
                                    key={opt.id}
                                    style={[
                                        styles.audienceOption,
                                        audienceType === opt.id && styles.audienceOptionActive
                                    ]}
                                    onPress={() => setAudienceType(opt.id)}
                                >
                                    <Ionicons
                                        name={opt.icon}
                                        size={24}
                                        color={audienceType === opt.id ? '#8b5cf6' : '#64748b'}
                                    />
                                    <View style={styles.audienceOptionText}>
                                        <Text style={[
                                            styles.audienceLabel,
                                            audienceType === opt.id && styles.audienceLabelActive
                                        ]}>
                                            {opt.label}
                                        </Text>
                                        <Text style={styles.audienceDesc}>{opt.desc}</Text>
                                    </View>
                                    {audienceType === opt.id && (
                                        <Ionicons name="checkmark-circle" size={24} color="#8b5cf6" />
                                    )}
                                </TouchableOpacity>
                            ))}

                            {/* Client selector for "selected" */}
                            {audienceType === 'selected' && (
                                <View style={styles.clientSelector}>
                                    <View style={styles.clientSelectorHeader}>
                                        <Text style={styles.clientSelectorTitle}>
                                            Seleccionados: {selectedClients.length}
                                        </Text>
                                        <View style={styles.clientSelectorActions}>
                                            <TouchableOpacity onPress={selectAll}>
                                                <Text style={styles.clientSelectorAction}>Todos</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={clearSelection}>
                                                <Text style={styles.clientSelectorAction}>Ninguno</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {loading ? (
                                        <ActivityIndicator style={{ padding: 20 }} color="#8b5cf6" />
                                    ) : (
                                        <FlatList
                                            data={clients}
                                            keyExtractor={item => item._id}
                                            style={styles.clientList}
                                            renderItem={({ item }) => {
                                                const isSelected = selectedClients.includes(item._id);
                                                return (
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.clientItem,
                                                            isSelected && styles.clientItemSelected
                                                        ]}
                                                        onPress={() => toggleClient(item._id)}
                                                    >
                                                        <Ionicons
                                                            name={isSelected ? "checkbox" : "square-outline"}
                                                            size={22}
                                                            color={isSelected ? '#8b5cf6' : '#94a3b8'}
                                                        />
                                                        <Text style={styles.clientName}>{item.nombre}</Text>
                                                    </TouchableOpacity>
                                                );
                                            }}
                                        />
                                    )}
                                </View>
                            )}
                        </View>
                    )}

                    {/* Step 2: Message */}
                    {step === 2 && (
                        <View>
                            <Text style={styles.stepTitle}>Escribe tu mensaje</Text>
                            <Text style={styles.stepSubtitle}>
                                Se enviará a {getRecipientCount()} clientes
                            </Text>

                            <View style={styles.typeSelector}>
                                {['general', 'motivacion', 'recordatorio'].map(type => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.typeButton,
                                            messageType === type && styles.typeButtonActive
                                        ]}
                                        onPress={() => setMessageType(type)}
                                    >
                                        <Text style={[
                                            styles.typeButtonText,
                                            messageType === type && styles.typeButtonTextActive
                                        ]}>
                                            {type === 'general' ? '💬 General' :
                                                type === 'motivacion' ? '🔥 Motivación' : '📋 Recordatorio'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TextInput
                                style={styles.messageInput}
                                placeholder="Escribe tu mensaje aquí..."
                                placeholderTextColor="#94a3b8"
                                value={message}
                                onChangeText={setMessage}
                                multiline
                                maxLength={2000}
                                textAlignVertical="top"
                            />
                            <Text style={styles.charCount}>{message.length}/2000</Text>
                        </View>
                    )}

                    {/* Step 3: Schedule */}
                    {step === 3 && (
                        <View>
                            <Text style={styles.stepTitle}>¿Cuándo enviar?</Text>
                            <Text style={styles.stepSubtitle}>
                                Mensaje para {getRecipientCount()} clientes
                            </Text>

                            <TouchableOpacity
                                style={[
                                    styles.scheduleOption,
                                    !scheduledDate && styles.scheduleOptionActive
                                ]}
                                onPress={() => setScheduledDate(null)}
                            >
                                <Ionicons name="flash" size={24} color={!scheduledDate ? '#10b981' : '#64748b'} />
                                <View style={styles.scheduleOptionText}>
                                    <Text style={styles.scheduleLabel}>⚡ Enviar ahora</Text>
                                    <Text style={styles.scheduleDesc}>El mensaje se enviará inmediatamente</Text>
                                </View>
                            </TouchableOpacity>

                            <Text style={styles.orDivider}>— o programar para —</Text>

                            <View style={styles.quickTimeGrid}>
                                {[
                                    { label: 'Mañana 8:00', tomorrow8: true },
                                    { label: 'Lunes 8:00', nextMonday: true },
                                    { label: 'En 1 hora', hours: 1 },
                                    { label: 'En 3 horas', hours: 3 }
                                ].map((opt, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={styles.quickTimeBtn}
                                        onPress={() => {
                                            const date = new Date();
                                            if (opt.hours) {
                                                date.setHours(date.getHours() + opt.hours);
                                            } else if (opt.tomorrow8) {
                                                date.setDate(date.getDate() + 1);
                                                date.setHours(8, 0, 0, 0);
                                            } else if (opt.nextMonday) {
                                                const daysUntilMonday = (8 - date.getDay()) % 7 || 7;
                                                date.setDate(date.getDate() + daysUntilMonday);
                                                date.setHours(8, 0, 0, 0);
                                            }
                                            setScheduledDate(date);
                                            setShowCustomPicker(false);
                                        }}
                                    >
                                        <Text style={styles.quickTimeBtnText}>{opt.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Custom Date/Time Picker */}
                            <TouchableOpacity
                                style={styles.customPickerToggle}
                                onPress={() => setShowCustomPicker(!showCustomPicker)}
                            >
                                <Ionicons name="calendar-outline" size={20} color="#8b5cf6" />
                                <Text style={styles.customPickerToggleText}>
                                    Elegir día y hora personalizada
                                </Text>
                                <Ionicons
                                    name={showCustomPicker ? "chevron-up" : "chevron-down"}
                                    size={18}
                                    color="#8b5cf6"
                                />
                            </TouchableOpacity>

                            {showCustomPicker && (
                                <View style={styles.customPickerContainer}>
                                    {/* Day Selector */}
                                    <Text style={styles.pickerLabel}>📅 Día:</Text>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        style={styles.dayScroll}
                                    >
                                        {[0, 1, 2, 3, 4, 5, 6].map(daysFromNow => {
                                            const date = new Date();
                                            date.setDate(date.getDate() + daysFromNow);
                                            const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                                            const dayName = daysFromNow === 0 ? 'Hoy' :
                                                daysFromNow === 1 ? 'Mañana' :
                                                    dayNames[date.getDay()];
                                            const dayNum = date.getDate();
                                            const isSelected = customDay === daysFromNow;

                                            return (
                                                <TouchableOpacity
                                                    key={daysFromNow}
                                                    style={[
                                                        styles.dayBtn,
                                                        isSelected && styles.dayBtnSelected
                                                    ]}
                                                    onPress={() => setCustomDay(daysFromNow)}
                                                >
                                                    <Text style={[
                                                        styles.dayBtnName,
                                                        isSelected && styles.dayBtnTextSelected
                                                    ]}>
                                                        {dayName}
                                                    </Text>
                                                    <Text style={[
                                                        styles.dayBtnNum,
                                                        isSelected && styles.dayBtnTextSelected
                                                    ]}>
                                                        {dayNum}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>

                                    {/* Hour Selector */}
                                    <Text style={styles.pickerLabel}>⏰ Hora:</Text>
                                    <View style={styles.timeRow}>
                                        <View style={styles.timePickerWrap}>
                                            <TouchableOpacity
                                                style={styles.timeArrow}
                                                onPress={() => setCustomHour(h => h > 0 ? h - 1 : 23)}
                                            >
                                                <Ionicons name="remove" size={20} color="#8b5cf6" />
                                            </TouchableOpacity>
                                            <Text style={styles.timeValue}>
                                                {String(customHour).padStart(2, '0')}
                                            </Text>
                                            <TouchableOpacity
                                                style={styles.timeArrow}
                                                onPress={() => setCustomHour(h => h < 23 ? h + 1 : 0)}
                                            >
                                                <Ionicons name="add" size={20} color="#8b5cf6" />
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={styles.timeSeparator}>:</Text>
                                        <View style={styles.timePickerWrap}>
                                            <TouchableOpacity
                                                style={styles.timeArrow}
                                                onPress={() => setCustomMinute(m => m >= 15 ? m - 15 : 45)}
                                            >
                                                <Ionicons name="remove" size={20} color="#8b5cf6" />
                                            </TouchableOpacity>
                                            <Text style={styles.timeValue}>
                                                {String(customMinute).padStart(2, '0')}
                                            </Text>
                                            <TouchableOpacity
                                                style={styles.timeArrow}
                                                onPress={() => setCustomMinute(m => m <= 30 ? m + 15 : 0)}
                                            >
                                                <Ionicons name="add" size={20} color="#8b5cf6" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Apply Button */}
                                    <TouchableOpacity
                                        style={styles.applyCustomBtn}
                                        onPress={() => {
                                            const date = new Date();
                                            date.setDate(date.getDate() + customDay);
                                            date.setHours(customHour, customMinute, 0, 0);
                                            setScheduledDate(date);
                                            setShowCustomPicker(false);
                                        }}
                                    >
                                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                        <Text style={styles.applyCustomBtnText}>Aplicar</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {scheduledDate && (
                                <View style={styles.scheduledPreview}>
                                    <Ionicons name="calendar" size={20} color="#8b5cf6" />
                                    <Text style={styles.scheduledPreviewText}>
                                        {scheduledDate.toLocaleString('es-ES', {
                                            weekday: 'long',
                                            day: 'numeric',
                                            month: 'long',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </Text>
                                    <TouchableOpacity onPress={() => setScheduledDate(null)}>
                                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>

                {/* Footer */}
                <View style={styles.footer}>
                    {step < 3 ? (
                        <TouchableOpacity
                            style={[
                                styles.nextButton,
                                (step === 1 && audienceType === 'selected' && selectedClients.length === 0) && styles.nextButtonDisabled,
                                (step === 2 && !message.trim()) && styles.nextButtonDisabled
                            ]}
                            onPress={() => setStep(step + 1)}
                            disabled={
                                (step === 1 && audienceType === 'selected' && selectedClients.length === 0) ||
                                (step === 2 && !message.trim())
                            }
                        >
                            <Text style={styles.nextButtonText}>Continuar</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                            onPress={handleSend}
                            disabled={sending}
                        >
                            {sending ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name={scheduledDate ? "time" : "send"} size={20} color="#fff" />
                                    <Text style={styles.sendButtonText}>
                                        {scheduledDate ? 'Programar Envío' : 'Enviar Ahora'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0'
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b'
    },
    progress: {
        flexDirection: 'row',
        justifyContent: 'center',
        padding: 16,
        gap: 8
    },
    progressDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#e2e8f0'
    },
    progressDotActive: {
        backgroundColor: '#8b5cf6'
    },
    content: {
        flex: 1,
        padding: 20
    },
    stepTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4
    },
    stepSubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 24
    },
    audienceOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 2,
        borderColor: 'transparent'
    },
    audienceOptionActive: {
        borderColor: '#8b5cf6',
        backgroundColor: '#faf5ff'
    },
    audienceOptionText: {
        flex: 1,
        marginLeft: 12
    },
    audienceLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#334155'
    },
    audienceLabelActive: {
        color: '#7c3aed'
    },
    audienceDesc: {
        fontSize: 13,
        color: '#94a3b8'
    },
    clientSelector: {
        marginTop: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12
    },
    clientSelectorHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    clientSelectorTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155'
    },
    clientSelectorActions: {
        flexDirection: 'row',
        gap: 16
    },
    clientSelectorAction: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8b5cf6'
    },
    clientList: {
        maxHeight: 200
    },
    clientItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        gap: 10,
        borderRadius: 8,
        marginBottom: 4
    },
    clientItemSelected: {
        backgroundColor: '#f3f0ff'
    },
    clientName: {
        fontSize: 15,
        color: '#334155'
    },
    typeSelector: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16
    },
    typeButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 10
    },
    typeButtonActive: {
        backgroundColor: '#8b5cf6'
    },
    typeButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b'
    },
    typeButtonTextActive: {
        color: '#fff'
    },
    messageInput: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#1e293b',
        minHeight: 180,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    charCount: {
        textAlign: 'right',
        color: '#94a3b8',
        fontSize: 12,
        marginTop: 8
    },
    scheduleOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: 'transparent'
    },
    scheduleOptionActive: {
        borderColor: '#10b981',
        backgroundColor: '#f0fdf4'
    },
    scheduleOptionText: {
        marginLeft: 12
    },
    scheduleLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#334155'
    },
    scheduleDesc: {
        fontSize: 13,
        color: '#94a3b8'
    },
    orDivider: {
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: 13,
        marginVertical: 16
    },
    quickTimeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10
    },
    quickTimeBtn: {
        width: '48%',
        padding: 14,
        backgroundColor: '#f3f0ff',
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#8b5cf6'
    },
    quickTimeBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8b5cf6'
    },
    scheduledPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        backgroundColor: '#faf5ff',
        borderRadius: 12,
        marginTop: 16,
        gap: 10
    },
    scheduledPreviewText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: '#7c3aed',
        textTransform: 'capitalize'
    },
    footer: {
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 36 : 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0'
    },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: '#8b5cf6',
        borderRadius: 12,
        gap: 8
    },
    nextButtonDisabled: {
        backgroundColor: '#d1d5db'
    },
    nextButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff'
    },
    sendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: '#10b981',
        borderRadius: 12,
        gap: 8
    },
    sendButtonDisabled: {
        backgroundColor: '#d1d5db'
    },
    sendButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff'
    },
    // Custom Date/Time Picker
    customPickerToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        marginTop: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#8b5cf6',
        gap: 8
    },
    customPickerToggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8b5cf6'
    },
    customPickerContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    pickerLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 10
    },
    dayScroll: {
        marginBottom: 16
    },
    dayBtn: {
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginRight: 8,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        borderWidth: 2,
        borderColor: 'transparent'
    },
    dayBtnSelected: {
        backgroundColor: '#8b5cf6',
        borderColor: '#6d28d9'
    },
    dayBtnName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b'
    },
    dayBtnNum: {
        fontSize: 18,
        fontWeight: '700',
        color: '#334155',
        marginTop: 2
    },
    dayBtnTextSelected: {
        color: '#fff'
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
    },
    timePickerWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f0ff',
        borderRadius: 12,
        padding: 8
    },
    timeArrow: {
        padding: 8
    },
    timeValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#7c3aed',
        minWidth: 45,
        textAlign: 'center'
    },
    timeSeparator: {
        fontSize: 28,
        fontWeight: '700',
        color: '#64748b',
        marginHorizontal: 8
    },
    applyCustomBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        backgroundColor: '#8b5cf6',
        borderRadius: 12,
        gap: 8
    },
    applyCustomBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff'
    }
});
