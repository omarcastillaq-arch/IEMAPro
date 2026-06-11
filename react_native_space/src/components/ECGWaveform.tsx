import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import Svg, { Polyline, Line, Rect } from 'react-native-svg';
import { colors } from '../theme';
import type { ECGDataPoint } from '../services/ecgSimulator';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_HEIGHT = 200;
const VISIBLE_SECONDS = 4;
const SAMPLE_RATE = 250;
const MAX_POINTS = VISIBLE_SECONDS * SAMPLE_RATE;

interface ECGWaveformProps {
  isActive: boolean;
  onDataReceived?: (points: ECGDataPoint[]) => void;
}

export const ECGWaveform: React.FC<ECGWaveformProps> = ({ isActive, onDataReceived }) => {
  const [points, setPoints] = useState<string>('');
  const bufferRef = useRef<number[]>([]);
  const frameRef = useRef<number | null>(null);
  const chartWidth = SCREEN_WIDTH - 32;

  const updateChart = useCallback(() => {
    const buffer = bufferRef.current;
    if (buffer.length === 0) return;

    const step = chartWidth / MAX_POINTS;
    const midY = CHART_HEIGHT / 2;
    const scale = CHART_HEIGHT * 0.35;

    const pts = buffer
      .map((val, i) => {
        const x = i * step;
        const y = midY - val * scale;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    setPoints(pts);
  }, [chartWidth]);

  const addData = useCallback(
    (newPoints: ECGDataPoint[]) => {
      const buffer = bufferRef.current;
      for (const p of newPoints) {
        buffer.push(p.value);
      }
      // Keep only last MAX_POINTS
      if (buffer.length > MAX_POINTS) {
        bufferRef.current = buffer.slice(buffer.length - MAX_POINTS);
      }
      onDataReceived?.(newPoints);
    },
    [onDataReceived],
  );

  useEffect(() => {
    if (!isActive) {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return;
    }

    // Import simulator dynamically
    const { ecgSimulator } = require('../services/ecgSimulator');

    const unsub = ecgSimulator.onData((data: ECGDataPoint[]) => {
      addData(data);
    });

    ecgSimulator.start();

    // Animation loop for rendering
    const animate = () => {
      updateChart();
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      unsub();
      ecgSimulator.stop();
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [isActive, addData, updateChart]);

  // Generate grid lines
  const gridLinesH: number[] = [];
  const gridLinesV: number[] = [];
  const gridSpacingH = CHART_HEIGHT / 8;
  const gridSpacingV = chartWidth / 20;

  for (let i = 1; i < 8; i++) gridLinesH.push(i * gridSpacingH);
  for (let i = 1; i < 20; i++) gridLinesV.push(i * gridSpacingV);

  return (
    <View style={styles.container}>
      <Svg width={chartWidth} height={CHART_HEIGHT} style={styles.svg}>
        {/* Background */}
        <Rect x={0} y={0} width={chartWidth} height={CHART_HEIGHT} fill="#0D1117" rx={8} />

        {/* Grid */}
        {gridLinesH.map((y, i) => (
          <Line
            key={`h-${i}`}
            x1={0}
            y1={y}
            x2={chartWidth}
            y2={y}
            stroke="rgba(16, 185, 129, 0.08)"
            strokeWidth={0.5}
          />
        ))}
        {gridLinesV.map((x, i) => (
          <Line
            key={`v-${i}`}
            x1={x}
            y1={0}
            x2={x}
            y2={CHART_HEIGHT}
            stroke="rgba(16, 185, 129, 0.08)"
            strokeWidth={0.5}
          />
        ))}

        {/* Center line */}
        <Line
          x1={0}
          y1={CHART_HEIGHT / 2}
          x2={chartWidth}
          y2={CHART_HEIGHT / 2}
          stroke="rgba(16, 185, 129, 0.15)"
          strokeWidth={1}
        />

        {/* ECG Waveform */}
        {points.length > 0 && (
          <Polyline
            points={points}
            fill="none"
            stroke="#10B981"
            strokeWidth={Platform.OS === 'web' ? 1.5 : 2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)',
  },
  svg: {
    backgroundColor: '#0D1117',
  },
});
