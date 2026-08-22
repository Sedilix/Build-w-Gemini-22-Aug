/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EmergencyContact } from '../types';

/**
 * Import emergency contacts straight from the phone's address book via the
 * Contact Picker API, so a senior never has to type a phone number.
 *
 * The picker is Android Chrome only and needs a secure context and a user
 * gesture; every other browser falls back to entering contacts by hand, which
 * is why {@link isContactPickerSupported} is checked before the button is shown.
 */

interface ContactsManagerLike {
  select: (
    properties: string[],
    options?: { multiple?: boolean }
  ) => Promise<Array<{ name?: string[]; tel?: string[]; email?: string[] }>>;
  getProperties?: () => Promise<string[]>;
}

function getContactsManager(): ContactsManagerLike | null {
  if (typeof navigator === 'undefined') return null;
  const manager = (navigator as any).contacts;
  if (!manager || typeof manager.select !== 'function') return null;
  return manager as ContactsManagerLike;
}

export function isContactPickerSupported(): boolean {
  if (typeof window !== 'undefined' && !window.isSecureContext) return false;
  return getContactsManager() !== null;
}

/** Rotating palette so imported contacts are visually distinguishable. */
const CONTACT_COLORS = [
  'bg-pine hover:bg-pine-deep text-on-pine',
  'bg-sky hover:bg-sky-deep text-white',
  'bg-ochre hover:bg-ochre-deep text-white',
  'bg-brick hover:bg-brick-deep text-on-brick',
];

const CONTACT_EMOJI = ['👤', '👨', '👩', '🧑'];

/** Keep only digits and a leading +, the shape a tel: link needs. */
export function normalisePhone(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/[^\d]/g, '');
}

/**
 * Two numbers are the same contact if their digits match once formatting is
 * stripped, so "+65 9123 4567" does not get added twice as "91234567".
 */
export function isSamePhone(a: string, b: string): boolean {
  const digits = (v: string) => v.replace(/[^\d]/g, '');
  const da = digits(a);
  const db = digits(b);
  if (!da || !db) return false;
  // Compare the last 8 digits: Singapore local numbers with and without +65.
  return da.slice(-8) === db.slice(-8);
}

export interface ContactImportResult {
  imported: EmergencyContact[];
  /** Contacts skipped because they were already in the list. */
  duplicates: number;
  error?: string;
}

/**
 * Open the system contact picker. Must be called from a user gesture.
 */
export async function importContactsFromPhone(
  existing: EmergencyContact[]
): Promise<ContactImportResult> {
  const manager = getContactsManager();
  if (!manager) {
    return { imported: [], duplicates: 0, error: 'This browser cannot open the phone contact book.' };
  }

  try {
    const selected = await manager.select(['name', 'tel'], { multiple: true });

    const imported: EmergencyContact[] = [];
    let duplicates = 0;

    selected.forEach((entry, index) => {
      const name = entry.name?.[0]?.trim();
      const phone = entry.tel?.[0] ? normalisePhone(entry.tel[0]) : '';
      if (!name || !phone) return;

      const alreadyKnown =
        existing.some((c) => isSamePhone(c.phone, phone)) ||
        imported.some((c) => isSamePhone(c.phone, phone));

      if (alreadyKnown) {
        duplicates += 1;
        return;
      }

      imported.push({
        id: `contact-${Date.now()}-${index}`,
        name,
        relationship: 'Family / Friend',
        phone,
        emoji: CONTACT_EMOJI[(existing.length + index) % CONTACT_EMOJI.length],
        bgColor: CONTACT_COLORS[(existing.length + index) % CONTACT_COLORS.length],
        isPrimary: existing.length === 0 && index === 0,
      });
    });

    return { imported, duplicates };
  } catch (err: any) {
    // Dismissing the picker is a normal outcome, not a failure worth shouting about.
    if (err?.name === 'AbortError') {
      return { imported: [], duplicates: 0 };
    }
    return {
      imported: [],
      duplicates: 0,
      error: err?.message || 'Could not read contacts from this device.',
    };
  }
}

/** Build a contact from hand-typed details, for browsers without the picker. */
export function createManualContact(
  name: string,
  phone: string,
  existingCount: number,
  relationship = 'Family / Friend'
): EmergencyContact {
  return {
    id: `contact-${Date.now()}`,
    name: name.trim(),
    relationship,
    phone: normalisePhone(phone),
    emoji: CONTACT_EMOJI[existingCount % CONTACT_EMOJI.length],
    bgColor: CONTACT_COLORS[existingCount % CONTACT_COLORS.length],
    isPrimary: existingCount === 0,
  };
}
