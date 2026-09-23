import React, { useState } from 'react';
import { registerRootComponent } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View, Text } from 'react-native';
import './src/i18n';
import { setAppLanguage } from './src/i18n';
import { ConsentScreen } from './src/screens/ConsentScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { OpportunisticScreen } from './src/screens/OpportunisticScreen';
import { StructuredSurveyScreen } from './src/screens/StructuredSurveyScreen';
import { GuidedPhotoScreen } from './src/screens/GuidedPhotoScreen';
import { TrainingScreen } from './src/screens/TrainingScreen';

type ScreenType =
  | 'consent'
  | 'home'
  | 'opportunistic'
  | 'survey'
  | 'guided_photo'
  | 'training';

export default function App() {
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('consent');
  const [capturedPhotos, setCapturedPhotos] = useState<any[]>([]);
  const [selectedPattern, setSelectedPattern] = useState<any>('tabby');
  
  // Mobile app local stats
  const [stats, setStats] = useState({
    sessionsCompleted: 1,
    kmWalked: 2.4,
    animalsRecorded: 5,
  });

  const handleAcceptConsent = (version: string) => {
    setConsentAccepted(true);
    setCurrentScreen('home');
  };

  const handleLanguageChange = (lng: 'ar' | 'fr' | 'en') => {
    setAppLanguage(lng);
  };

  const handleSaveOpportunistic = (observation: any) => {
    setStats((prev) => ({
      ...prev,
      animalsRecorded: prev.animalsRecorded + (observation.group_size || 1),
    }));
    setCurrentScreen('home');
    setCapturedPhotos([]);
  };

  const handleFinishStructuredSurvey = (sessionData: any) => {
    setStats((prev) => ({
      ...prev,
      sessionsCompleted: prev.sessionsCompleted + 1,
      kmWalked: prev.kmWalked + (sessionData.distance_km || 0),
    }));
    setCurrentScreen('home');
  };

  const handleLogAnimalInSurvey = (animal: any) => {
    setStats((prev) => ({
      ...prev,
      animalsRecorded: prev.animalsRecorded + (animal.group_size || 1),
    }));
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar style="auto" />

      {/* Screen Router */}
      {!consentAccepted || currentScreen === 'consent' ? (
        <ConsentScreen
          onAccept={handleAcceptConsent}
          onLanguageChange={handleLanguageChange}
        />
      ) : currentScreen === 'home' ? (
        <HomeScreen
          stats={stats}
          onStartSurvey={() => setCurrentScreen('survey')}
          onQuickSighting={() => setCurrentScreen('opportunistic')}
          onOpenTraining={() => setCurrentScreen('training')}
          onLanguageChange={handleLanguageChange}
        />
      ) : currentScreen === 'opportunistic' ? (
        <OpportunisticScreen
          onBack={() => setCurrentScreen('home')}
          onOpenPhotoCapture={() => setCurrentScreen('guided_photo')}
          onSaveObservation={handleSaveOpportunistic}
          capturedPhotosCount={capturedPhotos.length}
        />
      ) : currentScreen === 'survey' ? (
        <StructuredSurveyScreen
          onBack={() => setCurrentScreen('home')}
          onFinishSurvey={handleFinishStructuredSurvey}
          onLogAnimal={handleLogAnimalInSurvey}
          loggedAnimalsCount={stats.animalsRecorded}
        />
      ) : currentScreen === 'guided_photo' ? (
        <GuidedPhotoScreen
          onBack={() => setCurrentScreen('opportunistic')}
          onFinishCapture={(photos, pattern) => {
            setCapturedPhotos(photos);
            setSelectedPattern(pattern);
            setCurrentScreen('opportunistic');
          }}
        />
      ) : currentScreen === 'training' ? (
        <TrainingScreen onBack={() => setCurrentScreen('home')} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

registerRootComponent(App);

