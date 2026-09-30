import React from 'react';
import { Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';
import {
  Award,
  Bell,
  Building,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  CloudUpload,
  Eye,
  FileText,
  Flame,
  Footprints,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  Info,
  Layers,
  List,
  LocateFixed,
  Lock,
  Mail,
  Map as MapIcon,
  MapPinned,
  Medal,
  Minus,
  Pencil,
  Moon,
  PawPrint,
  Plus,
  RefreshCw,
  Route,
  Ruler,
  Search,
  Settings,
  Share,
  Shield,
  SlidersHorizontal,
  Star,
  Sun,
  Target,
  Timer,
  Trash2,
  Trophy,
  User,
  X,
  Zap,
} from 'lucide-react-native';

/**
 * CLAUDE.md 3.3: SF Symbols on iOS, mapped vector icons elsewhere. Each app
 * icon has one SF Symbol and one fallback; nothing else draws icons.
 */
const ICONS = {
  map: { sf: 'map', fb: MapIcon },
  sightings: { sf: 'list.bullet', fb: List },
  plus: { sf: 'plus', fb: Plus },
  minus: { sf: 'minus', fb: Minus },
  progress: { sf: 'trophy', fb: Trophy },
  profile: { sf: 'person.crop.circle', fb: User },
  camera: { sf: 'camera', fb: Camera },
  photo: { sf: 'photo', fb: ImageIcon },
  paw: { sf: 'pawprint', fb: PawPrint },
  locate: { sf: 'location', fb: LocateFixed },
  close: { sf: 'xmark', fb: X },
  check: { sf: 'checkmark', fb: Check },
  checkCircle: { sf: 'checkmark.circle.fill', fb: CircleCheck },
  chevronRight: { sf: 'chevron.right', fb: ChevronRight },
  chevronLeft: { sf: 'chevron.left', fb: ChevronLeft },
  flame: { sf: 'flame', fb: Flame },
  bolt: { sf: 'bolt', fb: Zap },
  walk: { sf: 'figure.walk', fb: Footprints },
  settings: { sf: 'gearshape', fb: Settings },
  share: { sf: 'square.and.arrow.up', fb: Share },
  trash: { sf: 'trash', fb: Trash2 },
  bell: { sf: 'bell', fb: Bell },
  sync: { sf: 'arrow.triangle.2.circlepath', fb: RefreshCw },
  upload: { sf: 'icloud.and.arrow.up', fb: CloudUpload },
  info: { sf: 'info.circle', fb: Info },
  eye: { sf: 'eye', fb: Eye },
  moon: { sf: 'moon', fb: Moon },
  sun: { sf: 'sun.max', fb: Sun },
  globe: { sf: 'globe', fb: Globe },
  document: { sf: 'doc.text', fb: FileText },
  academy: { sf: 'graduationcap', fb: GraduationCap },
  shield: { sf: 'shield', fb: Shield },
  clock: { sf: 'clock', fb: Clock },
  timer: { sf: 'timer', fb: Timer },
  ruler: { sf: 'ruler', fb: Ruler },
  search: { sf: 'magnifyingglass', fb: Search },
  filter: { sf: 'line.3.horizontal.decrease', fb: SlidersHorizontal },
  layers: { sf: 'square.3.layers.3d', fb: Layers },
  award: { sf: 'rosette', fb: Award },
  medal: { sf: 'medal', fb: Medal },
  target: { sf: 'scope', fb: Target },
  route: { sf: 'point.topleft.down.to.point.bottomright.curvepath', fb: Route },
  pin: { sf: 'mappin.and.ellipse', fb: MapPinned },
  lock: { sf: 'lock', fb: Lock },
  mail: { sf: 'envelope', fb: Mail },
  building: { sf: 'building.2', fb: Building },
  edit: { sf: 'pencil', fb: Pencil },
  star: { sf: 'star', fb: Star },
} as const;

export type SymbolName = keyof typeof ICONS;

export function Symbol({
  name,
  size = 22,
  color,
  weight = 'regular',
}: {
  name: SymbolName;
  size?: number;
  color: string;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
}) {
  const entry = ICONS[name];
  const Fallback = entry.fb;
  const fallback = (
    <Fallback size={size} color={color} strokeWidth={weight === 'regular' ? 1.8 : 2.2} />
  );
  if (Platform.OS !== 'ios') return fallback;
  return (
    <SymbolView
      name={entry.sf as any}
      size={size}
      tintColor={color}
      weight={weight}
      type="monochrome"
      fallback={fallback}
    />
  );
}
