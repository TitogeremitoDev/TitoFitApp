import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';

export default function DevActions() {
    const handleAction = (action: string) => {
        Alert.alert("Dev Action", `Triggered: ${action}`);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>DEV QUICK ACTIONS:</Text>
            <View style={styles.row}>
                <TouchableOpacity style={styles.btn} onPress={() => handleAction('Create Random User')}>
                    <Text style={styles.btnText}>+ User</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnErr]} onPress={() => handleAction('Force Error')}>
                    <Text style={styles.btnText}>! Error</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnPay]} onPress={() => handleAction('Simulate Payment')}>
                    <Text style={styles.btnText}>$ Payment</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 10,
        backgroundColor: '#222',
        marginBottom: 20,
    },
    label: {
        color: 'yellow',
        fontSize: 10,
        marginBottom: 5,
    },
    row: {
        flexDirection: 'row',
        gap: 10,
    },
    btn: {
        backgroundColor: '#444',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 4,
    },
    btnErr: { backgroundColor: '#700' },
    btnPay: { backgroundColor: '#060' },
    btnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    }
});
