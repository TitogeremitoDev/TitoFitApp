import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface FeedItem {
    id: number;
    type: string;
    msg: string;
    ts: string;
}

interface FeedProps {
    data: FeedItem[];
}

export default function SimpleLogFeed({ data }: FeedProps) {
    const getColor = (type: string) => {
        switch (type) {
            case 'ALERT': return 'red';
            case 'SUCCESS': return 'green';
            case 'INFO': return '#3498db';
            default: return '#aaa';
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>System Logs / Activity Feed</Text>
            {data.map((item) => (
                <View key={item.id} style={styles.row}>
                    <Text style={styles.time}>{item.ts}</Text>
                    <Text style={[styles.type, { color: getColor(item.type) }]}>{item.type}</Text>
                    <Text style={styles.msg}>{item.msg}</Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#1a1a1a',
        padding: 10,
        borderTopWidth: 1,
        borderTopColor: '#333',
    },
    title: {
        color: '#fff',
        fontSize: 16,
        marginBottom: 10,
        fontWeight: 'bold',
    },
    row: {
        flexDirection: 'row',
        marginBottom: 8,
        paddingBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    time: {
        color: '#666',
        width: 80,
        fontSize: 12,
        fontFamily: 'monospace',
    },
    type: {
        width: 80,
        fontSize: 12,
        fontWeight: 'bold',
    },
    msg: {
        color: '#ccc',
        flex: 1,
        fontSize: 13,
    }
});
