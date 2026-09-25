import React from 'react';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';
import { IOSColors } from '../../theme/ios';

export type IconName =
  | 'home'
  | 'compass'
  | 'camera'
  | 'map'
  | 'list'
  | 'gear'
  | 'plus'
  | 'minus'
  | 'trash'
  | 'pencil'
  | 'chevronRight'
  | 'chevronLeft'
  | 'check'
  | 'location'
  | 'ruler'
  | 'clock'
  | 'xmark'
  | 'photo'
  | 'info'
  | 'filter'
  | 'shield'
  | 'paw'
  | 'chart'
  | 'person'
  | 'globe'
  | 'eye'
  | 'share'
  | 'squareStack'
  | 'lock'
  | 'bell'
  | 'search'
  | 'chevronDown'
  | 'chevronUp'
  | 'calendar'
  | 'grid'
  | 'document'
  | 'star'
  | 'sun'
  | 'moon'
  | 'sliders'
  | 'moreHorizontal'
  | 'play'
  | 'pause'
  | 'flag'
  | 'stop';

interface IOSIconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export const IOSIcon: React.FC<IOSIconProps> = ({
  name,
  size = 20,
  color = IOSColors.label,
}) => {
  switch (name) {
    case 'home':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M 3 9 L 12 2 L 21 9 L 21 20 A 2 2 0 0 1 19 22 L 5 22 A 2 2 0 0 1 3 20 Z" />
          <Polyline points="9 22 9 12 15 12 15 22" />
        </Svg>
      );
    case 'compass':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="10" />
          <Path d="M 16.24 7.76 L 14.12 14.12 L 7.76 16.24 L 9.88 9.88 Z" fill={color} />
        </Svg>
      );
    case 'camera':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M 23 19 A 2 2 0 0 1 21 21 L 3 21 A 2 2 0 0 1 1 19 L 1 8 A 2 2 0 0 1 3 6 L 7 6 L 9 3 L 15 3 L 17 6 L 21 6 A 2 2 0 0 1 23 8 Z" />
          <Circle cx="12" cy="13" r="4" />
        </Svg>
      );
    case 'map':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M 1 6 L 1 22 L 8 18 L 16 22 L 23 18 L 23 2 L 16 6 L 8 2 Z" />
          <Line x1="8" y1="2" x2="8" y2="18" />
          <Line x1="16" y1="6" x2="16" y2="22" />
        </Svg>
      );
    case 'list':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Line x1="8" y1="6" x2="21" y2="6" />
          <Line x1="8" y1="12" x2="21" y2="12" />
          <Line x1="8" y1="18" x2="21" y2="18" />
          <Line x1="3" y1="6" x2="3.01" y2="6" strokeWidth={3} />
          <Line x1="3" y1="12" x2="3.01" y2="12" strokeWidth={3} />
          <Line x1="3" y1="18" x2="3.01" y2="18" strokeWidth={3} />
        </Svg>
      );
    case 'gear':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="3" />
          <Path d="M 19.4 15 A 1.65 1.65 0 0 0 19.73 16.82 L 19.79 16.88 A 2 2 0 0 1 19.79 19.71 A 2 2 0 0 1 16.96 19.71 L 16.9 19.65 A 1.65 1.65 0 0 0 15.08 19.32 A 1.65 1.65 0 0 0 14.08 20.83 L 14.08 21 A 2 2 0 0 1 12.08 23 A 2 2 0 0 1 10.08 21 L 10.08 20.91 A 1.65 1.65 0 0 0 9 19.4 A 1.65 1.65 0 0 0 7.18 19.73 L 7.12 19.79 A 2 2 0 0 1 4.29 19.79 A 2 2 0 0 1 4.29 16.96 L 4.35 16.9 A 1.65 1.65 0 0 0 4.68 15.08 A 1.65 1.65 0 0 0 3.17 14.08 L 3 14.08 A 2 2 0 0 1 1 12.08 A 2 2 0 0 1 3 10.08 L 3.09 10.08 A 1.65 1.65 0 0 0 4.6 9 A 1.65 1.65 0 0 0 4.27 7.18 L 4.21 7.12 A 2 2 0 0 1 4.21 4.29 A 2 2 0 0 1 7.04 4.29 L 7.1 4.35 A 1.65 1.65 0 0 0 8.92 4.68 A 1.65 1.65 0 0 0 9.92 3.17 L 10 3 A 2 2 0 0 1 12 1 A 2 2 0 0 1 14 3 L 14 3.09 A 1.65 1.65 0 0 0 15.08 4.6 A 1.65 1.65 0 0 0 16.9 4.27 L 16.96 4.21 A 2 2 0 0 1 19.79 4.21 A 2 2 0 0 1 19.79 7.04 L 19.73 7.1 A 1.65 1.65 0 0 0 19.4 8.92 A 1.65 1.65 0 0 0 20.91 9.92 L 21 10 A 2 2 0 0 1 23 12 A 2 2 0 0 1 21 14 L 20.91 14 A 1.65 1.65 0 0 0 19.4 15 Z" />
        </Svg>
      );
    case 'plus':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <Line x1="12" y1="5" x2="12" y2="19" />
          <Line x1="5" y1="12" x2="19" y2="12" />
        </Svg>
      );
    case 'minus':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <Line x1="5" y1="12" x2="19" y2="12" />
        </Svg>
      );
    case 'trash':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Polyline points="3 6 5 6 21 6" />
          <Path d="M 19 6 L 19 20 A 2 2 0 0 1 17 22 L 7 22 A 2 2 0 0 1 5 20 L 5 6 M 8 6 L 8 4 A 2 2 0 0 1 10 2 L 14 2 A 2 2 0 0 1 16 4 L 16 6" />
          <Line x1="10" y1="11" x2="10" y2="17" />
          <Line x1="14" y1="11" x2="14" y2="17" />
        </Svg>
      );
    case 'pencil':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M 17 3 A 2.828 2.828 0 1 1 21 7 L 7.5 20.5 L 2 22 L 3.5 16.5 Z" />
        </Svg>
      );
    case 'chevronRight':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <Polyline points="9 18 15 12 9 6" />
        </Svg>
      );
    case 'chevronLeft':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <Polyline points="15 18 9 12 15 6" />
        </Svg>
      );
    case 'check':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <Polyline points="20 6 9 17 4 12" />
        </Svg>
      );
    case 'location':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M 21 10 C 21 17 12 23 12 23 C 12 23 3 17 3 10 A 9 9 0 0 1 21 10 Z" />
          <Circle cx="12" cy="10" r="3" />
        </Svg>
      );
    case 'ruler':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M 21.3 8.7 L 16.3 3.7 A 2 2 0 0 0 13.5 3.7 L 2.7 14.5 A 2 2 0 0 0 2.7 17.3 L 7.7 22.3 A 2 2 0 0 0 10.5 22.3 L 21.3 11.5 A 2 2 0 0 0 21.3 8.7 Z" />
          <Line x1="14.5" y1="5.5" x2="16.5" y2="7.5" />
          <Line x1="10.5" y1="9.5" x2="12.5" y2="11.5" />
          <Line x1="6.5" y1="13.5" x2="8.5" y2="15.5" />
        </Svg>
      );
    case 'clock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="10" />
          <Polyline points="12 6 12 12 16 14" />
        </Svg>
      );
    case 'xmark':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <Line x1="18" y1="6" x2="6" y2="18" />
          <Line x1="6" y1="6" x2="18" y2="18" />
        </Svg>
      );
    case 'photo':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <Circle cx="8.5" cy="8.5" r="1.5" />
          <Polyline points="21 15 16 10 5 21" />
        </Svg>
      );
    case 'info':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="10" />
          <Line x1="12" y1="16" x2="12" y2="12" />
          <Line x1="12" y1="8" x2="12.01" y2="8" strokeWidth={3} />
        </Svg>
      );
    case 'filter':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M 22 3 L 2 3 L 10 12.46 L 10 19 L 14 21 L 14 12.46 Z" />
        </Svg>
      );
    case 'shield':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M 12 22 C 12 22 20 18 20 12 L 20 5 L 12 2 L 4 5 L 4 12 C 4 18 12 22 12 22 Z" />
        </Svg>
      );
    case 'paw':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <Circle cx="5" cy="10" r="2.2" />
          <Circle cx="9.5" cy="6" r="2.2" />
          <Circle cx="14.5" cy="6" r="2.2" />
          <Circle cx="19" cy="10" r="2.2" />
          <Path d="M 12 11 C 9 11 6.5 13 6.5 15.5 C 6.5 18 8.5 20 12 20 C 15.5 20 17.5 18 17.5 15.5 C 17.5 13 15 11 12 11 Z" />
        </Svg>
      );
    case 'chart':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Line x1="18" y1="20" x2="18" y2="10" />
          <Line x1="12" y1="20" x2="12" y2="4" />
          <Line x1="6" y1="20" x2="6" y2="14" />
        </Svg>
      );
    case 'person':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M 20 21 L 20 19 A 4 4 0 0 0 16 15 L 8 15 A 4 4 0 0 0 4 19 L 4 21" />
          <Circle cx="12" cy="7" r="4" />
        </Svg>
      );
    case 'globe':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="10" />
          <Line x1="2" y1="12" x2="22" y2="12" />
          <Path d="M 12 2 A 15.3 15.3 0 0 1 16 12 A 15.3 15.3 0 0 1 12 22 A 15.3 15.3 0 0 1 8 12 A 15.3 15.3 0 0 1 12 2 Z" />
        </Svg>
      );
    case 'eye':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M 1 12 C 1 12 5 4 12 4 C 19 4 23 12 23 12 C 23 12 19 20 12 20 C 5 20 1 12 1 12 Z" />
          <Circle cx="12" cy="12" r="3" />
        </Svg>
      );
    case 'share':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M 4 12 V 20 C 4 21.1 4.9 22 6 22 H 18 C 19.1 22 20 21.1 20 20 V 12" />
          <Polyline points="16 6 12 2 8 6" />
          <Line x1="12" y1="2" x2="12" y2="15" />
        </Svg>
      );
    case 'squareStack':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Rect x="8" y="8" width="12" height="12" rx="2" />
          <Path d="M 4 16 C 2.9 16 2 15.1 2 14 L 2 4 C 2 2.9 2.9 2 4 2 L 14 2 C 15.1 2 16 2.9 16 4" />
        </Svg>
      );
    case 'lock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <Path d="M 7 11 V 7 A 5 5 0 0 1 17 7 V 11" />
        </Svg>
      );
    case 'bell':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M 18 8 A 6 6 0 0 0 6 8 C 6 15 3 17 3 17 L 21 17 C 21 17 18 15 18 8 Z" />
          <Path d="M 13.73 21 A 2 2 0 0 1 10.27 21" />
        </Svg>
      );
    case 'search':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="11" cy="11" r="7" />
          <Line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth={2.5} />
        </Svg>
      );
    case 'chevronDown':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <Polyline points="6 9 12 15 18 9" />
        </Svg>
      );
    case 'chevronUp':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <Polyline points="18 15 12 9 6 15" />
        </Svg>
      );
    case 'calendar':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <Line x1="16" y1="2" x2="16" y2="6" />
          <Line x1="8" y1="2" x2="8" y2="6" />
          <Line x1="3" y1="10" x2="21" y2="10" />
        </Svg>
      );
    case 'grid':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Rect x="3" y="3" width="7" height="7" rx="1.5" />
          <Rect x="14" y="3" width="7" height="7" rx="1.5" />
          <Rect x="14" y="14" width="7" height="7" rx="1.5" />
          <Rect x="3" y="14" width="7" height="7" rx="1.5" />
        </Svg>
      );
    case 'document':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M 14 2 H 6 A 2 2 0 0 0 4 4 V 20 A 2 2 0 0 0 6 22 H 18 A 2 2 0 0 0 20 20 V 8 Z" />
          <Polyline points="14 2 14 8 20 8" />
          <Line x1="16" y1="13" x2="8" y2="13" />
          <Line x1="16" y1="17" x2="8" y2="17" />
          <Line x1="10" y1="9" x2="8" y2="9" />
        </Svg>
      );
    case 'star':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M 12 2 L 15.09 8.26 L 22 9.27 L 17 14.14 L 18.18 21.02 L 12 17.77 L 5.82 21.02 L 7 14.14 L 2 9.27 L 8.91 8.26 Z" />
        </Svg>
      );
    case 'sun':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="5" />
          <Line x1="12" y1="1" x2="12" y2="3" />
          <Line x1="12" y1="21" x2="12" y2="23" />
          <Line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <Line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <Line x1="1" y1="12" x2="3" y2="12" />
          <Line x1="21" y1="12" x2="23" y2="12" />
          <Line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <Line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </Svg>
      );
    case 'moon':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M 21 12.79 A 9 9 0 1 1 11.21 3 A 7 7 0 0 0 21 12.79 Z" fill="none" />
        </Svg>
      );
    case 'sliders':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Line x1="4" y1="21" x2="4" y2="14" />
          <Line x1="4" y1="10" x2="4" y2="3" />
          <Line x1="12" y1="21" x2="12" y2="12" />
          <Line x1="12" y1="8" x2="12" y2="3" />
          <Line x1="20" y1="21" x2="20" y2="16" />
          <Line x1="20" y1="12" x2="20" y2="3" />
          <Line x1="1" y1="14" x2="7" y2="14" />
          <Line x1="9" y1="8" x2="15" y2="8" />
          <Line x1="17" y1="16" x2="23" y2="16" />
        </Svg>
      );
    case 'moreHorizontal':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="1.5" fill={color} />
          <Circle cx="19" cy="12" r="1.5" fill={color} />
          <Circle cx="5" cy="12" r="1.5" fill={color} />
        </Svg>
      );
    case 'play':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M 5 3 L 19 12 L 5 21 Z" />
        </Svg>
      );
    case 'pause':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Rect x="6" y="4" width="4" height="16" rx="1" />
          <Rect x="14" y="4" width="4" height="16" rx="1" />
        </Svg>
      );
    case 'flag':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <Line x1="4" y1="22" x2="4" y2="15" />
        </Svg>
      );
    case 'stop':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Rect x="5" y="5" width="14" height="14" rx="2" />
        </Svg>
      );
    default:
      return null;
  }
};
