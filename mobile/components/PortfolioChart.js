import React from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import { Circle, G, Rect } from 'react-native-svg';
import { LineChart } from 'react-native-chart-kit';

const PortfolioChart = ({ data, onPointClick }) => {
    if (!data || data.length === 0) {
        return (
            <View style={styles.container}>
                <Text style={styles.noDataText}>No chart data available</Text>
            </View>
        );
    }

    // Sample down data if too many points (ChartKit can be slow with > 50 points)
    const chartData = data.length > 30
        ? data.filter((_, i) => i % Math.ceil(data.length / 30) === 0)
        : data;

    const labels = chartData.map(d => {
        const date = new Date(d.date);
        return `${date.getDate()}/${date.getMonth() + 1}`;
    });

    const values = chartData.map(d => d.total_value);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Portfolio Value (PLN)</Text>
            <LineChart
                data={{
                    labels: labels,
                    datasets: [
                        {
                            data: values
                        }
                    ]
                }}
                width={Dimensions.get("window").width - 40} // from react-native
                height={220}
                yAxisLabel=""
                yAxisSuffix=" zł"
                yAxisInterval={1} // optional, defaults to 1
                onDataPointClick={({ index }) => {
                    if (onPointClick) onPointClick(index);
                }}
                chartConfig={{
                    backgroundColor: "#ffffff",
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    decimalPlaces: 0, // optional, defaults to 2dp
                    color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`, // Blue color
                    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                    style: {
                        borderRadius: 16
                    },
                    propsForDots: {
                        r: "6",
                        strokeWidth: "2",
                        stroke: "#2563eb"
                    }
                }}
                renderDotContent={({ x, y, index, indexData }) => (
                    <G key={index}>
                        <Circle
                            cx={x}
                            cy={y}
                            r={6}
                            stroke="#2563eb"
                            strokeWidth={2}
                            fill="#2563eb"
                        />
                        <Rect
                            x={x - 24}
                            y={y - 24}
                            width={48}
                            height={48}
                            fill="transparent"
                            onPress={() => onPointClick && onPointClick(index)}
                        />
                    </G>
                )}
                bezier
                style={{
                    marginVertical: 8,
                    borderRadius: 16
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 10,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 10,
        elevation: 2, // Android shadow
        shadowColor: '#000', // iOS shadow
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#374151',
        textAlign: 'center'
    },
    noDataText: {
        textAlign: 'center',
        color: '#9ca3af',
        padding: 20
    }
});

export default PortfolioChart;
