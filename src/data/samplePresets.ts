/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LocationPreset } from '../types';

export const LOCATION_PRESETS: LocationPreset[] = [
  {
    id: 'preset-toa-payoh-hub',
    title: 'Toa Payoh Hub • Central Taxi Stand & Plaza',
    subtitle: '480 Lorong 6 Toa Payoh, Singapore 310480',
    description: 'Waiting at the covered passenger pick-up point next to Toa Payoh MRT Exit C and Guardian Pharmacy.',
    lat: 1.3327,
    lng: 103.8479,
    accuracy: 10,
    sampleImageUrl: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=800&q=80',
    landmarkHint: 'Covered taxi stand shelter, Toa Payoh MRT Exit C sign, Guardian Pharmacy glass storefront, sheltered walkway benches.',
  },
  {
    id: 'preset-sgh-outram',
    title: 'Singapore General Hospital (SGH) • Block 4 Drop-off',
    subtitle: 'Outram Road, Singapore 169608',
    description: 'Sitting under the patient drop-off porch beside the blue wheelchair ramp and SingHealth info counter.',
    lat: 1.2801,
    lng: 103.8344,
    accuracy: 8,
    sampleImageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80',
    landmarkHint: 'White covered hospital drop-off porch, SingHealth logo sign, blue accessibility ramp, security post.',
  },
  {
    id: 'preset-chinatown-kreta-ayer',
    title: 'Chinatown Complex • Kreta Ayer Square Bench',
    subtitle: '335 Smith Street, Singapore 050335',
    description: 'Resting on the sheltered stone chess pavilion benches in front of Buddha Tooth Relic Temple plaza.',
    lat: 1.2823,
    lng: 103.8439,
    accuracy: 12,
    sampleImageUrl: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=800&q=80',
    landmarkHint: 'Red tiled traditional pavilion pillars, Chinese chess stone tables, Buddha Tooth Relic Temple view, covered walkway.',
  },
  {
    id: 'preset-tampines-hub',
    title: 'Our Tampines Hub (OTH) • Main South Entrance Curb',
    subtitle: '1 Tampines Walk, Singapore 528523',
    description: 'Standing at the well-lit passenger pick-up curb outside the Community Auditorium & NTUC FairPrice.',
    lat: 1.3533,
    lng: 103.9402,
    accuracy: 7,
    sampleImageUrl: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=800&q=80',
    landmarkHint: 'Our Tampines Hub large green sign, glass entrance doors to NTUC, covered pickup drive, yellow safety bollards.',
  },
];
