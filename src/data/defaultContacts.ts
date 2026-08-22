/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EmergencyContact } from '../types';

/**
 * Hard-coded Singapore SCDF emergency contact. Always present in the contact
 * list and can never be removed or edited by the user.
 */
export const EMERGENCY_995_CONTACT: EmergencyContact = {
  id: 'contact-emergency',
  name: 'Singapore SCDF Ambulance (995)',
  relationship: 'Emergency Services',
  phone: '995',
  emoji: '🚨',
  bgColor: 'bg-rose-600 hover:bg-rose-700 text-white',
  isPrimary: false,
  notes: 'Singapore Civil Defence Force (SCDF) Emergency Medical & Rescue.',
  locked: true,
};

/**
 * Guarantees the locked 995 SCDF contact is always part of the list, no
 * matter how contacts are added, synced, or re-ordered.
 */
export function ensureEmergency995(contacts: EmergencyContact[]): EmergencyContact[] {
  const without995 = contacts.filter((c) => c.id !== EMERGENCY_995_CONTACT.id && c.phone !== '995');
  return [EMERGENCY_995_CONTACT, ...without995];
}

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
  EMERGENCY_995_CONTACT,
];
