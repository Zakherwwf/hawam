import React, { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Icon } from '../../src/components/design-system/Icon';
import { RecordActionSheet } from '../../src/components/survey/RecordActionSheet';
import { StructuredSurveyScreen } from '../../src/screens/StructuredSurveyScreen';
import { useAppState } from '../../src/app-state/AppStateProvider';
import { useSyncStore } from '../../src/features/sync/syncStore';
import { useSurveyStore } from '../../src/features/survey/surveyStore';
import { useThemeStore } from '../../src/features/theme/themeStore';
import { hapticQuickLog, hapticTabSwitch } from '../../src/utils/haptics';

type TabIconName = 'map' | 'animals' | 'activity' | 'profile';
type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const TAB_ICONS: Record<string, { icon: TabIconName; labelKey: string }> = {
  index: { icon: 'map', labelKey: 'ui_app.explore_map' },
  animals: { icon: 'animals', labelKey: 'ui_app.animals' },
  activity: { icon: 'activity', labelKey: 'ui_app.activity' },
  me: { icon: 'profile', labelKey: 'ui_app.profile_and_progress' },
};

/** Floating 4-tab + center Record bar (fixed five-slot layout). */
function FloatingTabBar({
  state,
  navigation,
  onRecord,
}: BottomTabBarProps & { onRecord: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { themeMode } = useThemeStore();
  const { primaryViewMode, setPrimaryViewMode } = useAppState();
  const pendingSyncCount = useSyncStore((s) => s.pendingCount);
  const surveyStatus = useSurveyStore((s) => s.status);
  const isSurveyActive = surveyStatus === 'recording' || surveyStatus === 'acquiring_fix';
  if (isSurveyActive) return null;

  const activeName = state.routes[state.index]?.name;

  const renderTab = (routeName: string) => {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return null;
    const { icon, labelKey } = TAB_ICONS[routeName];
    const focused = activeName === routeName;
    return (
      <TouchableOpacity
        key={routeName}
        style={[styles.tabPill, focused && styles.tabPillActive]}
        onPress={() => {
          if (!focused) {
            hapticTabSwitch();
            navigation.navigate(routeName);
          } else if (routeName === 'index' && primaryViewMode === 'dashboard') {
            hapticTabSwitch();
            setPrimaryViewMode('map');
          }
        }}
        activeOpacity={0.75}
        accessibilityRole="tab"
        accessibilityLabel={t(labelKey)}
        accessibilityState={{ selected: focused }}
      >
        <Icon name={icon} size={20} color={focused ? '#0F172A' : '#94A3B8'} />
        {routeName === 'activity' && pendingSyncCount > 0 ? (
          <View style={styles.syncBadge}>
            <Text style={styles.syncBadgeText}>{pendingSyncCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[styles.floatingTabBarContainer, { bottom: Math.max(insets.bottom + 8, 16) }]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.floatingTabBar,
          {
            backgroundColor:
              themeMode === 'night' ? 'rgba(15, 23, 42, 0.94)' : 'rgba(15, 23, 42, 0.95)',
            borderColor:
              themeMode === 'night' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.15)',
          },
        ]}
      >
        {renderTab('index')}
        {renderTab('animals')}
        <TouchableOpacity
          style={styles.recordActionPill}
          onPress={() => {
            hapticQuickLog();
            onRecord();
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('ui_app.record_survey_or_sighting')}
        >
          <LinearGradient colors={['#0284C7', '#0369A1']} style={styles.recordActionGradient}>
            <Icon name="record" size={24} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
        {renderTab('activity')}
        {renderTab('me')}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useThemeStore();
  const {
    logAnimalInSurvey,
    finishStructuredSurvey,
    stats,
    selectedRouteForSurvey,
    setSelectedRouteForSurvey,
  } = useAppState();
  const [isRecordSheetVisible, setIsRecordSheetVisible] = useState(false);
  const surveyStatus = useSurveyStore((s) => s.status);
  const isSurveyActive = surveyStatus === 'recording' || surveyStatus === 'acquiring_fix';

  return (
    <View style={[styles.appRoot, { backgroundColor: colors.screenBg }]}>
      <LinearGradient
        colors={colors.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right']}>
        <StatusBar style={colors.statusBarStyle} />

        <Tabs
          backBehavior="history"
          screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
          tabBar={(props) => (
            <FloatingTabBar {...props} onRecord={() => setIsRecordSheetVisible(true)} />
          )}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="animals" />
          <Tabs.Screen name="activity" />
          <Tabs.Screen name="me" />
        </Tabs>

        {/* Paused survey banner */}
        {surveyStatus === 'paused' && (
          <View style={styles.pausedBannerContainer}>
            <TouchableOpacity
              style={styles.pausedBanner}
              onPress={() => useSurveyStore.getState().resumeSurvey()}
              activeOpacity={0.8}
            >
              <View style={styles.pausedIndicator} />
              <Text style={styles.pausedBannerText}>{t('ui_app.survey_paused_tap_to_resume')}</Text>
              <Icon name="play" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Full-screen survey (tab bar unreachable while active) */}
        {isSurveyActive && (
          <Modal
            visible
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={() => {
              Alert.alert(t('ui_app.survey_in_progress'), t('ui_app.do_you_want_to_pause_your'), [
                { text: t('ui_app.keep_surveying'), style: 'cancel' },
                {
                  text: t('ui_app.pause_survey'),
                  onPress: () => useSurveyStore.getState().pauseSurvey(),
                },
              ]);
            }}
          >
            <SafeAreaView style={styles.modalRoot} edges={['top', 'left', 'right', 'bottom']}>
              <StructuredSurveyScreen
                onBack={() => useSurveyStore.getState().pauseSurvey()}
                onFinishSurvey={finishStructuredSurvey}
                onLogAnimal={logAnimalInSurvey}
                loggedAnimalsCount={stats.animalsRecorded}
                initialRouteId={selectedRouteForSurvey}
              />
            </SafeAreaView>
          </Modal>
        )}

        <RecordActionSheet
          visible={isRecordSheetVisible}
          onClose={() => setIsRecordSheetVisible(false)}
          onSelectTransect={() => {
            setSelectedRouteForSurvey(null);
            useSurveyStore.getState().startSurvey('transect');
          }}
          onSelectStationary={() => {
            setSelectedRouteForSurvey(null);
            useSurveyStore.getState().startSurvey('stationary_point');
          }}
          onSelectQuickSighting={() => {
            hapticQuickLog();
            router.push('/opportunistic');
          }}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  appRoot: { flex: 1, position: 'relative', backgroundColor: '#F7F6F2' },
  modalRoot: { flex: 1, backgroundColor: '#F7F6F2' },
  safeContainer: { flex: 1, backgroundColor: 'transparent' },
  floatingTabBarContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  floatingTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 36,
    paddingVertical: 6,
    paddingHorizontal: 10,
    width: '100%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  tabPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 4,
  },
  recordActionPill: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  recordActionGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  syncBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  syncBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  pausedBannerContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9000,
  },
  pausedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  pausedIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
    marginRight: 10,
  },
  pausedBannerText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', marginRight: 10 },
});
