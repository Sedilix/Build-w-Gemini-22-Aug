/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy: number; // in meters
  heading: number | null;
  speed: number | null;
  altitude: number | null;
  timestamp: number;
}

export interface LandmarkFeature {
  id: string;
  name: string;
  description: string;
  category: 'storefront' | 'building' | 'door_entrance' | 'signage' | 'seating_bench' | 'street_element' | 'color_pattern';
  matchedInStreetView: boolean;
  confidence: number; // 0 to 100
}

export interface StreetViewComparisonData {
  available: boolean;
  heading: number;
  pitch: number;
  fov: number;
  streetViewImageUrl?: string;
  comparisonSummary: string;
  matchingFeatures: string[];
}

export interface LocationVerificationResult {
  originalCoordinates: {
    lat: number;
    lng: number;
    accuracyMeters: number;
  };
  verifiedCoordinates: {
    lat: number;
    lng: number;
  };
  confidenceScore: number; // 0 - 100
  accuracyLevel: 'EXACT' | 'HIGH' | 'MODERATE' | 'ESTIMATED';
  formattedAddress: string;
  streetName: string;
  nearbyCrossStreet: string;
  roadSnapping?: {
    snapped: boolean;
    snappedCoordinates?: { lat: number; lng: number } | null;
    placeId?: string;
  };
  nearbyPlaces?: Array<{
    name: string;
    type: string;
    address?: string;
  }>;
  visualLandmarks: LandmarkFeature[];
  isIndoors?: boolean;
  environmentType?: 'indoor_mall' | 'indoor_mrt' | 'hdb_void_deck' | 'sheltered_porch' | 'outdoor_roadside' | 'underground';
  indoorContext?: string;
  indoorExitGuidance?: string;
  bleBeacons?: BLEBeaconScan[];
  bleAccuracyBoost?: boolean; // True if BLE micro-location refined accuracy to < 3m
  pickupInstructionsForDriver: string;
  elderlyVoiceSummary: string;
  safeWaitingAdvice: string;
  streetViewData: StreetViewComparisonData;
  shareUrls: {
    googleMapsUrl: string;
    appleMapsUrl: string;
    wazeUrl: string;
    smsBody: string;
    whatsappUrl: string;
  };
  timestamp: number;
  photoUrl?: string;
}

export interface BLEBeaconScan {
  id: string;
  name: string;
  uuid?: string;
  major?: number;
  minor?: number;
  rssi: number; // dBm e.g. -62 dBm
  proximity: 'immediate' | 'near' | 'far' | 'unknown'; // <1m, 1-3m, >3m
  estimatedDistanceMeters: number;
  locationName: string; // e.g. "Toa Payoh Hub Taxi Stand 1 - Beacon #04"
  floorLevel?: string; // e.g. "Level 1" or "Basement 1 Concourse"
  zoneType: 'transit_hub' | 'hospital' | 'hdb_estate' | 'shopping_mall' | 'caregiver_tag';
  lat?: number;
  lng?: number;
  batteryPercent?: number;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  emoji: string;
  bgColor: string;
  isPrimary: boolean;
  notes?: string;
  /** System contacts (e.g. 995 SCDF) are hard-coded and cannot be removed */
  locked?: boolean;
}

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'Unknown';

export interface UserProfile {
  uid: string;
  actualName: string;
  dob: string; // e.g. YYYY-MM-DD or DD/MM/YYYY
  bloodType: BloodType;
  address: string; // Home address e.g. "Blk 123 Toa Payoh Lorong 1 #08-456, Singapore 310123"
  selfiePhotoUrl?: string; // Selfie photo base64 / URL
  emergencyContacts: EmergencyContact[];
  phone?: string;
  email?: string;
  authProvider: 'google' | 'phone' | 'anonymous';
  medicalNotes?: string; // Optional allergies or medical conditions (e.g., "Diabetic, Pacemaker")
  createdAt: number;
  updatedAt: number;
}

export type HighContrastTheme = 'normal' | 'yellow-black' | 'black-white' | 'warm-soft';

export type FontSizeLevel = 'standard' | 'large' | 'extra-large';

// Singapore's 4 official languages for elder-friendly localization
export type Language = 'en' | 'zh' | 'ms' | 'ta';

export interface BatteryStatus {
  level: number | null; // 0-100, null if unsupported
  charging: boolean | null;
  supported: boolean;
}

export interface SpeechmaticsVoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male' | 'neutral';
  accent: string;
  flag: string;
  tone: string;
  description: string;
  sampleText: string;
  isRecommended?: boolean;
}

// NOTE: Matches the 4 voices currently supported by Speechmatics TTS preview.
// See https://docs.speechmatics.com/text-to-speech/quickstart#voices
export const SPEECHMATICS_VOICE_OPTIONS: SpeechmaticsVoiceOption[] = [
  {
    id: 'sarah',
    name: 'Sarah',
    gender: 'female',
    accent: 'British (UK)',
    flag: '🇬🇧',
    tone: 'Crisp & Professional',
    description: 'Clear, reassuring, and professional female voice. Highly recommended for elderly users and emergency assistance.',
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

export interface AccessibilitySettings {
  contrastTheme: HighContrastTheme;
  fontSize: FontSizeLevel;
  spokenGuidance: boolean;
  simplifiedMode: boolean;
  haptics: boolean;
  alwaysShowStreetView: boolean;
  speechmaticsVoice: string; // 'sarah' | 'megan' | 'theo' | 'jack'
  speechmaticsRate?: number; // 0.85 (elder-friendly) to 1.0
  language: Language; // UI + voice readout language (default 'en')
  fallDetection?: boolean; // Passive accelerometer fall monitoring
}

export interface LocationPreset {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  lat: number;
  lng: number;
  accuracy: number;
  sampleImageUrl: string;
  landmarkHint: string;
}

/**
 * Live incident document stored at Firestore `Incidents/{incidentId}`.
 * Created when the elder alerts family, so caregivers can open
 * `/track/:incidentId` and follow the senior's live GPS without an app.
 */
export interface Incident {
  incidentId: string;
  elderUid: string | null;
  elderName: string;
  elderSelfieUrl?: string;
  bloodType?: string;
  medicalNotes?: string;
  currentGps: {
    lat: number;
    lng: number;
    accuracy: number;
    timestamp: number;
  } | null;
  batteryLevel: number | null; // 0-100, null if unsupported
  isCharging: boolean | null;
  nearestLandmarks: string[];
  formattedAddress?: string;
  status: 'active' | 'resolved';
  createdAt: number;
  updatedAt: number;
}
