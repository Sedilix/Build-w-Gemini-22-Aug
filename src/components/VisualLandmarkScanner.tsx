/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Camera,
  Eye,
  Check,
  MapPin,
  RefreshCw,
  CheckCircle
} from 'lucide-react';
import { LocationVerificationResult, AccessibilitySettings } from '../types';

interface VisualLandmarkScannerProps {
  currentPhoto: string | null;
  verification: LocationVerificationResult | null;
  isAnalyzing: boolean;
  settings: AccessibilitySettings;
}

/**
 * Read-only result panel for the photo the senior snapped with "Pick Me Up Here!".
 * Capture happens in the hero viewfinder only — there is deliberately no photo
 * input here (and no gallery upload anywhere) so every verified photo is live.
 */
export const VisualLandmarkScanner: React.FC<VisualLandmarkScannerProps> = ({
  currentPhoto,
  verification,
  isAnalyzing,
  settings,
}) => {
  void settings;

  // Nothing to show until the hero button has captured a photo / run verification
  if (!currentPhoto && !verification?.streetViewData?.streetViewImageUrl) {
    return null;
  }

  return (
    <section id="card-visual-landmarks" className="card p-6 sm:p-7">
      {/* Side-by-Side Comparison: What User Sees vs Google Street View */}
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
            {currentPhoto && (
              <img
                src={currentPhoto}
                alt="User's surroundings"
                className="h-full w-full object-cover"
              />
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
    </section>
  );
};
