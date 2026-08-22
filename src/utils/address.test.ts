/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { formatConciseAddress, formatDriverHint } from './address';

describe('formatConciseAddress', () => {
  it('reduces a full reverse-geocoded chain to street and postal code', () => {
    const full =
      'North Buona Vista Road, One North, one-north, Queenstown, Central Region, Singapore, 139951, Singapore';
    expect(formatConciseAddress(full)).toBe('North Buona Vista Road, One North, S139951');
  });

  it('keeps a block number with its street', () => {
    const full = 'Blk 123 Toa Payoh Lorong 1, Toa Payoh, Central Region, Singapore, 310123, Singapore';
    expect(formatConciseAddress(full)).toBe('Blk 123 Toa Payoh Lorong 1, Toa Payoh, S310123');
  });

  it('drops administrative filler and the duplicated country', () => {
    const result = formatConciseAddress('Orchard Road, Singapore, Central Region, Singapore, 238823, Singapore');
    expect(result).toBe('Orchard Road, S238823');
    expect(result).not.toMatch(/Central Region/);
  });

  it('collapses a planning area that repeats the street in another case', () => {
    // "One North" and "one-north" are the same place written twice.
    const result = formatConciseAddress('one-north, One North, Queenstown, Singapore, 138632, Singapore');
    expect(result).toBe('one-north, Queenstown, S138632');
  });

  it('falls back to the leading parts when there is no postal code', () => {
    expect(formatConciseAddress('Marina Bay Sands, Bayfront Avenue, Singapore')).toBe(
      'Marina Bay Sands, Bayfront Avenue'
    );
  });

  it('returns the postal code alone when nothing else survives', () => {
    expect(formatConciseAddress('Singapore, 018956, Singapore')).toBe('S018956');
  });

  it('handles empty input without throwing', () => {
    expect(formatConciseAddress('')).toBe('');
    expect(formatConciseAddress(null)).toBe('');
    expect(formatConciseAddress(undefined)).toBe('');
  });
});

describe('formatDriverHint', () => {
  const address = 'North Buona Vista Road, One North, one-north, Queenstown, Central Region, Singapore, 139951, Singapore';

  it('strips the repeated address and keeps the actionable instruction', () => {
    const instruction = `Pickup at ${address}. Driver should pull up directly near curbside entrance.`;
    expect(formatDriverHint(instruction, address)).toBe('Driver should pull up directly near curbside entrance.');
  });

  it('returns nothing when the instruction was only the address', () => {
    expect(formatDriverHint(`Pickup at ${address}.`, address)).toBe('');
  });

  it('keeps an instruction that never mentioned the address', () => {
    expect(formatDriverHint('Wait under the sheltered walkway.', address)).toBe(
      'Wait under the sheltered walkway.'
    );
  });

  it('handles empty input without throwing', () => {
    expect(formatDriverHint('', address)).toBe('');
    expect(formatDriverHint(null, null)).toBe('');
  });
});
