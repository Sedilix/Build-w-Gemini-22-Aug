/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Eye, 
  Volume2, 
  VolumeX, 
  Mic, 
  Siren, 
  Settings, 
  Type,
  Languages,
  User as UserIcon,
  LogIn
} from 'lucide-react';
import { AccessibilitySettings, HighContrastTheme, FontSizeLevel, UserProfile } from '../types';
import { AppLogo } from './AppLogo';
import { User as FirebaseUser } from 'firebase/auth';
import { t, LANGUAGE_OPTIONS } from '../locales/translations';

interface HeaderAccessibilityProps {
  settings: AccessibilitySettings;
  onUpdateSettings: (updater: (prev: AccessibilitySettings) => AccessibilitySettings) => void;
  onOpenVoiceCommand: () => void;
  onEmergencyTrigger: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  user: FirebaseUser | null;
  profile: UserProfile | null;
  isSpeaking: boolean;
  onStopSpeaking: () => void;
}

export const HeaderAccessibility: React.FC<HeaderAccessibilityProps> = ({
  settings,
  onUpdateSettings,
  onOpenVoiceCommand,
  onEmergencyTrigger,
  onOpenSettings,
  onOpenProfile,
  onOpenAuth,
  user,
  profile,
  isSpeaking,
  onStopSpeaking,
}) => {
  const toggleTheme = () => {
    const themeCycle: HighContrastTheme[] = ['normal', 'yellow-black', 'black-white', 'warm-soft'];
    const nextIndex = (themeCycle.indexOf(settings.contrastTheme) + 1) % themeCycle.length;
    onUpdateSettings((prev) => ({ ...prev, contrastTheme: themeCycle[nextIndex] }));
  };

  const toggleFontSize = () => {
    const sizeCycle: FontSizeLevel[] = ['standard', 'large', 'extra-large'];
    const nextIndex = (sizeCycle.indexOf(settings.fontSize) + 1) % sizeCycle.length;
    onUpdateSettings((prev) => ({ ...prev, fontSize: sizeCycle[nextIndex] }));
  };

  const toggleVoiceGuidance = () => {
    if (isSpeaking) {
      onStopSpeaking();
    }
    onUpdateSettings((prev) => ({ ...prev, spokenGuidance: !prev.spokenGuidance }));
  };

  const lang = settings.language || 'en';

  // One-tap language cycle: English → 中文 → Melayu → தமிழ் → English...
  const cycleLanguage = () => {
    const order = LANGUAGE_OPTIONS.map((l) => l.id);
    const nextIndex = (order.indexOf(lang) + 1) % order.length;
    onUpdateSettings((prev) => ({ ...prev, language: order[nextIndex] }));
  };

  const currentLang = LANGUAGE_OPTIONS.find((l) => l.id === lang) || LANGUAGE_OPTIONS[0];

  return (
    <header
      id="app-header-accessibility"
      className="border-line bg-surface/95 text-ink sticky top-0 z-40 border-b px-3 py-2.5 backdrop-blur-md transition-colors sm:px-8 sm:py-3.5"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6 sm:gap-y-3">
        {/* Row 1 on mobile: brand and the one action that must never be hunted for */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <AppLogo size={36} className="sm:h-11 sm:w-11" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display truncate text-lg leading-none font-bold tracking-tight sm:text-[1.7rem]">
                  Senior SafeSpot
                </h1>
                {/* Redundant with the SOS button on a narrow screen */}
                <span className="chip border-pine/40 bg-pine-soft text-pine-deep hidden sm:inline-flex">
                  Singapore • 995 SOS
                </span>
              </div>
              <p className="text-ink-soft mt-1 hidden text-sm font-normal sm:block sm:text-base">
                {t('header.tagline', lang)}
              </p>
            </div>
          </div>

          {/* Emergency 995 SCDF Instant Trigger — always labelled, always reachable */}
          <button
            id="btn-emergency-911-header"
            onClick={onEmergencyTrigger}
            className="btn btn-md btn-danger shrink-0 sm:order-last sm:min-w-[8.5rem]"
            title="Immediate Singapore SCDF 995 Emergency Dispatch Call & Location Send"
          >
            <Siren className="h-5 w-5" />
            <span>{t('header.sos', lang)}</span>
          </button>
        </div>

        {/*
          Row 2 on mobile: the utility controls collapse to icons. Labels return
          at sm and up, where there is room for them. Tap targets stay at the
          48px accessible minimum either way — only the labels are dropped.
        */}
        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 sm:mx-0 sm:flex-wrap sm:gap-2.5 sm:px-0">
          {/* One-Tap Language Switcher (EN / 中文 / Melayu / தமிழ்) */}
          <button
            id="btn-language-switcher"
            onClick={cycleLanguage}
            className="btn btn-md btn-secondary shrink-0 px-3 sm:px-4"
            title={`${t('header.language', lang)}: ${LANGUAGE_OPTIONS.map((l) => l.nativeName).join(' / ')}`}
            aria-label={`Change language, current: ${currentLang.englishName}`}
          >
            <Languages className="text-ink-soft h-5 w-5" />
            <span className="hidden sm:inline">{currentLang.nativeName}</span>
          </button>

          {/* Voice Command Mode Trigger */}
          <button
            id="btn-voice-assistant-trigger"
            onClick={onOpenVoiceCommand}
            className="btn btn-md btn-primary shrink-0 px-3 sm:px-4"
            title="Voice Commands (Say 'Where am I' or 'Send location')"
            aria-label="Activate voice commands"
          >
            <Mic className="h-5 w-5" />
            <span className="hidden sm:inline">{t('header.voiceAssistant', lang)}</span>
          </button>

          {/* Voice Speech Audio Toggle */}
          <button
            id="btn-toggle-speech-guidance"
            onClick={toggleVoiceGuidance}
            className={`btn btn-md shrink-0 px-3 sm:px-4 ${
              settings.spokenGuidance
                ? 'border-pine/40 bg-pine-soft text-pine-deep'
                : 'btn-secondary text-ink-soft'
            }`}
            title={settings.spokenGuidance ? 'Voice Speech Guidance Active (Tap to mute)' : 'Turn Voice Guidance On'}
            aria-label={settings.spokenGuidance ? 'Mute voice guidance' : 'Turn voice guidance on'}
          >
            {settings.spokenGuidance ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            <span className="hidden sm:inline">
              {settings.spokenGuidance ? t('header.voiceOn', lang) : t('header.voiceOff', lang)}
            </span>
          </button>

          {/* Settings & Speechmatics Voice Config Button */}
          <button
            id="btn-open-settings-modal"
            onClick={onOpenSettings}
            className="btn btn-md btn-secondary shrink-0 px-3 sm:px-4"
            title="Open Speechmatics Voices & Accessibility Settings"
            aria-label="Settings and Speechmatics voice selection"
          >
            <Settings className="text-ink-soft h-5 w-5" />
            <span className="hidden sm:inline">{t('header.settings', lang)}</span>
            <span className="chip border-pine/40 bg-pine-soft text-pine-deep hidden px-2 py-0.5 text-[11px] uppercase lg:inline-flex">
              {settings.speechmaticsVoice ? settings.speechmaticsVoice : 'sarah'}
            </span>
          </button>

          {/* High Contrast Theme Switcher */}
          <button
            id="btn-toggle-contrast-mode"
            onClick={toggleTheme}
            className="btn btn-md btn-secondary shrink-0 px-3 sm:px-4"
            title="Toggle High Contrast Display Mode"
            aria-label="Toggle high contrast display mode"
          >
            <Eye className="text-ink-soft h-5 w-5" />
            <span className="hidden sm:inline">{t('header.contrast', lang)}</span>
          </button>

          {/* Font Size Adjuster */}
          <button
            id="btn-toggle-font-size"
            onClick={toggleFontSize}
            className="btn btn-md btn-secondary shrink-0 px-3 sm:px-4"
            title="Increase or reset text size"
            aria-label={`Text size, current: ${settings.fontSize}`}
          >
            <Type className="text-ink-soft h-5 w-5" />
            <span className="hidden sm:inline">
              Text:{' '}
              {settings.fontSize === 'extra-large' ? 'XL' : settings.fontSize === 'large' ? 'Large' : 'Med'}
            </span>
          </button>

          {/* User Profile / Auth Button */}
          {user ? (
            <button
              id="btn-open-user-profile"
              onClick={onOpenProfile}
              className="btn btn-md btn-secondary shrink-0 px-3 sm:px-4"
              title="Open User Medical Profile & Emergency Contacts"
            >
              {profile?.selfiePhotoUrl ? (
                <img
                  src={profile.selfiePhotoUrl}
                  alt="Selfie"
                  className="border-pine h-7 w-7 rounded-full border-2 object-cover"
                />
              ) : (
                <span className="bg-pine text-on-pine flex h-7 w-7 items-center justify-center rounded-full text-sm">
                  {profile?.actualName?.charAt(0) || user.displayName?.charAt(0) || <UserIcon className="h-4 w-4" />}
                </span>
              )}
              <span className="hidden max-w-[110px] truncate sm:inline">
                {profile?.actualName || user.displayName || (user.isAnonymous ? 'Guest' : 'My Profile')}
              </span>
              {profile?.bloodType && profile.bloodType !== 'Unknown' && (
                <span className="chip border-brick/40 bg-brick-soft text-brick-deep hidden px-2 py-0.5 text-[11px] lg:inline-flex">
                  {profile.bloodType}
                </span>
              )}
            </button>
          ) : (
            <button
              id="btn-open-auth-modal"
              onClick={onOpenAuth}
              className="btn btn-md bg-ink text-bg hover:bg-ink-soft shrink-0 px-3 sm:px-4"
              title="Sign In with Google or Phone"
              aria-label="Sign in"
            >
              <LogIn className="h-5 w-5" />
              <span className="hidden sm:inline">{t('header.signIn', lang)}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
