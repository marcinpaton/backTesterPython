import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, Dimensions, StyleSheet } from 'react-native';
import { Circle, G, Rect } from 'react-native-svg';
import { LineChart } from 'react-native-chart-kit';

const PX_PER_POINT = 14;
const SCREEN_CARD_WIDTH = Dimensions.get('window').width - 60;
const AXIS_WIDTH = 58; // visible width of the pinned Y axis
const CHART_HEIGHT = 220;

const YtdChart = ({ data }) => {
    const scrollRef = useRef(null);
    const [selectedIndex, setSelectedIndex] = useState(null);

    if (!data || data.length < 2) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>YTD Return (%)</Text>
                <Text style={styles.noDataText}>No YTD data available</Text>
            </View>
        );
    }

    const values = data.map(d => d.ytd * 100);
    const last = values[values.length - 1];
    const lineColor = last >= 0 ? '22, 163, 74' : '220, 38, 38';

    // Label roughly every 15th point as d/m
    const labels = data.map((d, i) => {
        if (i % 15 !== 0) return '';
        const [, m, day] = d.date.split('-');
        return `${parseInt(day, 10)}/${parseInt(m, 10)}`;
    });

    const chartWidth = Math.max(SCREEN_CARD_WIDTH, data.length * PX_PER_POINT);

    const selected = selectedIndex != null ? data[selectedIndex] : null;
    const selectedPct = selected ? selected.ytd * 100 : null;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>YTD Return (%)</Text>
            <View style={styles.infoRow}>
                {selected ? (
                    <>
                        <Text style={styles.infoDate}>{selected.date}</Text>
                        <Text style={[styles.infoValue, { color: selectedPct >= 0 ? '#16a34a' : '#dc2626' }]}>
                            {selectedPct >= 0 ? '+' : ''}{selectedPct.toFixed(2)}%
                        </Text>
                    </>
                ) : (
                    <Text style={styles.infoHint}>Tap the chart to see exact value</Text>
                )}
            </View>
            <View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    ref={scrollRef}
                    onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
                >
                    <LineChart
                        data={{ labels, datasets: [{ data: values }] }}
                        width={chartWidth}
                        height={CHART_HEIGHT}
                        yAxisSuffix="%"
                        withDots={true}
                        withInnerLines={true}
                        withVerticalLines={false}
                        chartConfig={{
                            backgroundColor: '#ffffff',
                            backgroundGradientFrom: '#ffffff',
                            backgroundGradientTo: '#ffffff',
                            decimalPlaces: 1,
                            color: (opacity = 1) => `rgba(${lineColor}, ${opacity})`,
                            labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                            propsForBackgroundLines: { stroke: '#e5e7eb' },
                            propsForDots: { r: '0' }, // hide default dots; we draw our own marker
                        }}
                        renderDotContent={({ x, y, index }) => (
                            <G key={index}>
                                {index === selectedIndex && (
                                    <Circle cx={x} cy={y} r={5} fill={`rgb(${lineColor})`} stroke="#ffffff" strokeWidth={2} />
                                )}
                                {/* Full-height transparent hit area for easy tapping */}
                                <Rect
                                    x={x - PX_PER_POINT / 2}
                                    y={0}
                                    width={PX_PER_POINT}
                                    height={CHART_HEIGHT}
                                    fill="transparent"
                                    onPress={() => setSelectedIndex(index)}
                                />
                            </G>
                        )}
                        style={{ marginVertical: 8, borderRadius: 16 }}
                    />
                </ScrollView>

                {/* Pinned Y axis: same data and height => identical scale, but only labels are drawn */}
                <View pointerEvents="none" style={styles.stickyAxis}>
                    <LineChart
                        data={{ labels: values.map(() => ''), datasets: [{ data: values }] }}
                        width={120}
                        height={CHART_HEIGHT}
                        yAxisSuffix="%"
                        withDots={false}
                        withInnerLines={false}
                        withOuterLines={false}
                        withVerticalLines={false}
                        withHorizontalLines={false}
                        withShadow={false}
                        chartConfig={{
                            backgroundColor: '#ffffff',
                            backgroundGradientFrom: '#ffffff',
                            backgroundGradientTo: '#ffffff',
                            decimalPlaces: 1,
                            color: () => 'rgba(0, 0, 0, 0)',
                            labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                        }}
                        style={{ marginVertical: 8, borderRadius: 16 }}
                    />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 20,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 6,
        color: '#374151',
        textAlign: 'center',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'baseline',
        height: 28,
    },
    infoDate: {
        fontSize: 13,
        color: '#6b7280',
        marginRight: 8,
    },
    infoValue: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    infoHint: {
        fontSize: 12,
        color: '#9ca3af',
    },
    stickyAxis: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: AXIS_WIDTH,
        overflow: 'hidden',
        backgroundColor: '#ffffff',
    },
    noDataText: {
        textAlign: 'center',
        color: '#9ca3af',
        padding: 20,
    },
});

export default YtdChart;
