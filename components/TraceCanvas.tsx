/**
 * The tracing play area.
 *
 * Visual language follows the familiar "trace the character with a buddy"
 * preschool apps: a dark teal character with a white outline, white checkpoint
 * dots, a purple patterned fill that grows exactly along the guide line, a bee
 * that follows the child's finger, and a beehive waiting at the end of the
 * current stroke.
 *
 * All game rules (which dots count, coverage, undo, haptics, reward) stay in
 * the screen — this component only draws what the screen tells it to draw.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, Pattern, Rect } from 'react-native-svg';
import type { HitPoint } from '../constants/traceableData';

const VIEW_W = 400;
const VIEW_H = 600;
const LETTER_WIDTH = 88;
const OUTLINE_WIDTH = 100;

export type TraceCanvasProps = {
  width: number;
  height: number;
  path: string;
  points: HitPoint[];
  /** Each entry is a smooth SVG path along the guide line that has been covered. */
  fillPaths: string[];
  hitIds: number[];
  isFinished: boolean;
  isOnPath: boolean;
  /** Finger position in viewBox coordinates — the bee rides here. */
  beePos: { x: number; y: number };
  panHandlers: any;
};

const r = (n: number) => Math.round(n * 10) / 10;

export default function TraceCanvas({
  width,
  height,
  path,
  points,
  fillPaths,
  hitIds,
  isFinished,
  isOnPath,
  beePos,
  panHandlers,
}: TraceCanvasProps) {
  // The first dot still waiting to be reached tells us which stroke the child
  // is on; the hive waits at that stroke's last checkpoint.
  const nextPoint = points.find((point) => !hitIds.includes(point.id));
  const hivePoint = nextPoint
    ? [...points].reverse().find((point) => point.strokeId === nextPoint.strokeId) ?? nextPoint
    : points[points.length - 1];

  const beeX = (beePos.x / VIEW_W) * width;
  const beeY = (beePos.y / VIEW_H) * height;

  return (
    <View style={[{ width, height }, styles.wrapper]} {...panHandlers}>
      <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={styles.svg}>
        <Defs>
          <Pattern
            id="traceSwirl"
            width={30}
            height={30}
            patternUnits="userSpaceOnUse"
          >
            <Rect width={30} height={30} fill="#4B32C3" />
            <Circle cx={15} cy={15} r={8} fill="none" stroke="#7660E5" strokeWidth={4} />
            <Circle cx={0} cy={0} r={3} fill="#7660E5" />
            <Circle cx={30} cy={30} r={3} fill="#7660E5" />
          </Pattern>
        </Defs>

        {/* Soft park backdrop */}
        <Rect width={VIEW_W} height={VIEW_H} fill="#A8E3F7" />
        <Ellipse cx="60" cy="660" rx="270" ry="150" fill="#9BD97C" />
        <Ellipse cx="350" cy="680" rx="260" ry="170" fill="#7FCC66" />
        <Ellipse cx="200" cy="720" rx="320" ry="140" fill="#B9E88F" opacity={0.55} />

        {/* Character: white sticker outline + dark teal body */}
        <Path
          d={path}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={OUTLINE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d={path}
          fill="none"
          stroke={isFinished ? '#1F8A5B' : '#0E5C5C'}
          strokeWidth={LETTER_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Traced area: solid purple base + decorative swirl pattern on top */}
        {fillPaths.map((fillPath, index) => (
          <React.Fragment key={index}>
            <Path
              d={fillPath}
              fill="none"
              stroke="#4B32C3"
              strokeWidth={LETTER_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d={fillPath}
              fill="none"
              stroke="url(#traceSwirl)"
              strokeWidth={LETTER_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.7}
            />
          </React.Fragment>
        ))}

        {/* Checkpoints ahead of the finger; reached ones simply disappear */}
        {!isFinished &&
          points.map((point) => {
            if (hitIds.includes(point.id)) return null;
            const isStart = point.id === points[0]?.id;
            return (
              <Circle
                key={point.id}
                cx={point.x}
                cy={point.y}
                r={isStart ? 13 : 11}
                fill="#FFFFFF"
                stroke="#0E5C5C"
                strokeWidth={3}
              />
            );
          })}

        {/* Beehive: the little reward waiting at the end of the stroke */}
        {!isFinished && hivePoint && (
          <G transform={`translate(${r(hivePoint.x)}, ${r(hivePoint.y)})`}>
            <Ellipse cx="0" cy="6" rx="19" ry="13" fill="#F2A93B" stroke="#8A5A16" strokeWidth={3} />
            <Path d="M-16,1 Q0,-7 16,1" fill="none" stroke="#C47A1A" strokeWidth={3} />
            <Ellipse cx="0" cy="-7" rx="15" ry="11" fill="#FFD166" stroke="#8A5A16" strokeWidth={3} />
            <Path d="M-12,-10 Q0,-17 12,-10" fill="none" stroke="#C47A1A" strokeWidth={2.5} />
            <Ellipse cx="0" cy="-20" rx="11" ry="8" fill="#FFD166" stroke="#8A5A16" strokeWidth={3} />
            <Circle cx="0" cy="-29" r="3" fill="#8A5A16" />
          </G>
        )}

        {/* Gentle red rim if the finger leaves the writing lane */}
        {!isOnPath && !isFinished && (
          <Rect
            x={4}
            y={4}
            width={VIEW_W - 8}
            height={VIEW_H - 8}
            rx={26}
            fill="none"
            stroke="#EF4444"
            strokeWidth={8}
            opacity={0.45}
          />
        )}
      </Svg>

      {/* Bee buddy — rides the finger, sits on the first dot until the child starts */}
      <View
        pointerEvents="none"
        style={[
          styles.bee,
          { left: beeX - 20, top: beeY - 22 },
        ]}
      >
        <Text style={styles.beeEmoji}>🐝</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#A8E3F7',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  svg: { backgroundColor: 'transparent' },
  bee: {
    position: 'absolute',
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beeEmoji: { fontSize: 34, lineHeight: 40, textAlign: 'center' },
});
