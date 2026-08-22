/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EmergencyContact } from '../types';

export const DEFAULT_CONTACTS: EmergencyContact[] = [
  {
    id: 'contact-sarah',
    name: 'Sarah (Daughter)',
    relationship: 'Daughter',
    phone: '+65 9123 4567',
    emoji: '👩‍💼',
    bgColor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    isPrimary: true,
    notes: 'Lives in Bishan (10 mins away). Drives white Toyota.',
  },
  {
    id: 'contact-david',
    name: 'David (Son)',
    relationship: 'Son',
    phone: '+65 9876 5432',
    emoji: '👨‍💼',
    bgColor: 'bg-sky-600 hover:bg-sky-700 text-white',
    isPrimary: false,
    notes: 'Available on WhatsApp & calls.',
  },
  {
    id: 'contact-elena',
    name: 'Nurse Priya (Caregiver)',
    relationship: 'Caregiver',
    phone: '+65 8234 5678',
    emoji: '🩺',
    bgColor: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    isPrimary: false,
    notes: 'Home nursing & polyclinic appointment escort.',
  },
  {
    id: 'contact-emergency',
    name: 'Singapore SCDF Ambulance (995)',
    relationship: 'Emergency Services',
    phone: '995',
    emoji: '🚨',
    bgColor: 'bg-rose-600 hover:bg-rose-700 text-white',
    isPrimary: false,
    notes: 'Singapore Civil Defence Force (SCDF) Emergency Medical & Rescue.',
  },
];
