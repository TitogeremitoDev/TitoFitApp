import React from 'react';
import { View, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AdminSidebar from './components/AdminSidebar';
import DashboardDataView from './components/DashboardDataView';

export default function AdminDashboard() {
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <View style={styles.layout}>
                {/* Sidebar - Always visible on larger screens, could be hidden on tiny mobile but prioritized for now */}
                {/* For this "Dev Mode", we keep it simple side-by-side or stacked depending on width, 
                    but flex direction row usually fits landscape or tablet nicely. 
                    For mobile portrait, it might be cramped, but per instructions we prioritize speed/data. */}
                <AdminSidebar />
                <DashboardDataView />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111',
        paddingTop: Platform.OS === 'android' ? 30 : 0,
    },
    layout: {
        flex: 1,
        flexDirection: 'row', // Main layout strategy
    },
});
