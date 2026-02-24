/* app/(coach)/nutrition/components/WeeklyMealPlanner/MacroSummaryFooter.jsx
 * Responsive floating macro summary footer
 * - Full layout on desktop (donut + progress bars + status)
 * - Compact layout on mobile (inline macro pills)
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Platform,
} from 'react-native';
import { useStableWindowDimensions } from '../../../../../src/hooks/useStableBreakpoint';

// Simple donut chart (web only, desktop)
const DonutChart = ({ current, target, size = 70 }) => {
    const percent = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    if (Platform.OS === 'web') {
        return (
            <View style={[styles.donutContainer, { width: size, height: size }]}>
                <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                    <circle
                        cx={size / 2} cy={size / 2} r={radius}
                        fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth}
                    />
                    <circle
                        cx={size / 2} cy={size / 2} r={radius}
                        fill="none" stroke="#3b82f6" strokeWidth={strokeWidth}
                        strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                    />
                </svg>
                <View style={styles.donutCenter}>
                    <Text style={styles.donutValue}>{current}</Text>
                    <Text style={styles.donutLabel}>/ {target} KCAL</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.donutFallback, { width: size, height: size }]}>
            <Text style={styles.donutValue}>{current}</Text>
            <Text style={styles.donutLabel}>/ {target} KCAL</Text>
        </View>
    );
};

// Linear progress bar (desktop)
const ProgressBar = ({ label, current, target, color }) => {
    const percent = target > 0 ? Math.min((current / target) * 100, 100) : 0;

    return (
        <View style={styles.progressItem}>
            <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>{label}</Text>
                <Text style={[styles.progressCurrent, { color }]}>{current}g</Text>
            </View>
            <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: color }]} />
            </View>
        </View>
    );
};

export default function MacroSummaryFooter({ macros, targets }) {
    const { width } = useStableWindowDimensions();
    const { kcal, protein, carbs, fat } = macros;
    const targetKcal = targets?.kcal || 2000;
    const targetProtein = targets?.protein || 150;
    const targetCarbs = targets?.carbs || 200;
    const targetFat = targets?.fat || 70;

    const isCompact = width < 500;

    // Calculate overall status
    const kcalPercent = targetKcal > 0 ? (kcal / targetKcal) * 100 : 0;
    const isOnTrack = kcalPercent >= 80 && kcalPercent <= 110;
    const isOver = kcalPercent > 110;

    // ─── COMPACT LAYOUT (mobile) ───
    if (isCompact) {
        return (
            <View style={styles.compactContainer}>
                <View style={styles.compactFooter}>
                    {/* Kcal pill */}
                    <View style={[styles.compactPill, styles.compactKcalPill]}>
                        <Text style={styles.compactKcalValue}>{kcal}</Text>
                        <Text style={styles.compactKcalLabel}>kcal</Text>
                    </View>

                    {/* Macro pills */}
                    <View style={styles.compactMacros}>
                        <View style={styles.compactMacroItem}>
                            <View style={[styles.compactMacroDot, { backgroundColor: '#3b82f6' }]} />
                            <Text style={styles.compactMacroValue}>{protein}g</Text>
                            <Text style={styles.compactMacroLabel}>P</Text>
                        </View>
                        <View style={styles.compactMacroItem}>
                            <View style={[styles.compactMacroDot, { backgroundColor: '#22c55e' }]} />
                            <Text style={styles.compactMacroValue}>{carbs}g</Text>
                            <Text style={styles.compactMacroLabel}>C</Text>
                        </View>
                        <View style={styles.compactMacroItem}>
                            <View style={[styles.compactMacroDot, { backgroundColor: '#f59e0b' }]} />
                            <Text style={styles.compactMacroValue}>{fat}g</Text>
                            <Text style={styles.compactMacroLabel}>G</Text>
                        </View>
                    </View>

                    {/* Status dot */}
                    <View style={[
                        styles.compactStatusDot,
                        isOnTrack && { backgroundColor: '#22c55e' },
                        isOver && { backgroundColor: '#ef4444' },
                    ]} />
                </View>
            </View>
        );
    }

    // ─── FULL LAYOUT (desktop) ───
    return (
        <View style={styles.container}>
            <View style={styles.footer}>
                <DonutChart current={kcal} target={targetKcal} size={70} />

                <View style={styles.separator} />

                <View style={styles.macrosContainer}>
                    <ProgressBar label="PROTEIN" current={protein} target={targetProtein} color="#3b82f6" />
                    <ProgressBar label="CARBS" current={carbs} target={targetCarbs} color="#22c55e" />
                    <ProgressBar label="FATS" current={fat} target={targetFat} color="#f59e0b" />
                </View>

                <View style={styles.statusContainer}>
                    <View style={[
                        styles.statusDot,
                        isOnTrack && styles.statusDotOk,
                        isOver && styles.statusDotOver
                    ]} />
                    <Text style={[
                        styles.statusText,
                        isOnTrack && styles.statusTextOk,
                        isOver && styles.statusTextOver
                    ]}>
                        {isOver ? 'Over' : isOnTrack ? 'On Track' : 'Building'}
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    // ─── DESKTOP (full) ───
    container: {
        position: 'absolute',
        bottom: 24,
        left: 0,
        right: 0,
        alignItems: 'center',
        pointerEvents: 'box-none',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingVertical: 12,
        paddingHorizontal: 20,
        gap: 16,
        ...Platform.select({
            web: {
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            },
            default: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.25,
                shadowRadius: 24,
                elevation: 20,
            }
        }),
    },
    donutContainer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    donutCenter: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    donutValue: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1e293b',
    },
    donutLabel: {
        fontSize: 8,
        fontWeight: '600',
        color: '#94a3b8',
        marginTop: -2,
    },
    donutFallback: {
        borderRadius: 100,
        borderWidth: 6,
        borderColor: '#3b82f6',
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    separator: {
        width: 1,
        height: 40,
        backgroundColor: '#e5e7eb',
    },
    macrosContainer: {
        flexDirection: 'row',
        gap: 20,
    },
    progressItem: {
        width: 80,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    progressLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#9ca3af',
        letterSpacing: 0.5,
    },
    progressCurrent: {
        fontSize: 12,
        fontWeight: '700',
    },
    progressTrack: {
        height: 6,
        backgroundColor: '#e5e7eb',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 12,
        borderLeftWidth: 1,
        borderLeftColor: '#e5e7eb',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#94a3b8',
    },
    statusDotOk: { backgroundColor: '#22c55e' },
    statusDotOver: { backgroundColor: '#ef4444' },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94a3b8',
    },
    statusTextOk: { color: '#22c55e' },
    statusTextOver: { color: '#ef4444' },

    // ─── COMPACT (mobile) ───
    compactContainer: {
        position: 'absolute',
        bottom: 12,
        left: 8,
        right: 8,
        alignItems: 'center',
        pointerEvents: 'box-none',
    },
    compactFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingVertical: 8,
        paddingHorizontal: 12,
        gap: 10,
        ...Platform.select({
            web: {
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
            },
            default: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.2,
                shadowRadius: 12,
                elevation: 12,
            }
        }),
    },
    compactPill: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 2,
    },
    compactKcalPill: {
        backgroundColor: '#f0f9ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    compactKcalValue: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1e293b',
    },
    compactKcalLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#94a3b8',
    },
    compactMacros: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
    },
    compactMacroItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    compactMacroDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    compactMacroValue: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
    },
    compactMacroLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#9ca3af',
    },
    compactStatusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#94a3b8',
    },
});
