/**
 * MuscleSelector.tsx
 * Componente de selección de músculos con chips organizados por grupo corporal.
 * NO permite texto libre - solo selección de la lista de músculos válidos.
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

interface MuscleSelectorProps {
    muscles: string[];
    selected: string;
    onSelect: (muscle: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Agrupación visual por zona corporal
// ═══════════════════════════════════════════════════════════════════════════
const MUSCLE_GROUPS: Record<string, string[]> = {
    'Tren Inferior': ['CUÁDRICEPS', 'ISQUIOS', 'ADUCTORES', 'GLÚTEO', 'GEMELOS'],
    'Tren Superior': ['PECTORAL', 'DORSALES', 'ESPALDA ALTA/MEDIA', 'TRAPECIO', 'DELTOIDES'],
    'Brazos': ['BÍCEPS', 'TRÍCEPS', 'ANTEBRAZO'],
    'Core': ['ABDOMEN', 'OBLICUOS', 'LUMBAR'],
    'Otros': ['OTRO']
};

const MuscleChip = React.memo(({
    muscle,
    isSelected,
    onPress
}: {
    muscle: string;
    isSelected: boolean;
    onPress: () => void;
}) => (
    <TouchableOpacity
        style={[styles.chip, isSelected && styles.chipActive]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
            {muscle}
        </Text>
    </TouchableOpacity>
));

MuscleChip.displayName = 'MuscleChip';

export default function MuscleSelector({ muscles, selected, onSelect }: MuscleSelectorProps) {
    // Filtrar grupos que tienen músculos disponibles
    const visibleGroups = useMemo(() => {
        return Object.entries(MUSCLE_GROUPS)
            .map(([group, groupMuscles]) => ({
                group,
                muscles: groupMuscles.filter(m => muscles.includes(m))
            }))
            .filter(g => g.muscles.length > 0);
    }, [muscles]);

    return (
        <View style={styles.container}>
            {visibleGroups.map(({ group, muscles: groupMuscles }) => (
                <View key={group} style={styles.groupContainer}>
                    <Text style={styles.groupLabel}>{group}</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chipsContainer}
                    >
                        {groupMuscles.map(muscle => (
                            <MuscleChip
                                key={muscle}
                                muscle={muscle}
                                isSelected={selected === muscle}
                                onPress={() => onSelect(muscle)}
                            />
                        ))}
                    </ScrollView>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 4,
    },
    groupContainer: {
        marginBottom: 12,
    },
    groupLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    chipsContainer: {
        flexDirection: 'row',
        gap: 8,
        paddingRight: 16,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#1F2937',
        borderWidth: 1.5,
        borderColor: '#374151',
    },
    chipActive: {
        backgroundColor: '#667eea',
        borderColor: '#667eea',
    },
    chipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#9CA3AF',
        textTransform: 'uppercase',
    },
    chipTextActive: {
        color: '#FFF',
    },
});
