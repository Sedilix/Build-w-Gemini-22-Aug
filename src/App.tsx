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
  CaregiverLiveTracker 
} from './components/CaregiverLiveTracker';
import { 
  AuthModal 
} from './components/AuthModal';
import { 
  ProfileModal 
} from './components/ProfileModal';
import { 
  GPSLocation, 
  LocationVerificationResult, 
  AccessibilitySettings, 
  EmergencyContact, 
  LocationPreset,
  UserProfile,
  BatteryStatus,
  SPEECHMATICS_VOICE_OPTIONS
} from './types';
import { DEFAULT_CONTACTS } from './data/defaultContacts';
import { LOCATION_PRESETS } from './data/samplePresets';
import { speakSpeechmaticsOrFallback, stopSpeaking } from './utils/speech';
import { getBatteryStatus, watchBattery } from './utils/telemetry';
import { ensureMotionPermission, startFallDetection, FallDetectionHandle } from './utils/fallDetection';
import { auth, subscribeToUserProfile, saveUserProfile, createIncident, updateIncident } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { AlertCircle, PhoneCall, ShieldAlert, Sparkles, Check } from 'lucide-react';
import { t } from './locales/translations';

export default function App() {
  // Caregiver live tracking route: /track/:incidentId renders the read-only
  // dashboard for family members instead of the elder app.
  const trackMatch = typeof window !== 'undefined'
    ? window.location.pathname.match(/^\/track\/([^/]+)/)
    : null;
  if (trackMatch) {
    return <CaregiverLiveTracker incidentId={trackMatch[1]} />;
  }
  return <SeniorSafeSpotHome />;
}

function SeniorSafeSpotHome() {
  // State: Firebase User & Firestore Profile
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // State: Accessibility Settings
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    const validVoiceIds = SPEECHMATICS_VOICE_OPTIONS.map((v) => v.id);
    try {
      const saved = localStorage.getItem('senior_safespot_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migrate stale voice IDs from localStorage (e.g. removed voices like 'ariana')
        // back to the default so TTS does not silently fall back to Web Speech API.
        if (parsed && !validVoiceIds.includes(parsed.speechmaticsVoice)) {
          parsed.speechmaticsVoice = 'sarah';
        }
        if (parsed && !['en', 'zh', 'ms', 'ta'].includes(parsed.language)) {
          parsed.language = 'en';
        }
        return parsed;
      }
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
      language: 'en', // Singapore default; switchable to zh / ms / ta
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

  // State: Battery telemetry, live incident & fall detection
  const [battery, setBattery] = useState<BatteryStatus>({ level: null, charging: null, supported: false });
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(
    () => localStorage.getItem('senior_safespot_active_incident')
  );
  const [isAlertingFamily, setIsAlertingFamily] = useState(false);
  const [fallCountdown, setFallCountdown] = useState<number | null>(null);

  const initialVerificationDoneRef = useRef(false);
  const lastIncidentGpsPushRef = useRef(0);

  const lang = settings.language || 'en';

  // Live battery telemetry (attached to SOS dispatches & live incidents)
  useEffect(() => {
    let mounted = true;
    getBatteryStatus().then((status) => {
      if (mounted) setBattery(status);
    });
    const unwatch = watchBattery((status) => setBattery(status));
    return () => {
      mounted = false;
      unwatch();
    };
  }, []);

  // Firebase Auth & Firestore Users Collection Sync
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        // Subscribe to Firestore Users/{uid}
        const unsubscribeProfile = subscribeToUserProfile(user.uid, (profile) => {
          setUserProfile(profile);
          if (profile && profile.emergencyContacts && profile.emergencyContacts.length > 0) {
            setContacts(profile.emergencyContacts);
            localStorage.setItem('senior_safespot_contacts', JSON.stringify(profile.emergencyContacts));
          }
        });
        return () => unsubscribeProfile();
      } else {
        setUserProfile(null);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Apply theme classes to body + root font scaling for senior readability
  useEffect(() => {
    document.body.className = '';
    if (settings.contrastTheme === 'yellow-black') {
      document.body.classList.add('theme-yellow-black');
    } else if (settings.contrastTheme === 'black-white') {
      document.body.classList.add('theme-black-white');
    } else if (settings.contrastTheme === 'warm-soft') {
      document.body.classList.add('theme-warm-soft');
    }
    document.documentElement.setAttribute('data-fs', settings.fontSize);
    localStorage.setItem('senior_safespot_settings', JSON.stringify(settings));
  }, [settings]);

  // Persist contacts and sync to Firestore if user is authenticated
  const handleSaveContacts = async (updated: EmergencyContact[]) => {
    setContacts(updated);
    localStorage.setItem('senior_safespot_contacts', JSON.stringify(updated));

    if (currentUser) {
      try {
        await saveUserProfile({
          uid: currentUser.uid,
          emergencyContacts: updated,
        });
      } catch (e) {
        console.warn('Could not sync contacts to Firestore Users collection:', e);
      }
    }
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
              () => setIsSpeaking(false),
              settings.speechmaticsRate ?? 0.85,
              settings.language || 'en'
            );
          }
        }
      } catch (err) {
        console.error('Gemini location verification failed:', err);
      } finally {
        setIsVerifyingAI(false);
      }
    },
    [currentPhoto, settings.spokenGuidance, settings.speechmaticsVoice, settings.speechmaticsRate, settings.language]
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
          // Default to the first sample preset (Toa Payoh Hub) so app always works
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
      latitude: preset?.lat || 1.3327,
      longitude: preset?.lng || 103.8479,
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
      () => setIsSpeaking(false),
      settings.speechmaticsRate ?? 0.85,
      lang
    );
  };

  /**
   * Create a Firestore `Incidents/{id}` doc seeded with the elder's identity,
   * medical profile, current GPS, and live battery. Returns the incident ID
   * so callers can build the `/track/:id` caregiver link.
   */
  const createLiveIncident = useCallback(async (): Promise<string | null> => {
    try {
      const batt = battery.supported ? battery : await getBatteryStatus();
      const now = Date.now();
      const incidentId = await createIncident({
        elderUid: currentUser?.uid || null,
        elderName: userProfile?.actualName || currentUser?.displayName || 'Senior',
        elderSelfieUrl: userProfile?.selfiePhotoUrl,
        bloodType: userProfile?.bloodType,
        medicalNotes: userProfile?.medicalNotes || '',
        currentGps: gps
          ? { lat: gps.latitude, lng: gps.longitude, accuracy: gps.accuracy, timestamp: gps.timestamp }
          : null,
        batteryLevel: batt.level,
        isCharging: batt.charging,
        nearestLandmarks: (verification?.visualLandmarks || [])
          .filter((l) => l.matchedInStreetView)
          .slice(0, 5)
          .map((l) => `${l.name} — ${l.description}`),
        formattedAddress: verification?.formattedAddress,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      localStorage.setItem('senior_safespot_active_incident', incidentId);
      setActiveIncidentId(incidentId);
      return incidentId;
    } catch (err) {
      console.error('Failed to create live incident:', err);
      return null;
    }
  }, [battery, currentUser, userProfile, gps, verification]);

  // Alert Family & Live Track: create incident, then open SMS composer to the
  // primary contact with the /track/:id real-time tracking link.
  const handleAlertFamily = async () => {
    setIsAlertingFamily(true);
    try {
      const incidentId = await createLiveIncident();
      if (!incidentId) return;
      const trackUrl = `${window.location.origin}/track/${incidentId}`;
      const primary = contacts.find((c) => c.isPrimary) || contacts[0];
      const batteryText = battery.level !== null ? ` Battery: ${battery.level}%.` : '';
      const message = encodeURIComponent(
        `EMERGENCY: ${userProfile?.actualName || 'I'} need assistance at: ${verification?.formattedAddress || 'My Current Location'}.${batteryText}\nLive tracking: ${trackUrl}\nMap: ${verification?.shareUrls?.googleMapsUrl || ''}`
      );
      if (primary) {
        window.location.href = `sms:${primary.phone.replace(/[^0-9+]/g, '')}?&body=${message}`;
      } else {
        await navigator.clipboard?.writeText(trackUrl);
      }
    } finally {
      setIsAlertingFamily(false);
    }
  };

  // While an incident is active, stream live GPS + battery into Firestore so
  // caregivers watching /track/:id see real-time updates. Throttled to 5s.
  useEffect(() => {
    if (!activeIncidentId) return;

    let watchId: number | null = null;
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const now = Date.now();
          if (now - lastIncidentGpsPushRef.current < 5000) return;
          lastIncidentGpsPushRef.current = now;
          void updateIncident(activeIncidentId, {
            currentGps: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy || 15,
              timestamp: pos.timestamp,
            },
          });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 3000 }
      );
    }

    const unwatchBattery = watchBattery((status) => {
      void updateIncident(activeIncidentId, {
        batteryLevel: status.level,
        isCharging: status.charging,
      });
    });

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      unwatchBattery();
    };
  }, [activeIncidentId]);

  // Passive fall monitoring via accelerometer (opt-in via settings)
  useEffect(() => {
    if (!settings.fallDetection) return;
    let handle: FallDetectionHandle | null = null;
    let cancelled = false;

    ensureMotionPermission().then((granted) => {
      if (cancelled || !granted) return;
      handle = startFallDetection(() => setFallCountdown(10));
    });

    return () => {
      cancelled = true;
      handle?.stop();
    };
  }, [settings.fallDetection]);

  // Fall countdown: reassuring audio + big cancel button, auto-dials 995 at 0
  useEffect(() => {
    if (fallCountdown === null) return;

    if (fallCountdown === 10 && settings.spokenGuidance) {
      speakSpeechmaticsOrFallback(
        `${t('fall.title', lang)}. ${t('fall.desc', lang)}`,
        settings.speechmaticsVoice || 'sarah',
        undefined,
        0.95,
        lang
      );
    }

    if (fallCountdown > 0) {
      const timer = setTimeout(() => setFallCountdown((c) => (c === null ? null : c - 1)), 1000);
      return () => clearTimeout(timer);
    } else {
      setFallCountdown(null);
      void createLiveIncident();
      window.location.href = 'tel:995';
    }
  }, [fallCountdown, settings.spokenGuidance, settings.speechmaticsVoice, lang, createLiveIncident]);

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
      // Trigger emergency phone call & live incident dispatch
      setEmergencyCountdown(null);
      const address = verification?.formattedAddress || 'My Current Location';
      const batteryText = battery.level !== null ? ` Battery: ${battery.level}%${battery.charging ? ' (charging)' : ''}.` : '';
      console.info(`SOS SCDF dispatch — address: ${address}.${batteryText}`);
      // Create the live incident so family/SCDF can track via /track/:id,
      // then immediately dial Singapore 995.
      void createLiveIncident();
      window.location.href = `tel:995`;
    }
  }, [emergencyCountdown, verification, battery, createLiveIncident]);

  return (
    <div
      id="app-container-senior-safespot"
      className="bg-bg text-ink flex min-h-screen flex-col transition-colors"
    >
      {/* Top Accessibility Bar */}
      <HeaderAccessibility
        settings={settings}
        onUpdateSettings={setSettings}
        onOpenVoiceCommand={() => setIsVoiceModalOpen(true)}
        onEmergencyTrigger={handleEmergencySOS}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        user={currentUser}
        profile={userProfile}
        isSpeaking={isSpeaking}
        onStopSpeaking={stopSpeaking}
      />

      {/* Emergency Alert Active Banner */}
      {emergencyCountdown !== null && (
        <div
          id="banner-emergency-countdown"
          className="bg-brick text-on-brick border-brick-deep sticky top-16 z-50 flex flex-wrap items-center justify-between gap-4 border-b p-4 shadow-xl sm:p-5"
        >
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-7 w-7 sm:h-8 sm:w-8" />
            <div>
              <div className="font-display text-lg font-bold tracking-tight uppercase sm:text-xl">
                {t('sos.countdownTitle', lang)} {emergencyCountdown}s
              </div>
              <p className="text-sm font-medium opacity-90 sm:text-base">
                {t('sos.countdownDesc', lang)}
                {battery.level !== null && ` • ${t('tracker.battery', lang)}: ${battery.level}%`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEmergencyCountdown(null)}
              className="bg-on-brick text-brick-deep btn btn-md hover:bg-on-brick/90"
            >
              {t('sos.cancel', lang)}
            </button>
          </div>
        </div>
      )}

      {/* Fall Detection Cancelable Countdown Overlay */}
      {fallCountdown !== null && (
        <div
          id="overlay-fall-detection-countdown"
          className="bg-brick/95 fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 p-6 text-center"
        >
          <ShieldAlert className="text-on-brick h-16 w-16" />
          <div>
            <h2 className="font-display text-on-brick text-3xl font-bold sm:text-4xl">
              {t('fall.title', lang)}
            </h2>
            <p className="text-on-brick/90 mt-2 text-lg font-semibold sm:text-xl">
              {t('fall.desc', lang)} ({fallCountdown}s)
            </p>
          </div>
          <button
            id="btn-fall-im-okay"
            onClick={() => {
              setFallCountdown(null);
              stopSpeaking();
            }}
            className="bg-on-brick text-brick-deep font-display rounded-3xl px-12 py-8 text-3xl font-bold shadow-2xl active:scale-95 sm:text-4xl"
          >
            {t('fall.imOkay', lang)}
          </button>
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
          onAlertFamily={handleAlertFamily}
          isAlertingFamily={isAlertingFamily}
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

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          setIsAuthModalOpen(false);
          setIsProfileModalOpen(true);
        }}
        settings={settings}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={currentUser}
        profile={userProfile}
        onProfileUpdated={(updated) => {
          setUserProfile(updated);
          if (updated.emergencyContacts && updated.emergencyContacts.length > 0) {
            setContacts(updated.emergencyContacts);
          }
        }}
        contacts={contacts}
        onOpenManageContacts={() => {
          setIsProfileModalOpen(false);
          setIsContactsModalOpen(true);
        }}
        settings={settings}
      />

      {/* Footer Accessibility Notice */}
      <footer className="border-line text-ink-soft border-t px-4 py-6 text-center text-sm font-medium sm:text-base">
        <p>
          Senior SafeSpot • Multimodal Location & Pickup Assistant • Powered by Gemini AI, Speechmatics & Firebase
        </p>
      </footer>
    </div>
  );
}
