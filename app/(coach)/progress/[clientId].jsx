/* coach/progress/[clientId].jsx
   ═══════════════════════════════════════════════════════════════════════════
   ANÁLISIS DETALLADO DE CLIENTE
   - Selectores de músculo y ejercicio (como evolucion.jsx)
   - Gráfico de evolución por semana/mes
   - Tabla comparativa con colores verde/rojo
   ═══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
    Pressable,
    Dimensions,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../../../context/AuthContext';

const screenWidth = Dimensions.get('window').width;

// Configuración del gráfico
const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#f8fafc',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
    propsForDots: { r: '5', strokeWidth: '2', stroke: '#3b82f6' },
};

export default function ClientProgressDetail() {
    const router = useRouter();
    const { clientId, clientName } = useLocalSearchParams();
    const { token } = useAuth();

    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [temporalidad, setTemporalidad] = useState('semanas');

    // Nuevos estados para filtros
    const [selMusculo, setSelMusculo] = useState('TOTAL'); // 'TOTAL' = todos
    const [selEjercicio, setSelEjercicio] = useState('');

    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    // ═══════════════════════════════════════════════════════════════════════════
    // CARGAR WORKOUTS
    // ═══════════════════════════════════════════════════════════════════════════
    const cargarSesiones = useCallback(async () => {
        try {
            setIsLoading(true);
            const tressMesesAtras = new Date();
            tressMesesAtras.setMonth(tressMesesAtras.getMonth() - 3);

            const response = await fetch(
                `${API_URL}/api/workouts/by-user/${clientId}?limit=200&startDate=${tressMesesAtras.toISOString()}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const data = await response.json();
            if (data.success) {
                setSessions(data.workouts || []);
            }
        } catch (error) {
            console.error('[ClientProgress] Error:', error);
        } finally {
            setIsLoading(false);
        }
    }, [clientId, token, API_URL]);

    useEffect(() => {
        cargarSesiones();
    }, [cargarSesiones]);

    // ═════════════════════════════════════════════════════════════════════════
    // EXTRAER LISTA DE MÚSCULOS Y EJERCICIOS
    // ═══════════════════════════════════════════════════════════════════════════
    const { listaMusculos, mapEjercicios } = useMemo(() => {
        const muscSet = new Set();
        const ejMap = new Map(); // musculo -> Set<ejercicio>

        sessions.forEach((session) => {
            session.exercises?.forEach((ej) => {
                const musc = ej.muscleGroup || 'SIN GRUPO';
                const nombre = ej.exerciseName || 'Sin nombre';
                muscSet.add(musc);
                if (!ejMap.has(musc)) ejMap.set(musc, new Set());
                ejMap.get(musc).add(nombre);
            });
        });

        const muscArr = ['TOTAL', ...Array.from(muscSet).sort()];
        const ejMapArr = new Map();
        ejMap.forEach((v, k) => ejMapArr.set(k, Array.from(v).sort()));

        return { listaMusculos: muscArr, mapEjercicios: ejMapArr };
    }, [sessions]);

    const listaEjercicios = useMemo(() => {
        if (selMusculo === 'TOTAL' || !selMusculo) return [];
        return mapEjercicios.get(selMusculo) || [];
    }, [selMusculo, mapEjercicios]);

    // Reset ejercicio cuando cambia músculo
    const handleMusculoChange = (musculo) => {
        setSelMusculo(musculo);
        setSelEjercicio('');
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // FILTRAR Y AGRUPAR DATOS POR PERÍODO
    // ═══════════════════════════════════════════════════════════════════════════
    const datosAgrupados = useMemo(() => {
        if (!sessions || sessions.length === 0) return [];

        const grupos = new Map();
        const ahora = new Date();

        sessions.forEach((session) => {
            const fecha = new Date(session.date);
            let clave;

            if (temporalidad === 'total') {
                clave = 'Total acumulado';
            } else if (temporalidad === 'semanas') {
                // Calcular número de semana del año
                const startOfYear = new Date(fecha.getFullYear(), 0, 1);
                const weekNum = Math.ceil(((fecha - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
                clave = `Semana ${weekNum}`;
            } else {
                // Mes completo en español
                const mes = fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                clave = mes.charAt(0).toUpperCase() + mes.slice(1);
            }

            if (!grupos.has(clave)) {
                grupos.set(clave, {
                    periodo: clave,
                    volumen: 0,
                    reps: 0,
                    cargaTotal: 0,
                    numSesiones: 0,
                    fechaSort: fecha,
                });
            }

            const grupo = grupos.get(clave);

            // Filtrar por músculo/ejercicio
            session.exercises?.forEach((ej) => {
                const musc = ej.muscleGroup || 'SIN GRUPO';
                const nombre = ej.exerciseName || '';

                // Si es TOTAL, incluir todo. Si no, filtrar
                if (selMusculo !== 'TOTAL' && musc !== selMusculo) return;
                if (selEjercicio && nombre !== selEjercicio) return;

                ej.sets?.forEach((s) => {
                    const reps = s.actualReps || 0;
                    const peso = s.weight || 0;
                    grupo.reps += reps;
                    grupo.volumen += reps * peso;
                    grupo.cargaTotal += peso;
                });
            });

            grupo.numSesiones += 1;
            if (fecha > grupo.fechaSort) grupo.fechaSort = fecha;
        });

        // Convertir a array y calcular media
        const resultado = Array.from(grupos.values())
            .filter(g => g.volumen > 0 || selMusculo === 'TOTAL')
            .map((g) => ({
                ...g,
                cargaMedia: g.reps > 0 ? Math.round(g.volumen / g.reps * 10) / 10 : 0,
            }));

        // Ordenar por fecha
        return resultado.sort((a, b) => b.fechaSort - a.fechaSort);
    }, [sessions, temporalidad, selMusculo, selEjercicio]);

    // ═══════════════════════════════════════════════════════════════════════════
    // DATOS PARA GRÁFICO (por fecha individual de cada sesión)
    // ═══════════════════════════════════════════════════════════════════════════
    const datosGrafico = useMemo(() => {
        if (!sessions || sessions.length === 0) return null;

        // Agrupar por fecha (día)
        const porFecha = new Map();

        sessions.forEach((session) => {
            const fecha = new Date(session.date);
            const fechaStr = fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

            if (!porFecha.has(fechaStr)) {
                porFecha.set(fechaStr, { fecha, volumen: 0 });
            }

            const grupo = porFecha.get(fechaStr);

            session.exercises?.forEach((ej) => {
                const musc = ej.muscleGroup || 'SIN GRUPO';
                const nombre = ej.exerciseName || '';

                if (selMusculo !== 'TOTAL' && musc !== selMusculo) return;
                if (selEjercicio && nombre !== selEjercicio) return;

                ej.sets?.forEach((s) => {
                    const reps = s.actualReps || 0;
                    const peso = s.weight || 0;
                    grupo.volumen += reps * peso;
                });
            });
        });

        const datos = Array.from(porFecha.entries())
            .map(([label, data]) => ({ label, ...data }))
            .sort((a, b) => a.fecha - b.fecha);

        if (datos.length === 0 || datos.every(d => d.volumen === 0)) return null;

        const labels = datos.map(d => d.label);
        const values = datos.map(d => d.volumen);

        if (values.length === 1) {
            return {
                labels: [labels[0], labels[0]],
                datasets: [{ data: [values[0], values[0]], strokeWidth: 3 }],
            };
        }

        return {
            labels,
            datasets: [{ data: values, strokeWidth: 3 }],
        };
    }, [sessions, selMusculo, selEjercicio]);

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════════════════
    const calcularCambio = (actual, anterior) => {
        if (!anterior || anterior === 0) return actual > 0 ? 100 : 0;
        return Math.round(((actual - anterior) / anterior) * 100);
    };

    const getCambioStyle = (cambio) => {
        if (cambio > 0) return { color: '#10b981', icon: 'arrow-up' };
        if (cambio < 0) return { color: '#ef4444', icon: 'arrow-down' };
        return { color: '#6b7280', icon: 'remove' };
    };

    const totales = useMemo(() => {
        return datosAgrupados.reduce(
            (acc, d) => ({
                volumen: acc.volumen + d.volumen,
                reps: acc.reps + d.reps,
                sesiones: acc.sesiones + d.numSesiones,
            }),
            { volumen: 0, reps: 0, sesiones: 0 }
        );
    }, [datosAgrupados]);

    const tendenciaGeneral = useMemo(() => {
        if (datosAgrupados.length < 2) return 0;
        const actual = datosAgrupados[0]?.volumen || 0;
        const anterior = datosAgrupados[1]?.volumen || 0;
        return calcularCambio(actual, anterior);
    }, [datosAgrupados]);

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════
    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <Stack.Screen options={{ headerShown: false }} />
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#1e293b" />
                    </Pressable>
                    <Text style={styles.headerTitle}>Cargando...</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1e293b" />
                </Pressable>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>{clientName || 'Cliente'}</Text>
                    <Text style={styles.headerSubtitle}>Análisis de progreso</Text>
                </View>
                <View style={[styles.tendenciaBadge, { backgroundColor: getCambioStyle(tendenciaGeneral).color + '20' }]}>
                    <Ionicons name={getCambioStyle(tendenciaGeneral).icon} size={18} color={getCambioStyle(tendenciaGeneral).color} />
                    <Text style={[styles.tendenciaText, { color: getCambioStyle(tendenciaGeneral).color }]}>
                        {tendenciaGeneral > 0 ? '+' : ''}{tendenciaGeneral}%
                    </Text>
                </View>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

                {/* === FILTROS CON SELECTORES ESTILIZADOS === */}
                <View style={styles.filtersCard}>
                    {/* Músculo Selector */}
                    <View style={styles.filterGroup}>
                        <View style={styles.filterLabelRow}>
                            <Ionicons name="body" size={16} color="#3b82f6" />
                            <Text style={styles.filterLabel}>Músculo</Text>
                        </View>
                        <View style={styles.selectWrapper}>
                            <Picker
                                selectedValue={selMusculo}
                                onValueChange={handleMusculoChange}
                                style={styles.picker}
                                dropdownIconColor="#3b82f6"
                            >
                                {listaMusculos.map((m) => (
                                    <Picker.Item
                                        key={m}
                                        label={m === 'TOTAL' ? '📊 TOTAL - Todos los músculos' : m}
                                        value={m}
                                    />
                                ))}
                            </Picker>
                            <View style={styles.selectIcon}>
                                <Ionicons name="chevron-down" size={18} color="#64748b" />
                            </View>
                        </View>
                    </View>

                    {/* Ejercicio Selector */}
                    {selMusculo !== 'TOTAL' && listaEjercicios.length > 0 && (
                        <View style={styles.filterGroup}>
                            <View style={styles.filterLabelRow}>
                                <Ionicons name="barbell" size={16} color="#10b981" />
                                <Text style={styles.filterLabel}>Ejercicio</Text>
                            </View>
                            <View style={styles.selectWrapper}>
                                <Picker
                                    selectedValue={selEjercicio}
                                    onValueChange={setSelEjercicio}
                                    style={styles.picker}
                                    dropdownIconColor="#10b981"
                                >
                                    <Picker.Item label="📋 Todos los ejercicios" value="" />
                                    {listaEjercicios.map((e) => (
                                        <Picker.Item key={e} label={e} value={e} />
                                    ))}
                                </Picker>
                                <View style={styles.selectIcon}>
                                    <Ionicons name="chevron-down" size={18} color="#64748b" />
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Filtro activo indicator */}
                    {selMusculo !== 'TOTAL' && (
                        <View style={styles.activeFilterBadge}>
                            <Ionicons name="funnel" size={14} color="#3b82f6" />
                            <Text style={styles.activeFilterText}>
                                {selMusculo}{selEjercicio ? ` → ${selEjercicio}` : ''}
                            </Text>
                            <Pressable
                                onPress={() => { setSelMusculo('TOTAL'); setSelEjercicio(''); }}
                                style={styles.clearFilterBtn}
                            >
                                <Ionicons name="close-circle" size={18} color="#ef4444" />
                            </Pressable>
                        </View>
                    )}
                </View>

                {/* Gráfico */}
                {datosGrafico && (
                    <View style={styles.chartContainer}>
                        <Text style={styles.sectionTitle}>
                            📈 Evolución {selMusculo === 'TOTAL' ? 'Total' : selMusculo}
                            {selEjercicio ? ` - ${selEjercicio}` : ''}
                        </Text>
                        <LineChart
                            data={datosGrafico}
                            width={screenWidth - 32}
                            height={220}
                            chartConfig={chartConfig}
                            bezier
                            style={styles.chart}
                        />
                    </View>
                )}

                {/* Sin datos */}
                {!datosGrafico && (
                    <View style={styles.noDataContainer}>
                        <Ionicons name="bar-chart-outline" size={48} color="#cbd5e1" />
                        <Text style={styles.noDataText}>Sin datos para este filtro</Text>
                    </View>
                )}

                {/* Selector de agrupación para tabla */}
                <Text style={styles.sectionTitle}>📊 Tabla Comparativa</Text>
                <View style={styles.selectorContainer}>
                    <Pressable
                        style={[styles.selectorButton, temporalidad === 'semanas' && styles.selectorActive]}
                        onPress={() => setTemporalidad('semanas')}
                    >
                        <Text style={[styles.selectorText, temporalidad === 'semanas' && styles.selectorTextActive]}>
                            Semanas
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.selectorButton, temporalidad === 'meses' && styles.selectorActive]}
                        onPress={() => setTemporalidad('meses')}
                    >
                        <Text style={[styles.selectorText, temporalidad === 'meses' && styles.selectorTextActive]}>
                            Meses
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.selectorButton, temporalidad === 'total' && styles.selectorActive]}
                        onPress={() => setTemporalidad('total')}
                    >
                        <Text style={[styles.selectorText, temporalidad === 'total' && styles.selectorTextActive]}>
                            Total
                        </Text>
                    </Pressable>
                </View>

                {/* Tabla comparativa */}
                {datosAgrupados.length > 0 && (
                    <View style={styles.tableContainer}>


                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Período</Text>
                            <Text style={styles.tableHeaderCell}>Volumen</Text>
                            <Text style={styles.tableHeaderCell}>Reps</Text>
                            <Text style={styles.tableHeaderCell}>Carga</Text>
                            <Text style={styles.tableHeaderCell}>Ses.</Text>
                        </View>

                        {datosAgrupados.map((dato, index) => {
                            const anterior = datosAgrupados[index + 1];
                            const cambioVol = anterior ? calcularCambio(dato.volumen, anterior.volumen) : 0;
                            const cambioReps = anterior ? calcularCambio(dato.reps, anterior.reps) : 0;
                            const cambioCarga = anterior ? calcularCambio(dato.cargaMedia, anterior.cargaMedia) : 0;
                            const cambioSes = anterior ? dato.numSesiones - anterior.numSesiones : 0;

                            return (
                                <View key={dato.periodo} style={styles.tableRow}>
                                    <Text style={[styles.tableCell, styles.tableCellPeriodo, { flex: 1.2 }]}>
                                        {dato.periodo}
                                    </Text>

                                    <View style={styles.tableCellValue}>
                                        <Text style={styles.tableValue}>{(dato.volumen / 1000).toFixed(1)}k</Text>
                                        {anterior && (
                                            <View style={[styles.cambioTag, { backgroundColor: getCambioStyle(cambioVol).color + '15' }]}>
                                                <Ionicons name={getCambioStyle(cambioVol).icon} size={10} color={getCambioStyle(cambioVol).color} />
                                                <Text style={[styles.cambioText, { color: getCambioStyle(cambioVol).color }]}>
                                                    {cambioVol > 0 ? '+' : ''}{cambioVol}%
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.tableCellValue}>
                                        <Text style={styles.tableValue}>{dato.reps}</Text>
                                        {anterior && (
                                            <View style={[styles.cambioTag, { backgroundColor: getCambioStyle(cambioReps).color + '15' }]}>
                                                <Ionicons name={getCambioStyle(cambioReps).icon} size={10} color={getCambioStyle(cambioReps).color} />
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.tableCellValue}>
                                        <Text style={styles.tableValue}>{dato.cargaMedia}</Text>
                                        {anterior && (
                                            <View style={[styles.cambioTag, { backgroundColor: getCambioStyle(cambioCarga).color + '15' }]}>
                                                <Ionicons name={getCambioStyle(cambioCarga).icon} size={10} color={getCambioStyle(cambioCarga).color} />
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.tableCellValue}>
                                        <Text style={styles.tableValue}>{dato.numSesiones}</Text>
                                        {anterior && cambioSes !== 0 && (
                                            <Text style={[styles.cambioSmall, { color: getCambioStyle(cambioSes).color }]}>
                                                {cambioSes > 0 ? '+' : ''}{cambioSes}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Resumen de totales */}
                <View style={styles.totalesContainer}>
                    <Text style={styles.sectionTitle}>📋 Resumen Total</Text>
                    <View style={styles.totalesGrid}>
                        <View style={styles.totalItem}>
                            <Text style={styles.totalLabel}>Volumen Total</Text>
                            <Text style={styles.totalValue}>{(totales.volumen / 1000).toFixed(1)}k kg</Text>
                        </View>
                        <View style={styles.totalItem}>
                            <Text style={styles.totalLabel}>Reps Totales</Text>
                            <Text style={styles.totalValue}>{totales.reps.toLocaleString()}</Text>
                        </View>
                        <View style={styles.totalItem}>
                            <Text style={styles.totalLabel}>Sesiones</Text>
                            <Text style={styles.totalValue}>{totales.sesiones}</Text>
                        </View>
                        <View style={styles.totalItem}>
                            <Text style={styles.totalLabel}>Tendencia</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons
                                    name={getCambioStyle(tendenciaGeneral).icon}
                                    size={20}
                                    color={getCambioStyle(tendenciaGeneral).color}
                                />
                                <Text style={[styles.totalValue, { color: getCambioStyle(tendenciaGeneral).color }]}>
                                    {tendenciaGeneral > 0 ? 'Mejorando' : tendenciaGeneral < 0 ? 'Bajando' : 'Estable'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={{ height: 40 }} />
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    backButton: {
        padding: 8,
        marginRight: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#64748b',
    },
    tendenciaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 4,
    },
    tendenciaText: {
        fontSize: 13,
        fontWeight: '700',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // === FILTROS CON SELECTORES ESTILIZADOS ===
    filtersCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    filterGroup: {
        marginBottom: 12,
    },
    filterLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    filterLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    selectWrapper: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
        position: 'relative',
    },
    picker: {
        height: 50,
        color: '#1e293b',
        paddingRight: 40,
    },
    selectIcon: {
        position: 'absolute',
        right: 12,
        top: '50%',
        transform: [{ translateY: -9 }],
        pointerEvents: 'none',
    },
    activeFilterBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eff6ff',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        marginTop: 4,
        gap: 10,
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    activeFilterText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#3b82f6',
        flex: 1,
    },
    clearFilterBtn: {
        padding: 4,
    },

    // Selector temporalidad
    selectorContainer: {
        flexDirection: 'row',
        backgroundColor: '#e2e8f0',
        borderRadius: 10,
        padding: 4,
        marginBottom: 20,
    },
    selectorButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    selectorActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    selectorText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    selectorTextActive: {
        color: '#1e293b',
    },

    // Gráfico
    chartContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 12,
    },
    chart: {
        borderRadius: 12,
        marginTop: 8,
    },

    // Sin datos
    noDataContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 32,
        marginBottom: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    noDataText: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 12,
    },

    // Tabla
    tableContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    tableHeader: {
        flexDirection: 'row',
        paddingBottom: 10,
        borderBottomWidth: 2,
        borderBottomColor: '#e2e8f0',
        marginBottom: 8,
    },
    tableHeaderCell: {
        flex: 1,
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        alignItems: 'center',
    },
    tableCell: {
        flex: 1,
        fontSize: 13,
        color: '#1e293b',
        textAlign: 'center',
    },
    tableCellPeriodo: {
        fontWeight: '600',
        textAlign: 'left',
    },
    tableCellValue: {
        flex: 1,
        alignItems: 'center',
    },
    tableValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
    },
    cambioTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        marginTop: 4,
        gap: 2,
    },
    cambioText: {
        fontSize: 10,
        fontWeight: '600',
    },
    cambioSmall: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
    },

    // Totales
    totalesContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    totalesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    totalItem: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#f8fafc',
        padding: 14,
        borderRadius: 12,
    },
    totalLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 4,
    },
    totalValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
    },
});

