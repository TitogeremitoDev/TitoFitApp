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

            {/* Level 1: Toast Banner (2 days before) */}
            <PaymentToast
                visible={level === 1}
                userName={userName}
                daysUntil={daysUntilPayment}
                onDismiss={dismissToday}
            />

            {/* Level 2: Bottom Sheet (Day of payment) */}
            <PaymentBottomSheet
                visible={level === 2}
                amount={amount}
                bizumPhone={bizumPhone}
                onCopyBizum={copyBizum}
                onReportPayment={reportPayment}
                onDismiss={dismissToday}
                isReporting={isReporting}
            />

            {/* Level 3: Blocking Overlay (Overdue/Rejected) */}
            <PaymentBlockOverlay
                visible={level === 3}
                isRejected={status === 'rejected'}
                daysOverdue={daysOverdue}
                amount={amount}
                coachName={coachName}
                bizumPhone={bizumPhone}
                onCopyBizum={copyBizum}
                onReportPayment={reportPayment}
                onOpenWhatsApp={openWhatsApp}
                isReporting={isReporting}
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
