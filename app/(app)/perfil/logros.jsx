/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏆 GALERÍA DE LOGROS ESTILO STEAM - TOTALGAINS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Pantalla completa con todos los logros, filtros por categoría,
 * barra de progreso individual y tarjetas gamificadas estilo Steam.
 */

import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Dimensions,
    Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useAchievements } from '../../../context/AchievementsContext';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, TOTAL_ACHIEVEMENTS, HORIZON_MULTIPLIERS } from '../../../src/data/achievements';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // 16 padding left + 16 padding right + 16 gap entre tarjetas

export default function Logros() {
    const { theme } = useTheme();
    const router = useRouter();
    const {
        unlockedCount,
        progressPercent,
        isAchievementUnlocked,
        userStats,
        serverPoints, // Puntos del servidor (prioridad para premium)
    } = useAchievements();

    const [selectedCategory, setSelectedCategory] = useState('all');

    // Filtrar logros por categoría
    const filteredAchievements = useMemo(() => {
        if (selectedCategory === 'all') return ACHIEVEMENTS;
        return ACHIEVEMENTS.filter(a => a.category === selectedCategory);
    }, [selectedCategory]);

    // Contar desbloqueados por categoría
    const categoryStats = useMemo(() => {
        const stats = { all: { total: TOTAL_ACHIEVEMENTS, unlocked: unlockedCount } };
        Object.keys(ACHIEVEMENT_CATEGORIES).forEach(cat => {
            const catAchievements = ACHIEVEMENTS.filter(a => a.category === cat);
            const catUnlocked = catAchievements.filter(a => isAchievementUnlocked(a.id)).length;
            stats[cat] = { total: catAchievements.length, unlocked: catUnlocked };
        });
        return stats;
    }, [unlockedCount, isAchievementUnlocked]);

    // Calcular puntos totales y conseguidos
    // serverPoints tiene prioridad (viene del backend con multiplicadores HORIZON correctos)
    const pointsStats = useMemo(() => {
        const totalPoints = ACHIEVEMENTS.reduce((sum, a) => sum + (a.points || 0), 0);

        // Si hay serverPoints (usuario premium), usar esos
        // Si no, calcular localmente (fallback para usuarios free)
        const earnedPoints = serverPoints !== null
            ? serverPoints
            : ACHIEVEMENTS
                .filter(a => isAchievementUnlocked(a.id))
                .reduce((sum, a) => sum + (a.points || 0), 0);

        return { total: totalPoints, earned: earnedPoints };
    }, [isAchievementUnlocked, serverPoints]);

    // Renderizar tarjeta de logro
    const renderAchievementCard = (achievement) => {
        const isUnlocked = isAchievementUnlocked(achievement.id);
        const category = ACHIEVEMENT_CATEGORIES[achievement.category] || {};
        const categoryColor = category.color || '#8b5cf6';

        // Calcular progreso si aplica
        let progressInfo = null;
        if (!isUnlocked && achievement.targetValue && achievement.progressKey) {
            const currentValue = userStats[achievement.progressKey] || 0;
            const target = achievement.targetValue;
            const percent = Math.min(100, Math.round((currentValue / target) * 100));
            progressInfo = { currentValue, target, percent, isClose: percent >= 70 };
        }

        return (
            <View
                key={achievement.id}
                style={[
                    styles.achievementCard,
                    {
                        backgroundColor: isUnlocked
                            ? theme.cardBackground
                            : theme.backgroundSecondary,
                        borderColor: isUnlocked
                            ? categoryColor
                            : theme.border,
                        opacity: isUnlocked ? 1 : 0.7,
                    },
                ]}
            >
                {/* Badge de categoría */}
                <View
                    style={[
                        styles.categoryBadge,
                        { backgroundColor: isUnlocked ? categoryColor : theme.backgroundTertiary }
                    ]}
                >
                    <Text style={styles.categoryBadgeText}>{category.emoji}</Text>
                </View>

                {/* Emoji del logro */}
                <View style={[
                    styles.emojiContainer,
                    { backgroundColor: isUnlocked ? `${categoryColor}20` : theme.backgroundTertiary }
                ]}>
                    <Text style={[styles.emoji, !isUnlocked && styles.emojiLocked]}>
                        {isUnlocked || !achievement.isHidden ? achievement.emoji : '❓'}
                    </Text>
                </View>

                {/* 💰 Badge de puntos */}
                <View style={[
                    styles.pointsBadge,
                    { backgroundColor: isUnlocked ? '#fbbf24' : theme.backgroundTertiary }
                ]}>
                    <Text style={[
                        styles.pointsText,
                        { color: isUnlocked ? '#000' : theme.textSecondary }
                    ]}>
                        {achievement.points || 0} pts
                    </Text>
                </View>

                {/* Nombre */}
                <Text
                    style={[
                        styles.achievementName,
                        { color: isUnlocked ? theme.text : theme.textSecondary }
                    ]}
                    numberOfLines={2}
                >
                    {isUnlocked || !achievement.isHidden ? achievement.name : '???'}
                </Text>

                {/* Descripción */}
                <Text
                    style={[styles.achievementDescription, { color: theme.textSecondary }]}
                    numberOfLines={2}
                >
                    {isUnlocked || !achievement.isHidden
                        ? achievement.description
                        : 'Logro oculto...'
                    }
                </Text>

                {/* 📊 BARRA DE PROGRESO para logros no desbloqueados con target numérico */}
                {progressInfo && (
                    <View style={styles.progressSection}>
                        <View style={[styles.cardProgressBar, { backgroundColor: theme.backgroundTertiary }]}>
                            <View
                                style={[
                                    styles.cardProgressFill,
                                    {
                                        width: `${progressInfo.percent}%`,
                                        backgroundColor: progressInfo.isClose ? theme.success : categoryColor,
                                    }
                                ]}
                            />
                        </View>
                        <Text style={[styles.cardProgressText, { color: theme.textSecondary }]}>
                            {progressInfo.currentValue.toLocaleString()} / {progressInfo.target.toLocaleString()}
                        </Text>
                    </View>
                )}

                {/* Checkmark para desbloqueados */}
                {isUnlocked && (
                    <View style={[styles.unlockedBadge, { backgroundColor: theme.success }]}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* CUSTOM HEADER */}
            <View style={[styles.customHeader, { paddingTop: Platform.OS === 'android' ? 10 : 0 }]}>
                <Pressable
                    onPress={() => router.back()}
                    style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </Pressable>
                <Text style={{ fontSize: 18, fontWeight: '900', color: theme.text, textTransform: 'uppercase', marginLeft: 4 }}>LOGROS</Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >

                {/* CABECERA CON PROGRESO GLOBAL */}
                <View style={[styles.header, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                    <View style={styles.headerTop}>
                        <View style={styles.trophyContainer}>
                            <Ionicons name="trophy" size={48} color="#fbbf24" />
                        </View>
                        <View style={styles.headerStats}>
                            <Text style={[styles.headerTitle, { color: theme.text }]}>Tus Logros</Text>
                            <Text style={[styles.headerCount, { color: theme.primary }]}>
                                {unlockedCount} / {TOTAL_ACHIEVEMENTS}
                            </Text>
                            {/* Puntos totales ganados */}
                            <View style={styles.pointsRow}>
                                <Ionicons name="star" size={14} color="#fbbf24" />
                                <Text style={[styles.pointsEarned, { color: '#fbbf24' }]}>
                                    {pointsStats.earned.toLocaleString()}
                                </Text>
                                <Text style={[styles.pointsTotal, { color: theme.textSecondary }]}>
                                    / {pointsStats.total.toLocaleString()} pts
                                </Text>
                            </View>
                            {/* Puntos actuales (moneda para compras) */}
                            <View style={styles.pointsRow}>
                                <Text style={styles.coinIcon}>🪙</Text>
                                <Text style={[styles.spendablePoints, { color: '#f59e0b' }]}>
                                    {pointsStats.earned.toLocaleString()}
                                </Text>
                                <Text style={[styles.spendableLabel, { color: theme.textSecondary }]}>
                                    disponibles
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={[styles.progressBarContainer, { backgroundColor: theme.backgroundTertiary }]}>
                        <View
                            style={[
                                styles.progressBarFill,
                                {
                                    width: `${progressPercent}%`,
                                    backgroundColor: progressPercent >= 100 ? '#fbbf24' : theme.primary,
                                }
                            ]}
                        />
                    </View>
                    <Text style={[styles.progressText, { color: theme.textSecondary }]}>
                        {progressPercent}% completado
                    </Text>
                </View>

                {/* FILTROS POR CATEGORÍA */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filtersContainer}
                    contentContainerStyle={styles.filtersContent}
                >
                    <Pressable
                        onPress={() => setSelectedCategory('all')}
                        style={[
                            styles.filterButton,
                            {
                                backgroundColor: selectedCategory === 'all' ? theme.primary : theme.cardBackground,
                                borderColor: selectedCategory === 'all' ? theme.primary : theme.border,
                            }
                        ]}
                    >
                        <Text style={[styles.filterEmoji]}>🏆</Text>
                        <Text style={[styles.filterButtonText, { color: selectedCategory === 'all' ? '#fff' : theme.text }]}>
                            {categoryStats.all.unlocked}/{categoryStats.all.total}
                        </Text>
                    </Pressable>

                    {Object.entries(ACHIEVEMENT_CATEGORIES).map(([key, cat]) => (
                        <Pressable
                            key={key}
                            onPress={() => setSelectedCategory(key)}
                            style={[
                                styles.filterButton,
                                {
                                    backgroundColor: selectedCategory === key ? cat.color : theme.cardBackground,
                                    borderColor: selectedCategory === key ? cat.color : theme.border,
                                }
                            ]}
                        >
                            <Text style={styles.filterEmoji}>{cat.emoji}</Text>
                            <Text style={[styles.filterButtonText, { color: selectedCategory === key ? '#fff' : theme.text }]}>
                                {categoryStats[key]?.unlocked || 0}/{categoryStats[key]?.total || 0}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>

                {/* GRID DE LOGROS */}
                <View style={styles.achievementsGrid}>
                    {filteredAchievements.map(renderAchievementCard)}
                </View>

                <View style={{ height: 32 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 32 },
    headerButton: { padding: 10 },
    headerButtonPressed: { opacity: 0.6 },

    // Cabecera
    customHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    header: { borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1 },
    headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    trophyContainer: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: 'rgba(251, 191, 36, 0.15)',
        alignItems: 'center', justifyContent: 'center', marginRight: 16,
    },
    headerStats: { flex: 1 },
    headerTitle: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
    headerCount: { fontSize: 28, fontWeight: '900' },
    progressBarContainer: { height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 8 },
    progressBarFill: { height: '100%', borderRadius: 6 },
    progressText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },

    // Filtros - sin márgenes negativos para evitar que se salga
    filtersContainer: { marginBottom: 16 },
    filtersContent: { paddingHorizontal: 0, gap: 6, flexDirection: 'row', paddingRight: 16 },
    filterButton: {
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    filterEmoji: { fontSize: 14 },
    filterButtonText: { fontSize: 10, fontWeight: '700' },

    // Grid de logros
    achievementsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    achievementCard: {
        width: CARD_WIDTH,
        padding: 12,
        borderRadius: 16,
        borderWidth: 2,
        marginBottom: 12,
        position: 'relative',
        minHeight: 180,
    },
    categoryBadge: {
        position: 'absolute', top: 8, right: 8,
        width: 24, height: 24, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },
    categoryBadgeText: { fontSize: 12 },
    emojiContainer: {
        width: 52, height: 52, borderRadius: 26,
        alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    },
    emoji: { fontSize: 28 },
    emojiLocked: { opacity: 0.4 },
    achievementName: { fontSize: 13, fontWeight: '800', marginBottom: 4, lineHeight: 17 },
    achievementDescription: { fontSize: 10, lineHeight: 14, marginBottom: 8 },

    // Barra de progreso en tarjeta
    progressSection: { marginTop: 'auto' },
    cardProgressBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
    cardProgressFill: { height: '100%', borderRadius: 3 },
    cardProgressText: { fontSize: 9, fontWeight: '600', textAlign: 'center' },

    unlockedBadge: {
        position: 'absolute', bottom: 8, right: 8,
        width: 20, height: 20, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center',
    },

    // Puntos
    pointsBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginBottom: 6,
    },
    pointsText: {
        fontSize: 10,
        fontWeight: '700',
    },
    pointsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    pointsEarned: {
        fontSize: 16,
        fontWeight: '800',
    },
    pointsTotal: {
        fontSize: 14,
        fontWeight: '600',
    },
    coinIcon: {
        fontSize: 14,
    },
    spendablePoints: {
        fontSize: 15,
        fontWeight: '800',
    },
    spendableLabel: {
        fontSize: 12,
        fontWeight: '500',
        marginLeft: 2,
    },
});
