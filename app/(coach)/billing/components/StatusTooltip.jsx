import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReactDOM from 'react-dom';

/**
 * StatusTooltip - Wraps StatusBadge and shows hover tooltip with client activity info
 * Uses Portal on web to ensure tooltip renders above everything
 */
export default function StatusTooltip({ children, riskData, clientName }) {
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const containerRef = useRef(null);

    const handleMouseEnter = () => {
        if (Platform.OS === 'web' && containerRef.current) {
            containerRef.current.measure((x, y, width, height, pageX, pageY) => {
                setPosition({
                    x: pageX + (width / 2),
                    y: pageY
                });
            });
            setVisible(true);
        }
    };

    const handleMouseLeave = () => {
        if (Platform.OS === 'web') {
            setVisible(false);
        }
    };

    useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }).start();
        } else {
            fadeAnim.setValue(0);
        }
    }, [visible]);

    // Build activity info
    const getActivityText = () => {
        if (!riskData) return null;

        const { daysSinceWorkout, paymentDelayDays, riskLevel } = riskData;

        let lines = [];

        if (daysSinceWorkout !== null && daysSinceWorkout !== undefined) {
            if (daysSinceWorkout === 0) {
                lines.push({ icon: 'fitness', text: 'Entrenó hoy', color: '#10b981' });
            } else if (daysSinceWorkout === 1) {
                lines.push({ icon: 'fitness', text: 'Entrenó ayer', color: '#10b981' });
            } else if (daysSinceWorkout <= 3) {
                lines.push({ icon: 'fitness', text: `Entrenó hace ${daysSinceWorkout} días`, color: '#10b981' });
            } else if (daysSinceWorkout <= 6) {
                lines.push({ icon: 'warning', text: `Sin entrenar ${daysSinceWorkout} días`, color: '#f59e0b' });
            } else {
                lines.push({ icon: 'alert-circle', text: `Sin entrenar ${daysSinceWorkout} días`, color: '#ef4444' });
            }
        } else {
            lines.push({ icon: 'help-circle', text: 'Sin datos de entrenamiento', color: '#94a3b8' });
        }

        if (paymentDelayDays > 0) {
            lines.push({ icon: 'time', text: `Retraso de ${paymentDelayDays} día${paymentDelayDays > 1 ? 's' : ''}`, color: paymentDelayDays > 7 ? '#ef4444' : '#f59e0b' });
        } else {
            lines.push({ icon: 'checkmark-circle', text: 'Pagos al día', color: '#10b981' });
        }

        return lines;
    };

    const activityLines = getActivityText();

    // Determine status color for header
    const statusColors = {
        none: { bg: '#dcfce7', text: '#166534', label: 'Saludable' },
        medium: { bg: '#fef3c7', text: '#92400e', label: 'Atención' },
        high: { bg: '#fee2e2', text: '#991b1b', label: 'Riesgo' },
    };
    const statusStyle = statusColors[riskData?.riskLevel] || statusColors.none;

    // Tooltip content
    const tooltipContent = visible && activityLines ? (
        <Animated.View
            style={[
                styles.tooltip,
                {
                    opacity: fadeAnim,
                    position: 'fixed',
                    left: position.x - 90,
                    top: position.y - 95,
                },
            ]}
        >
            <View style={[styles.tooltipHeader, { backgroundColor: statusStyle.bg }]}>
                <Ionicons
                    name={riskData?.riskLevel === 'high' ? 'alert-circle' : riskData?.riskLevel === 'medium' ? 'warning' : 'checkmark-circle'}
                    size={14}
                    color={statusStyle.text}
                />
                <Text style={[styles.tooltipHeaderText, { color: statusStyle.text }]}>
                    {statusStyle.label}
                </Text>
            </View>
            {activityLines.map((line, idx) => (
                <View key={idx} style={styles.tooltipRow}>
                    <Ionicons name={line.icon} size={14} color={line.color} />
                    <Text style={styles.tooltipText}>{line.text}</Text>
                </View>
            ))}
            <View style={styles.tooltipArrowBottom} />
        </Animated.View>
    ) : null;

    return (
        <View
            ref={containerRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}

            {/* Render tooltip using Portal on web to escape stacking context */}
            {Platform.OS === 'web' && tooltipContent &&
                ReactDOM.createPortal(tooltipContent, document.body)
            }
        </View>
    );
}

const styles = StyleSheet.create({
    tooltip: {
        backgroundColor: '#fff',
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
        minWidth: 180,
        zIndex: 999999,
        overflow: 'hidden',
    },
    tooltipHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    tooltipHeaderText: {
        fontSize: 12,
        fontWeight: '600',
    },
    tooltipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    tooltipText: {
        fontSize: 12,
        color: '#334155',
    },
    tooltipArrowBottom: {
        position: 'absolute',
        bottom: -6,
        left: '50%',
        marginLeft: -6,
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 6,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#fff',
    },
});
