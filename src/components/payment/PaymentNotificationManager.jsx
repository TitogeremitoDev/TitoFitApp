import React from 'react';
import { View, StyleSheet } from 'react-native';
import { usePaymentStatus } from './usePaymentStatus';
import { PaymentToast } from './PaymentToast';
import { PaymentBottomSheet } from './PaymentBottomSheet';
import { PaymentBlockOverlay } from './PaymentBlockOverlay';

/**
 * PaymentNotificationManager
 * 
 * Orchestrates the 3-tier payment notification system.
 * Place this component in the root of your athlete screens (e.g., home.jsx)
 * 
 * It will automatically:
 * - Check payment status on mount
 * - Show appropriate notification level
 * - Handle all user interactions
 * 
 * The component is invisible when no action is needed (Level 0)
 */
export function PaymentNotificationManager({ children }) {
    const {
        level,
        status,
        isLoading,
        userName,
        coachName,
        daysUntilPayment,
        daysOverdue,
        amount,
        bizumPhone,
        isReporting,
        dismissToday,
        reportPayment,
        copyBizum,
        openWhatsApp
    } = usePaymentStatus();

    // Don't render anything while loading or if no action needed
    if (isLoading) {
        return <>{children}</>;
    }

    return (
        <View style={styles.container}>
            {/* Main Content */}
            {children}

            {/* Level 1-3: Toast Message (Upcoming, Today, Friendly Reminder) */}
            <PaymentToast
                visible={level >= 1 && level <= 3}
                level={level}
                userName={userName}
                daysUntil={daysUntilPayment}
                daysOverdue={daysOverdue}
                onDismiss={dismissToday}
            />

            {/* Level 4: Blocking Overlay (Aggressive > 5 days) */}
            <PaymentBlockOverlay
                visible={level === 4}
                isRejected={status === 'rejected'}
                daysOverdue={daysOverdue}
                amount={amount}
                coachName={coachName}
                bizumPhone={bizumPhone}
                onCopyBizum={copyBizum}
                onReportPayment={reportPayment}
                onOpenWhatsApp={openWhatsApp}
                isReporting={isReporting}
                onDismiss={dismissToday}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});

export default PaymentNotificationManager;
