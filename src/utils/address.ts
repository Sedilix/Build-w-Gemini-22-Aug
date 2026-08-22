/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Reverse geocoders return the full administrative chain — planning area,
 * region, country, often the country twice. A senior reading their phone at a
 * kerbside, or a driver glancing at a message, needs the street and the postal
 * code and nothing else.
 */

/** Singapore postal codes are exactly six digits. */
const SG_POSTAL = /\b(\d{6})\b/;

/**
 * Administrative filler that carries no navigational value. Planning areas and
 * regions repeat what the street and postal code already say.
 */
const ADMIN_NOISE = new Set([
  'singapore',
  'central region',
  'north region',
  'north-east region',
  'east region',
  'west region',
  'central water catchment',
]);

/**
 * Reduce a full formatted address to the part worth reading aloud: the
 * building or street, plus the postal code.
 *
 * "North Buona Vista Road, One North, one-north, Queenstown, Central Region,
 *  Singapore, 139951, Singapore"  →  "North Buona Vista Road, S139951"
 */
export function formatConciseAddress(fullAddress?: string | null): string {
  if (!fullAddress) return '';

  const postal = fullAddress.match(SG_POSTAL)?.[1];

  const parts = fullAddress
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    // Drop the postal code itself; it is re-appended in a consistent format.
    .filter((p) => p !== postal)
    .filter((p) => !ADMIN_NOISE.has(p.toLowerCase()));

  // Planning areas often repeat the street in a different case ("One North"
  // vs "one-north"), so compare loosely when removing duplicates.
  const seen = new Set<string>();
  const unique = parts.filter((p) => {
    const key = p.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // The leading elements are the specific ones: block, building, street.
  const head = unique.slice(0, 2);

  if (postal) {
    return head.length > 0 ? `${head.join(', ')}, S${postal}` : `S${postal}`;
  }

  return head.join(', ') || fullAddress.trim();
}

/**
 * The actionable half of a driver instruction, with any repeated address
 * stripped out. The address is shown beside it, so repeating it wastes the
 * senior's screen and the driver's attention.
 */
export function formatDriverHint(instruction?: string | null, fullAddress?: string | null): string {
  if (!instruction) return '';

  let hint = instruction.trim();

  // Remove a leading "Pickup at <address>." preamble.
  hint = hint.replace(/^pick\s*up\s+at\s+/i, '');

  if (fullAddress) {
    const escaped = fullAddress.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    hint = hint.replace(new RegExp(escaped, 'gi'), '').trim();
  }

  // Tidy up the punctuation left behind by the removal.
  hint = hint.replace(/^[\s.,;:–-]+/, '').replace(/\s{2,}/g, ' ').trim();

  // If stripping the address consumed the whole sentence there is no hint left.
  if (hint.length < 8) return '';

  return hint.charAt(0).toUpperCase() + hint.slice(1);
}
