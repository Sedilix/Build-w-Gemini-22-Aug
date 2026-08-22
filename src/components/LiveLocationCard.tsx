/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  MapPin, 
  Volume2, 
  RefreshCw, 
  ShieldCheck, 
  Compass, 
  Navigation, 
  Clock, 
  Info,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { GPSLocation, LocationVerificationResult, AccessibilitySettings } from '../types';

interface LiveLocationCardProps {
  gps: GPSLocation | null;
  verification: LocationVerificationResult | null;
  isLoadingGPS: boolean;
  isVerifyingAI: boolean;
  onRefreshGPS: () => void;
  onSpeakAddress: () => void;
  isSpeaking: boolean;
  settings: AccessibilitySettings;
}

export const LiveLocationCard: React.FC<LiveLocationCardProps> = ({
  gps,
  verification,
  isLoadingGPS,
  isVerifyingAI,
  onRefreshGPS,
  onSpeakAddress,
  isSpeaking,
  settings,
}) => {
  const isYellow = settings.contrastTheme === 'yellow-black';

  const address = verification?.formattedAddress || (gps ? `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}` : 'Locating your current address...');
  const accuracy = verification?.originalCoordinates?.accuracyMeters ?? gps?.accuracy ?? 25;
  const isExactVerified = verification?.accuracyLevel === 'EXACT' || verification?.accuracyLevel === 'HIGH';

  const textScale = settings.fontSize === 'extra-large' 
    ? 'text-3xl sm:text-4xl' 
    : settings.fontSize === 'large' 
    ? 'text-2xl sm:text-3xl' 
    : 'text-xl sm:text-2xl';

  return (
    <section
      id="card-live-location"
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
      {/* Header Banner: Status & Confidence */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-3.5 border-b border-slate-100 dark:border-neutral-800">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
          </span>
          <span className="font-bold text-xs sm:text-sm tracking-wide uppercase text-slate-700 dark:text-inherit">
            {isVerifyingAI ? 'Verifying with Gemini & Maps...' : 'Live Pickup Location'}
          </span>
        </div>

        {/* Multi-source Confidence Pill */}
        <div className="flex items-center gap-2">
          {verification && (
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold text-xs border ${
              isYellow
                ? 'bg-amber-400 text-black border-amber-400'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-inherit" />
              <span>{verification.confidenceScore}% Verified</span>
            </div>
          )}

          <div className="text-xs font-medium text-slate-500 dark:text-inherit/70 flex items-center gap-1">
            <Navigation className="w-3.5 h-3.5" />
            <span>Accuracy: ±{Math.round(accuracy)}m</span>
          </div>
        </div>
      </div>

      {/* Main Address Display */}
      <div className="flex items-start gap-4 mb-5">
        <div className={`p-3 sm:p-3.5 rounded-xl shrink-0 mt-1 ${
          isYellow 
            ? 'bg-amber-400 text-black' 
            : 'bg-slate-900 text-white shadow-xs'
        }`}>
          <MapPin className="w-7 h-7 sm:w-8 sm:h-8" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-inherit/70 mb-1">
            Where you are standing
          </div>
          <h2 className={`${textScale} font-bold leading-tight tracking-tight text-slate-900 dark:text-inherit break-words`}>
            {address}
          </h2>

          {verification?.streetName && (
            <div className="mt-1.5 text-sm sm:text-base font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{verification.streetName} • {verification.nearbyCrossStreet}</span>
            </div>
          )}
        </div>
      </div>

      {/* Elder Voice Summary / Driver Note */}
      {verification && (
        <div className={`p-4 rounded-xl mb-5 border ${
          isYellow 
            ? 'bg-neutral-900 border-amber-500/50 text-amber-200' 
            : 'bg-amber-50/70 border-amber-200/80 text-amber-950'
        }`}>
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <div className="font-bold text-xs uppercase tracking-wide opacity-80 mb-0.5">
                AI Pickup Instructions for Driver & Caregiver
              </div>
              <p className="text-sm sm:text-base font-medium leading-snug">
                "{verification.pickupInstructionsForDriver}"
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Read Address Button */}
        <button
          id="btn-speak-address-large"
          onClick={onSpeakAddress}
          className={`giant-tap px-6 py-3.5 rounded-xl font-bold text-base sm:text-lg flex items-center justify-center gap-2.5 transition-all active:scale-98 shadow-xs ${
            isYellow
              ? 'bg-amber-400 text-black hover:bg-amber-300'
              : 'bg-slate-900 hover:bg-slate-800 text-white'
          }`}
          aria-label="Read my current address out loud"
        >
          <Volume2 className={`w-5 h-5 ${isSpeaking ? 'animate-bounce text-amber-400' : ''}`} />
          <span>{isSpeaking ? 'Reading Address...' : 'Read Address Out Loud'}</span>
        </button>

        {/* Refresh GPS Button */}
        <button
          id="btn-refresh-gps-location"
          onClick={onRefreshGPS}
          disabled={isLoadingGPS}
          className={`giant-tap px-6 py-3.5 rounded-xl font-bold text-base sm:text-lg flex items-center justify-center gap-2.5 border transition-all active:scale-98 ${
            isYellow
              ? 'border-amber-400 text-amber-300 hover:bg-amber-400/10'
              : 'border-slate-200 hover:bg-slate-50 text-slate-800 bg-white shadow-2xs'
          }`}
        >
          <RefreshCw className={`w-5 h-5 ${isLoadingGPS ? 'animate-spin' : ''}`} />
          <span>{isLoadingGPS ? 'Refreshing GPS...' : 'Update My Location'}</span>
        </button>
      </div>

      {/* Reassuring Safe Waiting Tip & Multi-API Accuracy Indicators */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-neutral-800 space-y-2">
        {verification?.safeWaitingAdvice && (
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-inherit/80">
            <Info className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{verification.safeWaitingAdvice}</span>
          </div>
        )}

        {/* Multi-API Synergy Badges */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Places API: {verification?.nearbyPlaces?.length ? `${verification.nearbyPlaces.length} Landmarks` : 'Nearby POIs'}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Roads API: {verification?.roadSnapping?.snapped ? 'Curbside Snapped' : 'Road Aligned'}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Routes API: Live Driver Navigation
          </span>
        </div>
      </div>
    </section>
  );
};
