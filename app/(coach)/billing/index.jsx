import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Image, ActivityIndicator, RefreshControl, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import CoachHeader from '../components/CoachHeader';
import BillingKPIWidget from './components/BillingKPIWidget';
import StatusBadge from './components/StatusBadge';
import TransactionCard from './components/TransactionCard';
import PaymentModal from './components/PaymentModal';
import MiniFinancialCalendar from './components/MiniFinancialCalendar';
import ChurnIndicator from './components/ChurnIndicator';
import UndoToast from './components/UndoToast';
import StatusTooltip from './components/StatusTooltip';
import AvatarWithInitials from '../../../src/components/shared/AvatarWithInitials';

// Frequency translation helper
const FREQ_LABELS = {
    monthly: 'Mensual',
    quarterly: 'Trimestral',
    semiannual: 'Semestral',
    annual: 'Anual'
};
const getFreqLabel = (freq) => FREQ_LABELS[freq] || freq;

export default function BillingScreen() {
    const router = useRouter();
    const { token } = useAuth();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 1024;

    // View State
    const [activeTab, setActiveTab] = useState('subscriptions'); // 'subscriptions' | 'history'
    const [isPaymentModalVisible, setPaymentModalVisible] = useState(false);
    const [editingSubscription, setEditingSubscription] = useState(null);
    const [selectedClient, setSelectedClient] = useState(null);

    // Data State
    const [transactions, setTransactions] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [clients, setClients] = useState([]); // All clients
    const [kpis, setKpis] = useState({ monthlyIncome: 0, pendingIncome: 0, upcoming: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters
    const [filter, setFilter] = useState('all'); // all, paid, pending, overdue
    const [subFilter, setSubFilter] = useState('all'); // all, active, none

    // Warning System (Avisos de pago)
    const [warningEnabled, setWarningEnabled] = useState({}); // { subscriptionId: boolean }
    const [allWarningsChecked, setAllWarningsChecked] = useState(false);
    const [showWarningInfoModal, setShowWarningInfoModal] = useState(false);

    // Churn Risk & Toast System
    const [churnRisks, setChurnRisks] = useState({}); // { clientId: { riskLevel, message } }
    const [toastState, setToastState] = useState({ visible: false, message: '', undoData: null });

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';

    const fetchData = useCallback(async () => {
        try {
            // Parallel fetch for speed
            const [transRes, subRes, kpiRes, clientsRes] = await Promise.all([
                fetch(`${API_URL}/api/billing/transactions`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
                fetch(`${API_URL}/api/billing/subscriptions`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
                fetch(`${API_URL}/api/billing/kpi`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
                fetch(`${API_URL}/api/trainers/clients-extended`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
            ]);

            if (transRes.success) setTransactions(transRes.transactions);
            else console.log('[Billing] Transactions Error:', transRes);

            if (subRes.success) setSubscriptions(subRes.subscriptions);
            else console.log('[Billing] Subscriptions Error:', subRes);

            if (kpiRes.success) setKpis(kpiRes);
            else console.log('[Billing] KPI Error:', kpiRes);

            if (clientsRes.success) setClients(clientsRes.clients || []);
            else console.log('[Billing] Clients Error:', clientsRes);

        } catch (error) {
            console.error('Error fetching billing data:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [token]);

    useEffect(() => {
        if (token) fetchData();
    }, [token, fetchData]);

    // Handle Manual Generation Trigger (Automation)
    useEffect(() => {
        if (token) {
            fetch(`${API_URL}/api/billing/generate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            }).then(() => fetchData()); // Refresh after generation
        }
    }, [token]);

    // Fetch churn risk for each client
    const fetchChurnRisk = async (clientId) => {
        try {
            const res = await fetch(`${API_URL}/api/billing/churn-risk/${clientId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setChurnRisks(prev => ({ ...prev, [clientId]: data }));
            }
        } catch (error) {
            console.log('[Billing] Churn risk error:', error);
        }
    };

    // Load churn risks when clients change
    useEffect(() => {
        if (clients.length > 0 && token) {
            clients.forEach(client => {
                if (!churnRisks[client._id]) {
                    fetchChurnRisk(client._id);
                }
            });
        }
    }, [clients, token]);

    const onRefresh = () => {
        setRefreshing(true);
        setChurnRisks({}); // Clear cache
        fetchData();
    };

    const handleSavePayment = async (data) => {
        console.log('[Billing] Saving payment:', data);

        try {
            let endpoint = `${API_URL}/api/billing/transactions`;
            if (data.type === 'subscription') {
                endpoint = `${API_URL}/api/billing/subscriptions`;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            console.log('[Billing] Save response:', result);

            if (result.success) {
                console.log('[Billing] Subscription created successfully, refreshing...');
                setPaymentModalVisible(false);
                fetchData(); // Force full refresh
            } else {
                console.error('[Billing] Save failed:', result.message);
                alert('Error: ' + (result.message || 'No se pudo guardar'));
            }
        } catch (error) {
            console.error('[Billing] Error saving payment:', error);
            alert('Error de conexión');
        }
    };

    const handleAddSub = (client) => {
        setSelectedClient(client);
        setEditingSubscription(null);
        setPaymentModalVisible(true);
    };

    const handleEditSub = (client, sub) => {
        setSelectedClient(client);
        setEditingSubscription(sub);
        setPaymentModalVisible(true);
    };

    const handleCloseModal = () => {
        setPaymentModalVisible(false);
        setEditingSubscription(null);
        setSelectedClient(null);
    };

    const handleMarkAsPaid = async (sub, clientName) => {
        const originalNextPaymentDate = sub.nextPaymentDate;

        try {
            // Calculate next payment date based on frequency
            const currentDate = new Date(sub.nextPaymentDate);
            let nextDate = new Date(currentDate);

            switch (sub.frequency) {
                case 'monthly':
                    nextDate.setMonth(nextDate.getMonth() + 1);
                    break;
                case 'quarterly':
                    nextDate.setMonth(nextDate.getMonth() + 3);
                    break;
                case 'semiannual':
                    nextDate.setMonth(nextDate.getMonth() + 6);
                    break;
                case 'annual':
                    nextDate.setFullYear(nextDate.getFullYear() + 1);
                    break;
                default:
                    nextDate.setMonth(nextDate.getMonth() + 1);
            }

            const response = await fetch(`${API_URL}/api/billing/subscriptions/${sub._id}/mark-paid`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    nextPaymentDate: nextDate.toISOString(),
                    lastPaymentDate: new Date().toISOString()
                })
            });

            const data = await response.json();
            if (data.success) {
                fetchData();
                // Show toast with undo
                setToastState({
                    visible: true,
                    message: `Pago de ${clientName || 'cliente'} registrado`,
                    undoData: { subId: sub._id, originalNextPaymentDate }
                });
            } else {
                alert('Error al registrar el cobro');
            }
        } catch (error) {
            console.error('[Billing] Error marking as paid:', error);
            alert('Error de conexión');
        }
    };

    // Undo mark as paid
    const handleUndoPayment = async () => {
        if (!toastState.undoData) return;

        try {
            const { subId, originalNextPaymentDate } = toastState.undoData;
            await fetch(`${API_URL}/api/billing/subscriptions/${subId}/mark-paid`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    nextPaymentDate: originalNextPaymentDate,
                    lastPaymentDate: null
                })
            });
            fetchData();
        } catch (error) {
            console.error('[Billing] Undo error:', error);
        }
    };

    // Warning Toggle Functions (syncs with backend)
    const toggleWarning = async (subscriptionId) => {
        const newValue = !warningEnabled[subscriptionId];

        // Optimistic update
        setWarningEnabled(prev => ({
            ...prev,
            [subscriptionId]: newValue
        }));

        try {
            await fetch(`${API_URL}/api/billing/subscriptions/${subscriptionId}/warning`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ enabled: newValue })
            });
        } catch (error) {
            console.error('[toggleWarning] Error:', error);
            // Revert on error
            setWarningEnabled(prev => ({
                ...prev,
                [subscriptionId]: !newValue
            }));
        }
    };

    const toggleAllWarnings = async () => {
        const newValue = !allWarningsChecked;
        setAllWarningsChecked(newValue);

        // Optimistic update
        const allSubIds = subscriptions.reduce((acc, sub) => {
            acc[sub._id] = newValue;
            return acc;
        }, {});
        setWarningEnabled(allSubIds);

        try {
            await fetch(`${API_URL}/api/billing/subscriptions/bulk-warning`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ enabled: newValue })
            });
        } catch (error) {
            console.error('[toggleAllWarnings] Error:', error);
            // Revert on error
            setAllWarningsChecked(!newValue);
        }
    };

    // Initialize warning states from subscriptions
    useEffect(() => {
        if (subscriptions.length > 0) {
            const warningStates = subscriptions.reduce((acc, sub) => {
                acc[sub._id] = sub.warningEnabled || false;
                return acc;
            }, {});
            setWarningEnabled(warningStates);

            // Check if all are enabled
            const allEnabled = subscriptions.every(sub => sub.warningEnabled);
            setAllWarningsChecked(allEnabled);
        }
    }, [subscriptions]);

    // Filter Logic
    const filteredTransactions = transactions.filter(t => filter === 'all' || t.status === filter);

    // SUBSCRIPTIONS LOGIC: All Clients -> Check Subscription
    const clientSubscriptions = clients.map(client => {
        const sub = subscriptions.find(s => (s.clientId?._id === client._id) || (s.clientId === client._id));
        return { client, sub };
    }).filter(item => {
        if (subFilter === 'all') return true;
        if (subFilter === 'active') return !!item.sub;
        if (subFilter === 'none') return !item.sub;
        return true;
    });

    const renderDesktopTable = () => (
        <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
                <Text style={[styles.columnHeader, { flex: 2 }]}>Cliente</Text>
                <Text style={[styles.columnHeader, { flex: 1 }]}>Estado</Text>
                <Text style={[styles.columnHeader, { flex: 2 }]}>Plan / Concepto</Text>
                <Text style={[styles.columnHeader, { flex: 1 }]}>Facturación</Text>
                <Text style={[styles.columnHeader, { flex: 1 }]}>Cobro</Text>
                <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Importe</Text>
                <Text style={[styles.columnHeader, { width: 40 }]}></Text>
            </View>
            {filteredTransactions.map((t) => (
                <View key={t._id} style={styles.tableRow}>
                    <View style={[styles.cell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                        <AvatarWithInitials
                            avatarUrl={t.clientId?.avatarUrl}
                            name={t.clientId?.nombre || 'Cliente'}
                            size={32}
                        />
                        <View>
                            <Text style={styles.tableName}>{t.clientId?.nombre || 'Cliente'}</Text>
                            <Text style={styles.tableEmail}>{t.clientId?.email || ''}</Text>
                        </View>
                    </View>
                    <View style={[styles.cell, { flex: 1 }]}>
                        <StatusBadge status={t.status} />
                    </View>
                    <View style={[styles.cell, { flex: 2 }]}>
                        <Text style={styles.planText}>{t.planName}</Text>
                    </View>
                    <View style={[styles.cell, { flex: 1 }]}>
                        <Text style={styles.cellText}>{new Date(t.billingDate).toLocaleDateString()}</Text>
                    </View>
                    <View style={[styles.cell, { flex: 1 }]}>
                        <Text style={styles.cellText}>{t.paymentDate ? new Date(t.paymentDate).toLocaleDateString() : '-'}</Text>
                    </View>
                    <View style={[styles.cell, { flex: 1, alignItems: 'flex-end' }]}>
                        <Text style={styles.amountText}>{t.amount}€</Text>
                    </View>
                    <View style={[styles.cell, { width: 40, alignItems: 'center' }]}>
                        <Ionicons name="ellipsis-vertical" size={16} color="#94a3b8" />
                    </View>
                </View>
            ))}
        </View>
    );

    const renderSubscriptionsList = () => (
        <View>
            {/* Sub Filters */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {['all', 'active', 'none'].map(f => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.filterChip, subFilter === f && styles.filterChipActive]}
                        onPress={() => setSubFilter(f)}
                    >
                        <Text style={[styles.filterText, subFilter === f && styles.filterTextActive]}>
                            {f === 'all' ? 'Todos' : f === 'active' ? 'Con Plan' : 'Sin Plan'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {clientSubscriptions.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={48} color="#cbd5e1" />
                    <Text style={styles.emptyText}>No se encontraron clientes</Text>
                </View>
            ) : isDesktop ? (
                /* DESKTOP TABLE VIEW */
                <View style={styles.subsTableContainer}>
                    {/* Header */}
                    <View style={styles.subsTableHeader}>
                        <Text style={[styles.subsColHeader, styles.colNombre]}>Nombre</Text>
                        <Text style={[styles.subsColHeader, styles.colEstado]}>Estado</Text>
                        <Text style={[styles.subsColHeader, styles.colFecha]}>Próx. Cobro</Text>
                        <Text style={[styles.subsColHeader, styles.colFreq]}>Frecuencia</Text>
                        <Text style={[styles.subsColHeader, styles.colImporte]}>Importe</Text>
                        {/* Aviso Column Header */}
                        <View style={[styles.colAviso, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }]}>
                            <TouchableOpacity
                                style={[styles.warningCheckbox, allWarningsChecked && styles.warningCheckboxChecked]}
                                onPress={toggleAllWarnings}
                            >
                                {allWarningsChecked && <Ionicons name="checkmark" size={12} color="#fff" />}
                            </TouchableOpacity>
                            <Text style={styles.subsColHeader}>Aviso</Text>
                            <TouchableOpacity onPress={() => setShowWarningInfoModal(true)}>
                                <Ionicons name="help-circle-outline" size={14} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.colAction} />
                    </View>
                    {/* Rows */}
                    {clientSubscriptions.map(({ client, sub }, idx) => (
                        <View key={client._id} style={[styles.subsTableRow, idx % 2 === 0 && styles.subsTableRowAlt]}>
                            {/* Nombre + Avatar with ChurnIndicator */}
                            <View style={[styles.subsCell, styles.colNombre, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                                <View style={{ position: 'relative' }}>
                                    <AvatarWithInitials
                                        avatarUrl={client.avatarUrl}
                                        name={client.nombre}
                                        size={40}
                                    />
                                    {/* Churn Risk Indicator */}
                                    {churnRisks[client._id]?.riskLevel && churnRisks[client._id].riskLevel !== 'none' && (
                                        <ChurnIndicator riskLevel={churnRisks[client._id].riskLevel} size={12} />
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.subsName} numberOfLines={1}>{client.nombre}</Text>
                                    <Text style={styles.subsEmail} numberOfLines={1}>
                                        {churnRisks[client._id]?.message || client.email}
                                    </Text>
                                </View>
                            </View>
                            {/* Estado with Hover Tooltip */}
                            <View style={[styles.subsCell, styles.colEstado]}>
                                {sub ? (
                                    <StatusTooltip
                                        riskData={churnRisks[client._id]}
                                        clientName={client.nombre}
                                    >
                                        <StatusBadge status={sub.status} />
                                    </StatusTooltip>
                                ) : (
                                    <View style={styles.inactiveBadge}>
                                        <Text style={styles.inactiveBadgeText}>Sin Plan</Text>
                                    </View>
                                )}
                            </View>
                            {/* Próx. Cobro */}
                            <View style={[styles.subsCell, styles.colFecha]}>
                                {sub ? (
                                    <Text style={styles.subsCellText}>
                                        {new Date(sub.nextPaymentDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </Text>
                                ) : (
                                    <Text style={styles.subsCellMuted}>—</Text>
                                )}
                            </View>
                            {/* Frecuencia */}
                            <View style={[styles.subsCell, styles.colFreq]}>
                                {sub ? (
                                    <Text style={styles.subsCellText}>{getFreqLabel(sub.frequency)}</Text>
                                ) : (
                                    <Text style={styles.subsCellMuted}>—</Text>
                                )}
                            </View>
                            {/* Importe */}
                            <View style={[styles.subsCell, styles.colImporte]}>
                                {sub ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={styles.subsAmountText}>{sub.amount}€</Text>
                                        <Ionicons
                                            name={sub.paymentMethod === 'card' ? 'card-outline' : sub.paymentMethod === 'transfer' ? 'swap-horizontal-outline' : 'cash-outline'}
                                            size={14}
                                            color="#94a3b8"
                                        />
                                    </View>
                                ) : (
                                    <Text style={styles.subsCellMuted}>—</Text>
                                )}
                            </View>
                            {/* Aviso Checkbox */}
                            <View style={[styles.subsCell, styles.colAviso, { alignItems: 'center' }]}>
                                {sub ? (
                                    <TouchableOpacity
                                        style={[styles.warningCheckbox, warningEnabled[sub._id] && styles.warningCheckboxChecked]}
                                        onPress={() => toggleWarning(sub._id)}
                                    >
                                        {warningEnabled[sub._id] && <Ionicons name="checkmark" size={12} color="#fff" />}
                                    </TouchableOpacity>
                                ) : (
                                    <View style={styles.warningCheckboxDisabled} />
                                )}
                            </View>
                            {/* Action */}
                            <View style={[styles.subsCell, styles.colAction, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                                {sub ? (
                                    <>
                                        <TouchableOpacity style={styles.paidBtnFull} onPress={() => handleMarkAsPaid(sub, client.nombre)}>
                                            <Ionicons name="wallet-outline" size={16} color="#10b981" />
                                            <Text style={styles.paidBtnText}>Registrar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.moreBtn} onPress={() => handleEditSub(client, sub)}>
                                            <Ionicons name="create-outline" size={18} color="#3b82f6" />
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <TouchableOpacity style={styles.assignPlanBtn} onPress={() => handleAddSub(client)}>
                                        <Ionicons name="add-circle-outline" size={16} color="#2563eb" />
                                        <Text style={styles.assignPlanText}>Asignar Plan</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    ))}
                </View>
            ) : (
                /* MOBILE CARD VIEW */
                clientSubscriptions.map(({ client, sub }) => (
                    <View key={client._id} style={styles.subCard}>
                        {sub ? (
                            <>
                                {/* 1. HEADER: Avatar + ChurnIndicator + Nombre + Badge */}
                                <View style={styles.cardHeader}>
                                    <View style={styles.cardHeaderLeft}>
                                        <View style={{ position: 'relative' }}>
                                            <AvatarWithInitials
                                                avatarUrl={client.avatarUrl}
                                                name={client.nombre}
                                                size={44}
                                            />
                                            {/* Churn Risk Indicator */}
                                            {churnRisks[client._id]?.riskLevel && churnRisks[client._id].riskLevel !== 'none' && (
                                                <ChurnIndicator riskLevel={churnRisks[client._id].riskLevel} size={14} />
                                            )}
                                        </View>
                                        <View>
                                            <Text style={styles.cardPlanName}>{sub.planName}</Text>
                                            <Text style={styles.cardClientName}>{client.nombre}</Text>
                                            {/* Churn Warning Message */}
                                            {churnRisks[client._id]?.message && (
                                                <Text style={{
                                                    fontSize: 11,
                                                    color: churnRisks[client._id].riskLevel === 'high' ? '#ef4444' : '#f59e0b',
                                                    marginTop: 2
                                                }}>
                                                    {churnRisks[client._id].message}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                    <StatusBadge status={sub.status} />
                                </View>

                                {/* 2. FINANCIAL DATA: Grid 2 cols */}
                                <View style={styles.cardFinancialGrid}>
                                    <View style={styles.cardFinancialCol}>
                                        <Text style={styles.cardFinancialLabel}>Importe</Text>
                                        <Text style={styles.cardFinancialValue}>
                                            {sub.amount}€ <Text style={styles.cardFinancialFreq}>/ {getFreqLabel(sub.frequency)}</Text>
                                        </Text>
                                    </View>
                                    <View style={[styles.cardFinancialCol, { alignItems: 'flex-end' }]}>
                                        <Text style={styles.cardFinancialLabel}>Próx. Cobro</Text>
                                        <Text style={styles.cardFinancialDate}>
                                            {new Date(sub.nextPaymentDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </Text>
                                    </View>
                                </View>

                                {/* 2.5 WARNING TOGGLE (MOBILE) */}
                                <TouchableOpacity
                                    style={styles.cardWarningRow}
                                    onPress={() => toggleWarning(sub._id)}
                                >
                                    <View style={styles.cardWarningLeft}>
                                        <Ionicons name="notifications-outline" size={18} color={warningEnabled[sub._id] ? '#f59e0b' : '#94a3b8'} />
                                        <Text style={[styles.cardWarningText, warningEnabled[sub._id] && styles.cardWarningTextActive]}>
                                            Avisos de pago
                                        </Text>
                                    </View>
                                    <View style={[styles.cardWarningToggle, warningEnabled[sub._id] && styles.cardWarningToggleActive]}>
                                        <View style={[styles.cardWarningToggleDot, warningEnabled[sub._id] && styles.cardWarningToggleDotActive]} />
                                    </View>
                                </TouchableOpacity>

                                {/* 3. ACTION BUTTONS: Full Width Grid */}
                                <View style={styles.cardActionsGrid}>
                                    <TouchableOpacity style={styles.cardBtnPaid} onPress={() => handleMarkAsPaid(sub, client.nombre)}>
                                        <Ionicons name="wallet-outline" size={18} color="#059669" />
                                        <Text style={styles.cardBtnPaidText}>Registrar Pago</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.cardBtnEdit} onPress={() => handleEditSub(client, sub)}>
                                        <Ionicons name="create-outline" size={18} color="#64748b" />
                                        <Text style={styles.cardBtnEditText}>Editar</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : (
                            /* Sin Plan */
                            <View style={styles.cardHeader}>
                                <View style={styles.cardHeaderLeft}>
                                    <AvatarWithInitials
                                        avatarUrl={client.avatarUrl}
                                        name={client.nombre}
                                        size={44}
                                    />
                                    <View>
                                        <Text style={[styles.cardPlanName, { color: '#94a3b8' }]}>Sin Plan Activo</Text>
                                        <Text style={styles.cardClientName}>{client.nombre}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity style={styles.cardBtnCreate} onPress={() => handleAddSub(client)}>
                                    <Ionicons name="add" size={16} color="#3b82f6" />
                                    <Text style={styles.cardBtnCreateText}>Crear Plan</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                ))
            )}
        </View>
    );

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CoachHeader
                title="Facturación"
                subtitle="Gestión financiera"
                icon="card"
                iconColor="#3b82f6"
                onBackPress={() => router.canGoBack() ? router.back() : router.replace('/(coach)')}
                rightContent={
                    <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={() => setPaymentModalVisible(true)}
                    >
                        <Ionicons name="add" size={20} color="#fff" />
                        {(width >= 768) && <Text style={styles.primaryBtnText}>Registrar</Text>}
                    </TouchableOpacity>
                }
            />

            <ScrollView
                style={styles.scrollContent}
                contentContainerStyle={[styles.contentContainer, !isDesktop && styles.contentContainerMobile]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View style={[styles.layoutRow, !isDesktop && styles.layoutColumn]}>

                    {/* Main Area */}
                    <View style={styles.mainArea}>

                        {/* Tabs */}
                        <View style={styles.tabsContainer}>
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'subscriptions' && styles.tabActive]}
                                onPress={() => setActiveTab('subscriptions')}
                            >
                                <Text style={[styles.tabText, activeTab === 'subscriptions' && styles.tabTextActive]}>Suscripciones</Text>
                                <View style={styles.tabBadge}>
                                    <Text style={styles.tabBadgeText}>{subscriptions.length}</Text>
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'history' && styles.tabActive]}
                                onPress={() => setActiveTab('history')}
                            >
                                <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>Historial de Pagos</Text>
                            </TouchableOpacity>

                        </View>

                        {/* Filters (Only for History) */}
                        {activeTab === 'history' && (
                            <View style={styles.filtersRow}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {['all', 'paid', 'pending', 'overdue'].map((f) => (
                                        <TouchableOpacity
                                            key={f}
                                            style={[styles.filterChip, filter === f && styles.filterChipActive]}
                                            onPress={() => setFilter(f)}
                                        >
                                            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                                                {f === 'all' ? 'Todos' :
                                                    f === 'paid' ? 'Pagados' :
                                                        f === 'pending' ? 'Pendientes' : 'Vencidos'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Content */}
                        {activeTab === 'history' ? (
                            isDesktop ? renderDesktopTable() : (
                                <View style={styles.cardsList}>
                                    {filteredTransactions.map(t => (
                                        <TransactionCard
                                            key={t._id}
                                            transaction={t}
                                            client={{ ...t.clientId, avatar: t.clientId?.avatarUrl, name: t.clientId?.nombre }} // Adapter
                                            onOptionsPress={() => { }}
                                        />
                                    ))}
                                </View>
                            )
                        ) : (
                            renderSubscriptionsList()
                        )}
                    </View>

                    {/* Sidebar KPIs */}
                    <View style={[styles.sidebar, !isDesktop && styles.sidebarMobile]}>
                        <BillingKPIWidget
                            title="Ingresos Mensuales"
                            amount={kpis.monthlyIncome}
                            currency="€"
                            icon="stats-chart"
                            color="#3b82f6"
                        />
                        <BillingKPIWidget
                            title="Pendiente de Cobro"
                            amount={kpis.pendingIncome}
                            currency="€"
                            icon="time"
                            color="#f59e0b"
                            accent="#f59e0b"
                        />

                        {/* Mini Financial Calendar */}
                        <MiniFinancialCalendar subscriptions={subscriptions} />

                        {/* Upcoming */}
                        <View style={styles.upcomingWidget}>
                            <View style={styles.upcomingHeader}>
                                <Ionicons name="calendar" size={16} color="#64748b" />
                                <Text style={styles.upcomingTitle}>Próximos 7 Días</Text>
                            </View>
                            {kpis.upcoming.length > 0 ? kpis.upcoming.map(u => (
                                <View key={u.id} style={styles.upcomingItem}>
                                    <View>
                                        <Text style={styles.upcomingName}>{u.name}</Text>
                                        <Text style={styles.upcomingDate}>{new Date(u.date).toLocaleDateString()}</Text>
                                    </View>
                                    <Text style={styles.upcomingAmount}>{u.amount}€</Text>
                                </View>
                            )) : (
                                <Text style={styles.emptyTextSmall}>No hay cobros próximos</Text>
                            )}
                        </View>
                    </View>

                </View>
            </ScrollView>

            <PaymentModal
                visible={isPaymentModalVisible}
                onClose={handleCloseModal}
                onSave={handleSavePayment}
                editingSubscription={editingSubscription}
                selectedClient={selectedClient}
            />

            {/* Warning Info Modal */}
            <Modal
                visible={showWarningInfoModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowWarningInfoModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.warningInfoModal}>
                        <View style={styles.warningInfoHeader}>
                            <Ionicons name="notifications-outline" size={32} color="#f59e0b" />
                            <Text style={styles.warningInfoTitle}>Sistema de Avisos</Text>
                        </View>
                        <Text style={styles.warningInfoText}>
                            Si este check está activado:
                        </Text>
                        <View style={styles.warningInfoList}>
                            <View style={styles.warningInfoItem}>
                                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                                <Text style={styles.warningInfoItemText}>
                                    Se avisará al cliente de antemano que debe pagar
                                </Text>
                            </View>
                            <View style={styles.warningInfoItem}>
                                <Ionicons name="alert-circle" size={18} color="#ef4444" />
                                <Text style={styles.warningInfoItemText}>
                                    Se bloqueará el uso de la app a los 5 días si no paga
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.warningInfoBtn}
                            onPress={() => setShowWarningInfoModal(false)}
                        >
                            <Text style={styles.warningInfoBtnText}>Entendido</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Toast with Undo for payment registration */}
            <UndoToast
                visible={toastState.visible}
                message={toastState.message}
                onUndo={handleUndoPayment}
                onDismiss={() => setToastState({ visible: false, message: '', undoData: null })}
                duration={4000}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    center: { justifyContent: 'center', alignItems: 'center' },
    scrollContent: { flex: 1 },
    contentContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 100,
    },
    contentContainerMobile: {
        paddingHorizontal: 12,
    },

    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3b82f6',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 10,
        gap: 8,
    },
    primaryBtnText: { color: '#fff', fontWeight: '600' },

    layoutRow: { flexDirection: 'row', gap: 24, alignItems: 'flex-start', width: '100%' },
    layoutColumn: { flexDirection: 'column', width: '100%' },
    mainArea: { flex: 1, minWidth: 0, width: '100%' },
    sidebar: { width: 300, flexShrink: 0 },
    sidebarMobile: { width: '100%', marginTop: 24, flexDirection: 'column-reverse' },

    // Tabs
    tabsContainer: {
        flexDirection: 'row',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    tab: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: {
        borderBottomColor: '#3b82f6',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    tabTextActive: {
        color: '#3b82f6',
    },
    tabBadge: {
        backgroundColor: '#e2e8f0',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    tabBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
    },

    // Filters
    filtersRow: { marginBottom: 16 },
    filterChip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginRight: 8,
    },
    filterChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    filterText: { fontSize: 13, color: '#64748b' },
    filterTextActive: { color: '#fff' },

    // Table
    tableContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    columnHeader: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    cell: { justifyContent: 'center' },
    tableAvatar: { width: 32, height: 32, borderRadius: 16 },
    tableName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
    tableEmail: { fontSize: 11, color: '#94a3b8' },
    planText: { fontSize: 13, color: '#475569' },
    cellText: { fontSize: 13, color: '#64748b' },
    amountText: { fontSize: 14, fontWeight: '700', color: '#1e293b' },

    // Mobile Cards
    cardsList: { gap: 16, width: '100%' },

    // Subscription Cards - Premium Mobile Design
    subCard: {
        width: '100%',
        alignSelf: 'stretch',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },

    // Card Header
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    cardAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: '#e2e8f0',
    },
    cardAvatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardAvatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#64748b',
    },
    cardPlanName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
    },
    cardClientName: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },

    // Card Financial Grid (2 columns)
    cardFinancialGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#f3f4f6',
        marginBottom: 16,
    },
    cardFinancialCol: {
        flex: 1,
    },
    cardFinancialLabel: {
        fontSize: 11,
        color: '#9ca3af',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    cardFinancialValue: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0f172a',
        letterSpacing: -0.5,
    },
    cardFinancialFreq: {
        fontSize: 13,
        fontWeight: '400',
        color: '#9ca3af',
    },
    cardFinancialDate: {
        fontSize: 15,
        fontWeight: '600',
        color: '#334155',
    },

    // Card Action Buttons Grid
    cardActionsGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    cardBtnPaid: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        backgroundColor: '#d1fae5',
        borderRadius: 12,
    },
    cardBtnPaidText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#059669',
    },
    cardBtnEdit: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
    },
    cardBtnEditText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#64748b',
    },
    cardBtnCreate: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: '#eff6ff',
        borderRadius: 20,
    },
    cardBtnCreateText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#3b82f6',
    },

    // Legacy styles (keep for desktop table)
    subHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#eff6ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    subTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
    subClient: { fontSize: 13, color: '#64748b', marginTop: 2 },
    subDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    subAmount: { fontSize: 20, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
    subFreq: { fontSize: 13, color: '#64748b', fontWeight: '400' },
    subNext: { fontSize: 12, color: '#64748b' },

    createSubBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: '#eff6ff',
        gap: 6
    },
    createSubText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#3b82f6'
    },

    // Empty State
    emptyState: { alignItems: 'center', padding: 40 },
    emptyText: { marginTop: 16, fontSize: 16, fontWeight: '600', color: '#1e293b' },
    emptySubtext: { marginTop: 4, color: '#64748b', textAlign: 'center' },
    emptyTextSmall: { color: '#94a3b8', fontStyle: 'italic', fontSize: 12 },

    upcomingWidget: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        marginTop: 12,
    },
    upcomingHeader: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    upcomingTitle: { fontSize: 13, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' },
    upcomingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    upcomingName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
    upcomingDate: { fontSize: 12, color: '#94a3b8' },
    upcomingAmount: { fontSize: 14, fontWeight: '700', color: '#1e293b' },

    // Subscriptions Desktop Table
    subsTableContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
    },
    subsTableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 2,
        borderBottomColor: '#e2e8f0',
        alignItems: 'center',
    },
    subsColHeader: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    subsTableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        backgroundColor: '#fff',
    },
    subsTableRowAlt: {
        backgroundColor: '#fafbfd',
    },
    subsCell: {
        justifyContent: 'center',
    },
    // Column widths - fixed pixels for perfect alignment
    colNombre: { flex: 1, minWidth: 200 },
    colEstado: { width: 100 },
    colFecha: { width: 120 },
    colFreq: { width: 110 },
    colImporte: { width: 100 },
    colAviso: { width: 100, alignItems: 'center', justifyContent: 'center' },
    colAction: { width: 120 },

    // Warning Checkbox Styles
    warningCheckbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: '#cbd5e1',
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    warningCheckboxChecked: {
        backgroundColor: '#f59e0b',
        borderColor: '#f59e0b',
    },
    warningCheckboxDisabled: {
        width: 20,
        height: 20,
        borderRadius: 4,
        backgroundColor: '#f1f5f9',
    },
    moreBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#eff6ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    paidBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#d1fae5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    paidBtnFull: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: '#d1fae5',
        borderWidth: 1,
        borderColor: '#6ee7b7',
    },
    paidBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#059669',
    },
    mobileActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    editBtnMobile: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    editBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#2563eb',
    },
    subsAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#e2e8f0',
    },
    subsName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
    },
    subsEmail: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    subsCellText: {
        fontSize: 14,
        color: '#334155',
        fontWeight: '500',
    },
    subsCellMuted: {
        fontSize: 14,
        color: '#cbd5e1',
    },
    subsAmountText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.3,
    },
    inactiveBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    inactiveBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94a3b8',
    },
    dateCell: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f8fafc',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    freqBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#fff',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    freqBadgeText: {
        fontSize: 13,
        color: '#475569',
    },
    addSubBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#eff6ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    assignPlanBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    assignPlanText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#2563eb',
    },

    // Warning Info Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    warningInfoModal: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    warningInfoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    warningInfoTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
    },
    warningInfoText: {
        fontSize: 15,
        color: '#475569',
        marginBottom: 16,
    },
    warningInfoList: {
        gap: 12,
        marginBottom: 24,
    },
    warningInfoItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    warningInfoItemText: {
        flex: 1,
        fontSize: 14,
        color: '#334155',
        lineHeight: 20,
    },
    warningInfoBtn: {
        backgroundColor: '#3b82f6',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    warningInfoBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    // Mobile Warning Toggle Styles
    cardWarningRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    cardWarningLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    cardWarningText: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    cardWarningTextActive: {
        color: '#f59e0b',
    },
    cardWarningToggle: {
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#cbd5e1',
        padding: 2,
        justifyContent: 'center',
    },
    cardWarningToggleActive: {
        backgroundColor: '#f59e0b',
    },
    cardWarningToggleDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#fff',
    },
    cardWarningToggleDotActive: {
        alignSelf: 'flex-end',
    },
});
