import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Platform, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Polyline, Line, Rect } from 'react-native-svg';
import { colors } from '../theme';
import {
  ecgSimulator,
  LEAD_NAMES,
  SAMPLE_RATE,
  type LeadName,
  type MultiLeadSample,
} from '../services/ecgSimulator';

const SCREEN_WIDTH = Dimensions.get('window').width;
const VISIBLE_SECONDS = 4;
const MAX_POINTS = VISIBLE_SECONDS * SAMPLE_RATE;

// Lead colors per clinical convention
const LEAD_COLORS: Record<LeadName, string> = {
  I: '#10B981', II: '#10B981', III: '#10B981',
  aVR: '#F59E0B', aVL: '#F59E0B', aVF: '#F59E0B',
  V1: '#06B6D4', V2: '#06B6D4', V3: '#06B6D4',
  V4: '#8B5CF6', V5: '#8B5CF6', V6: '#8B5CF6',
};

// Group labels
const LEAD_GROUPS = [
  { label: 'Extremidades', leads: ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'] as LeadName[] },
  { label: 'Precordiales', leads: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'] as LeadName[] },
];

interface ECGWaveformProps {
  isActive: boolean;
  onDataReceived?: (samples: MultiLeadSample[]) => void;
}

/** Single lead strip renderer */
const LeadStrip: React.FC<{
  leadName: LeadName;
  buffer: number[];
  width: number;
  height: number;
  onPress?: () => void;
  compact?: boolean;
}> = React.memo(({ leadName, buffer, width, height, onPress, compact }) => {
  const step = width / MAX_POINTS;
  const midY = height / 2;
  const scale = height * 0.38;

  let pts = '';
  if (buffer?.length > 0) {
    const arr: string[] = [];
    for (let i = 0; i < buffer.length; i++) {
      arr.push(`${(i * step).toFixed(1)},${(midY - (buffer[i] ?? 0) * scale).toFixed(1)}`);
    }
    pts = arr.join(' ');
  }

  const gridLinesH: number[] = [];
  const gridLinesV: number[] = [];
  const gridH = height / 4;
  const gridV = width / (compact ? 8 : 16);
  for (let i = 1; i < 4; i++) gridLinesH.push(i * gridH);
  for (let i = 1; i < (compact ? 8 : 16); i++) gridLinesV.push(i * gridV);

  const content = (
    <View style={[leadStyles.strip, { width, height: height + 20 }]}>
      <Text style={leadStyles.label}>{leadName}</Text>
      <Svg width={width} height={height}>
        <Rect x={0} y={0} width={width} height={height} fill="#0D1117" />
        {gridLinesH.map((y, i) => (
          <Line key={`h${i}`} x1={0} y1={y} x2={width} y2={y}
            stroke="rgba(16,185,129,0.06)" strokeWidth={0.5} />
        ))}
        {gridLinesV.map((x, i) => (
          <Line key={`v${i}`} x1={x} y1={0} x2={x} y2={height}
            stroke="rgba(16,185,129,0.06)" strokeWidth={0.5} />
        ))}
        <Line x1={0} y1={midY} x2={width} y2={midY}
          stroke="rgba(16,185,129,0.12)" strokeWidth={0.5} />
        {pts.length > 0 && (
          <Polyline points={pts} fill="none"
            stroke={LEAD_COLORS[leadName]}
            strokeWidth={Platform.OS === 'web' ? 1.2 : 1.5}
            strokeLinejoin="round" strokeLinecap="round" />
        )}
      </Svg>
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
});

/** Full 12-lead grid + single-lead zoom */
export const ECGMultiLead: React.FC<ECGWaveformProps> = ({ isActive, onDataReceived }) => {
  const buffersRef = useRef<Record<LeadName, number[]>>(
    Object.fromEntries(LEAD_NAMES.map((n) => [n, []])) as unknown as Record<LeadName, number[]>
  );
  const [tick, setTick] = useState(0);
  const [selectedLead, setSelectedLead] = useState<LeadName | null>(null);
  const frameRef = useRef<number | null>(null);
  const padding = 16;
  const chartWidth = SCREEN_WIDTH - padding * 2;

  const addData = useCallback((samples: MultiLeadSample[]) => {
    for (const s of samples) {
      for (const name of LEAD_NAMES) {
        const buf = buffersRef.current[name];
        buf.push(s.leads[name] ?? 0);
        if (buf.length > MAX_POINTS) {
          buffersRef.current[name] = buf.slice(buf.length - MAX_POINTS);
        }
      }
    }
    onDataReceived?.(samples);
  }, [onDataReceived]);

  useEffect(() => {
    if (!isActive) {
      if (frameRef.current) { cancelAnimationFrame(frameRef.current); frameRef.current = null; }
      return;
    }
    const unsub = ecgSimulator.onData(addData);
    ecgSimulator.start();

    const animate = () => {
      setTick((t) => t + 1);
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      unsub();
      ecgSimulator.stop();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isActive, addData]);

  // Single lead zoom view
  if (selectedLead) {
    return (
      <View style={leadStyles.container}>
        <Pressable onPress={() => setSelectedLead(null)} style={leadStyles.backBtn}>
          <Text style={leadStyles.backText}>← Todas las derivaciones</Text>
        </Pressable>
        <Text style={leadStyles.zoomTitle}>{selectedLead}</Text>
        <LeadStrip
          leadName={selectedLead}
          buffer={buffersRef.current[selectedLead] ?? []}
          width={chartWidth}
          height={200}
        />
      </View>
    );
  }

  // 12-lead grid — 2 columns × 6 rows, grouped
  const colWidth = (chartWidth - 8) / 2;
  const rowHeight = 55;

  return (
    <View style={leadStyles.container}>
      {LEAD_GROUPS.map((group) => (
        <View key={group.label}>
          <Text style={leadStyles.groupLabel}>{group.label}</Text>
          <View style={leadStyles.grid}>
            {group.leads.map((name) => (
              <LeadStrip
                key={name}
                leadName={name}
                buffer={buffersRef.current[name] ?? []}
                width={colWidth}
                height={rowHeight}
                onPress={() => setSelectedLead(name)}
                compact
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
};

/** Legacy single-lead waveform (Lead II) */
export const ECGWaveform: React.FC<ECGWaveformProps> = ({ isActive, onDataReceived }) => {
  const [points, setPoints] = useState<string>('');
  const bufferRef = useRef<number[]>([]);
  const frameRef = useRef<number | null>(null);
  const chartWidth = SCREEN_WIDTH - 32;
  const CHART_HEIGHT = 200;

  const updateChart = useCallback(() => {
    const buffer = bufferRef.current;
    if (buffer.length === 0) return;
    const step = chartWidth / MAX_POINTS;
    const midY = CHART_HEIGHT / 2;
    const scale = CHART_HEIGHT * 0.35;
    const pts = buffer.map((val, i) => `${(i * step).toFixed(1)},${(midY - val * scale).toFixed(1)}`).join(' ');
    setPoints(pts);
  }, [chartWidth]);

  const addData = useCallback((samples: MultiLeadSample[]) => {
    const buffer = bufferRef.current;
    for (const s of samples) {
      buffer.push(s.leads?.['II'] ?? 0);
    }
    if (buffer.length > MAX_POINTS) {
      bufferRef.current = buffer.slice(buffer.length - MAX_POINTS);
    }
    // Convert to legacy format for BPM callback
    onDataReceived?.(samples);
  }, [onDataReceived]);

  useEffect(() => {
    if (!isActive) {
      if (frameRef.current) { cancelAnimationFrame(frameRef.current); frameRef.current = null; }
      return;
    }
    const unsub = ecgSimulator.onData(addData);
    ecgSimulator.start();
    const animate = () => { updateChart(); frameRef.current = requestAnimationFrame(animate); };
    frameRef.current = requestAnimationFrame(animate);
    return () => {
      unsub(); ecgSimulator.stop();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isActive, addData, updateChart]);

  const gridLinesH: number[] = [];
  const gridLinesV: number[] = [];
  const gridSpacingH = CHART_HEIGHT / 8;
  const gridSpacingV = chartWidth / 20;
  for (let i = 1; i < 8; i++) gridLinesH.push(i * gridSpacingH);
  for (let i = 1; i < 20; i++) gridLinesV.push(i * gridSpacingV);

  return (
    <View style={singleStyles.container}>
      <Svg width={chartWidth} height={CHART_HEIGHT} style={singleStyles.svg}>
        <Rect x={0} y={0} width={chartWidth} height={CHART_HEIGHT} fill="#0D1117" rx={8} />
        {gridLinesH.map((y, i) => (
          <Line key={`h-${i}`} x1={0} y1={y} x2={chartWidth} y2={y}
            stroke="rgba(16,185,129,0.08)" strokeWidth={0.5} />
        ))}
        {gridLinesV.map((x, i) => (
          <Line key={`v-${i}`} x1={x} y1={0} x2={x} y2={CHART_HEIGHT}
            stroke="rgba(16,185,129,0.08)" strokeWidth={0.5} />
        ))}
        <Line x1={0} y1={CHART_HEIGHT / 2} x2={chartWidth} y2={CHART_HEIGHT / 2}
          stroke="rgba(16,185,129,0.15)" strokeWidth={1} />
        {points.length > 0 && (
          <Polyline points={points} fill="none" stroke="#10B981"
            strokeWidth={Platform.OS === 'web' ? 1.5 : 2}
            strokeLinejoin="round" strokeLinecap="round" />
        )}
      </Svg>
    </View>
  );
};

const leadStyles = StyleSheet.create({
  container: { marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  strip: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.1)',
    marginBottom: 4,
  },
  label: {
    position: 'absolute',
    top: 2,
    left: 6,
    zIndex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(16,185,129,0.7)',
    letterSpacing: 0.5,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
    marginTop: 8,
  },
  backBtn: { paddingVertical: 8 },
  backText: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  zoomTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 8,
  },
});

const singleStyles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.15)',
  },
  svg: { backgroundColor: '#0D1117' },
});
