import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const MENU_ITEMS = [
    { title: 'Home', route: '/(admin)', icon: 'home' },
    { title: 'Clientes', route: '/(admin)/clients', icon: 'people' },
    { title: 'Planes', route: '/(admin)/plans', icon: 'book' },
    { title: 'Nutrición', route: '/(admin)/nutrition', icon: 'restaurant' },
    { title: 'Finanzas', route: '/(admin)/finances', icon: 'cash' },
    { title: 'Marketing', route: '/(admin)/marketing', icon: 'megaphone' },
    { title: 'Contenido', route: '/(admin)/content', icon: 'folder' },
    { title: 'Ejercicios', route: '/(admin)/exercises', icon: 'barbell' },
    { title: 'Ajustes', route: '/(admin)/settings', icon: 'settings' },
];

export default function AdminSidebar() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <Text style={styles.header}>ADMIN</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
                {MENU_ITEMS.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.item}
                        onPress={() => router.push(item.route as any)}
                    >
                        <Ionicons name={item.icon as any} size={20} color="#fff" style={{ marginRight: 10 }} />
                        <Text style={styles.text}>{item.title}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 200,
        backgroundColor: '#222',
        paddingVertical: 20,
        paddingHorizontal: 10,
        borderRightWidth: 1,
        borderRightColor: '#444',
    },
    header: {
        color: 'gold',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    text: {
        color: '#eee',
        fontSize: 14,
    }
});
