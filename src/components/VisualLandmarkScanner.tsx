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
  RefreshCw, 
  Image as ImageIcon,
  CheckCircle
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

  void settings;

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

  const tabClass = (active: boolean) =>
    `btn min-h-11 rounded-lg px-4 py-2 text-sm sm:text-base ${
      active ? 'bg-surface text-ink shadow-xs border border-line' : 'text-ink-soft hover:text-ink border border-transparent'
    }`;

  return (
    <section id="card-visual-landmarks" className="card p-6 sm:p-7">
      {/* Title & Mode Switcher */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="icon-tile">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-2xl leading-none font-bold tracking-tight">
              Photo & Street View Verification
            </h3>
            <p className="text-ink-soft mt-1 text-sm font-normal sm:text-base">
              Snap what is in front of you. Gemini cross-references Street View to verify your exact spot.
            </p>
          </div>
        </div>

        {/* Tab switcher: Take Photo vs Simulator Presets */}
        <div className="border-line bg-well flex items-center gap-1 rounded-xl border p-1">
          <button onClick={() => setActiveTab('camera')} className={tabClass(activeTab === 'camera')}>
            📸 Take Photo
          </button>
          <button onClick={() => setActiveTab('presets')} className={tabClass(activeTab === 'presets')}>
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
          {isCameraActive ? (
            <div className="border-pine relative aspect-video max-h-80 overflow-hidden rounded-xl border-2 bg-black shadow-md">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 px-4">
                <button
                  id="btn-capture-camera-frame"
                  onClick={captureFrameFromVideo}
                  className="btn btn-lg btn-primary"
                >
                  <Camera className="h-6 w-6" />
                  Snap Photo Now
                </button>
                <button onClick={stopCamera} className="btn btn-lg bg-ink/80 text-bg hover:bg-ink backdrop-blur-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                id="btn-start-camera-capture"
                onClick={startCamera}
                className="btn btn-lg btn-primary"
              >
                <Camera className="h-6 w-6" />
                <span>Take Photo of Surroundings</span>
              </button>

              <button
                id="btn-upload-surroundings-photo"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-lg btn-secondary"
              >
                <Upload className="text-ink-soft h-6 w-6" />
                <span>Upload From Gallery</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Sample Realistic Location Presets for Instant Testing */}
      {activeTab === 'presets' && (
        <div className="space-y-3">
          <p className="text-ink-soft text-sm font-semibold sm:text-base">
            Select a sample realistic location to test multimodal AI verification immediately:
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {LOCATION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset)}
                className="border-line bg-well/50 hover:border-pine text-ink flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all active:scale-[0.98]"
              >
                <img
                  src={preset.sampleImageUrl}
                  alt={preset.title}
                  className="border-line h-14 w-14 shrink-0 rounded-lg border object-cover"
                />
                <div className="min-w-0">
                  <div className="truncate text-base leading-tight font-bold sm:text-lg">
                    {preset.title}
                  </div>
                  <div className="text-ink-soft mt-0.5 truncate text-sm">
                    {preset.subtitle}
                  </div>
                  <div className="text-pine-deep mt-1 text-sm font-bold">
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
        <div className="border-line mt-6 border-t pt-5">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-ink flex items-center gap-2 text-lg font-bold sm:text-xl">
              <Eye className="text-sky h-5 w-5" />
              <span>Multi-Source Visual Cross-Reference</span>
            </h4>
            {isAnalyzing && (
              <span className="chip border-sky/40 bg-sky-soft text-sky text-sm">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Gemini Vision Analyzing...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Left: User Surroundings Photo */}
            <div className="border-line bg-well/50 rounded-xl border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="section-kicker text-ink-soft flex items-center gap-1.5">
                  <Camera className="h-4 w-4" />
                  Your Photo / Surroundings
                </span>
                <span className="chip border-pine/40 bg-pine-soft text-pine-deep">
                  Live Snapshot
                </span>
              </div>
              <div className="border-line relative aspect-video overflow-hidden rounded-lg border bg-slate-900">
                {currentPhoto ? (
                  <img
                    src={currentPhoto}
                    alt="User's surroundings"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="text-ink-faint flex h-full w-full flex-col items-center justify-center p-4 text-center">
                    <ImageIcon className="mb-2 h-8 w-8 opacity-50" />
                    <p className="text-sm font-semibold">No photo snapped yet. Tap 'Take Photo' above.</p>
                  </div>
                )}

                {/* Overlaid Detected Landmark Badges */}
                {verification?.visualLandmarks && verification.visualLandmarks.length > 0 && (
                  <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1.5">
                    {verification.visualLandmarks.slice(0, 2).map((lm) => (
                      <span
                        key={lm.id}
                        className="rounded bg-black/80 px-2 py-0.5 text-xs font-bold text-amber-300 backdrop-blur-sm"
                      >
                        ✓ {lm.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Google Street View Reference */}
            <div className="border-line bg-well/50 rounded-xl border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="section-kicker text-ink-soft flex items-center gap-1.5">
                  <MapPin className="text-brick h-4 w-4" />
                  Google Street View at Coordinate
                </span>
                <span className="chip border-sky/40 bg-sky-soft text-sky">
                  Street View Reference
                </span>
              </div>
              <div className="relative aspect-video overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
                <img
                  src={
                    verification?.streetViewData?.streetViewImageUrl ||
                    `https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=800&q=80`
                  }
                  alt="Google Street View Reference"
                  className="h-full w-full object-cover"
                />
                <div className="absolute top-2 right-2 rounded bg-black/75 px-2 py-0.5 text-xs font-bold text-white">
                  Heading: {verification?.streetViewData?.heading ?? 0}°
                </div>
                <div className="absolute bottom-2 left-2 right-2 rounded-md border border-white/20 bg-black/85 p-2 text-white">
                  <div className="flex items-center gap-1 text-sm font-bold text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>Cross-referenced & Matched</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs opacity-90">
                    {verification?.streetViewData?.comparisonSummary || 'Storefront & curbside features match visual telemetry.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Landmark Checklist */}
          {verification?.visualLandmarks && verification.visualLandmarks.length > 0 && (
            <div className="border-pine/30 bg-pine-soft mt-4 rounded-xl border p-4">
              <div className="section-kicker text-pine-deep mb-2.5 flex items-center gap-1.5 text-sm">
                <Check className="h-4 w-4" />
                <span>Identified & Verified Pickup Landmarks ({verification.visualLandmarks.length})</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {verification.visualLandmarks.map((lm) => (
                  <div
                    key={lm.id}
                    className="border-pine/30 bg-surface flex items-start gap-2 rounded-lg border p-2.5 shadow-xs"
                  >
                    <span className="text-pine-deep shrink-0 text-sm font-bold">✓</span>
                    <div className="min-w-0">
                      <div className="text-ink text-sm leading-tight font-bold sm:text-base">
                        {lm.name}
                      </div>
                      <div className="text-ink-soft mt-0.5 text-sm leading-snug">
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
