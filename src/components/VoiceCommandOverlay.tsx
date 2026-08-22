/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  X, 
  Volume2, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  MessageSquareQuote,
  Radio,
  Cpu,
  Waves
} from 'lucide-react';
import { RealtimeClient } from '@speechmatics/real-time-client';
import { AccessibilitySettings, EmergencyContact, LocationVerificationResult } from '../types';
import { 
  initSpeechRecognition, 
  SpeechRecognitionController, 
  speakText, 
  speakSpeechmaticsOrFallback, 
  stopSpeaking 
} from '../utils/speech';

interface VoiceCommandOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentAddress: string;
  verification: LocationVerificationResult | null;
  emergencyContacts: EmergencyContact[];
  settings: AccessibilitySettings;
  onTriggerSendLocation: () => void;
  onTriggerEmergency: () => void;
  onTriggerCamera: () => void;
  onToggleContrast: () => void;
  onSpeakAddress: () => void;
  onOpenSettings?: () => void;
}

export const VoiceCommandOverlay: React.FC<VoiceCommandOverlayProps> = ({
  isOpen,
  onClose,
  currentAddress,
  verification,
  emergencyContacts,
  settings,
  onTriggerSendLocation,
  onTriggerEmergency,
  onTriggerCamera,
  onToggleContrast,
  onSpeakAddress,
  onOpenSettings,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [assistantResponse, setAssistantResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognizedAction, setRecognizedAction] = useState<string | null>(null);
  const [isSpeechmaticsActive, setIsSpeechmaticsActive] = useState(false);
  const [engineStatus, setEngineStatus] = useState<string>('Initializing speech engine...');

  const controllerRef = useRef<SpeechRecognitionController | null>(null);
  const speechmaticsClientRef = useRef<RealtimeClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');

  const isYellow = settings.contrastTheme === 'yellow-black';

  useEffect(() => {
    if (!isOpen) {
      cleanupAudioSession();
      setIsListening(false);
      return;
    }

    // Auto-start listening on open
    startListening();

    return () => {
      cleanupAudioSession();
    };
  }, [isOpen]);

  const cleanupAudioSession = () => {
    if (speechmaticsClientRef.current) {
      try {
        speechmaticsClientRef.current.stopRecognition({ noTimeout: true }).catch(() => {});
      } catch (e) {}
      speechmaticsClientRef.current = null;
    }

    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch (e) {}
      scriptProcessorRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (controllerRef.current) {
      controllerRef.current.stop();
      controllerRef.current = null;
    }
  };

  const startListening = async () => {
    cleanupAudioSession();
    setTranscript('');
    setInterimTranscript('');
    accumulatedTranscriptRef.current = '';
    setAssistantResponse('Listening to your voice... Speak anytime.');
    setRecognizedAction(null);

    // Step 1: Check Speechmatics Realtime token from backend
    try {
      const tokenRes = await fetch('/api/speechmatics/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const tokenData = await tokenRes.json();

      if (tokenData.hasSpeechmaticsKey && tokenData.token) {
        // Start Speechmatics Realtime SDK Client
        setEngineStatus('Speechmatics Realtime SDK Connected');
        setIsSpeechmaticsActive(true);
        await startSpeechmaticsSession(tokenData.token, tokenData.url);
        return;
      }
    } catch (e) {
      console.warn('Speechmatics check notice:', e);
    }

    // Step 2: Fallback to Browser Speech Recognition
    startWebSpeechFallback();
  };

  const startSpeechmaticsSession = async (jwtToken: string, endpointUrl?: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      audioContextRef.current = audioCtx;

      const client = new RealtimeClient({
        url: endpointUrl || 'wss://eu2.rt.speechmatics.com/v2',
      });
      speechmaticsClientRef.current = client;

      // Event Listeners for Speechmatics Realtime messages
      client.addEventListener('receiveMessage', ({ data }) => {
        if (data.message === 'AddPartialTranscript') {
          const partialText = data.results?.map((r) => r.alternatives?.[0]?.content).join(' ') || data.metadata?.transcript || '';
          if (partialText) {
            setInterimTranscript(partialText);
          }
        } else if (data.message === 'AddTranscript') {
          const finalSeg = data.metadata?.transcript || data.results?.map((r) => r.alternatives?.[0]?.content).join(' ') || '';
          if (finalSeg) {
            accumulatedTranscriptRef.current += (accumulatedTranscriptRef.current ? ' ' : '') + finalSeg;
            setTranscript(accumulatedTranscriptRef.current);
            setInterimTranscript('');
          }
        } else if (data.message === 'EndOfUtterance') {
          const fullText = accumulatedTranscriptRef.current.trim();
          if (fullText) {
            handleProcessVoiceCommand(fullText);
          }
        }
      });

      // Stream PCM audio from microphone to Speechmatics
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!isListening) return;
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32Array to 16-bit PCM buffer for Speechmatics raw format
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        client.sendAudio(pcm16.buffer);
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      // Start recognition session with enhanced English and conversational silence trigger
      await client.start(jwtToken, {
        transcription_config: {
          language: 'en',
          operating_point: 'enhanced',
          enable_partials: true,
          conversation_config: {
            end_of_utterance_silence_trigger: 1.5,
          },
        },
        audio_format: {
          type: 'raw',
          encoding: 'pcm_s16le',
          sample_rate: 16000,
        },
      });

      setIsListening(true);
      setEngineStatus('Speechmatics Realtime SDK Active • Listening');
    } catch (err) {
      console.error('Error starting Speechmatics session:', err);
      startWebSpeechFallback();
    }
  };

  const startWebSpeechFallback = () => {
    setIsSpeechmaticsActive(false);
    setEngineStatus('Web Speech Assistant Active');

    const controller = initSpeechRecognition(
      (text, isFinal) => {
        setTranscript(text);
        if (isFinal) {
          handleProcessVoiceCommand(text);
        }
      },
      (err) => {
        console.warn('Voice recognition notice:', err);
        setIsListening(false);
      },
      () => {
        setIsListening(false);
      }
    );

    if (controller) {
      controllerRef.current = controller;
      controller.start();
      setIsListening(true);
    } else {
      setAssistantResponse('Microphone voice typing ready. Tap a quick phrase below or type your request.');
    }
  };

  const stopListening = () => {
    const textToProcess = accumulatedTranscriptRef.current.trim() || transcript.trim() || interimTranscript.trim();
    cleanupAudioSession();
    setIsListening(false);

    if (textToProcess) {
      handleProcessVoiceCommand(textToProcess);
    }
  };

  const handleProcessVoiceCommand = async (spokenText: string) => {
    if (!spokenText.trim()) return;
    setIsProcessing(true);
    cleanupAudioSession();
    setIsListening(false);

    try {
      // Step 2: Route transcript into Gemini's Reasoning & Semantic Inference Engine
      const res = await fetch('/api/gemini/voice-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: spokenText,
          currentAddress,
          emergencyContacts,
        }),
      });

      const data = await res.json();
      const responseText = data.spokenResponse || 'Understood.';
      setAssistantResponse(responseText);
      setRecognizedAction(data.action);

      // Step 3: Speak aloud using Speechmatics TTS / Speech Synthesis for elder accessibility
      if (settings.spokenGuidance) {
        await speakSpeechmaticsOrFallback(responseText, settings.speechmaticsVoice || 'sarah');
      }

      // Step 4: Execute structured physical action with reassuring delay
      if (data.action === 'SEND_LOCATION') {
        setTimeout(() => {
          onTriggerSendLocation();
          onClose();
        }, 1600);
      } else if (data.action === 'READ_LOCATION') {
        onSpeakAddress();
      } else if (data.action === 'ANALYZE_PHOTO') {
        setTimeout(() => {
          onTriggerCamera();
          onClose();
        }, 1300);
      } else if (data.action === 'EMERGENCY_TRIGGER') {
        setTimeout(() => {
          onTriggerEmergency();
          onClose();
        }, 1000);
      } else if (data.action === 'TOGGLE_CONTRAST') {
        onToggleContrast();
      }
    } catch (e) {
      console.error('Voice assistant error:', e);
      setAssistantResponse(`I heard: "${spokenText}". Tap an option below to proceed.`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-voice-command-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className={`w-full max-w-2xl rounded-2xl p-6 sm:p-8 border transition-all shadow-2xl ${
          isYellow
            ? 'bg-black text-amber-300 border-amber-400'
            : settings.contrastTheme === 'black-white'
            ? 'bg-white text-black border-black'
            : 'bg-slate-900 text-white border-slate-800'
        }`}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isYellow ? 'bg-amber-400 text-black' : 'bg-slate-800 text-emerald-400 border border-slate-700'
            }`}>
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight leading-none text-white">
                  Voice Assistant
                </h3>
                {isSpeechmaticsActive && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    <Waves className="w-3 h-3 animate-pulse" /> Speechmatics STT
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm font-normal text-slate-400 mt-1">
                Powered by Speechmatics Realtime SDK & Gemini Reasoning
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  stopSpeaking();
                  cleanupAudioSession();
                  onClose();
                  onOpenSettings();
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 border border-slate-700 transition-all"
                title="Change Speechmatics voice"
              >
                <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Voice:</span>
                <span className="font-bold text-white uppercase">{settings.speechmaticsVoice || 'SARAH'}</span>
              </button>
            )}

            <button
              onClick={() => {
                stopSpeaking();
                cleanupAudioSession();
                onClose();
              }}
              className="accessible-tap p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              aria-label="Close voice assistant"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Center Mic & Waveform */}
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <button
            id="btn-voice-mic-main"
            onClick={isListening ? stopListening : startListening}
            className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center transition-all shadow-xl active:scale-95 ${
              isListening
                ? isYellow
                  ? 'bg-amber-400 text-black animate-pulse ring-8 ring-amber-400/40'
                  : 'bg-rose-600 text-white animate-pulse ring-8 ring-rose-500/40'
                : isYellow
                ? 'bg-neutral-800 text-amber-300 border-2 border-amber-400 hover:bg-neutral-700'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
            aria-label={isListening ? 'Stop listening' : 'Start listening'}
          >
            {isListening ? (
              <Mic className="w-10 h-10 animate-bounce" />
            ) : (
              <Mic className="w-10 h-10" />
            )}
          </button>

          <div className="mt-4 font-bold text-lg sm:text-xl text-slate-100">
            {isListening
              ? 'Listening... Speak naturally'
              : isProcessing
              ? 'Gemini Reasoning in Progress...'
              : 'Tap microphone to speak'}
          </div>

          {/* Engine Indicator */}
          <div className="mt-1 flex items-center justify-center gap-2 text-xs text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{engineStatus}</span>
          </div>

          {/* Live Transcript / Speech Stream */}
          {(transcript || interimTranscript) && (
            <div className="mt-4 p-4 rounded-xl bg-slate-800/80 border border-slate-700 max-w-lg w-full text-left">
              <div className="text-xs uppercase font-semibold tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                <span>Transcribed Voice:</span>
                {isSpeechmaticsActive && <span className="text-indigo-300 font-bold text-[11px]">Speechmatics Realtime</span>}
              </div>
              <p className="text-base sm:text-lg font-bold italic text-slate-100">
                "{transcript || interimTranscript}"
              </p>
            </div>
          )}

          {/* Gemini AI Spoken Response Card */}
          {assistantResponse && (
            <div className={`mt-4 p-4 rounded-xl border max-w-lg w-full text-left flex items-start gap-3 shadow-xs ${
              isYellow
                ? 'bg-amber-400 text-black border-amber-300'
                : 'bg-slate-800/90 border-slate-700 text-slate-100'
            }`}>
              <Sparkles className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <div className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-sky-400" />
                  <span>Gemini Assistant Decision</span>
                  {recognizedAction && (
                    <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-200">
                      {recognizedAction}
                    </span>
                  )}
                </div>
                <p className="text-sm sm:text-base font-medium leading-snug">
                  {assistantResponse}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Quick Speech Phrase Buttons */}
        <div className="mt-6 pt-4 border-t border-slate-800">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Or tap a common Singapore senior phrase:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={() => handleProcessVoiceCommand('Where am I right now?')}
              className={`p-3 rounded-xl text-left font-semibold text-xs sm:text-sm border transition-all active:scale-98 ${
                isYellow ? 'bg-neutral-900 border-amber-400 hover:bg-neutral-800' : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/80 text-slate-200'
              }`}
            >
              🗣️ "Where am I right now?"
            </button>

            <button
              onClick={() => handleProcessVoiceCommand('Send my exact location to my daughter Sarah')}
              className={`p-3 rounded-xl text-left font-semibold text-xs sm:text-sm border transition-all active:scale-98 ${
                isYellow ? 'bg-neutral-900 border-amber-400 hover:bg-neutral-800' : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/80 text-slate-200'
              }`}
            >
              🗣️ "Send location to Sarah (Daughter)"
            </button>

            <button
              onClick={() => handleProcessVoiceCommand('Take a photo of where I am standing')}
              className={`p-3 rounded-xl text-left font-semibold text-xs sm:text-sm border transition-all active:scale-98 ${
                isYellow ? 'bg-neutral-900 border-amber-400 hover:bg-neutral-800' : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/80 text-slate-200'
              }`}
            >
              📷 "Take a photo of my surroundings"
            </button>

            <button
              onClick={() => handleProcessVoiceCommand('I need urgent Singapore SCDF 995 ambulance')}
              className={`p-3 rounded-xl text-left font-semibold text-xs sm:text-sm border border-rose-600/60 bg-rose-950/40 hover:bg-rose-950/60 text-rose-300 transition-all active:scale-98`}
            >
              🚨 "Emergency 995 SCDF Ambulance"
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

