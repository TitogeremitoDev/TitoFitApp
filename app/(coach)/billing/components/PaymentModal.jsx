import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
    Platform, ScrollView, Image, KeyboardAvoidingView,
    TouchableWithoutFeedback, Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../../../context/AuthContext';

// Web Compatible Date Picker Component
const WebDatePicker = ({ value, onChange, minDate }) => {
    return React.createElement('input', {
        type: 'date',
        value: value.toISOString().split('T')[0],
        min: minDate ? minDate.toISOString().split('T')[0] : undefined,
        onChange: (e) => {
            const date = new Date(e.target.value);
            if (!isNaN(date.getTime())) {
                onChange({ type: 'set' }, date);
            }
        },
        style: {
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            fontSize: 15,
            width: '100%',
            color: '#1e293b',
            fontFamily: 'System',
            // outline: 'none', // Removed for RN compatibility
            backgroundColor: '#ffffff'
        }
    });
};

export default function PaymentModal({ visible, onClose, onSave, editingSubscription, selectedClient }) {
    const { token } = useAuth();

    // Data State
    const [clients, setClients] = useState([]);

    // Form State
    const [amount, setAmount] = useState('');
    const [concept, setConcept] = useState('Asesoría Personalizada');

    // Multi-Client State
    const [selectedClients, setSelectedClients] = useState([]);
    const [clientSearch, setClientSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Dates
    const [startDate, setStartDate] = useState(new Date());
    const [nextPaymentDate, setNextPaymentDate] = useState(new Date());

    // Pickers
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showNextPicker, setShowNextPicker] = useState(false);

    // Options
    const [frequency, setFrequency] = useState('monthly');
    const [paymentMethod, setPaymentMethod] = useState('');

    // UI Focus State
    const [focusedField, setFocusedField] = useState(null);

    useEffect(() => {
        if (visible) {
            fetchClients();
            if (editingSubscription && selectedClient) {
                // Pre-fill form with existing subscription data
                setAmount(String(editingSubscription.amount || ''));
                setConcept(editingSubscription.planName || 'Asesoría Personalizada');
                setSelectedClients([selectedClient]);
                setFrequency(editingSubscription.frequency || 'monthly');
                setPaymentMethod(editingSubscription.paymentMethod || '');
                if (editingSubscription.startDate) {
                    setStartDate(new Date(editingSubscription.startDate));
                }
                if (editingSubscription.nextPaymentDate) {
                    setNextPaymentDate(new Date(editingSubscription.nextPaymentDate));
                }
            } else if (selectedClient) {
                // New subscription for pre-selected client
                setSelectedClients([selectedClient]);
                resetFormExceptClient();
            } else {
                resetForm();
            }
        }
    }, [visible, editingSubscription, selectedClient]);

    const resetFormExceptClient = () => {
        setAmount('');
        setConcept('Asesoría Personalizada');
        setClientSearch('');
        setStartDate(new Date());
        setNextPaymentDate(new Date());
        setPaymentMethod('');
        setFrequency('monthly');
        setFocusedField(null);
        setIsDropdownOpen(false);
    };

    const resetForm = () => {
        setAmount('');
        setConcept('Asesoría Personalizada');
        setSelectedClients([]);
        setClientSearch('');
        setStartDate(new Date());
        setNextPaymentDate(new Date());
        setPaymentMethod('');
        setFrequency('monthly');
        setFocusedField(null);
        setIsDropdownOpen(false);
    };

    const fetchClients = async () => {
        try {
            const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/api/trainers/clients-extended`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setClients(data.clients || []);
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Derived Logic
    const filteredClients = useMemo(() => {
        if (!clientSearch) return clients;
        return clients.filter(c =>
            c.nombre.toLowerCase().includes(clientSearch.toLowerCase()) ||
            c.email?.toLowerCase().includes(clientSearch.toLowerCase())
        );
    }, [clients, clientSearch]);

    // Handlers
    const toggleClientSelection = (client) => {
        const isSelected = selectedClients.find(c => c._id === client._id);
        if (isSelected) {
            setSelectedClients(prev => prev.filter(c => c._id !== client._id));
        } else {
            setSelectedClients(prev => [...prev, client]);
            setClientSearch('');
        }
    };

    const selectAllFiltered = () => {
        const newClients = filteredClients.filter(c => !selectedClients.find(sc => sc._id === c._id));
        setSelectedClients(prev => [...prev, ...newClients]);
    };

    const handleSave = () => {
        if (!isFormValid) return;

        const payload = {
            type: 'subscription',
            clientIds: selectedClients.map(c => c._id),
            planName: concept,
            amount: parseFloat(amount),
            frequency,
            billingDay: startDate.getDate(),
            startDate: startDate,
            nextPaymentDate: nextPaymentDate,
            paymentMethod
        };
        onSave(payload);
    };

    const isFormValid = useMemo(() => {
        return (
            selectedClients.length > 0 &&
            amount &&
            parseFloat(amount) > 0 &&
            concept &&
            paymentMethod
        );
    }, [selectedClients, amount, concept, paymentMethod]);

    // Date Logic
    const handleStartChange = (event, date) => {
        if (Platform.OS === 'android') {
            setShowStartPicker(false);
        }

        if (date) {
            setStartDate(date);
            // Auto Calculation
            const next = new Date(date);
            if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
            if (frequency === 'quarterly') next.setMonth(next.getMonth() + 3);
            if (frequency === 'semiannual') next.setMonth(next.getMonth() + 6);
            if (frequency === 'annual') next.setFullYear(next.getFullYear() + 1);
            setNextPaymentDate(next);
        }
    };

    const handleNextPaymentChange = (event, date) => {
        if (Platform.OS === 'android') {
            setShowNextPicker(false);
        }
        if (date) setNextPaymentDate(date);
    };

    const updateFrequency = (freq) => {
        setFrequency(freq);
        const next = new Date(startDate);
        if (freq === 'monthly') next.setMonth(next.getMonth() + 1);
        if (freq === 'quarterly') next.setMonth(next.getMonth() + 3);
        if (freq === 'semiannual') next.setMonth(next.getMonth() + 6);
        if (freq === 'annual') next.setFullYear(next.getFullYear() + 1);
        setNextPaymentDate(next);
    };

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            {/* Background Touchable to dismiss */}
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={() => {
                    Keyboard.dismiss();
                    // Optional: Close modal if clicking outside? For now just dismiss keyboard
                }}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    {/* Prevent touch on modal content from closing keyboard weirdly */}
                    <TouchableOpacity activeOpacity={1} style={styles.container}>

                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.title}>Nueva Suscripción</Text>
                            <TouchableOpacity onPress={onClose}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">

                            {/* 1. MULTI-CLIENT SELECTOR */}
                            <Text style={styles.label}>Clientes ({selectedClients.length})</Text>

                            <View style={[styles.inputContainer, focusedField === 'client' && styles.inputFocused]}>
                                <View style={styles.chipsContainer}>
                                    {selectedClients.map(client => (
                                        <TouchableOpacity
                                            key={client._id}
                                            style={styles.chip}
                                            onPress={() => toggleClientSelection(client)}
                                        >
                                            <Text style={styles.chipText}>{client.nombre}</Text>
                                            <Ionicons name="close" size={14} color="#1e40af" />
                                        </TouchableOpacity>
                                    ))}
                                    <TextInput
                                        style={styles.ghostInput}
                                        value={clientSearch}
                                        onChangeText={(text) => {
                                            setClientSearch(text);
                                            setIsDropdownOpen(true);
                                        }}
                                        placeholder={selectedClients.length === 0 ? "Buscar atletas..." : ""}
                                        placeholderTextColor="#94a3b8"
                                        onFocus={() => {
                                            setFocusedField('client');
                                            setIsDropdownOpen(true);
                                        }}
                                        onBlur={() => {
                                            setFocusedField(null);
                                            setTimeout(() => setIsDropdownOpen(false), 200);
                                        }}
                                    />
                                </View>
                            </View>

                            {/* Dropdown */}
                            {isDropdownOpen && (
                                <View style={styles.dropdownList}>
                                    {clientSearch.length > 0 && (
                                        <TouchableOpacity style={styles.dropdownAction} onPress={selectAllFiltered}>
                                            <Text style={styles.actionText}>Seleccionar todos los visibles</Text>
                                        </TouchableOpacity>
                                    )}

                                    <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                                        {filteredClients.map(client => {
                                            const isSelected = selectedClients.some(c => c._id === client._id);
                                            return (
                                                <TouchableOpacity
                                                    key={client._id}
                                                    style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                                                    onPress={() => toggleClientSelection(client)}
                                                >
                                                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                                                        {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                                                    </View>

                                                    {client.avatarUrl ? (
                                                        <Image source={{ uri: client.avatarUrl }} style={styles.clientAvatarSmall} />
                                                    ) : (
                                                        <View style={styles.avatarPlaceholder}>
                                                            <Ionicons name="person" size={12} color="#fff" />
                                                        </View>
                                                    )}
                                                    <Text style={[styles.dropdownName, isSelected && { color: '#3b82f6', fontWeight: '600' }]}>
                                                        {client.nombre}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                        {filteredClients.length === 0 && (
                                            <Text style={styles.noResults}>No se encontraron atletas</Text>
                                        )}
                                    </ScrollView>
                                </View>
                            )}

                            {/* 2. Concept & Amount */}
                            <Text style={styles.label}>Concepto / Plan</Text>
                            <TextInput
                                style={[styles.input, focusedField === 'concept' && styles.inputFocused]}
                                value={concept}
                                onChangeText={setConcept}
                                onFocus={() => setFocusedField('concept')}
                                onBlur={() => setFocusedField(null)}
                            />

                            <Text style={styles.label}>Importe Mensual (€)</Text>
                            <TextInput
                                style={[styles.input, focusedField === 'amount' && styles.inputFocused]}
                                value={amount}
                                onChangeText={setAmount}
                                placeholder="0.00"
                                keyboardType="numeric"
                                onFocus={() => setFocusedField('amount')}
                                onBlur={() => setFocusedField(null)}
                            />

                            {/* Frequency Selector */}
                            <Text style={styles.label}>Frecuencia</Text>
                            <View style={styles.freqRow}>
                                {[
                                    { id: 'monthly', label: 'Mensual' },
                                    { id: 'quarterly', label: 'Trimestral' },
                                    { id: 'semiannual', label: 'Semestral' },
                                    { id: 'annual', label: 'Anual' }
                                ].map(f => (
                                    <TouchableOpacity
                                        key={f.id}
                                        style={[styles.chipSolid, frequency === f.id && styles.chipSolidActive]}
                                        onPress={() => updateFrequency(f.id)}
                                    >
                                        <Text style={[styles.chipSolidText, frequency === f.id && styles.chipSolidTextActive]}>
                                            {f.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* 3. Payment Method */}
                            <Text style={styles.label}>Método de Pago</Text>
                            <View style={styles.methodRow}>
                                {[
                                    { id: 'transfer', label: 'Transferencia', icon: 'navigate-outline' },
                                    { id: 'card', label: 'Tarjeta', icon: 'card-outline' },
                                    { id: 'cash', label: 'Efectivo', icon: 'cash-outline' },
                                ].map((m) => (
                                    <TouchableOpacity
                                        key={m.id}
                                        style={[styles.methodChip, paymentMethod === m.id && styles.methodChipActive]}
                                        onPress={() => setPaymentMethod(m.id)}
                                    >
                                        <Ionicons
                                            name={m.icon}
                                            size={16}
                                            color={paymentMethod === m.id ? '#fff' : '#64748b'}
                                        />
                                        <Text style={[styles.methodText, paymentMethod === m.id && styles.methodTextActive]}>
                                            {m.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* 4. Dates logic */}
                            <View style={styles.row}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Fecha Inicio</Text>
                                    {Platform.OS === 'web' ? (
                                        <WebDatePicker
                                            value={startDate}
                                            onChange={handleStartChange}
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            style={[styles.dateInput, focusedField === 'start' && styles.inputFocused]}
                                            onPress={() => setShowStartPicker(true)}
                                        >
                                            <Text style={styles.dateText}>{startDate.toLocaleDateString()}</Text>
                                            <Ionicons name="calendar-outline" size={18} color="#64748b" />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Próx. Cobro</Text>
                                    {Platform.OS === 'web' ? (
                                        <WebDatePicker
                                            value={nextPaymentDate}
                                            onChange={handleNextPaymentChange}
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            style={[styles.dateInput, focusedField === 'next' && styles.inputFocused]}
                                            onPress={() => setShowNextPicker(true)}
                                        >
                                            <Text style={styles.dateText}>{nextPaymentDate.toLocaleDateString()}</Text>
                                            <Ionicons name="calculator-outline" size={18} color="#3b82f6" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {/* Native Date Pickers (iOS/Android) */}
                            {Platform.OS !== 'web' && showStartPicker && (
                                <DateTimePicker
                                    value={startDate}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={handleStartChange}
                                />
                            )}
                            {Platform.OS !== 'web' && showNextPicker && (
                                <DateTimePicker
                                    value={nextPaymentDate}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={handleNextPaymentChange}
                                />
                            )}

                        </ScrollView>

                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveButton, !isFormValid && styles.disabledButton]}
                                onPress={handleSave}
                                disabled={!isFormValid}
                            >
                                <Text style={styles.saveButtonText}>
                                    {selectedClients.length > 1
                                        ? `Crear ${selectedClients.length} planes`
                                        : 'Guardar Plan'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16
    },
    keyboardView: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    container: {
        backgroundColor: '#fff',
        width: '100%',
        maxWidth: 500,
        borderRadius: 24,
        maxHeight: '90%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
    },
    content: {
        padding: 24,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 8,
        marginTop: 16,
    },

    // Inputs
    input: {
        borderWidth: 1,
        borderColor: '#e2e8f0', // Inactive (Gray Light)
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        color: '#1e293b',
        backgroundColor: '#fff',
    },
    inputFocused: {
        borderColor: '#3b82f6', // Active (Blue)
        backgroundColor: '#fff',
    },

    // Multi-Select Input
    inputContainer: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 10,
        backgroundColor: '#fff',
        minHeight: 50,
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eff6ff',
        borderRadius: 20,
        paddingVertical: 4,
        paddingHorizontal: 10,
        gap: 6,
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    chipText: {
        fontSize: 13,
        color: '#1e40af',
        fontWeight: '500',
    },
    ghostInput: {
        flex: 1,
        minWidth: 100,
        fontSize: 15,
        color: '#1e293b',
        paddingVertical: 4,
    },

    // Dropdown
    dropdownList: {
        position: 'absolute',
        top: 90,
        left: 24,
        right: 24,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 100,
        marginTop: 4,
        overflow: 'hidden',
    },
    dropdownAction: {
        padding: 12,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        alignItems: 'center',
    },
    actionText: {
        fontSize: 12,
        color: '#3b82f6',
        fontWeight: '600',
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        gap: 12
    },
    dropdownItemActive: {
        backgroundColor: '#f8fafc',
    },
    checkbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxActive: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
    },
    avatarPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    clientAvatarSmall: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    dropdownName: {
        fontSize: 14,
        color: '#1e293b'
    },

    // Chips Solid (Frequency)
    freqRow: { flexDirection: 'row', gap: 8 },
    chipSolid: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
    },
    chipSolidActive: {
        backgroundColor: '#1e293b',
    },
    chipSolidText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    chipSolidTextActive: { color: '#fff' },

    // Method Chips
    methodRow: { flexDirection: 'row', gap: 10 },
    methodChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#fff',
        gap: 6
    },
    methodChipActive: {
        borderColor: '#3b82f6',
        backgroundColor: '#3b82f6',
    },
    methodText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#64748b',
    },
    methodTextActive: {
        color: '#fff',
        fontWeight: '600'
    },

    // Dates
    row: {
        flexDirection: 'row',
        gap: 16,
    },
    dateInput: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 14,
        backgroundColor: '#fff',
    },
    dateText: {
        fontSize: 15,
        color: '#1e293b',
    },

    // Footer
    footer: {
        flexDirection: 'row',
        padding: 24,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        gap: 16,
        marginTop: 8
    },
    cancelButton: {
        flex: 1,
        padding: 16,
        borderRadius: 14,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#64748b',
        fontWeight: '600',
        fontSize: 15
    },
    saveButton: {
        flex: 2,
        padding: 16,
        borderRadius: 14,
        backgroundColor: '#3b82f6',
        alignItems: 'center',
        shadowColor: "#3b82f6",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    disabledButton: {
        opacity: 0.5,
        shadowOpacity: 0
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15
    },
    noResults: {
        padding: 10,
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: 14
    },
    dateDoneBtn: {
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#eff6ff',
        borderRadius: 12,
        marginTop: 4,
        marginBottom: 16
    },
    dateDoneText: {
        color: '#3b82f6',
        fontWeight: '600',
        fontSize: 15
    }
});
