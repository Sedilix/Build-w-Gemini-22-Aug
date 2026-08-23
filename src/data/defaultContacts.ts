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
