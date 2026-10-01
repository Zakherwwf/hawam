/**
 * First run (v3): three short pages. What you do, how people and animals are
 * protected (with the consent checkbox), and the permissions the phone needs,
 * each with the reason. Nothing is requested before the volunteer asks for it.
 */

import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, Press, Symbol, Text, useTheme, type SymbolName } from '../ui';

// v2.0: consent text no longer names a country or partner institution;
// everyone re-accepts once so what they agreed to matches what they read.
export const CURRENT_CONSENT_VERSION = 'v2.0';

type Perm = 'undetermined' | 'granted' | 'denied';

export function ConsentScreen({
  onAccept,
}: {
  onAccept: (version: string) => void;
  onLanguageChange?: (lang: 'ar' | 'fr' | 'en') => void;
}) {
  const { t } = useTranslation();
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [fg, setFg] = useState<Perm>('undetermined');
  const [bg, setBg] = useState<Perm>('undetermined');
  const [cam, setCam] = useState<Perm>('undetermined');
  const [asking, setAsking] = useState(false);

  const status = (p: { granted: boolean; canAskAgain: boolean }): Perm =>
    p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';

  useEffect(() => {
    (async () => {
      try {
        setFg(status(await Location.getForegroundPermissionsAsync()));
        setBg(status(await Location.getBackgroundPermissionsAsync()));
        setCam(status(await ImagePicker.getCameraPermissionsAsync()));
      } catch {
        // Web preview and simulators without these modules
      }
    })();
  }, []);

  const askAll = async () => {
    setAsking(true);
    try {
      const f = await Location.requestForegroundPermissionsAsync();
      setFg(f.granted ? 'granted' : 'denied');
      if (f.granted) {
        try {
          const b = await Location.requestBackgroundPermissionsAsync();
          setBg(b.granted ? 'granted' : 'denied');
        } catch {
          setBg('denied');
        }
      }
      const cm = await ImagePicker.requestCameraPermissionsAsync();
      setCam(cm.granted ? 'granted' : 'denied');
    } catch {
      // Handled by the statuses shown
    } finally {
      setAsking(false);
    }
  };

  const pages = [
    {
      title: t('ui_consent_v3.p1_title'),
      body: t('ui_consent_v3.p1_body'),
      points: [
        { icon: 'camera', title: t('ui_consent_v3.p1_a'), body: t('ui_consent_v3.p1_a_body') },
        { icon: 'walk', title: t('ui_consent_v3.p1_b'), body: t('ui_consent_v3.p1_b_body') },
        { icon: 'eye', title: t('ui_consent_v3.p1_c'), body: t('ui_consent_v3.p1_c_body') },
        { icon: 'progress', title: t('ui_consent_v3.p1_d'), body: t('ui_consent_v3.p1_d_body') },
      ],
    },
    {
      title: t('ui_consent_v3.p2_title'),
      body: t('ui_consent_v3.p2_body'),
      points: [
        { icon: 'paw', title: t('ui_consent_v3.p2_a'), body: t('ui_consent_v3.p2_a_body') },
        { icon: 'shield', title: t('ui_consent_v3.p2_b'), body: t('ui_consent_v3.p2_b_body') },
        { icon: 'pin', title: t('ui_consent_v3.p2_c'), body: t('ui_consent_v3.p2_c_body') },
        { icon: 'trash', title: t('ui_consent_v3.p2_d'), body: t('ui_consent_v3.p2_d_body') },
      ],
    },
  ] as const;

  const last = step === 2;
  const permRow = (icon: SymbolName, title: string, body: string, s: Perm, required: boolean) => (
    <View
      key={title}
      style={{
        flexDirection: 'row',
        gap: 14,
        backgroundColor: c.surface,
        borderRadius: radius.lg,
        padding: 16,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: c.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Symbol name={icon} size={20} color={c.accent} weight="semibold" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text variant="headline" style={{ flexShrink: 1 }}>
            {title}
          </Text>
          <Text variant="caption" tone="ink3">
            {required ? t('ui_consent_v3.required') : t('ui_consent_v3.recommended')}
          </Text>
        </View>
        <Text variant="footnote" tone="ink2">
          {body}
        </Text>
        <Text
          variant="footnote"
          weight="600"
          style={{
            marginTop: 4,
            color: s === 'granted' ? c.accent : s === 'denied' ? c.warning : c.ink3,
          }}
        >
          {s === 'granted'
            ? t('ui_consent_v3.allowed')
            : s === 'denied'
              ? t('ui_consent_v3.denied')
              : t('ui_consent_v3.not_asked')}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas, paddingTop: insets.top }}>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 12 }}
      >
        {step > 0 ? (
          <Button
            kind="plain"
            size="small"
            title={t('ui_common.back')}
            onPress={() => setStep(step - 1)}
          />
        ) : (
          <View style={{ width: 64 }} />
        )}
        <View
          style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 }}
          accessible
          accessibilityLabel={t('ui_consent_v3.step', { n: step + 1, total: 3 })}
        >
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: i === step ? 20 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i <= step ? c.accent : c.fill,
              }}
            />
          ))}
        </View>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 16, gap: 16 }}>
        {!last ? (
          <>
            <Text variant="largeTitle" accessibilityRole="header">
              {pages[step].title}
            </Text>
            <Text variant="body" tone="ink2">
              {pages[step].body}
            </Text>
            <View style={{ gap: 18, marginTop: 8 }}>
              {pages[step].points.map((pt) => (
                <View key={pt.title} style={{ flexDirection: 'row', gap: 14 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: c.accentSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Symbol name={pt.icon} size={20} color={c.accent} weight="semibold" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="headline">{pt.title}</Text>
                    <Text variant="subhead" tone="ink2">
                      {pt.body}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            {step === 1 ? (
              <Press
                onPress={() => setAgreed(!agreed)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreed }}
                accessibilityLabel={t('ui_consent_v3.agree')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: c.surface,
                  borderRadius: radius.lg,
                  padding: 16,
                  marginTop: 8,
                  borderWidth: 2,
                  borderColor: agreed ? c.accent : 'transparent',
                }}
              >
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    borderWidth: 2,
                    borderColor: agreed ? c.accent : c.ink3,
                    backgroundColor: agreed ? c.accent : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {agreed ? (
                    <Symbol name="check" size={16} color={c.onAccent} weight="bold" />
                  ) : null}
                </View>
                <Text variant="subhead" style={{ flex: 1 }}>
                  {t('ui_consent_v3.agree')}
                </Text>
              </Press>
            ) : null}
          </>
        ) : (
          <>
            <Text variant="largeTitle" accessibilityRole="header">
              {t('ui_consent_v3.p3_title')}
            </Text>
            <Text variant="body" tone="ink2">
              {t('ui_consent_v3.p3_body')}
            </Text>
            {permRow('locate', t('ui_consent_v3.loc'), t('ui_consent_v3.loc_body'), fg, true)}
            {permRow('walk', t('ui_consent_v3.bg'), t('ui_consent_v3.bg_body'), bg, false)}
            {permRow('camera', t('ui_consent_v3.cam'), t('ui_consent_v3.cam_body'), cam, false)}
          </>
        )}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16),
          gap: 8,
        }}
      >
        {step === 0 ? <Button title={t('ui_consent_v3.next')} onPress={() => setStep(1)} /> : null}
        {step === 1 ? (
          <Button title={t('ui_consent_v3.next')} onPress={() => setStep(2)} disabled={!agreed} />
        ) : null}
        {last ? (
          fg === 'granted' ? (
            <Button
              title={t('ui_consent_v3.start')}
              icon="check"
              onPress={() => onAccept(CURRENT_CONSENT_VERSION)}
            />
          ) : (
            <>
              <Button title={t('ui_consent_v3.allow')} onPress={askAll} loading={asking} />
              <Button
                kind="plain"
                size="small"
                title={t('ui_consent_v3.later')}
                onPress={() => onAccept(CURRENT_CONSENT_VERSION)}
              />
            </>
          )
        ) : null}
      </View>
    </View>
  );
}
