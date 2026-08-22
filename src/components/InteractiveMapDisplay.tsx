/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Navigation, 
  Compass, 
  Layers, 
  ZoomIn, 
  ZoomOut, 
  ExternalLink, 
  ShieldCheck,
  Maximize2
} from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { GPSLocation, LocationVerificationResult, AccessibilitySettings } from '../types';

interface InteractiveMapDisplayProps {
  gps: GPSLocation | null;
  verification: LocationVerificationResult | null;
  settings: AccessibilitySettings;
}

export const InteractiveMapDisplay: React.FC<InteractiveMapDisplayProps> = ({
  gps,
  verification,
  settings,
}) => {
  const [zoom, setZoom] = useState(17);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [dynamicKey, setDynamicKey] = useState<string>(() => {
    return ((import.meta as any)?.env?.VITE_GOOGLE_MAPS_API_KEY as string) || '';
  });

  useEffect(() => {
    if (!dynamicKey) {
      fetch('/api/config/maps-key')
        .then((res) => res.json())
        .then((data) => {
          if (data.mapsApiKey) {
            setDynamicKey(data.mapsApiKey);
          }
        })
        .catch((e) => console.warn('Could not fetch server maps key:', e));
    }
  }, [dynamicKey]);

  const isYellow = settings.contrastTheme === 'yellow-black';

  const lat = verification?.verifiedCoordinates?.lat ?? gps?.latitude ?? 1.3327;
  const lng = verification?.verifiedCoordinates?.lng ?? gps?.longitude ?? 103.8479;
  const address = verification?.formattedAddress || 'Locating current spot in Singapore...';

  const mapsApiKey = dynamicKey;

  // Google Maps Embed / Search link
  const openInGoogleMaps = () => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  };

  return (
    <section
      id="card-interactive-map"
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
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isYellow ? 'bg-amber-400 text-black' : 'bg-slate-900 text-white'
          }`}>
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight leading-none text-slate-900 dark:text-inherit">
              Live Map & Navigation Pin
            </h3>
            <p className="text-xs sm:text-sm font-normal text-slate-500 dark:text-inherit/75 mt-1">
              Precision coordinate: {lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openInGoogleMaps}
            className="accessible-tap px-3.5 py-1.5 rounded-xl font-semibold text-xs sm:text-sm border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-all shadow-2xs"
            title="Open coordinates in external Google Maps application"
          >
            <span>Open in Full App</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-neutral-700 bg-slate-950 h-72 sm:h-96 w-full shadow-inner">
        {mapsApiKey ? (
          <APIProvider apiKey={mapsApiKey}>
            <Map
              defaultCenter={{ lat, lng }}
              center={{ lat, lng }}
              defaultZoom={zoom}
              zoom={zoom}
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              disableDefaultUI={false}
              style={{ width: '100%', height: '100%' }}
            >
              <AdvancedMarker position={{ lat, lng }}>
                <Pin background="#059669" glyphColor="#ffffff" borderColor="#047857" scale={1.3} />
              </AdvancedMarker>
            </Map>
          </APIProvider>
        ) : (
          /* High-Contrast Interactive Visual Canvas Map View */
          <div className="relative w-full h-full">
            {/* OpenStreetMap / Carto Tile layer */}
            <iframe
              title="Interactive Pickup Map"
              width="100%"
              height="100%"
              frameBorder="0"
              scrolling="no"
              marginHeight={0}
              marginWidth={0}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.003}%2C${lat - 0.002}%2C${lng + 0.003}%2C${lat + 0.002}&layer=mapnik&marker=${lat}%2C${lng}`}
              className="w-full h-full filter contrast-105"
            />

            {/* Custom Overlay Pin & Pulsing Radius */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 animate-ping absolute"></div>
                <div className="w-14 h-14 rounded-full bg-emerald-500/30 border border-emerald-600 absolute"></div>
                <div className="z-10 p-2 rounded-full bg-emerald-600 text-white shadow-xl border-2 border-white transform -translate-y-3">
                  <MapPin className="w-7 h-7" />
                </div>
              </div>
            </div>

            {/* In-Map Info Overlay Pill */}
            <div className="absolute top-3 left-3 right-3 sm:right-auto bg-black/85 backdrop-blur-md text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-white/20 shadow-md flex items-center gap-2 pointer-events-auto">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="truncate">
                <span className="text-emerald-400">Verified Pin:</span> {address}
              </div>
            </div>

            {/* Zoom / Re-center Overlay Controls */}
            <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 pointer-events-auto">
              <button
                onClick={openInGoogleMaps}
                className="px-3 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-50 shadow-md font-semibold text-xs flex items-center gap-1.5 border border-slate-200"
                title="Open directly in Google Maps"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                <span>Google Maps</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Driver Coordinates & Notes bar */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-medium text-slate-500 dark:text-inherit/80">
        <div className="flex items-center gap-1.5">
          <Compass className="w-4 h-4 text-emerald-600" />
          <span>Coordinates: {lat.toFixed(6)}, {lng.toFixed(6)}</span>
        </div>
        <div>
          <span>Navigation ready for Google Maps, Apple Maps & Waze</span>
        </div>
      </div>
    </section>
  );
};
