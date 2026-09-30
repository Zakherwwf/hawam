import React, { useState } from 'react';
import { Alert, Modal, Platform, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { RecordSheet } from '../../src/components/survey/RecordSheet';
import { SurveyWalkScreen } from '../../src/screens/SurveyWalkScreen';
import { useAppState } from '../../src/app-state/AppStateProvider';
import { useSyncStore } from '../../src/features/sync/syncStore';
import { useSurveyStore } from '../../src/features/survey/surveyStore';
import { Press, Symbol, Text, useTheme, type SymbolName } from '../../src/ui';

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: { name: string; icon: SymbolName; labelKey: string }[] = [
  { name: 'index', icon: 'map', labelKey: 'ui_tabs.map' },
  { name: 'activity', icon: 'sightings', labelKey: 'ui_tabs.sightings' },
  { name: 'progress', icon: 'progress', labelKey: 'ui_tabs.progress' },
  { name: 'me', icon: 'profile', labelKey: 'ui_tabs.profile' },
];

/** Translucent floating tab bar with labels; the record button sits in the middle. */
function TabBar({ state, navigation, onRecord }: BottomTabBarProps & { onRecord: () => void }) {
  const { t } = useTranslation();
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const pending = useSyncStore((s) => s.pendingCount);
  const surveyStatus = useSurveyStore((s) => s.status);
  if (surveyStatus === 'recording' || surveyStatus === 'acquiring_fix') return null;
  const active = state.routes[state.index]?.name;

  const tab = (d: (typeof TABS)[number]) => {
    const focused = active === d.name;
    const color = focused ? c.accent : c.ink2;
    return (
      <Press
        key={d.name}
        haptic={!focused}
        onPress={() => {
          if (!focused) navigation.navigate(d.name);
        }}
        accessibilityRole="tab"
        accessibilityLabel={t(d.labelKey)}
        accessibilityState={{ selected: focused }}
        style={{
          flex: 1,
          minHeight: 56,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          paddingTop: 4,
        }}
      >
        <View>
          <Symbol name={d.icon} size={23} color={color} weight={focused ? 'semibold' : 'regular'} />
          {d.name === 'activity' && pending > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: -4,
                right: -10,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                paddingHorizontal: 4,
                backgroundColor: c.warning,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                variant="caption"
                weight="700"
                style={{ color: c.onAccent, fontSize: 11, lineHeight: 13 }}
              >
                {pending > 99 ? '99+' : pending}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          variant="caption"
          weight={focused ? '600' : '400'}
          style={{ color, fontSize: 11, lineHeight: 13 }}
          numberOfLines={1}
        >
          {t(d.labelKey)}
        </Text>
        <View
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: focused ? c.accent : 'transparent',
          }}
        />
      </Press>
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: Math.max(insets.bottom - 8, 10),
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: 440,
          borderRadius: 32,
          overflow: 'hidden',
          borderWidth: 0.5,
          borderColor: c.hairline,
          backgroundColor: Platform.OS === 'android' ? c.surface : undefined,
          shadowColor: '#000',
          shadowOpacity: dark ? 0 : 0.08,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}
      >
        {Platform.OS !== 'android' ? (
          <BlurView
            intensity={80}
            tint={dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        ) : null}
        <View
          accessibilityRole="tablist"
          style={{ flexDirection: 'row', alignItems: 'center', height: 64, paddingHorizontal: 6 }}
        >
          {tab(TABS[0])}
          {tab(TABS[1])}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Press
              onPress={onRecord}
              accessibilityLabel={t('ui_tabs.record')}
              accessibilityHint={t('ui_tabs.record_hint')}
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: c.lime,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Symbol name="plus" size={26} color={c.onLime} weight="bold" />
            </Press>
          </View>
          {tab(TABS[2])}
          {tab(TABS[3])}
        </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { finishStructuredSurvey, logSurveySightings, sightings, setSelectedRouteForSurvey } =
    useAppState();
  const [recordOpen, setRecordOpen] = useState(false);
  const surveyStatus = useSurveyStore((s) => s.status);
  const isSurveyActive = surveyStatus === 'recording' || surveyStatus === 'acquiring_fix';

  const start = (mode: 'transect' | 'stationary_point') => {
    setSelectedRouteForSurvey(null);
    useSurveyStore.getState().startSurvey(mode);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Tabs
        backBehavior="history"
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.canvas } }}
        tabBar={(props) => <TabBar {...props} onRecord={() => setRecordOpen(true)} />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="activity" />
        <Tabs.Screen name="progress" />
        <Tabs.Screen name="me" />
      </Tabs>

      {surveyStatus === 'paused' ? (
        <View
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 16,
            right: 16,
            alignItems: 'center',
            zIndex: 9000,
          }}
        >
          <Press
            onPress={() => useSurveyStore.getState().resumeSurvey()}
            accessibilityLabel={t('ui_app.survey_paused_tap_to_resume')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              minHeight: 44,
              paddingHorizontal: 16,
              borderRadius: 22,
              backgroundColor: c.warningSoft,
            }}
          >
            <Symbol name="timer" size={18} color={c.warning} weight="semibold" />
            <Text variant="subhead" weight="600" style={{ color: c.warning }}>
              {t('ui_app.survey_paused_tap_to_resume')}
            </Text>
          </Press>
        </View>
      ) : null}

      {isSurveyActive ? (
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
          <SurveyWalkScreen
            sightings={sightings}
            onPause={() => useSurveyStore.getState().pauseSurvey()}
            logSightings={logSurveySightings}
            onSaved={finishStructuredSurvey}
          />
        </Modal>
      ) : null}

      <RecordSheet
        visible={recordOpen}
        onClose={() => setRecordOpen(false)}
        onQuickSighting={() => router.push('/opportunistic')}
        onWalk={() => start('transect')}
        onStationary={() => start('stationary_point')}
      />
    </View>
  );
}
