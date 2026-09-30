/**
 * Flat vector illustrations in the style of reference board 4: a sky dome,
 * sun, soft hills, whitewashed houses and the two animals the app is about.
 * Vector only (CLAUDE.md zero-emoji mandate); colours come from the tokens so
 * the scenes follow light and dark mode.
 */

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useTheme } from './theme';

function useScenePalette() {
  const { dark } = useTheme();
  return dark
    ? {
        sky: ['#1B3A55', '#0F2233'],
        sun: '#F2DB6C',
        cloud: 'rgba(255,255,255,0.18)',
        hillBack: '#1F4A1C',
        hillFront: '#2F6B26',
        ground: '#3F7A2A',
        path: '#4B4636',
        wall: '#E9E4D8',
        wall2: '#D8D2C4',
        roof: '#C9591A',
        door: '#3865CC',
        window: '#7FB8D6',
        tree: '#2F7A2B',
        trunk: '#6B4A2B',
        cat: '#0F100F',
        dog: '#B8733F',
        eye: '#B1EC6F',
      }
    : {
        sky: ['#A6E2F9', '#E3F6FD'],
        sun: '#F2DB6C',
        cloud: '#FFFFFF',
        hillBack: '#5FA83A',
        hillFront: '#8FD45C',
        ground: '#6DBE45',
        path: '#F2E3C0',
        wall: '#FFFFFF',
        wall2: '#FFF4E4',
        roof: '#F1721D',
        door: '#3865CC',
        window: '#A6E2F9',
        tree: '#2F7A2B',
        trunk: '#8A5A2B',
        cat: '#16181D',
        dog: '#B8733F',
        eye: '#B1EC6F',
      };
}

/** Street scene with a cat and a dog. Scales to the width it is given. */
export function StreetScene({ style, label }: { style?: StyleProp<ViewStyle>; label?: string }) {
  const p = useScenePalette();
  return (
    <View
      style={[{ width: '100%', aspectRatio: 360 / 240 }, style]}
      accessible={!!label}
      accessibilityLabel={label}
      accessibilityRole={label ? 'image' : undefined}
    >
      <Svg width="100%" height="100%" viewBox="0 0 360 240">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={p.sky[0]} />
            <Stop offset="1" stopColor={p.sky[1]} />
          </LinearGradient>
        </Defs>
        {/* Sky dome */}
        <Circle cx={180} cy={128} r={112} fill="url(#sky)" />
        {/* Sun and clouds */}
        <Circle cx={246} cy={62} r={26} fill={p.sun} opacity={0.3} />
        <Circle cx={246} cy={62} r={16} fill={p.sun} />
        <Rect x={96} y={58} width={54} height={14} rx={7} fill={p.cloud} />
        <Rect x={112} y={48} width={30} height={16} rx={8} fill={p.cloud} />
        <Rect x={196} y={96} width={40} height={10} rx={5} fill={p.cloud} opacity={0.8} />
        {/* Hills */}
        <Path d="M62 176 Q130 112 206 162 T300 170 L300 196 L62 196 Z" fill={p.hillBack} />
        <Path d="M50 182 Q118 140 180 176 T312 178 L312 200 L50 200 Z" fill={p.hillFront} />
        {/* Tree */}
        <Rect x={271} y={150} width={5} height={24} rx={2} fill={p.trunk} />
        <Circle cx={273} cy={146} r={15} fill={p.tree} />
        <Circle cx={264} cy={154} r={10} fill={p.tree} />
        {/* Houses */}
        <G>
          <Rect x={92} y={132} width={52} height={46} rx={3} fill={p.wall} />
          <Path d="M86 136 L118 112 L150 136 Z" fill={p.roof} />
          <Rect x={112} y={156} width={12} height={22} rx={6} fill={p.door} />
          <Rect x={98} y={144} width={9} height={9} rx={2} fill={p.window} />
          <Rect x={130} y={144} width={9} height={9} rx={2} fill={p.window} />
        </G>
        <G>
          <Rect x={186} y={120} width={62} height={58} rx={3} fill={p.wall2} />
          <Path d="M186 124 Q217 96 248 124 Z" fill={p.wall} />
          <Rect x={210} y={150} width={14} height={28} rx={7} fill={p.door} />
          <Rect x={194} y={132} width={10} height={12} rx={5} fill={p.window} />
          <Rect x={230} y={132} width={10} height={12} rx={5} fill={p.window} />
        </G>
        {/* Ground and path */}
        <Path d="M14 186 Q180 166 346 186 L346 214 Q180 236 14 214 Z" fill={p.ground} />
        <Ellipse cx={180} cy={206} rx={118} ry={12} fill={p.path} />
        {/* Cat, sitting */}
        <G>
          <Path
            d="M122 206 Q104 204 108 190 Q110 184 116 186"
            stroke={p.cat}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
          <Ellipse cx={128} cy={196} rx={11} ry={14} fill={p.cat} />
          <Circle cx={130} cy={178} r={9} fill={p.cat} />
          <Path d="M123 174 L124 163 L130 170 Z" fill={p.cat} />
          <Path d="M137 174 L136 163 L130 170 Z" fill={p.cat} />
          <Circle cx={127} cy={178} r={1.6} fill={p.eye} />
          <Circle cx={133} cy={178} r={1.6} fill={p.eye} />
        </G>
        {/* Dog, standing */}
        <G>
          <Path
            d="M204 188 Q196 178 200 172"
            stroke={p.dog}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
          <Rect x={204} y={184} width={36} height={16} rx={8} fill={p.dog} />
          <Rect x={207} y={196} width={5} height={14} rx={2.5} fill={p.dog} />
          <Rect x={218} y={196} width={5} height={14} rx={2.5} fill={p.dog} />
          <Rect x={230} y={196} width={5} height={14} rx={2.5} fill={p.dog} />
          <Circle cx={244} cy={180} r={10} fill={p.dog} />
          <Ellipse cx={240} cy={181} rx={4} ry={8} fill={p.cat} opacity={0.35} />
          <Ellipse cx={253} cy={183} rx={5} ry={4} fill={p.dog} />
          <Circle cx={257} cy={182} r={2} fill={p.cat} />
          <Circle cx={247} cy={177} r={1.6} fill={p.cat} />
        </G>
      </Svg>
    </View>
  );
}

/** Illustrated cat or dog face for species choices and empty states. */
export function AnimalFace({ species, size = 56 }: { species: 'cat' | 'dog'; size?: number }) {
  const { c } = useTheme();
  const bg = species === 'cat' ? c.catSoft : c.dogSoft;
  const fg = species === 'cat' ? c.cat : c.dog;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx={32} cy={32} r={32} fill={bg} />
      {species === 'cat' ? (
        <G>
          <Path d="M16 30 L18 12 L28 22 Z" fill={fg} />
          <Path d="M48 30 L46 12 L36 22 Z" fill={fg} />
          <Circle cx={32} cy={35} r={16} fill={fg} />
          <Ellipse cx={26} cy={33} rx={2.4} ry={3.2} fill={bg} />
          <Ellipse cx={38} cy={33} rx={2.4} ry={3.2} fill={bg} />
          <Path d="M30 40 L34 40 L32 42.5 Z" fill={bg} />
          <Path
            d="M20 40 L12 38 M20 43 L12 44 M44 40 L52 38 M44 43 L52 44"
            stroke={fg}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </G>
      ) : (
        <G>
          <Ellipse
            cx={17}
            cy={30}
            rx={6}
            ry={12}
            fill={fg}
            opacity={0.75}
            transform="rotate(15 17 30)"
          />
          <Ellipse
            cx={47}
            cy={30}
            rx={6}
            ry={12}
            fill={fg}
            opacity={0.75}
            transform="rotate(-15 47 30)"
          />
          <Circle cx={32} cy={32} r={15} fill={fg} />
          <Ellipse cx={32} cy={42} rx={9} ry={7} fill={fg} />
          <Circle cx={26} cy={30} r={2.4} fill={bg} />
          <Circle cx={38} cy={30} r={2.4} fill={bg} />
          <Ellipse cx={32} cy={40} rx={3.6} ry={2.6} fill={bg} />
        </G>
      )}
    </Svg>
  );
}
