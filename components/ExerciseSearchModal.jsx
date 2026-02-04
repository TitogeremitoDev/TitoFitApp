/**
 * ExerciseSearchModal.jsx
 * Modal de búsqueda inteligente de ejercicios con Fuse.js
 * 
 * Features:
 * - Búsqueda fuzzy (tolerante a typos)
 * - Filtros por músculo (chips)
 * - Inferencia de equipment
 * - Sección "Últimos usados"
 * - Lista virtualizada
 */

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    Modal,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    ScrollView,
    Keyboard,
    ActivityIndicator,
} from 'react-native';
import { EnhancedTextInput } from './ui';
import { Ionicons } from '@expo/vector-icons';
import Fuse from 'fuse.js';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
// Inferencia de Equipment desde el nombre del ejercicio
// ─────────────────────────────────────────────────────────────
const inferEquipment = (name) => {
    if (!name) return 'OTRO';
    const n = name.toLowerCase();

    // Orden de prioridad importa (del más específico al más genérico)
    if (n.includes('smith') || n.includes('multipower')) return 'MULTIPOWER';
    if (n.includes('mancuerna') || n.includes('dumbell') || n.includes('dumbbell')) return 'MANCUERNA';
    if (n.includes('barra') || n.includes('barbell')) return 'BARRA';
    if (n.includes('polea') || n.includes('cable') || n.includes('cruce')) return 'POLEA';
    if (n.includes('máquina') || n.includes('maquina') || n.includes('machine') || n.includes('contractora')) return 'MÁQUINA';
    if (n.includes('corporal') || n.includes('lastre') || n.includes('dominada') || n.includes('flexion') || n.includes('fondos')) return 'CORPORAL';
    if (n.includes('kettlebell') || n.includes('pesa rusa')) return 'KETTLEBELL';
    if (n.includes('banda') || n.includes('elastico') || n.includes('elástico')) return 'BANDAS';
    if (n.includes('trx') || n.includes('suspension')) return 'TRX';

    return 'OTRO';
};

// Colores por tipo de equipment
const equipmentColors = {
    'MANCUERNA': '#3b82f6',
    'BARRA': '#ef4444',
    'POLEA': '#8b5cf6',
    'MÁQUINA': '#10b981',
    'CORPORAL': '#f97316',
    'KETTLEBELL': '#eab308',
    'BANDAS': '#ec4899',
    'MULTIPOWER': '#6366f1',
    'TRX': '#14b8a6',
    'OTRO': '#6b7280',
};

// ─────────────────────────────────────────────────────────────
// Componente de Item de Ejercicio
// ─────────────────────────────────────────────────────────────
const ExerciseItem = React.memo(({ exercise, onSelect }) => {
    const equipColor = equipmentColors[exercise.inferredEquipment] || equipmentColors['OTRO'];

    return (
        <TouchableOpacity
            style={styles.exerciseItem}
            onPress={() => onSelect(exercise)}
            activeOpacity={0.7}
        >
            <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName} numberOfLines={1}>
                    {exercise.name}
                </Text>
                <Text style={styles.exerciseMuscle}>{exercise.muscle}</Text>
            </View>

            <View style={[
                styles.equipmentBadge,
                {
                    backgroundColor: equipColor + '15',
                    borderWidth: 1,
                    borderColor: equipColor + '40',
                }
            ]}>
                <Text style={[styles.equipmentText, { color: equipColor }]}>
                    {exercise.inferredEquipment}
                </Text>
            </View>
        </TouchableOpacity>
    );
});
ExerciseItem.displayName = 'ExerciseItem';

// ─────────────────────────────────────────────────────────────
// Chip de Filtro por Músculo
// ─────────────────────────────────────────────────────────────
const MuscleChip = React.memo(({ label, isActive, onPress }) => (
    <TouchableOpacity
        style={[styles.chip, isActive && styles.chipActive]}
        onPress={onPress}
        activeOpacity={0.8}
    >
        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
            {label}
        </Text>
    </TouchableOpacity>
));
MuscleChip.displayName = 'MuscleChip';

// ─────────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────────
const ExerciseSearchModal = ({
    visible,
    onClose,
    onSelect,
    exercises = [],
    muscles = [],
}) => {
    const [query, setQuery] = useState('');
    const [activeMuscle, setActiveMuscle] = useState('TODO');
    const [isLoading, setIsLoading] = useState(false);
    const inputRef = useRef(null);

    // Reset y autofocus cuando se abre/cierra el modal
    useEffect(() => {
        if (visible) {
            setTimeout(() => inputRef.current?.focus(), 300);
        } else {
            setQuery('');
            setActiveMuscle('TODO');
        }
    }, [visible]);

    // 1. Preparar datos (Inferir equipment una sola vez)
    const processedExercises = useMemo(() => {
        return exercises.map(ex => ({
            ...ex,
            inferredEquipment: inferEquipment(ex.name)
        }));
    }, [exercises]);

    // 2. Configurar Fuse (Búsqueda difusa)
    const fuse = useMemo(() => {
        return new Fuse(processedExercises, {
            keys: [
                { name: 'name', weight: 0.6 },
                { name: 'muscle', weight: 0.3 },
                { name: 'inferredEquipment', weight: 0.1 }
            ],
            threshold: 0.35,
            includeScore: true,
            minMatchCharLength: 2,
        });
    }, [processedExercises]);

    // 3. Filtrar resultados
    const filteredResults = useMemo(() => {
        let results = processedExercises;

        // Paso A: Búsqueda por texto (si hay query)
        if (query.length >= 2) {
            results = fuse.search(query).map(result => result.item);
        }

        // Paso B: Filtro por Músculo (si no es TODO)
        if (activeMuscle !== 'TODO') {
            results = results.filter(ex => ex.muscle === activeMuscle);
        }

        return results;
    }, [query, activeMuscle, processedExercises, fuse]);

    // Lista de músculos separados en 2 filas (mitad y mitad)
    // Fila 1: TODO + Primera mitad de músculos (orden específico)
    // Fila 2: Segunda mitad de músculos + OTRO
    const ROW1_MUSCLES = ['CUÁDRICEPS', 'ISQUIOS', 'ADUCTORES', 'PECTORAL', 'DORSALES', 'GLÚTEO', 'ABDOMEN', 'ESPALDA ALTA/MEDIA'];

    const muscleChipsRow1 = useMemo(() => {
        // Usar el orden definido en ROW1_MUSCLES, no el orden alfabético de muscles
        const row1 = ROW1_MUSCLES.filter(m => muscles.includes(m));
        return ['TODO', ...row1];
    }, [muscles]);

    const muscleChipsRow2 = useMemo(() => {
        // El resto de músculos que no están en ROW1
        const row2 = muscles.filter(m => !ROW1_MUSCLES.includes(m) && m !== 'OTRO');
        return [...row2, 'OTRO'];
    }, [muscles]);

    // Handler de selección
    const handleSelect = useCallback((exercise) => {
        onSelect(exercise);
        onClose();
        Keyboard.dismiss();
    }, [onSelect, onClose]);

    // Renderizar item
    const renderItem = useCallback(({ item }) => (
        <ExerciseItem
            exercise={item}
            onSelect={handleSelect}
        />
    ), [handleSelect]);

    const keyExtractor = useCallback((item) => item._id || item.code, []);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Seleccionar Ejercicio</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color="#374151" />
                    </TouchableOpacity>
                </View>

                {/* Barra de Búsqueda */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
                    <EnhancedTextInput
                        ref={inputRef}
                        containerStyle={styles.searchInputContainer}
                        style={styles.searchInputText}
                        placeholder="Buscar ejercicio..."
                        placeholderTextColor="#9ca3af"
                        value={query}
                        onChangeText={setQuery}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
                            <Ionicons name="close-circle" size={20} color="#9ca3af" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Chips de Músculo - Fila 1: Músculos Grandes */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipsRow}
                    contentContainerStyle={styles.chipsContent}
                >
                    {muscleChipsRow1.map(muscle => (
                        <MuscleChip
                            key={muscle}
                            label={muscle}
                            isActive={activeMuscle === muscle}
                            onPress={() => setActiveMuscle(muscle)}
                        />
                    ))}
                </ScrollView>

                {/* Chips de Músculo - Fila 2: Músculos Pequeños */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipsRow}
                    contentContainerStyle={styles.chipsContent}
                >
                    {muscleChipsRow2.map(muscle => (
                        <MuscleChip
                            key={muscle}
                            label={muscle}
                            isActive={activeMuscle === muscle}
                            onPress={() => setActiveMuscle(muscle)}
                        />
                    ))}
                </ScrollView>

                {/* Lista de Resultados */}
                <View style={styles.listContainer}>
                    {isLoading ? (
                        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 40 }} />
                    ) : filteredResults.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="search-outline" size={48} color="#d1d5db" />
                            <Text style={styles.emptyTitle}>No se encontraron ejercicios</Text>
                            <Text style={styles.emptySubtitle}>
                                {query.length > 0
                                    ? `Intenta con otro término de búsqueda`
                                    : `No hay ejercicios para "${activeMuscle}"`
                                }
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredResults}
                            renderItem={renderItem}
                            keyExtractor={keyExtractor}
                            initialNumToRender={15}
                            maxToRenderPerBatch={10}
                            windowSize={5}
                            removeClippedSubviews={true}
                            ItemSeparatorComponent={() => <View style={styles.separator} />}
                            contentContainerStyle={styles.listContent}
                            keyboardShouldPersistTaps="handled"
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
};

// ─────────────────────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        backgroundColor: '#fff',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    closeBtn: {
        padding: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginVertical: 12,
        paddingHorizontal: 12,
        backgroundColor: '#fff',
        borderRadius: 12,
        height: 48,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInputContainer: {
        flex: 1,
    },
    searchInputText: {
        fontSize: 16,
        color: '#111827',
    },
    clearBtn: {
        padding: 4,
    },
    chipsRow: {
        maxHeight: 48,
        marginBottom: 6,
    },
    chipsContent: {
        paddingHorizontal: 16,
        gap: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 36,
    },
    chipActive: {
        backgroundColor: '#1e293b',
        borderColor: '#1e293b',
    },
    chipText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        textAlign: 'center',
    },
    chipTextActive: {
        color: '#fff',
    },
    listContainer: {
        flex: 1,
        backgroundColor: '#fff',
        marginTop: 8,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    listContent: {
        paddingBottom: 32,
        paddingTop: 8,
    },
    exerciseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
        minHeight: 56,
    },
    exerciseInfo: {
        flex: 1,
        marginRight: 12,
    },
    exerciseName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    exerciseMuscle: {
        fontSize: 12,
        color: '#6b7280',
    },
    equipmentBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    equipmentText: {
        fontSize: 10,
        fontWeight: '700',
    },
    separator: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginLeft: 16,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingBottom: 100,
        backgroundColor: '#fff',
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#9ca3af',
        textAlign: 'center',
        marginTop: 4,
    },
});

ExerciseSearchModal.displayName = 'ExerciseSearchModal';

export default ExerciseSearchModal;
