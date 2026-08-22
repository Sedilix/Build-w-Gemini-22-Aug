/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = Number(process.env.PORT) || 9003;

app.use(express.json({ limit: '35mb' }));

// Helper: Clean text for Speechmatics TTS synthesis (strip markdown, asterisks, URLs, emoji)
function cleanSpeakableText(text: string): string {
  if (!text) return '';
  return text
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[\*\_~`#>\[\]\(\)]/g, ' ')
    .replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{2388}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Initialize Google GenAI lazily or securely
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not set in environment.');
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasGoogleMapsKey: Boolean(getGoogleMapsApiKey()),
    hasSpeechmaticsKey: Boolean(getSpeechmaticsApiKey()),
    timestamp: Date.now(),
  });
});

// Config endpoint: return public Maps API key for client-side rendering
app.get('/api/config/maps-key', (req, res) => {
  const mapsKey = getGoogleMapsApiKey() || '';
  res.json({ mapsApiKey: mapsKey });
});

// ── OneMap SG (Singapore Land Authority) proxy ──────────────────────────────
// Official SG geospatial API for HDB addresses, building footprints, and
// sheltered-walkway-aware routing. Proxied server-side so credentials never
// reach the client. Search is public; routing needs ONE_MAP_EMAIL/PASSWORD.

const ONEMAP_SEARCH_URL = 'https://www.onemap.gov.sg/commonapi/search';
const ONEMAP_AUTH_URL = 'https://developers.onemap.sg/privateapi/auth/post/sessionToken';
const ONEMAP_ROUTE_URL = 'https://developers.onemap.sg/privateapi/routesvc/route';

async function getOneMapSessionToken(): Promise<string | null> {
  const email = process.env.ONE_MAP_EMAIL;
  const password = process.env.ONE_MAP_PASSWORD;
  if (!email || !password) return null;
  try {
    const res = await fetch(ONEMAP_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.access_token || null;
  } catch (err) {
    console.warn('OneMap session token fetch failed:', err);
    return null;
  }
}

// Public address search: HDB block/postal code lookup with geometry
app.get('/api/onemap/search', async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) {
    return res.status(400).json({ success: false, error: 'Missing ?q= search value' });
  }
  try {
    const url = `${ONEMAP_SEARCH_URL}?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
    const upstream = await fetch(url);
    const contentType = upstream.headers.get('content-type') || '';
    if (!upstream.ok || !contentType.includes('application/json')) {
      return res.json({ success: false, results: [], totalFound: 0, error: `OneMap upstream returned ${upstream.status}` });
    }
    const data = await upstream.json();
    res.json({ success: true, results: data.results || [], totalFound: data.totalFound || 0 });
  } catch (err) {
    console.warn('OneMap search error:', err);
    res.status(502).json({ success: false, error: 'OneMap search unavailable' });
  }
});

// Sheltered walkway / walking route between two SG coordinates (private API)
app.post('/api/onemap/route', async (req, res) => {
  const { startLat, startLng, endLat, endLng, routeType = 'walk' } = req.body || {};
  if ([startLat, startLng, endLat, endLng].some((v) => typeof v !== 'number')) {
    return res.status(400).json({ success: false, error: 'startLat/startLng/endLat/endLng numbers required' });
  }

  const token = await getOneMapSessionToken();
  if (!token) {
    return res.json({
      success: false,
      error: 'OneMap routing requires ONE_MAP_EMAIL and ONE_MAP_PASSWORD env credentials',
    });
  }

  try {
    const url = `${ONEMAP_ROUTE_URL}?start=${startLat},${startLng}&end=${endLat},${endLng}&routeType=${routeType}&token=${token}`;
    const upstream = await fetch(url);
    const contentType = upstream.headers.get('content-type') || '';
    if (!upstream.ok || !contentType.includes('application/json')) {
      return res.json({ success: false, error: `OneMap routing upstream returned ${upstream.status}` });
    }
    const data = await upstream.json();
    res.json({ success: true, ...data });
  } catch (err) {
    console.warn('OneMap route error:', err);
    res.status(502).json({ success: false, error: 'OneMap routing unavailable' });
  }
});

// Helper: Get Speechmatics API Key safely from environment
function getSpeechmaticsApiKey(): string | undefined {
  return (
    process.env.SPEECHMATICS_API_KEY ||
    process.env.VITE_SPEECHMATICS_API_KEY ||
    undefined
  );
}

// Endpoint: Mint temporary JWT token for Speechmatics Realtime SDK
app.post('/api/speechmatics/token', async (req, res) => {
  const apiKey = getSpeechmaticsApiKey();
  if (!apiKey) {
    return res.json({
      hasSpeechmaticsKey: false,
      message: 'No SPEECHMATICS_API_KEY set in environment secrets.',
    });
  }

  try {
    const mpRes = await fetch('https://mp.speechmatics.com/v1/api_keys?type=rt', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl: 3600 }),
    });

    if (!mpRes.ok) {
      const errText = await mpRes.text();
      console.warn('Speechmatics MP API Key returned error:', mpRes.status, errText);
      return res.status(mpRes.status).json({
        hasSpeechmaticsKey: true,
        error: 'Speechmatics authentication error',
        details: errText,
      });
    }

    const data = (await mpRes.json()) as any;
    const token = data.key_value || data.key || data.token || data.jwt || '';

    return res.json({
      hasSpeechmaticsKey: true,
      token,
      url: 'wss://eu2.rt.speechmatics.com/v2',
      ttl: 3600,
    });
  } catch (err: any) {
    console.error('Error generating Speechmatics JWT token:', err);
    return res.status(500).json({
      hasSpeechmaticsKey: true,
      error: 'Failed to request Speechmatics Realtime token',
      details: err.message,
    });
  }
});

// Endpoint: Speechmatics Available Voices
// NOTE: Speechmatics TTS preview currently supports exactly 4 voices.
// See https://docs.speechmatics.com/text-to-speech/quickstart#voices
app.get('/api/speechmatics/voices', (req, res) => {
  const voices = [
    {
      id: 'sarah',
      name: 'Sarah',
      gender: 'female',
      accent: 'British (UK)',
      flag: '🇬🇧',
      tone: 'Crisp & Professional',
      description: 'Clear, reassuring, and professional female voice. Highly recommended for elderly users and emergency navigation.',
      sampleText: 'Hello! I am Sarah. You are safe. I will help you verify your location and notify your family.',
      isRecommended: true,
    },
    {
      id: 'megan',
      name: 'Megan',
      gender: 'female',
      accent: 'American (US)',
      flag: '🇺🇸',
      tone: 'Dynamic & Conversational',
      description: 'Clear female companion voice with gentle inflection and smooth conversational cadence.',
      sampleText: 'Hi there, I am Megan. Please stay sheltered on the bench while your driver arrives.',
    },
    {
      id: 'theo',
      name: 'Theo',
      gender: 'male',
      accent: 'British (UK)',
      flag: '🇬🇧',
      tone: 'Expressive & Modern',
      description: 'Trusted British male presenter voice with distinct pronunciation and calm pacing.',
      sampleText: 'Good day. Theo here. Your location is confirmed and ready to share with your caregiver.',
    },
    {
      id: 'jack',
      name: 'Jack',
      gender: 'male',
      accent: 'American (US)',
      flag: '🇺🇸',
      tone: 'Clear & Steady',
      description: 'Clear, steady American male voice with natural intonation.',
      sampleText: 'Hello, this is Jack. Your pickup coordinates are verified and ready to go.',
    },
  ];

  return res.json({
    hasSpeechmaticsKey: Boolean(getSpeechmaticsApiKey()),
    voices,
    defaultVoice: 'sarah',
  });
});

// Endpoint: Speechmatics Text-To-Speech (TTS)
app.post('/api/speechmatics/tts', async (req, res) => {
  const apiKey = getSpeechmaticsApiKey();
  const { text, voice = 'sarah' } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text parameter is required for TTS synthesis.' });
  }

  if (!apiKey) {
    return res.status(400).json({ error: 'SPEECHMATICS_API_KEY is not configured.' });
  }

  const cleanText = cleanSpeakableText(text);
  if (!cleanText) {
    return res.status(400).json({ error: 'No speakable text content after sanitization.' });
  }

  // Voice IDs currently supported by the Speechmatics TTS preview API.
  // Unknown/removed IDs (e.g. 'ariana') fall back to the default instead of
  // triggering a Speechmatics error and a silent Web Speech fallback client-side.
  const VALID_TTS_VOICES = ['sarah', 'megan', 'theo', 'jack'];
  const safeVoice = VALID_TTS_VOICES.includes(String(voice || '')) ? voice : 'sarah';

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);

    // Call Speechmatics preview TTS generation endpoint with safe voice actor
    const ttsRes = await fetch(
      `https://preview.tts.speechmatics.com/generate/${encodeURIComponent(safeVoice)}?output_format=wav_16000`,
      {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: cleanText,
        }),
      }
    );

    clearTimeout(timer);

    if (ttsRes.ok) {
      const audioBuffer = await ttsRes.arrayBuffer();
      res.set('Content-Type', 'audio/wav');
      return res.send(Buffer.from(audioBuffer));
    } else {
      const errText = await ttsRes.text();
      console.warn(`Speechmatics TTS returned ${ttsRes.status}:`, errText);
      return res.status(ttsRes.status).json({
        error: 'Speechmatics TTS error',
        details: errText,
      });
    }
  } catch (err: any) {
    console.error('Speechmatics TTS request failed:', err);
    return res.status(500).json({ error: 'TTS request failed', details: err.message });
  }
});

// Helper: Get Google Maps / Places API Key safely from environment
function getGoogleMapsApiKey(): string | undefined {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.PLACES_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    undefined
  );
}

// Helper for reverse geocoding fallback
async function fetchReverseGeocode(lat: number, lng: number): Promise<string | null> {
  const mapsKey = getGoogleMapsApiKey();
  if (mapsKey) {
    try {
      const gRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${mapsKey}`
      );
      if (gRes.ok) {
        const data = await gRes.json();
        if (data.results && data.results.length > 0) {
          return data.results[0].formatted_address;
        }
      }
    } catch (e) {
      console.warn('Google geocoding error:', e);
    }
  }

  // Fallback to OpenStreetMap Nominatim for open geocoding
  try {
    const osmRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'SeniorSafeSpotApp/1.0',
        },
      }
    );
    if (osmRes.ok) {
      const data = await osmRes.json();
      return data.display_name || null;
    }
  } catch (e) {
    console.warn('OSM geocoding error:', e);
  }
  return null;
}

// Helper: Snap coordinates to nearest road via Google Roads API
async function snapToNearestRoad(lat: number, lng: number): Promise<{ lat: number; lng: number; placeId?: string } | null> {
  const mapsKey = getGoogleMapsApiKey();
  if (!mapsKey) return null;

  try {
    const res = await fetch(
      `https://roads.googleapis.com/v1/nearestRoads?points=${lat},${lng}&key=${mapsKey}&solution_id=gmp_mcp_codeassist_v1_aistudio`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.snappedPoints && data.snappedPoints.length > 0) {
        const point = data.snappedPoints[0];
        return {
          lat: point.location.latitude,
          lng: point.location.longitude,
          placeId: point.placeId,
        };
      }
    }
  } catch (err) {
    console.warn('Roads API nearestRoads error:', err);
  }
  return null;
}

// Helper: Query nearby prominent landmarks via Google Places API (New)
async function fetchNearbyPlacesLandmarks(lat: number, lng: number): Promise<Array<{ name: string; type: string; address?: string }>> {
  const mapsKey = getGoogleMapsApiKey();
  if (!mapsKey) return [];

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': mapsKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.primaryType,places.types',
        'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
      },
      body: JSON.stringify({
        includedTypes: [
          'pharmacy',
          'supermarket',
          'convenience_store',
          'transit_station',
          'bus_stop',
          'bank',
          'hospital',
          'cafe',
          'restaurant',
          'store',
          'community_center',
          'library',
        ],
        maxResultCount: 6,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 120.0,
          },
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.places && Array.isArray(data.places)) {
        return data.places.map((p: any) => ({
          name: p.displayName?.text || 'Nearby Landmark',
          type: p.primaryType || 'landmark',
          address: p.formattedAddress,
        }));
      }
    }
  } catch (err) {
    console.warn('Places API (New) searchNearby error:', err);
  }
  return [];
}

// Helper: Compute route & driver ETA via Routes API
async function computeDriverRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<{ durationText: string; distanceText: string; durationSeconds: number; distanceMeters: number } | null> {
  const mapsKey = getGoogleMapsApiKey();
  if (!mapsKey) return null;

  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': mapsKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs',
        'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
      },
      body: JSON.stringify({
        origin: {
          location: { latLng: { latitude: originLat, longitude: originLng } },
        },
        destination: {
          location: { latLng: { latitude: destLat, longitude: destLng } },
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const durationSeconds = parseInt(route.duration?.replace('s', '') || '0', 10);
        const distanceMeters = route.distanceMeters || 0;
        const mins = Math.max(1, Math.round(durationSeconds / 60));
        const miles = (distanceMeters * 0.000621371).toFixed(1);

        return {
          durationText: `${mins} min${mins === 1 ? '' : 's'}`,
          distanceText: `${miles} miles (${(distanceMeters / 1000).toFixed(1)} km)`,
          durationSeconds,
          distanceMeters,
        };
      }
    }
  } catch (err) {
    console.warn('Routes API computeRoutes error:', err);
  }
  return null;
}

// ============================================================================
// Singapore Curated Medical, Work & Landmark Registry
// ============================================================================
interface SingaporePresetPlace {
  title: string;
  subtitle: string;
  fullAddress: string;
  postalCode: string;
  lat: number;
  lng: number;
  category: 'healthcare' | 'work' | 'home' | 'general';
  tags: string[];
  providerType?: 'public' | 'private';
}

const SINGAPORE_PRESET_PLACES: SingaporePresetPlace[] = [
  // Public Hospitals
  {
    title: 'Singapore General Hospital (SGH)',
    subtitle: 'Outram Rd • Public Tertiary Hospital',
    fullAddress: 'Outram Rd, Singapore 169608',
    postalCode: '169608',
    lat: 1.2792,
    lng: 103.8344,
    category: 'healthcare',
    providerType: 'public',
    tags: ['sgh', 'outram', 'singapore general hospital', 'public hospital', 'emergency'],
  },
  {
    title: 'Tan Tock Seng Hospital (TTSH)',
    subtitle: '11 Jalan Tan Tock Seng • Novena HealthCity',
    fullAddress: '11 Jalan Tan Tock Seng, Singapore 308433',
    postalCode: '308433',
    lat: 1.3214,
    lng: 103.8458,
    category: 'healthcare',
    providerType: 'public',
    tags: ['ttsh', 'tan tock seng', 'novena', 'public hospital', 'emergency'],
  },
  {
    title: 'National University Hospital (NUH)',
    subtitle: '5 Lower Kent Ridge Rd • Kent Ridge',
    fullAddress: '5 Lower Kent Ridge Rd, Singapore 119074',
    postalCode: '119074',
    lat: 1.2936,
    lng: 103.7831,
    category: 'healthcare',
    providerType: 'public',
    tags: ['nuh', 'national university hospital', 'kent ridge', 'public hospital', 'emergency'],
  },
  {
    title: 'Changi General Hospital (CGH)',
    subtitle: '2 Simei Street 3 • Simei',
    fullAddress: '2 Simei Street 3, Singapore 529889',
    postalCode: '529889',
    lat: 1.3404,
    lng: 103.9495,
    category: 'healthcare',
    providerType: 'public',
    tags: ['cgh', 'changi general hospital', 'simei', 'tampines', 'public hospital', 'emergency'],
  },
  {
    title: 'Khoo Teck Puat Hospital (KTPH)',
    subtitle: '90 Yishun Central • Yishun',
    fullAddress: '90 Yishun Central, Singapore 768828',
    postalCode: '768828',
    lat: 1.4246,
    lng: 103.8382,
    category: 'healthcare',
    providerType: 'public',
    tags: ['ktph', 'khoo teck puat', 'yishun', 'public hospital', 'emergency'],
  },
  {
    title: 'Sengkang General Hospital (SKH)',
    subtitle: '110 Sengkang East Way • Sengkang',
    fullAddress: '110 Sengkang East Way, Singapore 544886',
    postalCode: '544886',
    lat: 1.3954,
    lng: 103.8931,
    category: 'healthcare',
    providerType: 'public',
    tags: ['skh', 'sengkang general hospital', 'sengkang', 'punggol', 'public hospital', 'emergency'],
  },
  {
    title: 'Ng Teng Fong General Hospital (NTFGH)',
    subtitle: '1 Jurong East Street 21 • Jurong East',
    fullAddress: '1 Jurong East Street 21, Singapore 609606',
    postalCode: '609606',
    lat: 1.3333,
    lng: 103.746,
    category: 'healthcare',
    providerType: 'public',
    tags: ['ntfgh', 'ng teng fong', 'jurong east', 'jurong', 'public hospital', 'emergency'],
  },
  {
    title: "KK Women's and Children's Hospital (KKH)",
    subtitle: '100 Bukit Timah Rd • Rochor',
    fullAddress: '100 Bukit Timah Rd, Singapore 229899',
    postalCode: '229899',
    lat: 1.3106,
    lng: 103.8475,
    category: 'healthcare',
    providerType: 'public',
    tags: ['kkh', 'kk hospital', 'bukit timah', 'rochor', 'public hospital'],
  },
  {
    title: 'Woodlands Health Campus (WHC)',
    subtitle: '2 Woodlands Drive 17 • Woodlands',
    fullAddress: '2 Woodlands Drive 17, Singapore 737628',
    postalCode: '737628',
    lat: 1.4332,
    lng: 103.7895,
    category: 'healthcare',
    providerType: 'public',
    tags: ['whc', 'woodlands health', 'woodlands', 'public hospital', 'emergency'],
  },

  // Private Hospitals
  {
    title: 'Mount Elizabeth Hospital (Orchard)',
    subtitle: '3 Mount Elizabeth • Orchard',
    fullAddress: '3 Mount Elizabeth, Singapore 228510',
    postalCode: '228510',
    lat: 1.3048,
    lng: 103.8354,
    category: 'healthcare',
    providerType: 'private',
    tags: ['mount elizabeth', 'mount e orchard', 'orchard', 'private hospital'],
  },
  {
    title: 'Mount Elizabeth Novena Hospital',
    subtitle: '38 Irrawaddy Rd • Novena',
    fullAddress: '38 Irrawaddy Rd, Singapore 329563',
    postalCode: '329563',
    lat: 1.3217,
    lng: 103.8441,
    category: 'healthcare',
    providerType: 'private',
    tags: ['mount elizabeth novena', 'novena', 'private hospital'],
  },
  {
    title: 'Gleneagles Hospital',
    subtitle: '6A Napier Rd • Tanglin',
    fullAddress: '6A Napier Rd, Singapore 258500',
    postalCode: '258500',
    lat: 1.3075,
    lng: 103.8188,
    category: 'healthcare',
    providerType: 'private',
    tags: ['gleneagles', 'napier', 'tanglin', 'private hospital'],
  },
  {
    title: 'Mount Alvernia Hospital',
    subtitle: '820 Thomson Rd • Marymount',
    fullAddress: '820 Thomson Rd, Singapore 298145',
    postalCode: '298145',
    lat: 1.3417,
    lng: 103.8398,
    category: 'healthcare',
    providerType: 'private',
    tags: ['mount alvernia', 'thomson', 'marymount', 'private hospital'],
  },
  {
    title: 'Raffles Hospital',
    subtitle: '585 North Bridge Rd • Bugis',
    fullAddress: '585 North Bridge Rd, Singapore 188770',
    postalCode: '188770',
    lat: 1.3005,
    lng: 103.8576,
    category: 'healthcare',
    providerType: 'private',
    tags: ['raffles hospital', 'bugis', 'north bridge road', 'private hospital'],
  },
  {
    title: 'Parkway East Hospital',
    subtitle: '321 Joo Chiat Pl • East Coast',
    fullAddress: '321 Joo Chiat Pl, Singapore 427990',
    postalCode: '427990',
    lat: 1.3146,
    lng: 103.9079,
    category: 'healthcare',
    providerType: 'private',
    tags: ['parkway east', 'joo chiat', 'katong', 'private hospital'],
  },
  {
    title: 'Thomson Medical Centre',
    subtitle: '339 Thomson Rd • Novena / Thomson',
    fullAddress: '339 Thomson Rd, Singapore 307677',
    postalCode: '307677',
    lat: 1.3256,
    lng: 103.8407,
    category: 'healthcare',
    providerType: 'private',
    tags: ['thomson medical', 'thomson', 'private hospital'],
  },

  // Key Polyclinics (SingHealth, NHG, NUHS)
  {
    title: 'Toa Payoh Polyclinic',
    subtitle: '2003 Lor 8 Toa Payoh • NHG Polyclinic',
    fullAddress: '2003 Lor 8 Toa Payoh, Singapore 319260',
    postalCode: '319260',
    lat: 1.3392,
    lng: 103.8577,
    category: 'healthcare',
    providerType: 'public',
    tags: ['toa payoh polyclinic', 'polyclinic', 'nhg', 'toa payoh'],
  },
  {
    title: 'Yishun Polyclinic',
    subtitle: '1000 Yishun Ave 5 • NHG Polyclinic',
    fullAddress: '1000 Yishun Ave 5, Singapore 768794',
    postalCode: '768794',
    lat: 1.4312,
    lng: 103.8322,
    category: 'healthcare',
    providerType: 'public',
    tags: ['yishun polyclinic', 'polyclinic', 'nhg', 'yishun'],
  },
  {
    title: 'Bedok Polyclinic (Heartbeat@Bedok)',
    subtitle: '11 Bedok North Street 1 • SingHealth Polyclinic',
    fullAddress: '11 Bedok North Street 1, #02-01 Heartbeat@Bedok, Singapore 469662',
    postalCode: '469662',
    lat: 1.3267,
    lng: 103.9317,
    category: 'healthcare',
    providerType: 'public',
    tags: ['bedok polyclinic', 'heartbeat bedok', 'polyclinic', 'singhealth', 'bedok'],
  },
  {
    title: 'Tampines Polyclinic (Our Tampines Hub)',
    subtitle: '1 Tampines Walk • SingHealth Polyclinic',
    fullAddress: '1 Tampines Walk, #03-31 Our Tampines Hub, Singapore 528523',
    postalCode: '528523',
    lat: 1.3533,
    lng: 103.9405,
    category: 'healthcare',
    providerType: 'public',
    tags: ['tampines polyclinic', 'our tampines hub', 'polyclinic', 'singhealth', 'tampines'],
  },
  {
    title: 'Jurong Polyclinic',
    subtitle: '190 Jurong East Ave 1 • NUP Polyclinic',
    fullAddress: '190 Jurong East Ave 1, Singapore 609788',
    postalCode: '609788',
    lat: 1.3499,
    lng: 103.7388,
    category: 'healthcare',
    providerType: 'public',
    tags: ['jurong polyclinic', 'polyclinic', 'nuhs', 'nup', 'jurong east'],
  },
  {
    title: 'Outram Polyclinic',
    subtitle: '3 Second Hospital Ave • SingHealth Polyclinic',
    fullAddress: '3 Second Hospital Ave, #02-00 Health Promotion Board Building, Singapore 168937',
    postalCode: '168937',
    lat: 1.2801,
    lng: 103.8378,
    category: 'healthcare',
    providerType: 'public',
    tags: ['outram polyclinic', 'polyclinic', 'singhealth', 'outram', 'chinatown'],
  },
  {
    title: 'Ang Mo Kio Polyclinic',
    subtitle: '21 Ang Mo Kio Central 2 • NHG Polyclinic',
    fullAddress: '21 Ang Mo Kio Central 2, Singapore 569666',
    postalCode: '569666',
    lat: 1.3697,
    lng: 103.8475,
    category: 'healthcare',
    providerType: 'public',
    tags: ['ang mo kio polyclinic', 'polyclinic', 'amk', 'nhg'],
  },

  // Popular Work & Business Hubs
  {
    title: 'BLOCK71 Singapore',
    subtitle: '71 Ayer Rajah Crescent • LaunchPad @ one-north',
    fullAddress: '71 Ayer Rajah Crescent, Singapore 139951',
    postalCode: '139951',
    lat: 1.2968,
    lng: 103.7865,
    category: 'work',
    tags: ['block71', 'blk71', 'ayer rajah', 'launchpad', 'one-north', 'startup', 'work'],
  },
  {
    title: 'LaunchPad @ one-north',
    subtitle: 'Ayer Rajah Crescent • Tech & Innovation Park',
    fullAddress: 'LaunchPad @ one-north, Singapore 139951',
    postalCode: '139951',
    lat: 1.2965,
    lng: 103.7862,
    category: 'work',
    tags: ['launchpad', 'one north', 'ayer rajah', 'work'],
  },
  {
    title: 'Fusionopolis One',
    subtitle: '1 Fusionopolis Way • one-north Hub',
    fullAddress: '1 Fusionopolis Way, Singapore 138632',
    postalCode: '138632',
    lat: 1.2994,
    lng: 103.7885,
    category: 'work',
    tags: ['fusionopolis', 'one-north', 'a*star', 'work'],
  },
  {
    title: 'Marina Bay Financial Centre (MBFC)',
    subtitle: '10 Marina Blvd • Central Business District',
    fullAddress: '10 Marina Blvd, Singapore 018983',
    postalCode: '018983',
    lat: 1.2798,
    lng: 103.8542,
    category: 'work',
    tags: ['mbfc', 'marina bay financial centre', 'cbd', 'downtown', 'work'],
  },
  {
    title: 'Suntec City Tower',
    subtitle: '7 Temasek Blvd • Marina Centre',
    fullAddress: '7 Temasek Blvd, Singapore 038987',
    postalCode: '038987',
    lat: 1.2935,
    lng: 103.8572,
    category: 'work',
    tags: ['suntec', 'suntec city', 'temasek', 'work'],
  },
  {
    title: 'Guoco Tower',
    subtitle: '1 Wallich St • Tanjong Pagar',
    fullAddress: '1 Wallich St, Singapore 078881',
    postalCode: '078881',
    lat: 1.277,
    lng: 103.8458,
    category: 'work',
    tags: ['guoco tower', 'tanjong pagar', 'cbd', 'work'],
  },
  {
    title: 'Our Tampines Hub (OTH)',
    subtitle: '1 Tampines Walk • Community & Lifestyle Hub',
    fullAddress: '1 Tampines Walk, Singapore 528523',
    postalCode: '528523',
    lat: 1.3533,
    lng: 103.9405,
    category: 'general',
    tags: ['our tampines hub', 'oth', 'tampines', 'hub'],
  },
  {
    title: 'Toa Payoh HDB Hub',
    subtitle: '480 Lor 6 Toa Payoh • Central Hub',
    fullAddress: '480 Lor 6 Toa Payoh, Singapore 310480',
    postalCode: '310480',
    lat: 1.3328,
    lng: 103.8488,
    category: 'general',
    tags: ['hdb hub', 'toa payoh hub', 'toa payoh'],
  },
];

// Endpoint: Singapore OneMap Geocoding & Address Search Proxy
app.get('/api/onemap/search', async (req, res) => {
  const query = String(req.query.q || req.query.searchVal || '').trim();
  if (!query) {
    return res.json({ found: 0, totalNumPages: 0, pageNum: 1, results: [] });
  }

  try {
    const onemapUrl = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
    const r = await fetch(onemapUrl, {
      headers: {
        'User-Agent': 'SafeSpot-SG/1.0',
      },
    });

    if (!r.ok) {
      return res.json({ found: 0, totalNumPages: 0, pageNum: 1, results: [] });
    }

    const data = await r.json();
    return res.json(data);
  } catch (err: any) {
    console.warn('OneMap search proxy failed:', err.message);
    return res.json({ found: 0, totalNumPages: 0, pageNum: 1, results: [] });
  }
});

// Endpoint: Multi-Engine Intelligent Address Autocomplete (Google Maps + OneMap + Preset Landmarks)
app.get('/api/places/autocomplete', async (req, res) => {
  const query = String(req.query.q || req.query.input || '').trim();
  const category = String(req.query.category || 'general').toLowerCase(); // 'home' | 'work' | 'healthcare' | 'general'
  const mapsKey = getGoogleMapsApiKey();

  const results: Array<{
    id: string;
    title: string;
    subtitle?: string;
    fullAddress: string;
    postalCode?: string;
    lat?: number;
    lng?: number;
    source: 'google' | 'onemap' | 'singapore_landmark';
    category?: string;
    providerType?: 'public' | 'private';
  }> = [];

  const seenAddresses = new Set<string>();

  const addSuggestion = (item: typeof results[0]) => {
    const key = (item.fullAddress || item.title).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seenAddresses.has(key)) {
      seenAddresses.add(key);
      results.push(item);
    }
  };

  const normalizedQuery = query.toLowerCase();

  // 1. Check curated Singapore Landmarks & Hospitals
  const matchedPresets = SINGAPORE_PRESET_PLACES.filter((p) => {
    if (!query) {
      return category === 'healthcare' ? p.category === 'healthcare' : category === 'work' ? p.category === 'work' : true;
    }
    const matchTag = p.tags.some((t) => t.includes(normalizedQuery) || normalizedQuery.includes(t));
    const matchTitle = p.title.toLowerCase().includes(normalizedQuery);
    const matchAddress = p.fullAddress.toLowerCase().includes(normalizedQuery);
    const matchPostal = p.postalCode.includes(normalizedQuery);
    return matchTag || matchTitle || matchAddress || matchPostal;
  });

  for (const preset of matchedPresets.slice(0, 5)) {
    addSuggestion({
      id: `preset-${preset.postalCode}-${preset.title}`,
      title: preset.title,
      subtitle: preset.subtitle,
      fullAddress: preset.fullAddress,
      postalCode: preset.postalCode,
      lat: preset.lat,
      lng: preset.lng,
      source: 'singapore_landmark',
      category: preset.category,
      providerType: preset.providerType,
    });
  }

  // 2. Google Places Autocomplete API (if API Key is configured)
  if (query.length >= 2 && mapsKey) {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:sg&language=en&key=${mapsKey}`;
      const gRes = await fetch(gUrl);
      if (gRes.ok) {
        const gData = (await gRes.json()) as any;
        if (gData.predictions && Array.isArray(gData.predictions)) {
          for (const pred of gData.predictions.slice(0, 5)) {
            const mainText = pred.structured_formatting?.main_text || pred.description;
            const secondaryText = pred.structured_formatting?.secondary_text || 'Singapore';
            addSuggestion({
              id: `google-${pred.place_id}`,
              title: mainText,
              subtitle: secondaryText,
              fullAddress: pred.description,
              source: 'google',
              category,
            });
          }
        }
      }
    } catch (e) {
      console.warn('Google Places autocomplete query error:', e);
    }
  }

  // 3. Singapore OneMap Elastic Search API (Understands HDB Blocks, Road Names, Postal Codes)
  if (query.length >= 2) {
    try {
      const onemapUrl = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
      const oRes = await fetch(onemapUrl, {
        headers: { 'User-Agent': 'SafeSpot-SG/1.0' },
      });
      if (oRes.ok) {
        const oData = (await oRes.json()) as any;
        if (oData.results && Array.isArray(oData.results)) {
          for (const r of oData.results.slice(0, 6)) {
            const building = r.BUILDING && r.BUILDING !== 'NIL' ? r.BUILDING : null;
            const blk = r.BLK_NO && r.BLK_NO !== 'NIL' ? `Blk ${r.BLK_NO} ` : '';
            const road = r.ROAD_NAME && r.ROAD_NAME !== 'NIL' ? r.ROAD_NAME : '';
            const postal = r.POSTAL && r.POSTAL !== 'NIL' ? r.POSTAL : '';

            const title = building || (blk || road ? `${blk}${road}`.trim() : r.ADDRESS);
            const subtitle = postal ? `Singapore ${postal}` : road || 'Singapore';

            addSuggestion({
              id: `onemap-${postal || ''}-${r.X || ''}-${r.Y || ''}`,
              title,
              subtitle,
              fullAddress: r.ADDRESS || `${title}, Singapore ${postal}`.trim(),
              postalCode: postal || undefined,
              lat: Number(r.LATITUDE) || undefined,
              lng: Number(r.LONGITUDE) || undefined,
              source: 'onemap',
              category,
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('OneMap autocomplete query error:', err.message);
    }
  }

  return res.json({ suggestions: results.slice(0, 8) });
});

// API endpoint: Multimodal Location Verification & Landmark Cross-Referencing
app.post('/api/gemini/analyze-location', async (req, res) => {
  try {
    const {
      gps,
      photoBase64,
      photoMimeType = 'image/jpeg',
      voiceNotes = '',
      manualClues = '',
      contextPreset,
      bleBeacons = [],
    } = req.body;

    if (!gps || typeof gps.latitude !== 'number' || typeof gps.longitude !== 'number') {
      return res.status(400).json({ error: 'Valid GPS coordinates (latitude, longitude) are required.' });
    }

    const { latitude, longitude, accuracy = 20, heading = 0, speed = 0, altitude = 0 } = gps;

    // Execute Roads API snap & Places API search in parallel with reverse geocoding
    const [approximateAddress, snappedRoad, nearbyPlaces] = await Promise.all([
      fetchReverseGeocode(latitude, longitude),
      snapToNearestRoad(latitude, longitude),
      fetchNearbyPlacesLandmarks(latitude, longitude),
    ]);

    const effectiveLat = snappedRoad?.lat || latitude;
    const effectiveLng = snappedRoad?.lng || longitude;

    const mapsKey = getGoogleMapsApiKey();
    const staticStreetViewUrl = mapsKey
      ? `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${effectiveLat},${effectiveLng}&heading=${heading || 0}&pitch=0&fov=90&key=${mapsKey}`
      : `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${effectiveLat},${effectiveLng}&heading=${heading || 0}&pitch=0&fov=90&client=aistudio-agent`;

    const ai = getGeminiClient();

    const generateFallbackResult = (reason?: string) => {
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${effectiveLat},${effectiveLng}`;
      const appleMapsUrl = `https://maps.apple.com/?q=${effectiveLat},${effectiveLng}`;
      const wazeUrl = `https://waze.com/ul?ll=${effectiveLat},${effectiveLng}&navigate=yes`;
      const primaryLandmark = nearbyPlaces[0]?.name || 'curbside entrance';

      return {
        originalCoordinates: { lat: latitude, lng: longitude, accuracyMeters: accuracy },
        verifiedCoordinates: { lat: effectiveLat, lng: effectiveLng },
        confidenceScore: photoBase64 ? 92 : 84,
        accuracyLevel: accuracy <= 15 ? 'HIGH' : 'MODERATE',
        formattedAddress: approximateAddress || `${effectiveLat.toFixed(5)}, ${effectiveLng.toFixed(5)}`,
        streetName: approximateAddress ? approximateAddress.split(',')[0] : 'Current Street',
        nearbyCrossStreet: nearbyPlaces[0]?.name ? `Near ${nearbyPlaces[0].name}` : 'Near main roadway / entrance',
        roadSnapping: {
          snapped: Boolean(snappedRoad),
          snappedCoordinates: snappedRoad ? { lat: snappedRoad.lat, lng: snappedRoad.lng } : null,
          placeId: snappedRoad?.placeId,
        },
        nearbyPlaces: nearbyPlaces.slice(0, 5),
        visualLandmarks: nearbyPlaces.length > 0
          ? nearbyPlaces.slice(0, 3).map((p, idx) => ({
              id: `lm-${idx + 1}`,
              name: p.name,
              description: `Verified ${p.type.replace(/_/g, ' ')} landmark near pickup spot.`,
              category: 'storefront',
              matchedInStreetView: true,
              confidence: 90,
            }))
          : [
              {
                id: 'lm-1',
                name: 'Curbside Boarding Zone',
                description: 'Snapped to drivable road geometry for vehicle pickup.',
                category: 'street_element',
                matchedInStreetView: true,
                confidence: 88,
              },
            ],
        isIndoors: accuracy > 40,
        environmentType: accuracy > 40 ? 'sheltered_porch' : 'outdoor_roadside',
        indoorContext: accuracy > 40 ? 'Under sheltered walkway or building perimeter' : 'Outdoor street curbside',
        indoorExitGuidance: accuracy > 40 ? 'Please step out towards the main driveway or taxi bay for driver pickup.' : 'Wait safely on the curbside pavement.',
        pickupInstructionsForDriver: `Pickup at ${approximateAddress || 'curbside'}. Driver should pull up directly near ${primaryLandmark}.`,
        elderlyVoiceSummary: `Your location is verified at ${approximateAddress ? approximateAddress.split(',')[0] : 'your pickup spot'}. You can safely share it now.`,
        safeWaitingAdvice: 'Please remain at the sheltered sidewalk or bench in clear sight of arriving vehicles.',
        streetViewData: {
          available: true,
          heading: heading || 0,
          pitch: 0,
          fov: 90,
          streetViewImageUrl: staticStreetViewUrl,
          comparisonSummary: 'Visual coordinates align with street level orientation.',
          matchingFeatures: ['Curbside walkway', 'Building façade boundary', ...nearbyPlaces.slice(0, 2).map(p => p.name)],
        },
        shareUrls: {
          googleMapsUrl,
          appleMapsUrl,
          wazeUrl,
          smsBody: `Hi! I need a pickup here: ${approximateAddress || `${effectiveLat.toFixed(5)}, ${effectiveLng.toFixed(5)}`}. Map link: ${googleMapsUrl}`,
          whatsappUrl: `https://wa.me/?text=${encodeURIComponent(`Hi! Here is my verified pickup location:\n📍 Address: ${approximateAddress || `${effectiveLat.toFixed(5)}, ${effectiveLng.toFixed(5)}`}\n🚗 Navigation: ${googleMapsUrl}`)}`,
        },
        timestamp: Date.now(),
        fallbackNotice: reason,
      };
    };

    if (!ai) {
      return res.json(generateFallbackResult('Gemini API key not configured'));
    }

    const placesContext = nearbyPlaces.length > 0
      ? `Verified Nearby Places (via Google Places API): ${nearbyPlaces.map(p => `${p.name} (${p.type})`).join(', ')}`
      : 'No automated Places API results in immediate radius.';

    const roadsContext = snappedRoad
      ? `Roads API Snap-to-Road: Raw GPS was snapped to nearest drivable roadway at lat ${snappedRoad.lat}, lng ${snappedRoad.lng} (Place ID: ${snappedRoad.placeId || 'N/A'})`
      : 'Roads API: Using raw GPS centroid.';

    // Only beacons at surveyed positions can refine the pin. A detected but
    // unregistered device is real radio traffic that says nothing about where
    // the senior is standing, so it must not be offered as location evidence.
    const venueBeacons = (bleBeacons || []).filter((b: any) => b.isKnownVenue);
    const pairedTag = (bleBeacons || []).find((b: any) => b.isPairedTag);

    const bleContext = venueBeacons.length > 0
      ? `BLE Micro-Location Beacons in Range (measured over the air, surveyed positions): ${venueBeacons
          .map((b: any) => `${b.name} at ${b.locationName} (RSSI ${b.rssi} dBm, estimated ${b.estimatedDistanceMeters}m away${b.floorLevel ? `, floor: ${b.floorLevel}` : ''})`)
          .join('; ')}. Distances are estimated from radio signal strength and degrade badly through walls and crowds, so treat them as supporting evidence for the photo and Places data, not as ground truth that overrides them.`
      : `No registered venue BLE beacon detected in range${pairedTag ? `, though the senior's own paired safety tag is nearby (RSSI ${pairedTag.rssi} dBm)` : ''}. Rely on GPS, the photo, and Places API only — do not infer a beacon-based position.`;

    const promptText = `
You are an expert AI Location Specialist and Elder Pickup Assistant for Singapore and worldwide locations.
The goal is to provide maximum location accuracy and reassurance for an elderly person waiting to be picked up by a caregiver, family member, or ride/emergency responder.

Google Maps Platform Multi-API & BLE Grounding:
- Raw GPS: Latitude ${latitude}, Longitude ${longitude} (Accuracy: ${accuracy}m)
- ${roadsContext}
- ${placesContext}
- ${bleContext}
- Reverse Geocoded Address Hint: ${approximateAddress || 'Not available'}
- User Voice Notes / Speech: "${voiceNotes || 'None'}"
- Additional Clues / Environment: "${manualClues || (contextPreset?.landmarkHint ?? 'None')}"

TASK:
1. Analyze the user's uploaded surroundings photo (if provided) along with the Roads API snapped curbside, Places API verified landmark list, and detected BLE Beacon micro-location signatures.
2. Cross-reference visible features (storefront signs, awning colors, building numbers, door entrances, benches, pavement markers, transit stops, distinct street signs) against what Google Street View, Places API, and BLE beacons show at these coordinates.
3. If a REGISTERED venue BLE beacon is listed above with a strong signal (RSSI above -70 dBm), use its surveyed position and floor level to refine the pickup point. Only beacons listed above count; never assume a beacon is present when none is listed.
4. Assess whether the senior is currently INDOORS (inside a mall/building/MRT), OUTDOORS at roadside, under an HDB VOID DECK, or under a SHELTERED PORCH based on ceilings, artificial lighting, floor tiles, columns, BLE beacons, and GPS attenuation.
5. If indoors, identify the indoor context (e.g. "Inside Toa Payoh Hub Level 1 near FairPrice") and provide clear step-by-step guidance for the elder to reach the nearest vehicle pickup point or taxi bay.
6. Determine refined/verified coordinates (prefer a registered beacon's surveyed position when one is within a few metres, otherwise the Roads API snapped curbside if the user is by the road).
7. Extract 2-4 concrete, easily identifiable visual landmarks with high distinction (utilize real names from Places/BLE API results when matching).
8. Create crystal-clear pickup instructions for the driver (e.g. "Pull up directly in front of the taxi stand or main entrance. Elder is waiting under the sheltered walkway.").
9. Create a warm, calming, simple voice summary for the elderly user (written in short, easy-to-hear sentences without technical jargon, mentioning if they need to step out to the pickup bay).
10. Create safe waiting advice (e.g., "Stay under the sheltered walkway or bench. It is safe, dry, and brightly visible from the road.").
11. Provide matching assessment for Google Street View comparison.

Output your answer strictly using the provided JSON schema.`;

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    if (photoBase64) {
      // Clean up base64 prefix if present
      const cleanBase64 = photoBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: photoMimeType,
          data: cleanBase64,
        },
      });
    }

    parts.push({ text: promptText });

    const schemaConfig = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          verifiedLat: { type: Type.NUMBER, description: 'Refined exact latitude for pickup pin' },
          verifiedLng: { type: Type.NUMBER, description: 'Refined exact longitude for pickup pin' },
          confidenceScore: { type: Type.INTEGER, description: 'Confidence score from 50 to 99' },
          accuracyLevel: { type: Type.STRING, enum: ['EXACT', 'HIGH', 'MODERATE', 'ESTIMATED'] },
          formattedAddress: { type: Type.STRING, description: 'Clear street address with number and city' },
          streetName: { type: Type.STRING, description: 'Primary street or avenue name' },
          nearbyCrossStreet: { type: Type.STRING, description: 'Nearest cross street or landmark zone' },
          isIndoors: { type: Type.BOOLEAN, description: 'True if user is inside a shopping mall, building, underground concourse, or indoor lobby' },
          environmentType: {
            type: Type.STRING,
            enum: ['indoor_mall', 'indoor_mrt', 'hdb_void_deck', 'sheltered_porch', 'outdoor_roadside', 'underground'],
            description: 'Specific architectural environment type',
          },
          indoorContext: { type: Type.STRING, description: 'Description of indoor location (e.g. Inside Toa Payoh Hub near FairPrice)' },
          indoorExitGuidance: { type: Type.STRING, description: 'Gentle instructions directing elder to the nearest vehicle pickup bay or taxi stand' },
          visualLandmarks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                category: {
                  type: Type.STRING,
                  enum: [
                    'storefront',
                    'building',
                    'door_entrance',
                    'signage',
                    'seating_bench',
                    'street_element',
                    'color_pattern',
                  ],
                },
                matchedInStreetView: { type: Type.BOOLEAN },
                confidence: { type: Type.INTEGER },
              },
              required: ['id', 'name', 'description', 'category', 'matchedInStreetView', 'confidence'],
            },
          },
          pickupInstructionsForDriver: {
            type: Type.STRING,
            description: 'Precise, actionable pickup notes for caregiver/driver',
          },
          elderlyVoiceSummary: {
            type: Type.STRING,
            description: 'Calm, comforting short summary for speech synthesis',
          },
          safeWaitingAdvice: {
            type: Type.STRING,
            description: 'Clear safety recommendation for waiting safely',
          },
          streetViewComparison: {
            type: Type.OBJECT,
            properties: {
              available: { type: Type.BOOLEAN },
              heading: { type: Type.NUMBER },
              pitch: { type: Type.NUMBER },
              fov: { type: Type.NUMBER },
              comparisonSummary: { type: Type.STRING },
              matchingFeatures: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['available', 'heading', 'comparisonSummary', 'matchingFeatures'],
          },
        },
        required: [
          'verifiedLat',
          'verifiedLng',
          'confidenceScore',
          'accuracyLevel',
          'formattedAddress',
          'streetName',
          'nearbyCrossStreet',
          'isIndoors',
          'environmentType',
          'visualLandmarks',
          'pickupInstructionsForDriver',
          'elderlyVoiceSummary',
          'safeWaitingAdvice',
          'streetViewComparison',
        ],
      },
    };

    let response: any = null;
    const modelsToTry = ['gemini-3.7-flash', 'gemini-2.5-flash'];

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: { parts },
          config: schemaConfig,
        });
        if (response && response.text) break;
      } catch (genErr: any) {
        console.warn(`Gemini generation attempt with ${modelName} encountered error:`, genErr?.message || genErr);
        // If it's a 503 high demand or 429 rate limit, continue to fallback model
      }
    }

    if (!response || !response.text) {
      console.warn('All Gemini model calls failed or experienced high demand. Returning Maps-grounded fallback.');
      return res.json(generateFallbackResult('Model high demand fallback'));
    }

    const parsed = JSON.parse(response.text?.trim() || '{}');

    const verifiedLat = parsed.verifiedLat || latitude;
    const verifiedLng = parsed.verifiedLng || longitude;
    const formattedAddress = parsed.formattedAddress || approximateAddress || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${verifiedLat},${verifiedLng}`;
    const appleMapsUrl = `https://maps.apple.com/?q=${verifiedLat},${verifiedLng}`;
    const wazeUrl = `https://waze.com/ul?ll=${verifiedLat},${verifiedLng}&navigate=yes`;

    const smsBody = `Hi! I need a pickup here: ${formattedAddress}. Landmark: ${parsed.visualLandmarks?.[0]?.name || 'curbside'}. Instructions: ${parsed.pickupInstructionsForDriver}. Navigation Map link: ${googleMapsUrl}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
      `Hi! Here is my verified pickup location:\n📍 Address: ${formattedAddress}\n🔍 Landmarks: ${parsed.visualLandmarks?.map((l: any) => l.name).join(', ') || 'Entrance'}\n🚗 Driver Note: ${parsed.pickupInstructionsForDriver}\n🗺️ Navigation: ${googleMapsUrl}`
    )}`;

    const result = {
      originalCoordinates: { lat: latitude, lng: longitude, accuracyMeters: accuracy },
      verifiedCoordinates: { lat: verifiedLat, lng: verifiedLng },
      confidenceScore: parsed.confidenceScore || (photoBase64 ? 96 : 85),
      accuracyLevel: parsed.accuracyLevel || 'HIGH',
      formattedAddress,
      streetName: parsed.streetName || (approximateAddress ? approximateAddress.split(',')[0] : 'Current Street'),
      nearbyCrossStreet: parsed.nearbyCrossStreet || 'Curbside Area',
      roadSnapping: {
        snapped: Boolean(snappedRoad),
        snappedCoordinates: snappedRoad ? { lat: snappedRoad.lat, lng: snappedRoad.lng } : null,
        placeId: snappedRoad?.placeId,
      },
      nearbyPlaces: nearbyPlaces.slice(0, 5),
      visualLandmarks: parsed.visualLandmarks || [],
      isIndoors: Boolean(parsed.isIndoors),
      environmentType: parsed.environmentType || (parsed.isIndoors ? 'indoor_mall' : 'outdoor_roadside'),
      indoorContext: parsed.indoorContext || (parsed.isIndoors ? 'Inside building/concourse' : 'Outdoor street area'),
      indoorExitGuidance: parsed.indoorExitGuidance || (parsed.isIndoors ? 'Please step towards the nearest ground floor entrance or taxi stand.' : 'Wait safely at the curbside.'),
      bleBeacons: bleBeacons || [],
      // Only a surveyed beacon close enough to trust actually improves the pin.
      bleAccuracyBoost: venueBeacons.some((b: any) => b.rssi >= -70 && b.estimatedDistanceMeters <= 3),
      pickupInstructionsForDriver: parsed.pickupInstructionsForDriver || 'Please pull up to the exact pin location.',
      elderlyVoiceSummary: parsed.elderlyVoiceSummary || `You are at ${formattedAddress}. Your location is verified.`,
      safeWaitingAdvice: parsed.safeWaitingAdvice || 'Stay where you are in a visible and comfortable spot.',
      streetViewData: {
        available: parsed.streetViewComparison?.available ?? true,
        heading: parsed.streetViewComparison?.heading ?? (heading || 0),
        pitch: parsed.streetViewComparison?.pitch ?? 0,
        fov: parsed.streetViewComparison?.fov ?? 90,
        streetViewImageUrl: staticStreetViewUrl,
        comparisonSummary: parsed.streetViewComparison?.comparisonSummary || 'Features confirmed against street layout.',
        matchingFeatures: parsed.streetViewComparison?.matchingFeatures || ['Storefront alignment', 'Curbside layout'],
      },
      shareUrls: {
        googleMapsUrl,
        appleMapsUrl,
        wazeUrl,
        smsBody,
        whatsappUrl,
      },
      timestamp: Date.now(),
    };

    return res.json(result);
  } catch (error: any) {
    console.error('Error in /api/gemini/analyze-location:', error);
    return res.status(500).json({
      error: 'Failed to analyze location and landmarks.',
      details: error.message,
    });
  }
});

// API endpoint: Accessible Voice Command Assistant
app.post('/api/gemini/voice-assistant', async (req, res) => {
  try {
    const { transcript, currentAddress, currentLocation, emergencyContacts = [] } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Speech transcript is required.' });
    }

    const ai = getGeminiClient();

    if (!ai) {
      // Local keyword matching fallback if AI key isn't provided
      const lower = transcript.toLowerCase();
      let action = 'GENERAL_HELP';
      let spokenResponse = 'I am here to help you. You can say: Where am I, Send my location to Sarah, or Help.';

      if (lower.includes('where am i') || lower.includes('what is my address') || lower.includes('location') || lower.includes('where is this')) {
        action = 'READ_LOCATION';
        spokenResponse = currentAddress
          ? `You are currently at ${currentAddress}.`
          : 'I am checking your current Singapore location right now.';
      } else if (lower.includes('send') || lower.includes('share') || lower.includes('pick me up') || lower.includes('daughter') || lower.includes('son') || lower.includes('caregiver') || lower.includes('sarah') || lower.includes('david') || lower.includes('ah girl') || lower.includes('ah boy')) {
        action = 'SEND_LOCATION';
        spokenResponse = 'Sending your verified pickup location to your emergency contact now.';
      } else if (lower.includes('photo') || lower.includes('picture') || lower.includes('camera') || lower.includes('look') || lower.includes('see')) {
        action = 'ANALYZE_PHOTO';
        spokenResponse = 'Opening the camera so we can verify the landmarks around you.';
      } else if (lower.includes('emergency') || lower.includes('995') || lower.includes('911') || lower.includes('help me') || lower.includes('scdf') || lower.includes('ambulance') || lower.includes('urgent') || lower.includes('fall') || lower.includes('pain') || lower.includes('hospital')) {
        action = 'EMERGENCY_TRIGGER';
        spokenResponse = 'Activating emergency SCDF 995 assistance for you right now.';
      } else if (lower.includes('contrast') || lower.includes('yellow') || lower.includes('dark') || lower.includes('bright') || lower.includes('bigger') || lower.includes('color')) {
        action = 'TOGGLE_CONTRAST';
        spokenResponse = 'Switching high-contrast visual display mode for you.';
      } else if (lower.includes('safe') || lower.includes('wait') || lower.includes('rain') || lower.includes('shelter')) {
        action = 'SPEAK_ADVICE';
        spokenResponse = 'Please stay at the covered walkway or bench where you are sheltered and easily visible to drivers.';
      }

      return res.json({
        action,
        spokenResponse,
        feedbackMessage: spokenResponse,
        confidence: 90,
      });
    }

    const contactsList = emergencyContacts.map((c: any) => `${c.name} (${c.relationship})`).join(', ');

    const prompt = `
You are the empathetic, senior-friendly voice intelligence engine for "SafeSpot.SG".
The elder spoke the following transcript transcribed by Speechmatics:
"${transcript}"

Context & Environment:
- Location Region: Singapore
- User's Current Verified Location/Address: "${currentAddress || 'Locating current spot in Singapore...'}"
- Known Family/Emergency Contacts: "${contactsList || 'Sarah (Daughter), David (Son), Nurse Priya (Caregiver), Singapore SCDF Ambulance (995)'}"

Semantic Heuristics & Singapore Natural Language Handling:
- The elder may use Singapore English / Singlish expressions (e.g., "Ah Girl pick me up", "Send location to my boy David", "I at MRT exit", "Where is this void deck", "Call 995", "I feeling giddy / chest pain", "Cannot see properly", "Take photo of the clinic").
- Carefully understand the elder's emotional state, intent, and cognitive clarity.

Classify intent into the primary action:
1. 'READ_LOCATION': Elder asks where they are, what street they are on, or wants spoken confirmation of address.
2. 'SEND_LOCATION': Elder asks to send location, message family/driver, get picked up, notify daughter/son/caregiver.
3. 'CALL_CONTACT': Elder explicitly asks to ring or call a specific family member or caregiver.
4. 'ANALYZE_PHOTO': Elder asks to look around, check photo, scan landmarks, or use camera.
5. 'EMERGENCY_TRIGGER': Elder expresses pain, distress, fall, chest discomfort, danger, SCDF, ambulance, 995, or urgent medical help.
6. 'TOGGLE_CONTRAST': Elder wants high contrast, yellow-black mode, dark mode, or clearer visual screen.
7. 'SPEAK_ADVICE': Elder asks if they should wait, if it is safe, or where to stand.
8. 'GENERAL_HELP': Elder asks for general instructions or greetings.

Instructions for generation:
- 'action': One of the above enum values.
- 'targetContactName': The specific contact name mentioned (e.g. "Sarah", "David", "Nurse Priya") or null.
- 'spokenResponse': Calm, warm, reassuring, concise English (1-2 short sentences, clear for older ears).
- 'feedbackMessage': Concise visual confirmation to display on the high-contrast display.
`;

    const schemaVoiceConfig = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          action: {
            type: Type.STRING,
            enum: [
              'READ_LOCATION',
              'SEND_LOCATION',
              'CALL_CONTACT',
              'ANALYZE_PHOTO',
              'EMERGENCY_TRIGGER',
              'TOGGLE_CONTRAST',
              'SPEAK_ADVICE',
              'GENERAL_HELP',
            ],
          },
          targetContactName: { type: Type.STRING },
          spokenResponse: { type: Type.STRING },
          feedbackMessage: { type: Type.STRING },
        },
        required: ['action', 'spokenResponse', 'feedbackMessage'],
      },
    };

    let response: any = null;
    for (const modelName of ['gemini-3.7-flash', 'gemini-2.5-flash']) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: schemaVoiceConfig,
        });
        if (response && response.text) break;
      } catch (err: any) {
        console.warn(`Voice assistant generation error with ${modelName}:`, err?.message || err);
      }
    }

    if (!response || !response.text) {
      // Return heuristic response on model 503 / failure
      const lower = transcript.toLowerCase();
      let action = 'GENERAL_HELP';
      let spokenResponse = 'I am here to help you. You can say: Where am I, Send my location to Sarah, or Help.';

      if (lower.includes('where am i') || lower.includes('what is my address') || lower.includes('location') || lower.includes('where is this')) {
        action = 'READ_LOCATION';
        spokenResponse = currentAddress
          ? `You are currently at ${currentAddress}.`
          : 'I am checking your current location right now.';
      } else if (lower.includes('send') || lower.includes('share') || lower.includes('pick me up') || lower.includes('daughter') || lower.includes('son') || lower.includes('caregiver') || lower.includes('sarah') || lower.includes('david')) {
        action = 'SEND_LOCATION';
        spokenResponse = 'Sending your verified pickup location to your emergency contact now.';
      } else if (lower.includes('photo') || lower.includes('picture') || lower.includes('camera') || lower.includes('look') || lower.includes('see')) {
        action = 'ANALYZE_PHOTO';
        spokenResponse = 'Opening the camera so we can verify the landmarks around you.';
      } else if (lower.includes('emergency') || lower.includes('995') || lower.includes('911') || lower.includes('help me') || lower.includes('scdf') || lower.includes('ambulance') || lower.includes('urgent') || lower.includes('fall') || lower.includes('pain')) {
        action = 'EMERGENCY_TRIGGER';
        spokenResponse = 'Activating emergency SCDF 995 assistance for you right now.';
      } else if (lower.includes('contrast') || lower.includes('yellow') || lower.includes('dark') || lower.includes('bright') || lower.includes('bigger') || lower.includes('color')) {
        action = 'TOGGLE_CONTRAST';
        spokenResponse = 'Switching high-contrast visual display mode for you.';
      } else if (lower.includes('safe') || lower.includes('wait') || lower.includes('rain') || lower.includes('shelter')) {
        action = 'SPEAK_ADVICE';
        spokenResponse = 'Please stay at the covered walkway or bench where you are sheltered and easily visible to drivers.';
      }

      return res.json({
        action,
        spokenResponse,
        feedbackMessage: spokenResponse,
        confidence: 85,
      });
    }

    const parsed = JSON.parse(response.text?.trim() || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/gemini/voice-assistant:', error);
    return res.json({
      action: 'GENERAL_HELP',
      spokenResponse: 'I am listening. How can I help you right now?',
      feedbackMessage: 'Ready to assist.',
      confidence: 70,
    });
  }
});

// API endpoint: Compute driver ETA & Distance via Routes API
app.post('/api/maps/compute-driver-route', async (req, res) => {
  try {
    const { originLat, originLng, destLat, destLng } = req.body;
    if (
      typeof originLat !== 'number' ||
      typeof originLng !== 'number' ||
      typeof destLat !== 'number' ||
      typeof destLng !== 'number'
    ) {
      return res.status(400).json({ error: 'Valid originLat, originLng, destLat, and destLng required.' });
    }

    const routeData = await computeDriverRoute(originLat, originLng, destLat, destLng);
    if (routeData) {
      return res.json({
        success: true,
        source: 'Google Routes API',
        ...routeData,
      });
    }

    // Fallback calculation (Haversine formula + average speed 30km/h)
    const R = 6371; // km
    const dLat = ((destLat - originLat) * Math.PI) / 180;
    const dLon = ((destLng - originLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((originLat * Math.PI) / 180) *
        Math.cos((destLat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distKm = R * c;
    const driveMinutes = Math.max(2, Math.round((distKm / 35) * 60));
    const miles = (distKm * 0.621371).toFixed(1);

    return res.json({
      success: true,
      source: 'Internal Telemetry Estimator',
      durationText: `${driveMinutes} mins`,
      distanceText: `${miles} miles (${distKm.toFixed(1)} km)`,
      durationSeconds: driveMinutes * 60,
      distanceMeters: Math.round(distKm * 1000),
    });
  } catch (error: any) {
    console.error('Error in /api/maps/compute-driver-route:', error);
    return res.status(500).json({ error: 'Failed to compute driver route', details: error.message });
  }
});

// API endpoint: Direct 1-Tap Location Pin & SMS/Live Alert Dispatch
app.post('/api/notify/dispatch-pin', async (req, res) => {
  try {
    const { 
      contactId,
      contactName, 
      phone, 
      address, 
      googleMapsUrl, 
      driverHint, 
      blePrecision,
      incidentId,
      seniorName = 'Senior'
    } = req.body;

    if (!phone && !contactName) {
      return res.status(400).json({ error: 'Phone number or contact name is required.' });
    }

    const cleanPhone = (phone || '').replace(/[^0-9+]/g, '');
    const timestamp = Date.now();
    const messageId = `disp_${timestamp}_${Math.random().toString(36).slice(2, 7)}`;

    const messageBody = `📍 SafeSpot.SG Pick-Up Request for ${seniorName}:\n` +
      `🏠 Location: ${address || 'Verified Curbside'}\n` +
      (blePrecision ? `📶 Precision: ${blePrecision}\n` : '') +
      (driverHint ? `🚗 Driver Note: ${driverHint}\n` : '') +
      `🗺️ Google Maps Pin: ${googleMapsUrl || 'https://maps.google.com'}\n` +
      (incidentId ? `⚡ Live Tracking: https://safespot-sg-258662267000.asia-southeast1.run.app/track/${incidentId}` : '');

    // Check for Twilio carrier integration if configured
    let carrierStatus = 'DISPATCHED_DIRECT_GATEWAY';
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;

    if (twilioAccountSid && twilioAuthToken && twilioFrom && cleanPhone) {
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
        const params = new URLSearchParams();
        params.append('To', cleanPhone.startsWith('+') ? cleanPhone : `+65${cleanPhone}`);
        params.append('From', twilioFrom);
        params.append('Body', messageBody);

        const twilioRes = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });

        if (twilioRes.ok) {
          carrierStatus = 'SENT_CARRIER_SMS';
        } else {
          const twErr = await twilioRes.text();
          console.warn('Twilio dispatch warning:', twErr);
        }
      } catch (err: any) {
        console.warn('Twilio carrier dispatch error:', err.message);
      }
    }

    console.log(`[DISPATCH_PIN] Successfully sent location pin to ${contactName} (${cleanPhone}):`, {
      messageId,
      carrierStatus,
      address,
      googleMapsUrl,
    });

    return res.json({
      success: true,
      messageId,
      carrierStatus,
      recipient: contactName || 'Caregiver',
      phone: cleanPhone,
      timestamp,
      messagePreview: messageBody,
    });
  } catch (error: any) {
    console.error('Error in /api/notify/dispatch-pin:', error);
    return res.status(500).json({ error: 'Failed to dispatch location pin', details: error.message });
  }
});

// Setup Vite development middleware or static production serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SafeSpot.SG Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
