import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

interface AttendanceChartProps {
    present: number;
    absent: number;
    unmarked: number;
}

const RADIUS = 100;
const STROKE_WIDTH = 40;
const CX = 150;
const CY = 140; // Center Y is lower so we see the top half

const COLORS = {
    present: '#4CAF50',
    absent: '#F44336',
    unmarked: '#757575',
};

const getCoordinates = (percent: number) => {
    // -PI (left) to 0 (right)
    const angle = Math.PI * (percent - 1);
    const x = CX + RADIUS * Math.cos(angle);
    const y = CY + RADIUS * Math.sin(angle);
    return { x, y };
};

export default function AttendanceChart({ present, absent, unmarked }: AttendanceChartProps) {
    const total = present + absent + unmarked;

    // If no data avoid dividing by zero
    const hasData = total > 0;

    // Calculate percentages
    // Order: Present -> Absent -> Unmarked (Left to Right)
    // Or whatever order looks best. Present usually first.

    const data = [
        { key: 'present', value: present, color: COLORS.present, label: 'Present' },
        { key: 'absent', value: absent, color: COLORS.absent, label: 'Absent' },
        { key: 'unmarked', value: unmarked, color: COLORS.unmarked, label: '' },
    ];

    let startPercent = 0;

    const paths = data.map((item) => {
        if (!hasData) return null;
        if (item.value === 0) return null;

        const percent = item.value / total;
        const endPercent = startPercent + percent;

        const startCoords = getCoordinates(startPercent);
        const endCoords = getCoordinates(endPercent);

        // Since the total chart is a semi-circle (180 degrees or PI radians),
        // no single segment can exceed 180 degrees unless it's > 100% (impossible).
        // Therefore, largeArcFlag is always 0.
        const largeArcFlag = 0;

        // M startX startY A radius radius 0 largeArcFlag 1 endX endY
        // Sweep flag is 1 for clockwise
        const d = `M ${startCoords.x} ${startCoords.y} A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${endCoords.x} ${endCoords.y}`;

        startPercent = endPercent;

        return (
            <Path
                key={item.key}
                d={d}
                stroke={item.color}
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeLinecap="butt"
            />
        );
    });

    const emptyPath = !hasData ? (
        <Path
            d={`M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`}
            stroke="#333"
            strokeWidth={STROKE_WIDTH}
            fill="none"
        />
    ) : null;

    return (
        <View style={styles.container}>
            <View style={styles.chartContainer}>
                <Svg height={160} width={300}>
                    <G>
                        {emptyPath}
                        {paths}
                    </G>
                </Svg>
                <View style={styles.totalContainer}>
                    <Text style={styles.totalText}>{total}</Text>
                    <Text style={styles.totalLabel}>Total</Text>
                </View>
            </View>

            <View style={styles.legendContainer}>
                {data.map((item) => (
                    item.label ? ( // only render if there's a label
                        <View key={item.key} style={styles.legendItem}>
                            <View style={[styles.dot, { backgroundColor: item.color }]} />
                            <Text style={styles.legendText}>{item.label}: {item.value}</Text>
                        </View>
                    ) : null
                ))}
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginVertical: 20,
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        padding: 16,
    },
    chartContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 160,
        overflow: 'hidden', // Cut off the bottom half of padding if any
    },
    totalContainer: {
        position: 'absolute',
        bottom: 0,
        alignItems: 'center',
    },
    totalText: {
        color: '#FFFFFF',
        fontSize: 32,
        fontWeight: 'bold',
        lineHeight: 36,
    },
    totalLabel: {
        color: '#AAAAAA',
        fontSize: 14,
    },
    legendContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginTop: 10,
        gap: 16,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 6,
    },
    legendText: {
        color: '#E0E0E0',
        fontSize: 14,
        fontWeight: '500',
    },
});
