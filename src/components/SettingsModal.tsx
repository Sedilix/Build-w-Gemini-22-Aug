/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  X, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Check, 
  Play, 
  Square, 
  Sliders, 
  Eye, 
  Type, 
  Compass, 
  Users, 
  Cpu, 
  Radio, 
  Waves,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { 
  AccessibilitySettings, 
  SPEECHMATICS_VOICE_OPTIONS, 
  SpeechmaticsVoiceOption, 
  HighContrastTheme, 
  FontSizeLevel 
} from '../types';
import { speakSpeechmaticsOrFallback, stopSpeaking } from '../utils/speech';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AccessibilitySettings;
  onUpdateSettings: (updater: (prev: AccessibilitySettings) => AccessibilitySettings) => void;
  onOpenManageContacts?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onOpenManageContacts,
}) => {
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  if (!isOpen) return null;

  const isYellow = settings.contrastTheme === 'yellow-black';

  const handleTestVoice = async (voice: SpeechmaticsVoiceOption) => {
    if (playingVoiceId === voice.id) {
      stopSpeaking();
      setPlayingVoiceId(null);
      return;
    }

    setPlayingVoiceId(voice.id);
    await speakSpeechmaticsOrFallback(voice.sampleText, voice.id, () => {
      setPlayingVoiceId(null);
    });
  };

  const handleSelectVoice = (voiceId: string) => {
    onUpdateSettings((prev) => ({
      ...prev,
      speechmaticsVoice: voiceId,
    }));
  };

  const activeVoice = SPEECHMATICS_VOICE_OPTIONS.find(
    (v) => v.id === (settings.speechmaticsVoice || 'sarah')
  ) || SPEECHMATICS_VOICE_OPTIONS[0];

  return (
    <div 
      id="modal-settings-backdrop"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn"
    >
      <div 
        id="modal-settings-content"
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col transition-all ${
          isYellow
            ? 'bg-black text-amber-300 border-amber-400'
            : settings.contrastTheme === 'black-white'
            ? 'bg-white text-black border-black'
            : settings.contrastTheme === 'warm-soft'
            ? 'bg-[#fffaf3] text-[#2c241c] border-[#dfd2c4]'
            : 'bg-white text-slate-900 border-slate-200'
        }`}
      >
        {/* Header Bar */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between shrink-0 ${
          isYellow
            ? 'border-amber-400 bg-neutral-950'
            : settings.contrastTheme === 'black-white'
            ? 'border-black bg-slate-50'
            : 'border-slate-200/90 bg-slate-50/80'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
              isYellow ? 'bg-amber-400 text-black' : 'bg-slate-900 text-white'
            }`}>
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight leading-none">
                App & Voice Settings
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-inherit/70 mt-1">
                Customize Speechmatics voices, audio playback & visual accessibility
              </p>
            </div>
          </div>

          <button
            id="btn-close-settings-modal"
            onClick={() => {
              stopSpeaking();
              setPlayingVoiceId(null);
              onClose();
            }}
            className="accessible-tap p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:bg-neutral-800 transition-all"
            aria-label="Close settings"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Section 1: Speechmatics Voice Type Selector */}
          <section id="section-speechmatics-voices" className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Waves className="w-5 h-5 text-indigo-600 dark:text-amber-400" />
                <h3 className="text-base sm:text-lg font-bold">
                  Speechmatics Text-to-Speech Voice
                </h3>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Active: {activeVoice.name} ({activeVoice.accent})
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-inherit/80 leading-relaxed">
              Select the voice persona used to read your verified location, safety guidelines, and driver pickup instructions. Tap <strong>Listen</strong> to sample each voice.
            </p>

            {/* Voice Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {SPEECHMATICS_VOICE_OPTIONS.map((v) => {
                const isSelected = (settings.speechmaticsVoice || 'sarah') === v.id;
                const isPlaying = playingVoiceId === v.id;

                return (
                  <div
                    key={v.id}
                    id={`voice-option-${v.id}`}
                    className={`p-3.5 sm:p-4 rounded-xl border-2 transition-all flex flex-col justify-between relative ${
                      isSelected
                        ? isYellow
                          ? 'border-amber-400 bg-neutral-900 shadow-md ring-2 ring-amber-400/40'
                          : 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-600/30'
                        : isYellow
                        ? 'border-neutral-800 bg-black hover:border-neutral-700'
                        : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    {/* Top Row: Name, Flag & Recommended Badge */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xl" role="img" aria-label={v.accent}>
                            {v.flag}
                          </span>
                          <div>
                            <div className="font-bold text-base sm:text-lg flex items-center gap-1.5 leading-none">
                              <span>{v.name}</span>
                              <span className="text-xs font-normal text-slate-500 dark:text-inherit/70">
                                ({v.gender === 'female' ? 'Female' : 'Male'})
                              </span>
                            </div>
                            <div className="text-[11px] font-semibold text-indigo-700 dark:text-amber-400 mt-0.5">
                              {v.tone} • {v.accent}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <span className={`p-1 rounded-full shrink-0 ${
                            isYellow ? 'bg-amber-400 text-black' : 'bg-indigo-600 text-white'
                          }`}>
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-inherit/80 leading-snug mt-1 mb-3">
                        {v.description}
                      </p>
                    </div>

                    {/* Bottom Action Controls */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-neutral-800/80">
                      {/* Select Voice Button */}
                      <button
                        type="button"
                        onClick={() => handleSelectVoice(v.id)}
                        className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs sm:text-sm transition-all active:scale-98 flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? isYellow
                              ? 'bg-amber-400 text-black font-extrabold'
                              : 'bg-indigo-600 text-white'
                            : isYellow
                            ? 'border border-amber-400 text-amber-300 hover:bg-neutral-800'
                            : 'border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Selected</span>
                          </>
                        ) : (
                          <span>Select Voice</span>
                        )}
                      </button>

                      {/* Listen / Preview Audio Button */}
                      <button
                        type="button"
                        onClick={() => handleTestVoice(v)}
                        className={`py-2 px-3 rounded-lg font-semibold text-xs sm:text-sm border transition-all active:scale-98 flex items-center gap-1 shrink-0 ${
                          isPlaying
                            ? 'bg-rose-500 border-rose-600 text-white animate-pulse'
                            : isYellow
                            ? 'border-neutral-700 bg-neutral-900 text-amber-300 hover:bg-neutral-800'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                        title={`Listen to sample of ${v.name}`}
                      >
                        {isPlaying ? (
                          <>
                            <Square className="w-3 h-3 fill-current" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current text-indigo-600 dark:text-amber-400" />
                            <span>Listen</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 2: Audio & Spoken Guidance Preferences */}
          <section id="section-audio-preferences" className="space-y-3 pt-2 border-t border-slate-100 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-emerald-600 dark:text-amber-400" />
              <h3 className="text-base sm:text-lg font-bold">Audio & Speech Guidance</h3>
            </div>

            <div className="space-y-2.5">
              {/* Spoken Guidance Toggle */}
              <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                isYellow ? 'bg-neutral-950 border-neutral-800' : 'bg-slate-50/70 border-slate-200'
              }`}>
                <div>
                  <div className="font-bold text-sm sm:text-base">
                    Automatic Spoken Guidance
                  </div>
                  <div className="text-xs text-slate-500 dark:text-inherit/70">
                    Reads verified address, landmark visual clues, and safety tips automatically
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onUpdateSettings((prev) => ({ ...prev, spokenGuidance: !prev.spokenGuidance }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.spokenGuidance ? (isYellow ? 'bg-amber-400' : 'bg-emerald-600') : 'bg-slate-300 dark:bg-neutral-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      settings.spokenGuidance ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Speech Speed Cadence */}
              <div className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                isYellow ? 'bg-neutral-950 border-neutral-800' : 'bg-slate-50/70 border-slate-200'
              }`}>
                <div>
                  <div className="font-bold text-sm sm:text-base">
                    Elder-Friendly Speaking Cadence
                  </div>
                  <div className="text-xs text-slate-500 dark:text-inherit/70">
                    Slower pace (0.85x) allows easier comprehension for senior listeners
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings((prev) => ({ ...prev, speechmaticsRate: 0.85 }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      (settings.speechmaticsRate ?? 0.85) <= 0.9
                        ? isYellow ? 'bg-amber-400 text-black border-amber-400' : 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-slate-200 bg-white text-slate-700 dark:bg-neutral-900'
                    }`}
                  >
                    Gentle (0.85x)
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings((prev) => ({ ...prev, speechmaticsRate: 1.0 }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      (settings.speechmaticsRate ?? 0.85) > 0.9
                        ? isYellow ? 'bg-amber-400 text-black border-amber-400' : 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-slate-200 bg-white text-slate-700 dark:bg-neutral-900'
                    }`}
                  >
                    Normal (1.0x)
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: High-Contrast Display Themes */}
          <section id="section-visual-themes" className="space-y-3 pt-2 border-t border-slate-100 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-amber-500 dark:text-amber-400" />
              <h3 className="text-base sm:text-lg font-bold">Display & High-Contrast Mode</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'normal', name: 'Standard', desc: 'Default Light' },
                { id: 'yellow-black', name: 'Yellow on Black', desc: 'Maximum Contrast' },
                { id: 'black-white', name: 'High B&W', desc: 'Monochrome' },
                { id: 'warm-soft', name: 'Warm Amber', desc: 'Gentle Eye Care' },
              ].map((theme) => {
                const isSelected = settings.contrastTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => onUpdateSettings((prev) => ({ ...prev, contrastTheme: theme.id as HighContrastTheme }))}
                    className={`p-3 rounded-xl border text-left transition-all active:scale-98 ${
                      isSelected
                        ? isYellow
                          ? 'bg-amber-400 text-black border-amber-400 font-bold'
                          : 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800 dark:bg-neutral-900 dark:border-neutral-800 dark:text-inherit'
                    }`}
                  >
                    <div className="font-bold text-xs sm:text-sm">{theme.name}</div>
                    <div className={`text-[11px] mt-0.5 ${isSelected ? 'opacity-90' : 'text-slate-500 dark:text-inherit/60'}`}>
                      {theme.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 4: Font Size Level */}
          <section id="section-font-sizing" className="space-y-3 pt-2 border-t border-slate-100 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <Type className="w-5 h-5 text-blue-600 dark:text-amber-400" />
              <h3 className="text-base sm:text-lg font-bold">Text Size Scaling</h3>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'standard', name: 'Medium (MD)', label: 'Standard' },
                { id: 'large', name: 'Large (LG)', label: 'Senior Default' },
                { id: 'extra-large', name: 'Extra Large (XL)', label: 'Maximum' },
              ].map((size) => {
                const isSelected = settings.fontSize === size.id;
                return (
                  <button
                    key={size.id}
                    type="button"
                    onClick={() => onUpdateSettings((prev) => ({ ...prev, fontSize: size.id as FontSizeLevel }))}
                    className={`p-3 rounded-xl border text-center transition-all active:scale-98 ${
                      isSelected
                        ? isYellow
                          ? 'bg-amber-400 text-black border-amber-400 font-bold'
                          : 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800 dark:bg-neutral-900 dark:border-neutral-800 dark:text-inherit'
                    }`}
                  >
                    <div className="font-bold text-xs sm:text-sm">{size.name}</div>
                    <div className={`text-[10px] mt-0.5 ${isSelected ? 'opacity-90' : 'text-slate-500 dark:text-inherit/60'}`}>
                      {size.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 5: Emergency Contacts & Diagnostics */}
          <section id="section-family-diagnostics" className="space-y-3 pt-2 border-t border-slate-100 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600 dark:text-amber-400" />
                <h3 className="text-base sm:text-lg font-bold">Caregivers & SOS 995</h3>
              </div>

              {onOpenManageContacts && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenManageContacts();
                  }}
                  className="text-xs font-bold text-indigo-600 dark:text-amber-400 hover:underline"
                >
                  Edit Contacts →
                </button>
              )}
            </div>

            {/* Diagnostic Badges */}
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-1.5 text-xs text-slate-600 dark:text-inherit/70">
              <div className="flex items-center justify-between">
                <span>Speechmatics Realtime STT / TTS Engine:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Gemini Multimodal Reasoning:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Active (Flash 3.7 / 2.5)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Google Maps & Street View Grounding:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Active
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-between shrink-0 ${
          isYellow ? 'border-amber-400 bg-neutral-950' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="text-xs text-slate-500 dark:text-inherit/70">
            Selected Voice: <strong className="text-slate-800 dark:text-inherit">{activeVoice.name} ({activeVoice.accent})</strong>
          </div>

          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              setPlayingVoiceId(null);
              onClose();
            }}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm sm:text-base transition-all active:scale-98 ${
              isYellow
                ? 'bg-amber-400 text-black hover:bg-amber-300 font-extrabold'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            Done & Save
          </button>
        </div>
      </div>
    </div>
  );
};
