import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform, Switch, ActivityIndicator, Dimensions } from 'react-native';
import { EnhancedTextInput as TextInput } from '../../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import AvatarWithInitials from '../../../src/components/shared/AvatarWithInitials';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RRule } from 'rrule';
import moment from 'moment';

const EVENT_TYPES = [
    { id: 'rutina', label: 'Rutina', icon: 'barbell' },
    { id: 'dieta', label: 'Dieta', icon: 'nutrition' },
    { id: 'llamada', label: 'Llamada', icon: 'call' }, // Shortened label
    { id: 'presencial', label: 'Presencial', icon: 'people' }, // Shortened label
    { id: 'seguimiento', label: 'Revisión', icon: 'analytics' }, // Shortened label
    { id: 'recordatorio', label: 'Recordatorio', icon: 'alarm' },
    { id: 'otro', label: 'Otro', icon: 'calendar' },
];

const RECURRENCE_OPTIONS = [
    { label: 'No repetir', value: 'none' },
    { label: 'Diariamente', value: 'daily' },
    { label: 'Semanalmente', value: 'weekly' },
    { label: 'Cada 14 días (Bi-semanal)', value: 'biweekly' },
    { label: 'Días 1 y 15 del mes', value: 'biweekly_1_15' },
    { label: 'Mensualmente', value: 'monthly' },
];

const REMINDER_OPTIONS = [
    { label: '1 día antes', value: '1440', icon: 'calendar-outline' },
    { label: '2 horas antes', value: '120', icon: 'time-outline' },
    { label: 'Ambos', value: '1440,120', icon: 'notifications-outline' },
];

const CreateEventModal = ({ visible, onClose, onSave, onDelete, clients = [], initialDate = new Date(), initialClient = null, initialType = 'rutina', initialEvent = null }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState(initialType);
    const [selectedClient, setSelectedClient] = useState(initialClient?._id || (clients.length > 0 ? clients[0]._id : ''));
    const [startDate, setStartDate] = useState(initialDate);
    const [endDate, setEndDate] = useState(moment(initialDate).add(1, 'hour').toDate());
    const [isVisibleToAthlete, setIsVisibleToAthlete] = useState(true);
    const [triggerReminders, setTriggerReminders] = useState(false);
    const [reminderOption, setReminderOption] = useState('1440');
    const [reminderMessage, setReminderMessage] = useState('');
    const [recurrence, setRecurrence] = useState('none');

    // Edit/Delete flow
    const [deleteStep, setDeleteStep] = useState('none');

    // RRULE State
    const [recurrenceEndMode, setRecurrenceEndMode] = useState('never');
    const [recurrenceEndDate, setRecurrenceEndDate] = useState(moment().add(3, 'months').toDate());

    const [isSaving, setIsSaving] = useState(false);

    // DateTimePicker visibility
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const prevVisible = React.useRef(false);

    useEffect(() => {
        if (visible && !prevVisible.current) {
            if (initialEvent) {
                // Edit Mode
                setTitle(initialEvent.title || '');
                setDescription(initialEvent.description || '');
                setType(initialEvent.type || 'rutina');
                setStartDate(new Date(initialEvent.startDate));
                setEndDate(initialEvent.endDate ? new Date(initialEvent.endDate) : moment(initialEvent.startDate).add(1, 'hour').toDate());
                setIsVisibleToAthlete(initialEvent.visibleToAthlete);
                setSelectedClient(initialEvent.athleteId?._id || initialEvent.athleteId);
                setRecurrence(initialEvent.recurrenceRule ? 'custom' : 'none');
                setTriggerReminders(initialEvent.triggerReminders || false);
                setReminderMessage(initialEvent.reminderMessage || '');
                const offsets = initialEvent.reminderOffsets || [];
                if (offsets.includes(1440) && offsets.includes(120)) setReminderOption('1440,120');
                else if (offsets.includes(120)) setReminderOption('120');
                else setReminderOption('1440');
                setDeleteStep('none');
            } else {
                // Create Mode
                setType(initialType);
                setRecurrence('none');
                setTitle('');
                setDescription('');
                setStartDate(initialDate || new Date());
                setEndDate(moment(initialDate || new Date()).add(1, 'hour').toDate());
                setIsVisibleToAthlete(true);
                setTriggerReminders(false);
                setReminderOption('1440');
                setReminderMessage('');
                setSelectedClient(initialClient?._id || (clients.length > 0 ? clients[0]._id : ''));
                setDeleteStep('none');
            }
        }
        prevVisible.current = visible;
    }, [visible, initialEvent, initialClient, clients, initialType, initialDate]);

    const handleStartDateChange = (event, date) => {
        setShowStartPicker(Platform.OS === 'ios');
        if (date) {
            setStartDate(date);
            setEndDate(moment(date).add(1, 'hour').toDate());
        }
    };

    const handleDeleteClick = () => {
        if (initialEvent && (initialEvent.recurrenceRule || initialEvent.isVirtual)) {
            setDeleteStep('confirm');
        } else {
            if (Platform.OS === 'web') {
                if (confirm('¿Eliminar este evento?')) {
                    onDelete(false);
                }
            } else {
                // Alert isn't imported from react-native, using modal UI fallback or ensure Alert is imported
                // But for now let's just use the modal confirm step for everything to be consistent
                setDeleteStep('confirm');
            }
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            alert('Por favor añade un título');
            return;
        }
        if (!selectedClient) {
            alert('Selecciona un atleta');
            return;
        }

        setIsSaving(true);
        try {
            let rruleString = null;
            if (recurrence && recurrence !== 'none') {
                const ruleOptions = {
                    freq: RRule.WEEKLY,
                    dtstart: startDate,
                };

                if (recurrence === 'daily') ruleOptions.freq = RRule.DAILY;
                if (recurrence === 'weekly') ruleOptions.freq = RRule.WEEKLY;
                if (recurrence === 'biweekly') {
                    ruleOptions.freq = RRule.WEEKLY;
                    ruleOptions.interval = 2;
                }
                if (recurrence === 'monthly') ruleOptions.freq = RRule.MONTHLY;
                if (recurrence === 'biweekly_1_15') {
                    ruleOptions.freq = RRule.MONTHLY;
                    ruleOptions.bymonthday = [1, 15];
                }

                if (recurrenceEndMode === 'date') {
                    ruleOptions.until = recurrenceEndDate;
                }

                const rule = new RRule(ruleOptions);
                rruleString = rule.toString();
            }

            const reminderOffsets = triggerReminders
                ? reminderOption.split(',').map(Number)
                : [];

            await onSave({
                title,
                description,
                type,
                athleteId: selectedClient,
                startDate,
                endDate,
                visibleToAthlete: isVisibleToAthlete,
                triggerReminders,
                reminderOffsets,
                reminderMessage: triggerReminders ? reminderMessage : '',
                recurrence,
                recurrenceRule: rruleString
            });
            onClose();
            setTitle('');
            setDescription('');
        } catch (error) {
            console.error(error);
            alert('Error al guardar evento');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, deleteStep === 'confirm' && { maxWidth: 400 }]}>
                    <View style={styles.header}>
                        <Text style={styles.modalTitle}>{initialEvent ? 'Editar Evento' : 'Nuevo Evento'}</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {deleteStep === 'confirm' ? (
                        <View style={{ padding: 24, alignItems: 'center' }}>
                            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                <Ionicons name="trash-outline" size={32} color="#ef4444" />
                            </View>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8, textAlign: 'center', color: '#1e293b' }}>
                                ¿Eliminar evento?
                            </Text>
                            <Text style={{ textAlign: 'center', color: '#64748b', marginBottom: 24, fontSize: 14 }}>
                                Esta acción no se puede deshacer.
                            </Text>

                            <View style={{ width: '100%', gap: 12 }}>
                                <TouchableOpacity
                                    style={[styles.saveButton, { backgroundColor: '#ef4444', height: 44 }]}
                                    onPress={() => onDelete(false)}
                                >
                                    <Text style={styles.saveButtonText}>Eliminar solo este evento</Text>
                                </TouchableOpacity>

                                {(initialEvent?.recurrenceRule || initialEvent?.isVirtual) && (
                                    <TouchableOpacity
                                        style={[styles.saveButton, { backgroundColor: '#0f172a', height: 44 }]}
                                        onPress={() => onDelete(true)}
                                    >
                                        <Text style={styles.saveButtonText}>Eliminar toda la serie</Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={[styles.ghostButton, { height: 44 }]}
                                    onPress={() => setDeleteStep('none')}
                                >
                                    <Text style={styles.ghostButtonText}>Cancelar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <>
                            <ScrollView style={styles.form} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
                                {/* Title */}
                                <Text style={styles.label}>Título del Evento</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ej: Revisión Mensual..."
                                    value={title}
                                    onChangeText={setTitle}
                                />

                                {/* Client Selector - Enhanced with Icon */}
                                <Text style={styles.label}>Atleta</Text>
                                <View style={styles.pickerWrapper}>
                                    {clients.find(c => c._id === selectedClient) ? (
                                        <View style={{ marginRight: 8 }}>
                                            <AvatarWithInitials
                                                name={clients.find(c => c._id === selectedClient).nombre || 'A'}
                                                avatarUrl={clients.find(c => c._id === selectedClient).avatarUrl}
                                                size={32}
                                                textSize={12}
                                            />
                                        </View>
                                    ) : (
                                        <Ionicons name="person-circle-outline" size={32} color="#64748b" style={{ marginRight: 8 }} />
                                    )}
                                    <Picker
                                        selectedValue={selectedClient}
                                        onValueChange={(itemValue) => setSelectedClient(itemValue)}
                                        style={styles.pickerWithIcon}
                                    >
                                        {clients.map(client => (
                                            <Picker.Item key={client._id} label={client.nombre || client.email} value={client._id} />
                                        ))}
                                    </Picker>
                                </View>

                                {/* Type Selector - Chips */}
                                <Text style={styles.label}>Tipo de Evento</Text>
                                <View style={styles.typeContainer}>
                                    {EVENT_TYPES.map(t => (
                                        <TouchableOpacity
                                            key={t.id}
                                            style={[
                                                styles.typeChip,
                                                type === t.id && styles.typeChipActive
                                            ]}
                                            onPress={() => setType(t.id)}
                                        >
                                            <Ionicons
                                                name={t.icon}
                                                size={16}
                                                color={type === t.id ? '#fff' : '#64748b'}
                                            />
                                            <Text style={[
                                                styles.typeText,
                                                type === t.id && styles.typeTextActive
                                            ]}>{t.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Grid for Date & Repeat */}
                                <View style={styles.rowGrid}>
                                    {/* Date & Time */}
                                    <View style={styles.colGrid}>
                                        <Text style={styles.label}>Fecha y Hora</Text>
                                        {Platform.OS === 'web' ? (
                                            <View style={styles.webDateContainer}>
                                                {React.createElement('input', {
                                                    type: 'datetime-local',
                                                    value: moment(startDate).format('YYYY-MM-DDTHH:mm'),
                                                    onChange: (e) => setStartDate(new Date(e.target.value)),
                                                    style: {
                                                        padding: '10px 12px',
                                                        borderRadius: 8,
                                                        border: '1px solid #e2e8f0',
                                                        fontSize: 13,
                                                        color: '#1e293b',
                                                        width: '100%',
                                                        backgroundColor: '#f8fafc',
                                                        outline: 'none',
                                                        fontFamily: 'inherit',
                                                        boxSizing: 'border-box',
                                                        height: 44
                                                    }
                                                })}
                                            </View>
                                        ) : (
                                            <TouchableOpacity
                                                style={styles.dateButton}
                                                onPress={() => setShowStartPicker(true)}
                                            >
                                                <Ionicons name="calendar-outline" size={18} color="#64748b" />
                                                <Text style={styles.dateText}>
                                                    {moment(startDate).format('DD/MM/YYYY HH:mm')}
                                                </Text>
                                            </TouchableOpacity>
                                        )}

                                        {Platform.OS !== 'web' && showStartPicker && (
                                            <DateTimePicker
                                                value={startDate}
                                                mode="datetime"
                                                is24Hour={true}
                                                display="default"
                                                onChange={handleStartDateChange}
                                            />
                                        )}
                                    </View>

                                    {/* Recurrence */}
                                    <View style={styles.colGrid}>
                                        <Text style={styles.label}>Repetir</Text>
                                        <View style={styles.pickerContainer}>
                                            <Picker
                                                selectedValue={recurrence}
                                                onValueChange={(itemValue) => setRecurrence(itemValue)}
                                                style={styles.picker}
                                            >
                                                {RECURRENCE_OPTIONS.map(opt => (
                                                    <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
                                                ))}
                                            </Picker>
                                        </View>
                                    </View>
                                </View>

                                {/* Description */}
                                <Text style={styles.label}>Descripción</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    placeholder="Detalles adicionales (opcional)..."
                                    value={description}
                                    onChangeText={setDescription}
                                    multiline
                                    numberOfLines={3}
                                />

                                {/* Settings Group */}
                                <View style={styles.settingsGroup}>
                                    {/* Visibility Switch */}
                                    <View style={styles.switchRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.settingTitle}>Visible para el Atleta</Text>
                                            <Text style={styles.settingDesc}>
                                                El atleta verá este evento en su calendario.
                                            </Text>
                                        </View>
                                        <Switch
                                            value={isVisibleToAthlete}
                                            onValueChange={setIsVisibleToAthlete}
                                            trackColor={{ false: "#e2e8f0", true: "#bfdbfe" }}
                                            thumbColor={isVisibleToAthlete ? "#2563EB" : "#f1f5f9"}
                                        />
                                    </View>

                                    <View style={styles.divider} />

                                    {/* Reminder Toggle */}
                                    <View style={styles.switchRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.settingTitle}>Enviar Notificación</Text>
                                            <Text style={styles.settingDesc}>
                                                Recordatorio push al dispositivo.
                                            </Text>
                                        </View>
                                        <Switch
                                            value={triggerReminders}
                                            onValueChange={setTriggerReminders}
                                            trackColor={{ false: "#e2e8f0", true: "#bfdbfe" }}
                                            thumbColor={triggerReminders ? "#2563EB" : "#f1f5f9"}
                                        />
                                    </View>
                                </View>

                                {/* Expanded Reminder Settings */}
                                {triggerReminders && (
                                    <View style={styles.reminderDetails}>
                                        <View style={styles.reminderOptions}>
                                            {REMINDER_OPTIONS.map(opt => (
                                                <TouchableOpacity
                                                    key={opt.value}
                                                    style={[
                                                        styles.reminderChip,
                                                        reminderOption === opt.value && styles.reminderChipActive
                                                    ]}
                                                    onPress={() => setReminderOption(opt.value)}
                                                >
                                                    <Ionicons
                                                        name={opt.icon}
                                                        size={14}
                                                        color={reminderOption === opt.value ? '#2563EB' : '#64748b'}
                                                    />
                                                    <Text style={[
                                                        styles.reminderChipText,
                                                        reminderOption === opt.value && styles.reminderChipTextActive
                                                    ]}>{opt.label}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        <TextInput
                                            style={styles.reminderInput}
                                            placeholder="Mensaje personalizado para la notificación..."
                                            value={reminderMessage}
                                            onChangeText={setReminderMessage}
                                        />
                                    </View>
                                )}
                            </ScrollView>

                            <View style={styles.footer}>
                                {!initialEvent && (
                                    <TouchableOpacity style={styles.ghostButton} onPress={onClose}>
                                        <Text style={styles.ghostButtonText}>Cancelar</Text>
                                    </TouchableOpacity>
                                )}

                                {initialEvent && (
                                    <TouchableOpacity style={[styles.ghostButton, { marginRight: 'auto' }]} onPress={handleDeleteClick}>
                                        <Text style={{ color: '#ef4444' }}>Eliminar</Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={[styles.saveButton, isSaving && styles.disabledButton]}
                                    onPress={handleSave}
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.saveButtonText}>{initialEvent ? 'Actualizar' : 'Guardar'}</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)', // Darker, more premium overlay
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16
    },
    modalContent: {
        width: '100%',
        maxWidth: 600,
        backgroundColor: '#fff',
        borderRadius: 20, // More rounded
        maxHeight: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
        overflow: 'hidden'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: -0.5
    },
    form: {
        paddingHorizontal: 24,
        paddingVertical: 20
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 8,
        marginTop: 16
    },
    input: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        padding: 12,
        fontSize: 14,
        color: '#0f172a',
        backgroundColor: '#fff', // White background for inputs
        width: '100%'
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top'
    },
    pickerWrapper: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        backgroundColor: '#fff',
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 12,
        overflow: 'hidden',
    },
    pickerWithIcon: {
        flex: 1,
        height: 48,
        backgroundColor: 'transparent',
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        backgroundColor: '#fff',
        overflow: 'hidden',
        height: 44,
        justifyContent: 'center'
    },
    picker: {
        height: 44,
        width: '100%'
    },
    typeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8
    },
    typeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 100,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#fff',
        gap: 6
    },
    typeChipActive: {
        backgroundColor: '#2563EB',
        borderColor: '#2563EB'
    },
    typeText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500'
    },
    typeTextActive: {
        color: '#fff',
        fontWeight: '600'
    },
    rowGrid: {
        flexDirection: 'row',
        gap: 16,
        alignItems: 'flex-start'
    },
    colGrid: {
        flex: 1
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        backgroundColor: '#fff',
        gap: 8,
        height: 44
    },
    dateText: {
        fontSize: 13,
        color: '#0f172a',
        fontWeight: '500'
    },
    settingsGroup: {
        marginTop: 24,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderRadius: 12,
        padding: 16,
        backgroundColor: '#f8fafc'
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    settingTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b'
    },
    settingDesc: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2
    },
    divider: {
        height: 1,
        backgroundColor: '#e2e8f0',
        marginVertical: 12
    },
    reminderDetails: {
        marginTop: 12,
        paddingLeft: 12,
        borderLeftWidth: 2,
        borderLeftColor: '#e2e8f0',
        marginLeft: 4
    },
    reminderOptions: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10
    },
    reminderChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        gap: 4
    },
    reminderChipActive: {
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe'
    },
    reminderChipText: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '500'
    },
    reminderChipTextActive: {
        color: '#2563EB',
        fontWeight: '600'
    },
    reminderInput: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 10,
        fontSize: 13,
        backgroundColor: '#fff'
    },
    footer: {
        flexDirection: 'row',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#fff' // Ensure footer has background
    },
    ghostButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center'
    },
    ghostButtonText: {
        color: '#64748b',
        fontWeight: '600',
        fontSize: 14
    },
    saveButton: {
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 8,
        backgroundColor: '#2563EB',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 100,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3
    },
    disabledButton: {
        opacity: 0.7,
        shadowOpacity: 0
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14
    }
});

export default CreateEventModal;
