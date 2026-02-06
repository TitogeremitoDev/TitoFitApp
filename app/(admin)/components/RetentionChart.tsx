import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

interface ChartProps {
    data: {
        labels: string[];
        new_users: number[];
        churned_users: number[];
    };
}

export default function RetentionChart({ data }: ChartProps) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Acquisition vs Churn (Last 4 Weeks)</Text>
            <LineChart
                data={{
                    labels: data.labels,
                    datasets: [
                        {
                            data: data.new_users,
                            color: (opacity = 1) => `rgba(0, 255, 0, ${opacity})`, // Green for new users
                            strokeWidth: 2
                        },
                        {
                            data: data.churned_users,
                            color: (opacity = 1) => `rgba(255, 0, 0, ${opacity})`, // Red for churn
                            strokeWidth: 2
                        }
                    ],
                    legend: ["New Users", "Churned"]
                }}
                width={Dimensions.get("window").width > 600 ? Dimensions.get("window").width - 300 : Dimensions.get("window").width - 40} // Adjust width based on sidebar
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                yAxisInterval={1}
                chartConfig={{
                    backgroundColor: "#1e1e1e",
                    backgroundGradientFrom: "#1e1e1e",
                    backgroundGradientTo: "#1e1e1e",
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    style: {
                        borderRadius: 16
                    },
                    propsForDots: {
                        r: "6",
                        strokeWidth: "2",
                        stroke: "#ffa726"
                    }
                }}
                bezier
                style={{
                    marginVertical: 8,
                    borderRadius: 16
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#222',
        padding: 10,
        marginBottom: 20,
        borderRadius: 8,
    },
    title: {
        color: '#fff',
        marginBottom: 10,
        fontWeight: 'bold',
    },
});
