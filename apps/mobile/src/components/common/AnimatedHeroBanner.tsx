import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOSIcon } from '../ios/IOSIcon';

export type BannerScene = 'patrol' | 'cat' | 'dog';

interface AnimatedHeroBannerProps {
  scene?: BannerScene;
  initialScene?: BannerScene;
  initialSpecies?: BannerScene;
  height?: number;
  variant?: 'card' | 'backgroundHero';
  titleBadge?: string;
  headline?: string;
  subheadline?: string;
  actionButton?: {
    label: string;
    onPress: () => void;
  };
  onBack?: () => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  // Deprecated compatibility props
  showSceneToggle?: boolean;
  showSpeciesToggle?: boolean;
}

const PATROL_VIDEO = require('../../../assets/anim_survey_patrol.mp4');
const CAT_VIDEO = require('../../../assets/anim_cat_path.mp4');
const DOG_VIDEO = require('../../../assets/anim_dog_path.mp4');

const PATROL_FALLBACK = require('../../../assets/hero_survey_completed.jpg');
const CAT_FALLBACK = require('../../../assets/hero_cat_path.jpg');
const DOG_FALLBACK = require('../../../assets/hero_dog_path.jpg');

export const AnimatedHeroBanner: React.FC<AnimatedHeroBannerProps> = ({
  scene,
  initialScene,
  initialSpecies,
  height = 240,
  variant = 'backgroundHero',
  titleBadge,
  headline,
  subheadline,
  actionButton,
  onBack,
  children,
  style,
}) => {
  const currentScene: BannerScene = scene || initialScene || initialSpecies || 'patrol';
  const [hasVideoError, setHasVideoError] = useState<boolean>(false);

  const getVideoSource = (s: BannerScene) => {
    switch (s) {
      case 'cat':
        return CAT_VIDEO;
      case 'dog':
        return DOG_VIDEO;
      case 'patrol':
      default:
        return PATROL_VIDEO;
    }
  };

  const getFallbackSource = (s: BannerScene) => {
    switch (s) {
      case 'cat':
        return CAT_FALLBACK;
      case 'dog':
        return DOG_FALLBACK;
      case 'patrol':
      default:
        return PATROL_FALLBACK;
    }
  };

  let player: any = null;
  try {
    player = useVideoPlayer(getVideoSource(currentScene), (p) => {
      p.loop = true;
      p.muted = true;
      p.play();
    });
  } catch (err) {
    if (!hasVideoError) setHasVideoError(true);
  }

  const isBgHero = variant === 'backgroundHero';
  const insets = useSafeAreaInsets();
  const bannerHeight = isBgHero ? height + insets.top : height;
  const topOffset = Math.max(insets.top + 8, 16);

  return (
    <View
      style={[
        isBgHero ? styles.bgHeroContainer : styles.cardContainer,
        { height: bannerHeight },
        style,
      ]}
    >
      {/* Seamless Hardware-Accelerated Video or Fallback */}
      {!hasVideoError && player ? (
        <VideoView
          player={player}
          style={styles.media}
          contentFit="cover"
          nativeControls={false}
          showsTimecodes={false}
        />
      ) : (
        <Image
          source={getFallbackSource(currentScene)}
          style={styles.media}
          resizeMode="cover"
        />
      )}

      {/* Ambient Contrast Overlay */}
      <View style={styles.overlay} />

      {/* Top Gradient for Status Bar & Header Controls Readability */}
      <LinearGradient
        colors={['rgba(15, 23, 42, 0.70)', 'rgba(15, 23, 42, 0.20)', 'transparent']}
        locations={[0, 0.5, 1]}
        style={[styles.topGradient, { height: Math.max(insets.top + 80, 100) }]}
        pointerEvents="none"
      />

      {/* Top Floating Controls Row (Back Button & Live Beacon Badge) */}
      <View style={[styles.topRow, { top: topOffset }]}>
        {onBack ? (
          <TouchableOpacity
            style={styles.frostedBackBtn}
            onPress={onBack}
            activeOpacity={0.75}
            accessibilityLabel="Back"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <IOSIcon name="chevronLeft" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 38 }} />
        )}

        {titleBadge ? (
          <View style={styles.badgePill}>
            <View style={styles.pulsingDot} />
            <Text style={styles.badgeText}>{titleBadge}</Text>
          </View>
        ) : null}

        <View style={{ width: 38 }} />
      </View>

      {/* Optional Children Overlay (e.g. Floating View Switchers, Indicators) */}
      {children}

      {/* Integrated Bottom Callout (TripGlide-Style Hero Sheet) */}
      {(headline || subheadline || actionButton) && (
        <LinearGradient
          colors={['transparent', 'rgba(15, 23, 42, 0.55)', 'rgba(15, 23, 42, 0.92)']}
          locations={[0, 0.45, 1]}
          style={styles.bottomContent}
        >
          <View style={styles.bottomTextColumn}>
            {headline ? <Text style={styles.headlineText}>{headline}</Text> : null}
            {subheadline ? <Text style={styles.subheadlineText}>{subheadline}</Text> : null}
          </View>
          {actionButton ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={actionButton.onPress}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnText}>{actionButton.label}</Text>
              <View style={styles.circleArrow}>
                <Text style={styles.arrowIcon}>→</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </LinearGradient>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bgHeroContainer: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  cardContainer: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    zIndex: 5,
  },
  topRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    zIndex: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  frostedBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#D9F944',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 36,
    paddingBottom: 22,
    zIndex: 10,
  },
  bottomTextColumn: {
    flex: 1,
    marginRight: 12,
  },
  headlineText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  subheadlineText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#E2E8F0',
    marginTop: 3,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 7,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    gap: 8,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  circleArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowIcon: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: -1,
  },
});
