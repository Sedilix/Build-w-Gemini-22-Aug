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
  AlertTriangle, 
  Settings, 
  SunMedium, 
  Sparkles,
  Type
} from 'lucide-react';
import { AccessibilitySettings, HighContrastTheme, FontSizeLevel } from '../types';

interface HeaderAccessibilityProps {
  settings: AccessibilitySettings;
  onUpdateSettings: (updater: (prev: AccessibilitySettings) => AccessibilitySettings) => void;
  onOpenVoiceCommand: () => void;
  onEmergencyTrigger: () => void;
  onOpenSettings: () => void;
  isSpeaking: boolean;
  onStopSpeaking: () => void;
}

export const HeaderAccessibility: React.FC<HeaderAccessibilityProps> = ({
  settings,
  onUpdateSettings,
  onOpenVoiceCommand,
  onEmergencyTrigger,
  onOpenSettings,
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

  const isHighContrastYellow = settings.contrastTheme === 'yellow-black';

  return (
    <header 
      id="app-header-accessibility"
      className={`border-b sticky top-0 z-40 px-4 sm:px-8 py-3.5 transition-colors backdrop-blur-md ${
        isHighContrastYellow 
          ? 'bg-black text-amber-300 border-amber-400' 
          : settings.contrastTheme === 'black-white'
          ? 'bg-white text-black border-black'
          : settings.contrastTheme === 'warm-soft'
          ? 'bg-[#f4ebe1] text-[#2c241c] border-[#d8c8b8]'
          : 'bg-white/95 text-slate-900 border-slate-200/80 shadow-xs'
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand / Title with Friendly Elder Badge */}
        <div className="flex items-center gap-3.5">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-2xl shadow-xs shrink-0 ${
            isHighContrastYellow ? 'bg-amber-400 text-black' : 'bg-slate-900 text-white'
          }`}>
            📍
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-none text-slate-900 dark:text-inherit">
                Senior SafeSpot
              </h1>
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                isHighContrastYellow 
                  ? 'bg-amber-400 text-black' 
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                Singapore • 995 SOS
              </span>
            </div>
            <p className="text-xs sm:text-sm font-normal text-slate-500 dark:text-inherit/80 mt-1">
              Verified GPS • Google Street View AI • 1-Tap SG Family Alerts
            </p>
          </div>
        </div>

        {/* Quick Accessibility & Action Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Voice Command Mode Trigger */}
          <button
            id="btn-voice-assistant-trigger"
            onClick={onOpenVoiceCommand}
            className={`accessible-tap px-4 py-2 rounded-xl font-semibold flex items-center gap-2 text-sm sm:text-base transition-all active:scale-98 shadow-xs ${
              isHighContrastYellow
                ? 'bg-amber-300 text-black border-2 border-amber-300 hover:bg-amber-400 font-bold'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'
            }`}
            title="Voice Commands (Say 'Where am I' or 'Send location')"
            aria-label="Activate voice commands"
          >
            <Mic className="w-4 h-4 animate-pulse" />
            <span className="font-semibold">Voice Assistant</span>
          </button>

          {/* Voice Speech Audio Toggle */}
          <button
            id="btn-toggle-speech-guidance"
            onClick={toggleVoiceGuidance}
            className={`accessible-tap px-3.5 py-2 rounded-xl font-medium flex items-center gap-1.5 text-sm sm:text-base border transition-all ${
              settings.spokenGuidance
                ? isHighContrastYellow
                  ? 'bg-amber-400 text-black border-amber-400 font-bold'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title={settings.spokenGuidance ? 'Voice Speech Guidance Active (Tap to mute)' : 'Turn Voice Guidance On'}
          >
            {settings.spokenGuidance ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden md:inline text-xs font-semibold">
              {settings.spokenGuidance ? 'Voice On' : 'Voice Off'}
            </span>
          </button>

          {/* Settings & Speechmatics Voice Config Button */}
          <button
            id="btn-open-settings-modal"
            onClick={onOpenSettings}
            className={`accessible-tap px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 text-sm sm:text-base border transition-all active:scale-98 ${
              isHighContrastYellow
                ? 'bg-neutral-900 border-amber-400 text-amber-300 hover:bg-neutral-800 font-bold'
                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-2xs'
            }`}
            title="Open Speechmatics Voices & Accessibility Settings"
            aria-label="Settings and Speechmatics voice selection"
          >
            <Settings className="w-4 h-4 text-slate-600 dark:text-inherit" />
            <span className="hidden sm:inline text-xs font-bold">Settings</span>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {settings.speechmaticsVoice ? settings.speechmaticsVoice.toUpperCase() : 'SARAH'}
            </span>
          </button>

          {/* High Contrast Theme Switcher */}
          <button
            id="btn-toggle-contrast-mode"
            onClick={toggleTheme}
            className={`accessible-tap px-3.5 py-2 rounded-xl font-medium flex items-center gap-1.5 text-sm sm:text-base border transition-all ${
              isHighContrastYellow
                ? 'bg-amber-300 text-black border-amber-300 font-bold'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
            }`}
            title="Toggle High Contrast Display Mode"
          >
            <Eye className="w-4 h-4 text-slate-500 dark:text-inherit" />
            <span className="hidden sm:inline text-xs font-semibold">Contrast</span>
          </button>

          {/* Font Size Adjuster */}
          <button
            id="btn-toggle-font-size"
            onClick={toggleFontSize}
            className="accessible-tap px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1 text-sm border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-all"
            title="Increase or reset text size"
          >
            <Type className="w-4 h-4 text-slate-500" />
            <span className="text-xs uppercase font-bold text-slate-800">
              {settings.fontSize === 'extra-large' ? 'XL' : settings.fontSize === 'large' ? 'LG' : 'MD'}
            </span>
          </button>

          {/* Emergency 995 SCDF Instant Trigger */}
          <button
            id="btn-emergency-911-header"
            onClick={onEmergencyTrigger}
            className="accessible-tap px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 text-sm sm:text-base bg-rose-600 hover:bg-rose-700 active:scale-98 text-white shadow-xs transition-all border border-rose-700"
            title="Immediate Singapore SCDF 995 Emergency Dispatch Call & Location Send"
          >
            <AlertTriangle className="w-4 h-4 animate-bounce" />
            <span className="font-bold">SOS 995</span>
          </button>
        </div>
      </div>
    </header>
  );
};
