/**
 * Sign in (v3). One screen: continue with Google, or email and password.
 * Signing in with an unknown email creates the account, so a new volunteer
 * never has to pick between two modes first.
 */
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, Press, Symbol, Text, useTheme } from '../ui';
import { supabase } from '../services/supabase';
import { signInWithGoogle, getOAuthRedirectUri } from '../services/googleAuthService';
import type { UserAccount } from '../app-state/types';

interface AuthGateScreenProps {
  onAuthenticated: (account: UserAccount) => void;
}

export const AuthGateScreen: React.FC<AuthGateScreenProps> = ({ onAuthenticated }) => {
  const { t } = useTranslation();

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [welcome, setWelcome] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  // Organisation is optional and set later in the profile
  const organization = '';
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithGoogle();
      if (!result.success) {
        Alert.alert(
          t('ui_authGate.google_sign_in'),
          result.error || t('ui_authGate.failed_to_authenticate_with_google')
        );
      } else if (result.user) {
        const userMeta = result.user.user_metadata || {};
        const displayName =
          userMeta.full_name || userMeta.name || result.user.email?.split('@')[0] || 'Surveyor';

        const account: UserAccount = {
          name: displayName,
          email: result.user.email || '',
          organization: '',
          role: 'surveyor',
          governorate: '',
          surveyorId: `OBS-${result.user.id.slice(0, 6).toUpperCase()}`,
          createdAt: result.user.created_at || new Date().toISOString(),
        };
        onAuthenticated(account);
      }
    } catch (err: any) {
      Alert.alert(
        t('ui_authGate.google_sign_in_error'),
        err?.message || t('ui_authGate.authentication_failed')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password) {
      Alert.alert(
        t('ui_authGate.required_fields'),
        t('ui_authGate.please_enter_both_your_email_address')
      );
      return;
    }

    if (authMode === 'signup' && !fullName.trim()) {
      Alert.alert(
        t('ui_authGate.required_field'),
        t('ui_authGate.please_enter_your_full_name_for')
      );
      return;
    }

    setIsLoading(true);
    try {
      const targetEmail = email.trim().toLowerCase();
      if (authMode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password,
        });

        let authedUser = data?.user;
        let finalError = error;

        // If credentials are not found, automatically register them with this password
        if (finalError && finalError.message.toLowerCase().includes('invalid login credentials')) {
          const autoName = fullName.trim() || targetEmail.split('@')[0] || 'Surveyor';
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: targetEmail,
            password,
            options: {
              data: {
                full_name: autoName,
                organization: organization.trim(),
                role: 'surveyor',
              },
            },
          });

          if (!signUpError && signUpData.session && signUpData.user) {
            authedUser = signUpData.user;
            finalError = null;
          }
        }

        if (finalError) {
          if (finalError.message.toLowerCase().includes('email not confirmed')) {
            Alert.alert(
              t('ui_authGate.email_confirmation_required'),
              t('ui_authGate.your_account_has_been_created_but')
            );
          } else {
            Alert.alert(t('ui_authGate.sign_in_failed'), finalError.message);
          }
        } else if (authedUser) {
          const userMeta = authedUser.user_metadata || {};
          const displayName =
            userMeta.full_name || userMeta.name || authedUser.email?.split('@')[0] || 'Surveyor';

          const account: UserAccount = {
            name: displayName,
            email: authedUser.email || '',
            organization: userMeta.organization || '',
            role: userMeta.role || 'surveyor',
            governorate: userMeta.governorate || '',
            surveyorId: `OBS-${authedUser.id.slice(0, 6).toUpperCase()}`,
            createdAt: authedUser.created_at || new Date().toISOString(),
          };
          onAuthenticated(account);
        }
      } else {
        const redirectUrl = getOAuthRedirectUri();
        const { data, error } = await supabase.auth.signUp({
          email: targetEmail,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: fullName.trim(),
              organization: organization.trim(),
              role: 'surveyor',
            },
          },
        });

        if (error) {
          Alert.alert(t('ui_authGate.account_creation_failed'), error.message);
        } else if (data.session && data.user) {
          // Instant session granted (email confirmation disabled)
          const account: UserAccount = {
            name: fullName.trim(),
            email: data.user.email || '',
            organization: organization.trim(),
            role: 'surveyor',
            governorate: '',
            surveyorId: `OBS-${data.user.id.slice(0, 6).toUpperCase()}`,
            createdAt: data.user.created_at || new Date().toISOString(),
          };

          Alert.alert(
            t('ui_authGate.account_ready'),
            t('ui_authGate.welcome_to_hawem_observatory_2', { v0: fullName.trim() })
          );
          onAuthenticated(account);
        } else if (data.user) {
          // Email confirmation is required by Supabase project
          Alert.alert(
            t('ui_authGate.account_created'),
            t('ui_authGate.a_confirmation_email_has_been_sent', { v0: email.trim() })
          );
          setAuthMode('signin');
        }
      }
    } catch (err: any) {
      Alert.alert(
        t('ui_authGate.authentication_error'),
        err?.message || t('ui_authGate.network_error')
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (welcome) {
    return (
      <Welcome
        onStart={() => {
          setAuthMode('signup');
          setWelcome(false);
        }}
        onSignIn={() => {
          setAuthMode('signin');
          setWelcome(false);
        }}
      />
    );
  }

  return (
    <AuthForm
      {...{
        authMode,
        setAuthMode,
        email,
        setEmail,
        password,
        setPassword,
        showPassword,
        setShowPassword,
        fullName,
        setFullName,
        isLoading,
        handleGoogleSignIn,
        handleEmailAuth,
      }}
    />
  );
};

function AuthForm(p: {
  authMode: 'signin' | 'signup';
  setAuthMode: (m: 'signin' | 'signup') => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  fullName: string;
  setFullName: (v: string) => void;
  isLoading: boolean;
  handleGoogleSignIn: () => void;
  handleEmailAuth: () => void;
}) {
  const { t } = useTranslation();
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const input = {
    backgroundColor: c.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    minHeight: 50,
    fontSize: 17,
    color: c.ink,
  } as const;
  const signup = p.authMode === 'signup';
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 48,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 24,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 22,
              backgroundColor: c.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Symbol name="paw" size={40} color={c.accent} weight="semibold" />
          </View>
          <Text variant="largeTitle" align="center">
            {t('ui_auth_v3.title')}
          </Text>
          <Text variant="body" tone="ink2" align="center">
            {t('ui_auth_v3.subtitle')}
          </Text>
        </View>

        <Button
          kind="secondary"
          icon="globe"
          title={t('ui_auth_v3.google')}
          onPress={p.handleGoogleSignIn}
          disabled={p.isLoading}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 }}>
          <View style={{ flex: 1, height: 0.5, backgroundColor: c.hairline }} />
          <Text variant="footnote" tone="ink3">
            {t('ui_auth_v3.or_email')}
          </Text>
          <View style={{ flex: 1, height: 0.5, backgroundColor: c.hairline }} />
        </View>

        {signup ? (
          <TextInput
            value={p.fullName}
            onChangeText={p.setFullName}
            placeholder={t('ui_profile.name_placeholder')}
            placeholderTextColor={c.ink3}
            style={input}
            autoComplete="name"
            textContentType="name"
            accessibilityLabel={t('ui_profile.name')}
          />
        ) : null}
        <TextInput
          value={p.email}
          onChangeText={p.setEmail}
          placeholder={t('ui_auth_v3.email')}
          placeholderTextColor={c.ink3}
          style={input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          accessibilityLabel={t('ui_auth_v3.email')}
        />
        <View style={[input, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0 }]}>
          <TextInput
            value={p.password}
            onChangeText={p.setPassword}
            placeholder={t('ui_auth_v3.password')}
            placeholderTextColor={c.ink3}
            style={{ flex: 1, paddingHorizontal: 14, minHeight: 50, fontSize: 17, color: c.ink }}
            secureTextEntry={!p.showPassword}
            autoCapitalize="none"
            autoComplete={signup ? 'new-password' : 'current-password'}
            textContentType={signup ? 'newPassword' : 'password'}
            accessibilityLabel={t('ui_auth_v3.password')}
            onSubmitEditing={p.handleEmailAuth}
          />
          <Press
            onPress={() => p.setShowPassword(!p.showPassword)}
            haptic={false}
            accessibilityLabel={
              p.showPassword ? t('ui_auth_v3.hide_password') : t('ui_auth_v3.show_password')
            }
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Symbol name="eye" size={20} color={p.showPassword ? c.accent : c.ink3} />
          </Press>
        </View>

        <Button
          title={signup ? t('ui_auth_v3.create') : t('ui_auth_v3.continue')}
          onPress={p.handleEmailAuth}
          loading={p.isLoading}
        />
        <Button
          kind="plain"
          size="small"
          title={signup ? t('ui_auth_v3.have_account') : t('ui_auth_v3.new_here')}
          onPress={() => p.setAuthMode(signup ? 'signin' : 'signup')}
        />

        <Text variant="footnote" tone="ink3" align="center" style={{ marginTop: 8 }}>
          {t('ui_auth_v3.privacy')}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** First screen before sign-in: one idea, one button. */
function Welcome({ onStart, onSignIn }: { onStart: () => void; onSignIn: () => void }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.accentSoft,
        paddingTop: insets.top + 32,
        paddingHorizontal: 28,
        paddingBottom: Math.max(insets.bottom, 20) + 8,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          backgroundColor: c.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Symbol name="paw" size={34} color={c.accent} weight="semibold" />
      </View>
      <View style={{ flex: 1, justifyContent: 'flex-end', gap: 16, paddingBottom: 32 }}>
        <Text
          variant="largeTitle"
          style={{ fontSize: 44, lineHeight: 50, color: c.accent }}
          accessibilityRole="header"
        >
          {t('ui_auth_v3.welcome_title')}
        </Text>
        <Text variant="body" style={{ color: c.accent, opacity: 0.85 }}>
          {t('ui_auth_v3.welcome_body')}
        </Text>
      </View>
      <Button title={t('ui_auth_v3.get_started')} onPress={onStart} />
      <Press
        onPress={onSignIn}
        haptic={false}
        accessibilityLabel={t('ui_auth_v3.have_account')}
        style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}
      >
        <Text variant="subhead" style={{ color: c.accent }}>
          {t('ui_auth_v3.have_account_q')}{' '}
          <Text variant="subhead" weight="700" style={{ color: c.accent }}>
            {t('ui_auth_v3.sign_in')}
          </Text>
        </Text>
      </Press>
    </View>
  );
}
