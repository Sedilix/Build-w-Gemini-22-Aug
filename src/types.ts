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

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  emoji: string;
  bgColor: string;
  isPrimary: boolean;
  notes?: string;
}

export type HighContrastTheme = 'normal' | 'yellow-black' | 'black-white' | 'warm-soft';

export type FontSizeLevel = 'standard' | 'large' | 'extra-large';

export interface SpeechmaticsVoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male';
  accent: string;
  flag: string;
  tone: string;
  description: string;
  sampleText: string;
  isRecommended?: boolean;
}

export const SPEECHMATICS_VOICE_OPTIONS: SpeechmaticsVoiceOption[] = [
  {
    id: 'sarah',
    name: 'Sarah',
    gender: 'female',
    accent: 'British (UK)',
    flag: '🇬🇧',
    tone: 'Friendly & Warm',
    description: 'Empathetic, clear, and reassuring tone. Highly recommended for elderly users and emergency assistance.',
    sampleText: 'Hello! I am Sarah. You are safe. I will help you verify your location and notify your family.',
    isRecommended: true,
  },
  {
    id: 'jack',
    name: 'Jack',
    gender: 'male',
    accent: 'American (US)',
    flag: '🇺🇸',
    tone: 'Deep & Clear',
    description: 'Support specialist voice with steady, authoritative, and articulate pacing.',
    sampleText: 'Hello, this is Jack. I have verified your GPS coordinates and pickup point on the map.',
  },
  {
    id: 'megan',
    name: 'Megan',
    gender: 'female',
    accent: 'American (US)',
    flag: '🇺🇸',
    tone: 'Gentle & Natural',
    description: 'Clear companion voice with gentle inflection and smooth conversational cadence.',
    sampleText: 'Hi there, I am Megan. Please stay sheltered on the bench while your driver arrives.',
  },
  {
    id: 'theo',
    name: 'Theo',
    gender: 'male',
    accent: 'British (UK)',
    flag: '🇬🇧',
    tone: 'Calm & Trustworthy',
    description: 'Trusted presenter voice with distinct British pronunciation and calm pacing.',
    sampleText: 'Good day. Theo here. Your location is confirmed and ready to share with your caregiver.',
  },
  {
    id: 'en-US-1',
    name: 'US Neutral',
    gender: 'female',
    accent: 'American (US)',
    flag: '🇺🇸',
    tone: 'Standard Clarity',
    description: 'Standard neutral American English synthesis voice for general guidance.',
    sampleText: 'Senior SafeSpot navigation active. Your current address has been confirmed.',
  },
  {
    id: 'en-GB-1',
    name: 'UK Neutral',
    gender: 'female',
    accent: 'British (UK)',
    flag: '🇬🇧',
    tone: 'Standard Clarity',
    description: 'Standard neutral British English synthesis voice for general guidance.',
    sampleText: 'Senior SafeSpot navigation active. Your current address has been confirmed.',
  },
];

export interface AccessibilitySettings {
  contrastTheme: HighContrastTheme;
  fontSize: FontSizeLevel;
  spokenGuidance: boolean;
  simplifiedMode: boolean;
  haptics: boolean;
  alwaysShowStreetView: boolean;
  speechmaticsVoice: string; // 'sarah' | 'jack' | 'megan' | 'theo' | 'en-US-1' | 'en-GB-1'
  speechmaticsRate?: number; // 0.85 (elder-friendly) to 1.0
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
