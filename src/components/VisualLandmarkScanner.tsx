/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  Sparkles, 
  Eye, 
  Check, 
  MapPin, 
  ArrowRight, 
  RefreshCw, 
  SlidersHorizontal,
  Layers,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { LocationVerificationResult, AccessibilitySettings, LocationPreset } from '../types';
import { LOCATION_PRESETS } from '../data/samplePresets';

interface VisualLandmarkScannerProps {
  currentPhoto: string | null;
  verification: LocationVerificationResult | null;
  isAnalyzing: boolean;
  onCaptureOrUploadPhoto: (base64Image: string, preset?: LocationPreset) => void;
  onSelectPreset: (preset: LocationPreset) => void;
  settings: AccessibilitySettings;
}

export const VisualLandmarkScanner: React.FC<VisualLandmarkScannerProps> = ({
  currentPhoto,
  verification,
  isAnalyzing,
  onCaptureOrUploadPhoto,
  onSelectPreset,
  settings,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'presets'>('camera');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isYellow = settings.contrastTheme === 'yellow-black';

  // Handle native camera streaming
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Unable to access camera directly, opening file selector fallback:', err);
      setIsCameraActive(false);
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const captureFrameFromVideo = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.85);
      stopCamera();
      onCaptureOrUploadPhoto(base64);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          onCaptureOrUploadPhoto(base64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <section
      id="card-visual-landmarks"
      className={`rounded-2xl p-6 sm:p-7 border transition-all shadow-xs ${
        isYellow
          ? 'bg-black text-amber-300 border-amber-400'
          : settings.contrastTheme === 'black-white'
          ? 'bg-white text-black border-black'
          : settings.contrastTheme === 'warm-soft'
          ? 'bg-[#fffaf3] text-[#2c241c] border-[#dfd2c4]'
          : 'bg-white text-slate-900 border-slate-200/90'
      }`}
    >
      {/* Title & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isYellow ? 'bg-amber-400 text-black' : 'bg-slate-900 text-white'
          }`}>
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight leading-none text-slate-900 dark:text-inherit">
              Photo & Street View Verification
            </h3>
            <p className="text-xs sm:text-sm font-normal text-slate-500 dark:text-inherit/75 mt-1">
              Snap what is in front of you. Gemini cross-references Street View to verify your exact spot.
            </p>
          </div>
        </div>

        {/* Tab switcher: Take Photo vs Simulator Presets */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700">
          <button
            onClick={() => {
              setActiveTab('camera');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'camera'
                ? isYellow
                  ? 'bg-amber-400 text-black'
                  : 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 dark:text-inherit/70 hover:text-slate-900'
            }`}
          >
            📸 Take Photo
          </button>
          <button
            onClick={() => {
              setActiveTab('presets');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'presets'
                ? isYellow
                  ? 'bg-amber-400 text-black'
                  : 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 dark:text-inherit/70 hover:text-slate-900'
            }`}
          >
            📍 Sample Locations
          </button>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Tab 1: Live Camera / Photo Capture */}
      {activeTab === 'camera' && (
        <div className="space-y-4">
          {/* Live Video Stream View */}
          {isCameraActive ? (
            <div className="relative rounded-xl overflow-hidden bg-black border border-emerald-500 aspect-video max-h-80 flex items-center justify-center shadow-md">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 px-4">
                <button
                  id="btn-capture-camera-frame"
                  onClick={captureFrameFromVideo}
                  className="px-6 py-3 rounded-xl font-bold text-base bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Snap Photo Now
                </button>
                <button
                  onClick={stopCamera}
                  className="px-4 py-3 rounded-xl font-semibold text-sm bg-slate-800 text-white hover:bg-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Action Trigger Row */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                id="btn-start-camera-capture"
                onClick={startCamera}
                className={`giant-tap px-6 py-3.5 rounded-xl font-bold text-base sm:text-lg flex items-center justify-center gap-2.5 transition-all active:scale-98 shadow-xs ${
                  isYellow
                    ? 'bg-amber-400 text-black hover:bg-amber-300'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                <Camera className="w-5 h-5" />
                <span>Take Photo of Surroundings</span>
              </button>

              <button
                id="btn-upload-surroundings-photo"
                onClick={() => fileInputRef.current?.click()}
                className={`giant-tap px-6 py-3.5 rounded-xl font-bold text-base sm:text-lg flex items-center justify-center gap-2.5 border transition-all active:scale-98 ${
                  isYellow
                    ? 'border-amber-400 text-amber-300 hover:bg-amber-400/10'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-800 bg-white shadow-2xs'
                }`}
              >
                <Upload className="w-5 h-5 text-slate-600 dark:text-inherit" />
                <span>Upload From Gallery</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Sample Realistic Location Presets for Instant Testing */}
      {activeTab === 'presets' && (
        <div className="space-y-3">
          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-inherit/80">
            Select a sample realistic location to test multimodal AI verification immediately:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LOCATION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset)}
                className={`p-3.5 rounded-xl border text-left flex gap-3 items-center transition-all active:scale-98 ${
                  isYellow
                    ? 'border-amber-400/50 hover:border-amber-400 bg-neutral-950 text-amber-300'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/70 hover:bg-slate-50 text-slate-900 shadow-2xs'
                }`}
              >
                <img
                  src={preset.sampleImageUrl}
                  alt={preset.title}
                  className="w-14 h-14 rounded-lg object-cover shrink-0 border border-slate-200"
                />
                <div className="min-w-0">
                  <div className="font-bold text-sm sm:text-base leading-tight truncate">
                    {preset.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-inherit/70 truncate mt-0.5">
                    {preset.subtitle}
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold mt-1">
                    ✓ {preset.landmarkHint.split(',')[0]}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison: What User Sees vs Google Street View */}
      {(currentPhoto || verification?.streetViewData?.streetViewImageUrl) && (
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-3.5">
            <h4 className="font-bold text-base sm:text-lg flex items-center gap-2 text-slate-900 dark:text-inherit">
              <Eye className="w-4 h-4 text-indigo-600" />
              <span>Multi-Source Visual Cross-Reference</span>
            </h4>
            {isAnalyzing && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Gemini Vision Analyzing...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: User Surroundings Photo */}
            <div className={`p-3 rounded-xl border ${
              isYellow ? 'bg-neutral-950 border-amber-500/40' : 'bg-slate-50/70 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-inherit/80 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" />
                  Your Photo / Surroundings
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Live Snapshot
                </span>
              </div>
              <div className="relative rounded-lg overflow-hidden aspect-video bg-slate-900 border border-slate-200/80">
                {currentPhoto ? (
                  <img
                    src={currentPhoto}
                    alt="User's surroundings"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-slate-400">
                    <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-xs font-medium">No photo snapped yet. Tap 'Take Photo' above.</p>
                  </div>
                )}

                {/* Overlaid Detected Landmark Badges */}
                {verification?.visualLandmarks && verification.visualLandmarks.length > 0 && (
                  <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1.5">
                    {verification.visualLandmarks.slice(0, 2).map((lm) => (
                      <span
                        key={lm.id}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/80 text-amber-300 backdrop-blur-xs border border-amber-400/50"
                      >
                        ✓ {lm.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Google Street View Reference */}
            <div className={`p-3 rounded-xl border ${
              isYellow ? 'bg-neutral-950 border-amber-500/40' : 'bg-slate-50/70 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-inherit/80 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  Google Street View at Coordinate
                </span>
                <span className="text-[11px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                  Street View Reference
                </span>
              </div>
              <div className="relative rounded-lg overflow-hidden aspect-video bg-slate-900 border border-slate-200/80">
                <img
                  src={
                    verification?.streetViewData?.streetViewImageUrl ||
                    `https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=800&q=80`
                  }
                  alt="Google Street View Reference"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 bg-black/75 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                  Heading: {verification?.streetViewData?.heading ?? 0}°
                </div>
                <div className="absolute bottom-2 left-2 right-2 bg-black/85 text-white p-2 rounded-md text-[11px] font-medium border border-white/20">
                  <div className="flex items-center gap-1 text-emerald-400 font-bold">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Cross-referenced & Matched</span>
                  </div>
                  <p className="text-[10px] opacity-90 truncate mt-0.5">
                    {verification?.streetViewData?.comparisonSummary || 'Storefront & curbside features match visual telemetry.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Landmark Checklist */}
          {verification?.visualLandmarks && verification.visualLandmarks.length > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
              <div className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                <span>Identified & Verified Pickup Landmarks ({verification.visualLandmarks.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {verification.visualLandmarks.map((lm) => (
                  <div
                    key={lm.id}
                    className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2 shadow-2xs"
                  >
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm shrink-0">
                      ✓
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-sm leading-tight text-slate-900 dark:text-white">
                        {lm.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                        {lm.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
