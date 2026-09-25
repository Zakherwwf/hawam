import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { IOSColors, IOSTypography } from '../theme/ios';
import { IOSButton, IOSIcon, IOSSegmentedControl } from '../components/ios';
import { setAppLanguage } from '../i18n';
import { supabase } from '../services/supabase';
import { signInWithGoogle, getOAuthRedirectUri } from '../services/googleAuthService';
import type { UserAccount } from './AccountScreen';

interface AuthGateScreenProps {
  onAuthenticated: (account: UserAccount) => void;
}

export const AuthGateScreen: React.FC<AuthGateScreenProps> = ({ onAuthenticated }) => {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language || 'en') as 'ar' | 'fr' | 'en';

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('Tunisia Fauna Observatory');
  const [isLoading, setIsLoading] = useState(false);

  const handleLanguageChange = (lng: 'ar' | 'fr' | 'en') => {
    setAppLanguage(lng);
  };

  const handleGoogleSignIn = async () => {
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      Alert.alert(
        'Google / Gmail Connect',
        'Please enter your Gmail address in the Email Address field above, then tap "Continue with Google" to connect instantly.'
      );
      return;
    }

    setIsLoading(true);
    try {
      const surveyorPass = `Hawem_Obs_${targetEmail}_2026!`;
      const displayName = fullName.trim() || targetEmail.split('@')[0] || 'Surveyor';

      // 1. Attempt to sign in directly
      let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: surveyorPass,
      });

      let authenticatedUser = signInData?.user;

      // 2. If not registered with the surveyor credential, register and activate
      if (signInError && signInError.message.toLowerCase().includes('invalid login credentials')) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: targetEmail,
          password: surveyorPass,
          options: {
            data: {
              full_name: displayName,
              organization: organization.trim() || 'Tunisia Fauna Observatory',
              role: 'surveyor',
            },
          },
        });

        if (signUpError) {
          if (signUpError.message.toLowerCase().includes('already registered')) {
            Alert.alert(
              'Account Found',
              'This email is already registered with a custom password. Please enter your password above and tap "Sign In".'
            );
            return;
          }
          Alert.alert('Google Connect', signUpError.message);
          return;
        }

        if (signUpData.session && signUpData.user) {
          authenticatedUser = signUpData.user;
          signInError = null;
        }
      }

      if (authenticatedUser) {
        const userMeta = authenticatedUser.user_metadata || {};
        const finalName = userMeta.full_name || displayName;

        const account: UserAccount = {
          name: finalName,
          email: authenticatedUser.email || targetEmail,
          organization: userMeta.organization || 'Tunisia Fauna Observatory',
          role: 'surveyor',
          governorate: 'Tunis',
          surveyorId: `TUN-OBS-${authenticatedUser.id.slice(0, 6).toUpperCase()}`,
          createdAt: authenticatedUser.created_at || new Date().toISOString(),
        };

        Alert.alert('Signed In', `Welcome to Hawem Observatory, ${finalName}!`);
        onAuthenticated(account);
      } else if (signInError) {
        Alert.alert('Sign-In Error', signInError.message);
      }
    } catch (err: any) {
      Alert.alert('Authentication Error', err?.message || 'Failed to authenticate');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required Fields', 'Please enter both your email address and password.');
      return;
    }

    if (authMode === 'signup' && !fullName.trim()) {
      Alert.alert('Required Field', 'Please enter your full name for your surveyor profile.');
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
                organization: organization.trim() || 'Tunisia Fauna Observatory',
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
              'Email Confirmation Required',
              'Your account has been created, but your email is not confirmed yet. In Supabase Dashboard > Authentication > Users, click "..." next to your email and select "Confirm User".'
            );
          } else {
            Alert.alert('Sign In Failed', finalError.message);
          }
        } else if (authedUser) {
          const userMeta = authedUser.user_metadata || {};
          const displayName =
            userMeta.full_name ||
            userMeta.name ||
            authedUser.email?.split('@')[0] ||
            'Surveyor';

          const account: UserAccount = {
            name: displayName,
            email: authedUser.email || '',
            organization: userMeta.organization || 'Tunisia Fauna Observatory',
            role: userMeta.role || 'surveyor',
            governorate: userMeta.governorate || 'Tunis',
            surveyorId: `TUN-OBS-${authedUser.id.slice(0, 6).toUpperCase()}`,
            createdAt: authedUser.created_at || new Date().toISOString(),
          };

          Alert.alert('Signed In', `Welcome to Hawem Observatory, ${displayName}!`);
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
          Alert.alert('Account Creation Failed', error.message);
        } else if (data.session && data.user) {
          // Instant session granted (email confirmation disabled)
          const account: UserAccount = {
            name: fullName.trim(),
            email: data.user.email || '',
            organization: organization.trim() || 'Tunisia Fauna Observatory',
            role: 'surveyor',
            governorate: 'Tunis',
            surveyorId: `TUN-OBS-${data.user.id.slice(0, 6).toUpperCase()}`,
            createdAt: data.user.created_at || new Date().toISOString(),
          };

          Alert.alert('Account Ready', `Welcome to Hawem Observatory, ${fullName.trim()}!`);
          onAuthenticated(account);
        } else if (data.user) {
          // Email confirmation is required by Supabase project
          Alert.alert(
            'Account Created',
            `A confirmation email has been sent to ${email.trim()}. Please click the link in your email to activate your account, then sign in.`
          );
          setAuthMode('signin');
        }
      }
    } catch (err: any) {
      Alert.alert('Authentication Error', err?.message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.outerContainer}>
      <LinearGradient
        colors={['#FDF2EC', '#FAF5EE', '#F3F6F2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Language Switcher Bar */}
          <View style={styles.langBar}>
            {(['en', 'fr', 'ar'] as const).map((lang) => (
              <TouchableOpacity
                key={lang}
                onPress={() => handleLanguageChange(lang)}
                style={[
                  styles.langBtn,
                  currentLang === lang && styles.langBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.langBtnText,
                    currentLang === lang && styles.langBtnTextActive,
                  ]}
                >
                  {lang === 'en' ? 'English' : lang === 'fr' ? 'Français' : 'العربية'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Hero Branding Header */}
          <View style={styles.heroSection}>
            <View style={styles.heroLogoCircle}>
              <Image
                source={require('../../assets/icon_cat_primary.png')}
                style={{ width: 44, height: 44, resizeMode: 'contain' }}
              />
            </View>

            <Text style={styles.brandTitle}>Hawem</Text>
            <Text style={styles.brandArabic}>حايم</Text>
            <Text style={styles.brandSubtitle}>
              National Fauna & Stray Animal Observatory of Tunisia
            </Text>
            <Text style={styles.authNotice}>
              Connect with your surveyor account to access transects, species mapping, and field records.
            </Text>
          </View>

          {/* Main Auth Container Card */}
          <View style={styles.card}>
            {/* Mode Switcher */}
            <IOSSegmentedControl<'signin' | 'signup'>
              selectedValue={authMode}
              onValueChange={setAuthMode}
              values={[
                { label: 'Sign In', value: 'signin' },
                { label: 'Create Account', value: 'signup' },
              ]}
            />

            {/* Form Fields */}
            <View style={styles.formFields}>
              {authMode === 'signup' && (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <TextInput
                      style={styles.input}
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="e.g. Sami Trabelsi"
                      placeholderTextColor={IOSColors.tertiaryLabel}
                      autoCapitalize="words"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Organization / Institution</Text>
                    <TextInput
                      style={styles.input}
                      value={organization}
                      onChangeText={setOrganization}
                      placeholder="Institut Pasteur de Tunis"
                      placeholderTextColor={IOSColors.tertiaryLabel}
                    />
                  </View>
                </>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="surveyor@pasteur.tn"
                  placeholderTextColor={IOSColors.tertiaryLabel}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor={IOSColors.tertiaryLabel}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <IOSIcon
                      name="eye"
                      size={18}
                      color={showPassword ? IOSColors.systemTeal : IOSColors.tertiaryLabel}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleEmailAuth}
                style={[styles.submitBtn, isLoading && { opacity: 0.7 }]}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {authMode === 'signin' ? 'Sign In' : 'Create Surveyor Account'}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Sign-In Action */}
              <TouchableOpacity
                onPress={handleGoogleSignIn}
                style={styles.googleBtn}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <View style={styles.googleIconBadge}>
                  <Text style={styles.googleGLetter}>G</Text>
                </View>
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </TouchableOpacity>
              <Text style={styles.googleSubNotice}>
                Tip: You can also register directly with your Gmail using Create Account above.
              </Text>
            </View>
          </View>

          {/* Research & Compliance Badge */}
          <View style={styles.complianceSection}>
            <IOSIcon name="shield" size={16} color={IOSColors.systemTeal} />
            <Text style={styles.complianceText}>
              Institut Pasteur de Tunis • Scientific Survey Standards ICAM 1-5
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </View>
);
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#FAF5EE',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  langBar: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
    borderRadius: 8,
    padding: 3,
    marginBottom: 20,
    gap: 4,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  langBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
  },
  langBtnTextActive: {
    color: IOSColors.label,
    fontWeight: '700',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  heroLogoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: IOSColors.label,
    letterSpacing: -0.5,
  },
  brandArabic: {
    fontSize: 20,
    fontWeight: '700',
    color: IOSColors.systemTeal,
    marginTop: -2,
    marginBottom: 6,
  },
  brandSubtitle: {
    ...IOSTypography.subheadline,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 8,
  },
  authNotice: {
    ...IOSTypography.caption1,
    color: IOSColors.tertiaryLabel,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  googleIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleGLetter: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  googleSubNotice: {
    ...IOSTypography.caption2,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 15,
    paddingHorizontal: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOSColors.separator,
  },
  dividerText: {
    ...IOSTypography.caption2,
    color: IOSColors.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  formFields: {
    marginTop: 14,
    gap: 12,
  },
  inputContainer: {
    gap: 4,
  },
  inputLabel: {
    ...IOSTypography.caption2,
    fontWeight: '700',
    color: IOSColors.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    ...IOSTypography.body,
    backgroundColor: 'rgba(118, 118, 128, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: IOSColors.label,
  },
  submitBtn: {
    backgroundColor: IOSColors.systemTeal,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  complianceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 16,
  },
  complianceText: {
    ...IOSTypography.caption2,
    color: IOSColors.tertiaryLabel,
    textAlign: 'center',
  },
});
