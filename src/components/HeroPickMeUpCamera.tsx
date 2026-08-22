/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Sparkles, 
  MapPin, 
  Navigation, 
  Volume2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  Building2, 
  DoorOpen, 
  Compass, 
  ChevronRight,
  SunMedium,
  CheckCircle2,
  Upload
} from 'lucide-react';
import { 
  GPSLocation, 
  LocationVerificationResult, 
  AccessibilitySettings, 
  LocationPreset 
} from '../types';
import { LOCATION_PRESETS } from '../data/samplePresets';

interface HeroPickMeUpCameraProps {
  gps: GPSLocation | null;
  verification: LocationVerificationResult | null;
  isAnalyzing: boolean;
  isLoadingGPS: boolean;
  onPickMeUp: (photoBase64?: string, preset?: LocationPreset) => void;
  onSpeakAddress: () => void;
  isSpeaking: boolean;
  settings: AccessibilitySettings;
}

export const HeroPickMeUpCamera: React.FC<HeroPickMeUpCameraProps> = ({
  gps,
  verification,
  isAnalyzing,
  isLoadingGPS,
  onPickMeUp,
  onSpeakAddress,
  isSpeaking,
  settings,
}) => {
  const [isLiveCameraActive, setIsLiveCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('toa-payoh-hub');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isYellow = settings.contrastTheme === 'yellow-black';

  // Initialize camera when active
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startStream = async () => {
      try {
        setCameraError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setIsLiveCameraActive(true);
        }
      } catch (err: any) {
        console.warn('Camera access not granted or unavailable:', err);
        setIsLiveCameraActive(false);
        setCameraError('Camera preview unavailable on this device. You can choose a sample Singapore location or upload a photo.');
      }
    };

    startStream();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleSnapAndPickMeUp = () => {
    let photoData: string | undefined = undefined;

    if (videoRef.current && isLiveCameraActive) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          photoData = canvas.toDataURL('image/jpeg', 0.85);
          setCapturedPhoto(photoData);
        }
      } catch (e) {
        console.warn('Could not snap canvas from video:', e);
      }
    } else if (capturedPhoto) {
      photoData = capturedPhoto;
    }

    if (photoData) {
      onPickMeUp(photoData);
    } else {
      // Use selected sample preset if no camera
      const preset = LOCATION_PRESETS.find((p) => p.id === selectedPresetId) || LOCATION_PRESETS[0];
      setCapturedPhoto(preset.sampleImageUrl);
      onPickMeUp(preset.sampleImageUrl, preset);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          setCapturedPhoto(base64);
          onPickMeUp(base64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <section 
      id="hero-pick-me-up-section"
      className={`rounded-3xl border-3 shadow-xl overflow-hidden transition-all ${
        isYellow
          ? 'bg-black text-amber-300 border-amber-400'
          : settings.contrastTheme === 'black-white'
          ? 'bg-white text-black border-black shadow-none'
          : settings.contrastTheme === 'warm-soft'
          ? 'bg-[#fffaf3] text-[#2c241c] border-[#dfd0c0]'
          : 'bg-white text-slate-900 border-slate-200/90 shadow-slate-200/50'
      }`}
    >
      {/* Top Banner Tag */}
      <div className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-bold ${
        isYellow 
          ? 'bg-neutral-950 border-amber-400 text-amber-300' 
          : 'bg-indigo-900 text-white border-indigo-950'
      }`}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="tracking-wide uppercase text-[11px] sm:text-xs">
            1-Tap Elder Assistant • Point Camera & Tap Below
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] opacity-90">
          <Compass className="w-3.5 h-3.5" />
          <span>GPS Active: {gps ? `${gps.latitude.toFixed(4)}°, ${gps.longitude.toFixed(4)}°` : 'Detecting GPS...'}</span>
        </div>
      </div>

      {/* Main Viewfinder & Interaction Body */}
      <div className="p-4 sm:p-7 space-y-5">
        {/* Camera Viewfinder Box */}
        <div className="relative w-full aspect-16/9 max-h-[360px] sm:max-h-[420px] rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-300 dark:border-amber-400/80 shadow-inner flex items-center justify-center">
          {/* Live Video Viewfinder */}
          {isLiveCameraActive ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : capturedPhoto ? (
            <img
              src={capturedPhoto}
              alt="Surroundings"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center p-6 space-y-3 text-slate-300">
              <Camera className="w-14 h-14 mx-auto text-slate-400 animate-bounce" />
              <div className="font-bold text-base sm:text-lg text-white">
                Live Camera Ready
              </div>
              <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
                Point your phone at the building, shopfront, or street sign in front of you.
              </p>
            </div>
          )}

          {/* Viewfinder Target Framing Brackets (Elder Visual Aid) */}
          <div className="absolute inset-4 pointer-events-none border-2 border-dashed border-white/50 rounded-xl flex items-center justify-center">
            <div className="w-10 h-10 border-t-2 border-l-2 border-white absolute top-2 left-2"></div>
            <div className="w-10 h-10 border-t-2 border-r-2 border-white absolute top-2 right-2"></div>
            <div className="w-10 h-10 border-b-2 border-l-2 border-white absolute bottom-2 left-2"></div>
            <div className="w-10 h-10 border-b-2 border-r-2 border-white absolute bottom-2 right-2"></div>
            
            {/* Center Landmark Crosshair */}
            <div className="w-4 h-4 border border-white/80 rounded-full flex items-center justify-center">
              <div className="w-1 h-1 bg-rose-500 rounded-full"></div>
            </div>
          </div>

          {/* Analyzing Overlay Radar */}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center text-white space-y-3 animate-fadeIn">
              <RefreshCw className="w-12 h-12 text-emerald-400 animate-spin" />
              <div className="text-lg sm:text-xl font-bold">
                Gemini AI Verifying Surroundings...
              </div>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md">
                Cross-referencing storefront signs, HDB void deck pillars, and Google Street View.
              </p>
            </div>
          )}

          {/* Quick Fallback / Switcher Controls (Bottom of Viewfinder) */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-auto">
            <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>{isLiveCameraActive ? 'Live Camera Feed' : 'Surroundings Preview'}</span>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-black/70 hover:bg-black/90 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20 flex items-center gap-1.5 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload Photo</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* GIANT ACTION BUTTON: "Pick Me Up Here!" */}
        <div className="pt-2">
          <button
            id="btn-hero-pick-me-up"
            type="button"
            disabled={isAnalyzing}
            onClick={handleSnapAndPickMeUp}
            className={`giant-tap w-full py-5 sm:py-6 px-6 rounded-2xl font-black text-xl sm:text-2xl md:text-3xl border-3 transition-all flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 shadow-xl active:scale-98 ${
              isYellow
                ? 'bg-amber-400 hover:bg-amber-300 text-black border-amber-400 font-black'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-emerald-200/50'
            } disabled:opacity-50`}
          >
            <div className="flex items-center gap-3">
              <Camera className="w-8 h-8 sm:w-10 sm:h-10 animate-pulse" />
              <span>📸 Pick Me Up Here!</span>
            </div>
            <span className="text-xs sm:text-sm font-semibold opacity-90 tracking-normal block sm:inline">
              (1-Tap to Verify Location & Alert Family)
            </span>
          </button>
        </div>

        {/* Indoor vs Outdoor Detection Result Callout Banner */}
        {verification && (
          <div className={`p-4 sm:p-5 rounded-2xl border-2 transition-all space-y-2.5 ${
            verification.isIndoors
              ? isYellow
                ? 'bg-neutral-900 border-amber-400 text-amber-300'
                : 'bg-amber-50 border-amber-300 text-amber-950'
              : isYellow
              ? 'bg-neutral-900 border-emerald-400 text-emerald-300'
              : 'bg-emerald-50 border-emerald-300 text-emerald-950'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {verification.isIndoors ? (
                  <Building2 className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                <span className="font-extrabold text-sm sm:text-base uppercase tracking-wide">
                  {verification.isIndoors ? '🏠 INDOOR LOCATION DETECTED' : '🚗 OUTDOOR ROADSIDE READY'}
                </span>
              </div>

              {/* Spoken Guidance Trigger */}
              <button
                type="button"
                onClick={onSpeakAddress}
                className={`accessible-tap px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all ${
                  isSpeaking
                    ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                    : isYellow
                    ? 'bg-amber-400 text-black border-amber-400'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{isSpeaking ? 'Speaking...' : 'Listen to Voice'}</span>
              </button>
            </div>

            {/* Indoor Exit Advice */}
            {verification.isIndoors ? (
              <div className="space-y-1 text-xs sm:text-sm font-medium">
                <p>
                  <strong>Context: </strong>{verification.indoorContext || 'Inside shopping mall or building corridor.'}
                </p>
                <p className="text-amber-900 dark:text-amber-200 font-bold flex items-start gap-1.5">
                  <DoorOpen className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
                  <span><strong>Driver Pickup Advice: </strong>{verification.indoorExitGuidance || 'Please step out towards the main ground-floor taxi bay or driveway for driver pickup.'}</span>
                </p>
              </div>
            ) : (
              <p className="text-xs sm:text-sm font-semibold">
                <strong>Pickup Point: </strong>{verification.formattedAddress} ({verification.pickupInstructionsForDriver})
              </p>
            )}
          </div>
        )}

        {/* Presets Quick Picker (For Testing / Fallback) */}
        <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-inherit/70">
          <span className="font-semibold">Quick Singapore Location Presets:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {LOCATION_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedPresetId(p.id);
                  setCapturedPhoto(p.sampleImageUrl);
                  onPickMeUp(p.sampleImageUrl, p);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                  selectedPresetId === p.id
                    ? isYellow
                      ? 'bg-amber-400 text-black border-amber-400'
                      : 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-neutral-800 dark:text-inherit'
                }`}
              >
                {p.title.split(' • ')[0] || p.title.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
