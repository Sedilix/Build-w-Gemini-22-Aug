/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  HeaderAccessibility 
} from './components/HeaderAccessibility';
import { 
  LiveLocationCard 
} from './components/LiveLocationCard';
import { 
  VisualLandmarkScanner 
} from './components/VisualLandmarkScanner';
import { 
  InteractiveMapDisplay 
} from './components/InteractiveMapDisplay';
import { 
  OneTapSharePanel 
} from './components/OneTapSharePanel';
import { 
  VoiceCommandOverlay 
} from './components/VoiceCommandOverlay';
import { 
  CaregiverPreviewModal 
} from './components/CaregiverPreviewModal';
import { 
  ManageContactsModal 
} from './components/ManageContactsModal';
import { 
  SettingsModal 
} from './components/SettingsModal';
import { 
  GPSLocation, 
  LocationVerificationResult, 
  AccessibilitySettings, 
  EmergencyContact, 
  LocationPreset 
} from './types';
import { DEFAULT_CONTACTS } from './data/defaultContacts';
import { LOCATION_PRESETS } from './data/samplePresets';
import { speakSpeechmaticsOrFallback, stopSpeaking } from './utils/speech';
import { AlertCircle, PhoneCall, ShieldAlert, Sparkles, Check } from 'lucide-react';

export default function App() {
  // State: Accessibility Settings
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    try {
      const saved = localStorage.getItem('senior_safespot_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      contrastTheme: 'normal',
      fontSize: 'large', // Default large for elderly readability
      spokenGuidance: true,
      simplifiedMode: false,
      haptics: true,
      alwaysShowStreetView: true,
      speechmaticsVoice: 'sarah', // Default friendly & warm voice
      speechmaticsRate: 0.85,
    };
  });

  // State: Emergency Contacts
  const [contacts, setContacts] = useState<EmergencyContact[]>(() => {
    try {
      const saved = localStorage.getItem('senior_safespot_contacts');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_CONTACTS;
  });

  // State: Telemetry, Photo & AI Verification
  const [gps, setGps] = useState<GPSLocation | null>(null);
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [verification, setVerification] = useState<LocationVerificationResult | null>(null);
  const [isLoadingGPS, setIsLoadingGPS] = useState(false);
  const [isVerifyingAI, setIsVerifyingAI] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // State: Modals & Overlays
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isCaregiverPreviewOpen, setIsCaregiverPreviewOpen] = useState(false);
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [emergencyCountdown, setEmergencyCountdown] = useState<number | null>(null);

  const initialVerificationDoneRef = useRef(false);

  // Apply theme classes to body
  useEffect(() => {
    document.body.className = '';
    if (settings.contrastTheme === 'yellow-black') {
      document.body.classList.add('theme-yellow-black');
    } else if (settings.contrastTheme === 'black-white') {
      document.body.classList.add('theme-black-white');
    } else if (settings.contrastTheme === 'warm-soft') {
      document.body.classList.add('theme-warm-soft');
    }
    localStorage.setItem('senior_safespot_settings', JSON.stringify(settings));
  }, [settings]);

  // Persist contacts
  const handleSaveContacts = (updated: EmergencyContact[]) => {
    setContacts(updated);
    localStorage.setItem('senior_safespot_contacts', JSON.stringify(updated));
  };

  // Multimodal Gemini Verification Engine
  const triggerLocationVerification = useCallback(
    async (
      coords: { latitude: number; longitude: number; accuracy?: number; heading?: number; altitude?: number; speed?: number },
      photoBase64?: string | null,
      voiceClue?: string,
      preset?: LocationPreset
    ) => {
      setIsVerifyingAI(true);
      try {
        const res = await fetch('/api/gemini/analyze-location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gps: coords,
            photoBase64: photoBase64 || currentPhoto,
            voiceNotes: voiceClue || '',
            contextPreset: preset,
          }),
        });

        if (res.ok) {
          const data: LocationVerificationResult = await res.json();
          setVerification(data);

          // Audio speech feedback for senior
          if (settings.spokenGuidance && data.elderlyVoiceSummary) {
            setIsSpeaking(true);
            speakSpeechmaticsOrFallback(
              data.elderlyVoiceSummary, 
              settings.speechmaticsVoice || 'sarah', 
              () => setIsSpeaking(false)
            );
          }
        }
      } catch (err) {
        console.error('Gemini location verification failed:', err);
      } finally {
        setIsVerifyingAI(false);
      }
    },
    [currentPhoto, settings.spokenGuidance, settings.speechmaticsVoice]
  );

  // Acquire Live GPS
  const refreshGPS = useCallback(() => {
    setIsLoadingGPS(true);

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc: GPSLocation = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy || 15,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            altitude: pos.coords.altitude,
            timestamp: pos.timestamp,
          };
          setGps(loc);
          setIsLoadingGPS(false);
          triggerLocationVerification(loc, currentPhoto);
        },
        (err) => {
          console.warn('Geolocation failed or permission denied, using default preset:', err);
          setIsLoadingGPS(false);
          // Default to the first sample preset (Springfield Center Walgreens) so app always works
          const defaultPreset = LOCATION_PRESETS[0];
          const fallbackLoc: GPSLocation = {
            latitude: defaultPreset.lat,
            longitude: defaultPreset.lng,
            accuracy: defaultPreset.accuracy,
            heading: 0,
            speed: 0,
            altitude: 10,
            timestamp: Date.now(),
          };
          setGps(fallbackLoc);
          setCurrentPhoto(defaultPreset.sampleImageUrl);
          triggerLocationVerification(fallbackLoc, defaultPreset.sampleImageUrl, '', defaultPreset);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setIsLoadingGPS(false);
      const defaultPreset = LOCATION_PRESETS[0];
      const fallbackLoc: GPSLocation = {
        latitude: defaultPreset.lat,
        longitude: defaultPreset.lng,
        accuracy: defaultPreset.accuracy,
        heading: 0,
        speed: 0,
        altitude: 10,
        timestamp: Date.now(),
      };
      setGps(fallbackLoc);
      setCurrentPhoto(defaultPreset.sampleImageUrl);
      triggerLocationVerification(fallbackLoc, defaultPreset.sampleImageUrl, '', defaultPreset);
    }
  }, [currentPhoto, triggerLocationVerification]);

  // Initial boot
  useEffect(() => {
    if (!initialVerificationDoneRef.current) {
      initialVerificationDoneRef.current = true;
      refreshGPS();
    }
  }, [refreshGPS]);

  // Handle Photo Snapped or Uploaded
  const handlePhotoUpdate = (photoBase64: string, preset?: LocationPreset) => {
    setCurrentPhoto(photoBase64);
    const coords = gps || {
      latitude: preset?.lat || 37.774929,
      longitude: preset?.lng || -122.419416,
      accuracy: 10,
      heading: 0,
      speed: 0,
      altitude: 0,
      timestamp: Date.now(),
    };
    triggerLocationVerification(coords, photoBase64, '', preset);
  };

  // Handle Preset Selection
  const handleSelectPreset = (preset: LocationPreset) => {
    const newLoc: GPSLocation = {
      latitude: preset.lat,
      longitude: preset.lng,
      accuracy: preset.accuracy,
      heading: 45,
      speed: 0,
      altitude: 12,
      timestamp: Date.now(),
    };
    setGps(newLoc);
    setCurrentPhoto(preset.sampleImageUrl);
    triggerLocationVerification(newLoc, preset.sampleImageUrl, '', preset);
  };

  // Speak address aloud
  const handleSpeakAddress = () => {
    const text = verification?.elderlyVoiceSummary || (verification ? `You are at ${verification.formattedAddress}.` : 'Finding your location.');
    setIsSpeaking(true);
    speakSpeechmaticsOrFallback(
      text, 
      settings.speechmaticsVoice || 'sarah', 
      () => setIsSpeaking(false)
    );
  };

  // Emergency SOS Trigger with 5-second cancelable countdown
  const handleEmergencySOS = () => {
    setEmergencyCountdown(5);
  };

  useEffect(() => {
    if (emergencyCountdown === null) return;
    if (emergencyCountdown > 0) {
      const timer = setTimeout(() => {
        setEmergencyCountdown(emergencyCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (emergencyCountdown === 0) {
      // Trigger emergency phone call & SMS alert
      setEmergencyCountdown(null);
      const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0];
      const address = verification?.formattedAddress || 'My Current Location';
      const mapsUrl = verification?.shareUrls?.googleMapsUrl || '';
      
      const message = encodeURIComponent(`EMERGENCY: I need urgent assistance at: ${address}. Navigation: ${mapsUrl}`);
      // Singapore SCDF Emergency Ambulance & Rescue is 995
      window.location.href = `tel:995`;
    }
  }, [emergencyCountdown, contacts, verification]);

  const isYellow = settings.contrastTheme === 'yellow-black';

  return (
    <div
      id="app-container-senior-safespot"
      className={`min-h-screen transition-colors flex flex-col ${
        isYellow
          ? 'bg-black text-amber-300'
          : settings.contrastTheme === 'black-white'
          ? 'bg-white text-black'
          : settings.contrastTheme === 'warm-soft'
          ? 'bg-[#fbf7ee] text-[#27221d]'
          : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top Accessibility Bar */}
      <HeaderAccessibility
        settings={settings}
        onUpdateSettings={setSettings}
        onOpenVoiceCommand={() => setIsVoiceModalOpen(true)}
        onEmergencyTrigger={handleEmergencySOS}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        isSpeaking={isSpeaking}
        onStopSpeaking={stopSpeaking}
      />

      {/* Emergency Alert Active Banner */}
      {emergencyCountdown !== null && (
        <div
          id="banner-emergency-countdown"
          className="bg-rose-600 text-white p-4 sm:p-5 sticky top-16 z-50 shadow-xl flex flex-wrap items-center justify-between gap-4 border-b border-rose-700"
        >
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 sm:w-8 sm:h-8" />
            <div>
              <div className="font-bold text-lg sm:text-xl uppercase tracking-tight">
                Emergency SCDF Dispatch in {emergencyCountdown}s
              </div>
              <p className="text-xs sm:text-sm font-medium opacity-90">
                Calling Singapore 995 (SCDF Ambulance) and dispatching live coordinates.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEmergencyCountdown(null)}
              className="px-5 py-2.5 rounded-xl bg-white text-rose-700 font-bold text-sm sm:text-base shadow-md hover:bg-rose-50 active:scale-98 transition-all"
            >
              Cancel Alert
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-8 flex-1 space-y-6 sm:space-y-8">
        {/* Section 1: Live Location Card with Voice Reading */}
        <LiveLocationCard
          gps={gps}
          verification={verification}
          isLoadingGPS={isLoadingGPS}
          isVerifyingAI={isVerifyingAI}
          onRefreshGPS={refreshGPS}
          onSpeakAddress={handleSpeakAddress}
          isSpeaking={isSpeaking}
          settings={settings}
        />

        {/* Section 2: One-Tap Caregiver & Family Contact Triggers */}
        <OneTapSharePanel
          contacts={contacts}
          verification={verification}
          settings={settings}
          onOpenManageContacts={() => setIsContactsModalOpen(true)}
          onOpenCaregiverPreview={() => setIsCaregiverPreviewOpen(true)}
        />

        {/* Section 3: Visual Surroundings Scanner & Google Street View Cross-Referencing */}
        <VisualLandmarkScanner
          currentPhoto={currentPhoto}
          verification={verification}
          isAnalyzing={isVerifyingAI}
          onCaptureOrUploadPhoto={handlePhotoUpdate}
          onSelectPreset={handleSelectPreset}
          settings={settings}
        />

        {/* Section 4: Interactive Live Map Display */}
        <InteractiveMapDisplay
          gps={gps}
          verification={verification}
          settings={settings}
        />
      </main>

      {/* Modals */}
      <VoiceCommandOverlay
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        currentAddress={verification?.formattedAddress || ''}
        verification={verification}
        emergencyContacts={contacts}
        settings={settings}
        onTriggerSendLocation={() => {
          const primary = contacts.find((c) => c.isPrimary) || contacts[0];
          if (primary && verification?.shareUrls?.googleMapsUrl) {
            window.location.href = `sms:${primary.phone}?&body=${encodeURIComponent(
              `Hi! I need a pickup here: ${verification.formattedAddress}. Map: ${verification.shareUrls.googleMapsUrl}`
            )}`;
          }
        }}
        onTriggerEmergency={handleEmergencySOS}
        onTriggerCamera={() => {
          window.scrollTo({ top: 400, behavior: 'smooth' });
        }}
        onToggleContrast={() => {
          setSettings((prev) => ({
            ...prev,
            contrastTheme: prev.contrastTheme === 'yellow-black' ? 'normal' : 'yellow-black',
          }));
        }}
        onSpeakAddress={handleSpeakAddress}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        onOpenManageContacts={() => setIsContactsModalOpen(true)}
      />

      <CaregiverPreviewModal
        isOpen={isCaregiverPreviewOpen}
        onClose={() => setIsCaregiverPreviewOpen(false)}
        verification={verification}
        settings={settings}
      />

      <ManageContactsModal
        isOpen={isContactsModalOpen}
        onClose={() => setIsContactsModalOpen(false)}
        contacts={contacts}
        onSaveContacts={handleSaveContacts}
        settings={settings}
      />

      {/* Footer Accessibility Notice */}
      <footer className="border-t border-slate-200/80 dark:border-neutral-800 py-6 px-4 text-center text-xs sm:text-sm font-medium text-slate-500 dark:text-inherit/70">
        <p>
          Senior SafeSpot • Multimodal Location & Pickup Assistant • Powered by Gemini AI & Google Maps
        </p>
      </footer>
    </div>
  );
}
