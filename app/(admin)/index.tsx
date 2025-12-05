import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

const MENU_ITEMS = [
    {
        id: 'clients',
        title: 'Clientes',
        icon: 'users',
        iconType: 'FontAwesome5',
        route: '/(admin)/clients',
        color: ['#4facfe', '#00f2fe']
    },
    {
        id: 'plans',
        title: 'Planes',
        icon: 'card-membership',
        iconType: 'MaterialIcons',
        route: '/(admin)/plans',
        color: ['#43e97b', '#38f9d7']
    },
    {
        id: 'finances',
        title: 'Finanzas',
        icon: 'attach-money',
        iconType: 'MaterialIcons',
        route: '/(admin)/finances',
        color: ['#fa709a', '#fee140']
    },

    {
        id: 'nutrition',
        title: 'Nutrición',
        icon: 'carrot',
        iconType: 'FontAwesome5',
        route: '/(admin)/nutrition',
        color: ['#ff9a9e', '#fecfef']
    },
    {
        id: 'analytics',
        title: 'Analíticas',
        icon: 'analytics',
        iconType: 'MaterialIcons',
        route: '/(admin)/analytics',
        color: ['#fbc2eb', '#a6c1ee']
    },
    {
        id: 'marketing',
        title: 'Marketing',
        icon: 'bullhorn',
        iconType: 'FontAwesome5',
        route: '/(admin)/marketing',
        color: ['#84fab0', '#8fd3f4']
    },
    {
        id: 'content',
        title: 'Contenido',
        icon: 'folder-open',
        iconType: 'FontAwesome5',
        route: '/(admin)/content',
        color: ['#a18cd1', '#fbc2eb']
    },
    {
        id: 'exercises',
        title: 'BD Ejercicios',
        icon: 'dumbbell',
        iconType: 'FontAwesome5',
        route: '/(admin)/exercises',
        color: ['#667eea', '#764ba2']
    },
    {
        id: 'settings',
        title: 'Ajustes',
        icon: 'settings',
        iconType: 'Ionicons',
        route: '/(admin)/settings',
        color: ['#cfd9df', '#e2ebf0']
    },
];

export default function AdminDashboard() {
    const router = useRouter();

    const renderIcon = (item: any) => {
        if (item.iconType === 'Ionicons') {
            return <Ionicons name={item.icon as any} size={32} color="#fff" />;
        } else if (item.iconType === 'MaterialIcons') {
            return <MaterialIcons name={item.icon as any} size={32} color="#fff" />;
        } else if (item.iconType === 'FontAwesome5') {
            return <FontAwesome5 name={item.icon as any} size={28} color="#fff" />;
        }
        return null;
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient
                colors={['#1a1a1a', '#2d2d2d']}
                style={styles.header}
            >
                <Text style={styles.headerTitle}>Panel de Administración</Text>
                <Text style={styles.headerSubtitle}>TotalGains</Text>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.grid}>
                    {MENU_ITEMS.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.cardContainer}
                            onPress={() => router.push(item.route as any)}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={item.color as [string, string]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.card}
                            >
                                <View style={styles.iconContainer}>
                                    {renderIcon(item)}
                                </View>
                                <Text style={styles.cardTitle}>{item.title}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    header: {
        paddingTop: 60,
        paddingBottom: 30,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        marginBottom: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3.84,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 5,
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#aaa',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
    },
    cardContainer: {
        width: (width - 45) / 2,
        height: 140,
        marginBottom: 15,
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.22,
        shadowRadius: 2.22,
    },
    card: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 15,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        textAlign: 'center',
    },
});
