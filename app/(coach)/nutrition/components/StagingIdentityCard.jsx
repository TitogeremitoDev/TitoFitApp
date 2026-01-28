import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const STATUS_CONFIG = {
    'EXACT_MATCH': { color: '#22c55e', icon: 'checkmark-circle', label: 'Verificado', bg: '#dcfce7' },
    'FUZZY_MATCH': { color: '#f59e0b', icon: 'alert-circle', label: 'Similitud', bg: '#fef3c7' },
    'NEW_ITEM': { color: '#f59e0b', icon: 'flash', label: 'Nuevo (IA)', bg: '#fef3c7' },
    'AMBIGUOUS': { color: '#ef4444', icon: 'warning', label: 'Revisar', bg: '#fee2e2' }
};

export default function StagingIdentityCard({ ingredient, onPress }) {
    // 🧠 SMART STATUS: Derive status from sourceType if matchStatus is missing
    let statusKey = ingredient.matchStatus;

    if (!statusKey) {
        // Fallback logic based on source
        if (['DB_CLOUD', 'PDF_EXPLICIT', 'LOCAL_JSON'].includes(ingredient.sourceType)) {
            statusKey = 'EXACT_MATCH';
        } else if (['API_EXTERNAL', 'AI_GENERATED'].includes(ingredient.sourceType)) {
            statusKey = 'NEW_ITEM';
        } else {
            statusKey = 'AMBIGUOUS';
        }
    }

    // Special check: If it has name and valid source, it's at least yellow
    if (statusKey === 'AMBIGUOUS' && ingredient.name && ingredient.name !== 'Sin nombre') {
        statusKey = 'NEW_ITEM';
    }

    const status = STATUS_CONFIG[statusKey] || STATUS_CONFIG['AMBIGUOUS'];
    const isNew = statusKey === 'NEW_ITEM' || statusKey === 'FUZZY_MATCH';

    // 🏷️ SMART NAME: Prioritize 'name' from Backend
    const displayName = ingredient.name || ingredient.detectedName || ingredient.rawText || "Sin nombre";

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.leftCol}>
                {/* Status Icon */}
                <View style={[styles.iconContainer, { backgroundColor: status.bg }]}>
                    <Ionicons name={status.icon} size={18} color={status.color} />
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <Text style={styles.name} numberOfLines={1}>
                        {displayName}
                    </Text>

                    <View style={styles.metaRow}>
                        <Text style={styles.qty}>
                            {ingredient.unit === 'a_gusto' ? 'Libre (Sin pesar)' : `${ingredient.qty} ${ingredient.unit}`}
                        </Text>
                        {ingredient.dbFood && (
                            <Text style={styles.brand} numberOfLines={1}>
                                • {ingredient.dbFood.brand || 'Genérico'}
                            </Text>
                        )}
                    </View>

                    {/* Original text match if different */}
                    {ingredient.matchStatus !== 'NEW_ITEM' && ingredient.rawText !== ingredient.detectedName && (
                        <Text style={styles.originalText} numberOfLines={1}>
                            "{ingredient.rawText}"
                        </Text>
                    )}
                </View>
            </View>

            {/* Right Status Badge */}
            <View style={styles.rightCol}>
                <View style={[styles.badge, { borderColor: status.color }]}>
                    <Text style={[styles.badgeText, { color: status.color }]}>
                        {status.label}
                    </Text>
                </View>
                {isNew && (
                    <Text style={styles.aiTag}>✨ Generando</Text>
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    leftCol: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
    },
    name: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    qty: {
        fontSize: 13,
        fontWeight: '500',
        color: '#64748b',
    },
    brand: {
        fontSize: 12,
        color: '#94a3b8',
        maxWidth: 100,
    },
    originalText: {
        fontSize: 11,
        fontStyle: 'italic',
        color: '#94a3b8',
        marginTop: 2,
    },
    rightCol: {
        alignItems: 'flex-end',
        gap: 4,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        borderWidth: 1,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    aiTag: {
        fontSize: 9,
        color: '#8b5cf6',
        fontWeight: '600',
    }
});
