/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { normalisePhone, isSamePhone, createManualContact } from './contacts';
import { ensureEmergency995, EMERGENCY_995_CONTACT } from '../data/defaultContacts';
import { EmergencyContact } from '../types';

describe('normalisePhone', () => {
  it('strips formatting but keeps a leading +', () => {
    expect(normalisePhone('+65 9123 4567')).toBe('+6591234567');
    expect(normalisePhone('(65) 9123-4567')).toBe('6591234567');
  });

  it('handles an already clean number', () => {
    expect(normalisePhone('91234567')).toBe('91234567');
  });
});

describe('isSamePhone', () => {
  it('matches the same number written with and without a country code', () => {
    expect(isSamePhone('+65 9123 4567', '91234567')).toBe(true);
  });

  it('does not match different numbers', () => {
    expect(isSamePhone('91234567', '98765432')).toBe(false);
  });

  it('does not match when either side is empty', () => {
    expect(isSamePhone('', '91234567')).toBe(false);
  });
});

describe('createManualContact', () => {
  it('makes the first contact primary', () => {
    expect(createManualContact('Sarah', '91234567', 0).isPrimary).toBe(true);
  });

  it('does not make later contacts primary', () => {
    expect(createManualContact('Ahmad', '98765432', 2).isPrimary).toBe(false);
  });

  it('normalises the phone number it stores', () => {
    expect(createManualContact('Mei', '+65 9123 4567', 1).phone).toBe('+6591234567');
  });
});

describe('ensureEmergency995', () => {
  const family: EmergencyContact[] = [
    {
      id: 'contact-sarah',
      name: 'Sarah',
      relationship: 'Daughter',
      phone: '91234567',
      emoji: '👩',
      bgColor: 'bg-pine',
      isPrimary: true,
    },
  ];

  it('adds 995 when it is missing', () => {
    const result = ensureEmergency995(family);
    expect(result[0].id).toBe(EMERGENCY_995_CONTACT.id);
    expect(result).toHaveLength(2);
  });

  it('restores 995 after a user deletes it', () => {
    const withoutEmergency = ensureEmergency995(family).filter((c) => c.phone !== '995');
    expect(ensureEmergency995(withoutEmergency).some((c) => c.phone === '995')).toBe(true);
  });

  it('never duplicates 995', () => {
    const twice = ensureEmergency995(ensureEmergency995(family));
    expect(twice.filter((c) => c.phone === '995')).toHaveLength(1);
  });

  it('keeps 995 first so it is never scrolled past in an emergency', () => {
    const result = ensureEmergency995([...family, EMERGENCY_995_CONTACT]);
    expect(result[0].phone).toBe('995');
  });

  it('marks the emergency contact as locked', () => {
    expect(ensureEmergency995(family)[0].locked).toBe(true);
  });

  it('preserves the family contacts alongside it', () => {
    const result = ensureEmergency995(family);
    expect(result.some((c) => c.name === 'Sarah')).toBe(true);
  });
});
