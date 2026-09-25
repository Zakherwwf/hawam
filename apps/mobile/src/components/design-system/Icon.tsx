import React from 'react';
import { Platform } from 'react-native';
import {
  Map,
  PawPrint,
  PlusCircle,
  Activity,
  User,
  Footprints,
  Play,
  Pause,
  Square,
  Check,
  X,
  Compass,
  Crosshair,
  Camera,
  Image as ImageIcon,
  AlertTriangle,
  Settings,
  Cloud,
  CloudOff,
  Trophy,
  Shield,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Info,
  Flame,
  Search,
  Award,
  BookOpen,
  WifiOff,
} from 'lucide-react-native';

export type IconName =
  | 'map'
  | 'animals'
  | 'record'
  | 'activity'
  | 'profile'
  | 'user'
  | 'survey'
  | 'play'
  | 'pause'
  | 'stop'
  | 'check'
  | 'close'
  | 'compass'
  | 'crosshair'
  | 'camera'
  | 'image'
  | 'alert'
  | 'settings'
  | 'cloud'
  | 'cloud-offline'
  | 'trophy'
  | 'shield'
  | 'refresh'
  | 'chevron-right'
  | 'chevron-left'
  | 'info'
  | 'flame'
  | 'search'
  | 'award'
  | 'academy'
  | 'cat'
  | 'dog'
  | 'wifi-off';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// SF Symbols mapping for iOS when expo-symbols is available
const SF_SYMBOLS_MAP: Record<IconName, string> = {
  map: 'map.fill',
  animals: 'pawprint.fill',
  record: 'plus.circle.fill',
  activity: 'list.bullet.rectangle.portrait.fill',
  profile: 'person.crop.circle.fill',
  user: 'person.fill',
  survey: 'figure.walk',
  play: 'play.fill',
  pause: 'pause.fill',
  stop: 'square.fill',
  check: 'checkmark',
  close: 'xmark',
  compass: 'location.north.line.fill',
  crosshair: 'scope',
  camera: 'camera.fill',
  image: 'photo.fill',
  alert: 'exclamationmark.triangle.fill',
  settings: 'gearshape.fill',
  cloud: 'cloud.fill',
  'cloud-offline': 'cloud.slash.fill',
  trophy: 'trophy.fill',
  shield: 'shield.fill',
  refresh: 'arrow.clockwise',
  'chevron-right': 'chevron.right',
  'chevron-left': 'chevron.left',
  info: 'info.circle.fill',
  flame: 'flame.fill',
  search: 'magnifyingglass',
  award: 'rosette',
  academy: 'book.fill',
  cat: 'pawprint.fill',
  dog: 'pawprint.fill',
  'wifi-off': 'wifi.slash',
};

// Lucide mapping for Android & Web
const LUCIDE_COMPONENTS: Record<IconName, React.ComponentType<any>> = {
  map: Map,
  animals: PawPrint,
  record: PlusCircle,
  activity: Activity,
  profile: User,
  user: User,
  survey: Footprints,
  play: Play,
  pause: Pause,
  stop: Square,
  check: Check,
  close: X,
  compass: Compass,
  crosshair: Crosshair,
  camera: Camera,
  image: ImageIcon,
  alert: AlertTriangle,
  settings: Settings,
  cloud: Cloud,
  'cloud-offline': CloudOff,
  trophy: Trophy,
  shield: Shield,
  refresh: RefreshCw,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  info: Info,
  flame: Flame,
  search: Search,
  award: Award,
  academy: BookOpen,
  cat: PawPrint,
  dog: PawPrint,
  'wifi-off': WifiOff,
};

let SymbolViewModule: any = null;
if (Platform.OS === 'ios') {
  try {
    SymbolViewModule = require('expo-symbols').SymbolView;
  } catch {}
}

/**
 * Unified cross-platform icon component.
 * Uses native SF Symbols on iOS via expo-symbols and Lucide on Android/Web.
 * Strictly guarantees ZERO Unicode emojis.
 */
export const Icon: React.FC<IconProps> = ({
  name,
  size = 22,
  color = '#111827',
  strokeWidth = 2,
}) => {
  if (Platform.OS === 'ios' && SymbolViewModule) {
    const symbol = SF_SYMBOLS_MAP[name] || 'circle';
    return (
      <SymbolViewModule
        name={symbol}
        size={size}
        tintColor={color}
        resizeMode="scaleAspectFit"
        style={{ width: size, height: size }}
      />
    );
  }

  const Component = LUCIDE_COMPONENTS[name] || Map;
  return <Component size={size} color={color} strokeWidth={strokeWidth} />;
};
